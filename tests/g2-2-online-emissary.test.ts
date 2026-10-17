/**
 * G2-2 Emissary (Ambessa) in two-sided PvP: each side's prior PvP wins come from its own settled ledger,
 * are frozen into its PlayerBattleSnapshot, and survive restore. Solo keeps reading roundResults.
 */
import { describe, expect, it } from 'vitest';
import {
  createMatch, snapshotForBattle, restorePlayerBattleSnapshot, compileBattle, restoreBattleInput, startTwoSidedCombat,
  priorPvpWins, BattleValidationError, type MatchState, type PlayerBattleSnapshot, type BattleInput,
} from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import type { RoundResult } from '../src/simulation/match-types';
import { freezeCombatInput, restoreCombatInput, type CombatInputAuthority } from '../src/simulation/combat-input';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { nextRandom } from '../src/simulation/rng';
import type { Unit } from '../src/simulation/unit-types';

const ambessa = (id = 'unit-1'): Unit => ({ id, definitionId:'ambessa', starLevel:1, team:'player', location:{kind:'board',cell:{col:3,row:4}} });
/** Only the three fields the Emissary count reads; the rest of a RoundResult is irrelevant here. */
const history = (rows: readonly [string, RoundResult['result']][]) => rows.map(([roundId,result]) => {
  const round = getCatalogRoundById(roundId);
  return { round:round.ordinal, roundId, roundKind:round.kind, result } as RoundResult;
});
function seat(roundId: string, roundResults: readonly RoundResult[], units = [ambessa()]): MatchState {
  const base = createMatch(42), round = getCatalogRoundById(roundId);
  return {...base, round:round.ordinal, roundDefinitionId:round.roundId, m8:{...base.m8,round}, level:9,
    preparation:{...base.preparation,units}, roundResults} as MatchState;
}
const compile = (a: PlayerBattleSnapshot, b: PlayerBattleSnapshot) => compileBattle(a,b,42,{battleId:'match-7:round-3-1:pair-0'});
const resist = (input: BattleInput, seatId: string) => {
  const id = input.mapping.find(m => m.seatId === seatId && m.kind === 'unit' && m.originalId === 'unit-1')!.combatId;
  const unit = startTwoSidedCombat(input).units.find(u => u.id === id)!;
  return { armor:unit.armor, magicResist:unit.magicResist };
};
const reason = (run: () => unknown) => { try { run(); return null; } catch (error) { return error instanceof BattleValidationError ? error.reason : String(error); } };

// 2-1, 2-2, 2-5 are PvP wins; 2-3 is a PvP loss; 2-7 is a PvE win and 2-4 a supply round.
const THREE_WINS = history([['1-2','playerWin'],['1-3','playerWin'],['1-4','playerWin'],['2-1','playerWin'],['2-2','playerWin'],
  ['2-3','enemyWin'],['2-4','supply'],['2-5','playerWin'],['2-6','draw'],['2-7','playerWin']]);

describe('priorPvpWins', () => {
  it('counts only earlier PvP playerWin records and caps at seven', () => {
    expect(priorPvpWins(THREE_WINS, 11)).toBe(3);
    expect(priorPvpWins(THREE_WINS, 5)).toBe(1); // only 2-1 is before 2-2
    expect(priorPvpWins([], 11)).toBe(0);
    const nine = Array.from({length:9}, (_,i) => ({round:i+1, roundKind:'pvp' as const, result:'playerWin' as const}));
    expect(priorPvpWins(nine, 20)).toBe(7);
  });
});

describe('two-sided Emissary win history', () => {
  it('binds each side to its own ledger: A has three wins, B none; A gains 2 armor and 2 MR per win', () => {
    const a = snapshotForBattle(seat('3-1',THREE_WINS),'A'), b = snapshotForBattle(seat('3-1',[]),'B');
    expect(a.priorPvpWins).toBe(3);
    expect(b).not.toHaveProperty('priorPvpWins');
    const input = compile(a,b), ra = resist(input,'A'), rb = resist(input,'B');
    expect(ra.armor - rb.armor).toBe(6);
    expect(ra.magicResist - rb.magicResist).toBe(6);
    // Swapping sides moves the bonus with the seat, not with the player/enemy slot.
    const swapped = compile(b,a);
    expect(resist(swapped,'A').armor - resist(swapped,'B').armor).toBe(6);
  });

  it('matches the solo compiler for the same ledger, and caps at seven wins (+14)', () => {
    const many = history([['2-1','playerWin'],['2-2','playerWin'],['2-3','playerWin'],['2-5','playerWin'],['2-6','playerWin'],
      ['3-1','playerWin'],['3-2','playerWin'],['3-3','playerWin'],['3-5','playerWin']]);
    const state = seat('4-1',many), a = snapshotForBattle(state,'A');
    expect(a.priorPvpWins).toBe(7);
    const online = resist(compile(a,snapshotForBattle(seat('4-1',[]),'B')),'A');
    const zero = resist(compile(snapshotForBattle(seat('4-1',[]),'A'),snapshotForBattle(seat('4-1',[]),'B')),'A');
    expect(online.armor - zero.armor).toBe(14);
    // Solo path: no priorPvpWins field, the compiler reads roundResults itself; same +14.
    const solo = (results: readonly RoundResult[]) => buildStrategySnapshot({...state,roundResults:results}).units.find(u => u.unitId === 'unit-1')!;
    expect(solo(many)).not.toEqual(solo([]));
    expect(JSON.stringify(solo(many))).toContain('"stat":"armor","amount":14');
  });

  it('survives freeze/restore: JSON round trip is identical; a changed win count is refused', () => {
    const input = compile(snapshotForBattle(seat('3-1',THREE_WINS),'A'),snapshotForBattle(seat('3-1',[]),'B'));
    const text = JSON.stringify(input);
    expect(restoreBattleInput(text)).toEqual(input);
    // Editing the frozen count without recompiling the strategy no longer matches the recompiled input.
    const tampered = JSON.parse(text); tampered.a.priorPvpWins = 2;
    expect(reason(() => restoreBattleInput(tampered))).toBe('battle-input');
    // A snapshot that never had wins (older freezes) restores and compiles exactly as before.
    const plain = snapshotForBattle(seat('3-1',[]),'A');
    expect(restorePlayerBattleSnapshot(JSON.stringify(plain))).toEqual(plain);
  });

  it('rejects impossible claims: zero spelled out, above seven, fractional, or more than the PvP rounds before', () => {
    const base = snapshotForBattle(seat('3-1',[]),'A');
    for (const wins of [0, 8, 1.5, -1, '3']) expect(reason(() => restorePlayerBattleSnapshot({...base,priorPvpWins:wins}))).toBe('invalid-snapshot');
    expect(restorePlayerBattleSnapshot({...base,priorPvpWins:5}).priorPvpWins).toBe(5); // 3-1 follows five PvP rounds
    expect(reason(() => restorePlayerBattleSnapshot({...base,priorPvpWins:6}))).toBe('invalid-snapshot');
    const early = snapshotForBattle(seat('2-2',[]),'A'); // only 2-1 is before 2-2
    expect(restorePlayerBattleSnapshot({...early,priorPvpWins:1}).priorPvpWins).toBe(1);
    expect(reason(() => restorePlayerBattleSnapshot({...early,priorPvpWins:2}))).toBe('invalid-snapshot');
    expect(reason(() => restorePlayerBattleSnapshot({...snapshotForBattle(seat('2-1',[]),'A'),priorPvpWins:1}))).toBe('invalid-snapshot');
  });
});

describe('solo combat input basis', () => {
  it('never carries the online-only count: a saved basis with priorPvpWins is refused', () => {
    const state = createMatch(42), basis = freezeCombatInput(state, nextRandom(state.battleSeedRngState).word, 1);
    expect(basis.inputs).not.toHaveProperty('priorPvpWins');
    const authority: CombatInputAuthority = {g23:readG23Progress(state),playerHp:state.playerHp, seed:state.seed, round:state.round, contentDigest:state.contentDigest,
      playerLevel:state.level, provenancePrefixLength:1, equipmentRollPrefixLength:0,
      resources:{units:[{id:'unit-1',definitionId:'irelia',starLevel:1}], items:[], persistentGrowth:[], nextUnitSerial:2, nextItemSerial:1},
      equipmentRolls:[], scheduleReceipts:[], roundResults:[]};
    expect(restoreCombatInput(basis, authority)).toEqual(basis);
    expect(() => restoreCombatInput({...basis,inputs:{...basis.inputs,priorPvpWins:7}}, authority)).toThrow('Invalid combat input basis');
  });
});
