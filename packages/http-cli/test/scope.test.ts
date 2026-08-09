import { createClient, defineCommand } from '@hsblabs/http-command';
import { describe, expect, test } from 'vitest';

import { httpCLI } from '../src/cli';
import { defineCLICommand } from '../src/command';

declare const SERVICE_A: unique symbol;
declare const SERVICE_B: unique symbol;

type ServiceA = typeof SERVICE_A;
type ServiceB = typeof SERVICE_B;

const defineServiceACommand = defineCommand<ServiceA>();
const defineServiceBCommand = defineCommand<ServiceB>();

const serviceACommand = defineServiceACommand({
  build: () => ({ method: 'GET', url: '/a' }),
  parseData: () => ({ service: 'a' as const }),
});

const serviceBCommand = defineServiceBCommand({
  build: () => ({ method: 'GET', url: '/b' }),
  parseData: () => ({ service: 'b' as const }),
});

const serviceACLICommand = defineCLICommand<{}, { service: 'a' }, ServiceA>({
  name: 'a',
  run: () => serviceACommand({}),
});

const serviceBCLICommand = defineCLICommand<{}, { service: 'b' }, ServiceB>({
  name: 'b',
  run: () => serviceBCommand({}),
});

function assertCLIScopeBoundary(): void {
  const cli = httpCLI<ServiceA>().bindClient(() => createClient<ServiceA>());

  cli.command(serviceACLICommand);

  // @ts-expect-error A ServiceA CLI must reject ServiceB commands.
  cli.command(serviceBCLICommand);
}

void assertCLIScopeBoundary;

describe('CLI service scopes', () => {
  test('retains the configured scope while registering commands', () => {
    const cli = httpCLI<ServiceA>().command(serviceACLICommand);
    expect(cli.commands.has('a')).toBe(true);
  });
});
