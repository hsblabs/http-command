import { describe, expect, test } from 'vitest';

import {
  appendQuery,
  encodePathSegment,
  resolveUrl,
} from '../src/url';

describe('url helpers', () => {
  test('resolveUrl joins baseUrl and operation path as an API prefix', () => {
    expect(resolveUrl('https://api.example.com/v1', '/users')).toBe(
      'https://api.example.com/v1/users',
    );
    expect(resolveUrl('https://api.example.com/v1/', 'users')).toBe(
      'https://api.example.com/v1/users',
    );
  });

  test('resolveUrl preserves operation query and fragment', () => {
    expect(
      resolveUrl(
        'https://api.example.com/v1',
        '/users?active=true#top',
      ),
    ).toBe('https://api.example.com/v1/users?active=true#top');
    expect(
      resolveUrl('https://api.example.com/v1', '?active=true'),
    ).toBe('https://api.example.com/v1?active=true');
  });

  test('resolveUrl leaves an operation URL unchanged without a base URL', () => {
    expect(resolveUrl(undefined, '/users?active=true#top')).toBe(
      '/users?active=true#top',
    );
  });

  test('resolveUrl preserves absolute operation URLs', () => {
    expect(
      resolveUrl(
        'https://api.example.com/v1',
        'https://uploads.example.com/files',
      ),
    ).toBe('https://uploads.example.com/files');
  });

  test('resolveUrl rejects a base URL with query or fragment', () => {
    expect(() =>
      resolveUrl('https://api.example.com/v1?token=x', '/users'),
    ).toThrow('baseUrl must not include a query string or fragment.');
    expect(() =>
      resolveUrl('https://api.example.com/v1#section', '/users'),
    ).toThrow('baseUrl must not include a query string or fragment.');
    expect(() =>
      resolveUrl(
        'https://api.example.com/v1?token=x',
        'https://uploads.example.com/files',
      ),
    ).toThrow('baseUrl must not include a query string or fragment.');
  });

  test('resolveUrl uses the base scheme for protocol-relative URLs', () => {
    expect(
      resolveUrl(
        'https://api.example.com/v1',
        '//uploads.example.com/files/1',
      ),
    ).toBe('https://uploads.example.com/files/1');
  });

  test('resolveUrl treats three leading slashes as an operation path', () => {
    expect(
      resolveUrl('https://api.example.com/v1', '///users'),
    ).toBe('https://api.example.com/v1/users');
  });

  test('appendQuery appends scalar query and skips nullish values', () => {
    const url = appendQuery('https://api.example.com/users', {
      page: 2,
      enabled: true,
      skip: null,
      omit: undefined,
    });

    expect(url).toBe(
      'https://api.example.com/users?page=2&enabled=true',
    );
    expect(
      appendQuery('/users?keep=existing', {
        keep: undefined,
        missing: null,
      }),
    ).toBe('/users?keep=existing');
  });

  test('appendQuery leaves an existing value for scalar nullish input', () => {
    expect(appendQuery('/users?cursor=existing', { cursor: null })).toBe(
      '/users?cursor=existing',
    );
  });

  test('appendQuery serializes arrays as repeated keys', () => {
    const url = appendQuery('/users?tag=old&sort=desc#top', {
      tag: ['admin', null, 'active'],
      page: [1, 2],
      sort: 'asc',
    });

    expect(url).toBe(
      '/users?sort=asc&tag=admin&tag=active&page=1&page=2#top',
    );
  });

  test('appendQuery removes existing values for an explicit empty array', () => {
    expect(appendQuery('/users?tag=old&keep=1', { tag: [] })).toBe(
      '/users?keep=1',
    );
  });

  test('appendQuery works with relative URLs', () => {
    const url = appendQuery('/users', {
      page: 1,
      filter: 'active',
    });

    expect(url).toBe('/users?page=1&filter=active');
  });

  test('encodePathSegment encodes slash and RFC 3986 reserved punctuation', () => {
    expect(encodePathSegment("a/b c!'()*")).toBe(
      'a%2Fb%20c%21%27%28%29%2A',
    );
  });
});
