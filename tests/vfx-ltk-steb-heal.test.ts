import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withCueOverrides, type VfxIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Heal events as the combat view sends them (combat-replay-view.ts 'heal': targetId, actual, shares with their source). Shapes
// measured in real combats (11-14): Steb's own ability heal and his passive share both carry sourceKind 'ability',
// definitionId 'steb-ability' and his id; a Bloodthirster vamp heal carries sourceKind 'item', definitionId 'bloodthirster'
// and its holder's id.
type Share = { sourceId: string; sourceKind: string; definitionId: string; delivery: string; actual: number };
const share = (sourceId: string, definitionId: string, actual = 50, sourceKind = 'ability', delivery = 'ability-direct'): Share => ({ sourceId, sourceKind, definitionId, delivery, actual });
const healOf = (targetId: string, eventSeq: number, shares: Share[], actual = shares.reduce((n, s) => n + s.actual, 0)): DisplayCombatEvent =>
  ({ type: 'heal', tick: eventSeq, eventSeq, targetId, actual, shares } as DisplayCombatEvent);
const heal = (targetId: string, sourceId: string, definitionId: string, eventSeq: number, actual = 50) => healOf(targetId, eventSeq, [share(sourceId, definitionId, actual)]);
const cast = (sourceId: string, eventSeq: number): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq, tick: eventSeq,
  actionSeq: eventSeq, completed: true, actualManaSpent: 90, refundedMana: 0, targetIds: ['foe'], completionCell: { col: 0, row: 0 } });
const definitions: Record<string, string> = { steb: 'steb', ally: 'darius', foe: 'amumu', other: 'darius' };

describe('Steb heal visuals follow his heal events, never his cast\'s enemy', () => {
  it('a heal Steb sends to an ally flies his heal missile to that ally; his own heal rings on him', () => {
    const extras = createBatch1VfxEvents(id => definitions[id]).batch([cast('steb', 1), heal('steb', 'steb', 'steb-ability', 2), heal('ally', 'steb', 'steb-ability', 3)])
      .flatMap(plan => plan.extra);
    expect(extras).toEqual([
      { champion: 'steb', sourceId: 'steb', targets: ['steb'], action: 'passive', skill: 'steb-heal' },
      { champion: 'steb', sourceId: 'steb', targets: ['ally'], action: 'passive', skill: 'steb-share' },
    ]);
  });

  it('no heal from Steb, no heal visual: another unit\'s heal, a zero heal, his cast alone', () => {
    const extras = createBatch1VfxEvents(id => definitions[id]).batch([cast('steb', 1), heal('ally', 'other', 'darius-ability', 2),
      heal('ally', 'steb', 'steb-ability', 3, 0)]).flatMap(plan => plan.extra);
    expect(extras).toEqual([]);
  });

  it('an item or vamp heal from Steb draws nothing; only his ability\'s share counts', () => {
    const extras = createBatch1VfxEvents(id => definitions[id]).batch([
      healOf('steb', 2, [share('steb', 'bloodthirster', 40, 'item', 'equipment-proc')]),
      healOf('ally', 3, [share('steb', 'bloodthirster', 40, 'item', 'equipment-proc')]),
    ]).flatMap(plan => plan.extra);
    expect(extras).toEqual([]);
  });

  it('it is Steb\'s share that must heal, not the whole event: a zero Steb share beside another healer draws nothing', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([
      healOf('ally', 2, [share('other', 'darius-ability', 80), share('steb', 'steb-ability', 0)]),
      healOf('ally', 3, [share('other', 'darius-ability', 0), share('steb', 'steb-ability', 30)]),
    ]);
    expect(plans.map(plan => plan.extra.map(fx => fx.skill))).toEqual([[], ['steb-share']]);
  });

  it('his cast list keeps the strike on the enemy only; the missile and the heal ring live in the heal branches', () => {
    const cast = CUE_OVERRIDES.steb!.filter(cue => cue.action === 'cast');
    expect(cast.map(cue => [cue.system, cue.event])).toEqual([['8b302521', 'hit']]);
    expect(CUE_EXTRA_SKILLS['steb-share']!.map(cue => [cue.system, cue.event])).toEqual([['36c79ae9', 'projectile'], ['cf50856e', 'hit']]);
    expect(CUE_EXTRA_SKILLS['steb-heal']!.map(cue => [cue.system, cue.event])).toEqual([['cf50856e', 'hit']]);
    const systems = Object.fromEntries(['0f2af66b', '36c79ae9', '8b302521', 'cf50856e'].map(s => [s, `${s}.json`]));
    const index = { version: 1, systems, assets: {}, skills: { steb: [] } } as unknown as VfxIndex;
    const played = withCueOverrides(index).skills;
    expect(played.steb).toEqual(CUE_OVERRIDES.steb);
    expect(played['steb-share']).toBe(CUE_EXTRA_SKILLS['steb-share']);
    expect(played['steb-heal']).toBe(CUE_EXTRA_SKILLS['steb-heal']);
  });

  it('in a real combat his share heal plans the missile to the ally he heals, and nothing on an enemy', () => {
    const units = realUnits({ unit: 'steb', star: 1, form: null, foe: 'amumu', dist: 2, nfoes: 2, foestar: 2, ally: 'amumu', allystar: 1, allyCell: { row: 4, col: 3 } });
    const events: DisplayCombatEvent[] = [];
    runRealCombat(units, 20, (_state, shown) => { events.push(...shown as DisplayCombatEvent[]); });
    const defs = Object.fromEntries(units.map(u => [u.id, u.definitionId as string]));
    const extras = createBatch1VfxEvents(id => defs[id]).batch(events).flatMap(plan => plan.extra).filter(fx => fx.champion === 'steb');
    expect(extras.some(fx => fx.skill === 'steb-share' && fx.targets[0] === 'ally')).toBe(true);
    expect(extras.some(fx => fx.skill === 'steb-heal' && fx.targets[0] === 'me')).toBe(true);
    expect(extras.every(fx => !fx.targets.some(id => id.startsWith('foe')))).toBe(true);
  });
});
