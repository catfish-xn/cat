/**
 * v17 server acceptance 1 (docs/V17_AVARICE_ONLINE.md): the real draw. A room plays to its 4-6 anomaly node; one human
 * seat finds avarice-incarnate in its initial offer, another only after paid rerolls, and both choose it through the
 * room. The offers come from the online pool (56, avarice included), the +5 has one receipt that no repeated choice,
 * reconnect or later round pays again, and the seat's next battle samples its real gold changes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { toSeatPrivateView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { anomalyCandidates } from '../../src/simulation/content/anomalies';
import { claimAllOrbs, makeRoom, runUntil } from './helpers';
import { AVARICE, avariceReceipts, chooseAvarice, drainGold, offerAvarice, PRIVATE_BANK, pvpBattleOf, runToAnomalyWindow, seatOf, spendGold } from './v17-avarice-helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

describe('v17 avarice: the real draw in a room', () => {
  it('initial offer and paid reroll both reach avarice; the +5 is paid once; the next battle samples real gold', () => {
    // Seed 1: human s3's initial 4-6 offer (first board unit as target) holds avarice; s0's does not.
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 1 });
    disposers.push(() => room.dispose());
    room.start();
    runToAnomalyWindow(room, clock);
    const online = new Set(anomalyCandidates(true));
    expect(online.size).toBe(56);
    expect(online.has(AVARICE)).toBe(true);
    const initial = offerAvarice(room, 's3', 'initial');
    expect(initial.rerolls).toBe(0);
    const rerolled = offerAvarice(room, 's0', 'reroll');
    expect(rerolled.rerolls).toBeGreaterThan(0);
    for (const offered of [initial.offered, rerolled.offered]) for (const id of offered.pendingChoice!.offers) expect(online.has(id)).toBe(true);
    const choiceId = initial.offered.pendingChoice!.choiceId, generation = initial.offered.pendingChoice!.generation;
    const chosen = chooseAvarice(room, 's3');
    chooseAvarice(room, 's0');
    // The seat's own view shows the binding; no bank value.
    expect(toSeatPrivateView(chosen).anomalyBinding).toMatchObject({ definitionId: AVARICE });
    // A repeated choice is refused and publishes nothing.
    const published = room.state;
    expect(room.handle('s3', { type: 'choose', choiceId, generation, definitionId: AVARICE })).toMatchObject({ ok: false });
    expect(room.state).toBe(published);
    // A dropped and resumed connection pays nothing.
    expect(room.setConnected('s3', false)).toBe(true);
    expect(room.setConnected('s3', true)).toBe(true);
    expect(seatOf(room.state, 's3').match.gold).toBe(chosen.gold);
    expect(avariceReceipts(seatOf(room.state, 's3').match)).toHaveLength(1);
    drainGold(room, 's3');
    // The next battle the seat fights: its gold change during it reaches the rules.
    runUntil(room, clock, state => { claimAllOrbs(room); return state.phase === 'battle'; });
    const round = room.state.round;
    clock.advance(400);
    const gold = spendGold(room, 's3');
    const pvp = pvpBattleOf(room.state, 's3');
    if (!pvp) expect(seatOf(room.state, 's3').match.combat!.tick).toBeGreaterThan(0);
    runUntil(room, clock, state => state.round === round && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    if (pvp) {
      const settled = pvpBattleOf(room.state, 's3')!;
      const team = settled.battle.a.seatId === 's3' ? 'player' : 'enemy';
      expect(settled.battle.bankSamples!.filter(sample => sample.team === team).map(sample => sample.liveGold)).toEqual([gold]);
    } else {
      expect(seatOf(room.state, 's3').match.roundResults.at(-1)!.bankSamples!.at(-1)!.liveGold).toBe(gold);
    }
    expect(JSON.stringify(toSeatPrivateView(seatOf(room.state, 's3').match))).not.toMatch(PRIVATE_BANK);
    // Two more rounds: still one receipt each.
    runUntil(room, clock, state => { claimAllOrbs(room); return state.round >= round + 2 || state.phase === 'ended'; });
    for (const seatId of ['s0', 's3']) if (seatOf(room.state, seatId).alive) expect(avariceReceipts(seatOf(room.state, seatId).match)).toHaveLength(1);
  }, 120_000);
});
