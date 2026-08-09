import { describe, it, expect, vi } from 'vitest';
import { httpCLI, runCLI } from '../src/cli';
import { defineCLICommand } from '../src/command';
import { arg } from '../src/arg';
import type { Client, Command, DefaultScope, Handler, Middleware } from '@hsblabs/http-command';
import { HttpCommandError } from '@hsblabs/http-command';

function mockClient(result: unknown): Client<DefaultScope> {
  return {
    send: vi.fn().mockResolvedValue(result),
    with: vi.fn().mockReturnThis(),
    withDefaults: vi.fn().mockReturnThis(),
  };
}

function failClient(error: Error): Client<DefaultScope> {
  return {
    send: vi.fn().mockRejectedValue(error),
    with: vi.fn().mockReturnThis(),
    withDefaults: vi.fn().mockReturnThis(),
  };
}

function capture() {
  const lines: string[] = [];
  const errLines: string[] = [];
  let exitCode: number | undefined;
  return {
    stdout: (t: string) => lines.push(t),
    stderr: (t: string) => errLines.push(t),
    exit: (code: number) => { exitCode = code; },
    get lines() { return lines; },
    get errLines() { return errLines; },
    get exitCode() { return exitCode; },
  };
}

const ListItems = defineCLICommand({
  name: 'list',
  description: 'List items',
  args: {
    limit: arg.number({ description: 'Max items', default: 10, alias: 'l' }),
  },
  run: (args): Command<DefaultScope, unknown[]> => ({
    request: { method: 'GET', url: '/items', query: { limit: args.limit } },
    parseData: async (res: Response) => res.json() as Promise<unknown[]>,
  }),
});

const GetItem = defineCLICommand({
  name: 'get',
  description: 'Get an item by ID',
  args: {
    id: arg.string({ description: 'Item ID', required: true }),
  },
  run: (args): Command<DefaultScope, unknown> => ({
    request: { method: 'GET', url: `/items/${args.id}` },
    parseData: async (res: Response) => res.json(),
  }),
});

const HealthCheck = defineCLICommand({
  name: 'health',
  description: 'Check API health',
  run: (): Command<DefaultScope, unknown> => ({
    request: { method: 'GET', url: '/health' },
    parseData: async (res: Response) => res.json(),
  }),
});

describe('httpCLI', () => {
  it('creates a CLI instance', () => {
    const cli = httpCLI({ name: 'test-cli', version: '1.0.0' });
    expect(cli.config.name).toBe('test-cli');
    expect(cli.config.version).toBe('1.0.0');
    expect(cli.commands.size).toBe(0);
  });

  it('registers commands immutably', () => {
    const cli1 = httpCLI();
    const cli2 = cli1.command(ListItems);
    expect(cli1.commands.size).toBe(0);
    expect(cli2.commands.size).toBe(1);
  });

  it('binds client factory', () => {
    const client = mockClient([]);
    const cli = httpCLI().bindClient(() => client);
    expect(cli.clientFactory).toBeDefined();
  });

  it('chains multiple commands', () => {
    const cli = httpCLI().command(ListItems).command(GetItem);
    expect(cli.commands.size).toBe(2);
    expect(cli.commands.has('list')).toBe(true);
    expect(cli.commands.has('get')).toBe(true);
  });

  it('chains multiple middleware with use()', () => {
    const mw1 = vi.fn<Middleware>((next: Handler) => next);
    const mw2 = vi.fn<Middleware>((next: Handler) => next);
    const cli = httpCLI().use(mw1).use(mw2);
    expect(cli.middleware).toHaveLength(2);
  });

  it('registers command without args', () => {
    const cli = httpCLI().command(HealthCheck);
    expect(cli.commands.size).toBe(1);
    expect(cli.commands.get('health')).toBeDefined();
  });

  it('throws when registering reserved command name "help"', () => {
    const HelpCmd = defineCLICommand({
      name: 'help',
      run: (): Command<DefaultScope, void> => ({
        request: { method: 'GET', url: '/' },
        parseData: async () => {},
      }),
    });
    expect(() => httpCLI().command(HelpCmd)).toThrow('"help" is a reserved command name.');
  });
});

describe('runCLI', () => {
  it('shows version with --version', async () => {
    const cli = httpCLI({ name: 'test', version: '2.0.0' });
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', '--version'], ...io });
    expect(io.lines).toEqual(['2.0.0']);
  });

  it('shows 0.0.0 when version not set', async () => {
    const cli = httpCLI();
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', '--version'], ...io });
    expect(io.lines).toEqual(['0.0.0']);
  });

  it('shows help with --help', async () => {
    const cli = httpCLI({ name: 'my-cli' }).command(ListItems).command(GetItem);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', '--help'], ...io });
    expect(io.lines[0]).toContain('my-cli');
    expect(io.lines.some(l => l.includes('list'))).toBe(true);
    expect(io.lines.some(l => l.includes('get'))).toBe(true);
  });

  it('shows description in help when configured', async () => {
    const cli = httpCLI({ name: 'my-cli', description: 'A sample HTTP CLI tool' });
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', '--help'], ...io });
    expect(io.lines.some(l => l.includes('A sample HTTP CLI tool'))).toBe(true);
  });

  it('help aligns command columns', async () => {
    const ShortCmd = defineCLICommand({
      name: 'a',
      description: 'Short name',
      args: {},
      run: (): Command<DefaultScope, void> => ({
        request: { method: 'GET', url: '/' },
        parseData: async () => {},
      }),
    });
    const LongCmd = defineCLICommand({
      name: 'long-name',
      description: 'Long name',
      args: {},
      run: (): Command<DefaultScope, void> => ({
        request: { method: 'GET', url: '/' },
        parseData: async () => {},
      }),
    });
    const cli = httpCLI().command(ShortCmd).command(LongCmd);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', '--help'], ...io });
    const listLine = io.lines.find(l => l.includes('Short name'))!;
    const getLn = io.lines.find(l => l.includes('Long name'))!;
    expect(listLine.indexOf('Short name')).toBe(getLn.indexOf('Long name'));
  });

  it('shows command help with <command> --help', async () => {
    const cli = httpCLI().command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list', '--help'], ...io });
    expect(io.lines.some(l => l.includes('--limit'))).toBe(true);
    expect(io.lines.some(l => l.includes('-l'))).toBe(true);
  });

  it('shows --help in per-command help output', async () => {
    const cli = httpCLI().command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list', '--help'], ...io });
    expect(io.lines.some(l => l.includes('-h, --help') && l.includes('Show help'))).toBe(true);
  });

  it('command help shows required and default annotations', async () => {
    const cli = httpCLI().command(GetItem);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'get', '--help'], ...io });
    expect(io.lines.some(l => l.includes('(required)'))).toBe(true);
  });

  it('supports "help <command>" subcommand', async () => {
    const cli = httpCLI().command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'help', 'list'], ...io });
    expect(io.lines[0]).toContain('list');
    expect(io.lines.some(l => l.includes('--limit'))).toBe(true);
  });

  it('"help" without target shows global help', async () => {
    const cli = httpCLI({ name: 'my-cli' }).command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'help'], ...io });
    expect(io.lines[0]).toContain('my-cli');
  });

  it('"help <unknown>" shows error with suggestion', async () => {
    const cli = httpCLI().command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'help', 'lits'], ...io });
    expect(io.errLines[0]).toContain('Unknown command: lits');
    expect(io.errLines.some(l => l.includes('Did you mean: list?'))).toBe(true);
    expect(io.exitCode).toBe(1);
  });

  it('executes command and outputs JSON', async () => {
    const data = [{ id: 1, name: 'foo' }];
    const client = mockClient(data);
    const cli = httpCLI()
      .bindClient(() => client)
      .command(ListItems);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list', '--limit', '5'], ...io });
    expect(io.lines).toEqual([JSON.stringify(data, null, 2)]);
    expect(client.send).toHaveBeenCalledOnce();
  });

  it('executes command without args', async () => {
    const data = { status: 'ok' };
    const client = mockClient(data);
    const cli = httpCLI()
      .bindClient(() => client)
      .command(HealthCheck);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'health'], ...io });
    expect(io.lines).toEqual([JSON.stringify(data, null, 2)]);
  });

  it('suggests similar command on typo', async () => {
    const cli = httpCLI().command(ListItems).command(GetItem);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'lits'], ...io });
    expect(io.errLines[0]).toContain('Unknown command: lits');
    expect(io.errLines.some(l => l.includes('Did you mean: list?'))).toBe(true);
    expect(io.exitCode).toBe(1);
  });

  it('shows fallback message when no similar command', async () => {
    const cli = httpCLI().command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'xyzzy'], ...io });
    expect(io.errLines[0]).toContain('Unknown command: xyzzy');
    expect(io.errLines.some(l => l.includes('--help'))).toBe(true);
    expect(io.exitCode).toBe(1);
  });

  it('errors on missing required arg', async () => {
    const client = mockClient({});
    const cli = httpCLI()
      .bindClient(() => client)
      .command(GetItem);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'get'], ...io });
    expect(io.errLines[0]).toContain('Missing required argument: --id');
    expect(io.exitCode).toBe(1);
  });

  it('errors on unknown flag', async () => {
    const client = mockClient({});
    const cli = httpCLI()
      .bindClient(() => client)
      .command(ListItems);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list', '--limti', '5'], ...io });
    expect(io.errLines[0]).toContain('Unknown flag: --limti');
    expect(io.exitCode).toBe(1);
  });

  it('errors when no client is bound', async () => {
    const cli = httpCLI().command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list'], ...io });
    expect(io.errLines[0]).toContain('No client bound');
    expect(io.exitCode).toBe(1);
  });

  it('shows help when no command given', async () => {
    const cli = httpCLI({ name: 'test' }).command(ListItems);
    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli'], ...io });
    expect(io.exitCode).toBe(1);
    expect(io.lines[0]).toContain('Usage:');
  });

  it('applies CLI-level middleware', async () => {
    const data = { ok: true };
    const client = mockClient(data);
    const mw = vi.fn<Middleware>((next: Handler) => next);

    const cli = httpCLI()
      .bindClient(() => client)
      .use(mw)
      .command(ListItems);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list'], ...io });
    expect(client.with).toHaveBeenCalledWith(mw);
  });

  it('formats HttpCommandError with status and URL', async () => {
    const httpErr = new HttpCommandError({
      message: 'HTTP 404',
      code: 'HTTP',
      request: { method: 'GET', url: 'https://api.example.com/items/999', headers: {} },
      status: 404,
      body: '{"error":"Not Found"}',
    });
    const client = failClient(httpErr);
    const cli = httpCLI()
      .bindClient(() => client)
      .command(ListItems);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list'], ...io });
    expect(io.errLines[0]).toContain('HTTP error');
    expect(io.errLines[0]).toContain('GET');
    expect(io.errLines[0]).toContain('https://api.example.com/items/999');
    expect(io.errLines.some(l => l.includes('404'))).toBe(true);
    expect(io.exitCode).toBe(1);
  });

  it('formats HttpCommandError without body gracefully', async () => {
    const httpErr = new HttpCommandError({
      message: 'Transport error',
      code: 'TRANSPORT',
      request: { method: 'POST', url: 'https://api.example.com/items', headers: {} },
    });
    const client = failClient(httpErr);
    const cli = httpCLI()
      .bindClient(() => client)
      .command(ListItems);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list'], ...io });
    expect(io.errLines[0]).toContain('TRANSPORT error');
    expect(io.exitCode).toBe(1);
  });

  it('handles generic errors', async () => {
    const client = failClient(new Error('Network failure'));
    const cli = httpCLI()
      .bindClient(() => client)
      .command(ListItems);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list'], ...io });
    expect(io.errLines[0]).toBe('Network failure');
    expect(io.exitCode).toBe(1);
  });

  it('handles non-Error throws', async () => {
    const client: Client<DefaultScope> = {
      send: vi.fn().mockRejectedValue('string error'),
      with: vi.fn().mockReturnThis(),
      withDefaults: vi.fn().mockReturnThis(),
    };
    const cli = httpCLI()
      .bindClient(() => client)
      .command(ListItems);

    const io = capture();
    await runCLI(cli, { argv: ['node', 'cli', 'list'], ...io });
    expect(io.errLines[0]).toBe('string error');
    expect(io.exitCode).toBe(1);
  });
});
