/**
 * C15: the replay of a PvP battle names units by battle id (contract §10.2). The server adds MY units' battle id →
 * original id pairs, from the rules' BattleIdMapping, so the client can show their equipment without parsing ids.
 * Side A and the mirrored side B each get only their own unit entries; PvE gets none; the opponent's entries and
 * every item/augment/anomaly entry stay on the server.
 */
import { describe, expect, it } from 'vitest';
import { readReplayUnitIds } from '../../src/server/net/messages';
import { toCombatReplayFor } from '../../src/server/room/projection';
import { TwoSidedBattleResolver, resolveTwoSidedPvp } from '../../src/server/room/two-sided-resolver';
import { DEFAULT_BATTLE_MAX_STEPS, type RoomState, type SeatState, type TwoSidedBattleResult } from '../../src/server/room/types';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import type { GameClient } from '../../src/rendering/online/protocol';
import { makeRoom, runUntil } from './helpers';

let cache: { pve: RoomState; pvp: RoomState; prep: readonly SeatState[]; equipped: ReadonlySet<string> } | null = null;
/** One room through its PvE rounds and into the first PvP battle; every seat that accepts it equips a sword on unit-1 at 2-1. */
function rooms() {
  if (cache) return cache;
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  room.start();
  const pve = runUntil(room, clock, state => state.phase === 'battle' && state.roundKind === 'pve', 400);
  runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
  const equipped = new Set<string>();
  for (const seat of room.state.seats) {
    const item = seat.match.items.find(candidate => candidate.location.kind === 'inventory');
    const unit = seat.match.preparation.units.find(candidate => candidate.team === 'player' && candidate.location.kind === 'board');
    if (!item || !unit) continue;
    if (room.handle(seat.seatId, { type: 'equip', itemId: item.id, unitId: unit.id, slot: 0 }).ok) equipped.add(seat.seatId);
  }
  const prep = room.state.seats;
  clock.runNext();
  expect(room.state.phase).toBe('battle');
  cache = { pve, pvp: room.state, prep, equipped };
  return cache;
}
const twoSided = (state: RoomState) => state.battles.filter((battle): battle is TwoSidedBattleResult => battle.kind === 'two-sided');

describe('C15 own-unit mapping on the replay', () => {
  it('side A and mirrored side B each get exactly their own unit entries, never the opponent\'s', () => {
    const { pvp, equipped } = rooms();
    expect(equipped.size).toBeGreaterThan(0);
    const real = twoSided(pvp).filter(battle => battle.participants.length === 2);
    expect(real.length).toBeGreaterThan(0);
    for (const battle of real) {
      const { a, b } = battle.battle;
      // The mapping really holds item entries for this battle, so leaving them out is tested, not vacuous.
      if (equipped.has(a.seatId) || equipped.has(b.seatId)) expect(battle.battle.mapping.some(entry => entry.kind === 'item')).toBe(true);
      for (const [me, other] of [[a.seatId, b.seatId], [b.seatId, a.seatId]] as const) {
        const { unitIds, replay } = toCombatReplayFor(pvp, me)!;
        const mine = battle.battle.mapping.filter(entry => entry.kind === 'unit' && entry.seatId === me);
        expect(mine.length).toBeGreaterThan(0);
        expect(unitIds).toEqual(mine.map(entry => ({ combatId: entry.combatId, originalId: entry.originalId })));
        for (const entry of unitIds) expect(Object.keys(entry).sort()).toEqual(['combatId', 'originalId']);
        // Every pair names a unit that is on my side of my replay.
        for (const { combatId } of unitIds) expect(replay.initial.units.find(unit => unit.id === combatId)?.team).toBe('player');
        // Nothing of the opponent, nor any item/augment/anomaly id, is on the wire.
        const wire = JSON.stringify(unitIds);
        for (const entry of battle.battle.mapping) {
          if (entry.seatId === other || entry.kind !== 'unit') expect(wire).not.toContain(JSON.stringify(entry.combatId));
        }
      }
    }
  }, 60_000);

  it('a mirror battle gives its real seat only its own entries; PvE replays carry none', () => {
    const { pve, prep } = rooms();
    // s0 fights a frozen copy of s1 (B side, mirrorOfSeatId); both equipped a sword at 2-1.
    const seat = (index: number) => ({ seatId: prep[index]!.seatId, state: prep[index]!.match });
    const mirror = resolveTwoSidedPvp({ battleId: 'test-room:r4:m', roomId: 'test-room', round: 4, roundId: '2-1', roundKind: 'pvp', roomRevision: 10,
      battleSeed: 0x1234_5678, maxSteps: DEFAULT_BATTLE_MAX_STEPS, seats: [seat(0)], mirrorOf: seat(1) });
    expect(mirror.battle.mirrorOfSeatId).toBe('s1');
    expect(mirror.battle.mapping.some(entry => entry.kind === 'item')).toBe(true);
    const state = { battles: [mirror] } as unknown as RoomState;
    const { unitIds } = toCombatReplayFor(state, 's0')!;
    expect(unitIds).toEqual(mirror.battle.mapping.filter(entry => entry.kind === 'unit' && entry.seatId === 's0').map(entry => ({ combatId: entry.combatId, originalId: entry.originalId })));
    expect(unitIds.length).toBeGreaterThan(0);
    for (const entry of mirror.battle.mapping.filter(candidate => candidate.seatId === 's1' || candidate.kind !== 'unit')) expect(JSON.stringify(unitIds)).not.toContain(JSON.stringify(entry.combatId));
    // The mirrored source is not a participant: it gets no replay (and so no mapping) of this battle.
    expect(toCombatReplayFor(state, 's1')).toBeNull();
    let pveReplays = 0;
    for (const seat of pve.seats) {
      const replay = toCombatReplayFor(pve, seat.seatId);
      if (!replay) continue;
      pveReplays++;
      expect(replay.unitIds).toEqual([]);
    }
    expect(pveReplays).toBeGreaterThan(0);
  }, 60_000);
});

describe('C15 client side', () => {
  it('readReplayUnitIds accepts only an array of {combatId, originalId} strings', () => {
    const ok = [{ combatId: '["t2","s0","unit","unit-1"]', originalId: 'unit-1' }];
    expect(readReplayUnitIds(ok)).toEqual(ok);
    expect(readReplayUnitIds([])).toEqual([]);
    for (const bad of [undefined, null, {}, 'x', [{ combatId: 'a' }], [{ combatId: 'a', originalId: 1 }], [{ combatId: '', originalId: 'u' }], [{ combatId: 'a', originalId: 'u', itemId: 'i' }], [null]]) {
      expect(readReplayUnitIds(bad)).toBeNull();
    }
  });

  it('RemoteSession resolves my battle ids to my units while the replay is on the board, and only then', () => {
    const { pvp } = rooms();
    const battle = twoSided(pvp).find(candidate => candidate.participants.length === 2)!;
    const me = battle.battle.b.seatId, other = battle.battle.a.seatId;
    const { replay, unitIds } = toCombatReplayFor(pvp, me)!;
    const client: GameClient = {
      transport: 'local-room', listen: () => () => {}, joinQueue: () => {}, leaveQueue: () => {}, startMatch: () => {},
      send: () => ({ ok: 'pending', commandId: 0 }), reset: () => {}, dispose: () => {},
    };
    const session = new RemoteSession(client, pvp.seats.find(seat => seat.seatId === me)!.match, () => 0);
    session.receiveReplay(replay, unitIds);
    for (const { combatId, originalId } of unitIds) expect(session.equipmentOwnerId(combatId)).toBe(originalId);
    // The opponent's battle ids resolve to nothing of mine: they are returned as-is and hold no item of my state.
    const theirs = battle.battle.mapping.filter(entry => entry.kind === 'unit' && entry.seatId === other).map(entry => entry.combatId);
    expect(theirs.length).toBeGreaterThan(0);
    for (const id of theirs) {
      expect(session.equipmentOwnerId(id)).toBe(id);
      expect(session.state.items.some(item => item.location.kind === 'unit' && item.location.unitId === id)).toBe(false);
    }
    // A same-round push keeps the battle (T10) and its mapping; the next round's state takes both off the board.
    const mine = pvp.seats.find(seat => seat.seatId === me)!.match;
    session.receiveState(mine);
    expect(session.equipmentOwnerId(unitIds[0]!.combatId)).toBe(unitIds[0]!.originalId);
    session.receiveState({ ...mine, round: mine.round + 1 });
    for (const { combatId } of unitIds) expect(session.equipmentOwnerId(combatId)).toBe(combatId);
  }, 60_000);
});
