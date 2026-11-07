import { describe, expect, it, vi } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { compileNeutralEncounter } from '../src/simulation/neutral-encounter-compiler';
import { battle, unit } from './combat-helpers';
import { legacyHeraldVector } from './neutral-helpers';
// Preserve the existing timeout; the pure vectors do not depend on old Match route fixtures.
vi.setConfig({ testTimeout: 20_000 });

/**
 * Independent B7 audit vectors (signed-off audit of 889a2a5). Expected values come from
 * M8B_ENCOUNTERS §4.4/§4.5 hand calculations and a separate odd-r/axial geometry model below,
 * never from implementation output.
 */

// Independent odd-r offset <-> axial model; does not import board.ts helpers.
type Cell = { col: number; row: number };
const toAxial = (c: Cell) => [c.col - Math.floor(c.row / 2), c.row] as const;
const fromAxial = (q: number, r: number): Cell => ({ col: q + Math.floor(r / 2), row: r });
const DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const; // E SE SW W NW NE
const distance = (a: Cell, b: Cell) => {
  const [aq, ar] = toAxial(a), [bq, br] = toAxial(b), dq = aq - bq, dr = ar - br;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};
const onBoard = (c: Cell) => c.col >= 0 && c.col < 7 && c.row >= 0 && c.row < 8;

const dummy = (id: string, team: CombatUnit['team'], col: number, row: number, hp = 1000): CombatUnit => ({
  ...unit(id, team, col, row, { hp, maxHp: hp, armor: 0, magicResist: 0, mana: 0, maxMana: 0,
    ability: { id: 'boundary-dummy', amount: 0, kind: 's13', championId: 'neutral', variables: {} } }),
  cooldownTicks: 1000, moveCooldownTicks: 1000,
});
function heraldBattle(players: readonly CombatUnit[], allies: readonly CombatUnit[] = []): CombatState {
  const compiled = legacyHeraldVector();
  return battle([...compiled.units.map(u => ({ ...u, cooldownTicks: 1000, moveCooldownTicks: 1000 })), ...allies, ...players],
    { combatId: 'b7-audit', rngDraws: 0, openingDefinitions: compiled.openingDefinitions });
}
// B9 replay2: packets carry their outcome; a stun statusChanged carries its frozen group, whose contribution
// appliedAtTick/expiresAtTick are the effective window (formerly status.startsAtTick/expiresAtTick).
const chargeTrace = (events: readonly CombatEvent[]) => events.flatMap(e => e.type === 'packetDamage' ? [`damage:${e.outcome.context.targetId}:${e.outcome.raw}`]
  : e.type === 'statusChanged' && e.group.kind === 'stun' ? [`stun:${e.group.targetId}:${e.reason}:${e.group.contributions.map(c => `${c.appliedAtTick}-${c.expiresAtTick}`).join(',')}`] : []);

describe('B7 audit: Rift Herald charge (ENCOUNTERS §4.5)', () => {
  it('hits every path enemy in path order, each damage packet before its own next-tick stun', () => {
    const result = stepCombat(heraldBattle([dummy('a', 'player', 3, 3), dummy('b', 'player', 3, 4)]));
    const plan = result.state.openingState!.plans[0];
    expect(plan.path).toEqual([{ col: 4, row: 2 }, { col: 3, row: 3 }, { col: 3, row: 4 }, { col: 2, row: 5 }]);
    expect(plan.targetIds).toEqual(['a', 'b']);
    expect(plan.to).toEqual({ col: 2, row: 5 });
    // floor(1000×1500/10000)=150 each; stun [2,12).
    expect(chargeTrace(result.events)).toEqual(['damage:a:150', 'stun:a:applied:2-12', 'damage:b:150', 'stun:b:applied:2-12']);
    expect(result.state.rngDraws).toBe(0);
  });

  it('a lethal first target gets no stun while the surviving second target is still stunned', () => {
    const result = stepCombat(heraldBattle([{ ...dummy('a', 'player', 3, 3), hp: 100 }, dummy('b', 'player', 3, 4)]));
    expect(chargeTrace(result.events)).toEqual(['damage:a:150', 'damage:b:150', 'stun:b:applied:2-12']);
    expect(result.state.units.find(u => u.id === 'a')).toMatchObject({ alive: false, statuses: [] });
  });

  it.each([[1999, 299], [2000, 300], [2001, 300]])('target maxHp %i samples %i raw magic damage at the 300 cap boundary', (hp, raw) => {
    const result = stepCombat(heraldBattle([dummy('p', 'player', 3, 4, hp)]));
    expect(result.events.find(e => e.type === 'packetDamage')).toMatchObject({ outcome: { raw, critical: false, context: { damageType: 'magic' } } });
  });

  it('no-landing vector: friendly and enemy occupants fill the whole path, so nothing moves, hits or stuns', () => {
    const result = stepCombat(heraldBattle([dummy('p1', 'player', 3, 4), dummy('p2', 'player', 2, 5)],
      [dummy('f1', 'enemy', 4, 2), dummy('f2', 'enemy', 3, 3)]));
    const plan = result.state.openingState!.plans[0];
    expect(plan).toMatchObject({ result: 'no-space', task: null, consumed: true });
    expect(result.events.filter(e => e.type === 'packetDamage' || e.type === 'movement' || e.type === 'statusChanged')).toEqual([]);
  });
});

describe('B7 audit: Elder Dragon cone (ENCOUNTERS §4.4) against independent geometry', () => {
  const layouts: { dragon: Cell; primary: Cell }[] = [];
  for (const [col, row] of [[3, 2], [3, 3], [0, 3], [6, 4], [2, 5], [5, 0]])
    for (let c = 0; c < 7; c++) for (let r = 0; r < 8; r++) {
      const d = distance({ col, row }, { col: c, row: r });
      if (d >= 1 && d <= 2) layouts.push({ dragon: { col, row }, primary: { col: c, row: r } });
    }

  it(`selects at most two 315-damage children from the four-cell cone on ${layouts.length} odd/even/edge layouts`, () => {
    expect(layouts).toHaveLength(88);
    let attacked = 0;
    for (const { dragon, primary } of layouts) {
      const [dq, dr] = toAxial(dragon);
      const di = DIRECTIONS.findIndex(([x, y]) => { const n = fromAxial(dq + x, dr + y); return onBoard(n) && distance(n, primary) < distance(dragon, primary); });
      const [pq, pr] = toAxial(primary), d = DIRECTIONS[di], left = DIRECTIONS[(di + 5) % 6], right = DIRECTIONS[(di + 1) % 6];
      const cone = [[pq + d[0], pr + d[1]], [pq + 2 * d[0], pr + 2 * d[1]], [pq + d[0] + left[0], pr + d[1] + left[1]], [pq + d[0] + right[0], pr + d[1] + right[1]]]
        .map(([q, r]) => fromAxial(q, r)).filter(onBoard);
      // Fill all cells near the primary but farther from the dragon, so the primary is the unique nearest target.
      const players = [dummy('p00', 'player', primary.col, primary.row, 2000)];
      for (let c = 0; c < 7; c++) for (let r = 0; r < 8; r++) {
        const cell = { col: c, row: r };
        if ((c === primary.col && r === primary.row) || (c === dragon.col && r === dragon.row)) continue;
        if (distance(cell, primary) <= 2 && distance(cell, dragon) > distance(primary, dragon)) players.push(dummy(`p${String(players.length).padStart(2, '0')}`, 'player', c, r, 2000));
      }
      const compiled = compileNeutralEncounter('5-7');
      const step = stepCombat(battle([{ ...compiled.units[0], cell: dragon }, ...players], { combatId: 'b7-audit', rngState: 634785765, rngDraws: 0 }));
      const attack = step.events.find(e => e.type === 'attack');
      if (!attack) continue;
      attacked++;
      expect(attack).toMatchObject({ targetId: 'p00' });
      const expected = players.filter(u => u.id !== 'p00' && cone.some(c => c.col === u.cell.col && c.row === u.cell.row))
        .sort((a, b) => distance(a.cell, primary) - distance(b.cell, primary) || (a.id < b.id ? -1 : 1)).slice(0, 2);
      const children = step.events.filter(e => e.type === 'packetDamage' && e.outcome.context.source.sourceKind === 'ability');
      expect({ dragon, primary, children: children.map(e => e.type === 'packetDamage' ? [e.outcome.context.targetId, e.outcome.raw, e.outcome.critical] : []).sort() })
        .toEqual({ dragon, primary, children: expected.map(u => [u.id, 315, false]).sort() });
      expect(step.state.rngDraws).toBe(1);
    }
    expect(attacked).toBe(layouts.length); // Every independently enumerated layout must actually attack.
  });
});

