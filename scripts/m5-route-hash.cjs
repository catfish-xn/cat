const crypto = require('node:crypto');

/** Public Match commands return immutable states. The next command's before is
 * often the preceding command's after; encode that identical value only once.
 * Scope this memo to one route. Mutable corruptions/general evidence must keep
 * m4-evidence.hash. The canonical encoding and SHA-256 algorithm are unchanged.
 */
function createRouteHash() {
  const hashes = new WeakMap();
  const encodings = new WeakMap();
  // Same canonical encoding as m4-evidence, including sparse/undefined array
  // entries. Route states and their retained children are immutable by contract.
  function canonical(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    const prior = encodings.get(value);
    if (prior !== undefined) return prior;
    const encoded = Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
      : `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    encodings.set(value, encoded); return encoded;
  }
  return value => {
    const prior = hashes.get(value);
    if (prior !== undefined) return prior;
    const digest = crypto.createHash('sha256').update(canonical(value)).digest('hex'); hashes.set(value, digest); return digest;
  };
}
module.exports = {createRouteHash};
