import { expect, it, vi } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { getDeploymentCap } from '../../src/simulation/match';
import { claimAllOrbs } from './helpers';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import * as choices from '../../src/simulation/choices';
import { setB1OfferCacheKey } from '../fixtures/b1-offer-cache-key';
const WANT: Record<string, string> = { s0: 'menaces', s1: 'loot-explosion', s2: 'loot-explosion', s3: 'a-golden-find', s4: 'a-golden-find', s5: 'forbidden-magic', s6: 'forbidden-magic' };
const TRAIT: Record<string, string> = { s0: 'family', s5: 'black-rose', s6: 'black-rose' };
const traitsOf = (id: string): readonly string[] => ((UNIT_DEFINITIONS as any)[id]?.traits ?? (UNIT_DEFINITIONS as any)[id]?.traitIds ?? []);
const PRIORITIES = ['menaces', 'loot-explosion', 'a-golden-find', 'forbidden-magic'];
/* Regression (#792, 2026-11-21): an expiring Menaces minion's death must settle cleanly in a room whatever death-reading
 * augment its opponent holds. Eight test-driven seats; augment draws are scripted (as tests/fixtures/b1-scripted-offers: the
 * four augments are put first among the real, eligibility-filtered candidates) and taken with real choose commands: s0 fields
 * a family unit and takes Menaces at 3-2 (its Powder and Silco are gifted and fielded), s1/s2 take Loot Explosion (2-1),
 * s3/s4 A Golden Find (4-2), s5/s6 field Black Rose and take Forbidden Magic (3-2). Everything else is the real shop, battle
 * and settlement. On seed 19, s0's minions expire in battles against all three (rounds 13/15 Loot Explosion, 19/23 Forbidden
 * Magic, 25 Golden Find); before the fix the round-13 settlement faulted the room. Each seat's state then restores. */
it('Menaces minions expiring against Loot Explosion, Golden Find and Forbidden Magic seats settle and restore', () => {
  const generate = choices.generateChoices;
  const spy = vi.spyOn(choices, 'generateChoices').mockImplementation((ids, rng) => {
    const drawn = generate(ids, rng), wanted = PRIORITIES.filter(id => ids.includes(id));
    if (!wanted.length) return drawn;
    const rest = drawn.offers.filter(o => !wanted.includes(o));
    return { ...drawn, offers: [...wanted, ...rest].slice(0, drawn.offers.length) };
  });
  setB1OfferCacheKey(PRIORITIES);
  try {
  { const seed = 19;
    const clock = new ManualClock();
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `s${i}`, name: `s${i}`, kind: 'human' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed, clock, resolver: new TwoSidedBattleResolver(), carousel: CAROUSEL_RULES_BINDING });
    const seen = new Set<string>(), hits: string[] = []; let lastPrep = -1;
    try {
      room.start();
      for (let n = 0; room.state.phase !== 'ended' && room.state.round <= 30 && n < 400000 && new Set(hits.map(h => h.split(' ')[2])).size < 3; n++) {
        expect(room.state.fault).toBeNull();
        for (const seat of room.state.seats) {
          for (let k = 0; k < 4; k++) {
            const c = seat.alive ? room.state.seats.find(x => x.seatId === seat.seatId)!.match.pendingChoice : null; if (!c) break;
            const want = WANT[seat.seatId], has = room.state.seats.find(x => x.seatId === seat.seatId)!.match.augments.some(a => a.definitionId === want);
            const pick = !has && want && c.offers.includes(want) ? want : c.offers.find(o => !PRIORITIES.includes(o)) ?? c.offers[0]!;
            if (!room.handle(seat.seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: pick }).ok) break;
          }
        }
        try { claimAllOrbs(room); } catch {}
        if (room.state.phase === 'preparation' && room.state.round !== lastPrep) {
          lastPrep = room.state.round;
          for (const seat of room.state.seats) {
            if (!seat.alive || seat.match.phase !== 'preparation') continue;
            const id = seat.seatId, m = () => room.state.seats.find(x => x.seatId === id)!.match;
            const want = TRAIT[id];
            if (want) for (let pass = 0; pass < 4; pass++) { for (let slot = 0; slot < 5; slot++) { const o = m().shop.slots[slot]; if (o.status === 'available' && traitsOf(o.definitionId).includes(want) && m().gold >= 1) room.handle(id, { type: 'buy', slot, generation: m().shop.generation }); } if (m().gold < 6 || m().preparation.units.some(u => u.team === 'player' && traitsOf(u.definitionId).includes(want))) break; room.handle(id, { type: 'reroll' }); }
            for (let slot = 0; slot < 5; slot++) { const o = m().shop.slots[slot]; if (o.status === 'available' && m().gold >= 3) room.handle(id, { type: 'buy', slot, generation: m().shop.generation }); }
            const pri = (d: string) => Number(['powder', 'silco'].includes(d)) * 2 + Number(!!want && traitsOf(d).includes(want));
            // the wanted trait goes on the board first: swap a board unit out if needed
            const bench = m().preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench').sort((a, b) => pri(b.definitionId) - pri(a.definitionId));
            if (bench[0] && pri(bench[0].definitionId) > 0 && m().preparation.units.filter(x => x.team === 'player' && x.location.kind === 'board').length >= getDeploymentCap(m())) {
              const out = m().preparation.units.find(x => x.team === 'player' && x.location.kind === 'board' && pri(x.definitionId) === 0); if (out) room.handle(id, { type: 'sell', unitId: out.id }); }
            for (const u of bench) {
              if (m().preparation.units.filter(x => x.team === 'player' && x.location.kind === 'board').length >= getDeploymentCap(m())) break;
              for (let ci = 0; ci < 28; ci++) { const cell = { col: ci % 7, row: 4 + Math.floor(ci / 7) }; if (m().preparation.units.some(x => x.location.kind === 'board' && x.location.cell.col === cell.col && x.location.cell.row === cell.row)) continue; if (room.handle(id, { type: 'deploy', unitId: u.id, target: { kind: 'board', cell } }).ok) break; }
            }
            while (m().gold >= 8 && m().level < 8) if (!room.handle(id, { type: 'buyXp' }).ok) break;
          }
        }
        for (const b of room.state.battles) {
          if (b.kind !== 'two-sided' || seen.has(b.battleId) || !b.participants.includes('s0')) continue; seen.add(b.battleId);
          const minionDeaths = b.battle.events.filter((e: any) => e.type === 'death' && String(e.unitId).includes('v20-menaces')).length;
          const opp = b.participants.find(p => p !== 's0');
          const augs = opp ? room.state.seats.find(x => x.seatId === opp)!.match.augments.map(a => a.definitionId).filter(a => PRIORITIES.includes(a)) : [];
          if (minionDeaths) for (const a of augs) hits.push(`${b.round} ${opp} ${a} ${minionDeaths}`);
        }
        if (!clock.fireNext()) break;
      }
      expect(room.state.fault).toBeNull();
      // Where the minions expired, against whom (round, seat, augment, minion deaths).
      expect(hits).toEqual(['13 s2 loot-explosion 3', '15 s1 loot-explosion 3', '19 s6 forbidden-magic 3', '23 s5 forbidden-magic 3', '25 s3 a-golden-find 3']);
      for (const seat of room.state.seats) if (seat.alive) {
        const restored = restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(seat.match), room.augmentHistoryAuthority(seat.seatId));
        expect(restored).toEqual(seat.match);
      }
    } finally { room.dispose(); }
  }
  } finally { spy.mockRestore(); setB1OfferCacheKey([]); }
}, 600_000);
