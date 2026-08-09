import { describe, expect, test } from 'vitest';

import { createClient } from '../src/client';
import { defineCommand } from '../src/command';
import type { Client, Handler } from '../src/types';

declare const SERVICE_A: unique symbol;
declare const SERVICE_B: unique symbol;

type ServiceA = typeof SERVICE_A;
type ServiceB = typeof SERVICE_B;

const defineServiceACommand = defineCommand<ServiceA>();
const defineServiceBCommand = defineCommand<ServiceB>();

const serviceACommand = defineServiceACommand({
  build: () => ({ method: 'GET', url: '/a' }),
  parseData: (response): Promise<{ service: 'a' }> => response.json(),
});

const serviceBCommand = defineServiceBCommand({
  build: () => ({ method: 'GET', url: '/b' }),
  parseData: (response): Promise<{ service: 'b' }> => response.json(),
});

function assertServiceBoundary(): void {
  const client = createClient<ServiceA>();

  client.send(serviceACommand({}));

  // @ts-expect-error A ServiceA client must reject ServiceB commands.
  client.send(serviceBCommand({}));

  // @ts-expect-error Scoped commands must be created by the bound definer.
  client.send({
    request: { method: 'GET', url: '/unscoped' },
    parseData: () => ({ service: 'a' as const }),
  });

  // @ts-expect-error Scoped clients are invariant and cannot be reassigned.
  const serviceBClient: Client<ServiceB> = client;
  void serviceBClient;
}

void assertServiceBoundary;

describe('service scopes', () => {
  test('sends a command with the matching scope', async () => {
    const handler: Handler = async () => ({
      response: new Response('{"service":"a"}', { status: 200 }),
    });
    const client = createClient<ServiceA>({ handler });

    await expect(client.send(serviceACommand({}))).resolves.toEqual({
      service: 'a',
    });
  });
});
