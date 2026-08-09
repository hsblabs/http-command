import type {
  Command,
  CommandConfig,
  DefaultScope,
  JsonCommandConfig,
} from './types';

type CommandFactory<Scope, Input, Output> = (
  input: Input,
) => Command<Scope, Output>;

type CommandDefiner<Scope> = <Input, Output>(
  config: CommandConfig<Scope, Input, Output>,
) => CommandFactory<Scope, Input, Output>;

type JsonCommandDefiner<Scope> = <Input, Output = unknown>(
  config: JsonCommandConfig<Scope, Input, Output>,
) => CommandFactory<Scope, Input, Output>;

function createCommandFactory<Scope, Input, Output>(
  config: CommandConfig<Scope, Input, Output>,
): CommandFactory<Scope, Input, Output> {
  return (input) => ({
    request: config.build(input),
    defaults: config.defaults,
    parseData: config.parseData,
    parseError: config.parseError,
  }) as Command<Scope, Output>;
}

function createJsonCommandFactory<Scope, Input, Output>(
  config: JsonCommandConfig<Scope, Input, Output>,
): CommandFactory<Scope, Input, Output> {
  const parseData = async (response: Response): Promise<Output> => {
    if (
      response.status === 204 ||
      response.status === 205 ||
      response.headers.get('content-length') === '0' ||
      response.body === null
    ) {
      return undefined as Output;
    }

    const json: unknown = await response.json();
    return config.transform
      ? config.transform(json)
      : (json as Output);
  };

  return (input) => ({
    request: config.build(input),
    defaults: config.defaults,
    parseData,
    parseError: config.parseError,
  }) as Command<Scope, Output>;
}

export function defineCommand<Scope>(): CommandDefiner<Scope>;
export function defineCommand<Input, Output>(
  config: CommandConfig<DefaultScope, Input, Output>,
): CommandFactory<DefaultScope, Input, Output>;
export function defineCommand<Scope, Input, Output>(
  config: CommandConfig<Scope, Input, Output>,
): CommandFactory<Scope, Input, Output>;
export function defineCommand<Scope, Input, Output>(
  config?: CommandConfig<Scope, Input, Output>,
): CommandDefiner<Scope> | CommandFactory<Scope, Input, Output> {
  if (config) return createCommandFactory(config);

  return ((scopedConfig: CommandConfig<Scope, unknown, unknown>) =>
    createCommandFactory(scopedConfig)) as CommandDefiner<Scope>;
}

export function defineJsonCommand<Scope>(): JsonCommandDefiner<Scope>;
export function defineJsonCommand<Input, Output = unknown>(
  config: JsonCommandConfig<DefaultScope, Input, Output>,
): CommandFactory<DefaultScope, Input, Output>;
export function defineJsonCommand<Scope, Input, Output = unknown>(
  config: JsonCommandConfig<Scope, Input, Output>,
): CommandFactory<Scope, Input, Output>;
export function defineJsonCommand<Scope, Input, Output>(
  config?: JsonCommandConfig<Scope, Input, Output>,
): JsonCommandDefiner<Scope> | CommandFactory<Scope, Input, Output> {
  if (config) return createJsonCommandFactory(config);

  return ((scopedConfig: JsonCommandConfig<Scope, unknown, unknown>) =>
    createJsonCommandFactory(scopedConfig)) as JsonCommandDefiner<Scope>;
}
