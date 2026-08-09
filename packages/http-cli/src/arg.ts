import type { ArgDef } from './types';

type StringArgOpts = Omit<ArgDef<string>, 'type'>;
type NumberArgOpts = Omit<ArgDef<number>, 'type'>;
type BooleanArgOpts = Omit<ArgDef<boolean>, 'type'>;

function normalizeOpts<T>(descriptionOrOpts: string | T | undefined): T {
  if (typeof descriptionOrOpts === 'string') {
    return { description: descriptionOrOpts } as T;
  }
  return (descriptionOrOpts ?? {}) as T;
}

export const arg = {
  string(descriptionOrOpts?: string | StringArgOpts): ArgDef<string> {
    return { type: 'string', ...normalizeOpts(descriptionOrOpts) };
  },
  number(descriptionOrOpts?: string | NumberArgOpts): ArgDef<number> {
    return { type: 'number', ...normalizeOpts(descriptionOrOpts) };
  },
  boolean(descriptionOrOpts?: string | BooleanArgOpts): ArgDef<boolean> {
    return { type: 'boolean', ...normalizeOpts(descriptionOrOpts) };
  },
} as {
  string: {
    <O extends StringArgOpts>(opts: O): ArgDef<string> & O;
    (description?: string): ArgDef<string>;
  };
  number: {
    <O extends NumberArgOpts>(opts: O): ArgDef<number> & O;
    (description?: string): ArgDef<number>;
  };
  boolean: {
    <O extends BooleanArgOpts>(opts: O): ArgDef<boolean> & O;
    (description?: string): ArgDef<boolean>;
  };
};
