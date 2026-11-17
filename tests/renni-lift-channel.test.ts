import { expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, applyStatus, origin, variable, type S13Unit } from '../src/simulation/combat-s13-state';
import { RENNI_LIFT_TICKS, RENNI_SLAM_AFTER_STUN_TICKS } from '../src/simulation/cast-windup';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// User-approved (2026-11-17): Renni holds her target from her cast until the slam lands and does not attack meanwhile (channel,
// as Nunu and Sevika). docs/S13_RULES_GAP.md.
function renni(): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: 'renni', ability: resolveAbility('renni-ability', 1), hp: 3000, maxHp: 5000, armor: 0, magicResist: 0,
    mana: 100, maxMana: 100, attackDamage: 100, attackRange: 1, abilityPower: 100, baseAttackSpeedBps: 20000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] });
}
const dummy = (id: string, col: number, row = 3): CombatUnit => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
  hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
const attacks = (events: readonly CombatEvent[]) => packets(events).filter(x => x.source.ownerId === 'p' && x.source.sourceKind !== 'ability');
function steps(state: CombatState, count: number) {
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; out.push({ tick: state.tick, events: r.events }); }
  return { state, out };
}

it('Renni does not attack from her cast until the slam lands, and attacks again after it', () => {
  const cast = stepCombat(battle([renni(), dummy('e', 1, 2)], { rngState: 42 })), castTick = cast.state.tick;
  expect(cast.events.some(e => e.type === 'cast')).toBe(true);
  const n = Math.round(variable(cast.state.units.find(u => u.id === 'p')!, 'StunDuration') * 20), slam = castTick + RENNI_LIFT_TICKS + n + RENNI_SLAM_AFTER_STUN_TICKS;
  const channel = cast.state.units.find(u => u.id === 'p')!.statuses!.find(s => s.kind === 'channel')!;
  expect([channel.startsAtTick, channel.expiresAtTick]).toEqual([castTick, slam]);
  const held = steps(cast.state, slam - castTick - 1);
  expect(held.out.flatMap(s => attacks(s.events))).toEqual([]);
  // Her own lift, per-tick maul and slam still land.
  expect(held.out.some(s => s.events.some(e => e.type === 'carryChanged' && e.carried))).toBe(true);
  const after = steps(held.state, 40);
  expect(after.out.flatMap(s => attacks(s.events)).length).toBeGreaterThan(0);
});

it('a control on her cancels the channel, but she still does not attack until the slam lands; she attacks after it', () => {
  const cast = stepCombat(battle([renni(), dummy('e', 1, 2)], { rngState: 42 })), castTick = cast.state.tick;
  const n = Math.round(variable(cast.state.units.find(u => u.id === 'p')!, 'StunDuration') * 20), slam = castTick + RENNI_LIFT_TICKS + n + RENNI_SLAM_AFTER_STUN_TICKS;
  // Stunned for 10 ticks mid-lift; the stun ends well before the slam.
  const lifted = steps(cast.state, RENNI_LIFT_TICKS + 2).state, stunned = structuredClone(lifted);
  const p = stunned.units.find(u => u.id === 'p')! as S13Unit;
  applyStatus(p, origin(stunned.units.find(u => u.id === 'e')!), 'stun', 0, 10, stunned.tick, [], true);
  const control = steps(stunned, 12);
  // Premise: the control cancelled her channel, and the stun is over before the slam.
  const after = control.state.units.find(u => u.id === 'p')!;
  expect((after.statuses ?? []).some(s => s.kind === 'channel' && s.expiresAtTick > control.state.tick)).toBe(false);
  expect((after.statuses ?? []).some(s => s.kind === 'stun' && s.expiresAtTick > control.state.tick)).toBe(false);
  expect(control.state.tick).toBeLessThan(slam - 1);
  const held = steps(control.state, slam - 1 - control.state.tick);
  expect([...control.out, ...held.out].flatMap(s => attacks(s.events))).toEqual([]);
  // The lift, its pulses and the slam still land on time.
  expect(held.out.some(s => s.events.some(e => e.type === 'carryChanged' && !e.carried))).toBe(true);
  const rest = steps(held.state, 40);
  expect(rest.out[0]!.events.some(e => e.type === 'packetDamage' && e.outcome.context.source.definitionId === 'renni-ability')).toBe(true);
  expect(rest.out.flatMap(s => attacks(s.events)).length).toBeGreaterThan(0);
});
