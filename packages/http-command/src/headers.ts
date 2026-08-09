export function mergeHeaders(
  ...sources: Array<Readonly<Record<string, string>> | undefined>
): Record<string, string> {
  const entries = new Map<string, { key: string; value: string }>();

  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      entries.set(key.toLowerCase(), { key, value });
    }
  }

  const result: Record<string, string> = {};
  for (const { key, value } of entries.values()) {
    result[key] = value;
  }
  return result;
}

export function hasHeader(
  headers: Readonly<Record<string, string>>,
  name: string,
): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}
