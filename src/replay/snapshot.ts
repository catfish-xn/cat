import { isImmutableJson } from '../simulation/immutable-json';

const nativeRequired = Symbol('native clone required');
/** Detached data snapshot. Certified immutable JSON subgraphs can retain identity;
 * dynamic objects retain aliases/cycles in a fresh graph. Unusual values and
 * accessors stay on structuredClone's native path, without invoking getters in
 * the speculative data walk. Never freezes or changes the caller's objects. */
export function snapshotData<T>(value: T): T {
  const copies = new Map<object, object>();
  const copy = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      if (typeof input === 'function' || typeof input === 'symbol') throw nativeRequired;
      return input;
    }
    const previous = copies.get(input);
    if (previous) return previous;
    if (isImmutableJson(input)) return input;
    const array = Array.isArray(input), prototype = Object.getPrototypeOf(input);
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null) throw nativeRequired;
    const result: Record<string, unknown> | unknown[] = array ? new Array((input as unknown[]).length) : {};
    copies.set(input, result);
    for (const key of Object.keys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)!;
      if (!('value' in descriptor)) throw nativeRequired;
      const child = copy(descriptor.value);
      // JSON keys are ordinary own properties. Only __proto__ needs definition
      // to avoid invoking Object.prototype's legacy setter.
      if (key === '__proto__') Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
      else (result as Record<string, unknown>)[key] = child;
    }
    return result;
  };
  try { return copy(value) as T; }
  catch (error) { if (error !== nativeRequired) throw error; return structuredClone(value); }
}
