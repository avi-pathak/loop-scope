// Runtime value representations for the interpreter. We model JS values
// explicitly so the simulator has full control (promises, functions, etc.).

import type { Environment } from './environment';

export type RuntimeValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | UserFunction
  | NativeFunction
  | RuntimeObject
  | RuntimeArray
  | PromiseValue;

/** A user-defined function/closure captured from the AST. */
export interface UserFunction {
  type: 'function';
  name: string;
  params: any[];
  body: any;
  /** true when the body is a single expression (arrow with implicit return). */
  expressionBody: boolean;
  isAsync: boolean;
  closure: Environment;
  /** Bound `this` for the (rare) cases we need it. */
  thisVal?: RuntimeValue;
}

/** A built-in function implemented directly in TypeScript. */
export interface NativeFunction {
  type: 'native';
  name: string;
  /** Implemented as a generator so native calls can also yield steps. */
  call: (args: RuntimeValue[], machine: any) => Generator<any, RuntimeValue, any>;
  /** Static members, e.g. Promise.resolve / Promise.all. */
  statics?: Map<string, RuntimeValue>;
}

export interface RuntimeObject {
  type: 'object';
  properties: Map<string, RuntimeValue>;
}

export interface RuntimeArray {
  type: 'array';
  elements: RuntimeValue[];
}

export type PromiseState = 'pending' | 'fulfilled' | 'rejected';

export interface PromiseReaction {
  onFulfilled?: RuntimeValue;
  onRejected?: RuntimeValue;
  /** The promise returned by .then/.catch/.finally to chain into. */
  resultPromise: PromiseValue;
  isFinally?: boolean;
}

export interface PromiseValue {
  type: 'promise';
  id: number;
  state: PromiseState;
  value: RuntimeValue;
  reactions: PromiseReaction[];
  /** true once a reaction has been attached or it has settled with handling. */
  handled: boolean;
}

export function isCallable(v: RuntimeValue): v is UserFunction | NativeFunction {
  return (
    typeof v === 'object' &&
    v !== null &&
    ((v as any).type === 'function' || (v as any).type === 'native')
  );
}

export function isPromise(v: RuntimeValue): v is PromiseValue {
  return typeof v === 'object' && v !== null && (v as any).type === 'promise';
}

export function isObject(v: RuntimeValue): v is RuntimeObject {
  return typeof v === 'object' && v !== null && (v as any).type === 'object';
}

export function isArray(v: RuntimeValue): v is RuntimeArray {
  return typeof v === 'object' && v !== null && (v as any).type === 'array';
}

/** Render a runtime value the way console.log would, for the console panel. */
export function stringify(v: RuntimeValue, seen = new Set<unknown>()): string {
  switch (typeof v) {
    case 'number':
    case 'boolean':
      return String(v);
    case 'string':
      return v;
    case 'undefined':
      return 'undefined';
  }
  if (v === null) return 'null';
  if (isPromise(v)) {
    if (v.state === 'pending') return 'Promise { <pending> }';
    if (v.state === 'rejected') return `Promise { <rejected> ${stringify(v.value, seen)} }`;
    return `Promise { ${stringify(v.value, seen)} }`;
  }
  if (isCallable(v)) {
    const name = (v as any).name || 'anonymous';
    return `[Function: ${name}]`;
  }
  if (isArray(v)) {
    if (seen.has(v)) return '[Circular]';
    seen.add(v);
    return `[ ${v.elements.map((e) => quoteInside(e, seen)).join(', ')} ]`;
  }
  if (isObject(v)) {
    if (seen.has(v)) return '[Circular]';
    seen.add(v);
    const entries = [...v.properties.entries()].map(
      ([k, val]) => `${k}: ${quoteInside(val, seen)}`,
    );
    return `{ ${entries.join(', ')} }`;
  }
  return String(v);
}

/** Like stringify, but quote strings so nested structures read naturally. */
function quoteInside(v: RuntimeValue, seen: Set<unknown>): string {
  if (typeof v === 'string') return `'${v}'`;
  return stringify(v, seen);
}

/** Coerce a runtime value to a boolean for truthiness checks. */
export function toBoolean(v: RuntimeValue): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
  if (typeof v === 'string') return v.length > 0;
  if (typeof v === 'boolean') return v;
  return true;
}

/** Coerce a runtime value to a number for arithmetic. */
export function toNumber(v: RuntimeValue): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null) return 0;
  if (v === undefined) return NaN;
  if (typeof v === 'string') {
    if (v.trim() === '') return 0;
    return Number(v);
  }
  return NaN;
}
