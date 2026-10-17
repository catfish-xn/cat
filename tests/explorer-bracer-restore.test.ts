import { beforeAll, describe, expect, it } from 'vitest';
import { deployMatchUnit, equipItem, startMatchCombat, stepMatch, type MatchCommandResult, type MatchEvent, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { variable } from '../src/simulation/combat-s13-state';
import { abilityPowerCandidates } from '../src/simulation/m8/item-restore';
import { effectIdentity } from '../src/simulation/m8/identity';
import { compileMechanismDefinitions } from '../src/simulation/m8/s13-definitions';
import type { CombatUnit } from '../src/simulation/combat-types';
import { publicEquipmentPreparation } from './fixtures/m8-b4-match';

const BRACER = 'TFT_Item_Artifact_SeekersArmguard';
const accepted = (result: MatchCommandResult): MatchState => {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

const holder = (state: MatchState) => state.combat!.units.find(u => u.definitionId === 'lux')!;
const bracerRuntimes = (unit: CombatUnit) => unit.triggerLedger?.runtimes.filter(r => r.source.definitionId === BRACER) ?? [];

/** All assets, upgrades and combat come through public commands. No combat
 * stats, enemy HP, mana, trigger receipts or sampled damage are patched. */
function startBracerFight(): MatchState {
  let state = publicEquipmentPreparation(['rod']);
  for (let i = 0; i < 8; i++) state = accepted(grantMechanicUnit(state, { receiptId: `lux-${i}`, source: 'test', definitionId: 'lux' }));
  state = accepted(grantMechanicItem(state, { receiptId: 'bracer-restore', source: 'test', definitionId: BRACER }));
  const lux = state.preparation.units.find(u => u.definitionId === 'lux')!;
  state = accepted(equipItem(state, state.items.at(-1)!.id, lux.id, 0));
  state = accepted(deployMatchUnit(state, lux.id, { kind: 'board', cell: { col: 1, row: 4 } }));
  return accepted(startMatchCombat(state));
}
function finish(from: MatchState) {
  let state = from;
  const events: MatchEvent[] = [];
  while (state.phase === 'combat') {
    const result = stepMatch(state); state = result.state; events.push(...result.events);
  }
  return { state, events };
}

let initial: MatchState, stacked: MatchState, terminal: MatchState;
const checkpoints: { state: MatchState; eventOffset: number }[] = [];
const events: MatchEvent[] = [], history: { tick: number; ap: number }[] = [];
beforeAll(() => {
  initial = startBracerFight();
  checkpoints.push({ state: initial, eventOffset: 0 });
  let state = initial, previousCount = 0;
  while (state.phase === 'combat') {
    const unit = holder(state);
    history.push({ tick: state.combat!.tick, ap: readCombatStats(unit, state.combat!).abilityPower });
    const result = stepMatch(state); state = result.state; events.push(...result.events);
    const count = bracerRuntimes(holder(state)).reduce((n, r) => n + r.triggerCount, 0);
    const regression = !stacked && count >= 2 && holder(state).runtime!.nextAttackMagic > 0;
    if (count !== previousCount || regression) checkpoints.push({ state, eventOffset: events.length });
    if (regression) stacked = state;
    previousCount = count;
  }
  terminal = state;
  expect(stacked, 'the live fight must cast after two bracer kills').toBeDefined();
});

describe('Seeker\'s Armguard save/restore', () => {
  it('restores the real mid-stack save whose empowered magic was rejected on d3112d6', () => {
    expect(bracerRuntimes(holder(stacked)).map(r => r.triggerCount)).toEqual([2]);
    expect(holder(stacked).runtime!.abilityPowerFlat).toBe(40);
    expect(holder(stacked).runtime!.nextAttackMagic).toBe(1530);
    expect(restoreMatch(JSON.stringify(stacked))).toEqual(stacked);
    expect(restoreMatch(structuredClone(stacked))).toEqual(stacked);
  });

  it('restores before, during and after stacking, then continues with identical state, events and RNG', () => {
    expect(new Set(checkpoints.map(c => holder(c.state).runtime!.abilityPowerFlat))).toEqual(new Set([0, 20, 40, 60]));
    for (const checkpoint of checkpoints) {
      const saved = serializeMatch(checkpoint.state), restored = restoreMatch(saved);
      expect(restored).toEqual(checkpoint.state);
      expect(serializeMatch(restored)).toBe(saved);
      expect(finish(restored)).toEqual({ state: terminal, events: events.slice(checkpoint.eventOffset) });
    }
  });

  it('includes every AP the live holder sampled, including earlier casts after more stacks settle', () => {
    const current = holder(terminal), unknownTime = abilityPowerCandidates(current, 0, terminal.combat!.combatId!);
    for (const sample of history) {
      expect(unknownTime.has(sample.ap), `AP ${sample.ap} at tick ${sample.tick}`).toBe(true);
      if (sample.tick > 0) expect(abilityPowerCandidates(current, sample.tick, terminal.combat!.combatId!).has(sample.ap)).toBe(true);
    }
  });

  it.each([
    ['off-lattice current AP', (u: CombatUnit) => Object.assign(u.runtime!, { abilityPowerFlat: u.runtime!.abilityPowerFlat + 1 }), 'derived ability power'],
    ['an extra whole current stack', (u: CombatUnit) => Object.assign(u.runtime!, { abilityPowerFlat: u.runtime!.abilityPowerFlat + 20 }), 'derived ability power'],
    ['a missing settled stack', (u: CombatUnit) => Object.assign(u.runtime!, { abilityPowerFlat: u.runtime!.abilityPowerFlat - 20 }), 'derived ability power'],
    ['off-lattice sampled damage', (u: CombatUnit) => Object.assign(u.runtime!, { nextAttackMagic: u.runtime!.nextAttackMagic + 1 }), 'derived empowered magic'],
    ['a future sampled kill stack', (u: CombatUnit) => Object.assign(u.runtime!, { nextAttackMagic: Math.floor((u.abilityPower! + 60) * variable(u, 'Damage') / 100) }), 'derived empowered magic'],
    ['an unearned sampled assist', (u: CombatUnit) => Object.assign(u.runtime!, { nextAttackMagic: Math.floor((u.abilityPower! + 15) * variable(u, 'Damage') / 100) }), 'derived empowered magic'],
    ['an extra trigger receipt count', (u: CombatUnit) => Object.assign(bracerRuntimes(u)[0], { triggerCount: 3 }), 'derived ability power'],
    ['a missing trigger receipt', (u: CombatUnit) => Object.assign(u.triggerLedger!, { runtimes: [] }), 'derived ability power'],
  ] as const)('rejects %s for both JSON and object saves', (_name, edit, reason) => {
    const bad = structuredClone(stacked); edit(holder(bad));
    for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow(`Invalid Match save: ${reason}`);
    expect(restoreMatch(JSON.stringify(stacked))).toEqual(stacked);
  });
});

describe('finite sampled bracer AP candidates', () => {
  /** Arithmetic fixtures use the real compiled item declarations with explicit
   * settled counts. They are not submitted as provenance-complete Match saves. */
  function counted(kills: number, assists: number): CombatUnit {
    const unit = structuredClone(holder(initial));
    const runtimes = unit.mechanismDefinitions!.eventTriggers!.filter(t => t.source.definitionId === BRACER).flatMap(t => {
      const count = t.id === 'kill' ? kills : assists;
      return count ? [{ ...effectIdentity(initial.combat!.combatId!, t.source, unit.id), startsAtTick: 10, expiresAtTick: null,
        stacks: 0, triggerCount: count, counters: {}, consumedRewards: [], nextEligibleTick: 10, consumed: false, stackPolicy: t.stackPolicy }] : [];
    });
    return { ...unit, triggerLedger: { runtimes, processed: {}, actionCounts: {} } };
  }

  it.each([[0, 0], [1, 0], [2, 0], [0, 3], [2, 3]])('enumerates precisely 0..%i kills and 0..%i assists', (kills, assists) => {
    const unit = counted(kills, assists), expected = new Set<number>();
    for (let k = 0; k <= kills; k++) for (let a = 0; a <= assists; a++) expected.add(unit.abilityPower! + k * 20 + a * 15);
    expect(abilityPowerCandidates(unit, 0, initial.combat!.combatId!)).toEqual(expected);
    expect(abilityPowerCandidates(unit, 10, initial.combat!.combatId!)).toEqual(expected);
    expect(abilityPowerCandidates(unit, 9, initial.combat!.combatId!)).toEqual(new Set([unit.abilityPower!]));
  });

  it('respects a declared stack cap even when more triggers have settled', () => {
    const unit = counted(3, 0);
    const itemPrograms = unit.itemPrograms!.map(p => ({ ...p, program: { ...p.program, triggers: p.program.triggers!.map(t => ({ ...t,
      effects: t.effects.map(e => e.kind === 'modify-stat' ? { ...e, stackPolicy: { kind: 'add-stacks' as const, cap: 2 } } : e) })) } }));
    expect(abilityPowerCandidates({ ...unit, itemPrograms }, 0, initial.combat!.combatId!)).toEqual(new Set([unit.abilityPower!, unit.abilityPower! + 20, unit.abilityPower! + 40]));
  });

  it('never borrows another copy\'s settled count or another trigger\'s effect block', () => {
    const unit = counted(2, 0), first = unit.itemPrograms![0];
    const second = { ...first, source: { ...first.source, instanceId: 'second-bracer' } };
    const doubled = { ...unit, abilityPower: unit.abilityPower! + 30, itemPrograms: [...unit.itemPrograms!, second] };
    const definitions = compileMechanismDefinitions(doubled, initial.combat!.combatId!);
    const kill = definitions.eventTriggers!.find(t => t.source.instanceId === second.source.instanceId && t.id === 'kill')!;
    const oneKill = { ...bracerRuntimes(unit)[0], ...effectIdentity(initial.combat!.combatId!, kill.source, unit.id), triggerCount: 1 };
    const expected = new Set([doubled.abilityPower!, doubled.abilityPower! + 20, doubled.abilityPower! + 40]);
    expect(abilityPowerCandidates(doubled, 0, initial.combat!.combatId!)).toEqual(expected);
    expected.add(doubled.abilityPower! + 60);
    expect(abilityPowerCandidates({ ...doubled, triggerLedger: { ...unit.triggerLedger!, runtimes: [...unit.triggerLedger!.runtimes, oneKill] } }, 0, initial.combat!.combatId!)).toEqual(expected);
  });
});
