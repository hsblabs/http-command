import { describe, expect, test } from 'vitest';

import { createClient } from '../src/client';
import { defineMiddleware } from '../src/middleware/define';
import type { Handler } from '../src/types';

describe('defineMiddleware', () => {
  test('supports before hook for request modification', async () => {
    const handler: Handler = async ({ request }) => ({
      response: new Response(
        JSON.stringify({ header: request.headers['x-before'] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    });

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [
        defineMiddleware({
          before: (ctx) => ({
            ...ctx,
            request: {
              ...ctx.request,
              headers: { ...ctx.request.headers, 'x-before': 'yes' },
            },
          }),
        }),
      ],
    });

    const result = await client.send({
      request: { method: 'GET', url: '/hook' },
      parseData: async (response) =>
        response.json() as Promise<{ header: string }>,
    });

    expect(result).toEqual({ header: 'yes' });
  });

  test('supports onError recovery', async () => {
    const handler: Handler = async () => {
      throw new Error('boom');
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [
        defineMiddleware({
          onError: () => ({
            response: new Response(
              JSON.stringify({ recovered: true }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            ),
          }),
        }),
      ],
    });

    const result = await client.send({
      request: { method: 'GET', url: '/recover' },
      parseData: async (response) =>
        response.json() as Promise<{ recovered: boolean }>,
    });

    expect(result).toEqual({ recovered: true });
  });
});
