import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUE_ADDITIONS, CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { CUE_DROPPED_SYSTEMS } from './fixtures/cue-dropped-systems';

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

// With the assets (VFX_LTK_ROOT = an asset root's vfx-ltk folder, e.g. a local snapshot), the registry must name exactly
// the exported systems each replacement row drops. Skipped without them (CI has no assets).
const root = process.env.VFX_LTK_ROOT;
describe.skipIf(!root)('replacement rows drop only registered systems (VFX_LTK_ROOT)', () => {
  it('every replaced champion', () => {
    const read = (path: string) => JSON.parse(readFileSync(join(root!, path), 'utf8'));
    const top = read('index.json'), skills: Record<string, TimelineCue[]> = { ...top.skills }, systems = { ...top.systems };
    for (const path of new Set(Object.values(top.champions ?? {})) as Set<string>) { const one = read(path); Object.assign(skills, one.skills); Object.assign(systems, one.systems); }
    const out = (withCueOverrides({ version: 1, systems, assets: {}, skills } as never) as unknown as { skills: Record<string, TimelineCue[]> }).skills;
    const dropped: Record<string, string[]> = {};
    for (const champion of Object.keys(CUE_OVERRIDES)) {
      if (!Object.hasOwn(skills, champion)) continue;
      const plays = new Set(Object.entries(out).filter(([key]) => key === champion || key.startsWith(`${champion}-`)).flatMap(([, cues]) => cues.map(cue => cue.system)));
      const lost = [...new Set(skills[champion]!.map(cue => cue.system))].filter(system => !plays.has(system)).sort();
      if (lost.length) dropped[champion] = lost;
    }
    const registered = Object.fromEntries(Object.entries(CUE_DROPPED_SYSTEMS).map(([champion, systems]) => [champion, Object.keys(systems).sort()]));
    expect(dropped).toEqual(registered);
  });
});
