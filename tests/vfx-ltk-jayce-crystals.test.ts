import { describe, expect, it } from 'vitest';
import { jayceCrystalVisual } from '../src/rendering/three-mode/vfx-ltk/jayce-crystals';
import { JAYCE_CRYSTAL_STAY, JAYCE_EVENT_SKILLS, jayceSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jayce';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Jayce's crystals (rules 11-21): each lands on its cell and stays there until the rules set it off, then explodes on that
// cell, each crystal its own (placeholder-renderer.ts jayceCrystal). Nothing of it plays at a fixed time after his cast.
describe('Jayce crystals follow the rules\' events', () => {
  it('his ranged cast list keeps the throw and no explosion; the landing and the explosion are board cues of their own', () => {
    expect(jayceSkills['jayce-back']!.some(cue => cue.system === '1ae6ef1d')).toBe(false);
    expect(jayceSkills['jayce-back']!.some(cue => cue.system === 'ee2e840c')).toBe(true);
    for (const skill of JAYCE_EVENT_SKILLS) {
      expect(CUE_EXTRA_SKILLS[skill]).toEqual(jayceSkills[skill]);
      expect(jayceSkills[skill]!.every(cue => cue.location === 'board' && cue.event === 'hit' && cue.delay === 0)).toBe(true);
    }
    expect(jayceSkills['jayce-back-crystal-land']!.map(cue => cue.system)).toEqual([JAYCE_CRYSTAL_STAY]);
    expect(jayceSkills['jayce-back-crystal-blast']!.map(cue => cue.system)).toEqual(['1ae6ef1d']);
  });
  it('his crystal branches join his package, whose lists are all form branches (no plain jayce list)', () => {
    const systems = Object.fromEntries([...jayceSkills['jayce-back']!, ...JAYCE_EVENT_SKILLS.flatMap(k => jayceSkills[k]!)].map(c => [c.system, `systems/${c.system}.json`]));
    const out = (withCueOverrides({ version: 1, systems, assets: {}, skills: { 'jayce-back': [{ system: 'ee2e840c', event: 'hit', delay: 0, duration: 1 }] } } as never) as unknown as { skills: Record<string, unknown> }).skills;
    for (const skill of JAYCE_EVENT_SKILLS) expect(out[skill]).toEqual(jayceSkills[skill]);
    // A package of another champion never takes them.
    const other = (withCueOverrides({ version: 1, systems, assets: {}, skills: { 'vi-back': [{ system: 'ee2e840c', event: 'hit', delay: 0, duration: 1 }] } } as never) as unknown as { skills: Record<string, unknown> }).skills;
    for (const skill of JAYCE_EVENT_SKILLS) expect(other[skill]).toBeUndefined();
  });
  it('each crystal is its own source: its landing plays its stay, its explosion ends that stay and plays the blast', () => {
    const land = jayceCrystalVisual({ unitId: 'j', phase: 'landed', crystal: 1 }), blast = jayceCrystalVisual({ unitId: 'j', phase: 'exploded', crystal: 1 });
    expect(land.skill).toBe('jayce-back-crystal-land'); expect(blast.skill).toBe('jayce-back-crystal-blast');
    expect(blast.source).toBe(land.source); expect(blast.stop).toEqual([JAYCE_CRYSTAL_STAY]);
    expect(jayceCrystalVisual({ unitId: 'j', phase: 'landed', crystal: 2 }).source).not.toBe(land.source);
    expect(jayceCrystalVisual({ unitId: 'k', phase: 'landed', crystal: 1 }).source).not.toBe(land.source);
  });
  it('the real rules: every crystal lands, then explodes on the same cell later, so its stay ends with its own explosion', () => {
    const units = realUnits({ unit: 'jayce', star: 2, form: 'ranged', meCell: { row: 6, col: 3 }, foe: 'amumu', dist: 4, nfoes: 3, foestar: 3 } as never);
    const shown: any[] = [];
    runRealCombat(units, 400, (_state, events) => { shown.push(...events); }, 99);
    const crystals = shown.filter(e => e.type === 'jayceCrystal' && e.unitId === 'me');
    expect(crystals.length).toBeGreaterThan(0);
    const open = new Map<string, any>();
    for (const e of crystals) {
      const key = jayceCrystalVisual(e).source;
      if (e.phase === 'landed') { expect(open.has(key)).toBe(false); open.set(key, e); continue; }
      const landed = open.get(key);
      expect(landed, `crystal ${e.crystal} exploded without landing`).toBeDefined();
      expect(e.cell).toEqual(landed.cell); expect(e.tick).toBeGreaterThan(landed.tick);
      open.delete(key);
    }
    // Only the last cast's crystals may still be waiting when the recorded combat stops.
    const lastLanding = Math.max(...crystals.filter(e => e.phase === 'landed').map(e => e.tick));
    for (const e of open.values()) expect(lastLanding - e.tick).toBeLessThan(10);
    expect(crystals.filter(e => e.phase === 'exploded').length).toBeGreaterThan(0);
  });
});
