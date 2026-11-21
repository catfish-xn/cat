import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { CUE_ADDITIONS, CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { S13_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { CUE_DROPPED_SYSTEMS, SPELL_UNPLAYED_SYSTEMS } from './fixtures/cue-dropped-systems';
const require = createRequire(import.meta.url);
const { readCueIndexSystems } = require('../scripts/cue-index-systems.cjs') as { readCueIndexSystems: (root: string) => Record<string, string[]> };
const { readSpellReferencedSystems } = require('../scripts/spell-referenced-systems.cjs') as { readSpellReferencedSystems: (data: string, root: string) => Record<string, string[]> };

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

// Systems a champion's spell data names as a hit or missile effect (tests/fixtures/spell-referenced-systems.json, system
// ids only, generated by scripts/spell-referenced-systems.cjs from a local copy of the champion data and the asset snapshot
// it names). Each must be played by the repository lists (every exported list as the loader rewrites it, the batch-1 and
// Set 13 timelines) or registered with a reason: SPELL_UNPLAYED_SYSTEMS, or CUE_DROPPED_SYSTEMS when a row dropped it.
const spellFixture = JSON.parse(readFileSync(new URL('./fixtures/spell-referenced-systems.json', import.meta.url), 'utf8')) as
  { source: { snapshot: string }; champions: Record<string, string[]> };
/** Per champion, the spell-referenced systems nothing in the repository plays for it. */
function spellUnplayed(exported: Record<string, readonly string[]>, referenced: Record<string, readonly string[]>): Record<string, string[]> {
  const tables = [CUE_OVERRIDES, CUE_ADDITIONS, CUE_EXTRA_SKILLS].flatMap(table => Object.values(table)).flat() as TimelineCue[];
  const systems = Object.fromEntries([...Object.values(exported).flat(), ...Object.values(referenced).flat(), ...tables.map(cue => cue.system)]
    .map(id => [id, `systems/${id}.json`]));
  const skills = Object.fromEntries(Object.entries(exported).map(([champion, ids]) =>
    [champion, ids.map(system => ({ system, action: 'cast', event: 'hit', delay: 0, duration: 1 }))]));
  const out = (withCueOverrides({ version: 1, systems, assets: {}, skills } as never) as unknown as { skills: Record<string, TimelineCue[]> }).skills;
  const timelines = { ...BATCH1_TIMELINES, ...S13_TIMELINES } as Record<string, readonly TimelineCue[]>;
  const unplayed: Record<string, string[]> = {};
  for (const [champion, ids] of Object.entries(referenced)) {
    const plays = new Set([...Object.entries(out).filter(([key]) => key === champion || key.startsWith(`${champion}-`)).flatMap(([, cues]) => cues),
      ...(timelines[champion] ?? [])].map(cue => cue.system));
    const lost = ids.filter(id => !plays.has(id)).sort();
    if (lost.length) unplayed[champion] = lost;
  }
  return unplayed;
}
const spellRegistered = (() => {
  const all: Record<string, Set<string>> = {};
  for (const registry of [CUE_DROPPED_SYSTEMS, SPELL_UNPLAYED_SYSTEMS]) for (const [champion, systems] of Object.entries(registry))
    for (const id of Object.keys(systems)) (all[champion] ??= new Set()).add(id);
  return all;
})();
const spellEntries = Object.entries(SPELL_UNPLAYED_SYSTEMS).flatMap(([champion, systems]) =>
  Object.entries(systems).map(([system, drop]) => ({ champion, system, ...drop })));

describe(`spell-referenced systems are played or registered (snapshot ${spellFixture.source.snapshot})`, () => {
  it('the fixture lists champions', () => expect(Object.keys(spellFixture.champions).length).toBeGreaterThan(30));
  it('every spell-referenced system nothing plays is registered', () => {
    const unplayed = spellUnplayed(fixture.champions, spellFixture.champions);
    const missing = Object.entries(unplayed).flatMap(([champion, ids]) => ids.filter(id => !spellRegistered[champion]?.has(id)).map(id => `${champion} ${id}`));
    expect(missing).toEqual([]);
  });
  it('SPELL_UNPLAYED_SYSTEMS holds only spell-referenced systems nothing plays (none stale, none also in CUE_DROPPED_SYSTEMS)', () => {
    const unplayed = spellUnplayed(fixture.champions, spellFixture.champions);
    for (const { champion, system } of spellEntries) {
      expect(unplayed[champion] ?? [], `${champion} ${system}`).toContain(system);
      expect(Object.hasOwn(CUE_DROPPED_SYSTEMS[champion] ?? {}, system), `${champion} ${system}`).toBe(false);
    }
  });
  it.each(spellEntries)('$champion $system: a system id, a status and a reason', ({ system, status, reason }) => {
    expect(system).toMatch(/^[0-9a-f]{8}$/);
    expect(['dropped', 'replaced', 'pending']).toContain(status);
    expect(reason.trim().length).toBeGreaterThan(10);
  });
});

// With the champion data and the assets (SPELL_DATA_ROOT = the folder of `<package>.cdtb.bin.json` files, VFX_LTK_ROOT as
// above), the committed fixture must match them. Skipped without them (CI has neither).
const spellData = process.env.SPELL_DATA_ROOT;
describe.skipIf(!root || !spellData)('the spell-referenced fixture matches the data (SPELL_DATA_ROOT, VFX_LTK_ROOT)', () => {
  it(`tests/fixtures/spell-referenced-systems.json (snapshot ${spellFixture.source.snapshot})`, () => {
    expect(readSpellReferencedSystems(spellData!, root!), 'rerun `node scripts/spell-referenced-systems.cjs <data> <asset root>/vfx-ltk <snapshot id>`')
      .toEqual(spellFixture.champions);
  });
});
