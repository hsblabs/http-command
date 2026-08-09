import { describe, expect, test } from 'vitest';

import { createClient } from '../src/client';
import { retry } from '../src/middleware/retry';
import type { Handler, RequestBody } from '../src/types';

describe('retry middleware', () => {
  test('retries on 5xx and increases attempt', async () => {
    const attempts: number[] = [];
    const statuses = [500, 200];

    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      const status = statuses.shift() ?? 200;
      return { response: new Response('{"ok":true}', { status }) };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [retry({ delayMs: () => 0 })],
    });

    const result = await client.send({
      request: { method: 'GET', url: '/retry' },
      parseData: async (response) => response.json() as Promise<{ ok: boolean }>,
    });

    expect(result.ok).toBe(true);
    expect(attempts).toEqual([1, 2]);
  });

  test('does not retry abort errors', async () => {
    const attempts: number[] = [];
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';

    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      throw abortError;
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [retry({ delayMs: () => 0, maxAttempts: 3 })],
    });

    await expect(
      client.send({
        request: { method: 'GET', url: '/abort' },
        parseData: async (response) => response.json() as Promise<{ ok: boolean }>,
      }),
    ).rejects.toMatchObject({
      code: 'CANCELLED',
      cause: abortError,
    });

    expect(attempts).toEqual([1]);
  });

  test('stops retry delay when signal is aborted', async () => {
    const attempts: number[] = [];
    const controller = new AbortController();

    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      return { response: new Response('retry', { status: 500 }) };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [retry({ delayMs: () => 1000, maxAttempts: 3 })],
    });

    const pending = client.send(
      {
        request: { method: 'GET', url: '/abort-delay' },
        parseData: async (response) => response.json() as Promise<{ ok: boolean }>,
      },
      { signal: controller.signal },
    );

    controller.abort(new Error('cancel retry'));

    await expect(pending).rejects.toMatchObject({
      code: 'CANCELLED',
      cause: expect.objectContaining({ message: 'cancel retry' }),
    });
    expect(attempts).toEqual([1]);
  });

  test('stops a zero-delay retry when onRetry aborts the signal', async () => {
    const attempts: number[] = [];
    const controller = new AbortController();
    const reason = new Error('cancel zero-delay retry');

    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      return { response: new Response('retry', { status: 500 }) };
    };

    const client = createClient({
      handler,
      middleware: [
        retry({
          delayMs: () => 0,
          maxAttempts: 3,
          onRetry: () => controller.abort(reason),
        }),
      ],
    });

    await expect(
      client.send(
        {
          request: { method: 'GET', url: '/abort-zero-delay' },
          parseData: () => ({}),
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({
      code: 'CANCELLED',
      cause: reason,
    });
    expect(attempts).toEqual([1]);
  });

  test('does not retry non-idempotent methods by default', async () => {
    const attempts: number[] = [];
    const statuses = [500, 200];

    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      const status = statuses.shift() ?? 200;
      return { response: new Response('fail', { status }) };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [retry({ delayMs: () => 0, maxAttempts: 3 })],
    });

    await expect(
      client.send({
        request: { method: 'POST', url: '/payments' },
        parseData: async (response) => response.json() as Promise<{ ok: boolean }>,
      }),
    ).rejects.toMatchObject({ code: 'HTTP' });

    expect(attempts).toEqual([1]);
  });

  test('respects retry-after header (with max delay cap)', async () => {
    const attempts: number[] = [];
    const retryDelays: number[] = [];

    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      if (attempt === 1) {
        return {
          response: new Response('retry later', {
            status: 429,
            headers: { 'retry-after': '120' },
          }),
        };
      }
      return { response: new Response('{"ok":true}', { status: 200 }) };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [
        retry({
          delayMs: () => 0,
          maxDelayMs: 1,
          onRetry: ({ delayMs }) => retryDelays.push(delayMs),
        }),
      ],
    });

    const result = await client.send({
      request: { method: 'GET', url: '/quota' },
      parseData: async (response) => response.json() as Promise<{ ok: boolean }>,
    });

    expect(result.ok).toBe(true);
    expect(attempts).toEqual([1, 2]);
    expect(retryDelays).toEqual([1]);
  });

  test('retries non-idempotent method when idempotency-key header is present', async () => {
    const attempts: number[] = [];
    const statuses = [500, 200];

    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      const status = statuses.shift() ?? 200;
      return {
        response: new Response(
          status === 200 ? '{"ok":true}' : 'retry',
          { status },
        ),
      };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [retry({ delayMs: () => 0, maxAttempts: 3 })],
    });

    const result = await client.send({
      request: {
        method: 'POST',
        url: '/payments',
        headers: { 'Idempotency-Key': 'pay_123' },
      },
      parseData: async (response) => response.json() as Promise<{ ok: boolean }>,
    });

    expect(result.ok).toBe(true);
    expect(attempts).toEqual([1, 2]);
  });

  test('isolates request object per retry attempt', async () => {
    const seenHeaders: Array<Record<string, string>> = [];
    const statuses = [500, 200];

    const mutatingMiddleware =
      (next: Handler): Handler =>
      async (context) => {
        context.request.headers[`x-attempt-${context.attempt}`] = '1';
        return next(context);
      };

    const handler: Handler = async ({ request }) => {
      seenHeaders.push({ ...request.headers });
      const status = statuses.shift() ?? 200;
      return {
        response: new Response(
          status === 200 ? '{"ok":true}' : 'retry',
          { status },
        ),
      };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      middleware: [
        retry({ delayMs: () => 0, maxAttempts: 3 }),
        mutatingMiddleware,
      ],
    });

    const result = await client.send({
      request: { method: 'GET', url: '/isolated' },
      parseData: async (response) => response.json() as Promise<{ ok: boolean }>,
    });

    expect(result.ok).toBe(true);
    expect(seenHeaders[0]).toEqual({ 'x-attempt-1': '1' });
    expect(seenHeaders[1]).toEqual({ 'x-attempt-2': '1' });
  });

  test('recreates bodyFactory output for each retry attempt', async () => {
    const bodies: Array<RequestBody | null | undefined> = [];
    const bodyFactoryAttempts: number[] = [];
    let bodyNumber = 0;

    const handler: Handler = async ({ request, attempt }) => {
      bodies.push(request.body);
      return {
        response: new Response(
          attempt === 1 ? 'retry' : '{"ok":true}',
          { status: attempt === 1 ? 500 : 200 },
        ),
      };
    };

    const client = createClient({
      handler,
      middleware: [retry({ delayMs: () => 0, maxAttempts: 2 })],
    });

    const result = await client.send({
      request: {
        method: 'PUT',
        url: '/replay',
        bodyFactory: ({ attempt }) => {
          bodyFactoryAttempts.push(attempt);
          return `body-${++bodyNumber}`;
        },
      },
      parseData: (response) => response.json() as Promise<{ ok: boolean }>,
    });

    expect(result).toEqual({ ok: true });
    expect(bodies).toEqual(['body-1', 'body-2']);
    expect(bodyNumber).toBe(2);
    expect(bodyFactoryAttempts).toEqual([1, 2]);
  });

  test('does not retry a static ReadableStream body by default', async () => {
    const attempts: number[] = [];
    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      return { response: new Response('retry', { status: 500 }) };
    };

    const client = createClient({
      handler,
      middleware: [retry({ delayMs: () => 0, maxAttempts: 3 })],
    });

    await expect(
      client.send({
        request: {
          method: 'PUT',
          url: '/stream',
          body: new ReadableStream(),
        },
        parseData: () => ({}),
      }),
    ).rejects.toMatchObject({ code: 'HTTP' });

    expect(attempts).toEqual([1]);
  });

  test('does not retry a static async iterable body', async () => {
    const attempts: number[] = [];
    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      return { response: new Response('retry', { status: 500 }) };
    };

    const client = createClient({
      handler,
      middleware: [retry({ delayMs: () => 0, maxAttempts: 3 })],
    });

    const body = (async function* (): AsyncIterable<Uint8Array> {
      yield new TextEncoder().encode('payload');
    })();

    await expect(
      client.send({
        request: { method: 'PUT', url: '/stream', body },
        parseData: () => ({}),
      }),
    ).rejects.toMatchObject({ code: 'HTTP' });

    expect(attempts).toEqual([1]);
  });

  test('never retries a static stream even when shouldRetry returns true', async () => {
    const attempts: number[] = [];
    const handler: Handler = async ({ attempt }) => {
      attempts.push(attempt);
      return { response: new Response('retry', { status: 500 }) };
    };

    const client = createClient({
      handler,
      middleware: [
        retry({
          delayMs: () => 0,
          maxAttempts: 3,
          shouldRetry: () => true,
        }),
      ],
    });

    await expect(
      client.send({
        request: {
          method: 'PUT',
          url: '/stream',
          body: new ReadableStream(),
        },
        parseData: () => ({}),
      }),
    ).rejects.toMatchObject({ code: 'HTTP' });

    expect(attempts).toEqual([1]);
  });
});
