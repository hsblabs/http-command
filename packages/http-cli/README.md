# @hsblabs/http-cli

`@hsblabs/http-cli` connects `@hsblabs/http-command` commands to a small, typed command-line interface.

## Install

```bash
pnpm add @hsblabs/http-command @hsblabs/http-cli
```

## Usage

```ts
import {
  createClient,
  defineCommand,
  encodePathSegment,
} from '@hsblabs/http-command';
import {
  arg,
  defineCLICommand,
  httpCLI,
  runCLI,
} from '@hsblabs/http-cli';

const getUser = defineCommand({
  build: ({ id }: { id: string }) => ({
    method: 'GET',
    url: `/users/${encodePathSegment(id)}`,
  }),
  parseData: (response): Promise<{ id: string; name: string }> =>
    response.json(),
});

const cli = httpCLI({ name: 'users', version: '0.1.0' })
  .bindClient(() => createClient({ baseUrl: 'https://api.example.com/v1' }))
  .command(
    defineCLICommand({
      name: 'get',
      args: {
        id: arg.string({ description: 'User ID', required: true }),
      },
      run: ({ id }) => getUser({ id }),
    }),
  );

await runCLI(cli);
```

`runCLI` supports `--help`, `help <command>`, `--version`, required arguments, aliases, defaults, and command-name suggestions. Pass `stdout`, `stderr`, `exit`, or `argv` through its options to embed or test a CLI without changing process globals.

The CLI carries the same service scope as its bound client and commands, so commands from another SDK fail during type checking.

## Requirements

- Node.js 18 or newer
- ESM
- `@hsblabs/http-command` at the same version

## License

MIT
