import { describe, expect, it } from 'vitest';
import { createJayceCrystals } from '../src/rendering/three-mode/vfx-ltk/jayce-crystals';
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
  it('the renderer wiring: each crystal is its own source, stopped before anything of it plays; its explosion ends its stay', () => {
    const calls: string[] = [];
    const crystals = createJayceCrystals({
      stopSystems: (source, systems) => { calls.push(`stop ${source} ${systems.join(',')}`); },
      play: (_champion, source, _targets, _action, context) => { calls.push(`play ${source} ${context.skill} ${context.board.join(',')}`); return true; },
    });
    const at = [1, 0, 2] as const;
    crystals.crystal({ type: 'jayceCrystal', unitId: 'j', phase: 'landed', crystal: 1 }, at, true);
    crystals.crystal({ type: 'jayceCrystal', unitId: 'j', phase: 'landed', crystal: 2 }, at, true);
    crystals.crystal({ type: 'jayceCrystal', unitId: 'j', phase: 'exploded', crystal: 1 }, at, true);
    expect(calls).toEqual([
      `stop @jayce-crystal:j:1 ${JAYCE_CRYSTAL_STAY}`, 'play @jayce-crystal:j:1 jayce-back-crystal-land 1,0,2',
      `stop @jayce-crystal:j:2 ${JAYCE_CRYSTAL_STAY}`, 'play @jayce-crystal:j:2 jayce-back-crystal-land 1,0,2',
      `stop @jayce-crystal:j:1 ${JAYCE_CRYSTAL_STAY}`, 'play @jayce-crystal:j:1 jayce-back-crystal-blast 1,0,2',
    ]);
    // Catch-up: the stay still ends, nothing starts.
    calls.length = 0;
    crystals.crystal({ type: 'jayceCrystal', unitId: 'j', phase: 'exploded', crystal: 2 }, at, false);
    expect(calls).toEqual([`stop @jayce-crystal:j:2 ${JAYCE_CRYSTAL_STAY}`]);
  });
  it('Jayce dies before his crystals explode (the rules then drop the explosions): his standing crystals end with him, nobody else\'s', () => {
    const calls: string[] = [];
    const crystals = createJayceCrystals({ stopSystems: source => { calls.push(source); }, play: () => true });
    for (const crystal of [0, 1, 2]) crystals.crystal({ type: 'jayceCrystal', unitId: 'j', phase: 'landed', crystal }, [0, 0, 0], true);
    crystals.crystal({ type: 'jayceCrystal', unitId: 'k', phase: 'landed', crystal: 0 }, [0, 0, 0], true);
    crystals.crystal({ type: 'jayceCrystal', unitId: 'j', phase: 'exploded', crystal: 0 }, [0, 0, 0], true);
    calls.length = 0;
    crystals.death('j');
    expect(calls.sort()).toEqual(['@jayce-crystal:j:1', '@jayce-crystal:j:2']);
    calls.length = 0; crystals.death('j'); crystals.death('someone');
    expect(calls).toEqual([]);
  });
  it('the real rules: every crystal lands, then explodes on the same cell later, so its stay ends with its own explosion', () => {
    const units = realUnits({ unit: 'jayce', star: 2, form: 'ranged', meCell: { row: 6, col: 3 }, foe: 'amumu', dist: 4, nfoes: 3, foestar: 3 } as never);
    const shown: any[] = [];
    runRealCombat(units, 400, (_state, events) => { shown.push(...events); }, 99);
    const crystals = shown.filter(e => e.type === 'jayceCrystal' && e.unitId === 'me');
    expect(crystals.length).toBeGreaterThan(0);
    const open = new Map<string, any>();
    for (const e of crystals) {
      const key = `${e.unitId}:${e.crystal}`;
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
