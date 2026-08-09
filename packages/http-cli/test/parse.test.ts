import { describe, it, expect } from 'vitest';
import { parseArgv, resolveArgs, CLIArgError, suggestCommand } from '../src/parse';
import { arg } from '../src/arg';
import { defineCLICommand } from '../src/command';

describe('parseArgv', () => {
  it('parses subcommand name', () => {
    const result = parseArgv(['node', 'cli', 'list-foo']);
    expect(result.commandName).toBe('list-foo');
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it('parses --key value flags', () => {
    const result = parseArgv(['node', 'cli', 'get', '--id', '42', '--name', 'test']);
    expect(result.commandName).toBe('get');
    expect(result.flags).toEqual({ id: '42', name: 'test' });
  });

  it('parses --key=value flags', () => {
    const result = parseArgv(['node', 'cli', 'get', '--id=42']);
    expect(result.flags).toEqual({ id: '42' });
  });

  it('parses --key=value with = in value', () => {
    const result = parseArgv(['node', 'cli', 'query', '--filter=key=value']);
    expect(result.flags).toEqual({ filter: 'key=value' });
  });

  it('parses boolean flags (no value)', () => {
    const result = parseArgv(['node', 'cli', 'list', '--verbose']);
    expect(result.flags).toEqual({ verbose: true });
  });

  it('parses short alias -k value', () => {
    const result = parseArgv(['node', 'cli', 'get', '-i', '42']);
    expect(result.flags).toEqual({ i: '42' });
  });

  it('parses short alias as boolean', () => {
    const result = parseArgv(['node', 'cli', 'list', '-v']);
    expect(result.flags).toEqual({ v: true });
  });

  it('detects --help', () => {
    const result = parseArgv(['node', 'cli', '--help']);
    expect(result.help).toBe(true);
  });

  it('detects -h', () => {
    const result = parseArgv(['node', 'cli', '-h']);
    expect(result.help).toBe(true);
  });

  it('detects --version', () => {
    const result = parseArgv(['node', 'cli', '--version']);
    expect(result.version).toBe(true);
  });

  it('detects -V', () => {
    const result = parseArgv(['node', 'cli', '-V']);
    expect(result.version).toBe(true);
  });

  it('help with subcommand', () => {
    const result = parseArgv(['node', 'cli', 'get', '--help']);
    expect(result.commandName).toBe('get');
    expect(result.help).toBe(true);
  });

  it('returns undefined commandName when none provided', () => {
    const result = parseArgv(['node', 'cli', '--help']);
    expect(result.commandName).toBeUndefined();
  });

  it('handles negative numbers as values', () => {
    const result = parseArgv(['node', 'cli', 'query', '--offset', '-5']);
    expect(result.flags).toEqual({ offset: '-5' });
  });

  it('handles negative numbers with short alias', () => {
    const result = parseArgv(['node', 'cli', 'query', '-o', '-10']);
    expect(result.flags).toEqual({ o: '-10' });
  });

  it('stops parsing flags after --', () => {
    const result = parseArgv(['node', 'cli', 'run', '--verbose', '--', '--not-a-flag', 'arg1']);
    expect(result.flags).toEqual({ verbose: true });
    expect(result.rest).toEqual(['--not-a-flag', 'arg1']);
  });

  it('supports --no-* boolean negation', () => {
    const result = parseArgv(['node', 'cli', 'build', '--no-cache']);
    expect(result.flags).toEqual({ cache: false });
  });

  it('collects extra positional args into rest', () => {
    const result = parseArgv(['node', 'cli', 'run', 'extra1', 'extra2']);
    expect(result.commandName).toBe('run');
    expect(result.rest).toEqual(['extra1', 'extra2']);
  });
});

describe('resolveArgs', () => {
  it('resolves string arg', () => {
    const defs = { name: arg.string({ required: true }) };
    const result = resolveArgs(defs, { name: 'hello' });
    expect(result).toEqual({ name: 'hello' });
  });

  it('resolves number arg', () => {
    const defs = { limit: arg.number({ default: 10 }) };
    const result = resolveArgs(defs, { limit: '5' });
    expect(result).toEqual({ limit: 5 });
  });

  it('uses default for missing arg', () => {
    const defs = { limit: arg.number({ default: 10 }) };
    const result = resolveArgs(defs, {});
    expect(result).toEqual({ limit: 10 });
  });

  it('resolves boolean arg from flag', () => {
    const defs = { verbose: arg.boolean({ default: false }) };
    const result = resolveArgs(defs, { verbose: true });
    expect(result).toEqual({ verbose: true });
  });

  it('resolves boolean arg from string "true"', () => {
    const defs = { verbose: arg.boolean() };
    const result = resolveArgs(defs, { verbose: 'true' });
    expect(result).toEqual({ verbose: true });
  });

  it('resolves boolean arg from string "false"', () => {
    const defs = { verbose: arg.boolean() };
    const result = resolveArgs(defs, { verbose: 'false' });
    expect(result).toEqual({ verbose: false });
  });

  it('resolves --no-* negation as false', () => {
    const defs = { cache: arg.boolean({ default: true }) };
    const result = resolveArgs(defs, { cache: false });
    expect(result).toEqual({ cache: false });
  });

  it('resolves alias', () => {
    const defs = { limit: arg.number({ alias: 'l', default: 10 }) };
    const result = resolveArgs(defs, { l: '20' });
    expect(result).toEqual({ limit: 20 });
  });

  it('resolves negative number', () => {
    const defs = { offset: arg.number({ default: 0 }) };
    const result = resolveArgs(defs, { offset: '-5' });
    expect(result).toEqual({ offset: -5 });
  });

  it('throws on missing required arg', () => {
    const defs = { id: arg.string({ required: true }) };
    expect(() => resolveArgs(defs, {})).toThrow(CLIArgError);
    expect(() => resolveArgs(defs, {})).toThrow('Missing required argument: --id');
  });

  it('throws on invalid number', () => {
    const defs = { limit: arg.number() };
    expect(() => resolveArgs(defs, { limit: 'abc' })).toThrow(CLIArgError);
    expect(() => resolveArgs(defs, { limit: 'abc' })).toThrow('must be a number');
  });

  it('throws on Infinity', () => {
    const defs = { limit: arg.number() };
    expect(() => resolveArgs(defs, { limit: 'Infinity' })).toThrow('must be a number');
    expect(() => resolveArgs(defs, { limit: '-Infinity' })).toThrow('must be a number');
  });

  it('throws on string arg with boolean flag', () => {
    const defs = { name: arg.string() };
    expect(() => resolveArgs(defs, { name: true })).toThrow('requires a string value');
  });

  it('returns undefined for optional arg without default', () => {
    const defs = { name: arg.string() };
    const result = resolveArgs(defs, {});
    expect(result).toEqual({ name: undefined });
  });

  it('throws on unknown flags', () => {
    const defs = { limit: arg.number({ default: 10 }) };
    expect(() => resolveArgs(defs, { limti: '5' })).toThrow(CLIArgError);
    expect(() => resolveArgs(defs, { limti: '5' })).toThrow('Unknown flag: --limti');
  });

  it('throws on multiple unknown flags', () => {
    const defs = { limit: arg.number({ default: 10 }) };
    expect(() => resolveArgs(defs, { x: '1', y: '2' })).toThrow('Unknown flags: -x, -y');
  });

  it('short unknown flag is formatted with single dash', () => {
    const defs = { limit: arg.number({ default: 10 }) };
    expect(() => resolveArgs(defs, { z: 'val' })).toThrow('Unknown flag: -z');
  });

  it('alias is treated as known', () => {
    const defs = { limit: arg.number({ alias: 'l', default: 10 }) };
    expect(resolveArgs(defs, { l: '5' })).toEqual({ limit: 5 });
  });
});

describe('suggestCommand', () => {
  const commands = ['list', 'get', 'create', 'delete', 'update'];

  it('suggests close match for typo', () => {
    expect(suggestCommand('lits', commands)).toBe('list');
  });

  it('suggests close match for missing char', () => {
    expect(suggestCommand('lst', commands)).toBe('list');
  });

  it('suggests close match for extra char', () => {
    expect(suggestCommand('listt', commands)).toBe('list');
  });

  it('suggests close match for swapped chars', () => {
    expect(suggestCommand('gte', commands)).toBe('get');
  });

  it('returns undefined for no close match', () => {
    expect(suggestCommand('xyz', commands)).toBeUndefined();
  });

  it('returns undefined for completely different input', () => {
    expect(suggestCommand('foobar', commands)).toBeUndefined();
  });
});

describe('InferArgs type inference', () => {
  it('correctly infers types for required, defaulted, and optional args', () => {
    // This test validates type-level correctness at compile time.
    // If InferArgs is broken, typecheck will fail on these assignments.
    const _cmd = defineCLICommand({
      name: 'type-test',
      args: {
        name: arg.string({ required: true }),
        limit: arg.number({ default: 10 }),
        verbose: arg.boolean({ default: false }),
        optional: arg.string(),
      },
      run: (args) => {
        // required → non-undefined
        const _name: string = args.name;
        // defaulted → non-undefined
        const _limit: number = args.limit;
        const _verbose: boolean = args.verbose;
        // optional without default → may be undefined
        const _optional: string | undefined = args.optional;
        void [_name, _limit, _verbose, _optional];
        return { request: { method: 'GET' as const, url: '/' }, parseData: async () => ({}) };
      },
    });
    expect(_cmd.name).toBe('type-test');
  });
});

describe('arg shorthand', () => {
  it('arg.string(description) sets description', () => {
    const def = arg.string('Item ID');
    expect(def.type).toBe('string');
    expect(def.description).toBe('Item ID');
  });

  it('arg.number(description) sets description', () => {
    const def = arg.number('Max items');
    expect(def.type).toBe('number');
    expect(def.description).toBe('Max items');
  });

  it('arg.boolean(description) sets description', () => {
    const def = arg.boolean('Enable verbose');
    expect(def.type).toBe('boolean');
    expect(def.description).toBe('Enable verbose');
  });

  it('arg.string() with no args works', () => {
    const def = arg.string();
    expect(def.type).toBe('string');
    expect(def.description).toBeUndefined();
  });

  it('arg.string(opts) still works', () => {
    const def = arg.string({ description: 'Name', required: true, alias: 'n' });
    expect(def.type).toBe('string');
    expect(def.description).toBe('Name');
    expect(def.required).toBe(true);
    expect(def.alias).toBe('n');
  });
});
