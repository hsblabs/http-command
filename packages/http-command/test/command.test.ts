import { describe, expect, test } from 'vitest';

import { defineCommand, defineJsonCommand } from '../src/command';
import type { RequestDescriptor } from '../src/types';

type GetUserInput = { id: string };
type GetUserOutput = { id: string; name: string; email: string };

type CreateUserInput = { name: string; email: string };
type CreateUserOutput = { id: string; name: string; email: string };

function assertRequestBodyContract(): void {
  // @ts-expect-error A request must use either body or bodyFactory.
  const request: RequestDescriptor = {
    method: 'POST',
    url: '/invalid',
    body: 'static',
    bodyFactory: () => 'recreated',
  };
  void request;
}

void assertRequestBodyContract;

describe('defineCommand', () => {
  test('creates a command factory with type inference', () => {
    const getUser = defineCommand({
      build: (input: GetUserInput) => ({
        method: 'GET',
        url: `/users/${input.id}`,
      }),
      parseData: (response): Promise<GetUserOutput> => response.json(),
    });

    const command = getUser({ id: 'u_123' });

    expect(command).toHaveProperty('request');
    expect(command).toHaveProperty('parseData');
    expect(command.request).toEqual({
      method: 'GET',
      url: '/users/u_123',
    });
  });

  test('build is consumed at factory call time', () => {
    const getUser = defineCommand({
      build: (input: GetUserInput) => ({
        method: 'GET',
        url: `/users/${input.id}`,
      }),
      parseData: (response): Promise<GetUserOutput> => response.json(),
    });

    const command = getUser({ id: 'u_456' });
    expect(command.request.url).toBe('/users/u_456');
    expect(command.request.method).toBe('GET');
  });

  test('parseData receives only the response', async () => {
    const getUser = defineCommand({
      build: (input: GetUserInput) => ({
        method: 'GET',
        url: `/users/${input.id}`,
      }),
      parseData: async (response): Promise<GetUserOutput> => response.json(),
    });

    const command = getUser({ id: 'u_789' });
    const mockResponse = new Response(
      JSON.stringify({
        id: 'u_789',
        name: 'John Doe',
        email: 'john@example.com',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

    const result = await command.parseData(mockResponse);
    expect(result).toEqual({
      id: 'u_789',
      name: 'John Doe',
      email: 'john@example.com',
    });
  });

  test('works with POST requests and request body', () => {
    const createUser = defineCommand({
      build: (input: CreateUserInput) => ({
        method: 'POST',
        url: '/users',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
      parseData: (response): Promise<CreateUserOutput> => response.json(),
    });

    const command = createUser({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });

    expect(command.request).toEqual({
      method: 'POST',
      url: '/users',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Jane Doe',
        email: 'jane@example.com',
      }),
    });
  });

  test('works with query parameters', () => {
    type ListUsersInput = { limit?: number; offset?: number };

    const listUsers = defineCommand({
      build: (input: ListUsersInput) => ({
        method: 'GET',
        url: '/users',
        query: {
          limit: input.limit,
          offset: input.offset,
        },
      }),
      parseData: (response) => response.json(),
    });

    const command = listUsers({ limit: 10, offset: 20 });
    expect(command.request.query).toEqual({ limit: 10, offset: 20 });
  });

  test('supports synchronous parseData', () => {
    const echoCommand = defineCommand({
      build: (input: { message: string }) => ({
        method: 'GET',
        url: `/echo?msg=${input.message}`,
      }),
      parseData: (): { echo: string } => {
        return { echo: 'processed' };
      },
    });

    const command = echoCommand({ message: 'hello' });
    const result = command.parseData(new Response());

    expect(result).toEqual({ echo: 'processed' });
  });

  test('multiple command factories are independent', () => {
    const getUser = defineCommand({
      build: (input: GetUserInput) => ({
        method: 'GET',
        url: `/users/${input.id}`,
      }),
      parseData: (response): Promise<GetUserOutput> => response.json(),
    });

    const createUser = defineCommand({
      build: (input: CreateUserInput) => ({
        method: 'POST',
        url: '/users',
        body: JSON.stringify(input),
      }),
      parseData: (response): Promise<CreateUserOutput> => response.json(),
    });

    const getUserCmd = getUser({ id: 'u_1' });
    const createUserCmd = createUser({
      name: 'Test',
      email: 'test@example.com',
    });

    expect(getUserCmd.request.method).toBe('GET');
    expect(createUserCmd.request.method).toBe('POST');
  });

  test('supports command-level defaults', () => {
    const getUser = defineCommand({
      defaults: {
        timeoutMs: 1000,
        headers: { 'x-op': '1' },
        meta: { op: true },
      },
      build: (input: GetUserInput) => ({
        method: 'GET',
        url: `/users/${input.id}`,
      }),
      parseData: (response): Promise<GetUserOutput> => response.json(),
    });

    const command = getUser({ id: 'u_1' });
    expect(command.defaults).toEqual({
      timeoutMs: 1000,
      headers: { 'x-op': '1' },
      meta: { op: true },
    });
  });

  test('forwards parseError to the command', async () => {
    const getUser = defineCommand({
      build: (input: GetUserInput) => ({
        method: 'GET',
        url: `/users/${input.id}`,
      }),
      parseData: (response): Promise<GetUserOutput> => response.json(),
      parseError: async (response) => ({ message: await response.text() }),
    });

    const command = getUser({ id: 'missing' });
    const result = await command.parseError?.(
      new Response('not found', { status: 404 }),
    );

    expect(result).toEqual({ message: 'not found' });
  });
});

describe('defineJsonCommand', () => {
  test('parses response.json() by default', async () => {
    type PingOutput = { ok: boolean };

    const ping = defineJsonCommand<object, PingOutput>({
      build: () => ({ method: 'GET', url: '/ping' }),
    });

    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const result = await ping({}).parseData(response);
    expect(result).toEqual({ ok: true });
  });

  test('handles 204 No Content gracefully', async () => {
    const deleteItem = defineJsonCommand<{ id: string }, void>({
      build: (input) => ({ method: 'DELETE', url: `/items/${input.id}` }),
    });

    const response = new Response(null, { status: 204 });
    const result = await deleteItem({ id: '1' }).parseData(response);
    expect(result).toBeUndefined();
  });

  test('handles response with content-length 0', async () => {
    const ping = defineJsonCommand<object, void>({
      build: () => ({ method: 'POST', url: '/ping' }),
    });

    const response = new Response('', {
      status: 200,
      headers: { 'content-length': '0' },
    });
    const result = await ping({}).parseData(response);
    expect(result).toBeUndefined();
  });

  test('handles an explicit null body on a successful response', async () => {
    const ping = defineJsonCommand<object, void>({
      build: () => ({ method: 'GET', url: '/ping' }),
    });

    const response = new Response(null, { status: 200 });
    const result = await ping({}).parseData(response);

    expect(result).toBeUndefined();
  });

  test('supports custom transform', async () => {
    type Pokemon = { name: string };

    const getPokemon = defineJsonCommand({
      build: (input: { name: string }) => ({
        method: 'GET',
        url: `/pokemon/${input.name}`,
      }),
      transform: (json) => json as Pokemon,
    });

    const response = new Response(JSON.stringify({ name: 'pikachu' }), {
      status: 200,
    });

    const result = await getPokemon({ name: 'pikachu' }).parseData(response);
    expect(result).toEqual({ name: 'pikachu' });
  });

  test('handles 205 Reset Content gracefully', async () => {
    const reset = defineJsonCommand<object, void>({
      build: () => ({ method: 'POST', url: '/reset' }),
    });

    const response = new Response(null, { status: 205 });
    await expect(reset({}).parseData(response)).resolves.toBeUndefined();
  });

  test('forwards parseError from JSON command definitions', async () => {
    const ping = defineJsonCommand<object, { ok: boolean }>({
      build: () => ({ method: 'GET', url: '/ping' }),
      parseError: (response) => response.json(),
    });

    const command = ping({});
    const result = await command.parseError?.(
      new Response('{"code":"NOPE"}', { status: 400 }),
    );

    expect(result).toEqual({ code: 'NOPE' });
  });
});
