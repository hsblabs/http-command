# README Sync Flow

`packages/http-command/README.md` is the source of truth for the package contract.

## Rules

1. Update the English README first.
2. Keep every locale file in `packages/http-command/docs/README/*.md` in the section order defined by `sync.config.json`.
3. Update API names and behavioral contracts in every locale when a public protocol changes.
4. Run the synchronization check before a release changeset is versioned.

## Automated check

The following command requires only Node.js and npm script execution:

```bash
npm run docs:check
```

The workspace check also runs it through pnpm:

```bash
pnpm run docs:check
```

`scripts/check-readme-sync.mjs` validates that required level-two sections exist in the source README and all locale files, in the configured order. It does not validate code snippets semantically; package and example type checking remains required.
