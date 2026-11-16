import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOARD_FALLBACK_REFERENCE } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/stencil';

// 11-15: the board's stencil value must be one no shipped emitter names, or that emitter would see the board as its own
// mask. Scans the vfx-ltk asset root when one is on hand (VFX_LTK_ASSET_ROOT, or the Linux box's live copy); skipped elsewhere.
const ROOT = process.env.VFX_LTK_ASSET_ROOT ?? '/data/aiapps/asset-root-live/vfx-ltk';
type Node = { name?: string; hash?: string; value?: any; fields?: Node[]; items?: Node[] };
/** Every emitter's stencil mode and reference in one system document. */
function stencilsOf(doc: unknown): { emitter: string; mode: number; ref: number; id: string | null }[] {
  const out: { emitter: string; mode: number; ref: number; id: string | null }[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const fields: Node[] | undefined = Array.isArray(node.fields) ? node.fields : undefined;
    const named = fields?.find(f => f?.name === 'emitterName');
    if (fields && named) {
      const get = (n: string) => fields.find(f => f?.name === n)?.value;
      const mode = Number(get('stencilMode')?.value ?? 0);
      if (mode) out.push({ emitter: String(named.value?.value), mode, ref: Number(get('stencilRef')?.value ?? 0), id: get('StencilReferenceId')?.hash ?? null });
    }
    Object.values(node).forEach(walk);
  };
  walk(doc);
  return out;
}
describe.skipIf(!existsSync(ROOT))('no shipped emitter names the board stencil value', () => {
  it(`no emitter's stencilRef is ${BOARD_FALLBACK_REFERENCE} (low six bits)`, () => {
    const hits: string[] = []; let scanned = 0, packs = 0;
    // A champion's pack sits either one level down (batch2/tft13_x, set13/tft13_x) or at the root itself (the first batch,
    // tft13_lux and eleven more, 11-16: the walk read only the first layout and left those twelve unchecked).
    const packDirs: string[] = [];
    for (const group of readdirSync(ROOT)) {
      const dir = join(ROOT, group); if (!statSync(dir).isDirectory()) continue;
      if (existsSync(join(dir, 'systems'))) { packDirs.push(dir); continue; }
      for (const hero of readdirSync(dir)) if (existsSync(join(dir, hero, 'systems'))) packDirs.push(join(dir, hero));
    }
    for (const pack of packDirs) {
      packs++;
      const systems = join(pack, 'systems');
      for (const file of readdirSync(systems)) {
        const doc = JSON.parse(readFileSync(join(systems, file), 'utf8')); scanned++;
        for (const s of stencilsOf(doc.root ?? doc)) if (s.id === null && (s.ref & 0x3f) === BOARD_FALLBACK_REFERENCE) hits.push(`${pack.slice(ROOT.length + 1)}/${file}:${s.emitter}`);
      }
    }
    expect(scanned).toBeGreaterThan(0);
    // Both layouts are walked: every pack the asset index names is among them.
    const named = Object.values(JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8')).champions as Record<string, string>).map(path => join(ROOT, path.replace(/\/index\.json$/, '')));
    expect(named.filter(path => !packDirs.includes(path))).toEqual([]);
    expect(packs).toBeGreaterThanOrEqual(new Set(named).size);
    expect(hits).toEqual([]);
  });
});
