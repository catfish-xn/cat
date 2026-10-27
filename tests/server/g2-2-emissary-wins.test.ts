/**
 * G2-2 Emissary in the room: a PvP battle is frozen from each seat's committed rules state, so the
 * Ambessa win count is each seat's own settled PvP history (contract §10.2 priorPvpWins), never a
 * room-side or client-side tally. Runs a real two-sided room to its second PvP round (2-2).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { SharedPoolState } from '../../src/server-entry';
import { priorPvpWins, snapshotForBattle } from '../../src/server-entry';
import { TwoSidedBattleResolver, resolveTwoSidedPvp } from '../../src/server/room/two-sided-resolver';
import type { BattleResolver } from '../../src/server/room/battle-resolver';
import type { BattleInput, BattleSeatInput } from '../../src/server/room/types';
import { makeRoom, runUntil } from './helpers';

/** Delegates to the real two-sided resolver and keeps every frozen envelope it is handed. */
class RecordingResolver implements BattleResolver {
  readonly inputs: BattleInput[] = [];
  private readonly inner = new TwoSidedBattleResolver();
  resolveBattle(input: BattleInput, pool: SharedPoolState) { this.inputs.push(input); return this.inner.resolveBattle(input, pool); }
}
/**
 * The seat's frozen state with its board replaced by one 1-star Ambessa (Emissary 1) and no equipment. She stands on the back
 * row: v15's per-card rerolls changed the 2-1 offers, and 阵容 (lineup) adds armor and MR per ally on the front two rows,
 * which is not what is measured here. v22: the 2-1 augment offers changed too (tier table, trait filter), so a seat can
 * hold a stat augment such as Crownguard Spirit (+armor); augments and their dependent progress are cleared for the same reason as items.
 * v24 can select a progress-bearing augment: keeping its progress after removing the card is an invalid snapshot.
 */
function asAmbessa(seat: BattleSeatInput): BattleSeatInput {
  const units = seat.state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board');
  const only = { ...units[0]!, definitionId: 'ambessa', starLevel: 1 as const, location: { kind: 'board' as const, cell: { col: 3, row: 7 } } };
  return { ...seat, state: { ...seat.state, preparation: { ...seat.state.preparation, units: [only] }, items: [], augments: [], augmentProgress: { pumpingRounds: 0, investmentHp: 0 }, temporaryEquipment: [], anomalyBinding: null, persistentGrowth: [] } };
}

let pvp: BattleInput[] = [];
beforeAll(() => {
  const resolver = new RecordingResolver();
  const { room, clock } = makeRoom(resolver);
  room.start();
  runUntil(room, clock, state => state.round === 5 && state.phase === 'battle');
  pvp = resolver.inputs.filter(input => input.round === 5 && input.roundKind === 'pvp');
}, 60_000);

describe('room PvP freeze: Emissary wins come from each seat\'s own committed ledger', () => {
  it('freezes 2-2 from states that already hold the committed 2-1 result; a 2-1 winner snapshots one win', () => {
    expect(pvp.length).toBeGreaterThan(0);
    const seats = pvp.flatMap(input => [...input.seats, ...(input.mirrorOf ? [input.mirrorOf] : [])]);
    let winners = 0;
    for (const seat of seats) {
      const record = seat.state.roundResults.find(result => result.round === 4)!;
      expect(record).toMatchObject({ roundId: '2-1', roundKind: 'pvp' });
      const won = record.result === 'playerWin' ? 1 : 0;
      winners += won;
      expect(priorPvpWins(seat.state.roundResults, 5)).toBe(won);
      expect(snapshotForBattle(seat.state, seat.seatId).priorPvpWins).toBe(won === 1 ? 1 : undefined);
    }
    expect(winners).toBeGreaterThan(0);
  });

  it('turns that history into Ambessa armor and MR per side in the battle the room runs', () => {
    let checked = 0;
    for (const input of pvp) {
      const envelope: BattleInput = { ...input, seats: input.seats.map(asAmbessa), mirrorOf: input.mirrorOf ? asAmbessa(input.mirrorOf) : null };
      const result = resolveTwoSidedPvp(envelope);
      const sides = [envelope.seats[0]!, envelope.mirrorOf ?? envelope.seats[1]!];
      const resist = sides.map(seat => {
        const combatId = result.battle.mapping.find(entry => entry.seatId === seat.seatId && entry.kind === 'unit')!.combatId;
        const unit = result.battle.initial.units.find(candidate => candidate.id === combatId)!;
        return { wins: priorPvpWins(seat.state.roundResults, 5), armor: unit.armor, magicResist: unit.magicResist };
      });
      expect(resist[0]!.armor - resist[1]!.armor).toBe(2 * (resist[0]!.wins - resist[1]!.wins));
      expect(resist[0]!.magicResist - resist[1]!.magicResist).toBe(2 * (resist[0]!.wins - resist[1]!.wins));
      if (resist[0]!.wins !== resist[1]!.wins) checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
