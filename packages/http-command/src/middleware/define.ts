import type { Middleware, MiddlewareHooks } from '../types';

export function defineMiddleware(hooks: MiddlewareHooks): Middleware {
  return (next) => async (ctx) => {
    const nextCtx = (await hooks.before?.(ctx)) ?? ctx;
    try {
      const result = await next(nextCtx);
      return (await hooks.after?.(result, nextCtx)) ?? result;
    } catch (error) {
      const recovered = await hooks.onError?.(error, nextCtx);
      if (recovered) return recovered;
      throw error;
    }
  };
}
