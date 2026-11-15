import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// 11-15: Sett's slam plays his whole E_cas from the cast on; two grabbed enemies keep the collision hit and dust on each,
// one grabbed enemy (variant 'single') gets the one-target slam instead.
const castCues = (variant?: 'single') => CUE_OVERRIDES.sett!.filter(cue => (cue.action ?? 'cast') === 'cast' && cue.variant === variant);

describe('Sett\'s slam: one grabbed enemy vs two (11-15)', () => {
  it('two enemies: E_cas at the cast, then the collision hit and dust on each enemy', () => {
    expect(castCues().map(cue => [cue.system, cue.event, cue.delay])).toEqual([['f7d4d344', 'cast-start', 0], ['5c1a47f1', 'hit', 0.6], ['c6d42f70', 'hit', 0.6]]);
    const spawns = mapSkillTimeline(castCues(), 'me', ['foe', 'foe2']).spawns;
    expect(spawns.filter(s => s.system === 'f7d4d344')).toHaveLength(1);
    for (const system of ['5c1a47f1', 'c6d42f70']) expect(spawns.filter(s => s.system === system).map(s => s.targetId).sort()).toEqual(['foe', 'foe2']);
  });

  it('one enemy: E_cas at the cast and the one-target slam on him', () => {
    expect(castCues('single').map(cue => [cue.system, cue.event, cue.delay])).toEqual([['f7d4d344', 'cast-start', 0], ['2794d903', 'hit', 0.6]]);
    expect(mapSkillTimeline(castCues('single'), 'me', ['foe']).spawns.map(s => s.system)).toEqual(['f7d4d344', '2794d903']);
  });

  it('the cast plan marks a one-enemy cast single and a two-enemy cast plain', () => {
    const cast = (targetIds: string[], eventSeq: number): DisplayCombatEvent => ({ type: 'cast', sourceId: 's', eventSeq, tick: eventSeq, actionSeq: eventSeq,
      completed: true, actualManaSpent: 60, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } } as DisplayCombatEvent);
    const plans = createBatch1VfxEvents(id => (id === 's' ? 'sett' : 'garen')).batch([cast(['a'], 1), cast(['a', 'b'], 2)]);
    expect(plans.map(p => p.variant)).toEqual(['single', undefined]);
  });

  it('in real combats Sett grabs one enemy when one is there and two when two are; the plan follows', () => {
    for (const [nfoes, variant] of [[1, 'single'], [2, undefined]] as const) {
      const units = realUnits({ unit: 'sett', star: 1, form: null, foe: 'amumu', dist: 2, nfoes, foestar: 2 });
      const events: DisplayCombatEvent[] = [];
      runRealCombat(units, 20, (_state, shown) => { events.push(...shown as DisplayCombatEvent[]); });
      const defs = Object.fromEntries(units.map(u => [u.id, u.definitionId as string]));
      const plans = createBatch1VfxEvents(id => defs[id]).batch(events).filter(p => p.event.type === 'cast' && p.event.sourceId === 'me');
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0]!.event.type === 'cast' && plans[0]!.event.targetIds.length).toBe(nfoes);
      expect(plans[0]!.variant).toBe(variant);
    }
  });
});
