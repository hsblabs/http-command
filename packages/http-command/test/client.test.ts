import { describe, expect, test, vi } from 'vitest';

import { createClient } from '../src/client';
import { defineCommand } from '../src/command';
import { HttpCommandError } from '../src/error';
import type { Command, DefaultScope, Handler } from '../src/types';

type EchoOutput = { ok: boolean; id: string };

const noop = defineCommand({
  build: (input: { id: string }) => ({
    method: 'GET',
    url: `/echo/${input.id}`,
  }),
  parseData: async (response) => response.json() as Promise<EchoOutput>,
});

describe('createClient', () => {
  test('send executes command via injected handler', async () => {
    const handler: Handler = async ({ request }) => {
      expect(request.url).toBe('https://example.com/echo/abc');
      return {
        response: new Response(JSON.stringify({ ok: true, id: 'abc' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      };
    };

    const client = createClient({ baseUrl: 'https://example.com', handler });
    const result = await client.send(noop({ id: 'abc' }));

    expect(result).toEqual({ ok: true, id: 'abc' });
  });

  test('with() returns immutable client with added middleware', async () => {
    const seen: string[] = [];
    const handler: Handler = async ({ request }) => {
      seen.push(request.headers['x-tag'] ?? 'none');
      return { response: new Response('{}', { status: 200 }) };
    };

    const base = createClient({ baseUrl: 'https://example.com', handler });
    const derived = base.with((next) => async (ctx) =>
      next({
        ...ctx,
        request: {
          ...ctx.request,
          headers: { ...ctx.request.headers, 'x-tag': 'derived' },
        },
      }),
    );

    const cmd: Command<DefaultScope, object> = {
      request: { method: 'GET', url: '/' },
      parseData: () => ({}),
    };

    await base.send(cmd);
    await derived.send(cmd);

    expect(seen).toEqual(['none', 'derived']);
  });

  test('withDefaults returns immutable client with merged defaults', async () => {
    const seen: Array<{
      timeoutMs?: number;
      headers: Record<string, string>;
      meta: Record<string, unknown>;
    }> = [];
    const handler: Handler = async ({ request, timeoutMs, meta }) => {
      seen.push({ timeoutMs, headers: request.headers, meta });
      return { response: new Response('{}', { status: 200 }) };
    };

    const base = createClient({
      baseUrl: 'https://example.com',
      handler,
      defaults: {
        timeoutMs: 100,
        headers: { 'x-base': 'base' },
        meta: { base: true },
      },
    });
    const derived = base.withDefaults({
      timeoutMs: 50,
      headers: { 'x-derived': 'derived' },
      meta: { derived: true },
    });

    const cmd: Command<DefaultScope, object> = {
      request: { method: 'GET', url: '/' },
      parseData: () => ({}),
    };

    await base.send(cmd);
    await derived.send(cmd);

    expect(seen).toEqual([
      {
        timeoutMs: 100,
        headers: { 'x-base': 'base' },
        meta: { base: true },
      },
      {
        timeoutMs: 50,
        headers: { 'x-base': 'base', 'x-derived': 'derived' },
        meta: { base: true, derived: true },
      },
    ]);
  });

  test('applies command defaults between client defaults and send options', async () => {
    const handler: Handler = async ({ request, timeoutMs, meta }) => {
      expect(request.headers).toEqual({
        'x-client': '1',
        'x-operation': '1',
        'x-send': '1',
      });
      expect(timeoutMs).toBe(10);
      expect(meta).toEqual({ client: true, operation: true, send: true });
      return {
        response: new Response(JSON.stringify({ ok: true, id: 'defaults' }), {
          status: 200,
        }),
      };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      defaults: {
        timeoutMs: 100,
        headers: { 'x-client': '1' },
        meta: { client: true },
      },
    });

    const result = await client.send(
      {
        request: { method: 'GET', url: '/defaults' },
        defaults: {
          timeoutMs: 50,
          headers: { 'x-operation': '1' },
          meta: { operation: true },
        },
        parseData: async (response) => response.json() as Promise<EchoOutput>,
      },
      {
        timeoutMs: 10,
        headers: { 'x-send': '1' },
        meta: { send: true },
      },
    );

    expect(result).toEqual({ ok: true, id: 'defaults' });
  });

  test('supports relative URLs when no baseUrl is configured', async () => {
    const handler: Handler = async ({ request }) => {
      expect(request.url).toBe('/search?q=hello');
      return {
        response: new Response(JSON.stringify({ ok: true, id: 'q' }), {
          status: 200,
        }),
      };
    };

    const client = createClient({ handler });
    const result = await client.send({
      request: { method: 'GET', url: '/search', query: { q: 'hello' } },
      parseData: async (response) => response.json() as Promise<EchoOutput>,
    });

    expect(result.ok).toBe(true);
  });

  test('does not re-wrap HttpCommandError thrown from handler', async () => {
    const original = HttpCommandError.transport({
      request: { method: 'GET', url: '/fail', headers: {} },
      cause: new Error('middleware failed'),
    });
    const handler: Handler = async () => {
      throw original;
    };

    const client = createClient({ handler });

    await expect(
      client.send({
        request: { method: 'GET', url: '/fail' },
        parseData: () => ({}),
      }),
    ).rejects.toBe(original);
  });

  test('does not re-wrap HttpCommandError thrown from parseData', async () => {
    const handler: Handler = async () => ({
      response: new Response('ok', { status: 200 }),
    });

    const client = createClient({ baseUrl: 'https://example.com', handler });

    const parseError = HttpCommandError.parse({
      request: { method: 'GET', url: 'https://example.com/ok', headers: {} },
      response: new Response('bad', { status: 200 }),
      cause: new Error('already normalized'),
    });

    await expect(
      client.send({
        request: { method: 'GET', url: '/ok' },
        parseData: () => {
          throw parseError;
        },
      }),
    ).rejects.toBe(parseError);
  });

  test('supports custom handler injection', async () => {
    const client = createClient({
      baseUrl: 'https://example.com',
      handler: async ({ request, attempt }) => {
        expect(request.url).toBe('https://example.com/custom');
        expect(attempt).toBe(1);
        return {
          response: new Response(
            JSON.stringify({ ok: true, id: 'custom' }),
            { status: 200 },
          ),
        };
      },
    });

    const result = await client.send({
      request: { method: 'GET', url: '/custom' },
      parseData: async (response) => response.json() as Promise<EchoOutput>,
    });

    expect(result).toEqual({ ok: true, id: 'custom' });
  });

  test('returns TIMEOUT when timeoutMs elapses', async () => {
    const originalFetch = globalThis.fetch;
    try {
      vi.stubGlobal(
        'fetch',
        ((_: string, init?: RequestInit) => {
          return new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal?.aborted) {
              reject(
                signal.reason ?? new DOMException('Aborted', 'AbortError'),
              );
              return;
            }
            signal?.addEventListener(
              'abort',
              () => {
                const abortError = new Error('aborted');
                abortError.name = 'AbortError';
                reject(abortError);
              },
              { once: true },
            );
          });
        }) as typeof globalThis.fetch,
      );

      const client = createClient({ baseUrl: 'https://example.com' });

      await expect(
        client.send(
          {
            request: { method: 'GET', url: '/timeout' },
            parseData: () => ({}),
          },
          { timeoutMs: 1 },
        ),
      ).rejects.toMatchObject({ code: 'TIMEOUT' });
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  test('returns CANCELLED when caller aborts signal', async () => {
    const originalFetch = globalThis.fetch;
    try {
      vi.stubGlobal(
        'fetch',
        ((_: string, init?: RequestInit) => {
          return new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal?.aborted) {
              reject(
                signal.reason ?? new DOMException('Aborted', 'AbortError'),
              );
              return;
            }
            signal?.addEventListener(
              'abort',
              () => {
                reject(
                  signal?.reason ??
                    new DOMException('Aborted', 'AbortError'),
                );
              },
              { once: true },
            );
          });
        }) as typeof globalThis.fetch,
      );

      const client = createClient({ baseUrl: 'https://example.com' });
      const controller = new AbortController();
      const pending = client.send(
        {
          request: { method: 'GET', url: '/cancel' },
          parseData: () => ({}),
        },
        { signal: controller.signal },
      );
      controller.abort(new Error('user cancelled'));

      await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  });

  test('merges headers case-insensitively (latest value wins)', async () => {
    const handler: Handler = async ({ request }) => {
      const authHeaders = Object.entries(request.headers).filter(
        ([key]) => key.toLowerCase() === 'authorization',
      );
      expect(authHeaders).toEqual([['authorization', 'Bearer request']]);
      return {
        response: new Response(
          JSON.stringify({ ok: true, id: 'header-case' }),
          { status: 200 },
        ),
      };
    };

    const client = createClient({
      baseUrl: 'https://example.com',
      handler,
      defaults: {
        headers: { Authorization: 'Bearer default' },
      },
    });

    const result = await client.send(
      {
        request: { method: 'GET', url: '/header-case' },
        parseData: async (response) => response.json() as Promise<EchoOutput>,
      },
      {
        headers: { authorization: 'Bearer request' },
      },
    );

    expect(result).toEqual({ ok: true, id: 'header-case' });
  });

  test('normalizes URL resolver failures before request dispatch', async () => {
    const resolverError = new Error('cross-origin command');
    const handler = vi.fn<Handler>();
    const bodyFactory = vi.fn(() => 'payload');
    const client = createClient({
      baseUrl: 'https://example.com/api/v1',
      resolveUrl: () => {
        throw resolverError;
      },
      handler,
    });

    await expect(
      client.send({
        request: {
          method: 'POST',
          url: 'https://other.example.com/users',
          bodyFactory,
        },
        parseData: () => ({}),
      }),
    ).rejects.toMatchObject({
      code: 'TRANSPORT',
      message: 'Request URL resolution failed',
      cause: resolverError,
    });

    expect(bodyFactory).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  test('uses a client-provided URL resolver', async () => {
    const handler: Handler = async ({ request }) => {
      expect(request.url).toBe('https://example.com/users');
      return {
        response: new Response('{"ok":true,"id":"custom-url"}', {
          status: 200,
        }),
      };
    };

    const client = createClient({
      baseUrl: 'https://example.com/api/v1',
      resolveUrl: (baseUrl, operationUrl) =>
        new URL(operationUrl, `${baseUrl}/`).toString(),
      handler,
    });

    const result = await client.send({
      request: { method: 'GET', url: '/users' },
      parseData: (response) => response.json() as Promise<EchoOutput>,
    });

    expect(result.id).toBe('custom-url');
  });

  test('decodes service-specific HTTP error data', async () => {
    const client = createClient({
      baseUrl: 'https://example.com/api/v1',
      handler: async () => ({
        response: new Response(
          JSON.stringify({ code: 'USER_NOT_FOUND', message: 'missing' }),
          {
            status: 404,
            headers: { 'content-type': 'application/json' },
          },
        ),
      }),
    });

    const pending = client.send({
      request: { method: 'GET', url: '/users/missing' },
      parseData: (response) => response.json(),
      parseError: (response) => response.json(),
    });

    await expect(pending).rejects.toMatchObject({
      code: 'HTTP',
      status: 404,
      errorData: { code: 'USER_NOT_FOUND', message: 'missing' },
      body: JSON.stringify({
        code: 'USER_NOT_FOUND',
        message: 'missing',
      }),
    });
  });

  test('cancels an unread cloned error body after parseError settles', async () => {
    let cloneCancelled = false;
    const response = new Response('raw-error', { status: 422 });

    Object.defineProperty(response, 'clone', {
      value: () =>
        new Response(
          new ReadableStream({
            cancel() {
              cloneCancelled = true;
            },
          }),
          { status: 422 },
        ),
    });

    const client = createClient({
      handler: async () => ({ response }),
    });

    const pending = client.send({
      request: { method: 'GET', url: '/failure' },
      parseData: () => ({}),
      parseError: () => ({ code: 'UNPROCESSABLE' }),
    });

    await expect(pending).rejects.toMatchObject({
      code: 'HTTP',
      body: 'raw-error',
      errorData: { code: 'UNPROCESSABLE' },
    });
    expect(cloneCancelled).toBe(true);
  });

  test('keeps HTTP failure primary when parseError fails', async () => {
    const decoderError = new Error('invalid service error');
    const client = createClient({
      handler: async () => ({
        response: new Response('not-json', { status: 500 }),
      }),
    });

    const pending = client.send({
      request: { method: 'GET', url: '/failure' },
      parseData: () => ({}),
      parseError: () => {
        throw decoderError;
      },
    });

    await expect(pending).rejects.toMatchObject({
      code: 'HTTP',
      status: 500,
      body: 'not-json',
      cause: decoderError,
    });
  });

  test('keeps HTTP failure primary when the error response cannot be cloned', async () => {
    const consumedResponse = new Response('already consumed', { status: 400 });
    await consumedResponse.text();

    const parseError = vi.fn(() => ({ code: 'INVALID' }));
    const client = createClient({
      handler: async () => ({ response: consumedResponse }),
    });

    const pending = client.send({
      request: { method: 'GET', url: '/consumed' },
      parseData: () => ({}),
      parseError,
    });

    await expect(pending).rejects.toMatchObject({
      code: 'HTTP',
      status: 400,
      body: undefined,
      cause: expect.any(TypeError),
    });
    expect(parseError).not.toHaveBeenCalled();
  });

  test('normalizes bodyFactory failures before dispatch', async () => {
    const bodyError = new Error('cannot create body');
    const handler = vi.fn<Handler>();
    const client = createClient({ handler });

    const pending = client.send({
      request: {
        method: 'PUT',
        url: '/upload',
        bodyFactory: () => {
          throw bodyError;
        },
      },
      parseData: () => ({}),
    });

    await expect(pending).rejects.toMatchObject({
      code: 'TRANSPORT',
      message: 'Request body creation failed',
      cause: bodyError,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test('classifies an aborted bodyFactory as CANCELLED', async () => {
    const controller = new AbortController();
    const reason = new Error('cancel body creation');
    const handler = vi.fn<Handler>();
    const client = createClient({ handler });

    const pending = client.send(
      {
        request: {
          method: 'PUT',
          url: '/upload',
          bodyFactory: async ({ signal }) => {
            controller.abort(reason);
            await Promise.resolve();
            throw signal?.reason ?? reason;
          },
        },
        parseData: () => ({}),
      },
      { signal: controller.signal },
    );

    await expect(pending).rejects.toMatchObject({
      code: 'CANCELLED',
      cause: reason,
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
