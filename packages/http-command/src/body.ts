export function isStreamLikeBody(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as {
    getReader?: unknown;
    [Symbol.asyncIterator]?: unknown;
  };

  return (
    typeof candidate.getReader === 'function' ||
    typeof candidate[Symbol.asyncIterator] === 'function'
  );
}
