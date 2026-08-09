---
title: Initial public release
status: accepted
date: 2026-08-09
---

# Initial public release

## Goal

Publish `@hsblabs/http-command` and `@hsblabs/http-cli` as public npm packages at `0.1.0`, then keep both packages on one version line.

## Scope

- Keep the GitHub repository private through the first manual npm release.
- Publish both packages only when both pass the same release gate.
- Use a Changesets fixed group so every later release bumps both packages together.
- Prepare a GitHub Actions release flow that is inactive while the repository is private.
- After the repository becomes public, use npm trusted publishing with OIDC and no long-lived npm token.

Publishing packages, changing repository visibility, and configuring trusted publishers on npmjs.com are operator actions and are not performed by this implementation.

## Release states

```text
draft
  -> release-ready          all local checks and packed-package checks pass
  -> first-published        operator publishes 0.1.0 manually
  -> source-public          operator changes the GitHub repository to public
  -> oidc-configured        operator trusts the release workflow for both npm packages
  -> automated              Changesets Release PR merges publish through OIDC
```

The order is an invariant. The automated publish job must not run for a private repository or before the operator enables `NPM_TRUSTED_PUBLISHING_ENABLED`.

## Package contract

- Package names are `@hsblabs/http-command` and `@hsblabs/http-cli`.
- Both initial versions are `0.1.0`.
- Both packages are ESM-only and support Node.js 18 or newer.
- `@hsblabs/http-command` has no runtime dependency.
- `@hsblabs/http-cli` depends on the matching `@hsblabs/http-command` version.
- Published metadata points to `hsblabs/http-command`.
- Each tarball contains only package metadata, compiled output, README, LICENSE, and CHANGELOG.

## Release gate

The release is ready only when all of the following pass:

1. README synchronization
2. Type checking
3. Unit and contract tests
4. Production builds
5. Dry-run packing for both packages
6. Installation and import of both generated tarballs from a clean consumer project
7. Release workflow and dependency consistency checks

## Automated release

Changes merged to `main` carry Changesets. The release workflow maintains a Release PR. Merging that PR publishes both packages through npm trusted publishing. The workflow uses a GitHub-hosted runner, Node.js with npm 11.5.1 or newer, and `id-token: write`.

## Non-goals

- Publishing from this session
- Changing GitHub repository visibility
- Backward compatibility with unpublished versions from the source ZIP
- Independent package versions
- A custom release service or release script beyond Changesets
