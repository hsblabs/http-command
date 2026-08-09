# PokeAPI Example

This example demonstrates the package-author side of `@hsblabs/http-command`. It is not intended to be published as an SDK; it shows the shape a PokeAPI SDK could expose.

## Demonstrated Concepts

- A private `PokeAPIScope` shared by `Client` and commands
- `createPokeAPIClient(options)` as the service client factory
- Scoped command factories created by `defineCommand<PokeAPIScope>()`
- API-prefix URL resolution for `https://pokeapi.co/api/v2`
- Dynamic path encoding with `encodePathSegment`
- Separate `parseData` and `parseError` decoders
- Consumer-provided retry and logging middleware

## Consumer Shape

```ts
import {
  createPokeAPIClient,
  getPokemon,
} from 'poke-api-ts-sdk';

const client = createPokeAPIClient({
  middleware: [],
});

const pokemon = await client.send(
  getPokemon({ nameOrId: 1 }),
);
```

Within this repository, the same API is represented by `src/client.ts` and `src/commands.ts`; `src/index.ts` is only an executable usage example.

## Installation

```bash
pnpm install
```

## Usage

```bash
pnpm --filter example-poke-api start
```

## Code Structure

- `src/scope.ts` - Private compile-time service identifier
- `src/client.ts` - `createPokeAPIClient` factory and client options
- `src/commands.ts` - Scoped PokeAPI command factories
- `src/index.ts` - Example consumer program
