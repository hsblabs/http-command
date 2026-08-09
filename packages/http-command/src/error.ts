import type { HttpRequest } from './types';

export type ErrorCode =
  | 'HTTP'
  | 'TRANSPORT'
  | 'PARSE'
  | 'TIMEOUT'
  | 'CANCELLED';

const BRAND = Symbol.for('@hsblabs/http-command/error');

function extractHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

export class HttpCommandError extends Error {
  readonly name = 'HttpCommandError';
  readonly code: ErrorCode;
  readonly request: HttpRequest;
  readonly status?: number;
  readonly response?: { status: number; headers: Record<string, string> };
  readonly body?: string;
  readonly errorData?: unknown;
  readonly cause?: unknown;
  readonly [BRAND] = true;

  constructor(args: {
    message: string;
    code: ErrorCode;
    request: HttpRequest;
    status?: number;
    response?: { status: number; headers: Record<string, string> };
    body?: string;
    errorData?: unknown;
    cause?: unknown;
  }) {
    super(args.message);
    this.code = args.code;
    this.request = args.request;
    this.status = args.status;
    this.response = args.response;
    this.body = args.body;
    this.errorData = args.errorData;
    this.cause = args.cause;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpCommandError);
    }
    Object.setPrototypeOf(this, HttpCommandError.prototype);
  }

  static http(args: {
    request: HttpRequest;
    response: Response;
    body?: string;
    errorData?: unknown;
    cause?: unknown;
  }): HttpCommandError {
    return new HttpCommandError({
      message: `HTTP ${args.response.status}`,
      code: 'HTTP',
      request: args.request,
      status: args.response.status,
      response: {
        status: args.response.status,
        headers: extractHeaders(args.response),
      },
      body: args.body,
      errorData: args.errorData,
      cause: args.cause,
    });
  }

  static parse(args: {
    request: HttpRequest;
    response: Response;
    cause: unknown;
    body?: string;
  }): HttpCommandError {
    return new HttpCommandError({
      message: 'Response data parse failed',
      code: 'PARSE',
      request: args.request,
      status: args.response.status,
      response: {
        status: args.response.status,
        headers: extractHeaders(args.response),
      },
      body: args.body,
      cause: args.cause,
    });
  }

  static transport(args: {
    request: HttpRequest;
    cause: unknown;
    message?: string;
  }): HttpCommandError {
    return new HttpCommandError({
      message: args.message ?? 'Transport error',
      code: 'TRANSPORT',
      request: args.request,
      cause: args.cause,
    });
  }

  static timeout(args: {
    request: HttpRequest;
    timeoutMs?: number;
    cause?: unknown;
  }): HttpCommandError {
    return new HttpCommandError({
      message:
        args.timeoutMs != null
          ? `Timeout after ${args.timeoutMs}ms`
          : 'Request timed out',
      code: 'TIMEOUT',
      request: args.request,
      cause: args.cause,
    });
  }

  static cancelled(args: {
    request: HttpRequest;
    cause?: unknown;
  }): HttpCommandError {
    return new HttpCommandError({
      message: 'Request cancelled',
      code: 'CANCELLED',
      request: args.request,
      cause: args.cause,
    });
  }
}

export function isHttpCommandError(
  value: unknown,
): value is HttpCommandError {
  if (value instanceof HttpCommandError) return true;
  if (typeof value !== 'object' || value === null) return false;
  return BRAND in value;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}
