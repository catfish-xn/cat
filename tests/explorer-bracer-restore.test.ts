import { beforeAll, describe, expect, it } from 'vitest';
import { stepMatch, type MatchEvent, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { validateArtifactCombatFixture, artifactCombatFixtureText } from './fixtures/artifact-combat-validation';
import { readCombatStats } from '../src/simulation/combat-s13';
import { variable } from '../src/simulation/combat-s13-state';
import { abilityPowerCandidates } from '../src/simulation/m8/item-restore';
import { effectIdentity } from '../src/simulation/m8/identity';
import { compileMechanismDefinitions } from '../src/simulation/m8/s13-definitions';
import type { CombatUnit } from '../src/simulation/combat-types';
import { BRACER, startBracerFight, stackedBracerSave } from './fixtures/explorer-bracer-public';

const holder = (state: MatchState) => state.combat!.units.find(u => u.definitionId === 'lux')!;
const bracerRuntimes = (unit: CombatUnit) => unit.triggerLedger?.runtimes.filter(r => r.source.definitionId === BRACER) ?? [];

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

it('Match boundaries reject mechanic-granted bracer fixtures before they can claim preparation provenance', () => {
  // Covers the old initial, mid-stack, settled and continuation checkpoint controls.
  for (const state of [initial, stacked, terminal, ...checkpoints.map(c => c.state)]) {
    for (const input of [state, JSON.stringify(state)])
      expect(() => restoreMatch(input)).toThrow('Invalid Match save: preparation-ledger-command-rejected');
    expect(() => serializeMatch(state)).toThrow('Invalid Match save: preparation-ledger-command-rejected');
  }
});

describe('Seeker\'s Armguard direct production combat validators', () => {
  it.each([false, true])('rejects coordinated count/AP/sample edits (sample edited = %s)', sampled => {
    expect(stacked.combat!.tick).toBe(410);
    validateArtifactCombatFixture(JSON.stringify(stacked));
    const control = structuredClone(stacked);
    expect(finish(control)).toEqual(finish(stacked));
    const bad = structuredClone(stacked), u = holder(bad);
    Object.assign(bracerRuntimes(u)[0], { triggerCount: 3 });
    Object.assign(u.runtime!, { abilityPowerFlat: 60, ...(sampled ? { nextAttackMagic: 1710 } : {}) });
    for (const input of [bad, JSON.stringify(bad)]) expect(() => validateArtifactCombatFixture(input)).toThrow('Invalid Match save');
  });

  it('rejects coordinated growth even when actionCounts and processed are rebuilt too', () => {
    const bad = structuredClone(stacked), u = holder(bad), receipt = bracerRuntimes(u)[0];
    const kill = u.mechanismDefinitions!.eventTriggers!.find(t => t.source.effectIndex === receipt.source.effectIndex)!;
    Object.assign(receipt, { triggerCount: 3 });
    Object.assign(u.runtime!, { abilityPowerFlat: 60, nextAttackMagic: 1710 });
    Object.assign(u.triggerLedger!.actionCounts, { [JSON.stringify([receipt.key, kill.id, u.id, bad.combat!.nextActionSeq! - 1])]: 1 });
    Object.assign(u.triggerLedger!.processed, { [JSON.stringify(['trigger', receipt.key, kill.id, kill.event, kill.aggregation])]: bad.combat!.nextTriggerEventSeq! - 1 });
    for (const input of [bad, JSON.stringify(bad)]) expect(() => validateArtifactCombatFixture(input)).toThrow('Invalid Match save: sampled stat trigger facts');
    expect(() => validateArtifactCombatFixture(JSON.stringify(stacked))).not.toThrow();
    expect(JSON.parse(JSON.stringify(stacked))).toEqual(stacked);
  });

  it('rejects a fabricated tick-zero kill receipt and AP20 beside its public control', () => {
    validateArtifactCombatFixture(JSON.stringify(initial));
    const control = structuredClone(initial);
    expect(finish(control)).toEqual(finish(initial));
    const bad = structuredClone(initial), u = holder(bad);
    const kill = u.mechanismDefinitions!.eventTriggers!.find(t => t.source.definitionId === BRACER && t.id === 'kill')!;
    const receipt = { ...effectIdentity(bad.combat!.combatId!, kill.source, u.id), startsAtTick: 0, expiresAtTick: null,
      stacks: 0, triggerCount: 1, counters: {}, consumedRewards: [], nextEligibleTick: 0, consumed: false, stackPolicy: kill.stackPolicy };
    Object.assign(u, { triggerLedger: { runtimes: [receipt], processed: {}, actionCounts: {} } });
    Object.assign(u.runtime!, { abilityPowerFlat: 20 });
    for (const input of [bad, JSON.stringify(bad)]) expect(() => validateArtifactCombatFixture(input)).toThrow('Invalid Match save');
  });

  it('rejects transferring Lux kills to Irelia with rebuilt owner/item/trigger identities', () => {
    const state = stackedBracerSave(true);
    for (const input of [state, JSON.stringify(state)])
      expect(() => restoreMatch(input)).toThrow('Invalid Match save: preparation-ledger-command-rejected');
    expect(() => serializeMatch(state)).toThrow('Invalid Match save: preparation-ledger-command-rejected');
    validateArtifactCombatFixture(JSON.stringify(state));
    const control = structuredClone(state);
    expect(finish(control)).toEqual(finish(state));
    const bad = structuredClone(state), lux = holder(bad), irelia = bad.combat!.units.find(u => u.definitionId === 'irelia' && u.team === 'player')!;
    const luxKill = lux.mechanismDefinitions!.eventTriggers!.find(t => t.source.definitionId === BRACER && t.id === 'kill')!;
    const old = bracerRuntimes(lux).find(r => r.source.effectIndex === luxKill.source.effectIndex)!;
    const kill = irelia.mechanismDefinitions!.eventTriggers!.find(t => t.source.definitionId === BRACER && t.id === 'kill')!;
    const moved = { ...old, ...effectIdentity(bad.combat!.combatId!, kill.source, irelia.id) };
    const oldLedger = lux.triggerLedger!, newLedger = irelia.triggerLedger!;
    const movedProcessed: Record<string, number> = {}, movedActions: Record<string, number> = {};
    const processed = { ...oldLedger.processed }, actionCounts = { ...oldLedger.actionCounts };
    for (const [key, count] of Object.entries(processed)) {
      const tuple = JSON.parse(key);
      if (tuple[0] === 'trigger' && tuple[1] === old.key) { tuple[1] = moved.key; movedProcessed[JSON.stringify(tuple)] = count; delete processed[key]; }
    }
    for (const [key, count] of Object.entries(actionCounts)) {
      const tuple = JSON.parse(key);
      if (tuple[0] === old.key) { tuple[0] = moved.key; tuple[2] = irelia.id; movedActions[JSON.stringify(tuple)] = count; delete actionCounts[key]; }
    }
    Object.assign(lux, { triggerLedger: { ...oldLedger, runtimes: oldLedger.runtimes.filter(r => r !== old), processed, actionCounts } });
    Object.assign(irelia, { triggerLedger: { ...newLedger, runtimes: [...newLedger.runtimes.filter(r => r.key !== moved.key), moved],
      processed: { ...newLedger.processed, ...movedProcessed }, actionCounts: { ...newLedger.actionCounts, ...movedActions } } });
    Object.assign(lux.runtime!, { abilityPowerFlat: lux.runtime!.abilityPowerFlat - old.triggerCount * 20 });
    Object.assign(irelia.runtime!, { abilityPowerFlat: old.triggerCount * 20 });
    for (const input of [bad, JSON.stringify(bad)]) expect(() => validateArtifactCombatFixture(input)).toThrow('Invalid Match save');
  });

  it('direct validators accept the live mid-stack combat fixture whose empowered magic was rejected on d3112d6', () => {
    expect(bracerRuntimes(holder(stacked)).map(r => r.triggerCount)).toEqual([2]);
    expect(holder(stacked).runtime!.abilityPowerFlat).toBe(40);
    expect(holder(stacked).runtime!.nextAttackMagic).toBe(1530);
    expect(() => validateArtifactCombatFixture(JSON.stringify(stacked))).not.toThrow();
    expect(JSON.parse(JSON.stringify(stacked))).toEqual(stacked);
    expect(() => validateArtifactCombatFixture(structuredClone(stacked))).not.toThrow();
    expect(structuredClone(stacked)).toEqual(stacked);
  });

  it('direct validators accept before, during and after stacking, then continues with identical state, events and RNG', () => {
    expect(new Set(checkpoints.map(c => holder(c.state).runtime!.abilityPowerFlat))).toEqual(new Set([0, 20, 40, 60]));
    for (const checkpoint of checkpoints) {
      const saved = artifactCombatFixtureText(checkpoint.state);
      validateArtifactCombatFixture(saved);
      const validated: MatchState = JSON.parse(saved);
      expect(validated).toEqual(checkpoint.state);
      expect(artifactCombatFixtureText(validated)).toBe(saved);
      expect(finish(validated)).toEqual({ state: terminal, events: events.slice(checkpoint.eventOffset) });
    }
  });

  it('direct production bounds reject 5,000,000 bracer triggers / 100,000,000 AP beside the legal stack control', () => {
    expect(() => validateArtifactCombatFixture(stacked)).not.toThrow();
    expect(structuredClone(stacked)).toEqual(stacked);
    const bad = structuredClone(stacked), unit = holder(bad);
    Object.assign(bracerRuntimes(unit)[0], { triggerCount: 5_000_000 });
    Object.assign(unit.runtime!, { abilityPowerFlat: 100_000_000 });
    for (const input of [bad, JSON.stringify(bad)])
      expect(() => validateArtifactCombatFixture(input)).toThrow('Invalid Match save: sampled stat trigger count bound');
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
    ['an extra trigger receipt count', (u: CombatUnit) => Object.assign(bracerRuntimes(u)[0], { triggerCount: 3 }), 'sampled stat trigger facts'],
    ['a missing trigger receipt', (u: CombatUnit) => Object.assign(u.triggerLedger!, { runtimes: [] }), 'sampled stat trigger facts'],
  ] as const)('rejects %s for both JSON and object combat fixtures', (_name, edit, reason) => {
    const bad = structuredClone(stacked); edit(holder(bad));
    for (const input of [bad, JSON.stringify(bad)]) expect(() => validateArtifactCombatFixture(input)).toThrow(`Invalid Match save: ${reason}`);
    expect(() => validateArtifactCombatFixture(JSON.stringify(stacked))).not.toThrow();
    expect(JSON.parse(JSON.stringify(stacked))).toEqual(stacked);
  });
});

describe('finite sampled bracer AP candidates', () => {
  /** Arithmetic fixtures use the real compiled item declarations with explicit
   * settled counts. They are not submitted as provenance-complete Match saves. */
  function counted(kills: number, assists: number): CombatUnit {
    const unit = structuredClone(holder(initial));
    const actionCounts: Record<string, number> = {};
    const runtimes = unit.mechanismDefinitions!.eventTriggers!.filter(t => t.source.definitionId === BRACER).flatMap(t => {
      const count = t.id === 'kill' ? kills : assists;
      const identity = effectIdentity(initial.combat!.combatId!, t.source, unit.id);
      for (let i = 0; i < count; i++) actionCounts[JSON.stringify([identity.key, t.id, unit.id, i])] = 1;
      return count ? [{ ...identity, startsAtTick: 10, expiresAtTick: null,
        stacks: 0, triggerCount: count, counters: {}, consumedRewards: [], nextEligibleTick: 10, consumed: false, stackPolicy: t.stackPolicy }] : [];
    });
    return { ...unit, mechanismState: { ...unit.mechanismState!, sampledAtTick: 10 }, triggerLedger: { runtimes, processed: {}, actionCounts } };
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
    expect(abilityPowerCandidates({ ...doubled, triggerLedger: { ...unit.triggerLedger!, runtimes: [...unit.triggerLedger!.runtimes, oneKill],
      actionCounts: { ...unit.triggerLedger!.actionCounts, [JSON.stringify([oneKill.key, kill.id, unit.id, 1])]: 1 } } }, 0, initial.combat!.combatId!)).toEqual(expected);
  });

  it('rejects a huge standalone count before constructing any layer-sized array', () => {
    const unit = counted(2, 0);
    Object.assign(bracerRuntimes(unit)[0], { triggerCount: 5_000_000 });
    expect(() => abilityPowerCandidates(unit, 0, initial.combat!.combatId!)).toThrow('Invalid Match save: sampled stat trigger count');
  });
});
