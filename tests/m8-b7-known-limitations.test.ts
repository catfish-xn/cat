import { describe, expect, it } from 'vitest';
import { stepCombat } from '../src/simulation/combat';
import { compileNeutralEncounter } from '../src/simulation/neutral-encounter-compiler';
import { battle, unit } from './combat-helpers';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

/** B7 regression migrated after the approved B3 fix: never bless the historical defect. */
describe('B7 accepts the fixed B3 charge-control ordering without changing the generic layer', () => {
  it('does not apply stun or emit fake death cleanup for a lethal charge packet', () => {
    const compiled = compileNeutralEncounter('6-7');
    const herald = { ...compiled.units[0], cooldownTicks: 1000, moveCooldownTicks: 1000 };
    // maxHP1000 => 150 charge damage; current HP100 makes that packet lethal.
    const victim = unit('p', 'player', 3, 4, { hp: 100, maxHp: 1000, armor: 0, magicResist: 0,
      cooldownTicks: 1000, moveCooldownTicks: 1000, mana: 0, maxMana: 0,
      ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} } });
    const result = stepCombat(battle([herald, victim], { combatId: 'b7-stun-order', rngDraws: 0, openingDefinitions: compiled.openingDefinitions }));
    const appliedIndex = result.events.findIndex(e => e.type === 'statusChanged' && e.group.targetId === 'p' && e.reason === 'applied' && e.group.kind === 'stun');
    const damageIndex = result.events.findIndex(e => e.type === 'packetDamage' && e.outcome.context.targetId === 'p');
    expect(result.events[damageIndex]).toMatchObject({ outcome: { raw: 150, hpDamage: 100 } });
    expect(damageIndex).toBeGreaterThanOrEqual(0);
    expect(appliedIndex).toBe(-1);
    // B9: channel/redirect cleanup now travels as activityChanged, so both families are checked.
    expect(result.events.some(e => (e.type === 'statusChanged' ? e.group.targetId : e.type === 'activityChanged' ? e.activity.targetId : null) === 'p'
      && 'reason' in e && e.reason === 'death-cleanup')).toBe(false);
    expect(result.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 0, alive: false, statuses: [] });
    expect(result.state.rngDraws).toBe(0);
  });
  it('commits a nonlethal packet before applying next-tick stun to the survivor', () => {
    const compiled = compileNeutralEncounter('6-7');
    const herald = { ...compiled.units[0], cooldownTicks: 1000, moveCooldownTicks: 1000 };
    const victim = unit('p', 'player', 3, 4, { hp: 1000, maxHp: 1000, armor: 0, magicResist: 0,
      cooldownTicks: 1000, moveCooldownTicks: 1000, mana: 0, maxMana: 0,
      ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} } });
    const result = stepCombat(battle([herald, victim], { combatId: 'b7-surviving-stun-order', rngDraws: 0, openingDefinitions: compiled.openingDefinitions }));
    const damageIndex = result.events.findIndex(e => e.type === 'packetDamage' && e.outcome.context.targetId === 'p');
    const appliedIndex = result.events.findIndex(e => e.type === 'statusChanged' && e.group.targetId === 'p' && e.reason === 'applied' && e.group.kind === 'stun');
    expect(damageIndex).toBeGreaterThanOrEqual(0);
    expect(result.events[damageIndex]).toMatchObject({ outcome: { raw: 150, hpDamage: 150 } });
    expect(appliedIndex).toBeGreaterThan(damageIndex);
    // B9: the effective start tick is the frozen contribution's appliedAtTick (was status.startsAtTick).
    expect(result.events[appliedIndex]).toMatchObject({ group: { kind: 'stun', contributions: [{ appliedAtTick: 2, expiresAtTick: 12 }] } });
    expect(result.state.units.find(u => u.id === 'p')).toMatchObject({ hp: 850, alive: true });
    expect(result.state.rngDraws).toBe(0);
  });
});
