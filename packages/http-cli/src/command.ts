import type { DefaultScope } from '@hsblabs/http-command';
import type { ArgRecord, CLICommandDef, RegisteredCommand } from './types';

export function defineCLICommand<
  A extends ArgRecord,
  O,
  Scope = DefaultScope,
>(def: CLICommandDef<A, O, Scope>): CLICommandDef<A, O, Scope> {
  return def;
}

export function toRegistered<A extends ArgRecord, O, Scope>(
  def: CLICommandDef<A, O, Scope>,
): RegisteredCommand<Scope> {
  return def.args
    ? (def as RegisteredCommand<Scope>)
    : { ...def, args: {} };
}
