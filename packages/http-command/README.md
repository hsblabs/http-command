# @hsblabs/http-command

`@hsblabs/http-command` is a small TypeScript runtime for authors of typed HTTP SDKs. It provides a client factory, an invariant command protocol, middleware composition, Fetch-based transport, and normalized errors. Service-specific endpoints, schemas, authentication policy, and generated code stay in the SDK package.

**English** | [日本語](./docs/README/ja.md) | [Français](./docs/README/fr.md) | [Deutsch](./docs/README/de.md) | [简体中文](./docs/README/zh-CN.md) | [繁體中文](./docs/README/zh-TW.md)

## Features

- `client.send(command)` execution model
- `Client<Scope>` and `Command<Scope, Output>` service boundaries
- Function-based command factories with input and output inference
- API-prefix URL resolution with an SDK-defined resolver override
- Scalar and repeated-key query serialization
- Explicit dynamic path-segment encoding
- Separate success and service-error decoders
- Replay-aware request bodies and retry middleware
- Injectable handler for tests and non-Fetch transports
- ESM-only package with no runtime dependencies

## Installation

```bash
npm install @hsblabs/http-command
```

```bash
pnpm add @hsblabs/http-command
```

## Minimal Example

The default scope is sufficient when commands and clients do not need to be separated by service.

```ts
import {
  createClient,
  defineCommand,
  encodePathSegment,
} from '@hsblabs/http-command';

type User = Readonly<{
  id: string;
  name: string;
}>;

const getUser = defineCommand({
  build: (input: Readonly<{ id: string }>) => ({
    method: 'GET',
    url: `/users/${encodePathSegment(input.id)}`,
  }),
  parseData: (response): Promise<User> => response.json(),
});

const client = createClient({
  baseUrl: 'https://api.example.com/v1',
});

const user = await client.send(getUser({ id: 'u_1' }));
```

The default resolver treats `baseUrl` as an API prefix, so the request above is sent to `https://api.example.com/v1/users/u_1`.

## Defining a Scoped SDK

A service SDK should define one private `unique symbol` type and use it for both its client and commands. This prevents a command from another SDK from being sent through the wrong client during type checking. Scoped command values carry a declaration-only brand, so create them through the bound `defineCommand<Scope>()` or `defineJsonCommand<Scope>()` definer rather than as object literals.

```ts
import {
  createClient,
  defineCommand,
  encodePathSegment,
  type Client,
  type ClientConfig,
} from '@hsblabs/http-command';

declare const POKE_API_SCOPE: unique symbol;
type PokeAPIScope = typeof POKE_API_SCOPE;

export type PokeAPIClient = Client<PokeAPIScope>;
export type PokeAPIClientOptions = Omit<
  ClientConfig<PokeAPIScope>,
  'baseUrl'
> & {
  baseUrl?: string;
};

const definePokeAPICommand = defineCommand<PokeAPIScope>();

export const getPokemon = definePokeAPICommand({
  build: (input: Readonly<{ nameOrId: string | number }>) => ({
    method: 'GET',
    url: `/pokemon/${encodePathSegment(input.nameOrId)}`,
  }),
  parseData: (response): Promise<{ id: number; name: string }> =>
    response.json(),
  parseError: (response) => response.json(),
});

export function createPokeAPIClient(
  options: PokeAPIClientOptions = {},
): PokeAPIClient {
  return createClient<PokeAPIScope>({
    ...options,
    baseUrl: options.baseUrl ?? 'https://pokeapi.co/api/v2',
  });
}
```

SDK consumers use only the exported factory and commands.

```ts
import {
  createPokeAPIClient,
  getPokemon,
} from 'poke-api-ts-sdk';

const client = createPokeAPIClient({
  middleware: [],
});

const pokemon = await client.send(
  getPokemon({ nameOrId: 1 }),
);
```

Scopes are compile-time identifiers, not runtime authorization boundaries. SDKs that attach credentials should also enforce an allowed origin in their URL resolver when commands may contain absolute URLs.

## URL and Parameter Semantics

The default `resolveUrl(baseUrl, operationUrl)` contract is fixed as follows:

- A relative operation URL is joined to `baseUrl` while preserving the complete base path as an API prefix.
- Leading and trailing slashes at the join boundary are normalized.
- An absolute operation URL bypasses `baseUrl`.
- A protocol-relative operation URL such as `//uploads.example.com/file` uses the scheme of an absolute base URL; three or more leading slashes are treated as operation-path slashes and normalized at the join boundary.
- `baseUrl` must not contain a query string or fragment.
- A query string or fragment already present in the operation URL is preserved.
- With no `baseUrl`, the operation URL is returned unchanged.

An SDK author can replace this policy through `ClientConfig.resolveUrl`. `RequestDescriptor.query` is merged into the resolver output afterward, before dispatch. If the resolver throws, the failure is normalized as `TRANSPORT`, retained in `error.cause`, and no request body is created or dispatched.

```ts
import {
  createClient,
  resolveUrl,
} from '@hsblabs/http-command';

const baseUrl = 'https://api.example.com/v1';

const client = createClient({
  baseUrl,
  resolveUrl: (base, operation) => {
    const resolved = resolveUrl(base, operation);
    if (new URL(resolved).origin !== new URL(baseUrl).origin) {
      throw new Error('Cross-origin commands are not allowed');
    }
    return resolved;
  },
});
```

`RequestDescriptor.query` accepts scalar values and readonly arrays. Arrays are encoded as repeated keys.

```ts
{
  query: {
    tag: ['typescript', 'sdk'],
    page: 2,
    preview: true,
    omitted: undefined,
  },
}
// ?tag=typescript&tag=sdk&page=2&preview=true
```

The exact rules are:

- `string`, `number`, and `boolean` values replace an existing value for the same key.
- Array values remove existing values and append each non-null item as a repeated key.
- An empty array removes an existing key.
- Scalar `null` and `undefined` values are omitted and leave an existing URL value unchanged.
- Query serialization uses `URLSearchParams`; spaces are therefore encoded as `+`.

`RequestDescriptor.url` is not automatically path-encoded because it contains structural delimiters. Encode each dynamic path parameter with `encodePathSegment()` before interpolation. The helper applies strict RFC 3986 percent encoding.

## Response and Error Decoding

Commands define separate decoders for successful and unsuccessful HTTP responses.

```ts
const getUser = defineCommand({
  build: (input: Readonly<{ id: string }>) => ({
    method: 'GET',
    url: `/users/${encodePathSegment(input.id)}`,
  }),
  parseData: (response): Promise<User> => response.json(),
  parseError: (response) => response.json(),
});
```

`parseData` receives the original successful `Response`, so it may return JSON, text, binary data, or a stream. A thrown decoder error becomes `HttpCommandError` with code `PARSE`. Its `body` field is best-effort because the decoder may already have consumed the response body.

For a non-2xx response, the client throws an `HttpCommandError` with code `HTTP`:

- `error.errorData` contains the value returned by `parseError`.
- `error.body` contains the raw response text when it can be read.
- If `parseError` throws, the HTTP error remains primary and the decoder failure is stored in `error.cause`.
- Response status and headers are retained in normalized form.

`parseError` receives a cloned response so raw text can be captured in parallel. It must finish decoding before it resolves; after settlement, the client best-effort cancels any unread cloned body. Do not return a live response-body stream from `parseError`.

```ts
import {
  isHttpCommandError,
} from '@hsblabs/http-command';

try {
  await client.send(getUser({ id: 'missing' }));
} catch (error) {
  if (isHttpCommandError(error) && error.code === 'HTTP') {
    console.error(error.status, error.errorData);
  }
  throw error;
}
```

`defineJsonCommand` provides the standard `response.json()` success decoder and accepts an optional `transform` function. It returns `undefined` for 204, 205, a null body, or an explicit `content-length: 0` response.

## Request Bodies and Retry

A request uses either a static `body` or a `bodyFactory`; the two fields are mutually exclusive.

```ts
const upload = defineCommand({
  build: (input: Readonly<{ createBody: () => ReadableStream }>) => ({
    method: 'PUT',
    url: '/upload',
    bodyFactory: ({ attempt, signal }) => {
      console.log(`creating body for attempt ${attempt}`);
      signal?.throwIfAborted();
      return input.createBody();
    },
  }),
  parseData: (response) => response.json(),
});
```

`RequestBody` accepts standard Fetch `BodyInit` values and Node-compatible `AsyncIterable<Uint8Array>` bodies. `bodyFactory` is called once before the first dispatch and again before every retry. Attempts are one-based, and the caller's `AbortSignal` is passed to the factory. Factory failures are normalized as `TRANSPORT`; abort-related failures are normalized as `CANCELLED`.

The built-in retry middleware does not retry a static stream-like body, even when a custom `shouldRetry` returns `true`, because the body cannot be replayed safely. Use `bodyFactory` to opt into retries for streams.

By default, retry:

- retries 429 and 5xx responses and transport failures;
- applies only to idempotent methods, or requests with an `Idempotency-Key` header;
- does not retry cancellation or timeout errors;
- respects `Retry-After`;
- cancels the discarded response body before the next attempt.

## Middleware Usage

Middleware wraps the handler in array order. The first middleware is the outermost layer for requests, and responses unwind in reverse order.

```ts
import {
  bearerAuth,
  createClient,
  logger,
  retry,
} from '@hsblabs/http-command';

const client = createClient({
  baseUrl: 'https://api.example.com/v1',
  middleware: [
    bearerAuth(() => process.env.API_TOKEN ?? ''),
    retry({ maxAttempts: 3 }),
    logger((event) => {
      if (event.phase === 'response') {
        console.log(
          event.method,
          event.url,
          event.status,
          event.durationMs,
        );
      }
    }),
  ],
});
```

Defaults are merged in this order, with later values winning:

```text
client defaults < command defaults < send options
```

Header names are merged case-insensitively. `client.with(...middleware)` and `client.withDefaults(defaults)` return immutable derived clients.

## Creating Custom Middleware

A middleware is a function from `Handler` to `Handler`.

```ts
import {
  defineMiddleware,
  type Middleware,
} from '@hsblabs/http-command';

const timing: Middleware = defineMiddleware({
  before: (context) => ({
    ...context,
    meta: {
      ...context.meta,
      startedAt: Date.now(),
    },
  }),
  after: (result, context) => {
    const startedAt = context.meta.startedAt;
    if (typeof startedAt === 'number') {
      console.log(Date.now() - startedAt);
    }
    return result;
  },
});
```

Actions that perform I/O belong in handlers and middleware. Command `build`, URL helpers, and service decoders remain independently testable calculations.

## API Reference

### `createClient<Scope>(config?)`

Creates `Client<Scope>`. Relevant configuration fields are:

- `baseUrl?: string`
- `resolveUrl?: (baseUrl, operationUrl) => string`
- `handler?: Handler`
- `middleware?: ReadonlyArray<Middleware>`
- `defaults?: Defaults`

### `defineCommand(config)` / `defineCommand<Scope>()`

Creates a command factory. `build(input)` produces a `RequestDescriptor`; `parseData(response)` decodes a successful response; `parseError(response)` optionally decodes a service error response.

### `defineJsonCommand(config)` / `defineJsonCommand<Scope>()`

Creates a JSON command factory. It accepts `build`, optional `transform`, optional `parseError`, and command `defaults`.

### `client.send(command, options?)`

Resolves the request, executes the middleware pipeline, normalizes failures, and returns the value from `parseData`.

### `HttpCommandError`

Canonical codes are `HTTP`, `TRANSPORT`, `PARSE`, `TIMEOUT`, and `CANCELLED`. Diagnostic fields include `request`, `status`, `response`, `body`, `errorData`, and `cause`.

### Public extension types

`ClientConfig`, `CommandConfig`, `JsonCommandConfig`, `RequestDescriptor`, `RequestBody`, `Handler`, `Context`, `Middleware`, `Defaults`, `SendOptions`, `UrlResolver`, `BodyFactory`, and `BodyFactoryContext` are exported for SDK and middleware authors.

## Development

Architecture decisions are tracked in [docs/adr](./docs/adr/README.md). README localization rules are documented in [docs/README/SYNC.md](./docs/README/SYNC.md).

```bash
pnpm install
pnpm run check
pnpm run pack:dry-run
```

The README structure check can also be run without workspace dependencies:

```bash
npm run docs:check
```

## License

MIT
