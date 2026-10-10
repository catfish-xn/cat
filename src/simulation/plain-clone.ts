const EXOTIC = Symbol('exotic');

/** Deep-copy plain data with a shared reference memo; throws EXOTIC for anything else. */
function copy(value: unknown, seen: Map<object, unknown>): unknown {
  if (typeof value !== 'object' || value === null) {
    // Functions and symbols are not plain data; structuredClone decides how they fail.
    if (typeof value === 'function' || typeof value === 'symbol') throw EXOTIC;
    return value;
  }
  const previous = seen.get(value);
  if (previous !== undefined) return previous;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Object.keys(value).length !== value.length) throw EXOTIC;
    const out: unknown[] = new Array(value.length);
    seen.set(value, out);
    for (let i = 0; i < value.length; i++) out[i] = copy(value[i], seen);
    return out;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw EXOTIC;
  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const key of Object.keys(value)) {
    if (key === '__proto__') throw EXOTIC;
    out[key] = copy((value as Record<string, unknown>)[key], seen);
  }
  return out;
}

/**
 * Copy the top-level own enumerable keys of `value` in order. Keys in `shared`
 * with a truthy value keep their reference; every other value is deep-copied
 * through one memo, as a single structuredClone of
 * `{ ...value, [truthy shared]: undefined }` followed by restoring those
 * references would.
 * Returns undefined when any value is not plain data, so the caller can run its
 * structuredClone path for the exact platform semantics.
 */
export function copyPlainRecord(value: object, shared: ReadonlySet<string>): Record<string, unknown> | undefined {
  const seen = new Map<object, unknown>(), out: Record<string, unknown> = {};
  try {
    for (const key of Object.keys(value)) {
      if (key === '__proto__') return undefined;
      const field = (value as Record<string, unknown>)[key];
      out[key] = shared.has(key) && field ? field : copy(field, seen);
    }
  } catch (error) {
    if (error !== EXOTIC) throw error;
    return undefined;
  }
  return out;
}
