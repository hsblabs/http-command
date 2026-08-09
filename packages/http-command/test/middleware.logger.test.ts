import { describe, expect, test } from 'vitest';

import { createClient } from '../src/client';
import { logger } from '../src/middleware/logger';
import type { Handler } from '../src/types';

describe('logger middleware', () => {
  test('emits request and response events', async () => {
    const events: string[] = [];
    const handler: Handler = async () => ({
      response: new Response('{}', { status: 200 }),
    });

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [logger((event) => events.push(event.phase))],
    });

    await client.send({
      request: { method: 'GET', url: '/' },
      parseData: () => ({}),
    });

    expect(events).toEqual(['request', 'response']);
  });
});
