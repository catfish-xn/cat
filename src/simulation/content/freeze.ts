// Only objects recursively frozen here are trusted; Object.isFrozen alone would
// also accept a shallow-frozen wrapper around mutable children.
const frozenContent = new WeakSet<object>();
export function isFrozenContent(value: unknown): value is object {
  return value !== null && typeof value === 'object' && frozenContent.has(value);
}
/** Content is immutable data. Runtime snapshots receive their own copies. */
export function freezeContent<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    if (frozenContent.has(value)) return value;
    for (const child of Object.values(value)) freezeContent(child);
    Object.freeze(value);
    frozenContent.add(value);
  }
  return value;
}
