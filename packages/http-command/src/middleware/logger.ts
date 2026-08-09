import type { Middleware } from '../types';

export type LogEvent = {
  phase: 'request' | 'response' | 'error';
  method: string;
  url: string;
  attempt: number;
  durationMs?: number;
  status?: number;
  error?: unknown;
};

export function logger(log: (event: LogEvent) => void): Middleware {
  return (next) => async (ctx) => {
    const start = Date.now();
    const { method, url } = ctx.request;
    const { attempt } = ctx;

    log({ phase: 'request', method, url, attempt });

    try {
      const result = await next(ctx);
      log({
        phase: 'response',
        method,
        url,
        attempt,
        durationMs: Date.now() - start,
        status: result.response.status,
      });
      return result;
    } catch (error) {
      log({
        phase: 'error',
        method,
        url,
        attempt,
        durationMs: Date.now() - start,
        error,
      });
      throw error;
    }
  };
}
