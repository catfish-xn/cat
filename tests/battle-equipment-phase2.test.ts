import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, equipItem, openMatchCombatStream, stepMatchCombatStream, startMatchCombat } from '../src/simulation/match';
import { stepCombat } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { compileBattle, startTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { startCombatReplay, createCombatReplayRecorder } from '../src/simulation/combat-replay-view';
import { applyBattleEquipment } from '../src/simulation/battle-equipment';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import type { MatchState, MatchCommandResult } from '../src/simulation/match-types';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { publicInventory } from './fixtures/b8-public-acquisition';
const accepted = (r: MatchCommandResult) => { if (!r.ok) throw Error(r.reason); return r.state; };
function army(definitions = ['sword', 'bow', 'belt']): MatchState {
  let s = createMatch(42);
  s = accepted(deployMatchUnit(s, s.preparation.units[0].id, { kind: 'board', cell: { col: 3, row: 6 } }));
  return { ...s, items: definitions.map((definitionId, i) => ({ id: `item-${i + 1}`, definitionId, location: { kind: 'inventory' } })), nextItemSerial: definitions.length + 1 };
}
const own = (s: MatchState) => s.preparation.units.find(u => u.team === 'player')!.id;

describe('phase 2 battle equipment', () => {
  it('PvE: assets change now, stats change at the next logical tick using the opening compiler', () => {
    const base = army(['sword']); const open = openMatchCombatStream(base); if (!open.ok) throw Error(open.reason);
    const equipped = accepted(equipItem(open.state, 'item-1', own(base), 0));
    expect(equipped.combat!.units).toBe(open.state.combat!.units);
    expect(equipped.combat!.equipmentReceipts).toBeUndefined();
    const visited: number[] = [];
    const next = stepMatchCombatStream(equipped, tick => { visited.push(tick); return equipped.combat!.pendingEquipment!.map(r => r.input); }).state.combat!;
    expect(visited).toEqual([1]);
    const expected = buildStrategySnapshot(accepted(equipItem(base, 'item-1', own(base), 0))).units.find(u => u.unitId === own(base))!;
    expect(next.units.find(u => u.id === own(base))!.attackDamage).toBe(expected.stats.attack);
    expect(next.tick).toBe(1); expect(next.equipmentReceipts).toHaveLength(1);
    expect(next.pendingEquipment).toBeUndefined();
    expect(next.units.find(u => u.id === own(base))!.equipment).toEqual([{ definitionId: 'sword', slot: 0, temporary: false }]);
  });
  it('same tick ordered components combine and install one finished item, without double-counting stats', () => {
    const base = army(), opened = accepted(openMatchCombatStream(base));
    const one = accepted(equipItem(opened, 'item-1', own(base), 0));
    const two = accepted(equipItem(one, 'item-2', own(base), 2));
    const combat = stepMatchCombatStream(two).state.combat!;
    expect(combat.equipmentReceipts!.map(r => r.input.seq)).toEqual([1, 2]);
    const expected = buildStrategySnapshot(accepted(equipItem(accepted(equipItem(base, 'item-1', own(base), 0)), 'item-2', own(base), 2)));
    const unit = combat.units.find(u => u.id === own(base))!;
    expect(unit.attackDamage).toBe(expected.units.find(u => u.unitId === unit.id)!.stats.attack);
    expect(unit.equipment).toEqual([{ definitionId: 'giant-slayer', slot: 0, temporary: false }]);
  });
  it('HP equipment preserves missing health; dead holders stay dead', () => {
    const base = army(['belt']), opened = accepted(openMatchCombatStream(base));
    const equipped = accepted(equipItem(opened, 'item-1', own(base), 0));
    const receipt = equipped.combat!.pendingEquipment![0];
    for (const alive of [true, false]) {
      const combat = { ...opened.combat!, units: opened.combat!.units.map(u => u.id === own(base) ? { ...u, alive, hp: alive ? u.hp - 100 : 0 } : u) };
      const result = applyBattleEquipment(combat, receipt); expect(result.ok).toBe(true);
      const before = combat.units.find(u => u.id === own(base))!, after = result.state.units.find(u => u.id === own(base))!;
      expect(after.maxHp).toBeGreaterThan(before.maxHp);
      expect(after.hp).toBe(alive ? after.maxHp - 100 : 0); expect(after.alive).toBe(alive);
      expect(result.state.rngState).toBe(combat.rngState); expect(result.state.rngDraws).toBe(combat.rngDraws);
    }
  });
  it('failures keep the state, inventory, logs, events, IDs and RNG untouched', () => {
    const base = army(), opened = accepted(openMatchCombatStream(base)), encoded = JSON.stringify(opened);
    for (const args of [['missing', own(base), 0], ['item-1', 'enemy', 0], ['item-1', own(base), 9]] as const) {
      const result = equipItem(opened, args[0], args[1], args[2]); expect(result.ok).toBe(false); expect(result.state).toBe(opened); expect('events' in result).toBe(false);
    }
    expect(JSON.stringify(opened)).toBe(encoded);
    const receipt = accepted(equipItem(opened, 'item-1', own(base), 0)).combat!.pendingEquipment![0];
    const failed = applyBattleEquipment(opened.combat!, { ...receipt, input: { ...receipt.input, effectiveTick: 2 } });
    expect(failed).toMatchObject({ ok: false, reason: 'battle-input-invalid' }); expect(failed.state).toBe(opened.combat);
  });
  it('PvE first pass and a JSON-cloned private transcript replay identical frames and terminal', () => {
    const base = army(), opened = openMatchCombatStream(base); if (!opened.ok || !opened.streamInitial) throw Error('open');
    const events = opened.events.filter(e => e.domain === 'combat') as import('../src/simulation/combat-types').LedgerCombatEvent[];
    const recorder = createCombatReplayRecorder(opened.streamInitial, events);
    let state = opened.state; let terminal: import('../src/simulation/combat-types').CombatState = state.combat!;
    for (let i = 0; i < 1201; i++) {
      if (i === 3) state = accepted(equipItem(state, 'item-1', own(base), 0));
      const step = stepMatchCombatStream(state); terminal = step.terminal ?? step.state.combat!;
      const ledger = step.events.filter(e => e.domain === 'combat') as typeof events;
      recorder.record(state.combat!, { state: terminal, events: ledger }); events.push(...ledger); state = step.state;
      if (step.terminal) break;
    }
    const replay = startCombatReplay(JSON.parse(JSON.stringify({ initial: opened.streamInitial, terminal, events, inputLog: terminal.equipmentReceipts!.map(r => r.input) }))).advance(1201);
    expect(replay).toEqual(recorder.finish(terminal));
  });
  it.each(['a', 'b'])('PvP side %s: namespaced target, next-tick install, slicing and private replay', seatId => {
    const round = getCatalogRoundById('2-1');
    const a = { ...army(), round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...army().m8, round } };
    const b = structuredClone(a);
    const input = compileBattle(snapshotForBattle(a, 'a'), snapshotForBattle(b, 'b'), 42, { battleId: 'equip-pvp' });
    const command = { kind: 'equipment' as const, seq: 1, effectiveTick: 4, seatId, itemId: 'item-1', unitId: own(a), slot: 0 };
    const task = startTwoSidedBattle(input, { captureReplay: true, beforeTick: tick => tick === 4 ? [command] : [] });
    task.advance(3);
    const equipped = accepted(equipItem(seatId === 'a' ? a : b, 'item-1', own(a), 0));
    task.queueEquipment(command, equipped);
    expect(() => task.queueEquipment(command, equipped)).toThrow('battle-input-invalid');
    const frame = task.advanceTick().frame!;
    expect(frame.tick).toBe(4); expect(frame.events.some(e => e.type === 'unitUpdated' && e.changes.equipment?.[0]?.definitionId === 'sword')).toBe(true);
    const result = task.advance(1201)!; expect(result.inputLog).toHaveLength(1);
    const copy = JSON.parse(JSON.stringify(result));
    expect(startCombatReplay(copy).advance(1201)).toEqual(task.replay());
    expect(proposeSettlement(copy)).toEqual(proposeSettlement(result));
    expect(JSON.stringify(task.replay())).not.toContain('equipmentReceipts'); expect(JSON.stringify(task.replay())).not.toContain('inputLog');
  });
  it('rejects mirror inputs and preserves the task without logging or drawing randomness', () => {
    const round = getCatalogRoundById('2-1'), base = army();
    const a = { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round } };
    const input = compileBattle(snapshotForBattle(a, 'a'), snapshotForBattle(a, 'b'), 42, { battleId: 'equip-mirror', mirrorOfSeatId: 'b' });
    const task = startTwoSidedBattle(input, { captureReplay: true });
    const equipped = accepted(equipItem(a, 'item-1', own(a), 0));
    expect(() => task.queueEquipment({ kind: 'equipment', seq: 1, effectiveTick: 1, seatId: 'b', itemId: 'item-1', unitId: own(a), slot: 0 }, equipped)).toThrow('battle-input-invalid');
    const result = task.advance(1201)!;
    expect(result.inputLog).toBeUndefined(); expect(result).toEqual(startTwoSidedBattle(input).advance(1201));
  });
  it.each(['rageblade', 'archangel', 'dragons-claw', 'warmog', 'deathcap', 'blue-buff', 'thiefs-gloves'])(
    '%s: installs base stats and item mechanisms without resetting the running unit', definitionId => {
      const base = army([definitionId]);
      let opened = accepted(openMatchCombatStream(base));
      for (let i = 0; i < 3; i++) opened = stepMatchCombatStream(opened).state;
      const equipped = accepted(equipItem(opened, 'item-1', own(base), 0));
      const receipt = equipped.combat!.pendingEquipment![0];
      const installed = applyBattleEquipment(opened.combat!, receipt); expect(installed.ok).toBe(true);
      const unit = installed.state.units.find(u => u.id === own(base))!, previous = opened.combat!.units.find(u => u.id === own(base))!;
      const expected = buildStrategySnapshot(accepted(equipItem(base, 'item-1', own(base), 0))).units.find(u => u.unitId === own(base))!;
      expect(unit.attackDamage).toBe(expected.stats.attack); expect(unit.armor).toBe(expected.stats.armor);
      expect(unit.magicResist).toBe(expected.stats.magicResist); expect(unit.abilityPower).toBe(expected.abilityPower);
      expect(unit.runtime).toEqual(previous.runtime); expect(unit.cooldownTicks).toBe(previous.cooldownTicks);
      const tick = stepCombat(installed.state).state;
      expect(tick.units.find(u => u.id === unit.id)!.pendingEquipmentSources).toBeUndefined();
      const periodic = tick.units.find(u => u.id === unit.id)!.mechanismState!.periodicTasks;
      expect(new Set(periodic.map(p => p.key)).size).toBe(periodic.length);
      if (definitionId === 'thiefs-gloves') {
        expect(unit.equipment).toHaveLength(3); expect(equipped.equipmentState.equipment.draws).toBeGreaterThan(opened.equipmentState.equipment.draws);
        expect(installed.state.rngState).toBe(opened.combat!.rngState);
      }
    });
  it('an emblem changes its own stats while opening trait membership and tiers stay frozen', () => {
    const base = army(['TFT13_Item_BruiserEmblemItem']);
    const opened = accepted(openMatchCombatStream(base));
    const equipped = accepted(equipItem(opened, 'item-1', own(base), 0));
    const next = stepMatchCombatStream(equipped).state.combat!;
    expect(next.strategy).toBe(opened.combat!.strategy);
    expect(next.units.find(u => u.id === own(base))!.maxHp).toBeGreaterThan(opened.combat!.units.find(u => u.id === own(base))!.maxHp);
    expect(next.units.find(u => u.id === own(base))!.mechanics?.filter(m => m.source.sourceKind === 'trait'))
      .toEqual(opened.combat!.units.find(u => u.id === own(base))!.mechanics?.filter(m => m.source.sourceKind === 'trait'));
  });
  it('legitimate single-player pending and installed equipment survive restore and continue identically', () => {
    const acquired = publicInventory(['sword']);
    const unit = acquired.state.preparation.units.find(u => u.team === 'player')!;
    const base = accepted(deployMatchUnit(acquired.state, unit.id, { kind: 'board', cell: { col: 3, row: 6 } }));
    const opened = accepted(startMatchCombat(base));
    const pending = accepted(equipItem(opened, acquired.itemIds[0], unit.id, 0));
    for (const state of [pending, { ...pending, combat: stepCombat(pending.combat!).state } as MatchState]) {
      const restored = restoreMatch(serializeMatch(state));
      expect(restored).toEqual(state); expect(stepCombat(restored.combat!)).toEqual(stepCombat(state.combat!));
      const forged = structuredClone(state);
      const receipt = (forged.combat!.pendingEquipment ?? forged.combat!.equipmentReceipts)![0];
      Object.assign(receipt.after.items.find(i => i.location.kind === 'unit' && i.location.unitId === unit.id)!, { definitionId: 'deathblade' });
      expect(() => restoreMatch(forged)).toThrow(/equipment/);
      const omitted = structuredClone(state);
      delete (omitted.combat as { pendingEquipment?: unknown }).pendingEquipment;
      delete (omitted.combat as { equipmentReceipts?: unknown }).equipmentReceipts;
      expect(() => restoreMatch(omitted)).toThrow(/equipment/);
    }
  }, 60_000);
});
