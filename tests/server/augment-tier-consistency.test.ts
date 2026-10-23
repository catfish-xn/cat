import { expect, it } from 'vitest';
import { makeRoom, runUntil, SEATS, TIMINGS } from './helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { AUGMENT_TIERS } from '../../src/simulation/content/augment-policy';
import { deriveAugmentTier } from '../../src/simulation/augment-offers';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { toSeatPrivateView } from '../../src/server/room/projection';
import { validateClientCommand } from '../../src/server/net/messages';

it('eight room seats share tiers across all three nodes and forward free rerolls through the gate', () => {
  // Empty bot boards keep this rule/protocol test at tick zero; no human deadline auto-deployment.
  const clock = new ManualClock();
  const room = new Room(SEATS.map(seat => ({...seat,kind:'bot'})), {roomId:'tier-test',seed:42,clock,resolver:new TwoSidedBattleResolver(),...TIMINGS});
  room.start();
  for (const seat of room.state.seats) {
    const unit = seat.match.preparation.units.find(u => u.team === 'player')!;
    expect(room.handle(seat.seatId,{type:'deploy',unitId:unit.id,target:{kind:'bench',slot:0}}).ok).toBe(true);
  }
  for (const roundId of ['2-1','3-2','4-2']) {
    runUntil(room,clock,s => s.roundId === roundId && s.phase === 'choice');
    const choices = room.state.seats.map(seat => seat.match.pendingChoice!);
    expect(choices.every(c => c?.kind === 'augment')).toBe(true);
    const tier = deriveAugmentTier(42,choices[0].choiceId);
    expect(new Set(choices.map(c => c.augmentTier))).toEqual(new Set([tier]));
    for (const seat of room.state.seats) {
      const c = seat.match.pendingChoice!;
      expect(restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(seat.match))).toEqual(seat.match);
      expect(c.offers.every(id => AUGMENT_TIERS[id] === tier)).toBe(true);
      // v15: each of the three cards has its own free reroll; only the card named by optionIndex changes.
      expect(c.rerollsRemaining).toBe(3);
      expect(toSeatPrivateView(seat.match).pendingChoice?.augmentOptions?.map(o => o.rerollAvailable)).toEqual([true, true, true]);
      const command = validateClientCommand({type:'rerollAugment',choiceId:c.choiceId,generation:0,optionIndex:1});
      const rerolled = room.handle(seat.seatId,command);
      expect(rerolled.ok).toBe(true); if (!rerolled.ok) throw new Error(rerolled.reason);
      const next = rerolled.state.pendingChoice!;
      expect(restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(rerolled.state))).toEqual(rerolled.state);
      expect([next.offers[0], next.offers[2]]).toEqual([c.offers[0], c.offers[2]]);
      expect(c.offers.includes(next.offers[1]!)).toBe(false);
      expect(AUGMENT_TIERS[next.offers[1]!]).toBe(tier);
      const view = toSeatPrivateView(rerolled.state).pendingChoice;
      expect(view).toMatchObject({augmentTier:tier,rerollsRemaining:2,generation:1});
      expect(view?.augmentOptions?.map(o => o.rerollAvailable)).toEqual([true, false, true]);
      const before = room.state;
      expect(room.handle(seat.seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:1,optionIndex:1}))
        .toMatchObject({ok:false,reason:'augment-rerolls-exhausted'});
      expect(room.state).toBe(before);
    }
  }
  room.dispose();
});

it('reroll wire validation refuses unknown fields, a missing card index, negative and non-integer generations', () => {
  const command = {type:'rerollAugment',choiceId:'round:2-1:augment',generation:0,optionIndex:2};
  expect(validateClientCommand(command)).toEqual(command);
  const {optionIndex: _index, ...whole} = command;
  for (const value of [whole,{...command,tier:'gold'},{...command,generation:-1},{...command,generation:0.5},{...command,choiceId:''},
    {...command,optionIndex:-1},{...command,optionIndex:0.5},{...command,optionIndex:'1'}])
    expect(() => validateClientCommand(value)).toThrow();
  const {room} = makeRoom(); const before = room.state;
  expect(room.handle('s0',command as Parameters<typeof room.handle>[1])).toMatchObject({ok:false,reason:'wrong-phase'});
  expect(room.state).toBe(before); room.dispose();
});

it('default choice deadline is 48000 ms: no timeout at 30000 or 47999, exactly one at 48000', () => {
  expect(ROOM_TIMING_DEFAULTS.choiceMs).toBe(48_000);
  const clock = new ManualClock();
  const room = new Room(SEATS.map(seat => ({...seat,kind:'bot'})), {roomId:'deadline-test',seed:42,clock,
    resolver:new TwoSidedBattleResolver(),...TIMINGS,choiceMs:ROOM_TIMING_DEFAULTS.choiceMs});
  room.start();
  for (const seat of room.state.seats) {
    const unit = seat.match.preparation.units.find(u => u.team==='player')!;
    expect(room.handle(seat.seatId,{type:'deploy',unitId:unit.id,target:{kind:'bench',slot:0}}).ok).toBe(true);
  }
  runUntil(room,clock,s => s.roundId==='2-1' && s.phase==='choice');
  const before = room.state, opened = clock.now();
  expect(before.deadlineAt).toBe(opened+48_000);
  const choice = before.seats[0].match.pendingChoice!;
  clock.advance(30_000); expect(room.state).toBe(before);
  clock.advance(17_999); expect(room.state).toBe(before);
  clock.advance(1);
  expect(clock.now()).toBe(opened+48_000);
  expect(room.state.fault).toBeNull();
  expect(room.state.seats[0].match.augments).toContainEqual({definitionId:choice.offers[0],choiceId:choice.choiceId,acquiredRound:4});
  const after = room.state;
  clock.advance(0); expect(room.state).toBe(after);
  room.dispose();
});
