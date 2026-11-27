import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents, playBatch1Visual } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withFlightSeconds } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { stepCombat, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit } from './combat-helpers';

// Maddie's volley (rules 'maddie-shot'): each shot leaves on the rules' launch and flies the rules' own flight, so it reaches
// its enemy on the tick the rules land it and settle its damage; the hit plays with that damage.
const launched = (tick: number, arrivalTick: number, targetId = 'e') => ({ type: 'abilityProjectileLaunched', tick, eventSeq: tick, sourceId: 'm', targetId,
  arrivalTick, skill: 'maddie-shot', ordinal: 0, actionSeq: 1, count: 6 }) as unknown as DisplayCombatEvent;
const damage = (tick: number, targetId = 'e') => ({ type: 'packetDamage', tick, eventSeq: tick + 1000, sourceId: 'm', targetId, damageType: 'physical',
  hpDamage: 40, absorbed: 0, critical: false, hit: true, killingPacket: false, delivery: 'ability-direct', sourceKind: 'ability' }) as unknown as DisplayCombatEvent;

describe("Maddie's shots follow the rules' launch and landing", () => {
  it('the shot plays on the launch with the rules\' flight; the hit plays with the damage; nothing on the cast', () => {
    const events = createBatch1VfxEvents(id => (id === 'm' ? 'maddie' : 'amumu'));
    const [launch] = events.batch([launched(10, 16)]), [land] = events.batch([damage(16)]);
    expect(launch.extra).toEqual([{ champion: 'maddie', sourceId: 'm', targets: ['e'], action: 'passive', skill: 'maddie-shot', flightSeconds: 6 * 0.05 }]);
    expect(land.extra).toEqual([{ champion: 'maddie', sourceId: 'm', targets: ['e'], action: 'passive', skill: 'maddie-hit' }]);
  });
  it('the shot cue is a projectile only, the hit cue a hit only, both without a delay', () => {
    expect(CUE_EXTRA_SKILLS['maddie-shot']!.map(c => [c.event, c.delay])).toEqual([['projectile', 0]]);
    expect(CUE_EXTRA_SKILLS['maddie-hit']!.map(c => [c.event, c.delay])).toEqual([['hit', 0]]);
  });
  it('passes the flight to the runtime, where the projectile flies exactly that long', () => {
    const calls: unknown[] = [];
    playBatch1Visual({ play: (...args) => { calls.push(args[4]); return true; }, playing: () => false },
      { champion: 'maddie', sourceId: 'm', targets: ['e'], action: 'passive', skill: 'maddie-shot', flightSeconds: 0.3 });
    expect(calls).toEqual([{ variant: undefined, skill: 'maddie-shot', snapshotTargets: undefined, flightSeconds: 0.3 }]);
    const shot = withFlightSeconds(CUE_EXTRA_SKILLS['maddie-shot']![0]!, 0.3);
    expect(shot.travelSeconds).toBe(0.3);
  });
  it('real rules: every shot reaches its enemy on the tick its damage lands (within 2 ticks)', () => {
    const maddie = unit('m', 'player', 3, 7, { definitionId: 'maddie', starLevel: 2, ability: resolveAbility('maddie-ability', 2), hp: 10000, maxHp: 10000,
      mana: 100, maxMana: 100, attackDamage: 100, abilityPower: 100, attackRange: 20, baseAttackSpeedBps: 1, cooldownTicks: 1000, moveCooldownTicks: 1000,
      runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [] });
    const enemy = unit('e', 'enemy', 3, 1, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0,
      maxMana: 0, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [] });
    let state = battle([maddie, enemy], { rngState: 42 });
    const steps: { tick: number; events: readonly CombatEvent[] }[] = [];
    for (let n = 0; n < 60 && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; steps.push({ tick: state.tick, events: r.events }); }
    const shots = steps.flatMap(s => s.events.filter(e => e.type === 'abilityProjectileLaunched').map(e => e as Extract<CombatEvent, { type: 'abilityProjectileLaunched' }>));
    expect(shots.length).toBeGreaterThan(1);
    const damageTicks = steps.filter(s => s.events.some(e => e.type === 'packetDamage' && (e as { outcome: { context: { source: { ownerId: string } } } }).outcome.context.source.ownerId === 'm')).map(s => s.tick);
    const events = createBatch1VfxEvents(id => (id === 'm' ? 'maddie' : 'amumu'));
    for (const shot of shots) {
      const [plan] = events.batch([shot as unknown as DisplayCombatEvent]);
      const drawn = plan.extra.find(x => x.skill === 'maddie-shot')!;
      // Drawn from the launch tick, it reaches its enemy flightSeconds later.
      const reaches = shot.tick + drawn.flightSeconds! / 0.05;
      expect(Math.min(...damageTicks.map(t => Math.abs(t - reaches)))).toBeLessThanOrEqual(2);
    }
  });
});
