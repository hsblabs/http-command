import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageNames = ['@hsblabs/http-command', '@hsblabs/http-cli'];

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));

const [workspace, changesets, command, cli, mise, ciWorkflow, releaseWorkflow] = await Promise.all([
  readJson('package.json'),
  readJson('.changeset/config.json'),
  readJson('packages/http-command/package.json'),
  readJson('packages/http-cli/package.json'),
  readFile(path.join(root, 'mise.toml'), 'utf8'),
  readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8'),
  readFile(path.join(root, '.github/workflows/release.yml'), 'utf8'),
]);

const fail = (message) => {
  throw new Error(`Release configuration: ${message}`);
};

if (command.version !== cli.version) {
  fail(`package versions differ (${command.version} and ${cli.version})`);
}

const fixedGroup = changesets.fixed.find(
  (group) =>
    group.length === packageNames.length &&
    packageNames.every((name) => group.includes(name)),
);
if (!fixedGroup) {
  fail('both public packages must share one Changesets fixed group');
}

for (const packageJson of [command, cli]) {
  if (packageJson.publishConfig?.access !== 'public') {
    fail(`${packageJson.name} must publish with public access`);
  }
  if (packageJson.repository?.url !== 'git+https://github.com/hsblabs/http-command.git') {
    fail(`${packageJson.name} has the wrong repository URL`);
  }
  for (const file of ['dist', 'README.md', 'LICENSE', 'CHANGELOG.md']) {
    if (!packageJson.files?.includes(file)) {
      fail(`${packageJson.name} must include ${file}`);
    }
  }
}

if (cli.dependencies?.['@hsblabs/http-command'] !== 'workspace:*') {
  fail('@hsblabs/http-cli must depend on the matching workspace package');
}

const packageManager = workspace.packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/);
if (!packageManager || !packageManager[1].startsWith('10.')) {
  fail('pnpm 10 is required so Changesets publish delegates OIDC to npm CLI');
}

const misePnpm = mise.match(/^pnpm = "([^"]+)"$/m)?.[1];
if (misePnpm !== packageManager[1]) {
  fail('package.json and mise.toml must select the same pnpm version');
}

for (const required of [
  "github.event.repository.visibility == 'public'",
  "vars.NPM_TRUSTED_PUBLISHING_ENABLED == 'true'",
  'id-token: write',
  'changesets/action@',
]) {
  if (!releaseWorkflow.includes(required)) {
    fail(`release workflow is missing ${required}`);
  }
}
if (releaseWorkflow.includes('NPM_TOKEN')) {
  fail('release workflow must use OIDC instead of NPM_TOKEN');
}

const actionReferences = [ciWorkflow, releaseWorkflow].flatMap((workflow) =>
  [...workflow.matchAll(/^\s*- uses: ([^\s]+)/gm)].map((match) => match[1]),
);
if (actionReferences.length === 0 || actionReferences.some((reference) => !/@[0-9a-f]{40}$/.test(reference))) {
  fail('every GitHub Action must use a full commit SHA');
}

console.log(`Release configuration OK: ${packageNames.join(' + ')} ${command.version}`);
