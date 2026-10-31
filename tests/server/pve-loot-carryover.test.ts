import { expect, it } from 'vitest';
import { LocalRoomClient } from '../../src/rendering/online/local-room-client';
import { readUnclaimedOrbs } from '../../src/rendering/online/orb-dock';
import { ManualClock } from '../../src/server/room/clock';
import { toPrivateSeatView } from '../../src/simulation/private-seat-view';
import { claimBotPreparationOrbs } from '../../src/simulation/bot';
import { readLootView } from '../../src/simulation/match';
import { claimAllOrbs, makeRoom, runUntil } from './helpers';

it('a room loss keeps the orb for the next PvE, where the seat, the bot helper and the 2D/3D view can see it', () => {
  const { room, clock } = makeRoom();
  try {
    room.start();
    const player = room.state.seats[0].match.preparation.units.find(unit => unit.team === 'player')!;
    expect(room.handle('s0', { type: 'sell', unitId: player.id }).ok).toBe(true);
    runUntil(room, clock, state => state.phase === 'settlement' && state.seats[0].match.roundResults.length === 1);
    const lost = room.state.seats[0].match;
    expect(lost.roundResults[0].result).not.toBe('playerWin');
    expect(lost.m8.loot.carry?.length).toBeGreaterThan(0);
    expect(lost.m8.loot.carry?.every(row => row.deliverRoundId === '1-3')).toBe(true);
    expect(readLootView(lost).revealedDrops.some(drop => lost.m8.loot.carry?.some(row => row.dropId === drop.dropId))).toBe(false);

    runUntil(room, clock, state => state.phase === 'preparation' && state.seats[0].match.roundDefinitionId === '1-3');
    const seat = room.state.seats[0].match;
    const view = toPrivateSeatView(seat);
    const orbs = view.unclaimedOrbs ?? [];
    expect(orbs.length).toBeGreaterThan(0);
    expect(orbs.every(orb => seat.m8.loot.carry?.some(row => orb.entries.length > 0 && seat.m8.loot.frozen.rounds.some(round => round.orbs.some(plan => plan.orbId === orb.orbId && plan.entries.some(entry => entry.dropId === row.dropId)))))).toBe(true);
    const shown = readUnclaimedOrbs(view as unknown as Parameters<typeof readUnclaimedOrbs>[0]);
    expect(shown.map(orb => orb.orbId)).toEqual(orbs.map(orb => orb.orbId));
    expect(view.revealedLoot?.revealedDrops.some(drop => shown.some(orb => orb.orbId === drop.orbId) && (drop.sourceUnitId ?? '').length > 0)).toBe(true);
    const claimed = claimBotPreparationOrbs(room.state.pool, seat);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.state.m8.loot.direct.some(drop => drop.status === 'carried' && seat.m8.loot.carry?.some(row => row.dropId === drop.dropId && row.deliverRoundId === '1-3'))).toBe(false);
    expect(claimed.state.m8.loot.receipts.length).toBeGreaterThan(seat.m8.loot.receipts.length);
    expect(claimAllOrbs(room, ['s0'])).toBeGreaterThan(0);
    const paid = room.state.seats[0].match;
    expect(paid.m8.loot.direct.some(drop => drop.status === 'carried')).toBe(false);
    expect(room.state.fault).toBeNull();
  } finally { room.dispose(); }
});

it('the local room client projects the same carried orb', () => {
  const clock = new ManualClock();
  const client = new LocalRoomClient({ seed: 42, clock, preparationMs: 1000, choiceMs: 500, settlementMs: 200,
    myName: 'PvE', faultAtRound: null, pvpMode: 'two-sided', carousel: false });
  try {
    client.joinQueue('PvE'); client.startMatch();
    const room = client.currentRoom!;
    const mine = room.state.seats.find(seat => seat.kind === 'human')!;
    const player = mine.match.preparation.units.find(unit => unit.team === 'player')!;
    expect(client.send({ type: 'sell', unitId: player.id }).ok).toBe(true);
    runUntil(room, clock, state => state.phase === 'preparation' && state.seats.find(seat => seat.seatId === mine.seatId)!.match.roundDefinitionId === '1-3');
    const seat = room.state.seats.find(entry => entry.seatId === mine.seatId)!.match;
    expect(seat.m8.loot.carry?.some(row => row.deliverRoundId === '1-3')).toBe(true);
    expect((toPrivateSeatView(seat).unclaimedOrbs ?? []).length).toBeGreaterThan(0);
    expect(room.state.fault).toBeNull();
  } finally { client.dispose(); }
});
