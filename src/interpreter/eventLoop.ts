// The event-loop driver. It runs the synchronous program to completion, then
// repeatedly: drains the ENTIRE microtask queue, renders, advances timers, and
// pulls exactly ONE macrotask per iteration — mirroring the real event loop.

import { parse } from 'acorn';
import { createMachine, evalProgram } from './interpreter';
import { Machine, unwrapThrow, type StepSignal } from './machine';
import type { RuntimeValue } from './values';
import type { Snapshot } from './types';

/** The master generator: sync phase + the event-loop phases. */
function* runEventLoop(machine: Machine): Generator<StepSignal, void, RuntimeValue> {
  // 1) Synchronous phase — stack drains fully before anything else.
  machine.phase = 'sync';
  yield* evalProgram(machine);

  // 2) Event loop.
  let safety = 0;
  while (machine.hasPendingWork()) {
    if (safety++ > 20000) {
      machine.log('error', 'Event loop step limit reached — stopping.');
      break;
    }

    machine.phase = 'check-stack-empty';
    yield;

    // Drain the ENTIRE microtask queue before any macrotask.
    while (machine.microtasks.length > 0) {
      machine.phase = 'drain-microtasks';
      const job = machine.microtasks.shift()!;
      yield* job.run();
    }

    machine.phase = 'render';
    yield;

    // Advance simulated time and move expired timers into the macrotask queue.
    if (machine.macrotasks.length === 0) {
      machine.phase = 'timer-advance';
      const released = machine.releaseReadyTimers();
      if (released) yield;
    }

    // Process exactly ONE macrotask, then loop back to re-drain microtasks.
    if (machine.macrotasks.length > 0) {
      machine.phase = 'macrotask';
      const job = machine.macrotasks.shift()!;
      yield* job.run();
    }
  }

  machine.phase = 'done';
  machine.done = true;
}

/**
 * Drives the simulation one step at a time. The React layer calls `step()`
 * repeatedly (on an interval for "Run", or once for "Step").
 */
export class Runner {
  readonly machine: Machine;
  private gen: Generator<StepSignal, void, RuntimeValue>;
  private finished = false;

  constructor(code: string) {
    let program: any;
    try {
      program = parse(code, {
        ecmaVersion: 2022,
        sourceType: 'module',
        locations: true,
      });
    } catch (err) {
      // Surface parse errors as a pre-built error machine.
      this.machine = createMachine({ type: 'Program', body: [], loc: null });
      this.machine.error = `SyntaxError: ${(err as Error).message}`;
      this.machine.phase = 'error';
      this.machine.done = true;
      this.finished = true;
      this.gen = (function* () {})();
      return;
    }
    this.machine = createMachine(program);
    this.gen = runEventLoop(this.machine);
  }

  get done(): boolean {
    return this.finished;
  }

  /** Advance one step. Returns the snapshot after that step. */
  step(): Snapshot {
    if (this.finished) return this.machine.snapshot();
    try {
      const res = this.gen.next();
      this.machine.stepCount += 1;
      if (res.done) {
        this.finished = true;
        this.machine.done = true;
        if (this.machine.phase !== 'error') this.machine.phase = 'done';
      }
    } catch (err) {
      this.machine.error = formatError(err);
      this.machine.phase = 'error';
      this.machine.done = true;
      this.finished = true;
    }
    return this.machine.snapshot();
  }

  snapshot(): Snapshot {
    return this.machine.snapshot();
  }
}

function formatError(err: unknown): string {
  const value = unwrapThrow(err);
  if (typeof value === 'string') return value;
  return String(value);
}
