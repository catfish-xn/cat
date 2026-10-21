import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { createItemRandomStreams, drawItemRandom } from '../src/simulation/g2-4b-item-kernel';
import { readCombatStats } from '../src/simulation/combat-s13';
import { catalogPreparation } from './t5r-helpers';
import { grantTestItems, TEST_GOLD_ITEMS } from './helpers/grant-test-items';

const itemIds = Object.values(TEST_GOLD_ITEMS);

it('grants all three through real acquisition/equipment ledgers and round-trips the full save', () => {
  const initial = createMatch(42), before = structuredClone(initial);
  const unitId = initial.preparation.units.find(u => u.team === 'player')!.id;
  const equipped = grantTestItems(initial, { unitId, itemIds });
  expect(initial).toEqual(before);
  expect(equipped.items.map(i => i.definitionId)).toEqual(itemIds);
  expect(equipped.items.map(i => i.location)).toEqual(itemIds.map((_, slot) => ({ kind: 'unit', unitId, slot })));
  expect(equipped.seatMechanics!.receipts.filter(r => r.source === 'test-gold-items')).toHaveLength(3);
  expect(equipped.resourceProvenance.entries.filter(e => e.kind === 'item-acquired')).toHaveLength(3);
  expect(equipped.resourceProvenance.entries.filter(e => e.kind === 'item-equipped')).toHaveLength(3);
  expect(restoreMatch(serializeMatch(equipped))).toEqual(equipped);
  expect(equipped.contentDigest).toBe(initial.contentDigest);
});

it('keeps equipment restrictions and leaves the input untouched on fixture failure', () => {
  const base = createMatch(42), unitId = base.preparation.units.find(u => u.team === 'player')!.id;
  const before = structuredClone(base);
  expect(() => grantTestItems(base, { unitId, itemIds: [TEST_GOLD_ITEMS.collector, TEST_GOLD_ITEMS.collector] })).toThrow('no legal slot');
  expect(() => grantTestItems(base, { unitId: 'missing', itemIds })).toThrow('unknown player unit');
  expect(base).toEqual(before);
  const equipped = grantTestItems(base, { unitId, itemIds });
  const full = structuredClone(equipped);
  expect(() => grantTestItems(equipped, { unitId, itemIds: [TEST_GOLD_ITEMS.collector] })).toThrow('no legal slot');
  expect(equipped).toEqual(full);
});

it('accepts transported PvP snapshots and produces authentic gold effects for all three items', () => {
  // Isolated catalog armies exercise the server battle boundary, not full-save history.
  const base = catalogPreparation('2-1');
  const attacker = { ...base, level: 8, gold: 30, preparation: { ...base.preparation, units: [
    { id: 'unit-1', definitionId: 'garen', starLevel: 3 as const, team: 'player' as const,
      location: { kind: 'board' as const, cell: { col: 3, row: 4 } } },
  ] } };
  const defender = { ...base, level: 8, preparation: { ...base.preparation,
    units: Array.from({ length: 8 }, (_, n) => ({ id: `unit-${n + 1}`, definitionId: 'maddie',
      starLevel: 2 as const, team: 'player' as const,
      location: { kind: 'board' as const, cell: { col: n % 7, row: 4 + Math.floor(n / 7) } } })),
  } };
  const equipped = grantTestItems(attacker, { unitId: 'unit-1', itemIds });
  const a = snapshotForBattle(equipped, 'A'), b = snapshotForBattle(defender, 'B');
  expect(restorePlayerBattleSnapshot(JSON.stringify(a))).toEqual(a);
  expect(a.bankGold).toBe(30);
  const input = compileBattle(a, b, 42, { battleId: 'test-gold-items' });
  const result = startTwoSidedBattle(input).advance(1201)!;
  expect(result).not.toBeNull();
  const ownerId = input.mapping.find(m => m.seatId === 'A' && m.kind === 'unit' && m.originalId === 'unit-1')!.combatId;
  const holder = result.initial.units.find(u => u.id === ownerId)!;
  expect(holder.openingItemBankGold).toBe(30);
  expect(readCombatStats(holder, result.initial).attackIntervalTicks).toBe(
    Math.ceil(200000 * 10000 / (holder.baseAttackSpeedBps! * (10000 + 4500 + 30 * 100))),
  );
  expect(holder.mechanics!.map(m => m.mechanic)).toEqual(expect.arrayContaining(['g24Mogul', 'g24Collector', 'g24Gambler']));
  const receipts = result.terminal.itemGoldReceipts!;
  const terminalHolder = result.terminal.units.find(u => u.id === ownerId)!;
  expect(terminalHolder.itemMogulHits).toHaveLength(35);
  expect(terminalHolder.maxHp).toBe(holder.maxHp + 35 * 7);
  expect(readCombatStats(terminalHolder, result.terminal).armor).toBe(readCombatStats(holder, result.initial).armor + 35);
  expect(receipts.filter(r => r.kind === 'gamblers-blade' && r.gold === 1).length).toBeGreaterThan(0);
  expect(receipts.filter(r => r.kind === 'collector' && r.gold === 1).length).toBeGreaterThan(0);
  expect(receipts.filter(r => r.kind === 'moguls-full' && r.gold === 1)).toHaveLength(1);
  const fullTick = terminalHolder.itemMogulHits!.at(-1)!.tick;
  expect(receipts.find(r => r.kind === 'moguls-full')!.tick).toBe(fullTick);
  for (const receipt of receipts.filter(r => r.kind === 'moguls-periodic'))
    expect((receipt.tick - fullTick) % 160).toBe(0);
  let streams = createItemRandomStreams(42);
  for (const receipt of receipts) {
    expect(receipt.ownerId).toBe(ownerId);
    const definitionId = receipt.kind === 'collector' ? TEST_GOLD_ITEMS.collector
      : receipt.kind === 'gamblers-blade' ? TEST_GOLD_ITEMS.gamblersBlade : TEST_GOLD_ITEMS.mogulsMail;
    const instanceId = equipped.items.find(i => i.definitionId === definitionId)!.id;
    expect(receipt.itemInstanceId).toBe(input.mapping.find(m => m.seatId === 'A' && m.kind === 'item' && m.originalId === instanceId)!.combatId);
    if (receipt.kind === 'collector' || receipt.kind === 'gamblers-blade') {
      const draw = drawItemRandom(streams, receipt.kind); streams = draw.streams;
      expect(receipt.word).toBe(draw.word);
      const chance = receipt.kind === 'collector' ? 4000n : 500n;
      expect(receipt.gold).toBe(BigInt(draw.word) * 10000n < chance * 4294967296n ? 1 : 0);
    } else expect(receipt).toMatchObject({ gold: 1, word: null });
  }
  expect(result.terminal.itemRandomStreams).toEqual(streams);
  const payoutIds = receipts.filter(r => r.gold === 1).map(r => r.id);
  expect(proposeSettlement(JSON.parse(JSON.stringify(result))).a.g23Facts!.itemGoldPayouts!.map(p => p.receiptId)).toEqual(payoutIds);
});
