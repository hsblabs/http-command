import { describe, expect, it } from 'vitest';

import { HttpCommandError, isHttpCommandError } from '../src/error';
import type { HttpRequest } from '../src/types';

describe('HttpCommandError', () => {
  const mockRequest: HttpRequest = {
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: {},
  };

  it('extends Error with code', () => {
    const error = new HttpCommandError({
      message: 'Test error',
      code: 'HTTP',
      request: mockRequest,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpCommandError);
    expect(error.name).toBe('HttpCommandError');
    expect(error.code).toBe('HTTP');
  });

  it('HttpCommandError.http() produces HTTP code and response metadata', () => {
    const response = new Response('Error body', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });

    const errorData = { code: 'NOT_FOUND' };
    const error = HttpCommandError.http({
      request: mockRequest,
      response,
      body: 'Error body',
      errorData,
    });

    expect(error.code).toBe('HTTP');
    expect(error.status).toBe(404);
    expect(error.response).toEqual({
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
    expect(error.body).toBe('Error body');
    expect(error.errorData).toBe(errorData);
  });

  it('HttpCommandError.parse() produces PARSE code', () => {
    const response = new Response('Invalid JSON', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const cause = new SyntaxError('Unexpected token');

    const error = HttpCommandError.parse({
      request: mockRequest,
      response,
      cause,
      body: 'Invalid JSON',
    });

    expect(error.code).toBe('PARSE');
    expect(error.cause).toBe(cause);
  });

  it('HttpCommandError.transport() produces TRANSPORT code', () => {
    const cause = new Error('Network timeout');
    const error = HttpCommandError.transport({
      request: mockRequest,
      cause,
    });

    expect(error.code).toBe('TRANSPORT');
    expect(error.cause).toBe(cause);
  });

  it('supports timeout and cancelled error variants', () => {
    const timeoutError = HttpCommandError.timeout({
      request: mockRequest,
      timeoutMs: 250,
    });
    const cancelledError = HttpCommandError.cancelled({
      request: mockRequest,
    });

    expect(timeoutError.code).toBe('TIMEOUT');
    expect(timeoutError.message).toBe('Timeout after 250ms');
    expect(cancelledError.code).toBe('CANCELLED');
    expect(cancelledError.message).toBe('Request cancelled');
  });

  it('isHttpCommandError detects known errors and rejects unknown values', () => {
    const error = HttpCommandError.transport({
      request: mockRequest,
      cause: new Error('boom'),
    });

    expect(isHttpCommandError(error)).toBe(true);
    expect(isHttpCommandError(new Error('Regular error'))).toBe(false);
    expect(isHttpCommandError(null)).toBe(false);
    expect(isHttpCommandError(undefined)).toBe(false);
    expect(isHttpCommandError('error')).toBe(false);
  });
});
