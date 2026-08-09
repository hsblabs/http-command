---
title: Public repository launch
status: accepted
date: 2026-08-09
---

# Public repository launch

## Goal

Make `hsblabs/http-command` public without exposing secrets or enabling an unprotected npm release path.

## State transitions

```text
private-published
  -> private-hardened    files, dependencies, workflows, and metadata pass the launch gate
  -> public-protected    main rules and GitHub security controls are enabled
  -> oidc-ready          both npm packages trust release.yml
  -> automated           the release repository variable is enabled
```

The transitions are ordered. `NPM_TRUSTED_PUBLISHING_ENABLED` remains unset until both npm packages trust the exact release workflow.

## Invariants

- The repository and both packages use the MIT license.
- Public workflow dependencies use full commit SHAs.
- The release path contains no long-lived npm token.
- Production dependency audit has no known vulnerability.
- Development and release dependencies have no critical or high vulnerability.
- `main` rejects force pushes and deletion after public rules become available.
- Pull requests pass `build-and-test` before merge.
- Repository security reporting and scanning are enabled after public launch.

## Launch gate

1. `pnpm run release:check` succeeds.
2. `pnpm audit --audit-level=high` succeeds.
3. `actionlint` succeeds.
4. The worktree is clean and all hardening changes are on private `main`.
5. GitHub repository metadata and merge settings match the accepted defaults.
6. The repository history contains no detected credential or private-key material.

## Rollback

The npm packages remain public regardless of repository visibility. Before trusted publishing is enabled, the release variable is the kill switch. If repository exposure reveals a problem before external forks exist, return the repository to private, fix the issue, and repeat the launch gate.

## Non-goals

- Enabling automatic npm publishing before trusted publishers exist
- Requiring another maintainer's approval while the repository has one administrator
- Adding contribution process files before external contribution volume requires them
