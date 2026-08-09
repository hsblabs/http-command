import { mergeHeaders } from '../headers';
import type { Middleware } from '../types';

export function bearerAuth(
  token: string | (() => string | Promise<string>),
): Middleware {
  return (next) => async (ctx) => {
    const resolved = typeof token === 'function' ? await token() : token;
    return next({
      ...ctx,
      request: {
        ...ctx.request,
        headers: mergeHeaders(ctx.request.headers, {
          Authorization: `Bearer ${resolved}`,
        }),
      },
    });
  };
}
