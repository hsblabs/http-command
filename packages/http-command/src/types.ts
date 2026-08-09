declare const DEFAULT_SCOPE: unique symbol;
declare const SCOPE_INVARIANT: unique symbol;

export type DefaultScope = typeof DEFAULT_SCOPE;

type ScopeVariance<Scope> = (scope: Scope) => Scope;

type ScopeCarrier<Scope> = {
  readonly [SCOPE_INVARIANT]?: ScopeVariance<Scope>;
};

type CommandScope<Scope> = [Scope] extends [DefaultScope]
  ? ScopeCarrier<Scope>
  : { readonly [SCOPE_INVARIANT]: ScopeVariance<Scope> };

export type QueryPrimitive = string | number | boolean;
export type QueryValue =
  | QueryPrimitive
  | ReadonlyArray<QueryPrimitive | null | undefined>
  | null
  | undefined;

export type RequestBody = BodyInit | AsyncIterable<Uint8Array>;

export type BodyFactoryContext = {
  attempt: number;
  signal?: AbortSignal;
};

export type BodyFactory = (
  context: BodyFactoryContext,
) =>
  | RequestBody
  | null
  | undefined
  | Promise<RequestBody | null | undefined>;

type RequestBodyDescriptor =
  | {
      body?: RequestBody | null;
      bodyFactory?: never;
    }
  | {
      body?: never;
      bodyFactory: BodyFactory;
    };

export type RequestDescriptor = {
  method: string;
  url: string;
  query?: Readonly<Record<string, QueryValue>>;
  headers?: Readonly<Record<string, string>>;
} & RequestBodyDescriptor;

export type HttpRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: RequestBody | null;
};

export type Defaults = {
  timeoutMs?: number;
  headers?: Readonly<Record<string, string>>;
  meta?: Readonly<Record<string, unknown>>;
};

export type SendOptions = Defaults & {
  signal?: AbortSignal;
};

export type Context = {
  request: HttpRequest;
  signal?: AbortSignal;
  timeoutMs?: number;
  attempt: number;
  meta: Record<string, unknown>;
  bodyFactory?: BodyFactory;
};

export type Handler = (context: Context) => Promise<{ response: Response }>;

export type Middleware = (next: Handler) => Handler;

export type MiddlewareHooks = {
  before?: (context: Context) => Context | void | Promise<Context | void>;
  after?: (
    result: { response: Response },
    context: Context,
  ) => { response: Response } | void | Promise<{ response: Response } | void>;
  onError?: (
    error: unknown,
    context: Context,
  ) => { response: Response } | void | Promise<{ response: Response } | void>;
};

export type ResponseParser<T> = (
  response: Response,
) => T | Promise<T>;

export type Command<Scope, Output> = CommandScope<Scope> & {
  request: RequestDescriptor;
  defaults?: Defaults;
  parseData: ResponseParser<Output>;
  parseError?: ResponseParser<unknown>;
};

export type CommandConfig<Scope, Input, Output> = ScopeCarrier<Scope> & {
  defaults?: Defaults;
  build: (input: Input) => RequestDescriptor;
  parseData: ResponseParser<Output>;
  parseError?: ResponseParser<unknown>;
};

export type JsonCommandConfig<Scope, Input, Output> = ScopeCarrier<Scope> & {
  defaults?: Defaults;
  build: (input: Input) => RequestDescriptor;
  transform?: (json: unknown) => Output | Promise<Output>;
  parseError?: ResponseParser<unknown>;
};

export type UrlResolver = (
  baseUrl: string | undefined,
  operationUrl: string,
) => string;

export type ClientConfig<Scope = DefaultScope> = ScopeCarrier<Scope> & {
  baseUrl?: string;
  resolveUrl?: UrlResolver;
  handler?: Handler;
  middleware?: ReadonlyArray<Middleware>;
  defaults?: Defaults;
};

export type Client<Scope = DefaultScope> = {
  send: <Output>(
    command: Command<Scope, Output>,
    options?: SendOptions,
  ) => Promise<Output>;
  with: (...middleware: Middleware[]) => Client<Scope>;
  withDefaults: (defaults: Defaults) => Client<Scope>;
};
