const crypto = require('node:crypto');
// Object enumeration is irrelevant; semantic array order remains significant.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
module.exports = { canonical, hash: value => crypto.createHash('sha256').update(canonical(value)).digest('hex') };
