// Tree-walking, generator-based evaluator over the acorn AST.
//
// Every interesting node evaluation is a generator that `yield`s at step
// boundaries (`yield` with no value) so the driver can advance exactly one
// step at a time and snapshot the model in between. Function calls push/pop
// frames on the simulated call stack; `await` yields a special `{ await }`
// signal that the async driver intercepts (it never reaches the top driver).

import { Environment } from './environment';
import { InterpreterThrow, Machine, unwrapThrow, type StepSignal } from './machine';
import { installGlobals } from './natives';
import {
  isCallable,
  isArray,
  isObject,
  isPromise,
  stringify,
  toBoolean,
  toNumber,
  type PromiseValue,
  type RuntimeArray,
  type RuntimeObject,
  type RuntimeValue,
  type UserFunction,
} from './values';

// ---- Control-flow completion signals (propagated as JS exceptions) --------
class ReturnSignal {
  constructor(public value: RuntimeValue) {}
}
class BreakSignal {}
class ContinueSignal {}

type Node = any;
type Gen<T = RuntimeValue> = Generator<StepSignal, T, RuntimeValue>;

/** Pause one step, recording the current source line from the node. */
function* pause(machine: Machine, node: Node): Gen<void> {
  if (node && node.loc) machine.currentLine = node.loc.start.line;
  yield;
}

// ---------------------------------------------------------------------------
// Factory: build a Machine wired up to evaluate the given AST program.
// ---------------------------------------------------------------------------
export function createMachine(program: Node): Machine {
  const machine = new Machine();
  machine.callFunction = (fn, args) => callFunction(machine, fn, args);
  installGlobals(machine);
  // Stash the program for the event-loop driver.
  (machine as any).program = program;
  return machine;
}

/** Top-level program execution generator (synchronous phase). */
export function* evalProgram(machine: Machine): Gen<void> {
  const program: Node = (machine as any).program;
  machine.pushFrame('(main)');
  try {
    hoist(program.body, machine.globalEnv);
    yield* evalStatements(program.body, machine.globalEnv, machine);
  } catch (err) {
    if (err instanceof ReturnSignal) return;
    throw err;
  } finally {
    machine.popFrame();
  }
}

// ---- Hoisting -------------------------------------------------------------
function hoist(stmts: Node[], env: Environment): void {
  for (const s of stmts) {
    if (s.type === 'FunctionDeclaration' && s.id) {
      env.declare(s.id.name, makeFunction(s, env, s.id.name));
    }
  }
}

// ---- Statements -----------------------------------------------------------
function* evalStatements(stmts: Node[], env: Environment, machine: Machine): Gen<void> {
  for (const stmt of stmts) {
    yield* evalStatement(stmt, env, machine);
  }
}

function* evalStatement(node: Node, env: Environment, machine: Machine): Gen<void> {
  switch (node.type) {
    case 'VariableDeclaration': {
      yield* pause(machine, node);
      for (const decl of node.declarations) {
        const value = decl.init ? yield* evalExpr(decl.init, env, machine) : undefined;
        bindPattern(decl.id, value, env, machine);
      }
      return;
    }
    case 'FunctionDeclaration':
      // Already hoisted; nothing to do at execution time.
      return;
    case 'ExpressionStatement':
      yield* pause(machine, node);
      yield* evalExpr(node.expression, env, machine);
      return;
    case 'BlockStatement': {
      const blockEnv = env.child();
      hoist(node.body, blockEnv);
      yield* evalStatements(node.body, blockEnv, machine);
      return;
    }
    case 'IfStatement': {
      yield* pause(machine, node);
      const test = toBoolean(yield* evalExpr(node.test, env, machine));
      if (test) {
        yield* evalStatement(node.consequent, env, machine);
      } else if (node.alternate) {
        yield* evalStatement(node.alternate, env, machine);
      }
      return;
    }
    case 'ForStatement':
      yield* evalForStatement(node, env, machine);
      return;
    case 'WhileStatement':
      yield* evalWhileStatement(node, env, machine);
      return;
    case 'DoWhileStatement':
      yield* evalDoWhileStatement(node, env, machine);
      return;
    case 'ReturnStatement': {
      yield* pause(machine, node);
      const value = node.argument ? yield* evalExpr(node.argument, env, machine) : undefined;
      throw new ReturnSignal(value);
    }
    case 'BreakStatement':
      throw new BreakSignal();
    case 'ContinueStatement':
      throw new ContinueSignal();
    case 'TryStatement':
      yield* evalTryStatement(node, env, machine);
      return;
    case 'ThrowStatement': {
      yield* pause(machine, node);
      const value = yield* evalExpr(node.argument, env, machine);
      throw new InterpreterThrow(value);
    }
    case 'EmptyStatement':
      return;
    default:
      throw new InterpreterThrow(`Unsupported statement: ${node.type}`);
  }
}

function* evalForStatement(node: Node, env: Environment, machine: Machine): Gen<void> {
  const loopEnv = env.child();
  let perIterationNames: string[] = [];

  if (node.init) {
    if (node.init.type === 'VariableDeclaration') {
      yield* evalStatement(node.init, loopEnv, machine);
      // `let`/`const` get a fresh binding per iteration so closures capture
      // distinct values (the classic setTimeout-in-a-loop behaviour).
      if (node.init.kind !== 'var') {
        perIterationNames = node.init.declarations
          .filter((d: Node) => d.id.type === 'Identifier')
          .map((d: Node) => d.id.name);
      }
    } else {
      yield* evalExpr(node.init, loopEnv, machine);
    }
  }

  const copyEnv = (source: Environment): Environment => {
    if (perIterationNames.length === 0) return source;
    const next = loopEnv.child();
    for (const name of perIterationNames) next.declare(name, source.get(name));
    return next;
  };

  let current = copyEnv(loopEnv);
  let guard = 0;
  while (true) {
    if (guard++ > 100000) throw new InterpreterThrow('Loop step limit exceeded');
    yield* pause(machine, node);
    if (node.test && !toBoolean(yield* evalExpr(node.test, current, machine))) break;
    try {
      yield* evalStatement(node.body, current.child(), machine);
    } catch (err) {
      if (err instanceof BreakSignal) break;
      if (!(err instanceof ContinueSignal)) throw err;
    }
    current = copyEnv(current);
    if (node.update) yield* evalExpr(node.update, current, machine);
  }
}

function* evalWhileStatement(node: Node, env: Environment, machine: Machine): Gen<void> {
  let guard = 0;
  while (true) {
    if (guard++ > 100000) throw new InterpreterThrow('Loop step limit exceeded');
    yield* pause(machine, node);
    if (!toBoolean(yield* evalExpr(node.test, env, machine))) break;
    try {
      yield* evalStatement(node.body, env.child(), machine);
    } catch (err) {
      if (err instanceof BreakSignal) break;
      if (!(err instanceof ContinueSignal)) throw err;
    }
  }
}

function* evalDoWhileStatement(node: Node, env: Environment, machine: Machine): Gen<void> {
  let guard = 0;
  do {
    if (guard++ > 100000) throw new InterpreterThrow('Loop step limit exceeded');
    yield* pause(machine, node);
    try {
      yield* evalStatement(node.body, env.child(), machine);
    } catch (err) {
      if (err instanceof BreakSignal) break;
      if (!(err instanceof ContinueSignal)) throw err;
    }
  } while (toBoolean(yield* evalExpr(node.test, env, machine)));
}

function* evalTryStatement(node: Node, env: Environment, machine: Machine): Gen<void> {
  try {
    yield* evalStatement(node.block, env, machine);
  } catch (err) {
    if (err instanceof ReturnSignal || err instanceof BreakSignal || err instanceof ContinueSignal) {
      throw err;
    }
    if (node.handler) {
      const catchEnv = env.child();
      if (node.handler.param) {
        bindPattern(node.handler.param, unwrapThrow(err), catchEnv, machine);
      }
      yield* evalStatement(node.handler.body, catchEnv, machine);
    } else if (!node.finalizer) {
      throw err;
    }
  } finally {
    if (node.finalizer) {
      yield* evalStatement(node.finalizer, env, machine);
    }
  }
}

// ---- Expressions ----------------------------------------------------------
function* evalExpr(node: Node, env: Environment, machine: Machine): Gen {
  switch (node.type) {
    case 'Literal':
      return node.value as RuntimeValue;
    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      return env.get(node.name);
    case 'TemplateLiteral':
      return yield* evalTemplateLiteral(node, env, machine);
    case 'ArrayExpression': {
      const elements: RuntimeValue[] = [];
      for (const el of node.elements) {
        elements.push(el ? yield* evalExpr(el, env, machine) : undefined);
      }
      return { type: 'array', elements } as RuntimeArray;
    }
    case 'ObjectExpression': {
      const obj: RuntimeObject = { type: 'object', properties: new Map() };
      for (const prop of node.properties) {
        const key = prop.computed
          ? String(yield* evalExpr(prop.key, env, machine))
          : prop.key.type === 'Identifier'
            ? prop.key.name
            : String(prop.key.value);
        obj.properties.set(key, yield* evalExpr(prop.value, env, machine));
      }
      return obj;
    }
    case 'FunctionExpression':
      return makeFunction(node, env, node.id ? node.id.name : '');
    case 'ArrowFunctionExpression':
      return makeFunction(node, env, '');
    case 'CallExpression':
      return yield* evalCallExpression(node, env, machine);
    case 'NewExpression':
      return yield* evalNewExpression(node, env, machine);
    case 'MemberExpression': {
      const { value } = yield* evalMember(node, env, machine);
      return value;
    }
    case 'BinaryExpression':
      return yield* evalBinary(node, env, machine);
    case 'LogicalExpression':
      return yield* evalLogical(node, env, machine);
    case 'UnaryExpression':
      return yield* evalUnary(node, env, machine);
    case 'UpdateExpression':
      return yield* evalUpdate(node, env, machine);
    case 'AssignmentExpression':
      return yield* evalAssignment(node, env, machine);
    case 'ConditionalExpression': {
      const test = toBoolean(yield* evalExpr(node.test, env, machine));
      return yield* evalExpr(test ? node.consequent : node.alternate, env, machine);
    }
    case 'SequenceExpression': {
      let result: RuntimeValue = undefined;
      for (const ex of node.expressions) result = yield* evalExpr(ex, env, machine);
      return result;
    }
    case 'AwaitExpression': {
      const awaited = yield* evalExpr(node.argument, env, machine);
      const p = isPromise(awaited) ? awaited : resolvedPromise(machine, awaited);
      // Suspend: the async driver intercepts this signal.
      const resumed = yield { await: p };
      return resumed;
    }
    case 'ThisExpression':
      return undefined;
    default:
      throw new InterpreterThrow(`Unsupported expression: ${node.type}`);
  }
}

function* evalTemplateLiteral(node: Node, env: Environment, machine: Machine): Gen {
  let result = '';
  for (let i = 0; i < node.quasis.length; i += 1) {
    result += node.quasis[i].value.cooked;
    if (i < node.expressions.length) {
      const v = yield* evalExpr(node.expressions[i], env, machine);
      result += stringify(v);
    }
  }
  return result;
}

function* evalBinary(node: Node, env: Environment, machine: Machine): Gen {
  const left = yield* evalExpr(node.left, env, machine);
  const right = yield* evalExpr(node.right, env, machine);
  switch (node.operator) {
    case '+':
      if (typeof left === 'string' || typeof right === 'string') {
        return stringify(left) + stringify(right);
      }
      return toNumber(left) + toNumber(right);
    case '-':
      return toNumber(left) - toNumber(right);
    case '*':
      return toNumber(left) * toNumber(right);
    case '/':
      return toNumber(left) / toNumber(right);
    case '%':
      return toNumber(left) % toNumber(right);
    case '**':
      return toNumber(left) ** toNumber(right);
    case '==':
      // eslint-disable-next-line eqeqeq
      return (left as any) == (right as any);
    case '!=':
      // eslint-disable-next-line eqeqeq
      return (left as any) != (right as any);
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '<':
      return (left as any) < (right as any);
    case '<=':
      return (left as any) <= (right as any);
    case '>':
      return (left as any) > (right as any);
    case '>=':
      return (left as any) >= (right as any);
    default:
      throw new InterpreterThrow(`Unsupported operator: ${node.operator}`);
  }
}

function* evalLogical(node: Node, env: Environment, machine: Machine): Gen {
  const left = yield* evalExpr(node.left, env, machine);
  if (node.operator === '&&') return toBoolean(left) ? yield* evalExpr(node.right, env, machine) : left;
  if (node.operator === '||') return toBoolean(left) ? left : yield* evalExpr(node.right, env, machine);
  // ?? nullish coalescing
  return left === null || left === undefined ? yield* evalExpr(node.right, env, machine) : left;
}

function* evalUnary(node: Node, env: Environment, machine: Machine): Gen {
  if (node.operator === 'typeof' && node.argument.type === 'Identifier' && !env.has(node.argument.name)) {
    return 'undefined';
  }
  const arg = yield* evalExpr(node.argument, env, machine);
  switch (node.operator) {
    case '-':
      return -toNumber(arg);
    case '+':
      return +toNumber(arg);
    case '!':
      return !toBoolean(arg);
    case 'typeof':
      return typeofValue(arg);
    case 'void':
      return undefined;
    default:
      throw new InterpreterThrow(`Unsupported unary: ${node.operator}`);
  }
}

function* evalUpdate(node: Node, env: Environment, machine: Machine): Gen {
  if (node.argument.type !== 'Identifier') {
    throw new InterpreterThrow('Only simple ++/-- on variables is supported');
  }
  const name = node.argument.name;
  const old = toNumber(env.get(name));
  const next = node.operator === '++' ? old + 1 : old - 1;
  env.assign(name, next);
  // pause to keep loop animation legible
  yield* pause(machine, node);
  return node.prefix ? next : old;
}

function* evalAssignment(node: Node, env: Environment, machine: Machine): Gen {
  const value = yield* evalExpr(node.right, env, machine);
  if (node.left.type === 'Identifier') {
    if (node.operator === '=') {
      env.assign(node.left.name, value);
      return value;
    }
    const current = env.get(node.left.name);
    const next = applyCompound(node.operator, current, value);
    env.assign(node.left.name, next);
    return next;
  }
  if (node.left.type === 'MemberExpression') {
    const { object, key } = yield* evalMemberTarget(node.left, env, machine);
    setMember(object, key, value, machine);
    return value;
  }
  throw new InterpreterThrow('Unsupported assignment target');
}

function applyCompound(op: string, current: RuntimeValue, value: RuntimeValue): RuntimeValue {
  switch (op) {
    case '+=':
      if (typeof current === 'string' || typeof value === 'string') {
        return stringify(current) + stringify(value);
      }
      return toNumber(current) + toNumber(value);
    case '-=':
      return toNumber(current) - toNumber(value);
    case '*=':
      return toNumber(current) * toNumber(value);
    case '/=':
      return toNumber(current) / toNumber(value);
    case '%=':
      return toNumber(current) % toNumber(value);
    default:
      throw new InterpreterThrow(`Unsupported assignment operator: ${op}`);
  }
}

// ---- Member access --------------------------------------------------------
interface MemberResult {
  object: RuntimeValue;
  key: string;
  value: RuntimeValue;
}

function* evalMember(node: Node, env: Environment, machine: Machine): Gen<MemberResult> {
  const object = yield* evalExpr(node.object, env, machine);
  const key = node.computed
    ? String(yield* evalExpr(node.property, env, machine))
    : node.property.name;
  return { object, key, value: getMember(object, key, machine) };
}

function* evalMemberTarget(
  node: Node,
  env: Environment,
  machine: Machine,
): Gen<{ object: RuntimeValue; key: string }> {
  const object = yield* evalExpr(node.object, env, machine);
  const key = node.computed
    ? String(yield* evalExpr(node.property, env, machine))
    : node.property.name;
  return { object, key };
}

function getMember(object: RuntimeValue, key: string, machine: Machine): RuntimeValue {
  if (object === null || object === undefined) {
    throw new InterpreterThrow(`Cannot read properties of ${stringify(object)} (reading '${key}')`);
  }
  if (isArray(object)) {
    if (key === 'length') return object.elements.length;
    const idx = Number(key);
    if (Number.isInteger(idx)) return object.elements[idx];
    return arrayMethod(object, key, machine);
  }
  if (typeof object === 'string') {
    if (key === 'length') return object.length;
    const idx = Number(key);
    if (Number.isInteger(idx)) return object[idx];
    return stringMethod(object, key, machine);
  }
  if (isPromise(object)) {
    return promiseMethod(object, key, machine);
  }
  if (isObject(object)) {
    return object.properties.has(key) ? object.properties.get(key) : undefined;
  }
  if (isCallable(object) && object.type === 'native' && object.statics) {
    return object.statics.get(key);
  }
  return undefined;
}

function setMember(object: RuntimeValue, key: string, value: RuntimeValue, _machine: Machine): void {
  if (isArray(object)) {
    const idx = Number(key);
    if (Number.isInteger(idx)) {
      object.elements[idx] = value;
      return;
    }
  }
  if (isObject(object)) {
    object.properties.set(key, value);
    return;
  }
  throw new InterpreterThrow('Cannot set property on this value');
}

// ---- Calls ----------------------------------------------------------------
function* evalCallExpression(node: Node, env: Environment, machine: Machine): Gen {
  let fn: RuntimeValue;
  let args: RuntimeValue[] = [];

  if (node.callee.type === 'MemberExpression') {
    const { object, key } = yield* evalMemberTarget(node.callee, env, machine);
    fn = getMember(object, key, machine);
    args = yield* evalArguments(node.arguments, env, machine);
    yield* pause(machine, node);
    return yield* callFunction(machine, fn, args);
  }

  fn = yield* evalExpr(node.callee, env, machine);
  args = yield* evalArguments(node.arguments, env, machine);
  yield* pause(machine, node);
  return yield* callFunction(machine, fn, args);
}

function* evalArguments(nodes: Node[], env: Environment, machine: Machine): Gen<RuntimeValue[]> {
  const args: RuntimeValue[] = [];
  for (const a of nodes) args.push(yield* evalExpr(a, env, machine));
  return args;
}

function* evalNewExpression(node: Node, env: Environment, machine: Machine): Gen {
  const callee = yield* evalExpr(node.callee, env, machine);
  const args = yield* evalArguments(node.arguments, env, machine);
  yield* pause(machine, node);
  // Native constructors (Promise) are modeled as native functions.
  if (isCallable(callee)) {
    return yield* callFunction(machine, callee, args);
  }
  throw new InterpreterThrow('Value is not a constructor');
}

export function* callFunction(machine: Machine, fn: RuntimeValue, args: RuntimeValue[]): Gen {
  if (!isCallable(fn)) {
    throw new InterpreterThrow(`${stringify(fn)} is not a function`);
  }
  if (fn.type === 'native') {
    return yield* fn.call(args, machine);
  }
  if (fn.isAsync) {
    return yield* callAsyncFunction(machine, fn, args);
  }
  const callEnv = fn.closure.child();
  bindParams(fn, args, callEnv, machine);
  machine.pushFrame(fn.name || '(anonymous)');
  try {
    if (fn.expressionBody) {
      return yield* evalExpr(fn.body, callEnv, machine);
    }
    hoist(fn.body.body, callEnv);
    yield* evalStatements(fn.body.body, callEnv, machine);
    return undefined;
  } catch (err) {
    if (err instanceof ReturnSignal) return err.value;
    throw err;
  } finally {
    machine.popFrame();
  }
}

// ---- async/await ----------------------------------------------------------
/**
 * Invoke an async function. Its body runs synchronously (yielding steps) until
 * the first `await` or completion; the returned promise is produced
 * immediately. On `await`, the body suspends and is resumed via a microtask
 * when the awaited promise settles.
 */
function* callAsyncFunction(machine: Machine, fn: UserFunction, args: RuntimeValue[]): Gen {
  const promise = machine.createPromise();
  const callEnv = fn.closure.child();
  bindParams(fn, args, callEnv, machine);

  const body: Gen = (function* () {
    if (fn.expressionBody) return yield* evalExpr(fn.body, callEnv, machine);
    hoist(fn.body.body, callEnv);
    yield* evalStatements(fn.body.body, callEnv, machine);
    return undefined;
  })();

  yield* driveAsync(machine, fn, body, promise, { kind: 'next', value: undefined });
  return promise;
}

type Resume = { kind: 'next'; value: RuntimeValue } | { kind: 'throw'; value: RuntimeValue };

/** Pump an async function body until it awaits or completes. */
function* driveAsync(
  machine: Machine,
  fn: UserFunction,
  body: Gen,
  promise: PromiseValue,
  resume: Resume,
): Gen<void> {
  machine.pushFrame(`${fn.name || 'async'} (async)`);
  try {
    let send = resume;
    while (true) {
      let res: IteratorResult<StepSignal, RuntimeValue>;
      try {
        res =
          send.kind === 'throw'
            ? body.throw(new InterpreterThrow(send.value))
            : body.next(send.value);
      } catch (err) {
        if (err instanceof ReturnSignal) {
          machine.resolvePromise(promise, err.value);
        } else {
          machine.rejectPromise(promise, unwrapThrow(err));
        }
        return;
      }

      if (res.done) {
        machine.resolvePromise(promise, res.value);
        return;
      }

      const signal = res.value;
      if (signal && typeof signal === 'object' && 'await' in signal) {
        const awaited = (signal as { await: PromiseValue }).await;
        // Suspend; resume as a single microtask when `awaited` settles.
        machine.onSettleResume(awaited, 'await resume', (value, rejected) => {
          return function* () {
            yield* driveAsync(
              machine,
              fn,
              body,
              promise,
              rejected ? { kind: 'throw', value } : { kind: 'next', value },
            );
          };
        });
        return; // pop frame via finally — function leaves the stack while waiting
      }

      // Normal step boundary.
      yield;
      send = { kind: 'next', value: undefined };
    }
  } finally {
    machine.popFrame();
  }
}

// ---- Helpers --------------------------------------------------------------
function makeFunction(node: Node, env: Environment, name: string): UserFunction {
  return {
    type: 'function',
    name,
    params: node.params,
    body: node.body,
    expressionBody: node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement',
    isAsync: !!node.async,
    closure: env,
  };
}

function bindParams(fn: UserFunction, args: RuntimeValue[], env: Environment, machine: Machine): void {
  fn.params.forEach((param: Node, i: number) => {
    if (param.type === 'RestElement') {
      const rest: RuntimeArray = { type: 'array', elements: args.slice(i) };
      env.declare(param.argument.name, rest);
    } else if (param.type === 'AssignmentPattern') {
      const provided = args[i];
      env.declare(
        param.left.name,
        provided === undefined ? evalDefaultSync(param.right, env, machine) : provided,
      );
    } else if (param.type === 'Identifier') {
      env.declare(param.name, args[i]);
    } else {
      bindPattern(param, args[i], env, machine);
    }
  });
}

/** Evaluate a simple default-parameter expression synchronously (literals/ids). */
function evalDefaultSync(node: Node, env: Environment, _machine: Machine): RuntimeValue {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'Identifier') return env.has(node.name) ? env.get(node.name) : undefined;
  return undefined;
}

function bindPattern(pattern: Node, value: RuntimeValue, env: Environment, machine: Machine): void {
  if (pattern.type === 'Identifier') {
    env.declare(pattern.name, value);
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    const elements = isArray(value) ? value.elements : [];
    pattern.elements.forEach((el: Node, i: number) => {
      if (!el) return;
      if (el.type === 'RestElement') {
        bindPattern(el.argument, { type: 'array', elements: elements.slice(i) }, env, machine);
      } else {
        bindPattern(el, elements[i], env, machine);
      }
    });
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    pattern.properties.forEach((prop: Node) => {
      const key = prop.key.type === 'Identifier' ? prop.key.name : String(prop.key.value);
      const v = isObject(value) ? value.properties.get(key) : undefined;
      bindPattern(prop.value, v, env, machine);
    });
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    bindPattern(pattern.left, value === undefined ? evalDefaultSync(pattern.right, env, machine) : value, env, machine);
    return;
  }
  env.declare(String(pattern.name ?? 'unknown'), value);
}

function typeofValue(v: RuntimeValue): string {
  if (v === null) return 'object';
  if (isCallable(v)) return 'function';
  if (isPromise(v) || isObject(v) || isArray(v)) return 'object';
  return typeof v;
}

function resolvedPromise(machine: Machine, value: RuntimeValue): PromiseValue {
  const p = machine.createPromise();
  machine.resolvePromise(p, value);
  return p;
}

// ---- Built-in methods on runtime values -----------------------------------
function promiseMethod(p: PromiseValue, key: string, machine: Machine) {
  if (key === 'then' || key === 'catch' || key === 'finally') {
    return {
      type: 'native',
      name: key,
      *call(args: RuntimeValue[]): Gen {
        const resultPromise = machine.createPromise();
        if (key === 'finally') {
          machine.addUserReaction(p, {
            kind: 'user',
            isFinally: true,
            onFulfilled: args[0],
            resultPromise,
          });
        } else if (key === 'catch') {
          machine.addUserReaction(p, { kind: 'user', onRejected: args[0], resultPromise });
        } else {
          machine.addUserReaction(p, {
            kind: 'user',
            onFulfilled: args[0],
            onRejected: args[1],
            resultPromise,
          });
        }
        return resultPromise;
      },
    } as RuntimeValue;
  }
  return undefined;
}

function arrayMethod(arr: RuntimeArray, key: string, machine: Machine): RuntimeValue {
  const make = (name: string, fn: (args: RuntimeValue[]) => Gen): RuntimeValue =>
    ({ type: 'native', name, call: fn } as RuntimeValue);
  switch (key) {
    case 'push':
      return make('push', function* (args) {
        arr.elements.push(...args);
        return arr.elements.length;
      });
    case 'pop':
      return make('pop', function* () {
        return arr.elements.pop();
      });
    case 'map':
      return make('map', function* (args) {
        const out: RuntimeValue[] = [];
        for (let i = 0; i < arr.elements.length; i += 1) {
          out.push(yield* callFunction(machine, args[0], [arr.elements[i], i]));
        }
        return { type: 'array', elements: out } as RuntimeArray;
      });
    case 'forEach':
      return make('forEach', function* (args) {
        for (let i = 0; i < arr.elements.length; i += 1) {
          yield* callFunction(machine, args[0], [arr.elements[i], i]);
        }
        return undefined;
      });
    case 'filter':
      return make('filter', function* (args) {
        const out: RuntimeValue[] = [];
        for (let i = 0; i < arr.elements.length; i += 1) {
          if (toBoolean(yield* callFunction(machine, args[0], [arr.elements[i], i]))) {
            out.push(arr.elements[i]);
          }
        }
        return { type: 'array', elements: out } as RuntimeArray;
      });
    case 'join':
      return make('join', function* (args) {
        const sep = args[0] === undefined ? ',' : stringify(args[0]);
        return arr.elements.map((e) => stringify(e)).join(sep);
      });
    case 'includes':
      return make('includes', function* (args) {
        return arr.elements.includes(args[0]);
      });
    default:
      return undefined;
  }
}

function stringMethod(str: string, key: string, _machine: Machine): RuntimeValue {
  const make = (name: string, fn: (args: RuntimeValue[]) => Gen): RuntimeValue =>
    ({ type: 'native', name, call: fn } as RuntimeValue);
  switch (key) {
    case 'toUpperCase':
      return make('toUpperCase', function* () {
        return str.toUpperCase();
      });
    case 'toLowerCase':
      return make('toLowerCase', function* () {
        return str.toLowerCase();
      });
    case 'slice':
      return make('slice', function* (args) {
        return str.slice(toNumber(args[0]), args[1] === undefined ? undefined : toNumber(args[1]));
      });
    case 'split':
      return make('split', function* (args) {
        return {
          type: 'array',
          elements: str.split(args[0] === undefined ? '' : stringify(args[0])),
        } as RuntimeArray;
      });
    case 'repeat':
      return make('repeat', function* (args) {
        return str.repeat(toNumber(args[0]));
      });
    default:
      return undefined;
  }
}

export { ReturnSignal };
