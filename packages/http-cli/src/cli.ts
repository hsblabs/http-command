import { isHttpCommandError } from '@hsblabs/http-command';
import type { DefaultScope, Middleware } from '@hsblabs/http-command';
import type {
  ArgRecord,
  CLI,
  CLICommandDef,
  CLIConfig,
  ClientFactory,
  RegisteredCommand,
  RunOptions,
} from './types';
import { toRegistered } from './command';
import { CLIArgError, parseArgv, resolveArgs, suggestCommand } from './parse';

export function httpCLI<Scope = DefaultScope>(
  config: CLIConfig = {},
): CLI<Scope> {
  return buildCLI<Scope>(config, new Map(), undefined, []);
}

function buildCLI<Scope>(
  config: CLIConfig,
  commands: Map<string, RegisteredCommand<Scope>>,
  clientFactory: ClientFactory<Scope> | undefined,
  middleware: ReadonlyArray<Middleware>,
): CLI<Scope> {
  return {
    config,
    commands,
    clientFactory,
    middleware,

    bindClient(factory) {
      return buildCLI<Scope>(config, commands, factory, middleware);
    },

    use(...nextMiddleware) {
      return buildCLI<Scope>(config, commands, clientFactory, [
        ...middleware,
        ...nextMiddleware,
      ]);
    },

    command<A extends ArgRecord, O>(
      definition: CLICommandDef<A, O, Scope>,
    ) {
      if (definition.name === 'help') {
        throw new Error('"help" is a reserved command name.');
      }
      const next = new Map(commands);
      next.set(definition.name, toRegistered(definition));
      return buildCLI<Scope>(config, next, clientFactory, middleware);
    },
  };
}

export async function runCLI<Scope>(
  cli: CLI<Scope>,
  options: RunOptions = {},
): Promise<void> {
  const argv = options.argv ?? process.argv;
  const stdout =
    options.stdout ?? ((text: string) => process.stdout.write(`${text}\n`));
  const stderr =
    options.stderr ?? ((text: string) => process.stderr.write(`${text}\n`));
  const exit = options.exit ?? process.exit;

  const parsed = parseArgv(argv);

  if (parsed.version) {
    stdout(cli.config.version ?? '0.0.0');
    return;
  }

  if (parsed.help && !parsed.commandName) {
    printHelp(cli, stdout);
    return;
  }

  if (!parsed.commandName) {
    printHelp(cli, stdout);
    exit(1);
    return;
  }

  if (parsed.commandName === 'help') {
    const target = parsed.rest[0];
    if (!target) {
      printHelp(cli, stdout);
      return;
    }
    resolveAndShowHelp(target, cli, stdout, stderr, exit);
    return;
  }

  const commandDefinition = cli.commands.get(parsed.commandName);
  if (!commandDefinition) {
    handleUnknownCommand(parsed.commandName, cli, stderr, exit);
    return;
  }

  if (parsed.help) {
    printCommandHelp(commandDefinition, stdout);
    return;
  }

  if (!cli.clientFactory) {
    stderr('No client bound. Call .bindClient() before running.');
    exit(1);
    return;
  }

  try {
    const args = resolveArgs(commandDefinition.args, parsed.flags);
    const command = commandDefinition.run(args);
    let client = cli.clientFactory();
    if (cli.middleware.length > 0) {
      client = client.with(...cli.middleware);
    }
    const result = await client.send(command);
    stdout(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof CLIArgError) {
      stderr(error.message);
      stderr(`Run "${parsed.commandName} --help" for usage.`);
      exit(1);
      return;
    }
    if (isHttpCommandError(error)) {
      stderr(
        `${error.code} error: ${error.request.method} ${error.request.url}`,
      );
      if (error.status) {
        stderr(`Status: ${error.status}`);
      }
      if (error.body) {
        stderr(error.body);
      }
      exit(1);
      return;
    }
    stderr(error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

function resolveAndShowHelp<Scope>(
  name: string,
  cli: CLI<Scope>,
  stdout: (text: string) => void,
  stderr: (text: string) => void,
  exit: (code: number) => void,
): void {
  const command = cli.commands.get(name);
  if (command) {
    printCommandHelp(command, stdout);
  } else {
    handleUnknownCommand(name, cli, stderr, exit);
  }
}

function handleUnknownCommand<Scope>(
  name: string,
  cli: CLI<Scope>,
  stderr: (text: string) => void,
  exit: (code: number) => void,
): void {
  stderr(`Unknown command: ${name}`);
  const suggestion = suggestCommand(name, [...cli.commands.keys()]);
  if (suggestion) {
    stderr(`\nDid you mean: ${suggestion}?`);
  } else {
    stderr('Run with --help to see available commands.');
  }
  exit(1);
}

function printHelp<Scope>(
  cli: CLI<Scope>,
  stdout: (text: string) => void,
): void {
  const name = cli.config.name ?? 'cli';
  stdout(`Usage: ${name} <command> [options]`);

  if (cli.config.description) {
    stdout(`  ${cli.config.description}`);
  }

  if (cli.commands.size > 0) {
    stdout('');
    stdout('Commands:');
    const entries = [...cli.commands.values()];
    const maxLength = Math.max(...entries.map((command) => command.name.length));
    for (const command of entries) {
      const padded = command.name.padEnd(maxLength + 2);
      stdout(`  ${padded}${command.description ?? ''}`);
    }
  }

  stdout('');
  stdout('Options:');
  stdout('  -h, --help     Show help');
  stdout('  -V, --version  Show version');
}

function printCommandHelp<Scope>(
  command: RegisteredCommand<Scope>,
  stdout: (text: string) => void,
): void {
  stdout(`Usage: ${command.name} [options]`);
  if (command.description) {
    stdout(`  ${command.description}`);
  }

  const entries = Object.entries(command.args);
  stdout('');
  stdout('Options:');
  const labels = entries.map(([key, definition]) => {
    const alias = definition.alias ? `-${definition.alias}, ` : '    ';
    return `  ${alias}--${key}`;
  });
  const helpLabel = '  -h, --help';
  labels.push(helpLabel);
  const maxLength = Math.max(...labels.map((label) => label.length));

  for (let index = 0; index < entries.length; index++) {
    const [, definition] = entries[index];
    const label = labels[index].padEnd(maxLength + 2);
    const parts: string[] = [];
    if (definition.description) parts.push(definition.description);
    if (definition.required) parts.push('(required)');
    if (definition.default !== undefined) {
      parts.push(`[default: ${definition.default}]`);
    }
    stdout(`${label}${parts.join(' ')}`);
  }
  stdout(`${helpLabel.padEnd(maxLength + 2)}Show help`);
}
