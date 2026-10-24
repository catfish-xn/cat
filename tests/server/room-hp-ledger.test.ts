/**
 * The room's HP ledger (seat.hp, shown on SeatPublic) follows every rules heal between settlements in the same
 * publication, and only an explained one: an Upward Mobility level-up or a Crimson Pact skip receipt. Settlement then
 * checks HP strictly against that ledger.
 */
import { afterEach, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import { explainedHp } from '../../src/simulation/player-hp';
import { batch2Values } from '../../src/simulation/content/augment-pool-batch2';
import { writeSeatMechanic, appendMechanicReceipt } from '../../src/simulation/seat-mechanics/state';
import { AUGMENT_ACQUISITION_LEVEL_KEY } from '../../src/simulation/augment-xp';
import { makeRoom, runUntil } from './helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

function preparedRoom() {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  disposers.push(() => room.dispose());
  room.start();
  runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
  const holder = room as unknown as { current: RoomState; replace(next: RoomState): void };
  return { room, clock, holder };
}
const seatOf = (state: RoomState, seatId: string) => state.seats.find(seat => seat.seatId === seatId)!;
function patch(holder: { current: RoomState }, seatId: string, edit: (match: MatchState) => MatchState, hp?: number) {
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => seat.seatId !== seatId ? seat : {
    ...seat, match: edit(seat.match), ...(hp === undefined ? {} : { hp }), seatRevision: seat.seatRevision + 1 }) };
}

it('an Upward Mobility level-up bought through the room heals the ledger at once, and the next settlement stays strict', () => {
  const { room, clock, holder } = preparedRoom();
  patch(holder, 's0', match => writeSeatMechanic({ ...match, playerHp: 50, gold: 60,
    augments: [...match.augments, { definitionId: 'upward-mobility', choiceId: 'um', acquiredRound: match.round }] },
  AUGMENT_ACQUISITION_LEVEL_KEY, { um: match.level }), 50);
  const level = seatOf(room.state, 's0').match.level;
  while (seatOf(room.state, 's0').match.level === level) {
    const before = seatOf(room.state, 's0').match.gold;
    expect(room.handle('s0', { type: 'buyXp' })).toMatchObject({ ok: true });
    expect(before - seatOf(room.state, 's0').match.gold).toBe(3);
  }
  const seat = seatOf(room.state, 's0');
  expect([seat.match.playerHp, seat.hp]).toEqual([52, 52]);
  expect(room.state.fault).toBeNull();
  runUntil(room, clock, state => state.round === 5 || state.phase === 'ended');
  expect(room.state.fault).toBeNull();
}, 60_000);

it('an HP change with no explained source faults the room instead of moving the ledger', () => {
  const { room, holder } = preparedRoom();
  const before = seatOf(room.state, 's1');
  holder.replace({ ...holder.current, seats: holder.current.seats.map(seat => seat.seatId !== 's1' ? seat : {
    ...seat, match: { ...seat.match, playerHp: seat.match.playerHp >= 100 ? 95 : seat.match.playerHp + 5 }, seatRevision: seat.seatRevision + 1 }) });
  expect(room.state.fault).toMatchObject({ kind: 'invalid-results' });
  expect((room.state.fault as { detail: string }).detail).toContain('no explained source');
  expect(seatOf(room.state, 's1').hp).toBe(before.hp);
}, 30_000);

it('explainedHp: Crimson Pact heals only with a new skipped black-market receipt; levels heal only with Upward Mobility', () => {
  const { room } = preparedRoom();
  const base = { ...seatOf(room.state, 's2').match, playerHp: 60 };
  const pact = { ...base, augments: [...base.augments, { definitionId: 'crimson-pact', choiceId: 'cp', acquiredRound: base.round }] };
  const skipped = appendMechanicReceipt(pact, { receiptId: 'bm-1', round: pact.round, roundId: pact.roundDefinitionId, source: 'black-market',
    kind: 'choice', choiceKind: 'blackMarket', optionId: '@skip', skipped: true, price: 0, itemId: null, timedOut: false } as never);
  expect(explainedHp(pact, skipped)).toBe(60 + batch2Values('crimson-pact').Heal);
  expect(explainedHp(pact, pact)).toBe(60);
  expect(explainedHp(base, { ...base, level: base.level + 1 })).toBe(60);
  const um = { ...base, augments: [...base.augments, { definitionId: 'upward-mobility', choiceId: 'um', acquiredRound: base.round }] };
  expect(explainedHp(um, { ...um, level: um.level + 2 })).toBe(64);
  expect(explainedHp({ ...um, playerHp: 99 }, { ...um, playerHp: 99, level: um.level + 2 })).toBe(100);
}, 30_000);
