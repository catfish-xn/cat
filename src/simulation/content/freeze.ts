// Only objects recursively frozen here are trusted; Object.isFrozen alone would
// also accept a shallow-frozen wrapper around mutable children.
const frozenContent = new WeakSet<object>();
export function isFrozenContent(value: unknown): value is object {
  return value !== null && typeof value === 'object' && frozenContent.has(value);
}
/** Content is immutable data. Runtime snapshots receive their own copies. */
export function freezeContent<T>(value: T): T {
  if (value === null || typeof value !== 'object' || frozenContent.has(value)) return value;
  return freezeOwned(value);
}
// Synchronous callers have no scheduling boundary to expose. Keep the same
// value-read/freeze order without allocating one generator for every child.
function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !frozenContent.has(value)) {
    for (const child of Object.values(value)) {
      if (child !== null && typeof child === 'object') freezeOwned(child);
    }
    Object.freeze(value);
    frozenContent.add(value);
  }
  return value;
}
/** Pause only between owned JSON nodes; never certify an unfinished subtree. */
export function* freezeContentSteps<T>(value: T): Generator<void, T, void> {
  // Keep the same cooperative boundaries on cold and warm data; prior matches must not change room scheduling.
  // Only the pause count is observable: freeze in one synchronous pass (children
  // first, warm nodes included) and pause once per 64 object nodes, as the former
  // stepwise traversal did (its budget started at 64 and paused when it hit zero).
  const nodes = freezeCounting(value);
  for (let pauses = Math.floor(nodes / 64); pauses > 0; pauses--) yield;
  return value;
}
function freezeCounting(value: unknown): number {
  if (value === null || typeof value !== 'object') return 0;
  let count = 1;
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') count += freezeCounting(child);
  }
  Object.freeze(value);
  frozenContent.add(value);
  return count;
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
export interface ScopedContentFreezer {
  <T>(value: T): T;
  /** Register a root the caller has already deeply frozen, without walking it again. */
  adopt(value: object): void;
}
export function createScopedContentFreezer(): ScopedContentFreezer {
  const roots = new WeakSet<object>();
  const freeze = <T>(value: T): T => {
    freezeTree(value, roots);
    if (value !== null && typeof value === 'object') roots.add(value);
    return value;
  };
  return Object.assign(freeze, { adopt: (value: object): void => { roots.add(value); } });
}
