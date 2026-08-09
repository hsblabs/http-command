import { describe, expect, test } from 'vitest';

import { hasHeader, mergeHeaders } from '../src/headers';

describe('header helpers', () => {
  test('mergeHeaders resolves conflicts case-insensitively with latest value', () => {
    const merged = mergeHeaders(
      { Authorization: 'Bearer a', 'x-trace-id': 'trace-a' },
      { authorization: 'Bearer b' },
      { 'X-Trace-Id': 'trace-b' },
    );

    expect(merged).toEqual({
      authorization: 'Bearer b',
      'X-Trace-Id': 'trace-b',
    });
  });

  test('hasHeader matches header names case-insensitively', () => {
    const headers = { Authorization: 'Bearer token' };

    expect(hasHeader(headers, 'authorization')).toBe(true);
    expect(hasHeader(headers, 'Authorization')).toBe(true);
    expect(hasHeader(headers, 'x-missing')).toBe(false);
  });
});
