/**
 * v17 server acceptance 2 (docs/V17_AVARICE_ONLINE.md): two human seats that both picked avarice-incarnate through the
 * room meet in a real two-sided battle. Each one's gold changes reach only its own side's samples (A = player, B =
 * enemy), each seat sees the battle from its own side, and nobody is sent a bank value. A mirror battle never samples
 * its frozen copy's side, while its real seat A still does.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { toCombatReplayFor, toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { toCombatReplay, type CombatReplay } from '../../src/server-entry';
import { runUntil } from './helpers';
import { avariceRoom, earnGold, nextBattle, PRIVATE_BANK, pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

const teamCount = (replay: CombatReplay, team: string) => replay.initial.units.filter(unit => unit.team === team).length;

describe('v17 avarice: two human seats in one battle', () => {
  it('A\'s and B\'s gold changes reach only their own side, each seat sees its own side, and no bank leaves the room', () => {
    const { room, clock } = avariceRoom(dispose => disposers.push(dispose));
    nextBattle(room, clock, '4-6');
    const frozen = pvpBattleOf(room.state, 's1')!;
    expect(frozen.participants).toEqual(['s1', 's2']);
    expect([frozen.battle.a.seatId, frozen.battle.b.seatId]).toEqual(['s1', 's2']);
    const hp = { s1: seatOf(room.state, 's1').hp, s2: seatOf(room.state, 's2').hp };
    clock.advance(400);
    const aGold = [spendGold(room, 's1')];
    clock.advance(200);
    const bGold = earnGold(room, 's2');
    clock.advance(200);
    aGold.push(...earnGold(room, 's1'));
    runUntil(room, clock, state => state.roundName === '4-6' && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const published = pvpBattleOf(room.state, 's1')!;
    expect(published).not.toBe(frozen);
    const samples = published.battle.bankSamples!;
    // Under the bonus cap the samples change the fight itself.
    expect(toCombatReplay(published.battle)).not.toEqual(toCombatReplay(frozen.battle));
    // Each side's samples are exactly that seat's gold changes, in order; nothing crosses over.
    expect(samples.filter(sample => sample.team === 'player').map(sample => sample.liveGold)).toEqual(aGold);
    expect(samples.filter(sample => sample.team === 'enemy').map(sample => sample.liveGold)).toEqual(bGold);
    // Both seats settle the live run's proposals.
    expect(seatOf(room.state, 's1').hp).toBe(Math.max(0, hp.s1 - published.proposals.a.damage));
    expect(seatOf(room.state, 's2').hp).toBe(Math.max(0, hp.s2 - published.proposals.b.damage));
    // Each seat sees the battle from its own side: A's player team is B's enemy team and back.
    const a = toCombatReplayFor(room.state, 's1')!.replay, b = toCombatReplayFor(room.state, 's2')!.replay;
    expect(teamCount(b, 'player')).toBe(teamCount(a, 'enemy'));
    expect(teamCount(b, 'enemy')).toBe(teamCount(a, 'player'));
    expect(b.terminal.tick).toBe(a.terminal.tick);
    // No bank values in either replay, either seat's private view or anyone's public view.
    for (const wire of [a, b, toSeatPrivateView(seatOf(room.state, 's1').match), toSeatPrivateView(seatOf(room.state, 's2').match),
      toPlayerView(room.state, 's1', clock.now()), toPlayerView(room.state, 's3', clock.now())]) expect(JSON.stringify(wire)).not.toMatch(PRIVATE_BANK);
  }, 120_000);

  it('a mirror battle samples its real seat A and never the frozen copy\'s side', () => {
    const { room, clock } = avariceRoom(dispose => disposers.push(dispose));
    nextBattle(room, clock, '5-3');
    const mirror = pvpBattleOf(room.state, 's2')!;
    // s2 fights the frozen copy of s3, who (with avarice too) fights its own real battle this round.
    expect(mirror.participants).toEqual(['s2']);
    expect(mirror.battle.b.seatId).toBe('s3');
    const own = pvpBattleOf(room.state, 's3')!;
    expect(own.battleId).not.toBe(mirror.battleId);
    const hp3 = seatOf(room.state, 's3').hp;
    clock.advance(400);
    const aGold = spendGold(room, 's2');
    const copyGold = spendGold(room, 's3');
    runUntil(room, clock, state => state.roundName === '5-3' && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const published = room.state.battles.find(battle => battle.battleId === mirror.battleId)!;
    expect(published.kind).toBe('two-sided');
    if (published.kind !== 'two-sided') return;
    expect(published).not.toBe(mirror);
    expect(published.battle.bankSamples!.map(sample => [sample.team, sample.liveGold])).toEqual([['player', aGold]]);
    // s3's gold went to its own battle; the mirror's copy settles nothing for s3.
    const ownPublished = room.state.battles.find(battle => battle.battleId === own.battleId)!;
    expect(ownPublished.kind === 'two-sided' && ownPublished.battle.bankSamples?.filter(sample => sample.liveGold === copyGold).length).toBe(1);
    const ownSide = ownPublished.kind === 'two-sided' && ownPublished.battle.a.seatId === 's3' ? 'a' : 'b';
    expect(seatOf(room.state, 's3').hp).toBe(Math.max(0, hp3 - (ownPublished.kind === 'two-sided' ? ownPublished.proposals[ownSide].damage : NaN)));
  }, 120_000);
});
