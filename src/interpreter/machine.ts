// The Machine holds all mutable simulation state: the call stack, Web APIs,
// the micro/macro task queues, the console, the simulated clock, and the
// Promise primitives. It is deliberately framework-agnostic — the React layer
// only ever reads immutable Snapshot objects produced by `snapshot()`.

import { Environment } from './environment';
import type { ConsoleLine, Phase, Snapshot, StackFrame, WebApiItem } from './types';
import { PHASE_LABELS } from './types';
import { isPromise, type PromiseValue, type RuntimeValue } from './values';

/** A unit of deferred work waiting in a queue. */
export interface Job {
  id: string;
  label: string;
  kind: 'microtask' | 'macrotask';
  run: () => Generator<StepSignal, void, RuntimeValue>;
}

/** A simulated Web API timer (setTimeout/setInterval). */
export interface Timer {
  id: string;
  label: string;
  kind: 'timer' | 'interval';
  remaining: number;
  delay: number;
  callback: RuntimeValue;
  args: RuntimeValue[];
  cleared: boolean;
  /** Remaining fire count for intervals (step-capped). */
  firesLeft: number;
}

/** Signal yielded by evaluator generators at each step boundary. */
export type StepSignal = void | { await: PromiseValue };

/** A runtime exception carrying an interpreter runtime value. */
export class InterpreterThrow {
  constructor(public value: RuntimeValue) {}
}

/** A user-level reaction attached by .then/.catch/.finally. */
export interface UserReaction {
  kind: 'user';
  onFulfilled?: RuntimeValue;
  onRejected?: RuntimeValue;
  isFinally?: boolean;
  resultPromise: PromiseValue;
}

/** A native reaction used internally by promise adoption. */
export interface NativeReaction {
  kind: 'native';
  onFulfilled: (v: RuntimeValue) => void;
  onRejected: (e: RuntimeValue) => void;
}

/**
 * A reaction used by `await`: when the awaited promise settles, exactly one
 * microtask is queued whose body resumes the suspended async function (and may
 * itself yield steps).
 */
export interface ResumeReaction {
  kind: 'resume';
  label: string;
  make: (value: RuntimeValue, rejected: boolean) => Job['run'];
}

type Reaction = UserReaction | NativeReaction | ResumeReaction;

const MAX_INTERVAL_FIRES = 8;

export class Machine {
  globalEnv = new Environment();
  callStack: StackFrame[] = [];
  timers: Timer[] = [];
  microtasks: Job[] = [];
  macrotasks: Job[] = [];
  consoleLines: ConsoleLine[] = [];

  phase: Phase = 'idle';
  currentLine: number | null = null;
  stepCount = 0;
  error: string | null = null;
  done = false;
  clock = 0;

  /** Reactions pending on each promise id while it is still pending. */
  private pendingReactions = new Map<number, Reaction[]>();

  private idCounter = 0;
  private promiseCounter = 0;

  /** Injected by the interpreter to avoid a static import cycle. */
  callFunction!: (
    fn: RuntimeValue,
    args: RuntimeValue[],
  ) => Generator<StepSignal, RuntimeValue, RuntimeValue>;

  nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${this.idCounter}`;
  }

  // ---- Console ---------------------------------------------------------
  log(level: ConsoleLine['level'], text: string): void {
    this.consoleLines.push({ id: this.nextId('log'), level, text });
  }

  // ---- Call stack ------------------------------------------------------
  pushFrame(name: string): StackFrame {
    const frame: StackFrame = { id: this.nextId('frame'), name, line: this.currentLine };
    this.callStack.push(frame);
    return frame;
  }

  popFrame(): void {
    this.callStack.pop();
  }

  // ---- Timers / Web APIs ----------------------------------------------
  addTimer(
    kind: 'timer' | 'interval',
    delay: number,
    callback: RuntimeValue,
    args: RuntimeValue[],
  ): string {
    const n = this.timers.length + 1;
    const id = this.nextId('timer');
    this.timers.push({
      id,
      label: `${kind === 'timer' ? 'setTimeout' : 'setInterval'} #${n} (${delay}ms)`,
      kind,
      remaining: delay,
      delay,
      callback,
      args,
      cleared: false,
      firesLeft: kind === 'interval' ? MAX_INTERVAL_FIRES : 1,
    });
    return id;
  }

  clearTimer(id: RuntimeValue): void {
    if (typeof id !== 'string') return;
    const t = this.timers.find((x) => x.id === id);
    if (t) t.cleared = true;
    this.timers = this.timers.filter((x) => x.id !== id || !x.cleared);
  }

  /** True when any task or timer is still outstanding. */
  hasPendingWork(): boolean {
    return (
      this.microtasks.length > 0 ||
      this.macrotasks.length > 0 ||
      this.timers.some((t) => !t.cleared)
    );
  }

  /**
   * Move any expired timers into the macrotask queue. If none are ready yet,
   * fast-forward the simulated clock to the soonest timer so progress is made.
   * Returns true if at least one timer fired.
   */
  releaseReadyTimers(): boolean {
    const live = this.timers.filter((t) => !t.cleared);
    if (live.length === 0) return false;

    const anyReady = live.some((t) => t.remaining <= 0);
    if (!anyReady) {
      const soonest = Math.min(...live.map((t) => t.remaining));
      if (soonest > 0) {
        this.clock += soonest;
        for (const t of live) t.remaining -= soonest;
      }
    }

    let releasedSomething = false;
    for (const t of live) {
      if (t.remaining <= 0 && !t.cleared) {
        releasedSomething = true;
        const timer = t;
        this.enqueueMacrotask(
          timer.kind === 'timer' ? 'timeout cb' : 'interval cb',
          () => this.runTimerCallback(timer),
        );

        if (timer.kind === 'interval' && timer.firesLeft > 1) {
          timer.firesLeft -= 1;
          timer.remaining = timer.delay;
        } else {
          timer.cleared = true;
        }
      }
    }
    this.timers = this.timers.filter((t) => !t.cleared);
    return releasedSomething;
  }

  private *runTimerCallback(timer: Timer): Generator<StepSignal, void, RuntimeValue> {
    yield* this.callFunction(timer.callback, timer.args);
  }

  // ---- Queues ----------------------------------------------------------
  enqueueMicrotask(label: string, run: Job['run']): void {
    this.microtasks.push({ id: this.nextId('micro'), label, kind: 'microtask', run });
  }

  enqueueMacrotask(label: string, run: Job['run']): void {
    this.macrotasks.push({ id: this.nextId('macro'), label, kind: 'macrotask', run });
  }

  // ---- Promises --------------------------------------------------------
  createPromise(): PromiseValue {
    this.promiseCounter += 1;
    return {
      type: 'promise',
      id: this.promiseCounter,
      state: 'pending',
      value: undefined,
      reactions: [],
      handled: false,
    };
  }

  resolvePromise(p: PromiseValue, value: RuntimeValue): void {
    if (p.state !== 'pending') return;
    // Adopt the state of a thenable (chaining / nested promises).
    if (isPromise(value)) {
      this.subscribe(
        value,
        (v) => this.resolvePromise(p, v),
        (e) => this.rejectPromise(p, e),
      );
      return;
    }
    p.state = 'fulfilled';
    p.value = value;
    this.flushReactions(p);
  }

  rejectPromise(p: PromiseValue, reason: RuntimeValue): void {
    if (p.state !== 'pending') return;
    p.state = 'rejected';
    p.value = reason;
    this.flushReactions(p);
  }

  /** Attach native resolve/reject callbacks (used for adoption & await). */
  subscribe(
    p: PromiseValue,
    onFulfilled: (v: RuntimeValue) => void,
    onRejected: (e: RuntimeValue) => void,
  ): void {
    this.attach(p, { kind: 'native', onFulfilled, onRejected });
  }

  /** Register a user reaction (.then/.catch/.finally). */
  addUserReaction(p: PromiseValue, reaction: UserReaction): void {
    this.attach(p, reaction);
  }

  /** Register an await continuation that resumes when `p` settles. */
  onSettleResume(
    p: PromiseValue,
    label: string,
    make: ResumeReaction['make'],
  ): void {
    this.attach(p, { kind: 'resume', label, make });
  }

  private attach(p: PromiseValue, reaction: Reaction): void {
    p.handled = true;
    if (p.state === 'pending') {
      const list = this.pendingReactions.get(p.id) ?? [];
      list.push(reaction);
      this.pendingReactions.set(p.id, list);
    } else {
      this.scheduleReaction(p, reaction);
    }
  }

  private flushReactions(p: PromiseValue): void {
    const list = this.pendingReactions.get(p.id) ?? [];
    this.pendingReactions.delete(p.id);
    for (const r of list) this.scheduleReaction(p, r);
  }

  private scheduleReaction(p: PromiseValue, r: Reaction): void {
    const machine = this;
    if (r.kind === 'native') {
      machine.enqueueMicrotask('settle', function* () {
        if (p.state === 'fulfilled') r.onFulfilled(p.value);
        else r.onRejected(p.value);
      });
      return;
    }
    if (r.kind === 'resume') {
      const rejected = p.state === 'rejected';
      machine.microtasks.push({
        id: machine.nextId('micro'),
        label: r.label,
        kind: 'microtask',
        run: r.make(p.value, rejected),
      });
      return;
    }
    const label = p.state === 'fulfilled' ? '.then cb' : r.onRejected ? '.catch cb' : '.then cb';
    machine.enqueueMicrotask(label, function* () {
      yield* machine.runUserReaction(p, r);
    });
  }

  private *runUserReaction(
    p: PromiseValue,
    r: UserReaction,
  ): Generator<StepSignal, void, RuntimeValue> {
    const settled = p.value;

    if (r.isFinally) {
      try {
        const fin = r.onFulfilled; // finally stores its callback in onFulfilled
        if (fin) yield* this.callFunction(fin, []);
        if (p.state === 'fulfilled') this.resolvePromise(r.resultPromise, settled);
        else this.rejectPromise(r.resultPromise, settled);
      } catch (err) {
        this.rejectPromise(r.resultPromise, unwrapThrow(err));
      }
      return;
    }

    const handler = p.state === 'fulfilled' ? r.onFulfilled : r.onRejected;
    if (handler === undefined) {
      // No handler for this state — pass the settlement straight through.
      if (p.state === 'fulfilled') this.resolvePromise(r.resultPromise, settled);
      else this.rejectPromise(r.resultPromise, settled);
      return;
    }

    try {
      const result = yield* this.callFunction(handler, [settled]);
      this.resolvePromise(r.resultPromise, result);
    } catch (err) {
      this.rejectPromise(r.resultPromise, unwrapThrow(err));
    }
  }

  // ---- Snapshot --------------------------------------------------------
  snapshot(): Snapshot {
    const webApis: WebApiItem[] = this.timers
      .filter((t) => !t.cleared)
      .map((t) => ({
        id: t.id,
        label: t.label,
        kind: t.kind,
        remaining: t.remaining,
        delay: t.delay,
      }));

    // Keep the top frame's line in sync with the program counter.
    if (this.callStack.length > 0) {
      this.callStack[this.callStack.length - 1].line = this.currentLine;
    }

    return {
      stepCount: this.stepCount,
      phase: this.phase,
      phaseLabel: PHASE_LABELS[this.phase],
      currentLine: this.currentLine,
      callStack: this.callStack.map((f) => ({ ...f })),
      webApis,
      microtasks: this.microtasks.map((j) => ({ id: j.id, label: j.label, kind: j.kind })),
      macrotasks: this.macrotasks.map((j) => ({ id: j.id, label: j.label, kind: j.kind })),
      console: this.consoleLines.map((c) => ({ ...c })),
      error: this.error,
      done: this.done,
      clock: this.clock,
    };
  }
}

export function unwrapThrow(err: unknown): RuntimeValue {
  if (err instanceof InterpreterThrow) return err.value;
  if (err instanceof Error) return err.message;
  return String(err);
}
