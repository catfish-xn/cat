// Encoding memo only: no object identity, admission or validation result is kept.
// Primitive tuple equality implies identical native JSON bytes (also for -0 and
// non-finite numbers). Bound the arena independently of the length of a match.
const end = Symbol('encoded tuple');
type Primitive = string | number | boolean | null | undefined;
interface Node extends Map<Primitive | typeof end, Node | string> {}
const root: Node = new Map();
let nodes = 0;
export function encodePrimitiveTuple(parts: readonly unknown[]): string {
  // Preserve native behavior for exotic runtime inputs and prototype toJSON.
  if (parts.length > 12 || 'toJSON' in Array.prototype) return JSON.stringify(parts);
  for (const part of parts) if (part !== null && part !== undefined && typeof part !== 'string' && typeof part !== 'number' && typeof part !== 'boolean') return JSON.stringify(parts);
  if (nodes >= 4096) { root.clear(); nodes = 0; }
  let node = root;
  for (const part of parts) {
    let child = node.get(part as Primitive) as Node | undefined;
    if (!child) { child = new Map(); node.set(part as Primitive, child); nodes++; }
    node = child;
  }
  const previous = node.get(end) as string | undefined;
  if (previous !== undefined) return previous;
  const encoded = JSON.stringify(parts);
  node.set(end, encoded);
  return encoded;
}
