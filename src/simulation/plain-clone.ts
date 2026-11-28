// Detach ordinary runtime data without a native serialization round-trip.
// Descriptor reads are speculative only: accessors, functions, symbols and
// built-ins take the unchanged native boundary (structuredClone, including its
// errors), and aliases/cycles keep exactly one copy per input node, as the
// native algorithm does. The result is never frozen.
const nativeClone = Symbol('native clone');
export function clonePlainData<T>(value: T): T {
  // The alias table is only needed once a nested object exists: a root whose
  // children are all primitives can be neither aliased nor part of a cycle.
  let copies: Map<object, object> | undefined;
  const clone = (input: object): object => {
    const array = Array.isArray(input), prototype = Object.getPrototypeOf(input);
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null) throw nativeClone;
    const result: Record<string, unknown> | unknown[] = array ? new Array((input as unknown[]).length) : {};
    copies?.set(input, result);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    for (const key of Object.keys(input)) {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor)) throw nativeClone;
      const child = descriptor.value;
      let next: unknown;
      if (child === null || typeof child !== 'object') {
        if (typeof child === 'function' || typeof child === 'symbol') throw nativeClone;
        next = child;
      } else {
        if (!copies) copies = new Map([[input, result]]);
        next = copies.get(child) ?? clone(child);
      }
      if (key === '__proto__') Object.defineProperty(result, key, { value: next, enumerable: true, writable: true, configurable: true });
      else (result as Record<string, unknown>)[key] = next;
    }
    return result;
  };
  try {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'function' || typeof value === 'symbol') throw nativeClone;
      return value;
    }
    return clone(value) as T;
  } catch (error) { if (error !== nativeClone) throw error; return structuredClone(value); }
}
