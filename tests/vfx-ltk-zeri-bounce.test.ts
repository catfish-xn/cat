import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents, isZeriBounce } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { CUE_EXTRA_SKILLS, ZERI_BOUNCE_FLIGHT_SECONDS, ZERI_BOUNCE_SECONDS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { BEAM_FLIGHT_SECONDS, bonePoint, landingCues } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Zeri's empowered attack: her arc and spark on her main target go off together on the rules' launch tick (an instant beam),
// and every enemy the rules bounce her spark to gets her spark and an arc from the main target a moment later.
const ARC = 'd160dfa9', SPARK = 'c4b3f285', CHEST = 'C_BUFFBONE_GLB_CHEST_LOC';
const defs: Record<string, string> = { z: 'zeri', a: 'amumu', b: 'amumu', c: 'amumu', x: 'twitch' };
const packet = (tick: number, sourceId: string, targetId: string, delivery: string, sourceKind: string) =>
  ({ type: 'packetDamage', tick, sourceId, targetId, damageType: 'physical', delivery, sourceKind, definitionId: `${defs[sourceId]}-ability` }) as unknown as DisplayCombatEvent;
const attack = (tick: number, attackerId: string, targetId: string) => ({ type: 'attack', tick, attackerId, targetId }) as unknown as DisplayCombatEvent;
const bounceOf = (events: DisplayCombatEvent[]) => createBatch1VfxEvents(id => defs[id]).batch(events)
  .flatMap(plan => plan.extra).filter(fx => fx.skill === 'zeri-bounce');

describe('Zeri spark bounces', () => {
  it('plays on every enemy her bounce damage strikes that tick, from her main target', () => {
    const fx = bounceOf([attack(40, 'z', 'a'), packet(40, 'z', 'a', 'basic-attack', 'attack'), packet(40, 'z', 'b', 'attack-extra', 'ability'),
      packet(40, 'z', 'c', 'attack-extra', 'ability')]);
    expect(fx).toEqual([{ champion: 'zeri', sourceId: 'z', targets: ['a', 'b', 'c'], action: 'passive', skill: 'zeri-bounce', snapshotTargets: true }]);
  });
  it('ignores other attack-extra damage: an item proc, another tick, another hero, her main target again', () => {
    expect(bounceOf([attack(40, 'z', 'a'), packet(40, 'z', 'b', 'attack-extra', 'item'), packet(41, 'z', 'c', 'attack-extra', 'ability')])).toEqual([]);
    expect(bounceOf([attack(40, 'x', 'a'), packet(40, 'x', 'b', 'attack-extra', 'ability')])).toEqual([]);
    expect(bounceOf([attack(40, 'z', 'a'), packet(40, 'z', 'a', 'attack-extra', 'ability')])).toEqual([]);
    expect(isZeriBounce(packet(1, 'z', 'b', 'equipment-proc', 'item') as Extract<DisplayCombatEvent, { type: 'packetDamage' }>)).toBe(false);
  });
  it('bounces to the very enemies the rules strike, in a real combat', () => {
    const units = realUnits({ unit: 'zeri', star: 2, form: null, foe: 'amumu', dist: 3, nfoes: 3, foestar: 2, ally: 'amumu', allystar: 2, allyCell: { row: 4, col: 2 } });
    const shown: DisplayCombatEvent[][] = [];
    runRealCombat(units, 140, (_state, batch) => { shown.push(batch as DisplayCombatEvent[]); }, 1, { kind: 'attack-hit' });
    const planner = createBatch1VfxEvents(id => units.find((u: { id: string }) => u.id === id)?.definitionId);
    let checked = 0;
    for (const batch of shown) {
      const plans = planner.batch(batch);
      for (const plan of plans) if (plan.event.type === 'attack' && (plan.event as { attackerId: string }).attackerId === 'me') {
        const { tick, targetId } = plan.event as { tick: number; targetId: string };
        const struck = batch.filter(e => e.type === 'packetDamage' && e.tick === tick && (e as { sourceId: string }).sourceId === 'me'
          && isZeriBounce(e as Extract<DisplayCombatEvent, { type: 'packetDamage' }>)).map(e => (e as { targetId: string }).targetId);
        const fx = plan.extra.filter(x => x.skill === 'zeri-bounce');
        if (!struck.length) { expect(fx).toEqual([]); continue; }
        expect(fx).toHaveLength(1);
        expect(fx[0]!.targets).toEqual([targetId, ...struck.filter(id => id !== targetId)]);
        checked++;
      }
    }
    // Her spark bounced at least once in the window (every third attack, with two foes beside her target).
    expect(checked).toBeGreaterThan(0);
  });
  it("reuses her empowered arc and spark, each bounce from the main target's chest, a fitted moment later", () => {
    const empowered = BATCH1_TIMELINES.zeri.filter(cue => cue.variant === 'empowered');
    const cues = CUE_EXTRA_SKILLS['zeri-bounce']!;
    expect(cues.map(cue => cue.system).sort()).toEqual([ARC, SPARK].sort());
    const arc = cues.find(cue => cue.system === ARC)!, spark = cues.find(cue => cue.system === SPARK)!;
    expect(arc).toMatchObject({ event: 'projectile', everyReceipt: true, fromPrimary: true, fromBone: CHEST, targetBone: CHEST, delay: ZERI_BOUNCE_SECONDS });
    expect(ZERI_BOUNCE_FLIGHT_SECONDS).toBe(BEAM_FLIGHT_SECONDS);
    const { variant: _v, ...hit } = empowered.find(cue => cue.system === SPARK)!;
    expect(spark).toEqual({ ...hit, action: 'passive', everyReceipt: true, delay: ZERI_BOUNCE_SECONDS });
    expect(ZERI_BOUNCE_SECONDS).toBeGreaterThan(0);
    expect(ZERI_BOUNCE_SECONDS).toBeLessThan(0.2);
    const { spawns } = mapSkillTimeline(cues, 'z', ['a', 'b', 'c']);
    expect(spawns.map(s => [s.system, s.targetId, s.fromId ?? null]).sort()).toEqual([[ARC, 'b', 'a'], [ARC, 'c', 'a'], [SPARK, 'b', null], [SPARK, 'c', null]].sort());
    // With no bounce, nothing plays.
    expect(mapSkillTimeline(cues, 'z', ['a']).spawns).toEqual([]);
  });
  it('her main-target arc and spark go off together on the launch tick (instant beam)', () => {
    const empowered = BATCH1_TIMELINES.zeri.filter(cue => cue.variant === 'empowered');
    const launched = landingCues(empowered, { seconds: 0, beam: true, phase: 'launch' });
    expect(launched.map(cue => [cue.system, cue.delay]).sort()).toEqual([[ARC, 0], [SPARK, 0]].sort());
  });
  it('finds a bone where it stands on the unit', () => {
    const root = new Object3D(), body = new Object3D(), chest = new Object3D();
    chest.name = CHEST; chest.position.set(0, 1.5, 0); root.position.set(2, 0, -3);
    body.add(chest); root.add(body); root.updateMatrixWorld(true);
    const at = bonePoint(root, body, CHEST);
    expect(at[0]).toBeCloseTo(2); expect(at[1]).toBeCloseTo(1.5); expect(at[2]).toBeCloseTo(-3);
  });
});
