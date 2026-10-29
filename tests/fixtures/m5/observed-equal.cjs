const assert = require('node:assert/strict');
const immutable = new WeakSet(), equalSource = new WeakMap();
const dense = new WeakMap();
const rowSources = new WeakMap();

// Enumerable array indices precede all extra string properties, in numeric
// order. A length-sized key list ending at length-1 therefore proves every
// index exists and no extra enumerable string property exists.
const denseKeys = (keys, length) => keys.length === length && (length === 0 || keys[length - 1] === String(length - 1));

// Build a new oracle-owned data array, whose indexed data properties need no
// descriptor rediscovery. Every object child must already be certified.
function observedArray(values, map = value => value, previous) {
  const result = [];
  const priorSources = previous && rowSources.get(previous), sources = [];
  let safe = true, entries = 0;
  for (let i = 0; i < values.length; i++) {
    if (!(i in values)) continue;
    const value = map(values[i], i); result[i] = value; entries++;
    // Carry only an already compared immutable row pair, never a new clone's
    // presumed equality. Source identity is rechecked at every observation.
    if (priorSources && value === previous[i]) sources[i] = priorSources[i];
    if (value !== null && typeof value === 'object' && !immutable.has(value)) safe = false;
  }
  result.length = values.length;
  Object.freeze(result);
  if (safe) { immutable.add(result); dense.set(result, entries === result.length); rowSources.set(result, sources); }
  return result;
}

function equalRow(actual, expected, sources, i) {
  if (Object.is(actual, expected) || actual && typeof actual === 'object' && sources?.[i] === actual) return true;
  if (!plainEqual(actual, expected)) return false;
  if (sources && actual && typeof actual === 'object' && immutable.has(actual) && immutable.has(expected)) sources[i] = actual;
  return true;
}

// H3 visits changed children while constructing its detached snapshot. Freeze
// that source node once, without walking all previously checked journal rows
// again. Shallow freezing alone NEVER certifies a mutable child or an accessor.
function freezeObservedNode(value) {
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !(Array.isArray(value) && proto === Array.prototype)) return value;
  let safe = Object.getOwnPropertySymbols(value).length === 0;
  for (const key of Object.keys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d) || d.value !== null && typeof d.value === 'object' && !immutable.has(d.value)) safe = false;
  }
  Object.freeze(value);
  if (safe) immutable.add(value);
  return value;
}

// Freeze observed public-command inputs as well as the independently cloned
// expectation. This enforces Match's immutable-input contract. No production
// object becomes an expectation; only fully checked frozen pairs may be reused.
function freezeObservation(value, freezeJournals = false, visiting = new WeakSet()) {
  if (value === null || typeof value !== 'object' || immutable.has(value) || visiting.has(value)) return value;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null && !(Array.isArray(value) && proto === Array.prototype)) return value;
  // Growing journal containers are copied and scanned by H3 on every step.
  // Keep those arrays out of certification: walking immutable row identities is
  // cheap, unlike rebuilding property descriptors/freezing every index twice.
  // Their detached rows still get full immutable-pair checks; array edits cannot
  // reuse a cached array comparison.
  if (!freezeJournals && Array.isArray(value) && value.length > 64) {
    visiting.add(value);
    for (const child of value) if (child && typeof child === 'object' && !immutable.has(child)) freezeObservation(child, freezeJournals, visiting);
    visiting.delete(value); return value;
  }
  visiting.add(value);
  let safe = Object.getOwnPropertySymbols(value).length === 0;
  for (const key of Object.keys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !('value' in d)) { safe = false; continue; }
    freezeObservation(d.value, freezeJournals, visiting);
    if (d.value !== null && typeof d.value === 'object' && !immutable.has(d.value)) safe = false;
  }
  visiting.delete(value); Object.freeze(value);
  if (safe) immutable.add(value);
  return value;
}

// H3's detached checkpoints are plain data. Compare every own enumerable field
// without Node's general Map/Set/boxed-value machinery on each historical row.
// This is only a fast ACCEPT path: mismatches, exotic values, symbols and cycles
// still go through the original deepStrictEqual, with its exact error/semantics.
function plainEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a && typeof a === 'object' && equalSource.get(b) === a) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.getPrototypeOf(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || proto !== Array.prototype || a.length !== b.length) return false;
    const keys = dense.get(b) ? Object.keys(a) : undefined;
    if (keys && denseKeys(keys, a.length)) {
      const sources = rowSources.get(b) ?? [];
      rowSources.set(b, sources);
      for (let i = 0; i < a.length; i++) {
        if (!equalRow(a[i], b[i], sources, i)) return false;
      }
      if (Object.getOwnPropertySymbols(a).length) return false;
      if (immutable.has(a)) equalSource.set(b, a);
      return true;
    }
  } else if (proto !== Object.prototype && proto !== null
    || Object.prototype.toString.call(a) !== '[object Object]'
    || Object.prototype.toString.call(b) !== '[object Object]') return false;
  if (Object.getOwnPropertySymbols(a).length || Object.getOwnPropertySymbols(b).length) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (!Object.hasOwn(b, key)) return false;
    const av=a[key],bv=b[key];
    if (Object.is(av,bv) || av && typeof av === 'object' && equalSource.get(bv) === av) continue;
    if (!plainEqual(av,bv)) return false;
  }
  if (immutable.has(a) && immutable.has(b)) equalSource.set(b,a);
  return true;
}
function observedEqual(actual, expected, message) {
  let equal = false;
  try { equal = plainEqual(actual, expected); } catch { /* General assertion handles non-JSON/cyclic input. */ }
  if (!equal) assert.deepStrictEqual(actual, expected, message);
}

// Exactly the retained-prefix assertion, without allocating a slice and its
// string index keys on every tick. Extra properties on next are intentionally
// ignored, as with slice; unusual expected arrays retain Node's full semantics.
function observedPrefixEqual(next, expected, message) {
  let safe = dense.get(expected);
  if (safe === undefined && Array.isArray(expected) && Object.getPrototypeOf(expected) === Array.prototype
    && Object.getOwnPropertySymbols(expected).length === 0) {
    const keys = Object.keys(expected);
    safe = denseKeys(keys, expected.length);
    if (immutable.has(expected)) dense.set(expected, safe);
  }
  if (safe && Array.isArray(next) && Object.getPrototypeOf(next) === Array.prototype && next.length >= expected.length) {
    const sources = immutable.has(expected) ? rowSources.get(expected) ?? [] : undefined;
    if (sources) rowSources.set(expected, sources);
    let equal = true;
    try {
      for (let i = 0; i < expected.length; i++) {
        if (!(i in next) || !equalRow(next[i], expected[i], sources, i)) { equal = false; break; }
      }
    } catch { equal = false; /* Cycles/exotic rows retain Node's assertion semantics. */ }
    if (equal) return;
  }
  observedEqual(next.slice(0, expected.length), expected, message);
}
module.exports = { observedEqual, observedPrefixEqual, observedArray, freezeObservedNode, freezeObservation };
