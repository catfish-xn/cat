/**
 * v17 server acceptance 3 (docs/V17_AVARICE_ONLINE.md): several gold changes of one seat at the same battle-clock
 * moment, with a refused command and a gold-neutral one in between. Every accepted change is one sample, in commit
 * order and at one rules tick; a refusal and a command that leaves the gold as it was add none and move nothing; the
 * rules take the last value from the next step on, and the live run, its replay and its settlement all agree.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { toCombatReplayFor } from '../../src/server/room/projection';
import { proposeSettlement, toCombatReplay } from '../../src/server-entry';
import { runUntil } from './helpers';
import { avariceRoom, earnGold, nextBattle, pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

describe('v17 avarice: consecutive gold changes at one tick', () => {
  it('samples each accepted change in commit order at one tick; refused and gold-neutral commands add nothing', () => {
    const { room, clock } = avariceRoom(dispose => disposers.push(dispose));
    nextBattle(room, clock, '4-6');
    const frozen = pvpBattleOf(room.state, 's1')!;
    clock.advance(400);
    const golds: number[] = [];
    golds.push(...earnGold(room, 's1'));
    golds.push(spendGold(room, 's1'));
    // A refused command: same published state, same seat revision, pool, gold and RNG.
    const published = room.state, seat = seatOf(published, 's1');
    expect(room.handle('s1', { type: 'sell', unitId: 'no-such-unit' })).toMatchObject({ ok: false });
    expect(room.handle('s1', { type: 'buy', slot: 0, generation: seat.match.shop.generation + 1 })).toMatchObject({ ok: false });
    expect(room.state).toBe(published);
    // A gold-neutral command is accepted but is no sample.
    expect(room.handle('s1', { type: 'shopLock', locked: !seat.match.shop.locked, generation: seat.match.shop.generation })).toMatchObject({ ok: true });
    expect(seatOf(room.state, 's1').match.gold).toBe(seat.match.gold);
    golds.push(spendGold(room, 's1'));
    golds.push(...earnGold(room, 's1'));
    expect(golds.length).toBeGreaterThanOrEqual(4);
    runUntil(room, clock, state => state.roundName === '4-6' && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const live = pvpBattleOf(room.state, 's1')!;
    expect(live).not.toBe(frozen);
    const samples = live.battle.bankSamples!.filter(sample => sample.team === 'player');
    expect(samples.map(sample => sample.liveGold)).toEqual(golds);
    // All at one rules tick: the battle clock's tick plus the lead (400 ms = 8 ticks, lead 8).
    expect(new Set(samples.map(sample => sample.tick)).size).toBe(1);
    expect(samples[0]!.tick).toBeGreaterThanOrEqual(16);
    // The rules re-run the private samples to the same replay and settlement the room published (after transport).
    const transported = JSON.parse(JSON.stringify(live.battle));
    expect(toCombatReplay(transported)).toEqual(toCombatReplayFor(room.state, 's1')!.replay);
    expect(proposeSettlement(transported)).toEqual(proposeSettlement(live.battle));
    expect([live.proposals.a.damage, live.proposals.b.damage]).toEqual([proposeSettlement(transported).a.damage, proposeSettlement(transported).b.damage]);
    // The frozen run without the samples differs from tick samples[0].tick + 1 on, never before.
    const frozenReplay = toCombatReplay(frozen.battle), liveReplay = toCombatReplay(transported);
    expect(liveReplay.ticks.slice(0, samples[0]!.tick + 1)).toEqual(frozenReplay.ticks.slice(0, samples[0]!.tick + 1));
    expect(liveReplay).not.toEqual(frozenReplay);
  }, 120_000);
});
