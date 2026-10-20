import { expect, it } from 'vitest';
import { validateG23BattleFacts } from '../src/simulation/g2-3-economy';
import { createMatch, startMatchCombat, stepMatch, nextRound, claimOrDiscardLoot } from '../src/simulation/match';
import { enableMultiplayerSettlement, applyRoundSettlement, type MultiplayerCommandResult } from '../src/simulation/round-settlement';
import { forfeitPendingChoice } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import type { MatchState } from '../src/simulation/match-types';
import { anomalyId } from './helpers/s13-anomalies';
import { createCombatWithEvents } from '../src/simulation/combat';

const accepted = (result: MultiplayerCommandResult): MatchState => { if (!result.ok) throw Error(result.reason); return result.state; };
let opening: MatchState | undefined;
function baseState(): MatchState {
  if (opening) return opening;
  let state = accepted(enableMultiplayerSettlement(createMatch(5), 'A'));
  for (let i = 0; i < 4000; i++) {
    if (state.roundDefinitionId === '2-1' && state.phase === 'preparation') return opening = state;
    if (state.phase === 'choice') state = accepted(forfeitPendingChoice(state, state.round, state.pendingChoice!.choiceId, state.pendingChoice!.generation));
    else if (state.phase === 'preparation') state = accepted(startMatchCombat(state));
    else if (state.phase === 'combat') state = stepMatch(state).state;
    else state = accepted(nextRound(accepted(claimOrDiscardLoot(state, state.round)), state.round));
  }
  throw Error('opening budget');
}
it.each([
  ['conqueror', ['darius'], ['darius', 'draven'], 0, 2],
  ['conqueror', ['darius', 'draven'], ['darius'], 2, 0],
  ['chem-baron', ['singed', 'renata'], ['singed', 'renata', 'renni'], 0, 3],
  ['chem-baron', ['singed', 'renata', 'renni'], ['singed', 'renata'], 3, 0],
] as const)('%s settlement recomputes the current board across tier %s -> %s and rejects stale tier facts', (trait, before, after, oldTier, tier) => {
  const base = baseState(), units = (names: readonly string[]) => names.map((definitionId, i) => ({ id: 'unit-' + (i + 1), definitionId,
    team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: { col: i, row: 4 } } }));
  const old = { ...base, level: 9, xp: 0, preparation: { ...base.preparation, units: units(before) } };
  expect(deriveTraits(old.preparation, 'player').find(t => t.traitId === trait)!.tier).toBe(oldTier);
  const state = { ...old, preparation: { ...base.preparation, units: units(after) },
    anomalyBinding: { unitId: 'unit-1', definitionId: anomalyId('WolfFamiliars'), choiceId: 'p4', boundRound: 1 } };
  const strategy = buildStrategySnapshot(state);
  expect(strategy.traits.find(t => t.team === 'player' && t.traitId === trait)!.tier).toBe(tier);
  const combat = createCombatWithEvents({ ...state.preparation, units: [...state.preparation.units,
    { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 6, row: 0 } } }] },
    buildStrategySnapshot({ ...state, preparation: { ...state.preparation, units: [...state.preparation.units,
      { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 6, row: 0 } } }] } }), 'p4-trait-battle').state;
  expect(combat.units.filter(u => u.anomalySummon?.kind === 'wolf')).toHaveLength(2);
  expect(combat.strategy!.traits.find(t => t.team === 'player' && t.traitId === trait)!.tier).toBe(tier);
  const facts = { battleId: 'p4-tier', round: state.round, roundKind: 'pvp' as const, result: 'win' as const,
    conquerorTier: trait === 'conqueror' ? tier : 0, conquestTakedowns: [], chemBaronTier: trait === 'chem-baron' ? tier : 0,
    alliedDeaths: 0, rumbleStar: 0 as const, highRollerGold: 0 };
  const receipt = { version: 'multiplayer-settlement-v1' as const, settlementId: 'p4-tier-settlement', battleId: facts.battleId,
    seatId: 'A', round: state.round, roundId: state.roundDefinitionId, settlementEligible: true, result: 'win' as const,
    damage: 0, baseDamage: 2, opposingSurvivors: 0, growth: [], combatTicks: 1, combatEventCount: 1, g23Facts: facts };
  expect(applyRoundSettlement(state, { ...receipt, g23Facts: { ...facts, [trait === 'conqueror' ? 'conquerorTier' : 'chemBaronTier']: oldTier } }))
    .toMatchObject({ ok: false, reason: 'invalid-receipt' });
  validateG23BattleFacts(facts);
  const committed = applyRoundSettlement(state, receipt);
  expect(committed.ok, committed.ok ? undefined : committed.reason).toBe(true);
  expect(committed.state.preparation.units).toEqual(state.preparation.units);
});
