# Animechan Example

This example shows how to build a small Animechan client with `@hsblabs/http-command`.

## Features

- Fetch a random anime quote
- Get a random quote filtered by anime
- List multiple quotes by character or anime
- Logs requests with the built-in middleware utilities

## Installation

```bash
pnpm install
```

## Usage

```bash
pnpm start
```

## Code Structure

- `src/commands.ts` - Command definitions for Animechan endpoints
- `src/client.ts` - Configured example client with middleware
- `src/index.ts` - Example usage flow

## API Documentation

This example uses the [Animechan API](https://animechan.io/), a free REST API for anime quotes.
