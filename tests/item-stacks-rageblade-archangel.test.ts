import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, equipItem, openMatchCombatStream, stepMatchCombatStream } from '../src/simulation/match';
import { toCombatViewState } from '../src/simulation/combat-replay-view';
import { readCombatStats } from '../src/simulation/combat-s13';
import { combatItemStackBadges, itemStackBadgeText, itemStackFull } from '../src/presentation/battle-equipment';
import { itemStackLine } from '../src/presentation/unit-card';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';
const accepted = (r: MatchCommandResult) => { if (!r.ok) throw Error(r.reason); return r.state; };

/** Two copies on one unit: each instance keeps its own counter, read from the runtime that already applies the stat. */
function fight(definitionId: string, ticks: number) {
  let s: MatchState = createMatch(42); const id = s.preparation.units[0].id;
  s = accepted(deployMatchUnit(s, id, { kind: 'board', cell: { col: 3, row: 6 } }));
  s = { ...s, items: [1, 2].map(n => ({ id: `item-${n}`, definitionId, location: { kind: 'inventory' as const } })), nextItemSerial: 3 };
  s = accepted(equipItem(accepted(equipItem(s, 'item-1', id, 0)), 'item-2', id, 1));
  let open = accepted(openMatchCombatStream(s));
  for (let t = 0; t < ticks && open.combat!.status === 'running'; t++) open = stepMatchCombatStream(open).state;
  const unit = open.combat!.units.find(u => u.id === id)!;
  return { unit, combat: open.combat!, view: toCombatViewState(open.combat!).units.find(u => u.id === id)! };
}

describe('鬼索的狂暴之刃 / 大天使之杖 combat stack counters', () => {
  it('rageblade: one uncapped stack per counted attack, matching the attack speed it granted', () => {
    const { unit, view } = fight('rageblade', 150);
    const rows = view.itemStacks!;
    expect(rows.map(r => [r.instanceId, r.definitionId, r.maxStacks])).toEqual([['item-1', 'rageblade', null], ['item-2', 'rageblade', null]]);
    expect(rows[0].stacks).toBeGreaterThan(0); expect(rows[1].stacks).toBe(rows[0].stacks);
    expect(unit.runtime!.attackSpeedBps).toBe((rows[0].stacks + rows[1].stacks) * 500);
  });
  it('archangel: one uncapped stack per 5 s pulse, matching the 30 AP each pulse granted', () => {
    const early = fight('archangel', 99).view.itemStacks!;
    expect(early.map(r => r.stacks)).toEqual([0, 0]);
    const { unit, combat, view } = fight('archangel', 201);
    expect(view.itemStacks!.map(r => [r.instanceId, r.stacks, r.maxStacks])).toEqual([['item-1', 2, null], ['item-2', 2, null]]);
    expect(unit.runtime!.abilityPowerFlat).toBe(4 * 30);
    expect(readCombatStats(unit, combat).abilityPower).toBe(view.abilityPower);
  });
  it('client shows the count without 满 or a cap for uncapped rows', () => {
    const row = { instanceId: 'r', definitionId: 'rageblade', stacks: 40, maxStacks: null };
    expect(itemStackFull(row)).toBe(false); expect(itemStackBadgeText(row)).toBe('40');
    expect(combatItemStackBadges(['rageblade'], [row])).toEqual([{ stacks: 40, maxStacks: null }]);
    const line = { dataset: {}, textContent: '', hidden: true } as unknown as HTMLElement;
    expect(itemStackLine([row], line).textContent).toBe('鬼索的狂暴之刃 · 层数 40');
    expect(itemStackBadgeText({ stacks: 25, maxStacks: 25 })).toBe('25满');
  });
});
