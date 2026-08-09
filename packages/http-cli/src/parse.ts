import type { ArgDef, ArgRecord } from './types';

export type ParseResult = {
  commandName: string | undefined;
  flags: Record<string, string | boolean>;
  rest: string[];
  help: boolean;
  version: boolean;
};

function looksLikeNumber(s: string): boolean {
  return /^-\d/.test(s);
}

export function parseArgv(argv: string[]): ParseResult {
  const args = argv.slice(2);
  let commandName: string | undefined;
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  let help = false;
  let version = false;
  let pastSeparator = false;

  for (let i = 0; i < args.length; i++) {
    const token = args[i];

    if (pastSeparator) {
      rest.push(token);
      continue;
    }

    if (token === '--') {
      pastSeparator = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      help = true;
      continue;
    }

    if (token === '--version' || token === '-V') {
      version = true;
      continue;
    }

    // --no-* boolean negation
    if (token.startsWith('--no-') && token.length > 5) {
      flags[token.slice(5)] = false;
      continue;
    }

    if (token.startsWith('--')) {
      const key = token.slice(2);
      const eqIdx = key.indexOf('=');
      if (eqIdx !== -1) {
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else {
        const next = args[i + 1];
        if (next !== undefined && (!next.startsWith('-') || looksLikeNumber(next))) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
      continue;
    }

    if (token.startsWith('-') && token.length === 2 && !looksLikeNumber(token)) {
      const alias = token.slice(1);
      const next = args[i + 1];
      if (next !== undefined && (!next.startsWith('-') || looksLikeNumber(next))) {
        flags[alias] = next;
        i++;
      } else {
        flags[alias] = true;
      }
      continue;
    }

    if (commandName === undefined) {
      commandName = token;
    } else {
      rest.push(token);
    }
  }

  return { commandName, flags, rest, help, version };
}

export function resolveArgs(
  defs: ArgRecord,
  flags: Record<string, string | boolean>,
): Record<string, unknown> {
  const knownKeys = new Set<string>();
  for (const [key, def] of Object.entries(defs)) {
    knownKeys.add(key);
    if (def.alias) {
      knownKeys.add(def.alias);
    }
  }

  const unknownFlags: string[] = [];
  for (const key of Object.keys(flags)) {
    if (!knownKeys.has(key)) {
      unknownFlags.push(key.length === 1 ? `-${key}` : `--${key}`);
    }
  }
  if (unknownFlags.length > 0) {
    throw new CLIArgError(`Unknown flag${unknownFlags.length > 1 ? 's' : ''}: ${unknownFlags.join(', ')}`);
  }

  const result: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(defs)) {
    const raw = flags[key] ?? (def.alias ? flags[def.alias] : undefined);

    if (raw === undefined) {
      if (def.default !== undefined) {
        result[key] = def.default;
      } else if (def.required) {
        throw new CLIArgError(`Missing required argument: --${key}`);
      } else {
        result[key] = undefined;
      }
      continue;
    }

    result[key] = coerce(key, raw, def);
  }

  return result;
}

function coerce(key: string, raw: string | boolean, def: ArgDef): unknown {
  switch (def.type) {
    case 'string':
      if (typeof raw === 'boolean') {
        throw new CLIArgError(`--${key} requires a string value`);
      }
      return raw;
    case 'number': {
      if (typeof raw === 'boolean') {
        throw new CLIArgError(`--${key} requires a number value`);
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new CLIArgError(`--${key} must be a number, got "${raw}"`);
      }
      return n;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      throw new CLIArgError(`--${key} must be a boolean, got "${raw}"`);
  }
}

export class CLIArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CLIArgError';
  }
}

export function suggestCommand(input: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const d = levenshtein(input, candidate);
    const threshold = Math.max(2, Math.floor(candidate.length / 2));
    if (d < bestDist && d <= threshold) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}
