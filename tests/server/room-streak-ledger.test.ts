import { afterAll, beforeAll, expect, it } from 'vitest';
import { toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import type { RoomState } from '../../src/server/room/types';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { makeRoom, runUntil } from './helpers';

// Seed 8 naturally offers Called Shot to s2 at 2-1; split the real PvE route at each round.
// v26 D5 (7953c99a) pool: seed 8's s2 now gets titanic-titan/...; seed 55 is the first seed from 0 offering s2 Called Shot at 2-1.
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 55 });
const owner = () => room.state.seats.find(seat => seat.seatId === 's2')!;
let beforeChoice: RoomState;
beforeAll(() => { room.start(); });
for (const round of [2, 3, 4]) beforeAll(() => {
  runUntil(room, clock, state => state.round === round && state.phase === 'preparation');
});
afterAll(() => room.dispose());

it('publishes Called Shot streak immediately with the acquired augment to every viewer', () => {
  beforeChoice = room.state;
  const before = owner(), choice = before.match.pendingChoice!;
  expect(choice.kind).toBe('augment');
  expect(choice.offers).toContain('called-shot');
  expect(before.streak).not.toEqual({ kind: 'win', count: 4 });
  const oldView = toPlayerView(room.state, 's0', clock.now());
  const publications: RoomState[] = [];
  const unsubscribe = room.subscribe(state => publications.push(state));
  expect(room.handle('s2', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'called-shot' })).toMatchObject({ ok: true });
  unsubscribe();
  expect(room.state.fault).toBeNull();
  expect(owner().match.roundResults).toEqual(before.match.roundResults);
  expect(room.state.settlements).toEqual(beforeChoice.settlements);
  expect(toSeatPrivateView(owner().match).streak).toEqual({ kind: 'win', count: 4 });
  expect(owner().streak).toEqual({ kind: 'win', count: 4 });
  expect(owner().streak).not.toBe(owner().match.streak);
  const acquired = publications.filter(state => state.seats.find(seat => seat.seatId === 's2')!.match.augments.some(augment => augment.definitionId === 'called-shot'));
  expect(acquired.length).toBeGreaterThan(0);
  for (const state of acquired) for (const viewer of state.seats) {
    const seat = toPlayerView(state, viewer.seatId, clock.now()).seats.find(seat => seat.seatId === 's2')!;
    expect(seat.streak).toEqual({ kind: 'win', count: 4 });
    expect(seat.publicBoard!.augments).toContain('called-shot');
    expect(JSON.parse(JSON.stringify(seat)).streak).toEqual({ kind: 'win', count: 4 });
  }
  expect(oldView.seats.find(seat => seat.seatId === 's2')!.streak).toEqual(before.streak);
  const chosen = owner().match;
  expect(room.handle('s2', { type: 'shopLock', locked: !chosen.shop.locked, generation: chosen.shop.generation })).toMatchObject({ ok: true });
  expect(owner().streak).toEqual({ kind: 'win', count: 4 });
  expect(room.handle('s2', { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'called-shot' }).ok).toBe(false);
  expect(owner().streak).toEqual({ kind: 'win', count: 4 });
});

it.each(['no acquisition', 'wrong count', 'already owned'] as const)('refuses an unexplained streak change: %s', cause => {
  const { room: fork } = makeRoom(new TwoSidedBattleResolver(), { seed: 8 });
  try {
    const holder = fork as unknown as { current: RoomState; replace(next: RoomState): void };
    holder.current = cause === 'already owned' ? room.state : beforeChoice;
    const before = holder.current;
    holder.replace({ ...before, seats: before.seats.map(seat => seat.seatId !== 's2' ? seat : {
      ...seat, match: { ...seat.match, streak: { kind: 'win', count: 5 },
        augments: cause === 'wrong count' ? [...seat.match.augments, { definitionId: 'called-shot', choiceId: seat.match.pendingChoice!.choiceId, acquiredRound: seat.match.round }] : seat.match.augments },
      seatRevision: seat.seatRevision + 1,
    }) });
    expect(fork.state.fault).toMatchObject({ kind: 'invalid-results' });
    expect(fork.state.seats.find(seat => seat.seatId === 's2')!.streak).toEqual(before.seats.find(seat => seat.seatId === 's2')!.streak);
  } finally { fork.dispose(); }
});
