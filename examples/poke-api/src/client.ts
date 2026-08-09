import {
  createClient,
  type Client,
  type Defaults,
  type Handler,
  type Middleware,
  type UrlResolver,
} from '@hsblabs/http-command';

import type { PokeAPIScope } from './scope.js';

export type PokeAPIClient = Client<PokeAPIScope>;

export type PokeAPIClientOptions = Readonly<{
  baseUrl?: string;
  resolveUrl?: UrlResolver;
  handler?: Handler;
  middleware?: ReadonlyArray<Middleware>;
  defaults?: Defaults;
}>;

export function createPokeAPIClient(
  options: PokeAPIClientOptions = {},
): PokeAPIClient {
  return createClient<PokeAPIScope>({
    baseUrl: options.baseUrl ?? 'https://pokeapi.co/api/v2',
    resolveUrl: options.resolveUrl,
    handler: options.handler,
    middleware: options.middleware,
    defaults: options.defaults,
  });
}
