import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUE_BRANCHES, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';

// Fable 11-25: Ambessa's chain-stance swipe sits on her (the unit's own anchor, facing her primary target), not on her
// weapon locator, where it turned with the weapon and flew off over her head. Nothing else in her list changes.
const SWIPE = '3b4c15e0';
describe("Ambessa's chain swipe anchor", () => {
  it('the swipe names no bone; every other cue keeps its own', () => {
    const row = CUE_OVERRIDES.ambessa!;
    const swipe = row.filter(cue => cue.system === SWIPE);
    expect(swipe).toHaveLength(1);
    expect(swipe[0]!.bone).toBeUndefined();
    expect(swipe[0]).toMatchObject({ action: 'cast', event: 'cast-start' });
    expect(row.map(cue => cue.system).sort()).toEqual(['0f2af66b', '3b4c15e0', '6390530e', '754b6c78', '8a64f4dd', 'a429a900', 'cba05b6e']);
  });
  it('still carries the chain and fist branch tags', () => {
    const tagged = withCueOverrides({ version: 1, systems: Object.fromEntries(CUE_OVERRIDES.ambessa!.map(c => [c.system, `systems/${c.system}.json`])),
      assets: {}, skills: { ambessa: [] } } as never) as unknown as { skills: Record<string, { system: string; branch?: string }[]> };
    const branchOf = Object.fromEntries(tagged.skills.ambessa!.map(c => [c.system, c.branch]));
    for (const [system, branch] of Object.entries(CUE_BRANCHES.ambessa!)) expect(branchOf[system]).toBe(branch);
  });
});

// With the assets (VFX_LTK_ROOT = an asset root's vfx-ltk folder): the row is her exported list with only the swipe's bone gone.
const root = process.env.VFX_LTK_ROOT;
describe.skipIf(!root)("Ambessa's row against her exported list (VFX_LTK_ROOT)", () => {
  it('differs from the export only in the swipe\'s bone', () => {
    const index = JSON.parse(readFileSync(join(root!, 'set13/tft13_ambessa/index.json'), 'utf8'));
    const exported = (index.skills.ambessa as { system: string; bone?: string }[]).map(c => (c.system === SWIPE ? (({ bone: _, ...rest }) => rest)(c) : c));
    expect(CUE_OVERRIDES.ambessa).toEqual(exported);
  });
});
