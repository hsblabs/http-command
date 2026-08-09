export { createClient } from './client';
export { defineCommand, defineJsonCommand } from './command';
export { HttpCommandError, isHttpCommandError } from './error';
export type { ErrorCode } from './error';
export { fetchTransport } from './transport';
export { bearerAuth } from './middleware/bearerAuth';
export { retry, type RetryOptions } from './middleware/retry';
export { logger, type LogEvent } from './middleware/logger';
export { defineMiddleware } from './middleware/define';
export { appendQuery, encodePathSegment, resolveUrl } from './url';
export { hasHeader, mergeHeaders } from './headers';
export type {
  BodyFactory,
  BodyFactoryContext,
  Client,
  ClientConfig,
  Command,
  CommandConfig,
  Context,
  DefaultScope,
  Defaults,
  Handler,
  HttpRequest,
  JsonCommandConfig,
  Middleware,
  MiddlewareHooks,
  QueryPrimitive,
  QueryValue,
  RequestBody,
  RequestDescriptor,
  ResponseParser,
  SendOptions,
  UrlResolver,
} from './types';
