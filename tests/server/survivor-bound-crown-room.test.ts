/* Regression: seed 200 (record-*-battle-start.cjs one-human/seven-bot setup) faulted at round 26 with
 * `seat bot-4: invalid-receipt`: an opponent ended a lost battle with eleven counted survivors, and the receipt check
 * capped survivors at the max level. The cap is now the board ceiling (src/simulation/survivor-bound.ts).
 * Landing batch (2026-11-21, scene approved by Fable; assertions unchanged): seed 200 no longer reaches eleven survivors (at
 * most ten through round 26; seeds 200-239 alike), so the scene is built instead. Eight test-driven seats: s0 takes
 * Coronation (one Tactician's Crown: deployment cap level + 1) when it is offered, rerolling for it, gets 40 gold each
 * preparation through the existing test grant (grantMechanicGold, as other room tests seed state through the room's
 * `current` seam), and buys, fields and levels through public commands; the other seats play from their shops until s0's cap
 * reaches 11, then sell out from round 24. On seed 7, s0 (level 10 + one crown) beats an emptied seat on round 30 (5-6)
 * with all eleven of its units alive, and that seat's settlement receipt carries eleven survivors: the path past the old
 * max-level cap. Everything after the grant is the real shop, battle and settlement. */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { getDeploymentCap } from '../../src/simulation/match';
import { grantMechanicGold } from '../../src/simulation/seat-mechanics/grants';
import { answerOpenChoices, claimAllOrbs } from './helpers';

const SEED = 7, THROUGH_ROUND = 30;

describe('survivor bound: crown room', () => {
  it('settles a battle with eleven opposing survivors and no fault', () => {
    const clock = new ManualClock();
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `s${i}`, name: `s${i}`, kind: 'human' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed: SEED, clock, resolver: new TwoSidedBattleResolver(), carousel: CAROUSEL_RULES_BINDING });
    const seam = room as unknown as { current: typeof room.state };
    let maxSurvivors = 0, lastPreparation = -1;
    try {
      room.start();
      for (let n = 0; room.state.round <= THROUGH_ROUND && room.state.phase !== 'ended' && n < 400000; n++) {
        expect(room.state.fault).toBeNull();
        const holder = room.state.seats[0]!, choice = holder.alive ? holder.match.pendingChoice : null;
        if (choice) {
          for (let slot = 0; slot < 3 && !room.state.seats[0]!.match.pendingChoice!.offers.includes('coronation'); slot++) {
            const c = room.state.seats[0]!.match.pendingChoice!;
            room.handle('s0', { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot });
          }
          const c = room.state.seats[0]!.match.pendingChoice;
          if (c?.offers.includes('coronation')) room.handle('s0', { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'coronation' });
        }
        try { answerOpenChoices(room); } catch { /* a seat whose bench is full may refuse a pick; it answers next time */ }
        try { claimAllOrbs(room); } catch { /* as above */ }
        if (room.state.phase === 'preparation' && room.state.round !== lastPreparation) {
          lastPreparation = room.state.round;
          for (const seat of room.state.seats) {
            if (!seat.alive || seat.match.phase !== 'preparation') continue;
            const id = seat.seatId, m = () => room.state.seats.find(x => x.seatId === id)!.match;
            if (id === 's0') {
              const gold = grantMechanicGold(m(), { source: 'test', receiptId: `survivor-bound-gold:${room.state.round}`, amount: 40 });
              if (gold.ok) seam.current = { ...seam.current, seats: seam.current.seats.map(x => x.seatId !== id ? x : { ...x, match: gold.state }) };
              for (let pass = 0; pass < 6; pass++) {
                for (let slot = 0; slot < 5; slot++) {
                  const offer = m().shop.slots[slot];
                  if (offer.status === 'available' && m().gold >= 1 && m().preparation.units.filter(u => u.team === 'player').length < getDeploymentCap(m()) + 3)
                    room.handle(id, { type: 'buy', slot, generation: m().shop.generation });
                }
                if (m().preparation.units.filter(u => u.team === 'player').length >= getDeploymentCap(m()) || m().gold < 2) break;
                room.handle(id, { type: 'reroll' });
              }
              for (const u of m().preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')) {
                if (m().preparation.units.filter(x => x.team === 'player' && x.location.kind === 'board').length >= getDeploymentCap(m())) break;
                for (let cellIndex = 0; cellIndex < 28; cellIndex++) {
                  const cell = { col: cellIndex % 7, row: 4 + Math.floor(cellIndex / 7) };
                  if (m().preparation.units.some(x => x.location.kind === 'board' && x.location.cell.col === cell.col && x.location.cell.row === cell.row)) continue;
                  if (room.handle(id, { type: 'deploy', unitId: u.id, target: { kind: 'board', cell } }).ok) break;
                }
              }
              while (room.state.seats[0]!.match.gold >= 4 && room.state.seats[0]!.match.level < 10)
                expect(room.handle('s0', { type: 'buyXp' }).ok).toBe(true);
            } else if (getDeploymentCap(room.state.seats[0]!.match) >= 11 && room.state.round >= 24) {
              for (const u of m().preparation.units.filter(u => u.team === 'player')) room.handle(id, { type: 'sell', unitId: u.id });
            } else {
              for (let slot = 0; slot < 5; slot++) {
                const offer = m().shop.slots[slot];
                if (offer.status === 'available' && m().gold >= 3) room.handle(id, { type: 'buy', slot, generation: m().shop.generation });
              }
              while (m().gold >= 8 && m().level < 8) if (!room.handle(id, { type: 'buyXp' }).ok) break;
            }
          }
        }
        for (const seat of room.state.seats) for (const result of seat.match.roundResults) maxSurvivors = Math.max(maxSurvivors, result.survivingEnemyCount);
        expect(clock.fireNext()).toBe(true);
      }
      expect(room.state.fault).toBeNull();
      expect(room.state.round).toBeGreaterThan(THROUGH_ROUND);
      expect(maxSurvivors).toBeGreaterThan(10); // the scenario is still exercised
    } finally { room.dispose(); }
  }, 300_000);
});
