import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAST_START_RANKS } from '../src/rendering/three-mode/vfx-ltk/cue-ranks';
import { CUE_ADDITIONS, CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { S13_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
import { batch3Timelines } from '../src/rendering/three-mode/vfx-ltk/batch3';
import { jayceSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jayce';
import { jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
import { melSkills } from '../src/rendering/three-mode/vfx-ltk/champions/mel';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { viktorSkills } from '../src/rendering/three-mode/vfx-ltk/champions/viktor';
import { warwickSkills } from '../src/rendering/three-mode/vfx-ltk/champions/warwick';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Every rank row must land on a cast-start of its branch, or the rank is silently lost (11-19: Smeech's swipes moved from his
// cast to smeech-stab-*, and the rows under 'smeech' would have stopped matching).
const rows = Object.entries(CAST_START_RANKS).flatMap(([key, ranks]) => Object.entries(ranks).map(([system, rank]) => ({ key, system, rank })));
const rankedIn = (skills: Record<string, readonly TimelineCue[] | undefined>, key: string, system: string) =>
  (skills[key] ?? []).filter(cue => cue.system === system && cue.event === 'cast-start').map(cue => cue.rank);

// Every rank key must name a branch the repository knows: a champion, or a branch some repository table defines (the
// exported index is built from these tables). A key renamed or folded away in the code (11-19: Smeech's four stab branches
// became one) fails here, where the check below would only skip a key it cannot build.
describe('cast-start rank keys name known branches', () => {
  const known = new Set<string>([
    ...Object.keys(M5_UNIT_DEFINITIONS),
    ...[CUE_OVERRIDES, CUE_EXTRA_SKILLS, CUE_ADDITIONS, BATCH1_TIMELINES, S13_TIMELINES,
      jayceSkills, jinxSkills, melSkills, sevikaSkills, viktorSkills, warwickSkills].flatMap(table => Object.keys(table)),
    ...Object.entries(batch3Timelines).flatMap(([hero, timelines]) => [hero, ...Object.keys(timelines)]),
  ]);
  it.each(Object.keys(CAST_START_RANKS))('%s', key => expect(known).toContain(key));
});

describe('cast-start ranks find their cues in the lists the repository builds', () => {
  // A branch whose list the repository builds (a replacement in CUE_OVERRIDES or a display branch in CUE_EXTRA_SKILLS) is
  // checked here, without assets. The other rows' lists come from the exported asset index: see the next block.
  const lists = [CUE_OVERRIDES, CUE_EXTRA_SKILLS, CUE_ADDITIONS].flatMap(table => Object.values(table)).flat() as TimelineCue[];
  const systems = new Set<string>([...lists.map(cue => cue.system), ...rows.map(row => row.system)]);
  // The keys the export carries: each replaced branch, and each champion a display branch hangs on (the display branches
  // themselves join only an index that lacks them).
  const champions = new Set<string>([...Object.keys(CUE_OVERRIDES), ...[...Object.keys(CUE_EXTRA_SKILLS), ...rows.map(row => row.key)].map(key => key.split('-')[0]!)]);
  const index = { version: 1, systems: Object.fromEntries([...systems].map(id => [id, `systems/${id}.json`])), assets: {},
    skills: Object.fromEntries([...champions].map(champion => [champion, [] as TimelineCue[]])) } as never;
  const built = (withCueOverrides(index) as unknown as { skills: Record<string, TimelineCue[]> }).skills;
  const repoBuilt = rows.filter(({ key }) => Object.hasOwn(CUE_OVERRIDES, key) || Object.hasOwn(CUE_EXTRA_SKILLS, key));
  it('covers the rows of every repository-built branch', () => expect(repoBuilt.length).toBeGreaterThan(20));
  it.each(repoBuilt)('$key $system ($rank)', ({ key, system, rank }) => expect(rankedIn(built, key, system)).toContain(rank));
});

// With the assets (VFX_LTK_ROOT = an asset root's vfx-ltk folder, e.g. a local snapshot), every row is checked against the
// exported index as the game loads it. Skipped without them (CI has no assets).
const root = process.env.VFX_LTK_ROOT;
describe.skipIf(!root)('cast-start ranks find their cues in the exported index (VFX_LTK_ROOT)', () => {
  it('every row', () => {
    const read = (path: string) => JSON.parse(readFileSync(join(root!, path), 'utf8'));
    const top = read('index.json'), skills = { ...top.skills }, systems = { ...top.systems };
    for (const path of new Set(Object.values(top.champions ?? {})) as Set<string>) { const one = read(path); Object.assign(skills, one.skills); Object.assign(systems, one.systems); }
    const out = (withCueOverrides({ version: 1, systems, assets: {}, skills } as never) as unknown as { skills: Record<string, TimelineCue[]> }).skills;
    expect(rows.filter(({ key, system, rank }) => !rankedIn(out, key, system).includes(rank))).toEqual([]);
  });
});
