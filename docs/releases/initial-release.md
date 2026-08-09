---
title: Initial npm release
status: package-published
date: 2026-08-09
---

# Initial npm release

`@hsblabs/http-command@0.1.0` and `@hsblabs/http-cli@0.1.0` are published, and both release tags are on GitHub. Repository hardening and trusted publishing remain.

The first release is manual because the npm packages must exist before trusted publishing can be configured. Do not make the GitHub repository public until both `0.1.0` packages are available on npm.

## 1. Commit and push the private repository

The release workflow is skipped while the repository is private and while `NPM_TRUSTED_PUBLISHING_ENABLED` is unset.

## 2. Validate the release artifacts

```bash
pnpm install --frozen-lockfile
pnpm run release:check
```

This checks source, tests, builds, dry-run package contents, actual tarballs, the packed CLI dependency, and clean consumer imports.

## 3. Authenticate and publish manually

```bash
npm login
npm whoami
pnpm run release
```

`pnpm run release` repeats the full release gate before `changeset publish`. Both packages use public access. Publishing is not atomic: if core succeeds and CLI fails, run the same command again to publish only the missing package.

The private-repository manual release has no npm provenance statement. Later OIDC releases generate provenance after the repository is public.

Verify both registry entries before continuing.

```bash
npm view @hsblabs/http-command@0.1.0 version
npm view @hsblabs/http-cli@0.1.0 version
```

## 4. Make the repository public

Change `hsblabs/http-command` from private to public only after both registry checks succeed.

## 5. Configure trusted publishing

In the npm settings for each package, add the same GitHub Actions trusted publisher:

- Organization: `hsblabs`
- Repository: `http-command`
- Workflow filename: `release.yml`
- Allowed action: npm publish

Then enable GitHub Actions to create pull requests and set the repository variable:

```bash
gh variable set NPM_TRUSTED_PUBLISHING_ENABLED --body true --repo hsblabs/http-command
```

Do not add `NPM_TOKEN`. The workflow uses OIDC through npm trusted publishing. After verification, configure npm publishing access to require two-factor authentication and disallow token-based publishing.

## 6. Later releases

Add a Changeset to each change. Pushes to `main` maintain a Release PR; merging that PR publishes both fixed-group packages at the same version and creates GitHub Releases.

References:

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [Changesets action](https://github.com/changesets/action)
- [Changesets fixed packages](https://changesets.dev/guide/fixed-packages)
