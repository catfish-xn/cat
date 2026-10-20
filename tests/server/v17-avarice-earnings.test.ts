/**
 * v17 server acceptance 4 (docs/V17_AVARICE_ONLINE.md): avarice with in-combat earnings on its team. Seat s2 buys and
 * fields Sevika through the shop (her High Roller coin/jackpot casts earn gold during the combat), then trades in battle.
 * The room hands the rules only the seat's bank (Match.gold), never bank plus earnings; the rules add the team's
 * unsettled earnings once, so the avarice unit's bank is the last sample plus what the team earned; the earnings are
 * paid once, by the existing settlement. PvP (s2 is side B against s1) and PvE (4-7) both.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { Room } from '../../src/server/room/room';
import type { CombatState } from '../../src/simulation/combat-types';
import { runUntil } from './helpers';
import { avariceRoom, nextBattle, pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

/** Buys Sevika (levelling to 8 for the 5-cost odds) and puts her on the board, all through the room. */
function fieldSevika(room: Room, seatId: string): void {
  while (seatOf(room.state, seatId).match.level < 8) expect(room.handle(seatId, { type: 'buyXp' })).toMatchObject({ ok: true });
  for (let rolls = 0; !seatOf(room.state, seatId).match.preparation.units.some(unit => unit.definitionId === 'sevika'); rolls++) {
    expect(rolls).toBeLessThan(120);
    const shop = seatOf(room.state, seatId).match.shop;
    const slot = shop.slots.findIndex(entry => entry.status === 'available' && entry.definitionId === 'sevika');
    expect(room.handle(seatId, slot >= 0 ? { type: 'buy', slot, generation: shop.generation } : { type: 'reroll' })).toMatchObject({ ok: true });
  }
  const sevika = seatOf(room.state, seatId).match.preparation.units.find(unit => unit.definitionId === 'sevika')!;
  expect(room.handle(seatId, { type: 'deploy', unitId: sevika.id, target: { kind: 'board', cell: { col: 3, row: 5 } } })).toMatchObject({ ok: true });
}
/** The team's in-combat earnings the rules have not settled yet: item gold receipts and High Roller gold. */
function earned(combat: CombatState, team: 'player' | 'enemy'): number {
  const allies = new Set(combat.units.filter(unit => unit.team === team).map(unit => unit.id));
  return (combat.itemGoldReceipts ?? []).filter(receipt => allies.has(receipt.ownerId) && receipt.gold).length
    + combat.units.filter(unit => unit.team === team).reduce((sum, unit) => sum + (unit.g23?.highRoller ?? []).reduce((total, roll) => total + roll.gold, 0), 0);
}
const avariceBank = (combat: CombatState, team: 'player' | 'enemy') =>
  combat.units.find(unit => unit.team === team && unit.mechanics?.some(mechanic => mechanic.mechanic === 'd11Anomaly' && mechanic.source.definitionId === 'avarice-incarnate'))!.currentItemBankGold;
/** The settlement of `roundId` paid the High Roller gold the combat earned in exactly one receipt (none when it earned none). */
function expectPaidOnce(room: Room, roundId: string, amount: number): void {
  const paid = (seatOf(room.state, 's2').match.seatMechanics?.receipts ?? []).filter(receipt => receipt.source === 'high-roller' && receipt.roundId === roundId);
  expect(paid.map(receipt => receipt.kind === 'gold' ? receipt.amount : NaN)).toEqual(amount ? [amount] : []);
}

describe('v17 avarice: in-combat earnings on its team', () => {
  it('the room samples only the bank; the rules add the team\'s earnings once; the settlement pays them once', () => {
    const { room, clock } = avariceRoom(dispose => disposers.push(dispose), opened => fieldSevika(opened, 's2'));
    // PvP 4-6: s2 is side B (enemy) against s1.
    nextBattle(room, clock, '4-6');
    expect(pvpBattleOf(room.state, 's2')!.battle.b.seatId).toBe('s2');
    clock.advance(400);
    const pvpGold = spendGold(room, 's2');
    runUntil(room, clock, state => state.roundName === '4-6' && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const pvp = pvpBattleOf(room.state, 's2')!.battle;
    expect(pvp.bankSamples!.filter(sample => sample.team === 'enemy').map(sample => sample.liveGold)).toEqual([pvpGold]);
    const pvpEarned = earned(pvp.terminal, 'enemy');
    expect(avariceBank(pvp.terminal, 'enemy')).toBe(pvpGold + pvpEarned);
    expectPaidOnce(room, '4-6', pvpEarned);
    // PvE 4-7: the seat's own combat, stepped live by the room.
    nextBattle(room, clock, '4-7');
    clock.advance(400);
    const pveGold = spendGold(room, 's2');
    runUntil(room, clock, state => state.roundName === '4-7' && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const outcome = room.state.battles.flatMap(battle => battle.kind === 'placeholder' ? battle.outcomes : []).find(entry => entry.seatId === 's2')!;
    const record = seatOf(room.state, 's2').match.roundResults.at(-1)!;
    expect(record.roundId).toBe('4-7');
    expect(record.bankSamples!.map(sample => sample.liveGold)).toEqual([pveGold]);
    const terminal = outcome.combat!.terminal;
    const pveEarned = earned(terminal, 'player');
    expect(avariceBank(terminal, 'player')).toBe(pveGold + pveEarned);
    expectPaidOnce(room, '4-7', pveEarned);
    // Sevika's coin/jackpot casts are random: over these two combats (seed 42) at least one earned gold.
    expect(pvpEarned + pveEarned).toBeGreaterThan(0);
    // The next round pays nothing again.
    runUntil(room, clock, state => state.roundName === '5-1' && state.phase === 'preparation');
    expectPaidOnce(room, '4-6', pvpEarned);
    expectPaidOnce(room, '4-7', pveEarned);
  }, 180_000);
});
