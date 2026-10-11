/** EXPERIMENT ONLY: not an amendment to the signed native-copy contract.
 * Only detached factory/validated-restore declarations may enter this registry.
 * Weak references neither intern definitions across battles nor retain battles.
 */
const roots = new WeakSet<object>();
const nodes = new WeakSet<object>();
const owners = new WeakMap<object, readonly unknown[]>();

/** Remember only engine-issued units; replacement/foreign units take native copy. */
export function rememberStaticOwner(unit: { readonly itemPrograms?: unknown; readonly sources?: unknown }): void {
  owners.set(unit, [unit.itemPrograms, unit.sources]);
}

/** Call only on a detached engine-created value, after the existing validation. */
export function freezeOwnedStatic<T>(value: T): T {
  const collected = new Set<object>();
  function collect(x: unknown): boolean {
    if (x === null || typeof x !== 'object') return typeof x !== 'function' && typeof x !== 'symbol';
    if (collected.has(x)) return true;
    const proto = Object.getPrototypeOf(x);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return false;
    collected.add(x);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(x))) {
      if (!('value' in descriptor) || !collect(descriptor.value)) return false;
    }
    return true;
  }
  if (value !== null && typeof value === 'object' && collect(value)) {
    for (const object of collected) { Object.freeze(object); nodes.add(object); }
    roots.add(value);
  }
  return value;
}

/** Input is the original spread snapshot, with the same three legacy exclusions.
 * Inspect descriptors without executing getters; foreign classes/accessors and
 * aliases into shared definitions conservatively retain the full native copy.
 * Proxy descriptor traps are observable: this is an explicit experimental limit.
 */
export function cloneWithSharedStatic<T extends object>(input: T, owner: object): T {
  const fields = ['itemPrograms', 'sources'] as const;
  const expected = owners.get(owner);
  if (!expected || fields.some((key, index) => (input as Record<string, unknown>)[key] !== expected[index])) return structuredClone(input);
  const shared: [string, object][] = [];
  for (const key of fields) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (value === null || typeof value !== 'object' || !roots.has(value)) return structuredClone(input);
    shared.push([key, value]);
  }
  if (!shared.length) return structuredClone(input);
  const seen = new WeakSet<object>();
  function detached(x: unknown): boolean {
    if (x === null || typeof x !== 'object') return typeof x !== 'function' && typeof x !== 'symbol';
    if (nodes.has(x)) return false; // Keep aliases into either root (or a subtree).
    if (seen.has(x)) return true;
    const proto = Object.getPrototypeOf(x);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return false;
    seen.add(x);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(x))) {
      if (!descriptor.enumerable) continue;
      if (!('value' in descriptor) || !detached(descriptor.value)) return false;
    }
    return true;
  }
  for (const [key, value] of Object.entries(input)) {
    if (fields.some(field => field === key)) continue;
    if (!detached(value)) return structuredClone(input);
  }
  const stripped = { ...input };
  for (const [key] of shared) (stripped as Record<string, unknown>)[key] = undefined;
  const copy = structuredClone(stripped);
  for (const [key, value] of shared) (copy as Record<string, unknown>)[key] = value;
  return copy;
}
