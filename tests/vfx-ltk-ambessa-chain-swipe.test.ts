import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AMBESSA_CHAIN_SWIPE_DELAY, AMBESSA_CHAIN_SWIPE_FADE, CUE_BRANCHES, CUE_OVERRIDES, EMITTER_ALPHA } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
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
    expect(swipe[0]).toMatchObject({ action: 'cast', event: 'cast-start', delay: AMBESSA_CHAIN_SWIPE_DELAY });
    expect(AMBESSA_CHAIN_SWIPE_DELAY).toBe(0.1);
    expect(row.map(cue => cue.system).sort()).toEqual(['0f2af66b', '3b4c15e0', '6390530e', '754b6c78', '8a64f4dd', 'a429a900', 'cba05b6e']);
  });
  it('draws four of its layers fainter and leaves its arc, edge and short red scratch at full strength', () => {
    expect(AMBESSA_CHAIN_SWIPE_FADE).toBe(0.25);
    expect(EMITTER_ALPHA[SWIPE]).toEqual({ Alpha_leadSwipe: AMBESSA_CHAIN_SWIPE_FADE, Alpha_bodySwipe_coreBacker: AMBESSA_CHAIN_SWIPE_FADE,
      blurChains: AMBESSA_CHAIN_SWIPE_FADE, groundScratch: AMBESSA_CHAIN_SWIPE_FADE });
    for (const kept of ['Add_leadSwipe', 'Add_edge_highlight', 'Add_groundScratch', 'Add_softSwipe', 'Alpha_softSwipe', 'bottom_dark'])
      expect(EMITTER_ALPHA[SWIPE]![kept]).toBeUndefined();
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
  it('differs from the export only in the swipe\'s bone and its earlier start', () => {
    const index = JSON.parse(readFileSync(join(root!, 'set13/tft13_ambessa/index.json'), 'utf8'));
    const exported = (index.skills.ambessa as { system: string; bone?: string }[]).map(c => (c.system === SWIPE ? (({ bone: _, ...rest }) => ({ ...rest, delay: AMBESSA_CHAIN_SWIPE_DELAY }))(c) : c));
    expect(CUE_OVERRIDES.ambessa).toEqual(exported);
  });
});
