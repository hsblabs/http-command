import { isStreamLikeBody } from '../body';
import { HttpCommandError, isAbortError, isHttpCommandError } from '../error';
import { hasHeader } from '../headers';
import type { Context, Middleware } from '../types';

export type RetryOptions = {
  maxAttempts?: number;
  shouldRetry?: (args: {
    attempt: number;
    response?: Response;
    error?: unknown;
    context: Context;
  }) => boolean;
  delayMs?: (attempt: number) => number;
  maxDelayMs?: number;
  respectRetryAfter?: boolean;
  isRetryableMethod?: (
    method: string,
    headers: Record<string, string>,
  ) => boolean;
  jitter?: 'none' | 'full' | ((delayMs: number) => number);
  onRetry?: (args: {
    attempt: number;
    nextAttempt: number;
    delayMs: number;
    response?: Response;
    error?: unknown;
  }) => void;
};

const IDEMPOTENT = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
  'TRACE',
  'PUT',
  'DELETE',
]);

function defaultIsRetryable(
  method: string,
  headers: Record<string, string>,
): boolean {
  if (IDEMPOTENT.has(method.toUpperCase())) return true;
  return hasHeader(headers, 'idempotency-key');
}

function isReplayableRequest(context: Context): boolean {
  return Boolean(context.bodyFactory) || !isStreamLikeBody(context.request.body);
}

function defaultShouldRetry(
  args: { response?: Response; error?: unknown; context: Context },
  isRetryableMethod: (
    method: string,
    headers: Record<string, string>,
  ) => boolean,
): boolean {
  if (
    !isRetryableMethod(
      args.context.request.method,
      args.context.request.headers,
    ) ||
    !isReplayableRequest(args.context)
  ) {
    return false;
  }

  if (args.error) {
    if (isHttpCommandError(args.error)) {
      return (
        args.error.code !== 'CANCELLED' &&
        args.error.code !== 'TIMEOUT'
      );
    }
    return !isAbortError(args.error);
  }

  if (!args.response) return false;
  return args.response.status === 429 || args.response.status >= 500;
}

function parseRetryAfterMs(response?: Response): number | undefined {
  const value = response?.headers.get('retry-after');
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : Object.assign(new Error('Aborted'), { name: 'AbortError' }),
    );
  }

  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : Object.assign(new Error('Aborted'), { name: 'AbortError' }),
      );
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best effort. A locked or consumed body must not prevent the retry.
  }
}

async function createAttemptContext(
  context: Context,
  attempt: number,
): Promise<Context> {
  let body = context.request.body;

  if (attempt !== context.attempt && context.bodyFactory) {
    try {
      body = await context.bodyFactory({
        attempt,
        signal: context.signal,
      });
    } catch (cause) {
      if (context.signal?.aborted || isAbortError(cause)) {
        throw HttpCommandError.cancelled({
          request: context.request,
          cause,
        });
      }
      throw HttpCommandError.transport({
        request: context.request,
        cause,
        message: 'Request body recreation failed',
      });
    }
  }

  return {
    ...context,
    attempt,
    request: {
      ...context.request,
      headers: { ...context.request.headers },
      body,
    },
  };
}

export function retry(options: RetryOptions = {}): Middleware {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const isRetryableMethod =
    options.isRetryableMethod ?? defaultIsRetryable;
  const shouldRetry =
    options.shouldRetry ??
    ((args: {
      attempt: number;
      response?: Response;
      error?: unknown;
      context: Context;
    }) => defaultShouldRetry(args, isRetryableMethod));
  const delayMs = options.delayMs ?? ((attempt: number) => attempt * 100);
  const maxDelayMs =
    options.maxDelayMs != null
      ? Math.max(0, options.maxDelayMs)
      : undefined;
  const respectRetryAfter = options.respectRetryAfter ?? true;
  const jitter = options.jitter ?? 'none';

  const computeDelay = (
    attempt: number,
    response?: Response,
  ): number => {
    let delay = Math.max(0, delayMs(attempt));
    if (respectRetryAfter) {
      const retryAfter = parseRetryAfterMs(response);
      if (retryAfter != null) delay = Math.max(delay, retryAfter);
    }
    if (maxDelayMs != null) delay = Math.min(delay, maxDelayMs);
    if (jitter === 'full') {
      delay = Math.floor(Math.random() * (delay + 1));
    } else if (typeof jitter === 'function') {
      delay = jitter(delay);
    }
    return Math.max(0, delay);
  };

  return (next) => async (context) => {
    let attempt = context.attempt;
    let lastError: unknown;

    while (attempt <= maxAttempts) {
      const attemptContext = await createAttemptContext(context, attempt);

      try {
        const result = await next(attemptContext);

        if (
          attempt < maxAttempts &&
          isReplayableRequest(attemptContext) &&
          shouldRetry({
            attempt,
            response: result.response,
            context: attemptContext,
          })
        ) {
          const delay = computeDelay(attempt, result.response);
          options.onRetry?.({
            attempt,
            nextAttempt: attempt + 1,
            delayMs: delay,
            response: result.response,
          });
          await discardResponse(result.response);
          try {
            await wait(delay, context.signal);
          } catch (error) {
            if (context.signal?.aborted || isAbortError(error)) {
              throw HttpCommandError.cancelled({
                request: context.request,
                cause: error,
              });
            }
            throw error;
          }
          attempt++;
          continue;
        }

        return result;
      } catch (error) {
        lastError = error;

        if (
          attempt < maxAttempts &&
          isReplayableRequest(attemptContext) &&
          shouldRetry({
            attempt,
            error,
            context: attemptContext,
          })
        ) {
          const delay = computeDelay(attempt);
          options.onRetry?.({
            attempt,
            nextAttempt: attempt + 1,
            delayMs: delay,
            error,
          });
          try {
            await wait(delay, context.signal);
          } catch (waitError) {
            if (
              context.signal?.aborted ||
              isAbortError(waitError)
            ) {
              throw HttpCommandError.cancelled({
                request: context.request,
                cause: waitError,
              });
            }
            throw waitError;
          }
          attempt++;
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  };
}
