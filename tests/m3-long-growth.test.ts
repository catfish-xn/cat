import { describe, expect, it } from 'vitest';
import {
  buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat, stepMatch,
  type MatchCommandResult, type MatchState,
} from '../src/simulation/match';
import type { CombatEvent } from '../src/simulation/combat';
import type { UnitLocation } from '../src/simulation/units';

// Fixed, affordable seed6 transcript: grow a three-star tank, then sell the developed
// roster for XP. Empty deployments pay their normal HP cost. The five-cost Oracle
// is bought from round11's real shop, casts in real combat, and leaves us alive.
// No fixture alters gold, HP, units, shops, opponents, results, or combat ticks.
type Command = readonly ['buy', number, number] | readonly ['sell', string]
  | readonly ['D'] | readonly ['F'] | readonly ['deploy', string, UnitLocation];
const ROUNDS: readonly (readonly Command[])[] = [
  [['buy', 1, 1], ['sell', 'unit-6'], ['buy', 2, 1], ['buy', 0, 1], ['buy', 4, 1], ['D'], ['buy', 2, 2], ['buy', 1, 2],
    ['deploy', 'unit-3', { kind: 'board', cell: { col: 3, row: 4 } }],
    ['deploy', 'unit-2', { kind: 'board', cell: { col: 2, row: 5 } }],
    ['deploy', 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } }]],
  [['buy', 3, 3], ['D'], ['buy', 1, 4], ['buy', 2, 4], ['buy', 3, 4]],
  [['buy', 2, 5], ['F']],
  [['buy', 4, 6], ['sell', 'unit-17'], ['F']],
  [['F'], ['F']],
  [['F']],
  [['F']],
  [['sell', 'unit-1'], ['sell', 'unit-2'], ['sell', 'unit-3'], ['F'], ['F'], ['F'], ['F'], ['F']],
  [['buy', 2, 11], ['sell', 'unit-18'], ['F']],
  [['F'], ['F']],
  [['buy', 1, 13], ['deploy', 'unit-19', { kind: 'board', cell: { col: 2, row: 5 } }]],
];
// Oracle constants intentionally do not import production price/XP/stat helpers.
const COSTS: Readonly<Record<string, number>> = { sentinel: 1, ranger: 1, mystic: 1, bulwark: 2, archer: 2,
  arcanist: 3, duelist: 3, warden: 4, tempest: 4, colossus: 5, oracle: 5 };
const THRESHOLDS = [0, 2, 2, 6, 10, 20, 36, 56, 80];
const EXPECTED_ROUNDS = [
  { hp: 100, level: 3, xp: 2, gold: 8 }, { hp: 100, level: 3, xp: 4, gold: 7 },
  { hp: 100, level: 4, xp: 4, gold: 7 }, { hp: 100, level: 5, xp: 0, gold: 8 },
  { hp: 100, level: 5, xp: 10, gold: 5 }, { hp: 100, level: 5, xp: 16, gold: 6 },
  { hp: 84, level: 6, xp: 2, gold: 7 }, { hp: 68, level: 6, xp: 24, gold: 7 },
  { hp: 52, level: 6, xp: 30, gold: 8 }, { hp: 32, level: 7, xp: 4, gold: 5 },
  { hp: 12, level: 7, xp: 6, gold: 5 },
];
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

function replay(serialize: boolean) {
  let state = createMatch(6), gold = 10, level = 3, xp = 0, hp = 100, serial = 6, rng = 6n, generation = 1;
  let purchases = 0, purchaseGold = 0, saleGold = 0, rerolls = 0, xpBuys = 0, commands = 0, ticks = 0;
  const quantities: Record<string, number> = Object.fromEntries(Object.keys(COSTS).map(id => [id, 0]));
  quantities.sentinel = 2; quantities.ranger = 2; quantities.mystic = 1;
  const boughtTiers = new Set<number>(), upgradedToThree: number[] = [], fiveCostCasts: CombatEvent[] = [];
  const commandStates: MatchState[] = [], combatEvents: CombatEvent[] = [];
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
    expect(state.gold).toBe(10 + state.roundResults.length * 5 + saleGold - purchaseGold - 2 * rerolls - 4 * xpBuys);
    expect(state).toMatchObject({ level, xp, playerHp: hp, nextUnitSerial: serial, rngState: Number(rng), shop: { generation } });
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
    for (const event of result.events) if (event.toStar === 3) upgradedToThree.push(state.round);
    ledger();
    commandStates.push(structuredClone(state));
    if (serialize) state = JSON.parse(JSON.stringify(state)) as MatchState;
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
      expect(state.combat?.units.find(unit => unit.id === 'unit-19')).toMatchObject({ definitionId: 'oracle',
        starLevel: 1, hp: 1150, mana: 0, shield: 0, ability: { id: 'oracle-burst', amount: 420 } });
    }
    for (let roundTicks = 0; state.phase === 'combat'; roundTicks++) {
      expect(roundTicks).toBeLessThan(1200);
      const next = stepMatch(freeze(state));
      ticks++;
      combatEvents.push(...next.events);
      for (const event of next.events) if (event.type === 'cast' && next.state.combat!.units.some(unit =>
        unit.id === event.sourceId && unit.team === 'player' && COSTS[unit.definitionId] === 5)) fiveCostCasts.push(event);
      if (next.state.phase === 'settlement') settlementLedger(next.state);
      state = next.state;
      ledger();
      if (serialize) state = JSON.parse(JSON.stringify(state)) as MatchState;
    }
    const expected = EXPECTED_ROUNDS[index];
    expect(state).toMatchObject({ phase: 'settlement', playerHp: expected.hp, level: expected.level, xp: expected.xp, gold: expected.gold });
    expect(state.roundResults).toHaveLength(index + 1);
    expect(stepMatch(state)).toEqual({ state, events: [] });
    if (index < ROUNDS.length - 1) { generation++; nextShop(); accepted(nextRound(freeze(state), state.round)); }
  }
  expect([...boughtTiers].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(upgradedToThree).toEqual([3]);
  expect(fiveCostCasts.length).toBeGreaterThan(0);
  expect(fiveCostCasts.every(event => event.type === 'cast' && event.sourceId === 'unit-19' && event.abilityId === 'oracle-burst')).toBe(true);
  expect(state.roundResults.filter(result => result.combatTicks > 0)).toHaveLength(8);
  expect(state.roundResults.slice(7, 10).every(result => result.combatTicks === 0)).toBe(true);
  expect({ purchases, purchaseGold, saleGold, rerolls, xpBuys, commands }).toEqual({ purchases: 14, purchaseGold: 24, saleGold: 24, rerolls: 2, xpBuys: 14, commands: 61 });
  expect(state.preparation.units.filter(unit => unit.team === 'player').map(unit => unit.definitionId)).toEqual(['oracle']);
  expect(ticks).toBeLessThanOrEqual(8 * 1200);
  return { state, commandStates, combatEvents, fiveCostCasts, ticks };
}

describe('M3 bounded long growth with production economy and combat', () => {
  it('grows a three-star, buys every cost tier, and casts a purchased five-cost while surviving eleven rounds', () => {
    const normal = replay(false);
    expect(replay(true)).toEqual(normal);
  });
});
