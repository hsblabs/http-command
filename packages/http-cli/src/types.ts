import type {
  Client,
  Command,
  DefaultScope,
  Middleware,
} from '@hsblabs/http-command';

export type ArgType = 'string' | 'number' | 'boolean';

export type ArgDef<T = unknown> = {
  type: ArgType;
  description?: string;
  alias?: string;
  default?: T;
  required?: boolean;
};

export type ArgRecord = Record<string, ArgDef>;

export type InferArgs<T extends ArgRecord> = {
  [K in keyof T]: T[K] extends ArgDef<infer D>
    ? T[K] extends { required: true }
      ? D
      : T[K] extends { default: D }
        ? D
        : D | undefined
    : never;
};

export type CLICommandDef<
  A extends ArgRecord = ArgRecord,
  O = unknown,
  Scope = DefaultScope,
> = {
  name: string;
  description?: string;
  args?: A;
  run: (args: InferArgs<A>) => Command<Scope, O>;
};

export type RegisteredCommand<Scope = DefaultScope> = {
  name: string;
  description?: string;
  args: ArgRecord;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (args: any) => Command<Scope, any>;
};

export type ClientFactory<Scope = DefaultScope> = () => Client<Scope>;

export type CLIConfig = {
  name?: string;
  description?: string;
  version?: string;
};

export type CLI<Scope = DefaultScope> = {
  readonly config: CLIConfig;
  readonly commands: ReadonlyMap<string, RegisteredCommand<Scope>>;
  readonly clientFactory: ClientFactory<Scope> | undefined;
  readonly middleware: ReadonlyArray<Middleware>;
  bindClient: (factory: ClientFactory<Scope>) => CLI<Scope>;
  use: (...middleware: Middleware[]) => CLI<Scope>;
  command: <A extends ArgRecord, O>(
    def: CLICommandDef<A, O, Scope>,
  ) => CLI<Scope>;
};

export type RunOptions = {
  argv?: string[];
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  exit?: (code: number) => void;
};
