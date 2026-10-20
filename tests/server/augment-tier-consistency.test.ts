import { expect, it } from 'vitest';
import { makeRoom, runUntil, SEATS, TIMINGS } from './helpers';
import { Room } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { AUGMENT_TIERS } from '../../src/simulation/content/augment-policy';
import { deriveAugmentTier } from '../../src/simulation/augment-offers';
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
      expect(c.offers.every(id => AUGMENT_TIERS[id] === tier)).toBe(true);
      expect(c.rerollsRemaining).toBe(1);
      const command = validateClientCommand({type:'rerollAugment',choiceId:c.choiceId,generation:0});
      const rerolled = room.handle(seat.seatId,command);
      expect(rerolled.ok).toBe(true); if (!rerolled.ok) throw new Error(rerolled.reason);
      const next = rerolled.state.pendingChoice!;
      expect(next.offers.every(id => !c.offers.includes(id) && AUGMENT_TIERS[id] === tier)).toBe(true);
      expect(toSeatPrivateView(rerolled.state).pendingChoice).toMatchObject({augmentTier:tier,rerollsRemaining:0,generation:1});
      const before = room.state;
      expect(room.handle(seat.seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:1}))
        .toMatchObject({ok:false,reason:'augment-rerolls-exhausted'});
      expect(room.state).toBe(before);
    }
  }
  room.dispose();
});

it('reroll wire validation refuses unknown fields, negative and non-integer generations', () => {
  const command = {type:'rerollAugment',choiceId:'round:2-1:augment',generation:0};
  expect(validateClientCommand(command)).toEqual(command);
  for (const value of [{...command,tier:'gold'},{...command,generation:-1},{...command,generation:0.5},{...command,choiceId:''}])
    expect(() => validateClientCommand(value)).toThrow();
  const {room} = makeRoom(); const before = room.state;
  expect(room.handle('s0',command as Parameters<typeof room.handle>[1])).toMatchObject({ok:false,reason:'wrong-phase'});
  expect(room.state).toBe(before); room.dispose();
});
