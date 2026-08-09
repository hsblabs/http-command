import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const scratch = path.join(root, '.context', 'package-check');
const artifacts = path.join(scratch, 'artifacts');
const consumer = path.join(scratch, 'consumer');

const run = (command, args, cwd = root, env = process.env) =>
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });

const capture = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: 'utf8' });

const fail = (message) => {
  throw new Error(`Packed package check: ${message}`);
};

await rm(scratch, { recursive: true, force: true });
await mkdir(artifacts, { recursive: true });
await mkdir(consumer, { recursive: true });

for (const name of ['@hsblabs/http-command', '@hsblabs/http-cli']) {
  run('pnpm', ['--filter', name, 'pack', '--pack-destination', artifacts]);
}

const tarballs = (await readdir(artifacts))
  .filter((name) => name.endsWith('.tgz'))
  .map((name) => path.join(artifacts, name));
if (tarballs.length !== 2) fail(`expected two tarballs, found ${tarballs.length}`);

const allowedEntries = new Set([
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  'package/CHANGELOG.md',
  'package/dist/index.mjs',
  'package/dist/index.d.mts',
]);
const packed = new Map();

for (const tarball of tarballs) {
  const entries = capture('tar', ['-tzf', tarball])
    .trim()
    .split('\n')
    .filter(Boolean);
  const unexpected = entries.filter((entry) => !allowedEntries.has(entry));
  const missing = [...allowedEntries].filter((entry) => !entries.includes(entry));
  if (unexpected.length > 0 || missing.length > 0) {
    fail(
      `${path.basename(tarball)} content mismatch; unexpected=${unexpected.join(',') || 'none'} missing=${missing.join(',') || 'none'}`,
    );
  }

  const packageJson = JSON.parse(
    capture('tar', ['-xOzf', tarball, 'package/package.json']),
  );
  packed.set(packageJson.name, { packageJson, tarball });
}

const command = packed.get('@hsblabs/http-command');
const cli = packed.get('@hsblabs/http-cli');
if (!command || !cli) fail('expected package names were not packed');
if (command.packageJson.version !== cli.packageJson.version) {
  fail('packed package versions differ');
}
if (
  cli.packageJson.dependencies?.['@hsblabs/http-command'] !==
  command.packageJson.version
) {
  fail('packed CLI dependency does not match the core package version');
}

await writeFile(
  path.join(consumer, 'package.json'),
  `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
);
await writeFile(path.join(scratch, 'npmrc'), '');
await writeFile(
  path.join(consumer, 'index.mjs'),
  `import { createClient } from '@hsblabs/http-command';
import { httpCLI } from '@hsblabs/http-cli';

if (typeof createClient !== 'function' || typeof httpCLI !== 'function') {
  throw new Error('Packed runtime exports are missing');
}
`,
);
await writeFile(
  path.join(consumer, 'index.ts'),
  `import { createClient, defineCommand } from '@hsblabs/http-command';
import { defineCLICommand, httpCLI } from '@hsblabs/http-cli';

declare const SERVICE: unique symbol;
type Service = typeof SERVICE;

const defineServiceCommand = defineCommand<Service>();
const getValue = defineServiceCommand({
  build: () => ({ method: 'GET', url: '/value' }),
  parseData: (response): Promise<{ value: string }> => response.json(),
});

httpCLI<Service>()
  .bindClient(() => createClient<Service>())
  .command(defineCLICommand({ name: 'get', run: () => getValue({}) }));
`,
);

const installEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.toLowerCase().startsWith('npm_config_'),
  ),
);
installEnv.NPM_CONFIG_USERCONFIG = path.join(scratch, 'npmrc');
run(
  'npm',
  [
    'install',
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    command.tarball,
    cli.tarball,
  ],
  consumer,
  installEnv,
);
run('node', ['index.mjs'], consumer);
run('pnpm', [
  '--filter',
  '@hsblabs/http-command',
  'exec',
  'tsc',
  '--ignoreConfig',
  '--noEmit',
  '--strict',
  '--skipLibCheck',
  '--target',
  'ES2022',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  '--lib',
  'ES2022,DOM',
  path.join(consumer, 'index.ts'),
]);

const installedCli = JSON.parse(
  await readFile(
    path.join(consumer, 'node_modules', '@hsblabs', 'http-cli', 'package.json'),
    'utf8',
  ),
);
if (installedCli.version !== command.packageJson.version) {
  fail('consumer installed an unexpected CLI version');
}

console.log(`Packed package consumer OK: ${command.packageJson.version}`);
