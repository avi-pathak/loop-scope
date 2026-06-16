// Built-in globals exposed to interpreted code: console, setTimeout/setInterval,
// clearTimeout/clearInterval, queueMicrotask, Promise (+ statics), and Math.

import { InterpreterThrow, type Machine, type StepSignal } from './machine';
import { callFunction } from './interpreter';
import {
  isCallable,
  stringify,
  toNumber,
  type NativeFunction,
  type PromiseValue,
  type RuntimeObject,
  type RuntimeValue,
} from './values';

type Gen<T = RuntimeValue> = Generator<StepSignal, T, RuntimeValue>;

function native(name: string, call: NativeFunction['call']): NativeFunction {
  return { type: 'native', name, call };
}

export function installGlobals(machine: Machine): void {
  const env = machine.globalEnv;

  // ---- console -----------------------------------------------------------
  const consoleObj: RuntimeObject = { type: 'object', properties: new Map() };
  const logWith = (level: 'log' | 'error' | 'info') =>
    native(`console.${level}`, function* (args) {
      machine.log(level, args.map((a) => stringify(a)).join(' '));
      return undefined;
    });
  consoleObj.properties.set('log', logWith('log'));
  consoleObj.properties.set('info', logWith('info'));
  consoleObj.properties.set('warn', logWith('error'));
  consoleObj.properties.set('error', logWith('error'));
  env.declare('console', consoleObj);

  // ---- timers ------------------------------------------------------------
  env.declare(
    'setTimeout',
    native('setTimeout', function* (args) {
      const cb = args[0];
      const delay = args[1] === undefined ? 0 : toNumber(args[1]);
      if (!isCallable(cb)) throw new InterpreterThrow('setTimeout expects a function');
      return machine.addTimer('timer', Math.max(0, delay), cb, args.slice(2));
    }),
  );
  env.declare(
    'setInterval',
    native('setInterval', function* (args) {
      const cb = args[0];
      const delay = args[1] === undefined ? 0 : toNumber(args[1]);
      if (!isCallable(cb)) throw new InterpreterThrow('setInterval expects a function');
      return machine.addTimer('interval', Math.max(0, delay), cb, args.slice(2));
    }),
  );
  const clear = native('clearTimeout', function* (args) {
    machine.clearTimer(args[0]);
    return undefined;
  });
  env.declare('clearTimeout', clear);
  env.declare('clearInterval', clear);

  // ---- queueMicrotask ----------------------------------------------------
  env.declare(
    'queueMicrotask',
    native('queueMicrotask', function* (args) {
      const cb = args[0];
      if (!isCallable(cb)) throw new InterpreterThrow('queueMicrotask expects a function');
      machine.enqueueMicrotask('queueMicrotask cb', function* () {
        yield* callFunction(machine, cb, []);
      });
      return undefined;
    }),
  );

  // ---- Promise -----------------------------------------------------------
  env.declare('Promise', makePromiseConstructor(machine));

  // ---- Math --------------------------------------------------------------
  env.declare('Math', makeMath());

  // ---- JSON (minimal) ----------------------------------------------------
  const json: RuntimeObject = { type: 'object', properties: new Map() };
  json.properties.set(
    'stringify',
    native('JSON.stringify', function* (args) {
      return stringify(args[0]);
    }),
  );
  env.declare('JSON', json);
}

function makePromiseConstructor(machine: Machine): NativeFunction {
  const ctor = native('Promise', function* (args): Gen {
    const executor = args[0];
    const promise = machine.createPromise();
    const resolveFn = native('resolve', function* (a) {
      machine.resolvePromise(promise, a[0]);
      return undefined;
    });
    const rejectFn = native('reject', function* (a) {
      machine.rejectPromise(promise, a[0]);
      return undefined;
    });
    if (isCallable(executor)) {
      try {
        yield* callFunction(machine, executor, [resolveFn, rejectFn]);
      } catch (err) {
        machine.rejectPromise(promise, unwrap(err));
      }
    }
    return promise;
  });

  const statics = new Map<string, RuntimeValue>();
  statics.set(
    'resolve',
    native('Promise.resolve', function* (args) {
      const p = machine.createPromise();
      machine.resolvePromise(p, args[0]);
      return p;
    }),
  );
  statics.set(
    'reject',
    native('Promise.reject', function* (args) {
      const p = machine.createPromise();
      machine.rejectPromise(p, args[0]);
      return p;
    }),
  );
  statics.set(
    'all',
    native('Promise.all', function* (args): Gen {
      const arr = args[0];
      const items: RuntimeValue[] = arr && (arr as any).type === 'array' ? (arr as any).elements : [];
      const result = machine.createPromise();
      const results: RuntimeValue[] = new Array(items.length);
      let remaining = items.length;
      if (remaining === 0) {
        machine.resolvePromise(result, { type: 'array', elements: [] });
        return result;
      }
      items.forEach((item, i) => {
        const p: PromiseValue =
          item && (item as any).type === 'promise'
            ? (item as PromiseValue)
            : (() => {
                const r = machine.createPromise();
                machine.resolvePromise(r, item);
                return r;
              })();
        machine.subscribe(
          p,
          (v) => {
            results[i] = v;
            remaining -= 1;
            if (remaining === 0) {
              machine.resolvePromise(result, { type: 'array', elements: results });
            }
          },
          (e) => machine.rejectPromise(result, e),
        );
      });
      return result;
    }),
  );
  ctor.statics = statics;
  return ctor;
}

function makeMath(): RuntimeObject {
  const math: RuntimeObject = { type: 'object', properties: new Map() };
  math.properties.set('PI', Math.PI);
  math.properties.set('E', Math.E);
  const unary = (name: string, fn: (n: number) => number) =>
    math.properties.set(
      name,
      native(`Math.${name}`, function* (args) {
        return fn(toNumber(args[0]));
      }),
    );
  unary('floor', Math.floor);
  unary('ceil', Math.ceil);
  unary('round', Math.round);
  unary('abs', Math.abs);
  unary('sqrt', Math.sqrt);
  math.properties.set(
    'max',
    native('Math.max', function* (args) {
      return Math.max(...args.map(toNumber));
    }),
  );
  math.properties.set(
    'min',
    native('Math.min', function* (args) {
      return Math.min(...args.map(toNumber));
    }),
  );
  math.properties.set(
    'random',
    native('Math.random', function* () {
      return Math.random();
    }),
  );
  math.properties.set(
    'pow',
    native('Math.pow', function* (args) {
      return Math.pow(toNumber(args[0]), toNumber(args[1]));
    }),
  );
  return math;
}

function unwrap(err: unknown): RuntimeValue {
  if (err instanceof InterpreterThrow) return err.value;
  if (err instanceof Error) return err.message;
  return String(err);
}
