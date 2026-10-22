import { describe, expect, it, vi } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CombatStream } from '../../src/server/room/combat-stream';
import { startReplaySpotCheck } from '../../src/server/room/projection';
import { runUntil, SEATS, TIMINGS } from './helpers';
function fixture() {
  const clock = new ManualClock();
  const room = new Room(SEATS.map(s => ({ ...s, kind: 'human' })), { ...ROOM_TIMING_DEFAULTS, ...TIMINGS,
    roomId: 'equipment', seed: 42, clock, resolver: new TwoSidedBattleResolver(), combatStreaming: true, sliceTicks: 1 });
  room.start(); return { room, clock };
}
function inventory(room: Room, seatId: string) {
  const seam = room as unknown as { current: typeof room.state };
  seam.current = { ...seam.current, seats: seam.current.seats.map(s => s.seatId !== seatId ? s : { ...s, match: { ...s.match,
    items: [...s.match.items, { id: 'item-800', definitionId: 'sword', location: { kind: 'inventory' } }], nextItemSerial: 801 } }) };
}
describe('server equipment tick gate', () => {
  it.each([1, 5])('round %i: rules command, atomic failure, next frame and terminal audit', round => {
    const { room, clock } = fixture();
    try {
      runUntil(room, clock, s => s.round === round && s.phase === 'preparation', 20000); inventory(room, 's0');
      runUntil(room, clock, s => s.round === round && s.phase === 'battle', 20000); clock.advance(100);
      const match = room.state.seats[0].match, unit = match.preparation.units.find(u => u.location.kind === 'board')!;
      const stream = room.combatStreamFor('s0')!, tick = stream.ticks.at(-1)!.tick;
      const bad = room.handle('s0', { type: 'equip', itemId: 'absent', unitId: unit.id, slot: 0 });
      expect(bad.ok).toBe(false); expect(room.state.seats[0].match).toBe(match);
      expect(room.handle('s0', { type: 'equip', itemId: 'item-800', unitId: unit.id, slot: 0 }).ok).toBe(true);
      expect(stream.ticks.at(-1)!.tick).toBe(tick);
      clock.advance(50);
      expect(stream.ticks.at(-1)!.tick).toBe(tick + 1);
      expect(stream.ticks.at(-1)!.events.some(e => e.type === 'unitUpdated' && e.changes.equipment?.some(i => i.definitionId === 'sword'))).toBe(true);
      runUntil(room, clock, s => s.battles.length > 0, 20000);
      const check = startReplaySpotCheck(room.state.battles, round, true, room.state.battleSeeds)!;
      let result = check.advance(50); while (!result) result = check.advance(50);
      expect(result.every(r => r.firstDifference === null), JSON.stringify(result)).toBe(true);
      expect(room.state.fault).toBeNull();
      expect(JSON.stringify(stream)).not.toContain('inputLog'); expect(JSON.stringify(stream)).not.toContain('equipmentReceipts');
    } finally { room.dispose(); }
  }, 60000);
  it('a writer arriving mid-boundary is deferred and stamps the next unsealed tick', () => {
    const { room, clock } = fixture(); inventory(room, 's0');
    let injected = false;
    const original = CombatStream.prototype.advancePve;
    const spy = vi.spyOn(CombatStream.prototype, 'advancePve').mockImplementation(function(this: CombatStream, state) {
      const next = original.call(this, state);
      if (!injected) {
        injected = true;
        const unitId = state.preparation.units.find(u => u.location.kind === 'board')!.id;
        expect(room.nextBattleInputTick).toBe(2);
        expect(room.handle('s0', { type: 'equip', itemId: 'item-800', unitId, slot: 0 })).toMatchObject({ queued: true });
      }
      return next;
    });
    try {
      runUntil(room, clock, s => s.phase === 'battle'); clock.advance(50);
      expect(room.state.seats[0].match.combat!.pendingEquipment![0].input.effectiveTick).toBe(2);
      clock.advance(50);
      expect(room.state.seats[0].match.combat!.equipmentReceipts![0].input.effectiveTick).toBe(2);
    } finally { spy.mockRestore(); room.dispose(); }
  });
});
