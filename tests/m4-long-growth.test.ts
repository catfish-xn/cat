import { describe, expect, it } from 'vitest';
import {
  buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat, stepMatch,
  combineItems, equipItem, selectAnomalyTarget, selectChoice,
  type MatchCommandResult, type MatchEvent, type MatchState,
} from '../src/simulation/match';
import type { CombatEvent } from '../src/simulation/combat';
import type { UnitLocation } from '../src/simulation/units';
import { restoreMatch } from '../src/simulation/serialization';

// Fixed, affordable M4 seed0 transcript: keep an equipped three-star Sentinel and
// its normally selected Anomaly through round9, then sell the roster for XP.
// Round10's two natural XP complete level7 without buying a wasteful extra F.
// Round11's real rerolled shop sells a five-cost Colossus, which casts an 800-point
// shield with the returned equipment and leaves the Match alive at 12 HP.
// No fixture alters gold, HP, units, shops, opponents, results, or combat ticks.
type Command = readonly ['buy', number, number] | readonly ['sell', string]
  | readonly ['D'] | readonly ['F'] | readonly ['deploy', string, UnitLocation]
  | readonly ['combine', string, string] | readonly ['equip', string, string, number]
  | readonly ['choose', string, number, string] | readonly ['target', string, number, string];
const ROUNDS: readonly (readonly Command[])[] = [
  [['deploy', 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } }],
    ['deploy', 'unit-2', { kind: 'board', cell: { col: 3, row: 4 } }],
    ['deploy', 'unit-3', { kind: 'board', cell: { col: 5, row: 4 } }],
    ['combine', 'item-1', 'item-2'], ['equip', 'item-3', 'unit-1', 0],
    ['buy', 0, 1], ['buy', 4, 1], ['D'], ['buy', 2, 2], ['D'], ['buy', 0, 3], ['buy', 3, 3], ['sell', 'unit-10']],
  [['choose', 'r2-augment', 0, 'heavy-hands'], ['D'], ['buy', 3, 5], ['buy', 4, 5]],
  [['buy', 3, 6], ['buy', 4, 6], ['equip', 'item-4', 'unit-1', 1], ['F']],
  [['equip', 'item-5', 'unit-1', 2], ['F']],
  [['choose', 'r5-augment', 0, 'iron-line'], ['buy', 0, 8], ['sell', 'unit-15'], ['F'], ['F']],
  [['F']],
  [['target', 'r7-anomaly', 0, 'unit-1'], ['choose', 'r7-anomaly', 1, 'colossal-form'], ['F'], ['F']],
  [['buy', 3, 11], ['sell', 'unit-16'], ['F']],
  [['F']],
  [['sell', 'unit-1'], ['sell', 'unit-2'], ['sell', 'unit-3'], ['F'], ['F'], ['F'], ['F']],
  [['D'], ['buy', 1, 15], ['deploy', 'unit-17', { kind: 'board', cell: { col: 3, row: 4 } }],
    ['equip', 'item-3', 'unit-17', 0], ['equip', 'item-4', 'unit-17', 1], ['equip', 'item-5', 'unit-17', 2]],
];
// Oracle constants intentionally do not import production price/XP/stat helpers.
const COSTS: Readonly<Record<string, number>> = { sentinel: 1, ranger: 1, mystic: 1, spark: 1, squire: 1,
  bulwark: 2, archer: 2, binder: 2, scout: 2, arcanist: 3, duelist: 3, beacon: 3, striker: 3,
  warden: 4, tempest: 4, prism: 4, colossus: 5, oracle: 5 };
const THRESHOLDS = [0, 2, 2, 6, 10, 20, 36, 56, 80];
const EXPECTED_ROUNDS = [
  { hp: 100, level: 3, xp: 2, gold: 7 }, { hp: 100, level: 3, xp: 4, gold: 8 },
  { hp: 100, level: 4, xp: 4, gold: 7 }, { hp: 100, level: 5, xp: 0, gold: 8 },
  { hp: 100, level: 5, xp: 10, gold: 5 }, { hp: 100, level: 5, xp: 16, gold: 6 },
  { hp: 84, level: 6, xp: 6, gold: 5 }, { hp: 68, level: 6, xp: 12, gold: 6 },
  { hp: 52, level: 6, xp: 18, gold: 7 }, { hp: 32, level: 7, xp: 0, gold: 9 },
  { hp: 12, level: 7, xp: 2, gold: 7 },
];
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

function replay(serialize: boolean) {
  let state = createMatch(0), gold = 10, level = 3, xp = 0, hp = 100, serial = 6, rng = 0n, generation = 1;
  let choiceRng = 0x9e3779b9n, rewardRng = 0x85ebca6bn, rewardGold = 0;
  let purchases = 0, purchaseGold = 0, saleGold = 0, rerolls = 0, xpBuys = 0, commands = 0, ticks = 0;
  const quantities: Record<string, number> = Object.fromEntries(Object.keys(COSTS).map(id => [id, 0]));
  quantities.sentinel = 2; quantities.ranger = 2; quantities.mystic = 1;
  const boughtTiers = new Set<number>(), upgradedToThree: number[] = [], fiveCostCasts: CombatEvent[] = [];
  const commandStates: MatchState[] = [], combatEvents: CombatEvent[] = [], allEvents: MatchEvent[] = [];
  const tickStates: string[] = [];
  const word = (state: bigint) => (state * 1664525n + 1013904223n) % 4294967296n;
  const nextShop = () => { for (let draw = 0; draw < 10; draw++) rng = (rng * 1664525n + 1013904223n) % 4294967296n; };
  nextShop();
  function addXp(amount: number) {
    if (level === 9) return;
    xp += amount;
    while (level < 9 && xp >= THRESHOLDS[level]) { xp -= THRESHOLDS[level]; level++; }
    if (level === 9) xp = 0;
  }
  function ledger() {
    expect(state.gold).toBe(gold);
    expect(state.gold).toBe(10 + state.roundResults.length * 5 + rewardGold + saleGold - purchaseGold - 2 * rerolls - 4 * xpBuys);
    expect(state).toMatchObject({ level, xp, playerHp: hp, nextUnitSerial: serial, rngState: Number(rng),
      choiceRngState: Number(choiceRng), rewardRngState: Number(rewardRng), shop: { generation } });
    expect(state.gold).toBeGreaterThanOrEqual(0);
    expect(state.playerHp).toBeGreaterThan(0);
    expect(state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board').length).toBeLessThanOrEqual(level);
    for (const id of Object.keys(COSTS)) {
      const represented = state.preparation.units.filter(unit => unit.team === 'player' && unit.definitionId === id)
        .reduce((sum, unit) => sum + [1, 3, 9][unit.starLevel - 1], 0);
      expect(represented, `${id} card conservation`).toBe(quantities[id]);
    }
  }
  function accepted(result: MatchCommandResult) {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Transcript rejected in round ${state.round}: ${result.reason}`);
    commands++;
    state = result.state;
    allEvents.push(...result.events);
    combatEvents.push(...result.events.filter((event): event is CombatEvent => 'tick' in event));
    for (const event of result.events) if (event.type === 'unitUpgraded' && event.toStar === 3) upgradedToThree.push(state.round);
    ledger();
    commandStates.push(structuredClone(state));
    if (serialize) state = restoreMatch(JSON.stringify(state));
  }
  function command(entry: Command) {
    freeze(state);
    switch (entry[0]) {
      case 'buy': {
        const offer = state.shop.slots[entry[1]];
        expect(offer.status).toBe('available');
        if (offer.status !== 'available') throw new Error('Expected available offer');
        const cost = COSTS[offer.definitionId];
        gold -= cost; purchaseGold += cost; quantities[offer.definitionId]++; serial++; purchases++; boughtTiers.add(cost);
        accepted(buyUnit(state, entry[1], entry[2])); break;
      }
      case 'sell': {
        const unit = state.preparation.units.find(unit => unit.id === entry[1])!;
        const copies = [1, 3, 9][unit.starLevel - 1], value = COSTS[unit.definitionId] * copies;
        gold += value; saleGold += value; quantities[unit.definitionId] -= copies;
        accepted(sellUnit(state, entry[1])); break;
      }
      case 'D': gold -= 2; rerolls++; generation++; nextShop(); accepted(rerollShop(state)); break;
      case 'F': gold -= 4; xpBuys++; addXp(4); accepted(buyXp(state)); break;
      case 'deploy': accepted(deployMatchUnit(state, entry[1], entry[2])); break;
      case 'combine': accepted(combineItems(state, entry[1], entry[2])); break;
      case 'equip': accepted(equipItem(state, entry[1], entry[2], entry[3])); break;
      case 'choose': accepted(selectChoice(state, entry[1], entry[2], entry[3])); break;
      case 'target': {
        for (let draw = 0; draw < 3; draw++) choiceRng = word(choiceRng);
        accepted(selectAnomalyTarget(state, entry[1], entry[2], entry[3])); break;
      }
    }
  }
  function settlementLedger(next: MatchState) {
    expect(next.phase).toBe('settlement');
    const combat = next.combat!;
    const survivors = combat.units.filter(unit => unit.alive && unit.team === 'enemy').length;
    const base = 2 + 2 * Math.floor((next.round - 1) / 3);
    const damage = combat.result === 'playerWin' ? 0 : base + (combat.result === 'enemyWin' ? 2 * survivors : 0);
    hp = Math.max(0, hp - damage);
    gold += 5; addXp(2);
  }
  ledger();
  for (const [index, entries] of ROUNDS.entries()) {
    expect(state.round).toBe(index + 1);
    for (const entry of entries) command(entry);
    const started = startMatchCombat(freeze(state));
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error(started.reason);
    if (started.state.phase === 'settlement') settlementLedger(started.state);
    accepted(started);
    if (index === 10) {
      // Independent hand arithmetic: AD=125+15+10+12, armor=65+15,
      // and the primary shield ability=750+30+20 (component effects are not implicit).
      expect(state.combat?.units.find(unit => unit.id === 'unit-17')).toMatchObject({ definitionId: 'colossus',
        starLevel: 1, hp: 1800, mana: 0, shield: 0, attackDamage: 162, armor: 80, magicResist: 75,
        ability: { id: 'colossus-guard', amount: 800 } });
    }
    for (let roundTicks = 0; state.phase === 'combat'; roundTicks++) {
      expect(roundTicks).toBeLessThan(1200);
      const next = stepMatch(freeze(state));
      ticks++;
      allEvents.push(...next.events);
      combatEvents.push(...next.events.filter((event): event is CombatEvent => 'tick' in event));
      for (const event of next.events) if (event.type === 'cast' && next.state.combat!.units.some(unit =>
        unit.id === event.sourceId && unit.team === 'player' && COSTS[unit.definitionId] === 5)) fiveCostCasts.push(event);
      if (next.state.phase === 'settlement') settlementLedger(next.state);
      state = next.state;
      ledger();
      tickStates.push(JSON.stringify(state));
      if (serialize) state = restoreMatch(JSON.stringify(state));
    }
    const expected = EXPECTED_ROUNDS[index];
    expect(state).toMatchObject({ phase: 'settlement', playerHp: expected.hp, level: expected.level, xp: expected.xp, gold: expected.gold });
    expect(state.roundResults).toHaveLength(index + 1);
    expect(stepMatch(state)).toEqual({ state, events: [] });
    if (index < ROUNDS.length - 1) {
      const round = state.round + 1;
      generation++; nextShop();
      if ([2, 5].includes(round)) for (let draw = 0; draw < 3; draw++) choiceRng = word(choiceRng);
      if ([3, 4, 6, 8, 10].includes(round)) rewardRng = word(rewardRng);
      if (round === 7) { gold += 2; rewardGold += 2; }
      accepted(nextRound(freeze(state), state.round));
    }
  }
  expect([...boughtTiers].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(upgradedToThree).toEqual([3]);
  expect(fiveCostCasts.length).toBeGreaterThan(0);
  expect(fiveCostCasts.every(event => event.type === 'cast' && event.sourceId === 'unit-17' && event.abilityId === 'colossus-guard')).toBe(true);
  expect(combatEvents.some(event => event.type === 'shieldChanged' && event.unitId === 'unit-17' && event.reason === 'granted' && event.after === 800)).toBe(true);
  expect(state.roundResults.filter(result => result.combatTicks > 0)).toHaveLength(10);
  expect(state.roundResults[9].combatTicks).toBe(0);
  expect({ purchases, purchaseGold, saleGold, rerolls, xpBuys, commands }).toEqual({ purchases: 12, purchaseGold: 22, saleGold: 22, rerolls: 4, xpBuys: 13, commands: 71 });
  expect(state.preparation.units.filter(unit => unit.team === 'player').map(unit => unit.definitionId)).toEqual(['colossus']);
  expect(state.items.filter(item => item.location.kind === 'unit').map(item => item.id)).toEqual(['item-3', 'item-4', 'item-5']);
  expect(state.anomalyBinding).toBeNull();
  expect(state.scheduleReceipts.find(receipt => receipt.eventId === 'r7-anomaly')).toMatchObject({ unitId: 'unit-1', definitionId: 'colossal-form' });
  expect(ticks).toBeLessThanOrEqual(10 * 1200);
  return { state, commandStates, tickStates, combatEvents, allEvents, fiveCostCasts, ticks };
}

describe('M4 bounded long growth with production economy, strategy and combat', () => {
  it('grows a three-star, buys every cost tier, and casts a purchased five-cost while surviving eleven rounds', () => {
    const normal = replay(false);
    expect(replay(true)).toEqual(normal);
  }, 60000);
});
