import type { QueryPrimitive, QueryValue } from './types';

const ABSOLUTE_URL = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const PROTOCOL_RELATIVE_URL = /^\/\/[^/?#]/;

type UrlParts = {
  path: string;
  query: string;
  hash: string;
  hasQuery: boolean;
  hasHash: boolean;
};

function splitUrl(value: string): UrlParts {
  const hashIndex = value.indexOf('#');
  const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const queryIndex = beforeHash.indexOf('?');

  return {
    path: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash,
    query: queryIndex >= 0 ? beforeHash.slice(queryIndex) : '',
    hash,
    hasQuery: queryIndex >= 0,
    hasHash: hashIndex >= 0,
  };
}

function joinPathPrefix(basePath: string, operationPath: string): string {
  if (!operationPath) return basePath;
  if (!basePath) return operationPath;

  let baseEnd = basePath.length;
  while (baseEnd > 0 && basePath[baseEnd - 1] === '/') baseEnd -= 1;

  let operationStart = 0;
  while (operationPath[operationStart] === '/') operationStart += 1;

  const normalizedBase = basePath.slice(0, baseEnd);
  const normalizedOperation = operationPath.slice(operationStart);

  if (!normalizedOperation) return `${normalizedBase}/`;
  return `${normalizedBase}/${normalizedOperation}`;
}

/**
 * Resolves an operation URL against a base URL while preserving the base path
 * as an API prefix. Absolute operation URLs bypass the base URL.
 */
export function resolveUrl(
  baseUrl: string | undefined,
  operationUrl: string,
): string {
  if (!baseUrl) return operationUrl;

  const base = splitUrl(baseUrl);
  if (base.hasQuery || base.hasHash) {
    throw new TypeError(
      'baseUrl must not include a query string or fragment.',
    );
  }

  if (ABSOLUTE_URL.test(operationUrl)) return operationUrl;

  if (PROTOCOL_RELATIVE_URL.test(operationUrl)) {
    return ABSOLUTE_URL.test(baseUrl)
      ? new URL(operationUrl, baseUrl).toString()
      : operationUrl;
  }

  const operation = splitUrl(operationUrl);
  const path = joinPathPrefix(base.path, operation.path);
  const query = operation.hasQuery ? operation.query : base.query;
  const hash = operation.hasHash ? operation.hash : base.hash;

  return `${path}${query}${hash}`;
}

function appendQueryValue(
  params: URLSearchParams,
  key: string,
  value: QueryValue,
): void {
  if (value == null) return;

  if (Array.isArray(value)) {
    params.delete(key);
    for (const item of value) {
      if (item != null) params.append(key, String(item));
    }
    return;
  }

  params.set(key, String(value as QueryPrimitive));
}

export function appendQuery(
  url: string,
  query?: Readonly<Record<string, QueryValue>>,
): string {
  if (!query) return url;

  const hashIdx = url.indexOf('#');
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';

  const qIdx = base.indexOf('?');
  const path = qIdx >= 0 ? base.slice(0, qIdx) : base;
  const existing = qIdx >= 0 ? base.slice(qIdx + 1) : '';

  const params = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(params, key, value);
  }

  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash}`;
}

/** Encodes one dynamic path segment. RequestDescriptor.url itself is not encoded. */
export function encodePathSegment(value: QueryPrimitive): string {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
