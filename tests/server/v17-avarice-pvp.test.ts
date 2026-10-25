/**
 * v17 server acceptance 2 (docs/V17_AVARICE_ONLINE.md): two human seats that both picked avarice-incarnate through the
 * room meet in a real two-sided battle. Each one's gold changes reach only its own side's samples (A = player, B =
 * enemy), each seat sees the battle from its own side, and nobody is sent a bank value. A mirror battle never samples
 * its frozen copy's side, while its real seat A still does.
 */
import { describe, expect } from 'vitest';
import { toCombatReplayFor, toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { toCombatReplay, type CombatReplay } from '../../src/server-entry';
import { earnGold, HUMANS, humanPair, PRIVATE_BANK, pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';

import { avariceRoute, nextBattleRoute, mirrorBattleRoute } from './avarice-route';
import { registerSlowRoute, routeUntil, RouteResolver } from './slow-route';
const resolver = new RouteResolver();

const teamCount = (replay: CombatReplay, team: string) => replay.initial.units.filter(unit => unit.team === team).length;

describe('v17 avarice: two human seats in one battle', () => {
  registerSlowRoute('A\'s and B\'s gold changes reach only their own side, each seat sees its own side, and no bank leaves the room', function* (env) {
    const { room, clock } = yield* avariceRoute(env);
    yield* nextBattleRoute(room, clock, '4-6');
    // The room's own 4-6 pairing of two avarice seats (s0 A, s1 B under seed 42).
    const { a: seatA, b: seatB, battle: frozen } = humanPair(room.state);
    expect(frozen.participants).toEqual([seatA, seatB]);
    expect(seatA).not.toBe(seatB);
    const hp = { a: seatOf(room.state, seatA).hp, b: seatOf(room.state, seatB).hp };
    clock.advance(400);
    const aGold = [spendGold(room, seatA),spendGold(room,seatA),spendGold(room,seatA)];
    expect(aGold.at(-1)).toBeLessThanOrEqual(8); // enough change to survive integer rounding on low-AD Vex
    clock.advance(200);
    const bGold = earnGold(room, seatB);
    clock.advance(200);
    aGold.push(...earnGold(room, seatA));
    yield* routeUntil(room, clock, state => state.roundName === '4-6' && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const published = pvpBattleOf(room.state, seatA)!;
    expect(published).not.toBe(frozen);
    expect(published.battleId).toBe(frozen.battleId);
    const samples = published.battle.bankSamples!;
    // Under the bonus cap the samples change the fight itself.
    expect(toCombatReplay(published.battle)).not.toEqual(toCombatReplay(frozen.battle));
    // Each side's samples are exactly that seat's gold changes, in order; nothing crosses over.
    expect(samples.filter(sample => sample.team === 'player').map(sample => sample.liveGold)).toEqual(aGold);
    expect(samples.filter(sample => sample.team === 'enemy').map(sample => sample.liveGold)).toEqual(bGold);
    // Both seats settle the live run's proposals.
    expect(seatOf(room.state, seatA).hp).toBe(Math.max(0, hp.a - published.proposals.a.damage));
    expect(seatOf(room.state, seatB).hp).toBe(Math.max(0, hp.b - published.proposals.b.damage));
    // Each seat sees the battle from its own side: A's player team is B's enemy team and back.
    const a = toCombatReplayFor(room.state, seatA)!.replay, b = toCombatReplayFor(room.state, seatB)!.replay;
    expect(teamCount(b, 'player')).toBe(teamCount(a, 'enemy'));
    expect(teamCount(b, 'enemy')).toBe(teamCount(a, 'player'));
    expect(b.terminal.tick).toBe(a.terminal.tick);
    // No bank values in either replay, either seat's private view or anyone's public view (a seat outside the battle too).
    const outsider = HUMANS.find(seatId => seatId !== seatA && seatId !== seatB)!;
    for (const wire of [a, b, toSeatPrivateView(seatOf(room.state, seatA).match), toSeatPrivateView(seatOf(room.state, seatB).match),
      toPlayerView(room.state, seatA, clock.now()), toPlayerView(room.state, outsider, clock.now())]) expect(JSON.stringify(wire)).not.toMatch(PRIVATE_BANK);
  }, resolver);

  registerSlowRoute('a mirror battle samples its real seat A and never the frozen copy\'s side', function* (env) {
    const { room, clock } = yield* avariceRoute(env);
    // The room's first mirror battle of two avarice seats (5-1 under seed 42: s1 against the frozen copy of s2).
    const { a: seatA, copy, battle: mirror } = yield* mirrorBattleRoute(room, clock);
    const round = room.state.roundName;
    // seatA fights the frozen copy of `copy`, who (with avarice too) fights its own real battle this round.
    expect(mirror.participants).toEqual([seatA]);
    expect(mirror.battle.b.seatId).toBe(copy);
    const own = pvpBattleOf(room.state, copy)!;
    expect(own.battleId).not.toBe(mirror.battleId);
    const hpCopy = seatOf(room.state, copy).hp;
    clock.advance(400);
    const aGold = spendGold(room, seatA);
    const copyGold = spendGold(room, copy);
    yield* routeUntil(room, clock, state => state.roundName === round && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const published = room.state.battles.find(battle => battle.battleId === mirror.battleId)!;
    expect(published.kind).toBe('two-sided');
    if (published.kind !== 'two-sided') return;
    expect(published).not.toBe(mirror);
    expect(published.battle.bankSamples!.map(sample => [sample.team, sample.liveGold])).toEqual([['player', aGold]]);
    // The copy's seat's gold went to its own battle; the mirror settles nothing for it.
    const ownPublished = room.state.battles.find(battle => battle.battleId === own.battleId)!;
    expect(ownPublished.kind === 'two-sided' && ownPublished.battle.bankSamples?.filter(sample => sample.liveGold === copyGold).length).toBe(1);
    const ownSide = ownPublished.kind === 'two-sided' && ownPublished.battle.a.seatId === copy ? 'a' : 'b';
    expect(seatOf(room.state, copy).hp).toBe(Math.max(0, hpCopy - (ownPublished.kind === 'two-sided' ? ownPublished.proposals[ownSide].damage : NaN)));
  }, resolver);
});
