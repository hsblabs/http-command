---
title: Keep the public packages on one release version
status: accepted
date: 2026-08-09T18:26:33+09:00
agent: Codex GPT-5
---

# ADR 0001: Keep the public packages on one release version

## Context

`@hsblabs/http-cli` directly depends on `@hsblabs/http-command`. Releasing them independently would require tracking a compatibility matrix while both packages are maintained in the same repository and pass the same release gate.

The first npm release must happen while the GitHub repository is private. Later releases should avoid a long-lived npm token after the repository becomes public.

## Decision

- Put both packages in one Changesets fixed group.
- Start both packages at `0.1.0` and publish them together.
- Perform the first release manually after local validation.
- Enable the repository release workflow only when GitHub reports that the repository is public and the operator sets `NPM_TRUSTED_PUBLISHING_ENABLED`.
- Use npm trusted publishing through GitHub Actions OIDC for later releases.

## Consequences

- A change to either package releases both packages with the same version.
- Consumers can treat the package versions as a compatible pair.
- Some releases may contain no runtime change in one package.
- The operator must configure the same trusted workflow for both npm packages after the first release.
