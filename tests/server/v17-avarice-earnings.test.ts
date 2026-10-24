/**
 * v17 server acceptance 4 (docs/V17_AVARICE_ONLINE.md): avarice with in-combat earnings on its team. Seat EARNER buys and
 * fields Sevika through the shop (her High Roller coin/jackpot casts earn gold during the combat), then trades in battle.
 * The room hands the rules only the seat's bank (Match.gold), never bank plus earnings; the rules add the team's
 * unsettled earnings once, so the avarice unit's bank is the last sample plus what the team earned; the earnings are
 * paid once, by the existing settlement. PvP (the earner as side A, and as side B against another avarice seat) and PvE (4-7). The avarice unit also holds
 * the three gold items (Mogul's Mail, the Collector, Gambler's Blade), granted through the legal test entry
 * (tests/helpers/grant-test-items.ts, docs/TEST_GOLD_ITEMS.md), so item gold and High Roller gold stack with avarice.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { Room } from '../../src/server/room/room';
import type { RoomState } from '../../src/server/room/types';
import type { CombatState } from '../../src/simulation/combat-types';
import { grantTestItems, TEST_GOLD_ITEMS } from '../helpers/grant-test-items';
import { claimAllOrbs, runUntil } from './helpers';
import { avariceRoom, fieldBench, HUMANS, levelForBench, nextBattle, pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';

/**
 * The earning seat. Under seed 42 with the v17 orb combinations s2 fights a bot as side A at 4-6, PvE at 4-7 and the
 * avarice seat s0 as side B at 5-2. The test runs on until it has seen the earner as side B against another avarice seat,
 * so a pairing change cannot silently drop that case.
 */
const EARNER = 's2';

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
/** Gives the seat's avarice unit the three gold items through the legal test entry, written back as the seat's state. */
function grantGoldItems(room: Room, seatId: string): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => {
    if (seat.seatId !== seatId) return seat;
    const match = grantTestItems(seat.match, { unitId: seat.match.anomalyBinding!.unitId,
      itemIds: [TEST_GOLD_ITEMS.mogulsMail, TEST_GOLD_ITEMS.collector, TEST_GOLD_ITEMS.gamblersBlade] });
    return { ...seat, seatRevision: seat.seatRevision + 1, match };
  }) };
}
const avariceUnit = (combat: CombatState, team: 'player' | 'enemy') =>
  combat.units.find(unit => unit.team === team && unit.mechanics?.some(mechanic => mechanic.mechanic === 'd11Anomaly' && mechanic.source.definitionId === 'avarice-incarnate'))!;
const avariceBank = (combat: CombatState, team: 'player' | 'enemy') => avariceUnit(combat, team).currentItemBankGold;
/** The settlement of `roundId` paid the High Roller gold the combat earned in exactly one receipt (none when it earned none). */
function expectPaidOnce(room: Room, roundId: string, amount: number): void {
  const paid = (seatOf(room.state, EARNER).match.seatMechanics?.receipts ?? []).filter(receipt => receipt.source === 'high-roller' && receipt.roundId === roundId);
  expect(paid.map(receipt => receipt.kind === 'gold' ? receipt.amount : NaN)).toEqual(amount ? [amount] : []);
}
/** The team's paying item gold receipts in `combat`. */
function itemGold(combat: CombatState, team: 'player' | 'enemy'): string[] {
  const allies = new Set(combat.units.filter(unit => unit.team === team).map(unit => unit.id));
  return (combat.itemGoldReceipts ?? []).filter(receipt => allies.has(receipt.ownerId) && receipt.gold).map(receipt => receipt.id);
}
/** Each paying item gold receipt of the combat was paid as exactly one 1-gold settlement receipt, and nothing else was. */
function expectItemGoldPaidOnce(room: Room, roundId: string, receiptIds: readonly string[]): void {
  const paid = (seatOf(room.state, EARNER).match.seatMechanics?.receipts ?? []).filter(receipt => receipt.source === 'g24-item-gold' && receipt.roundId === roundId);
  expect(paid.map(receipt => receipt.receiptId).sort()).toEqual([...receiptIds].sort());
  expect(paid.every(receipt => receipt.kind === 'gold' && receipt.amount === 1)).toBe(true);
}
/** High Roller gold alone (without the item receipts). */
const highRoller = (combat: CombatState, team: 'player' | 'enemy') =>
  combat.units.filter(unit => unit.team === team).reduce((sum, unit) => sum + (unit.g23?.highRoller ?? []).reduce((total, roll) => total + roll.gold, 0), 0);

describe('v17 avarice: in-combat earnings on its team', () => {
  it('the room samples only the bank; the rules add the team\'s earnings once; the settlement pays them once', () => {
    const { room, clock } = avariceRoom(dispose => disposers.push(dispose), opened => { fieldSevika(opened, EARNER); grantGoldItems(opened, EARNER); });
    const holder = seatOf(room.state, EARNER).match.preparation.units.find(unit => unit.id === seatOf(room.state, EARNER).match.anomalyBinding!.unitId)!;
    expect(holder.location.kind).toBe('board');
    expect(seatOf(room.state, EARNER).match.items.filter(item => item.location.kind === 'unit' && item.location.unitId === holder.id).map(item => item.definitionId).sort())
      .toEqual(Object.values(TEST_GOLD_ITEMS).sort());
    // 4-6, PvE 4-7, then on through the seat's battles until both earnings paid and the earner was side B against an avarice seat.
    const paid = { highRoller: 0, items: 0 };
    const checked: { roundId: string; highRoller: number; items: string[] }[] = [];
    const kinds = new Set<string>();
    let sideBAgainstAvarice = false;
    let mogulStacks = 0;
    // v22: the idle human seats (level 6, full benches, gold piling up) no longer outlast the earner's late first coin;
    // the last one fell in the very battle that paid it, the room ended and no later round could show "paid once".
    // In preparation they level with their own gold and field their bench through the room, so the room plays on.
    const fieldIdle = () => { for (const seatId of HUMANS) if (seatId !== EARNER) { levelForBench(room, seatId, 0); fieldBench(room, seatId); } };
    for (let roundName = '4-6'; checked.length < 2 || paid.highRoller === 0 || !kinds.has('gamblers') || !kinds.has('collector') || !sideBAgainstAvarice;) {
      expect(checked.length).toBeLessThan(20);
      if (checked.length) roundName = runUntil(room, clock, state => { claimAllOrbs(room); fieldIdle(); return state.phase === 'battle' && state.roundName !== checked.at(-1)!.roundId; }).roundName;
      else nextBattle(room, clock, roundName);
      const own = pvpBattleOf(room.state, EARNER);
      if (own?.battle.b.seatId === EARNER && (HUMANS as readonly string[]).includes(own.battle.a.seatId)) sideBAgainstAvarice = true;
      clock.advance(400);
      const gold = spendGold(room, EARNER);
      runUntil(room, clock, state => state.roundName === roundName && state.phase !== 'battle');
      expect(room.state.fault).toBeNull();
      const record = seatOf(room.state, EARNER).match.roundResults.at(-1)!;
      expect(record.roundId).toBe(roundName);
      const pvp = pvpBattleOf(room.state, EARNER);
      let terminal: CombatState, team: 'player' | 'enemy';
      if (pvp) {
        team = pvp.battle.b.seatId === EARNER ? 'enemy' : 'player';
        terminal = pvp.battle.terminal;
        expect(pvp.battle.bankSamples!.filter(sample => sample.team === team).map(sample => sample.liveGold)).toEqual([gold]);
      } else {
        team = 'player';
        terminal = room.state.battles.flatMap(battle => battle.kind === 'placeholder' ? battle.outcomes : []).find(entry => entry.seatId === EARNER)!.combat!.terminal;
        expect(record.bankSamples!.map(sample => sample.liveGold)).toEqual([gold]);
      }
      // The rules added the team's unsettled earnings (item gold + High Roller) to the sampled bank, once.
      const items = itemGold(terminal, team), roller = highRoller(terminal, team);
      expect(avariceBank(terminal, team)).toBe(gold + items.length + roller);
      // The settlement paid each once.
      expectPaidOnce(room, roundName, roller);
      expectItemGoldPaidOnce(room, roundName, items);
      checked.push({ roundId: roundName, highRoller: roller, items });
      for (const receipt of terminal.itemGoldReceipts ?? []) if (items.includes(receipt.id)) kinds.add(receipt.kind.split('-')[0]);
      mogulStacks = Math.max(mogulStacks, avariceUnit(terminal, team).itemMogulHits?.length ?? 0);
      paid.highRoller += roller; paid.items += items.length;
    }
    expect(checked.map(entry => entry.roundId).slice(0, 2)).toEqual(['4-6', '4-7']);
    // Both earnings are random (Sevika's casts, the items' rolls); with seed 42 each kind paid within these battles.
    expect(paid.highRoller).toBeGreaterThan(0);
    expect(paid.items).toBeGreaterThan(0);
    expect(sideBAgainstAvarice).toBe(true);
    // Mogul's Mail stacks in these fights, but none lasts the 35 hits plus 160 ticks its gold needs (its payout is
    // covered by the rules' own tests); its unpaid stacks must not reach the bank, which the per-battle check shows.
    expect(mogulStacks).toBeGreaterThan(0);
    // A later round pays none of them again.
    clock.advance(1);
    runUntil(room, clock, state => { fieldIdle(); return state.phase === 'preparation' && state.roundName !== checked.at(-1)!.roundId; });
    for (const entry of checked) { expectPaidOnce(room, entry.roundId, entry.highRoller); expectItemGoldPaidOnce(room, entry.roundId, entry.items); }
    // A re-pay under a later round would carry the same receipt id: across all rounds every earnings receipt id is unique.
    const ids = (seatOf(room.state, EARNER).match.seatMechanics?.receipts ?? []).filter(receipt => receipt.source === 'high-roller' || receipt.source === 'g24-item-gold').map(receipt => receipt.receiptId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(paid.items + checked.filter(entry => entry.highRoller).length);
  }, 180_000);
});
