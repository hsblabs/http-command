import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

type PackageJson = {
  main?: string;
  exports?: { '.': { types?: string; default?: string } };
};

describe('package configuration', () => {
  test('is published as ESM only', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as PackageJson;

    expect(packageJson.main).toBe('dist/index.mjs');
    expect(packageJson.exports?.['.']).toEqual({
      types: './dist/index.d.mts',
      default: './dist/index.mjs',
    });
  });
});
