import { describe, expect, it } from 'vitest';
import { advanceV20Minions } from '../src/simulation/combat-v20-traits';
import { augmentDeathsFromEvents } from '../src/simulation/augment-death-samples';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';

// Regression (#792, 2026-11-21): an expiring Menaces minion's death is a complete augment death row: a sample, a killer
// field (null: it expires, nobody kills it) and, when Forbidden Magic tracks takedowns, an empty takedown list. Golden Find
// ("golden find missing killer"), save restore and Forbidden Magic ("cabal missing takedowns") require those fields, and
// none of the death-counting augments counts the minion (not an ordinary hero, no killer, no takedowns).
function minion(id: string, team: 'player' | 'enemy'): S13Unit {
  return { id, definitionId: 'v20-silco-minion', team, starLevel: 1, cell: { col: 1, row: 4 }, hp: 1, maxHp: 1, alive: true, mana: 0, maxMana: 0, targetId: null,
    attackDamage: 0, armor: 0, magicResist: 0, attackRange: 100, attackIntervalTicks: 20, cooldownTicks: 0, moveCooldownTicks: 0, ability: { kind: 's13', id: 'v20-silco-minion-ability', championId: 'v20-silco-minion', amount: 0, variables: {} },
    runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], mechanics: [], shield: 0, shieldExpiresAtTick: null,
    v20Traits: { minion: { ownerId: 'powder', rootActionSeq: 1, nextAttackTick: 99, remaining: 0, periodTicks: 20, untilTick: 10, damage: 0 } } } as unknown as S13Unit;
}
function expire(units: S13Unit[]) {
  const ctx = { tick: 10, board: DEFAULT_BOARD, units, events: [], packets: [], heals: [], draw: () => 0 } as unknown as AbilityContext;
  advanceV20Minions(ctx);
  return ctx.events.filter(e => e.type === 'death');
}
describe('expiring Menaces minion death rows', () => {
  it('with Golden Find capturing killers: the row has killer null and is not an ordinary hero', () => {
    const deaths = expire([minion('m', 'player')]);
    expect(deaths).toHaveLength(1);
    expect(augmentDeathsFromEvents(deaths, true, false)).toEqual([expect.objectContaining({ unitId: 'm', ordinaryHero: false, killer: null })]);
  });
  it('with Forbidden Magic tracking takedowns: the row carries an empty takedown list', () => {
    const cabal = { ...minion('c', 'enemy'), definitionId: 'garen', v20Traits: undefined,
      mechanics: [{ mechanic: 'cabal', source: { ownerId: 'c', sourceKind: 'augment', definitionId: 'forbidden-magic' }, values: {} }] } as unknown as S13Unit;
    const deaths = expire([minion('m', 'player'), cabal]);
    expect(augmentDeathsFromEvents(deaths, true, true)).toEqual([expect.objectContaining({ unitId: 'm', killer: null, takedowns: [] })]);
  });
});
