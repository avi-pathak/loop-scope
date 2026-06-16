// Public model + snapshot types shared between the interpreter/event-loop core
// and the React visualization layer. The interpreter never imports React, and
// the UI only ever consumes immutable Snapshot objects produced here.

export type Phase =
  | 'idle'
  | 'sync'
  | 'check-stack-empty'
  | 'drain-microtasks'
  | 'render'
  | 'macrotask'
  | 'timer-advance'
  | 'done'
  | 'error';

export const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Idle',
  sync: 'Running sync code',
  'check-stack-empty': 'Stack empty?',
  'drain-microtasks': 'Drain microtasks',
  render: 'Render',
  macrotask: 'Pull one macrotask',
  'timer-advance': 'Advancing timers',
  done: 'Done',
  error: 'Error',
};

/** A single frame on the simulated call stack. */
export interface StackFrame {
  id: string;
  name: string;
  /** 1-based source line currently executing inside this frame, if known. */
  line: number | null;
}

/** An async operation in flight inside the (simulated) Web APIs environment. */
export interface WebApiItem {
  id: string;
  /** Human label, e.g. "setTimeout #2". */
  label: string;
  kind: 'timer' | 'interval';
  /** Remaining simulated milliseconds before it fires; null for non-timers. */
  remaining: number | null;
  delay: number;
}

/** An entry waiting in the microtask or macrotask queue. */
export interface QueueItem {
  id: string;
  label: string;
  kind: 'microtask' | 'macrotask';
}

export interface ConsoleLine {
  id: string;
  /** 'log' | 'error' | 'info' */
  level: 'log' | 'error' | 'info';
  text: string;
}

/** Immutable snapshot of the whole machine at a single step boundary. */
export interface Snapshot {
  stepCount: number;
  phase: Phase;
  phaseLabel: string;
  currentLine: number | null;
  callStack: StackFrame[];
  webApis: WebApiItem[];
  microtasks: QueueItem[];
  macrotasks: QueueItem[];
  console: ConsoleLine[];
  error: string | null;
  done: boolean;
  /** Simulated clock in milliseconds. */
  clock: number;
}
