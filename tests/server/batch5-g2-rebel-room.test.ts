import { afterAll, expect, it } from 'vitest';
import { SEATS, TIMINGS, runUntilClaiming, answerOpenChoices, claimAllOrbs } from './helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { rewardPlan, rebelCopyDeaths } from '../fixtures/m5/augment-rewards-oracle.cjs';
import { proposeSettlement } from '../../src/simulation/two-sided-battle';
import type { BattleResult } from '../../src/simulation/two-sided-types';

const clock = new ManualClock();
const room = new Room(SEATS.map(s => ({...s, kind: 'human'})), {...ROOM_TIMING_DEFAULTS, ...TIMINGS,
  roomId: 'g2-rebel-room', seed: 1, clock, resolver: new TwoSidedBattleResolver()});
const seatId = 's6', mine = () => room.state.seats.find(s => s.seatId === seatId)!;
let executed: BattleResult;
afterAll(() => room.dispose());

for (const round of ['1-2', '1-3', '1-4', '2-1']) it(`B5-70 room reaches ${round}`, () => {
  if (round === '1-2') room.start();
  expect(runUntilClaiming(room, clock, s => s.roundId === round && s.phase === 'preparation').roundId).toBe(round);
});

it('B5-70 real online choice grants exactly Akali and Irelia through finite-pool reward orbs', () => {
  const c = mine().match.pendingChoice!;
  expect(c.offers).toContain('rebel-resurgence');
  expect(room.handle(seatId, {type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'rebel-resurgence'})).toMatchObject({ok: true});
  const plan = rewardPlan(mine().match, {});
  expect(plan.gifts.map(g => g.definitionId)).toEqual(['akali', 'irelia']);
  for (const gift of plan.gifts) expect(mine().match.seatMechanics?.receipts).toContainEqual(expect.objectContaining({receiptId: gift.receiptId, kind: 'unit', definitionId: gift.definitionId}));
  claimAllOrbs(room, [seatId]);
  for (const id of ['akali', 'irelia']) expect(mine().match.preparation.units.some(u => u.team === 'player' && u.definitionId === id)).toBe(true);
  assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
  const before = room.state;
  expect(room.handle(seatId, {type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'rebel-resurgence'})).toMatchObject({ok: false});
  expect(room.state).toBe(before);
});

it('B5-70 online acquisition saves round trip and reject edited gifts or choice provenance', () => {
  const match = mine().match;
  expect(match.augmentHistory?.version).toBe('augment-history-v1');
  expect(() => restoreSharedOrbSnapshot(room.state.pool, match)).toThrow('independent server authority');
  for (const input of [match, JSON.stringify(match), canonicalContent(match)]) expect(restoreSharedOrbSnapshot(room.state.pool, input, room.augmentHistoryAuthority(seatId))).toEqual(match);
  for (const edit of [
    (s: any) => { s.seatMechanics.receipts.find((r: any) => r.receiptId.includes('rebel-resurgence')).definitionId = 'jinx'; },
    (s: any) => { s.seatMechanics.receipts.find((r: any) => r.receiptId.includes('rebel-resurgence')).starLevel = 3; },
    (s: any) => { s.augments.find((a: any) => a.definitionId === 'rebel-resurgence').choiceId = 'fake-choice'; },
  ]) {
    const forged = structuredClone(match); edit(forged);
    for (const input of [forged, JSON.stringify(forged)]) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, room.augmentHistoryAuthority(seatId))).toThrow();
  }
});

it('B5-70 prepares a weak original and stronger opponents through actual online commands', () => {
  answerOpenChoices(room, room.state.seats.filter(s => s.seatId !== seatId).map(s => s.seatId));
  const original = mine().match.preparation.units.find(u => u.team === 'player' && u.definitionId === 'irelia')!;
  expect(original).toBeDefined();
  for (const u of mine().match.preparation.units.filter(u => u.team === 'player' && u.id !== original.id && !UNIT_DEFINITIONS[u.definitionId].summon))
    expect(room.handle(seatId, {type: 'sell', unitId: u.id})).toMatchObject({ok: true});
  expect(room.handle(seatId, {type: 'deploy', unitId: original.id, target: {kind: 'board', cell: {col: 3, row: 4}}})).toMatchObject({ok: true});
  for (const other of room.state.seats.filter(s => s.seatId !== seatId)) {
    for (let n = 0; n < 3; n++) {
      const m = room.state.seats.find(s => s.seatId === other.seatId)!.match;
      const slot = m.shop.slots.findIndex(o => o.status === 'available' && UNIT_DEFINITIONS[o.definitionId].cost <= m.gold);
      if (slot < 0) break;
      expect(room.handle(other.seatId, {type: 'buy', slot, generation: m.shop.generation})).toMatchObject({ok: true});
    }
    const m = room.state.seats.find(s => s.seatId === other.seatId)!.match;
    const board = m.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board');
    for (const [index, u] of m.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench').slice(0, m.level - board.length).entries())
      expect(room.handle(other.seatId, {type: 'deploy', unitId: u.id, target: {kind: 'board', cell: {col: index * 2, row: 5}}})).toMatchObject({ok: true});
  }
});

it('B5-70 actual online battle summons the original at its death cell and counts no pool copies', () => {
  const holdingsBefore = room.state.pool.holdings.filter(h => h.seatId === seatId);
  runUntilClaiming(room, clock, s => s.roundId === '2-1' && s.phase === 'settlement');
  const result = room.state.battles.find(b => b.kind === 'two-sided' && b.participants.includes(seatId));
  expect(result?.kind).toBe('two-sided'); if (!result || result.kind !== 'two-sided') throw new Error('missing real two-sided battle');
  executed = result.battle;
  const originals = executed.initial.units.map(u => ({id: u.id, team: u.team, traits: UNIT_DEFINITIONS[u.definitionId]?.traits ?? [], summon: !!UNIT_DEFINITIONS[u.definitionId]?.summon, copy: !!u.itemSummon}));
  expect(executed.terminal.batch5RebelSummons?.map(({ownerId, team, ordinal}) => ({ownerId, team, ordinal}))).toEqual(rebelCopyDeaths(executed.events, originals));
  expect(executed.terminal.units.filter(u => u.rebelCopy).length).toBeGreaterThan(0);
  expect(executed.events.filter(e => e.type === 'unitSpawned' && e.source.definitionId === 'rebel-resurgence').length).toBeGreaterThan(0);
  expect(room.state.pool.holdings.filter(h => h.seatId === seatId)).toEqual(holdingsBefore);
  assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
  expect(room.state.fault).toBeNull();
});

it('B5-70 online settlement saves round trip after copy execution', () => {
  const match = mine().match;
  expect(match.augmentHistory?.version).toBe('augment-history-v1');
  expect(() => restoreSharedOrbSnapshot(room.state.pool, match)).toThrow('independent server authority');
  for (const input of [match, JSON.stringify(match), canonicalContent(match)]) expect(restoreSharedOrbSnapshot(room.state.pool, input, room.augmentHistoryAuthority(seatId))).toEqual(match);
  expect(proposeSettlement(structuredClone(executed))).toEqual(proposeSettlement(executed));
});

it.each(['health', 'star', 'equipment', 'quota'] as const)('B5-70 cold online replay rejects tampered copy %s', field => {
  const forged: any = structuredClone(executed), copy = forged.terminal.units.find((u: any) => u.rebelCopy);
  expect(copy).toBeDefined();
  if (field === 'health') copy.maxHp++;
  if (field === 'star') copy.starLevel = 3;
  if (field === 'equipment') copy.equipment = [{definitionId: 'deathblade', slot: 0, temporary: false}];
  if (field === 'quota') forged.terminal.batch5RebelSummons.pop();
  expect(() => proposeSettlement(forged)).toThrow();
});

for (const round of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) it(`B5-70 persists through the online ${round} entry`, () => {
  expect(runUntilClaiming(room, clock, s => s.roundId === round && s.phase === (round === '2-4' ? 'settlement' : 'preparation')).roundId).toBe(round);
});

it('B5-70 real online PvE retains and authenticates the spawned combat bodies in Match saves', () => {
  runUntilClaiming(room, clock, s => s.roundId === '2-7' && s.phase === 'settlement');
  const match = mine().match;
  expect(match.combat?.units.some(u => u.rebelCopy)).toBe(true);
  for (const input of [match, JSON.stringify(match), canonicalContent(match)]) expect(restoreSharedOrbSnapshot(room.state.pool, input, room.augmentHistoryAuthority(seatId))).toEqual(match);
  const forged: any = structuredClone(match);
  forged.combat.units.find((u: any) => u.rebelCopy).maxHp++;
  for (const input of [forged, JSON.stringify(forged)]) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, room.augmentHistoryAuthority(seatId))).toThrow();
  expect(room.state.fault).toBeNull();
});
