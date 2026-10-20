import { readFile } from 'node:fs/promises';
import { fnv1a, binIs, parseBin } from './bin.mjs';

// Names only, scoped to VFX objects. Unknown hashes remain lossless {xxxxxxxx} keys.
const names = JSON.parse(await readFile(new URL('./particle-names.json', import.meta.url), 'utf8'));
const dictionary = new Map(names.map(name => [fnv1a(name), name]));
const hex = n => `{${n.toString(16).padStart(8, '0')}}`;
export function nameParticleValue(value) {
  if (typeof value === 'bigint') return `0x${value.toString(16)}`;
  if (Array.isArray(value)) return value.map(nameParticleValue);
  if (!value || typeof value !== 'object') return value;
  if (value.fields) return Object.fromEntries([
    ...value.fields.map(f => [dictionary.get(f.hash) ?? hex(f.hash), f.type === 14
      ? Array.from({ length: 4 }, (_, i) => f.value.slice(i * 4, i * 4 + 4)) : nameParticleValue(f.value)]),
    ['__type', dictionary.get(value.type) ?? hex(value.type)],
  ]);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, nameParticleValue(v)]));
}
export function particleSourcesFromBins(documents) {
  const source = Object.create(null), hashes = new Map();
  for (const doc of documents) {
    if (doc.patches.length) throw new Error('unsupported-particle-bin-patches');
    for (const entry of doc.entries.filter(e => binIs(e, 'VfxSystemDefinitionData'))) {
      const value = nameParticleValue(entry), previous = hashes.get(entry.hash);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(value)) throw new Error(`conflicting-particle-system:${hex(entry.hash)}`);
        continue;
      }
      hashes.set(entry.hash, value);
      const id = value.particlePath ?? hex(entry.hash);
      if (Object.hasOwn(source, id)) throw new Error(`duplicate-particle-path:${id}`);
      source[id] = value;
    }
  }
  return source;
}

/** Follow local links only, including extensionless character PROP files. The
 * caller resolves paths through its verified extraction index. No downloads. */
export async function loadParticleBins(initial, resolvePath, read, { maxDocuments = 256, maxBytes = 64 * 1024 * 1024 } = {}) {
  if (![maxDocuments, maxBytes].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('invalid-particle-bin-budget');
  const pending = [...initial], seen = new Set(), documents = [], paths = [], unresolved = [];
  let bytes = 0, attempts = 0;
  while (pending.length) {
    const ref = pending.shift(), path = resolvePath(ref);
    const key = path ?? ref.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!path) { unresolved.push({ path: ref, reason: 'missing-linked-particle-bin' }); continue; }
    if (attempts >= maxDocuments) { unresolved.push({ path, reason: 'particle-bin-document-budget' }); continue; }
    if (bytes >= maxBytes) { unresolved.push({ path, reason: 'particle-bin-byte-budget' }); continue; }
    attempts++;
    let doc;
    try {
      const data = await read(path); bytes += data.length;
      if (bytes > maxBytes) throw new Error('particle-bin-byte-budget');
      doc = parseBin(data);
    } catch (error) { unresolved.push({ path, reason: error.message }); continue; }
    documents.push(doc); paths.push(path);
    pending.push(...doc.linked);
    const stack = [...doc.entries];
    while (stack.length) {
      const v = stack.pop();
      if (typeof v === 'string' && /\.bin$/i.test(v)) pending.push(v);
      else if (v && typeof v === 'object') stack.push(...Object.values(v));
    }
  }
  return { documents, paths, unresolved, bytes };
}

/** Compare all source fields, not just those accepted by the converter. CDragon
 * prints hash/link values as names and flags as integers; normalize only these
 * representation differences, float32 and property order. Never omit fields. */
export function compareParticleSources(actual, reference) {
  const hash = name => /^\{[0-9a-f]{8}\}$/i.test(name) ? parseInt(name.slice(1, -1), 16) : fnv1a(name);
  const differences = [];
  function compare(a, b, path) {
    if (a && typeof a === 'object' && ['hash', 'link'].includes(a.kind)) {
      if ((typeof b === 'string' ? hash(b) : b?.hash) !== a.hash) differences.push(path);
    } else if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) differences.push(path);
      else a.forEach((v, i) => compare(v, b[i], `${path}[${i}]`));
    } else if (a && typeof a === 'object') {
      if (!b || typeof b !== 'object' || Array.isArray(b)) { differences.push(path); return; }
      const right = new Map(Object.entries(b).map(([k, v]) => [hash(k), [k, v]]));
      for (const [k, v] of Object.entries(a)) {
        const item = right.get(hash(k));
        if (!item) differences.push(`${path}.${k}`);
        else { compare(v, item[1], `${path}.${k}`); right.delete(hash(k)); }
      }
      for (const [k] of right.values()) differences.push(`${path}.${k}`);
    } else if (typeof a === 'number' && typeof b === 'number') {
      if (Math.fround(a) !== Math.fround(b)) differences.push(path);
    } else if (typeof a === 'boolean' && typeof b === 'number') {
      if (+a !== b) differences.push(path);
    } else if (a !== b) differences.push(path);
  }
  const filtered = Object.fromEntries(Object.entries(reference).filter(([, v]) => v?.__type === 'VfxSystemDefinitionData'));
  compare(actual, filtered, '$');
  return { matched: differences.length === 0, systems: Object.keys(actual).length,
    referenceSystems: Object.keys(filtered).length, differences };
}
