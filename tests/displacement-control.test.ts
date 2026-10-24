import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD, hexDistance, type HexCell } from '../src/simulation/board';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { grabAdjacent, knockAway, pullToward, rawRangeToHexes } from '../src/simulation/combat-displacement';
import { stepCombat, type CombatUnit, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { toCombatReplay } from '../src/simulation/combat-replay-view';
import { mirrorCombatReplay } from '../src/server/room/projection';
import { EMPTY_RUNTIME, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { battle, unit, freeze } from './combat-helpers';

const c = (col: number, row: number): HexCell => ({ col, row });
function caster(definitionId: string, cell: HexCell, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', cell.col, cell.row, { definitionId, ability: resolveAbility(`${definitionId}-ability`, 1),
    hp: 5000, maxHp: 5000, mana: 100, maxMana: 100, attackDamage: 100, attackRange: 8,
    moveCooldownTicks: 1000, baseAttackSpeedBps: 10000, abilityPower: 100,
    runtime: { ...EMPTY_RUNTIME }, tasks: [], statuses: [], shieldLayers: [], mechanics: [], ...patch });
}
function dummy(id: string, cell: HexCell, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, 'enemy', cell.col, cell.row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 10000, maxHp: 10000, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, ...patch });
}
const forced = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'movement' && e.reason && e.reason !== 'ambessa-chain' && e.reason !== 'ambessa-fist-retreat');
const run = (units: CombatUnit[], rngState = 42) => stepCombat(freeze(battle(units, { strategy: { traits: [], units: [] }, combatId: 'displacement', rngState })));
const at = (state: CombatState, id: string) => state.units.find(u => u.id === id)!.cell;
function context(units: CombatUnit[], reserved: string[] = []): AbilityContext {
  return { tick: 1, board: DEFAULT_BOARD, units: units as S13Unit[], events: [], packets: [], heals: [],
    movementReservations: new Set(reserved), draw: vi.fn(() => { throw Error('displacement consumed RNG'); }) };
}

it('raw range uses the 14.24b HexToRangeMap floor', () => {
  expect([0, 179, 180, 240, 419, 420, 2330, 9999].map(rawRangeToHexes)).toEqual([0, 0, 1, 1, 1, 2, 10, 10]);
});

describe('Mordekaiser pulls the nearest line-hit enemies 1 hex toward him', () => {
  it('pulls 4 nearest, not the 5th; adjacent stay; no RNG', () => {
    // Straight NE hex line from (3,6): (3,5) (4,4) (4,3) (5,2) (5,1) (6,0); the claw hits all five.
    const line = () => [caster('mordekaiser', c(3, 6)), dummy('a', c(3, 5)), dummy('b', c(4, 3)), dummy('d', c(5, 2)), dummy('e', c(5, 1)), dummy('f', c(6, 0))];
    const result = run(line());
    const moves = forced(result.events);
    expect(moves.every(m => m.type === 'movement' && m.reason === 'mordekaiser-pull')).toBe(true);
    expect(moves.map(m => m.type === 'movement' && m.unitId)).toEqual(['b', 'd', 'e']);
    expect(at(result.state, 'a')).toEqual(c(3, 5));
    for (const id of ['b', 'd', 'e']) {
      const m = moves.find(m => m.type === 'movement' && m.unitId === id)!;
      if (m.type !== 'movement') throw Error();
      expect(hexDistance(m.from, m.to)).toBe(1);
      expect(hexDistance(c(3, 6), m.to)).toBe(hexDistance(c(3, 6), m.from) - 1);
    }
    expect(at(result.state, 'f')).toEqual(c(6, 0));
    expect(result.state.rngState).toBe(42);
    expect(result.events.filter(e => e.type === 'packetDamage')).toHaveLength(5);
    expect(result.events.findIndex(e => e.type === 'movement' && e.reason === 'mordekaiser-pull')).toBeLessThan(result.events.findIndex(e => e.type === 'packetDamage'));
  });
  it('blocked step stays; control immunity is not pulled', () => {
    const p = caster('mordekaiser', c(3, 6)) as S13Unit, t = dummy('t', c(3, 4)) as S13Unit;
    const ring = [c(2, 5), c(3, 5)].map((cell, i) => dummy(`w${i}`, cell, { team: 'player' }));
    const ctx = context([p, t, ...ring]);
    pullToward(ctx, p, [t], 1, 'mordekaiser-pull');
    expect(t.cell).toEqual(c(3, 4)); expect(ctx.events).toEqual([]);
    const free = context([p, t]);
    t.mechanics = [{ mechanic: 'g23Anomaly', source: { ...origin(t), sourceKind: 'anomaly', definitionId: 'deep-roots' }, values: { enabled: 1 } }] as never;
    pullToward(free, p, [t], 1, 'mordekaiser-pull');
    expect(t.cell).toEqual(c(3, 4)); expect(free.events).toEqual([]);
  });
});

describe('Sett grabs two enemies next to himself', () => {
  it('both land adjacent to Sett and beside each other; stun/damage unchanged', () => {
    const result = run([caster('sett', c(3, 6)), dummy('a', c(1, 4)), dummy('b', c(5, 4)), dummy('far', c(3, 0))]);
    const moves = forced(result.events);
    expect(moves.map(m => m.type === 'movement' && [m.unitId, m.reason])).toEqual([['a', 'sett-grab'], ['b', 'sett-grab']]);
    const a = at(result.state, 'a'), b = at(result.state, 'b');
    expect(hexDistance(c(3, 6), a)).toBe(1); expect(hexDistance(c(3, 6), b)).toBe(1); expect(hexDistance(a, b)).toBe(1);
    expect(at(result.state, 'far')).toEqual(c(3, 0));
    expect(result.state.rngState).toBe(42);
  });
  it('already adjacent stays; full ring stays', () => {
    const s = caster('sett', c(3, 6)) as S13Unit, near = dummy('n', c(3, 5)) as S13Unit, far = dummy('f', c(3, 2)) as S13Unit;
    const ctx = context([s, near, far]);
    grabAdjacent(ctx, s, [near, far], 'sett-grab');
    expect(near.cell).toEqual(c(3, 5));
    expect(hexDistance(far.cell, s.cell)).toBe(1); expect(hexDistance(far.cell, near.cell)).toBe(1);
    const full = context([s, far, ...[c(4, 6), c(3, 7), c(2, 7), c(2, 6), c(2, 5), c(3, 5)].map((cell, i) => dummy(`r${i}`, cell, { team: 'player' }))]);
    far.cell = c(3, 2);
    grabAdjacent(full, s, [far], 'sett-grab');
    expect(far.cell).toEqual(c(3, 2)); expect(full.events).toEqual([]);
  });
});

describe('Sevika Extendo-Punch knockback', () => {
  it.each([
    // (3,5) is the NE neighbour of (3,6); the NE ray continues (4,4) (4,3) (5,2) (5,1) (6,0).
    ['NE ray to the top edge', c(3, 6), c(3, 5), [], c(6, 0)],
    ['stops before a blocker on the ray', c(3, 6), c(3, 5), [c(5, 2)], c(4, 3)],
    ['east ray to the right edge', c(3, 6), c(4, 6), [], c(6, 6)],
    ['blocker directly behind: no move', c(3, 6), c(4, 6), [c(5, 6)], c(4, 6)],
  ] as const)('%s', (_n, from, target, occupied, expected) => {
    const s = caster('sevika', from) as S13Unit, t = dummy('t', target) as S13Unit;
    const ctx = context([s, t, ...occupied.map((cell, i) => dummy(`o${i}`, cell))]);
    knockAway(ctx, s, t, 10, 'sevika-knockback');
    expect(t.cell).toEqual(expected);
    expect(ctx.events).toEqual(JSON.stringify(target) === JSON.stringify(expected) ? [] : [{ type: 'movement', tick: 1, unitId: 't', from: target, to: expected, reason: 'sevika-knockback' }]);
    expect(ctx.draw).not.toHaveBeenCalled();
  });
  it('real cast: target knocked away, Sevika dashes beside it, event order and replay', () => {
    let found: ReturnType<typeof run> | undefined;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const r = run([caster('sevika', c(3, 6)), dummy('t', c(3, 5))], seed);
      if (r.events.some(e => e.type === 'castOutcome' && e.castVariant?.move === 'punch')) found = r;
    }
    expect(found).toBeDefined();
    const moves = found!.events.filter(e => e.type === 'movement');
    expect(moves[0]).toMatchObject({ unitId: 't', reason: 'sevika-knockback', from: c(3, 5) });
    expect(hexDistance(at(found!.state, 'p'), at(found!.state, 't'))).toBe(1);
    expect(at(found!.state, 't').row).toBeLessThan(5);
  });
});

it('sync / JSON resume / replay agree and keep the displacement reason', () => {
  const initial = freeze(battle([caster('sett', c(3, 6)), dummy('a', c(1, 4)), dummy('b', c(5, 4))], { strategy: { traits: [], units: [] }, combatId: 'disp-replay', rngState: 42, maxTicks: 6 }));
  let state = initial, resumed = JSON.parse(JSON.stringify(initial)) as CombatState;
  const ledger = [] as ReturnType<typeof toLedgerEvents>;
  while (state.status === 'running') {
    const next = stepCombat(state), restored = stepCombat(resumed);
    expect(restored).toEqual(next);
    ledger.push(...toLedgerEvents(next.events)); state = next.state; resumed = JSON.parse(JSON.stringify(restored.state));
  }
  expect(forced(ledger)).toHaveLength(2);
  const replay = toCombatReplay({ initial, terminal: state, events: ledger });
  const grabs = (r: typeof replay) => r.ticks.flatMap(t => t.events).filter(e => e.type === 'movement' && e.reason === 'sett-grab');
  expect(grabs(replay)).toHaveLength(2);
  // The opposing seat sees the same grabs with rows flipped.
  const rows = DEFAULT_BOARD.rows - 1;
  expect(grabs(mirrorCombatReplay(replay))).toEqual(grabs(replay).map(e => e.type === 'movement' ? { ...e, from: { ...e.from, row: rows - e.from.row }, to: { ...e.to, row: rows - e.to.row } } : e));
  const tampered = { initial, terminal: state, events: ledger.map(e => e.type === 'movement' && e.reason ? { ...e, reason: undefined } : e) };
  expect(() => toCombatReplay(tampered)).toThrow('replay-divergence');
});
