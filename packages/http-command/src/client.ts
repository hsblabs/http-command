import { HttpCommandError, isAbortError, isHttpCommandError } from './error';
import { mergeHeaders } from './headers';
import { fetchTransport } from './transport';
import { appendQuery, resolveUrl as defaultResolveUrl } from './url';
import type {
  BodyFactory,
  Client,
  ClientConfig,
  Command,
  DefaultScope,
  Defaults,
  Handler,
  HttpRequest,
  Middleware,
  RequestDescriptor,
  SendOptions,
  UrlResolver,
} from './types';

function compose(
  handler: Handler,
  middleware: ReadonlyArray<Middleware>,
): Handler {
  return middleware.reduceRight((next, item) => item(next), handler);
}

function mergeDefaults(
  base?: Defaults,
  override?: Defaults,
): Defaults | undefined {
  if (!base && !override) return undefined;

  const headers = mergeHeaders(base?.headers, override?.headers);
  const meta = { ...(base?.meta ?? {}), ...(override?.meta ?? {}) };

  const result: Defaults = {
    timeoutMs: override?.timeoutMs ?? base?.timeoutMs,
  };
  if (Object.keys(headers).length > 0) result.headers = headers;
  if (Object.keys(meta).length > 0) result.meta = meta;
  return result;
}

type BuiltRequest = {
  request: HttpRequest;
  bodyFactory?: BodyFactory;
};

async function buildRequest(
  baseUrl: string | undefined,
  resolveUrl: UrlResolver,
  descriptor: RequestDescriptor,
  extraHeaders: Readonly<Record<string, string>>,
  signal: AbortSignal | undefined,
): Promise<BuiltRequest> {
  const headers = mergeHeaders(descriptor.headers, extraHeaders);
  let url: string;

  try {
    url = appendQuery(
      resolveUrl(baseUrl, descriptor.url),
      descriptor.query,
    );
  } catch (cause) {
    throw HttpCommandError.transport({
      request: {
        method: descriptor.method,
        url: descriptor.url,
        headers,
      },
      cause,
      message: 'Request URL resolution failed',
    });
  }

  const request: HttpRequest = {
    method: descriptor.method,
    url,
    headers,
  };
  const bodyFactory = descriptor.bodyFactory;

  try {
    const body = bodyFactory
      ? await bodyFactory({ attempt: 1, signal })
      : descriptor.body;
    if (body !== undefined) request.body = body;
  } catch (cause) {
    if (signal?.aborted || isAbortError(cause)) {
      throw HttpCommandError.cancelled({ request, cause });
    }
    throw HttpCommandError.transport({
      request,
      cause,
      message: 'Request body creation failed',
    });
  }

  return bodyFactory ? { request, bodyFactory } : { request };
}

async function readBody(
  response: Response,
): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Best effort. A parser may already have consumed or locked the body.
  }
}

async function createHttpError<Scope, Output>(
  request: HttpRequest,
  response: Response,
  command: Command<Scope, Output>,
): Promise<HttpCommandError> {
  let parserResponse: Response | undefined;
  let cause: unknown;

  if (command.parseError) {
    try {
      parserResponse = response.clone();
    } catch (error) {
      // Keep the HTTP response as the primary failure even if middleware has
      // already consumed or locked its body.
      cause = error;
    }
  }

  const bodyPromise = readBody(response);
  let errorData: unknown;

  if (command.parseError && parserResponse) {
    try {
      errorData = await command.parseError(parserResponse);
    } catch (error) {
      cause = error;
    } finally {
      await cancelBody(parserResponse);
    }
  }

  return HttpCommandError.http({
    request,
    response,
    body: await bodyPromise,
    errorData,
    cause,
  });
}

export function createClient<Scope = DefaultScope>(
  config: ClientConfig<Scope> = {},
): Client<Scope> {
  const middleware = config.middleware ?? [];
  const pipeline = compose(config.handler ?? fetchTransport, middleware);
  const urlResolver = config.resolveUrl ?? defaultResolveUrl;

  const send = async <Output>(
    command: Command<Scope, Output>,
    options?: SendOptions,
  ): Promise<Output> => {
    const defaults = mergeDefaults(config.defaults, command.defaults);
    const headers = mergeHeaders(defaults?.headers, options?.headers);
    const meta = {
      ...(defaults?.meta ?? {}),
      ...(options?.meta ?? {}),
    };
    const timeoutMs = options?.timeoutMs ?? defaults?.timeoutMs;
    const signal = options?.signal;

    const { request, bodyFactory } = await buildRequest(
      config.baseUrl,
      urlResolver,
      command.request,
      headers,
      signal,
    );

    let response: Response;
    try {
      const result = await pipeline({
        request,
        signal,
        timeoutMs,
        attempt: 1,
        meta,
        bodyFactory,
      });
      response = result.response;
    } catch (error) {
      if (isHttpCommandError(error)) throw error;
      if (signal?.aborted || isAbortError(error)) {
        throw HttpCommandError.cancelled({ request, cause: error });
      }
      throw HttpCommandError.transport({ request, cause: error });
    }

    if (!response.ok) {
      throw await createHttpError(request, response, command);
    }

    try {
      return await command.parseData(response);
    } catch (error) {
      if (isHttpCommandError(error)) throw error;
      throw HttpCommandError.parse({
        request,
        response,
        cause: error,
        body: await readBody(response),
      });
    }
  };

  return {
    send,
    with: (...items) =>
      createClient<Scope>({
        ...config,
        middleware: [...middleware, ...items],
      }),
    withDefaults: (defaults) =>
      createClient<Scope>({
        ...config,
        middleware,
        defaults: mergeDefaults(config.defaults, defaults),
      }),
  };
}
