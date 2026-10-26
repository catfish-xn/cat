import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const QUOTE = 34, BACKSLASH = 92, OPEN_BRACE = 123, CLOSE_BRACE = 125, OPEN_BRACKET = 91, CLOSE_BRACKET = 93, COLON = 58;

/** End index (exclusive) of the JSON string starting at `start` (an opening quote). */
function stringEnd(text: string, start: number): number {
  let i = start + 1;
  for (;;) {
    const quote = text.indexOf('"', i);
    if (quote < 0) throw new Error('Unterminated string in raw bin JSON');
    let slashes = 0;
    for (let j = quote - 1; text.charCodeAt(j) === BACKSLASH; j--) slashes++;
    if (slashes % 2 === 0) return quote + 1;
    i = quote + 1;
  }
}

/**
 * The named top-level entries of a raw CDragon bin JSON (`{"key":value,...}`), each parsed with JSON.parse from its own
 * byte range. One structural pass over the document finds the top-level keys, so the 54 MB map22 bin is not built into a
 * full object graph. Throws when a requested key is missing or the document is not a top-level object.
 */
export function rawTopLevelEntries(path: string, keys: readonly string[]): Record<string, any> {
  const text = gunzipSync(readFileSync(path)).toString();
  const wanted = new Set(keys), found: Record<string, any> = {};
  if (text.charCodeAt(0) !== OPEN_BRACE) throw new Error('Raw bin JSON is not a top-level object');
  let depth = 0, key: string | null = null, valueStart = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === QUOTE) {
      const end = stringEnd(text, i);
      if (depth === 1 && valueStart < 0) {
        // A depth-1 string before its colon is a key; afterwards it is a string value.
        let next = end; while (text.charCodeAt(next) <= 32) next++;
        if (text.charCodeAt(next) === COLON) { key = JSON.parse(text.slice(i, end)); valueStart = next + 1; i = next; continue; }
      }
      i = end - 1;
    } else if (c === OPEN_BRACE || c === OPEN_BRACKET) depth++;
    else if (c === CLOSE_BRACE || c === CLOSE_BRACKET) {
      depth--;
      if (depth === 0) { finish(i); break; }
    } else if (c === 44 /* , */ && depth === 1) finish(i);
  }
  function finish(end: number) {
    if (valueStart >= 0 && key !== null && wanted.has(key)) found[key] = JSON.parse(text.slice(valueStart, end));
    key = null; valueStart = -1;
  }
  const missing = keys.filter(k => !(k in found));
  if (missing.length) throw new Error(`Raw bin JSON lacks ${missing.join(', ')}`);
  return found;
}
