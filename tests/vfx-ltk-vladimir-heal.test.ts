import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides, type VfxIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Heal events as the combat view sends them. Measured in a real combat (11-14): Vladimir's ability heal on himself carries
// sourceKind 'ability', definitionId 'vladimir-ability' and his id.
type Share = { sourceId: string; sourceKind: string; definitionId: string; delivery: string; actual: number };
const healOf = (targetId: string, eventSeq: number, shares: Share[]): DisplayCombatEvent =>
  ({ type: 'heal', tick: eventSeq, eventSeq, targetId, actual: shares.reduce((n, s) => n + s.actual, 0), shares } as DisplayCombatEvent);
const share = (sourceId: string, definitionId: string, actual = 200, sourceKind = 'ability'): Share =>
  ({ sourceId, sourceKind, definitionId, delivery: sourceKind === 'item' ? 'equipment-proc' : 'ability-direct', actual });
const cast = (sourceId: string, eventSeq: number, targetIds: string[]): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq, tick: eventSeq,
  actionSeq: eventSeq, completed: true, actualManaSpent: 60, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } });
const definitions: Record<string, string> = { vlad: 'vladimir', ally: 'darius', foe: 'amumu', foe2: 'amumu' };
const HEAL_MISSILE = '45b69079', HEAL_RING = '28c6427d', SPIKES = 'ad4b639e';

describe('Vladimir\'s heal ring follows his own heal, never his cast\'s enemies', () => {
  it('his ability healing him rings on him; an item heal, a zero heal, another unit\'s heal or a cast alone draw nothing', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([
      cast('vlad', 1, ['foe']), healOf('vlad', 2, [share('vlad', 'vladimir-ability')]),
      healOf('vlad', 3, [share('vlad', 'bloodthirster', 40, 'item')]), healOf('vlad', 4, [share('vlad', 'vladimir-ability', 0)]),
      healOf('ally', 5, [share('ally', 'darius-ability')]),
    ]);
    expect(plans.map(plan => plan.extra)).toEqual([[], [{ champion: 'vladimir', sourceId: 'vlad', targets: ['vlad'], action: 'passive', skill: 'vladimir-heal' }], [], [], []]);
  });

  it('a normal cast (one enemy) and a Blood Pact cast (two enemies, no heal) put neither the heal missile nor the heal ring on an enemy', () => {
    const castCues = CUE_OVERRIDES.vladimir!.filter(cue => (cue.action ?? 'cast') === 'cast');
    expect(castCues.map(cue => [cue.system, cue.event])).toEqual([[SPIKES, 'hit']]);
    for (const targets of [['foe'], ['foe', 'foe2']]) {
      const mapped = mapSkillTimeline(castCues, 'vlad', targets);
      expect(mapped.unsupported).toEqual([]);
      expect(mapped.spawns.map(s => [s.system, s.targetId])).toEqual(targets.map(id => [SPIKES, id]));
    }
    // Blood Pact heals nothing: its cast plans no ring.
    expect(createBatch1VfxEvents(id => definitions[id]).batch([cast('vlad', 1, ['foe', 'foe2'])]).flatMap(plan => plan.extra)).toEqual([]);
    expect(CUE_EXTRA_SKILLS['vladimir-heal']!.map(cue => [cue.system, cue.event])).toEqual([[HEAL_RING, 'hit']]);
    expect(Object.values(CUE_EXTRA_SKILLS).flat().some(cue => cue.system === HEAL_MISSILE)).toBe(false);
  });

  it('the cast list is never empty: an empty one would fall back to the old effects, which are this heal missile and ring', () => {
    const systems = Object.fromEntries(['ffa688fa', '0f2af66b', HEAL_MISSILE, HEAL_RING, SPIKES].map(s => [s, `${s}.json`]));
    const played = withCueOverrides({ version: 1, systems, assets: {}, skills: { vladimir: [] } } as unknown as VfxIndex).skills;
    expect(played.vladimir!.filter(cue => (cue.action ?? 'cast') === 'cast').length).toBeGreaterThan(0);
    expect(played['vladimir-heal']).toBe(CUE_EXTRA_SKILLS['vladimir-heal']);
  });

  it('in a real combat his cast heals him, the ring is planned on him and nothing heal-like on an enemy', () => {
    const units = realUnits({ unit: 'vladimir', star: 1, form: null, foe: 'amumu', dist: 2, nfoes: 2, foestar: 2 });
    const events: DisplayCombatEvent[] = [];
    runRealCombat(units, 30, (_state, shown) => { events.push(...shown as DisplayCombatEvent[]); });
    const heals = events.filter((e): e is Extract<DisplayCombatEvent, { type: 'heal' }> => e.type === 'heal' && e.targetId === 'me');
    expect([...new Set(heals.flatMap(e => e.shares.map(s => JSON.stringify([s.sourceId, s.sourceKind, s.definitionId]))))])
      .toEqual([JSON.stringify(['me', 'ability', 'vladimir-ability'])]);
    const defs = Object.fromEntries(units.map(u => [u.id, u.definitionId as string]));
    const extras = createBatch1VfxEvents(id => defs[id]).batch(events).flatMap(plan => plan.extra).filter(fx => fx.champion === 'vladimir');
    expect(extras.length).toBeGreaterThan(0);
    expect(extras.every(fx => fx.skill === 'vladimir-heal' && fx.targets.length === 1 && fx.targets[0] === 'me')).toBe(true);
  });
});
