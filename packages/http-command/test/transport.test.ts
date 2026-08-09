import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchTransport } from '../src/transport';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.stubGlobal('fetch', originalFetch);
});

describe('fetchTransport', () => {
  test('sets duplex half for a streaming request body', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      expect(
        (init as RequestInit & { duplex?: 'half' } | undefined)?.duplex,
      ).toBe('half');
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('payload'));
        controller.close();
      },
    });

    await fetchTransport({
      request: {
        method: 'POST',
        url: 'https://example.com/upload',
        headers: {},
        body: stream,
      },
      attempt: 1,
      meta: {},
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('sets duplex half for an async iterable request body', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      expect(
        (init as RequestInit & { duplex?: 'half' } | undefined)?.duplex,
      ).toBe('half');
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const body = (async function* (): AsyncIterable<Uint8Array> {
      yield new TextEncoder().encode('payload');
    })();

    await fetchTransport({
      request: {
        method: 'POST',
        url: 'https://example.com/upload',
        headers: {},
        body,
      },
      attempt: 1,
      meta: {},
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('does not set duplex for replayable non-stream bodies', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      expect(
        (init as RequestInit & { duplex?: 'half' } | undefined)?.duplex,
      ).toBeUndefined();
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchTransport({
      request: {
        method: 'POST',
        url: 'https://example.com/upload',
        headers: {},
        body: 'payload',
      },
      attempt: 1,
      meta: {},
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
