import { afterEach, expect, it } from 'vitest';
import type { Room } from '../../src/server/room/room';
import { makeRoom, runUntil, runUntilClaiming } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';

const rooms: Room[] = [];
afterEach(() => { for (const room of rooms.splice(0)) room.dispose(); });

/** v23 batch 3: a seat picks Golemify online with pool conservation asserted on every commit. */
it('Golemify online: the seat keeps only its golem, removed copies return to the pool and the room plays on without a fault', { timeout: 300_000 }, () => {
  for (let seed = 1; seed < 200; seed++) {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed, assertPoolConservation: true });
    rooms.push(room); room.start();
    runUntilClaiming(room, clock, state => state.roundId === '2-1' && state.phase === 'preparation');
    let picker: string | undefined;
    for (const s of room.state.seats.filter(s => s.alive)) {
      for (let slot = 0; slot < 3 && !s.match.pendingChoice!.offers.includes('golemify'); slot++) {
        const c = room.state.seats.find(x => x.seatId === s.seatId)!.match.pendingChoice!;
        if (c.offers.includes('golemify')) break;
        room.handle(s.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot });
      }
      const c = room.state.seats.find(x => x.seatId === s.seatId)!.match.pendingChoice!;
      if (c.offers.includes('golemify')) { picker = s.seatId; break; }
    }
    if (!picker) { room.dispose(); rooms.pop(); continue; }
    const before = room.state.seats.find(x => x.seatId === picker)!;
    const champions = before.match.preparation.units.filter(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon).map(u => u.id);
    expect(champions.length).toBeGreaterThan(0);
    const c = before.match.pendingChoice!;
    expect(room.handle(picker, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'golemify' })).toMatchObject({ ok: true });
    const after = room.state.seats.find(x => x.seatId === picker)!;
    expect(after.match.preparation.units.filter(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon)).toEqual([]);
    expect(after.match.preparation.units.filter(u => u.definitionId === 'augment-golem')).toHaveLength(1);
    expect(room.state.pool.holdings.filter(h => h.seatId === picker && champions.includes(h.unitId))).toEqual([]);
    // The room settles the golem's fights with conservation checks on every commit.
    const end = runUntil(room, clock, state => state.roundId === '3-1' && state.phase === 'preparation' || state.phase === 'ended', 20_000);
    expect(end.fault).toBeNull();
    expect(end.roundId).toBe('3-1');
    return;
  }
  throw new Error('no seat was offered Golemify');
});
