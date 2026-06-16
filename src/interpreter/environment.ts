// Lexical environment (scope chain) for the interpreter.

import type { RuntimeValue } from './values';

export class Environment {
  private vars = new Map<string, RuntimeValue>();
  constructor(public parent: Environment | null = null) {}

  /** Declare a new binding in this scope. */
  declare(name: string, value: RuntimeValue): void {
    this.vars.set(name, value);
  }

  has(name: string): boolean {
    if (this.vars.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }

  get(name: string): RuntimeValue {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new ReferenceError(`${name} is not defined`);
  }

  /** Assign to an existing binding, walking up the chain. */
  assign(name: string, value: RuntimeValue): RuntimeValue {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return value;
    }
    if (this.parent) return this.parent.assign(name, value);
    // Implicit global (sloppy-mode style) — declare at the root.
    let root: Environment = this;
    while (root.parent) root = root.parent;
    root.vars.set(name, value);
    return value;
  }

  child(): Environment {
    return new Environment(this);
  }
}
