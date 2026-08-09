import { describe, expect, test } from 'vitest';

import { createClient } from '../src/client';
import { bearerAuth } from '../src/middleware/bearerAuth';
import type { Handler } from '../src/types';

describe('bearerAuth middleware', () => {
  test('adds authorization header', async () => {
    const handler: Handler = async ({ request }) => {
      expect(request.headers.Authorization).toBe('Bearer token-123');
      return { response: new Response('{}', { status: 200 }) };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [bearerAuth('token-123')],
    });

    await client.send({
      request: { method: 'GET', url: '/secure' },
      parseData: () => ({}),
    });
  });

  test('supports async token resolver', async () => {
    const handler: Handler = async ({ request }) => {
      expect(request.headers.Authorization).toBe('Bearer async-token');
      return { response: new Response('{}', { status: 200 }) };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [bearerAuth(async () => 'async-token')],
    });

    await client.send({
      request: { method: 'GET', url: '/secure' },
      parseData: () => ({}),
    });
  });
});
