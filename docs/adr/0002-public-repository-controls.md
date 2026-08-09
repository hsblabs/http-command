---
title: Protect the public source and release path
status: accepted
date: 2026-08-09T19:10:00+09:00
agent: Codex GPT-5
---

# ADR 0002: Protect the public source and release path

## Context

The initial npm packages were published while the source repository was private. Making the repository public exposes its history and Actions logs, allows external pull requests, and makes the release workflow part of the package supply chain.

## Decision

- License the repository under MIT from its root.
- Pin every GitHub Action to a full commit SHA and require SHA pinning in repository settings.
- Keep the default Actions token read-only and grant release permissions only to the release workflow.
- Use squash merges and delete merged branches.
- Require the `build-and-test` check on `main` after public rulesets become available.
- Enable GitHub dependency, secret, code-scanning, and private-reporting controls after public launch.
- Keep the npm release variable unset until both packages trust the OIDC workflow.

## Consequences

- Mutable Action tags cannot silently change release code.
- Public pull requests cannot publish packages or receive repository secrets.
- A single maintainer can merge after checks without an impossible self-approval requirement.
- Dependency and Action update pull requests are created automatically.
- Public visibility and npm automation remain separate, reversible decisions.
