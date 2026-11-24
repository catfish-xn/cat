import { describe, expect, it } from 'vitest';
import { toCombatViewEvents } from '../src/simulation/combat-replay-view';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, toCombatReplay, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';

// The display view of a damage packet carries the part past the target's remaining HP (overkill) when there is some, so the
// killing blow's number can show the whole hit. Killing packets only. Display only: the HP taken, the ledger and settlement
// are unchanged.
const packet = (hpDamage: number, overkill: number, killingPacket: boolean) => ({ type: 'packetDamage', tick: 7, eventSeq: 3, domain: 'combat', combatId: 'c',
  outcome: { context: { source: { ownerId: 'a', sourceKind: 'ability', definitionId: 'x-ability' }, targetId: 'b', damageType: 'physical', delivery: 'ability-direct' },
    hit: true, raw: hpDamage + overkill, prevented: 0, mitigated: hpDamage + overkill, absorbed: 0, hpDamage, overkill, critical: false, killingPacket } });
function army(names: readonly string[]): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, items: [],
    preparation: { ...base.preparation, units: names.map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 1 + i, row: i % 2 ? 4 : 5 } } })) } };
}

describe('the damage view carries overkill', () => {
  it('a killing packet past the target\'s HP carries its overkill beside the HP it took', () => {
    const [view] = toCombatViewEvents([packet(30, 500, true)] as never);
    expect(view).toMatchObject({ type: 'packetDamage', hpDamage: 30, overkill: 500, killingPacket: true });
  });
  it('any other packet reads as before, no such key: one with no overkill, or one that kills nothing (its target already fell)', () => {
    for (const p of [packet(50, 0, false), packet(30, 0, true), packet(0, 200, false)]) expect(Object.hasOwn(toCombatViewEvents([p] as never)[0]!, 'overkill')).toBe(false);
  });
  it('in a real battle\'s replay only killing packets carry it', () => {
    const source = compileBattle(snapshotForBattle(army(['garen', 'darius', 'vi', 'sett']), 'A'), snapshotForBattle(army(['illaoi', 'trundle', 'vander', 'akali']), 'B'), 42, { battleId: 'view-overkill' });
    const views = toCombatReplay(resolveTwoSidedBattle(source, 901)).ticks.flatMap(t => t.events).filter(e => e.type === 'packetDamage') as { killingPacket: boolean; overkill?: number }[];
    const carried = views.filter(v => Object.hasOwn(v, 'overkill'));
    expect(carried.length).toBeGreaterThan(0);
    expect(carried.every(v => v.killingPacket && v.overkill! > 0)).toBe(true);
  });
});
