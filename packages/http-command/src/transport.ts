import { isStreamLikeBody } from './body';
import { HttpCommandError, isAbortError } from './error';
import type { Context, Handler, RequestBody } from './types';

type Scope = {
  signal?: AbortSignal;
  timedOut: () => boolean;
  cleanup: () => void;
};

function createScope(signal?: AbortSignal, timeoutMs?: number): Scope {
  if (!signal && timeoutMs == null) {
    return { signal: undefined, timedOut: () => false, cleanup: () => {} };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onAbort = () => controller.abort(signal?.reason);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  }

  if (timeoutMs != null) {
    if (timeoutMs <= 0) {
      timedOut = true;
      const error = new Error(`Timeout after ${timeoutMs}ms`);
      error.name = 'TimeoutError';
      controller.abort(error);
    } else {
      timer = setTimeout(() => {
        timedOut = true;
        const error = new Error(`Timeout after ${timeoutMs}ms`);
        error.name = 'TimeoutError';
        controller.abort(error);
      }, timeoutMs);
    }
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

export const fetchTransport: Handler = async (context: Context) => {
  const scope = createScope(context.signal, context.timeoutMs);
  try {
    const init: Omit<RequestInit, 'body'> & {
      body?: RequestBody | null;
      duplex?: 'half';
    } = {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
      signal: scope.signal,
    };

    // Node.js fetch requires duplex: 'half' for streaming request bodies.
    // Browsers ignore this non-standard extension.
    if (isStreamLikeBody(context.request.body)) init.duplex = 'half';

    const response = await globalThis.fetch(
      context.request.url,
      init as RequestInit,
    );
    return { response };
  } catch (error) {
    if (scope.timedOut()) {
      throw HttpCommandError.timeout({
        request: context.request,
        timeoutMs: context.timeoutMs,
        cause: error,
      });
    }
    if (context.signal?.aborted || isAbortError(error)) {
      throw HttpCommandError.cancelled({
        request: context.request,
        cause: error,
      });
    }
    throw HttpCommandError.transport({
      request: context.request,
      cause: error,
    });
  } finally {
    scope.cleanup();
  }
};
