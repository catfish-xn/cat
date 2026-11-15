import { Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createVfxLibrary, withCueOverrides, type VfxIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_RUN_STATS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';
import { syntheticSystem } from './vfx-ltk-synthetic';

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
const STRANDS = '45b69079', HEAL_RING = '28c6427d', SPIKES = 'ad4b639e';

describe('Vladimir\'s heal ring follows his own heal, never his cast\'s enemies', () => {
  it('his ability healing him rings on him; an item heal, a zero heal, another unit\'s heal or a cast alone draw nothing', () => {
    const plans = createBatch1VfxEvents(id => definitions[id]).batch([
      cast('vlad', 1, ['foe']), healOf('vlad', 2, [share('vlad', 'vladimir-ability')]),
      healOf('vlad', 3, [share('vlad', 'bloodthirster', 40, 'item')]), healOf('vlad', 4, [share('vlad', 'vladimir-ability', 0)]),
      healOf('ally', 5, [share('ally', 'darius-ability')]),
    ]);
    expect(plans.map(plan => plan.extra)).toEqual([[], [{ champion: 'vladimir', sourceId: 'vlad', targets: ['vlad'], action: 'passive', skill: 'vladimir-heal' }], [], [], []]);
  });

  it('a normal cast (one enemy) and a Blood Pact cast (two enemies, no heal): red strands to each enemy, never the heal ring on one', () => {
    const castCues = CUE_OVERRIDES.vladimir!.filter(cue => (cue.action ?? 'cast') === 'cast');
    // 11-15 (Fable): his cast draws the thin red strands of Q_heal_mis to each enemy; Q_tar's spikes are gone.
    expect(castCues.map(cue => [cue.system, cue.event])).toEqual([[STRANDS, 'projectile']]);
    expect(castCues.some(cue => cue.system === SPIKES || cue.system === HEAL_RING)).toBe(false);
    for (const targets of [['foe'], ['foe', 'foe2']]) {
      const mapped = mapSkillTimeline(castCues, 'vlad', targets);
      expect(mapped.unsupported).toEqual([]);
      expect(mapped.spawns.map(s => [s.system, s.targetId])).toEqual(targets.map(id => [STRANDS, id]));
    }
    // Blood Pact heals nothing: its cast plans no ring.
    expect(createBatch1VfxEvents(id => definitions[id]).batch([cast('vlad', 1, ['foe', 'foe2'])]).flatMap(plan => plan.extra)).toEqual([]);
    // The ring plays at his heal itself: no delay after the heal event.
    expect(CUE_EXTRA_SKILLS['vladimir-heal']!.map(cue => [cue.system, cue.event, cue.delay])).toEqual([[HEAL_RING, 'hit', 0]]);
  });

  it('the cast list is never empty: an empty one would fall back to the old effects, which are this heal missile and ring', () => {
    const systems = Object.fromEntries(['ffa688fa', '0f2af66b', STRANDS, HEAL_RING, SPIKES].map(s => [s, `${s}.json`]));
    const played = withCueOverrides({ version: 1, systems, assets: {}, skills: { vladimir: [] } } as unknown as VfxIndex).skills;
    expect(played.vladimir!.filter(cue => (cue.action ?? 'cast') === 'cast').length).toBeGreaterThan(0);
    expect(played['vladimir-heal']).toBe(CUE_EXTRA_SKILLS['vladimir-heal']);
  });

  it('the runtime plays his cast itself (never refused to the old effects), even when the index lists the exported heal cues', async () => {
    // The index's own Vladimir rows as exported: the heal missile and the heal ring are his cast there. Systems are synthetic.
    const exported = [
      { system: 'ffa688fa', action: 'attack', event: 'projectile', delay: 0.3, duration: 1.5, travelSeconds: 0.3 },
      { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.6, duration: 1.5 },
      { system: STRANDS, action: 'cast', event: 'projectile', delay: 0.6, duration: 1, travelSeconds: 0.4 },
      { system: HEAL_RING, action: 'cast', event: 'cast-start', delay: 1, duration: 1.5 },
    ];
    const ids = ['ffa688fa', '0f2af66b', STRANDS, HEAL_RING, SPIKES];
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: Object.fromEntries(ids.map(s => [s, `systems/${s}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills: { vladimir: exported } }
      : syntheticSystem(),
    readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
    const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; unit.root.position.set(units.size * 40, 0, 0); scene.add(unit.root); unit.root.updateMatrixWorld(); units.set(id, unit); } return unit; };
    const runtime = createLtkRuntime(library, scene, find);
    await runtime.warm('vladimir');
    const refused = { ...LTK_RUN_STATS.refused };
    for (const targets of [['foe'], ['foe', 'foe2']]) expect(runtime.play('vladimir', 'vlad', targets, 'cast')).toBe(true);
    expect(LTK_RUN_STATS.refused).toEqual(refused);
    runtime.dispose();
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
    // Each ring is planned on the heal event itself (and its cue has no delay): it starts on the heal's tick.
    const ringPlans = createBatch1VfxEvents(id => defs[id]).batch(events).filter(plan => plan.extra.some(fx => fx.skill === 'vladimir-heal'));
    expect(ringPlans.length).toBeGreaterThan(0);
    expect(ringPlans.every(plan => plan.event.type === 'heal' && plan.event.targetId === 'me')).toBe(true);
  });
});
