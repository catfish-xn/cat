// League 14.24 PROP/PTCH layout, cross-checked against the locally supplied
// cdtb/binfile.py. No external code, dictionary, network or native executable.
export function fnv1a(name) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(name.toLowerCase(), 'utf8')) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h;
}
export const BIN_LIMITS = Object.freeze({ maxBytes: 32 * 1024 * 1024, maxDepth: 64,
  maxValues: 1_000_000, maxCount: 100_000, maxStringBytes: 4 * 1024 * 1024 });
const TYPES = new Set([...Array(19).keys(), ...Array.from({ length: 8 }, (_, i) => 0x80 + i)]);
/** Hashes stay numeric (64-bit values stay bigint); names are never guessed. */
export function parseBin(bytes, limits = {}) {
  const budget = { ...BIN_LIMITS, ...limits };
  for (const n of Object.values(budget)) if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid-bin-budget');
  if (!Buffer.isBuffer(bytes) || bytes.length > budget.maxBytes) throw new Error('bin-byte-budget');
  let at = 0, end = bytes.length, values = 0, strings = 0;
  function need(n) { if (!Number.isSafeInteger(n) || n < 0 || at > end - n) throw new Error(`bin-truncated:${at}`); }
  function read(method, n) { need(n); const v = bytes[method](at); at += n; return v; }
  const u8 = () => read('readUInt8', 1), u16 = () => read('readUInt16LE', 2), u32 = () => read('readUInt32LE', 4);
  function count(n, min = 1) { if (n > budget.maxCount) throw new Error('bin-count-budget'); need(n * min); return n; }
  function type() { const t = u8(); if (!TYPES.has(t)) throw new Error(`unknown-bin-type:0x${t.toString(16)}`); return t; }
  function text(n) { strings += n; if (strings > budget.maxStringBytes) throw new Error('bin-string-budget'); need(n);
    const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at, at + n)); at += n; return s; }
  const string = () => text(u16());
  function block(fn) { const size = u32(); need(size); const parent = end; end = at + size;
    const result = fn(); if (at !== end) throw new Error(`bin-length-mismatch:${at}:${end}`); end = parent; return result; }
  function fields(depth) { const n = count(u16(), 5), out = [], seen = new Set();
    for (let i = 0; i < n; i++) { const hash = u32(), t = type();
      if (seen.has(hash)) throw new Error('duplicate-bin-field'); seen.add(hash);
      out.push({ hash, type: t, value: value(t, depth + 1) }); } return out; }
  function value(t, depth) {
    if (depth > budget.maxDepth) throw new Error('bin-depth-budget');
    if (++values > budget.maxValues) throw new Error('bin-value-budget');
    if (t === 0) return [u16(), u16(), u16()];
    if (t === 1) { const v = u8(); if (v > 1) throw new Error('invalid-bin-bool'); return !!v; }
    const scalar = { 2: ['readInt8', 1], 3: ['readUInt8', 1], 4: ['readInt16LE', 2], 5: ['readUInt16LE', 2],
      6: ['readInt32LE', 4], 7: ['readUInt32LE', 4], 8: ['readBigInt64LE', 8], 9: ['readBigUInt64LE', 8] };
    if (scalar[t]) return read(...scalar[t]);
    if (t >= 10 && t <= 14) { const n = [1, 2, 3, 4, 16][t - 10], out = [];
      for (let i = 0; i < n; i++) { const v = read('readFloatLE', 4); if (!Number.isFinite(v)) throw new Error('nonfinite-bin-number'); out.push(v); }
      return t === 10 ? out[0] : out; }
    if (t === 15) return [u8(), u8(), u8(), u8()];
    if (t === 16) return string();
    if (t === 17 || t === 0x84) return { kind: t === 17 ? 'hash' : 'link', hash: u32() };
    if (t === 18) return { kind: 'path', hash: read('readBigUInt64LE', 8) };
    if (t === 0x87) return u8();
    if (t === 0x80 || t === 0x81) { const itemType = type(); return block(() => {
      const n = count(u32()), out = []; for (let i = 0; i < n; i++) out.push(value(itemType, depth + 1)); return out; }); }
    if (t === 0x82 || t === 0x83) { const hash = u32();
      if (t === 0x82 && hash === 0) return null;
      return block(() => ({ type: hash, fields: fields(depth) })); }
    if (t === 0x85) { const itemType = type(), n = u8(); if (n > 1) throw new Error('invalid-bin-option'); return n ? value(itemType, depth + 1) : null; }
    if (t === 0x86) { const keyType = type(), valueType = type(); return block(() => {
      const n = count(u32(), 2), entries = []; for (let i = 0; i < n; i++) entries.push([value(keyType, depth + 1), value(valueType, depth + 1)]);
      return { keyType, valueType, entries }; }); }
    throw new Error(`unknown-bin-type:0x${t.toString(16)}`);
  }
  let magic = text(4), patch = false;
  if (magic === 'PTCH') { patch = true; if (u32() !== 1 || u32() !== 0) throw new Error('unsupported-bin-patch'); magic = text(4); }
  if (magic !== 'PROP') throw new Error('unsupported-bin-magic');
  const version = u32(); if (version < 1 || version > 3) throw new Error('unsupported-bin-version');
  const linked = [];
  if (version >= 2) { const n = count(u32(), 2); for (let i = 0; i < n; i++) linked.push(string()); }
  const n = count(u32(), 4), types = []; for (let i = 0; i < n; i++) types.push(u32());
  const entries = types.map(t => block(() => ({ hash: u32(), type: t, fields: fields(0) })));
  const patches = [];
  if (patch && version >= 3) { const n = count(u32(), 11);
    for (let i = 0; i < n; i++) { const hash = u32(); patches.push(block(() => { const t = type(), path = string(); return { hash, path, type: t, value: value(t, 0) }; })); } }
  if (at !== bytes.length) throw new Error(`bin-trailing-bytes:${bytes.length - at}`);
  return { version, patch, linked, entries, patches };
}
export function binField(object, name) { return object?.fields?.find(f => f.hash === fnv1a(name))?.value; }
export function binIs(object, name) { return object?.type === fnv1a(name); }
