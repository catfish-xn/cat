import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { CUE_ADDITIONS, CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { CUE_DROPPED_SYSTEMS } from './fixtures/cue-dropped-systems';
const require = createRequire(import.meta.url);
const { readCueIndexSystems } = require('../scripts/cue-index-systems.cjs') as { readCueIndexSystems: (root: string) => Record<string, string[]> };

// A CUE_OVERRIDES row replaces its champion's whole exported list. Every exported system the row no longer plays must be
// registered in tests/fixtures/cue-dropped-systems.ts with our reason (11-21: one was left out by mistake, unnoticed).
const entries = Object.entries(CUE_DROPPED_SYSTEMS).flatMap(([champion, systems]) =>
  Object.entries(systems).map(([system, drop]) => ({ champion, system, ...drop })));
/** The systems the repository plays for `champion`: its row, its additions and its display branches. */
const repositoryPlays = (champion: string) => new Set<string>([
  ...(CUE_OVERRIDES[champion] ?? []), ...(CUE_ADDITIONS[champion] ?? []),
  ...Object.entries(CUE_EXTRA_SKILLS).filter(([key]) => key.startsWith(`${champion}-`)).flatMap(([, cues]) => cues),
].map(cue => cue.system));

describe('the dropped-system registry', () => {
  it('has entries', () => expect(entries.length).toBeGreaterThan(0));
  it.each(entries)('$champion $system: a champion with a replacement row, a system id and a reason', ({ champion, system, status, reason }) => {
    expect(Object.hasOwn(CUE_OVERRIDES, champion)).toBe(true);
    expect(system).toMatch(/^[0-9a-f]{8}$/);
    expect(['dropped', 'replaced', 'pending']).toContain(status);
    expect(reason.trim().length).toBeGreaterThan(10);
  });
  it.each(entries)('$champion $system is not played by the repository lists', ({ champion, system }) =>
    expect(repositoryPlays(champion).has(system)).toBe(false));
});

// The exported lists come from tests/fixtures/cue-index-systems.json (system ids only, generated from the asset snapshot it
// names by scripts/cue-index-systems.cjs), so CI checks every replacement row: the systems each row drops must be exactly
// the registered ones. A new or edited row that drops an unregistered system fails here, as does a stale entry.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/cue-index-systems.json', import.meta.url), 'utf8')) as
  { source: { snapshot: string }; champions: Record<string, string[]> };
/** Per replaced champion, the exported systems its lists (row, additions, display branches) no longer play. */
function droppedBy(exported: Record<string, readonly string[]>): Record<string, string[]> {
  const tables = [CUE_OVERRIDES, CUE_ADDITIONS, CUE_EXTRA_SKILLS].flatMap(table => Object.values(table)).flat() as TimelineCue[];
  const systems = Object.fromEntries([...Object.values(exported).flat(), ...tables.map(cue => cue.system)].map(id => [id, `systems/${id}.json`]));
  const skills = Object.fromEntries(Object.entries(exported).map(([champion, ids]) =>
    [champion, ids.map(system => ({ system, action: 'cast', event: 'hit', delay: 0, duration: 1 }))]));
  const out = (withCueOverrides({ version: 1, systems, assets: {}, skills } as never) as unknown as { skills: Record<string, TimelineCue[]> }).skills;
  const dropped: Record<string, string[]> = {};
  for (const champion of Object.keys(CUE_OVERRIDES)) {
    if (!Object.hasOwn(exported, champion)) continue;
    const plays = new Set(Object.entries(out).filter(([key]) => key === champion || key.startsWith(`${champion}-`)).flatMap(([, cues]) => cues.map(cue => cue.system)));
    const lost = exported[champion]!.filter(system => !plays.has(system)).sort();
    if (lost.length) dropped[champion] = lost;
  }
  return dropped;
}
const registered = Object.fromEntries(Object.entries(CUE_DROPPED_SYSTEMS).map(([champion, systems]) => [champion, Object.keys(systems).sort()]));

describe(`replacement rows drop only registered systems (exported lists of snapshot ${fixture.source.snapshot})`, () => {
  it('the fixture lists the replaced champions', () =>
    expect(Object.keys(CUE_OVERRIDES).filter(champion => Object.hasOwn(fixture.champions, champion)).length).toBeGreaterThan(40));
  it('every replaced champion', () => expect(droppedBy(fixture.champions)).toEqual(registered));
});

// With the assets (VFX_LTK_ROOT = an asset root's vfx-ltk folder, e.g. a local snapshot), the committed fixture must match
// them. Skipped without them (CI has no assets).
const root = process.env.VFX_LTK_ROOT;
describe.skipIf(!root)('the exported-list fixture matches the assets (VFX_LTK_ROOT)', () => {
  it(`tests/fixtures/cue-index-systems.json (snapshot ${fixture.source.snapshot})`, () => {
    const actual = readCueIndexSystems(root!);
    expect(actual, 'the asset index differs from the fixture: rerun `node scripts/cue-index-systems.cjs <asset root>/vfx-ltk <snapshot id>`').toEqual(fixture.champions);
  });
});
