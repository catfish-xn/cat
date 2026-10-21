import { expect, it } from 'vitest';
import { selectAnomalyTarget, rerollAnomaly, selectChoice, rerollShop, sellUnit, lockMatchCombatRoster } from '../src/simulation/match';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { grantAnomalyAcquisition } from '../src/simulation/anomaly-acquisition';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { toCombatReplay, startCombatReplay } from '../src/simulation/combat-replay-view';
import type { MatchState } from '../src/simulation/match';
import type { BattleResult } from '../src/simulation/two-sided-types';
import { catalogPreparation, accepted } from './t5r-helpers';

const id = 'avarice-incarnate';
// Isolated catalog boundary, not a restore-valid full Match. Offers, acquisition,
// trading, combat, sample transcript and replay below all use production rules.
function opening(seed: number): MatchState {
  const base = catalogPreparation('4-6', seed), choiceId = 'round:4-6:anomaly';
  return accepted(enableMultiplayerSettlement({ ...base, gold: 50, level: 8, items: [], temporaryEquipment: [], augments: [],
    phase: 'choice', combat: null, preparation: { ...base.preparation, units: [
      { id: 'unit-1', definitionId: 'lux', starLevel: 3, team: 'player', location: { kind: 'board', cell: { col: 0, row: 4 } } },
      { id: 'unit-2', definitionId: 'garen', starLevel: 1, team: 'player', location: { kind: 'bench', slot: 0 } },
    ] }, pendingChoice: { kind: 'anomaly', step: 'target', choiceId, eventId: choiceId,
      generation: 0, offers: [], targetId: null, rerollCount: 0, returnPhase: 'preparation' } }, 'A'));
}
function offer(via: 'initial' | 'reroll'): MatchState {
  // Bounded seed search exercises real LCG draws, with no injected offers/binding.
  for (let seed = 0; seed < 4096; seed++) {
    const base = opening(seed), c = base.pendingChoice!;
    let state = accepted(selectAnomalyTarget(base, c.choiceId, c.generation, 'unit-1'));
    if (via === 'reroll') {
      if (state.pendingChoice!.offers.includes(id)) continue;
      const first = state.pendingChoice!;
      state = accepted(rerollAnomaly(state, first.choiceId, first.generation));
      expect(state.gold).toBe(base.gold - 1);
    }
    if (state.pendingChoice!.offers.includes(id)) return state;
  }
  throw new Error('Avarice offer seed budget exhausted');
}
function choose(state: MatchState): MatchState {
  const c = state.pendingChoice!, result = selectChoice(state, c.choiceId, c.generation, id);
  const chosen = accepted(result), receiptId = JSON.stringify(['d11-fill', c.choiceId, 'avarice-gold']);
  expect(chosen.gold).toBe(state.gold + 5);
  expect(chosen.anomalyBinding).toMatchObject({ definitionId: id, unitId: 'unit-1' });
  expect(chosen.seatMechanics!.receipts.filter(r => r.receiptId === receiptId)).toEqual([
    expect.objectContaining({ kind: 'gold', amount: 5, source: 'd11-fill' }),
  ]);
  expect(result.ok && result.events.filter(e => e.type === 'mechanicGranted')).toHaveLength(1);
  const duplicate = selectChoice(chosen, c.choiceId, c.generation, id);
  expect(duplicate).toMatchObject({ ok: false, state: chosen });
  expect(duplicate.state).toBe(chosen);
  expect(grantAnomalyAcquisition(chosen)).toEqual({ state: chosen, events: [] });
  expect(grantAnomalyAcquisition(chosen).state).toBe(chosen);
  for (const key of ['rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState'] as const)
    expect(chosen[key]).toBe(state[key]);
  return chosen;
}
it.each(['initial', 'reroll'] as const)('online %s offer acquires Avarice and grants exactly one +5G receipt', via => {
  choose(offer(via));
});

it('acquired online Avarice uses combat-time trading samples for damage and reproduces every replay frame', () => {
  const acquired = choose(offer('initial'));
  let bank = accepted(lockMatchCombatRoster(acquired));
  const defender: MatchState = { ...acquired, anomalyBinding: null, preparation: { ...acquired.preparation,
    units: [{ id: 'unit-1', definitionId: 'garen', starLevel: 3, team: 'player', location: { kind: 'board', cell: { col: 0, row: 4 } } }] } };
  const input = compileBattle(snapshotForBattle(acquired, 'A'), snapshotForBattle(defender, 'B'), 42, { battleId: 'v17-acquired-avarice' });
  const fixed = startTwoSidedBattle(input, { captureReplay: true }), live = startTwoSidedBattle(input, { captureReplay: true });
  expect(live.advanceTick()).toEqual(fixed.advanceTick()); // same first completed rule tick
  // The frozen PvP roster remains fixed while genuine shop spending and a bench
  // sale change the authoritative bank that the ongoing rules task samples.
  while (bank.gold >= 2) bank = accepted(rerollShop(bank));
  const spent = bank.gold;
  expect(live.sampleBankGold('A', spent)).toBe(true);
  bank = accepted(sellUnit(bank, 'unit-2'));
  expect(bank.gold).toBe(spent + 4);
  expect(live.sampleBankGold('A', bank.gold)).toBe(true);
  expect(live.sampleBankGold('A', bank.gold)).toBe(false);
  const result = live.advance(1201)!, control = fixed.advance(1201)!;
  expect(result.bankSamples).toEqual([{ tick: 1, team: 'player', liveGold: spent }, { tick: 1, team: 'player', liveGold: bank.gold }]);
  const attack = (r: BattleResult) => r.events.find(e => e.type === 'packetDamage' && e.tick > 1
    && e.outcome.context.source.ownerId === input.preparation.units.find(u => u.team === 'player')!.id
    && e.outcome.context.source.sourceKind === 'attack');
  const low = attack(result), high = attack(control);
  expect(low?.type).toBe('packetDamage'); expect(high?.type).toBe('packetDamage');
  if (low?.type !== 'packetDamage' || high?.type !== 'packetDamage') throw new Error('Missing real attack');
  expect(low.tick).toBe(high.tick); expect(low.outcome.hpDamage).toBeLessThan(high.outcome.hpDamage);
  const transported = JSON.parse(JSON.stringify(result)), replay = toCombatReplay(transported);
  expect(replay).toEqual(live.replay());
  const sliced = startCombatReplay(transported); let completed = null;
  for (let n = 0; n < 1201 && !completed; n++) completed = sliced.advance(1);
  expect(completed).toEqual(replay);
  expect(proposeSettlement(transported)).toEqual(proposeSettlement(result));
  expect(JSON.stringify(replay)).not.toMatch(/bankSamples|liveGold|currentItemBankGold/);
  const forged = structuredClone(result); Object.assign(forged.bankSamples![1], { liveGold: 50 });
  expect(() => toCombatReplay(forged)).toThrow('replay-divergence');
  expect(() => proposeSettlement(forged)).toThrow('invalid-result');
  expect(grantAnomalyAcquisition(bank)).toEqual({ state: bank, events: [] });
});
