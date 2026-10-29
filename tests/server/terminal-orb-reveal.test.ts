import { describe, expect, it } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toSeatPrivateView, toPlayerView, toCombatReplayFor, startReplaySpotCheck } from '../../src/server/room/projection';
import { readLootView } from '../../src/simulation/loot-view';
import { validateMultiplayerOrbLedger } from '../../src/simulation/orb-restore';
import { validateB8Loot } from '../../src/simulation/b8-restore';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { revealMatchCombatStreamTerminal } from '../../src/simulation/match';
import { runUntil, SEATS, TIMINGS } from './helpers';

function fixture(sliceTicks = 8) {
  const clock = new ManualClock();
  const room = new Room(SEATS.map(s => ({ ...s, kind: 'human' })), { ...ROOM_TIMING_DEFAULTS, ...TIMINGS,
    roomId: 'terminal-orb', seed: 42, clock, resolver: new TwoSidedBattleResolver(), combatStreaming: true, sliceTicks, sliceMs: 20 });
  room.start(); return { room, clock };
}
const json = (value: unknown) => JSON.stringify(value);

describe('terminal orb server integration', () => {
  it('sliced opening publishes a tick-zero PvE pending terminal before any combat tick or settlement', () => {
    const { room, clock } = fixture(1);
    try {
      runUntil(room, clock, s => s.phase === 'preparation');
      for (const unit of room.state.seats[0].match.preparation.units.filter(u => u.team === 'player')) {
        expect(room.handle('s0', { type: 'sell', unitId: unit.id })).toMatchObject({ ok: true });
      }
      const before = room.state.seats[0].match;
      const publications: typeof room.state[] = [];
      room.subscribe(state => { if (state.phase === 'battle') publications.push(state); });
      // fireNext preserves each continuation boundary; runNext drains all same-time slices.
      for (let n = 0; !room.combatInitializationPending && n < 100; n++) expect(clock.fireNext()).toBe(true);
      expect(room.combatInitializationPending).toBe(true);
      expect(room.hasCombatStreams).toBe(false);
      expect(room.state.seats[0].match).not.toHaveProperty('pendingCombatTerminal');
      expect(publications).toHaveLength(0);
      for (let n = 0; publications.length === 0 && n < 2000; n++) expect(clock.fireNext()).toBe(true);
      expect(publications).toHaveLength(1);
      const published = publications[0], own = published.seats[0];
      expect(own.match.pendingCombatTerminal).toMatchObject({ tick: 0, status: 'finished', result: 'enemyWin' });
      expect(room.committedBattleTick).toBe(0);
      expect(room.combatStreamFor('s0')!.terminal).toMatchObject({ tick: 0, status: 'finished' });
      expect(published.battles).toHaveLength(0);
      expect(published.settlements).toHaveLength(0);
      expect(own.serverEvents!.events.some(e => e.type === 'lootForfeited')).toBe(true);
      expect(own.serverEvents!.events.some(e => e.type === 'lootRevealed')).toBe(false);
      expect(toSeatPrivateView(own.match).unclaimedOrbs).toEqual(readLootView(before).unclaimedOrbs);
      for (const field of ['gold', 'items', 'playerHp', 'roundResults'] as const) expect(own.match[field]).toEqual(before[field]);
      expect(() => validateMultiplayerOrbLedger(own.match)).not.toThrow();
      expect(() => validateB8Loot(own.match)).not.toThrow();
      expect(room.state.fault).toBeNull();
    } finally { room.dispose(); }
  });

  it('publishes the final PvE orb to its owner on the sealed terminal tick, before planning or settlement', () => {
    const { room, clock } = fixture(1);
    try {
      runUntil(room, clock, s => s.phase === 'battle');
      const initial = room.state.seats[0].match;
      const publications: typeof room.state[] = [];
      room.subscribe(state => publications.push(state));
      runUntil(room, clock, () => publications.some(s => !!s.seats[0].match.pendingCombatTerminal), 20_000);
      const published = publications.find(s => !!s.seats[0].match.pendingCombatTerminal)!;
      expect(published.phase).toBe('battle');
      expect(published.battles).toHaveLength(0);
      expect(published.settlements).toHaveLength(0);
      const own = published.seats[0], pending = own.match.pendingCombatTerminal!;
      expect(own.serverEvents!.events.some(e => e.type === 'lootRevealed' && e.death.tick === pending.tick)).toBe(true);
      const orbs = toSeatPrivateView(own.match).unclaimedOrbs!;
      expect(orbs.length).toBeGreaterThan(readLootView(initial).unclaimedOrbs!.length);
      const peer = json(toPlayerView(published, 's1', clock.now()));
      expect(orbs).toEqual(readLootView(own.match).unclaimedOrbs);
      for (const orb of orbs) expect(peer).not.toContain(orb.orbId);
      expect(json(toSeatPrivateView(own.match))).not.toContain('pendingCombatTerminal');
      for (const seat of published.seats) {
        expect(() => validateMultiplayerOrbLedger(seat.match)).not.toThrow();
        expect(() => validateB8Loot(seat.match)).not.toThrow();
      }
      runUntil(room, clock, s => s.settlements.length === 1, 20_000);
      expect(readLootView(room.state.seats[0].match).unclaimedOrbs!.map(o => o.orbId)).toEqual(orbs.map(o => o.orbId));
      expect(room.state.fault).toBeNull();
    } finally { room.dispose(); }
  });

  it.each([1, 5])('round %i PvE/PvP: terminal-gap claim, reconnect projection, unique grants and replay remain consistent', round => {
    const { room, clock } = fixture();
    try {
      runUntil(room, clock, s => s.round === round && s.phase === 'battle', 20_000);
      runUntil(room, clock, () => !!room.combatStreamFor('s0')?.terminal, 20_000);
      expect(room.state.settlements).toHaveLength(round - 1);
      const before = room.state.seats[0].match, stream = room.combatStreamFor('s0')!;
      const orb = readLootView(before).unclaimedOrbs!.find(o => !o.queued)!;
      expect(orb).toBeDefined();
      if (round === 5) {
        expect(before.m8.round.kind).toBe('pvp');
        expect(before).not.toHaveProperty('pendingCombatTerminal');
        // PvP uses its authenticated two-sided receipts; a PvE terminal cannot reveal PvP rewards.
        expect(revealMatchCombatStreamTerminal(before, { board: stream.initial.board, units: [], tick: stream.terminal!.tick,
          maxTicks: 1200, status: 'finished', result: 'draw', combatId: `round-${round}` }))
          .toEqual({ ok: false, state: before, reason: 'wrong-phase' });
      } else expect(before.pendingCombatTerminal!.neutralReceipts!.deaths.some(d => d.tick === before.pendingCombatTerminal!.tick)).toBe(true);
      expect(room.handle('s0', { type: 'claimOrb', round, orbId: orb.orbId })).toMatchObject({ ok: true });
      const queued = room.state.seats[0].match;
      expect(queued.items).toEqual(before.items);
      expect(queued.m8.loot.receipts).toEqual(before.m8.loot.receipts);
      expect(() => validateMultiplayerOrbLedger(queued)).not.toThrow();
      expect(() => validateB8Loot(queued)).not.toThrow();
      const restored = restoreSharedOrbSnapshot(room.state.pool, json(queued), room.augmentHistoryAuthority('s0'));
      expect(toSeatPrivateView(restored)).toEqual(toSeatPrivateView(queued));
      room.setConnected('s0', false); room.setConnected('s0', true);
      expect(toSeatPrivateView(room.state.seats[0].match).unclaimedOrbs!.find(o => o.orbId === orb.orbId)?.queued).toBe(true);
      expect(room.handle('s0', { type: 'claimOrb', round, orbId: orb.orbId })).toMatchObject({ ok: false });
      runUntil(room, clock, s => s.settlements.length === round, 20_000);
      expect(room.state.fault).toBeNull();
      const paid = room.state.seats[0].match;
      const entries = paid.m8.loot.frozen.rounds.flatMap(r => r.orbs).find(o => o.orbId === orb.orbId)!.entries;
      for (const entry of entries) expect(paid.m8.loot.receipts.filter(r => r.dropId === entry.dropId)).toHaveLength(1);
      expect(paid.m8.loot.queuedOrbClaims).toEqual([]);
      expect(paid).not.toHaveProperty('pendingCombatTerminal');
      expect(json(toCombatReplayFor(room.state, 's0')!.replay)).toBe(json({ initial: stream.initial, ticks: stream.ticks, terminal: stream.terminal }));
      const check = startReplaySpotCheck(room.state.battles, round, true, room.state.battleSeeds)!;
      let result: ReturnType<typeof check.advance> = null;
      for (let i = 0; !result && i < 2000; i++) result = check.advance(8);
      expect(result).not.toBeNull();
      expect(result!.every(r => r.firstDifference === null)).toBe(true);
    } finally { room.dispose(); }
  }, 60_000);
});
