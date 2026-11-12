import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUE_OVERRIDES, cueOverride } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides, type VfxIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { CHEST, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
import { jayceSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jayce';
import { melSkills } from '../src/rendering/three-mode/vfx-ltk/champions/mel';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { viktorSkills } from '../src/rendering/three-mode/vfx-ltk/champions/viktor';
import { warwickSkills } from '../src/rendering/three-mode/vfx-ltk/champions/warwick';

// #627: the batch-2 lists play from the repository tables (CUE_OVERRIDES), not from the asset root's older copy.
const TABLES: Record<string, readonly TimelineCue[]> = {
  jinx: jinxSkills.jinx, 'jayce-front': jayceSkills['jayce-front'], 'jayce-back': jayceSkills['jayce-back'],
  mel: melSkills.mel, 'mel-third': melSkills['mel-third'], sevika: sevikaSkills.sevika, viktor: viktorSkills.viktor, warwick: warwickSkills.warwick,
};
/** The asset root's exported copy as deployed (c1333710ad8e): the same cues without the target anchors. */
const exported = (cues: readonly TimelineCue[]) => cues.map(cue => cue.action === 'attack' && (cue.event === 'hit' || cue.event === 'projectile')
  ? (({ bone, targetBone, ...rest }) => ({ ...rest, ...(cue.event === 'projectile' ? { bone } : {}) }))(cue as TimelineCue & { bone?: string; targetBone?: string }) as TimelineCue
  : cue);
const systemsOf = (cues: readonly TimelineCue[]) => Object.fromEntries(cues.map(cue => [cue.system, `${cue.system}.json`]));
const indexWith = (key: string, cues: readonly TimelineCue[], systems: Record<string, string>) =>
  ({ version: 1, systems, assets: {}, skills: { [key]: exported(cues) } }) as unknown as VfxIndex;
const log = () => (globalThis as { __vfxCueOverrides?: { applied: string[]; skipped: Record<string, string[]> } }).__vfxCueOverrides;

afterEach(() => { delete (globalThis as { __vfxCueOverrides?: unknown }).__vfxCueOverrides; vi.restoreAllMocks(); });

describe('#627 batch-2 attack anchors play from CUE_OVERRIDES', () => {
  for (const [key, table] of Object.entries(TABLES)) {
    it(`${key}: the override is the repository table itself`, () => {
      expect(CUE_OVERRIDES[key]).toBe(table);
    });

    it(`${key}: with every system loaded, the played list is the table and its attack hits/missiles aim at the chest`, () => {
      const played = withCueOverrides(indexWith(key, table, systemsOf(table))).skills[key]!;
      const attacks = played.filter(cue => cue.action === 'attack' && (cue.event === 'hit' || (cue.event === 'projectile' && !cue.stationary)));
      expect(attacks.length).toBeGreaterThan(0);
      for (const cue of attacks) expect(cue.event === 'hit' ? cue.bone : cue.targetBone, `${key} ${cue.system} ${cue.event}`).toBe(CHEST);
      expect(log()?.applied).toContain(key);
    });

    it(`${key}: a missing system keeps the exported list and warns once (dev)`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const systems = systemsOf(table); delete systems[table[table.length - 1]!.system];
      const index = indexWith(key, table, systems);
      expect(withCueOverrides(index).skills[key]).toEqual(index.skills[key]);
      expect(cueOverride(key, systems)).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(log()?.skipped[key]).toContain(table[table.length - 1]!.system);
    });
  }
});
