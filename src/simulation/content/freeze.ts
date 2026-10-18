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

// Short-lived view/ledger graphs must not grow the process-wide certification
// table. Only explicitly frozen roots are remembered, for the owning task's
// lifetime; nested records are still recursively frozen, including children of
// externally shallow-frozen wrappers.
function freezeTree<T>(value: T, roots?: WeakSet<object>): T {
  if (value !== null && typeof value === 'object') {
    if (frozenContent.has(value) || roots?.has(value)) return value;
    for (const child of Object.values(value)) freezeTree(child, roots);
    Object.freeze(value);
  }
  return value;
}
export function freezeTransientContent<T>(value: T): T { return freezeTree(value); }
export function createScopedContentFreezer() {
  const roots = new WeakSet<object>();
  return <T>(value: T): T => {
    freezeTree(value, roots);
    if (value !== null && typeof value === 'object') roots.add(value);
    return value;
  };
}
