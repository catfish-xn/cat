import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOARD, type HexCell } from '../src/simulation/board';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { dashAmbessaChain, settleAmbessaRetreats } from '../src/simulation/combat-ambessa-dash';
import { stepCombat, type CombatUnit, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { applyCombatReplayTick, createCombatReplayRecorder, startCombatReplay, toCombatReplay, toCombatViewState } from '../src/simulation/combat-replay-view';
import { EMPTY_RUNTIME, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { battle, unit, freeze } from './combat-helpers';

const c = (col: number, row: number): HexCell => ({ col, row });
function ambessa(cell = c(1, 3), fists = false, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', cell.col, cell.row, { definitionId: 'ambessa', ability: resolveAbility('ambessa-ability', 1),
    hp: 5000, maxHp: 5000, mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6,
    moveCooldownTicks: 1000, baseAttackSpeedBps: 10000, abilityPower: 100,
    runtime: { ...EMPTY_RUNTIME, castCount: fists ? 1 : 0 }, tasks: [], statuses: [], shieldLayers: [], mechanics: [], ...patch });
}
function dummy(cell = c(5, 3), patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('e', 'enemy', cell.col, cell.row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 10000, maxHp: 10000, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, ...patch });
}
const blockers = (cells: HexCell[]) => cells.map((cell, i) => dummy(cell, { id: `block-${i}`, team: 'player' }));
const dashes = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'movement' && e.reason);
const cast = (units: CombatUnit[]) => stepCombat(freeze(battle(units, { strategy: { traits: [], units: [] }, combatId: 'ambessa-vector', rngState: 42 })));
const player = (state: CombatState) => state.units.find(u => u.id === 'p')!;

describe('Ambessa P independent hex vectors (col,row)', () => {
  // Literal coordinates/HP, never computed with the landing selector under test.
  it.each([
    ['nearest/tie E before NE', c(1, 3), c(5, 3), [], c(4, 3)],
    ['adjacent caster cell is occupied, choose nearest empty SE', c(4, 3), c(5, 3), [], c(5, 4)],
    ['target ring full', c(1, 3), c(5, 3), [c(6, 3), c(6, 4), c(5, 4), c(4, 3), c(5, 2), c(6, 2)], c(1, 3)],
    ['rear occupied is irrelevant', c(1, 3), c(5, 3), [c(2, 4)], c(4, 3)],
    ['top/right edge', c(3, 0), c(6, 0), [], c(5, 0)],
    ['enclosed caster cannot cross blockers', c(1, 3), c(5, 3), [c(2, 3), c(2, 4), c(1, 4), c(0, 3), c(1, 2), c(2, 2)], c(1, 3)],
  ] as const)('chains: %s', (_name, from, target, occupied, expected) => {
    const result = cast([ambessa(from), dummy(target), ...blockers([...occupied])]);
    expect(player(result.state).cell).toEqual(expected);
    expect(result.state.units.find(u => u.id === 'e')!.hp).toBe(9750); // 100 AD × 250%, zero armor.
    expect(result.state.rngState).toBe(42);
    expect(dashes(result.events)).toHaveLength(JSON.stringify(from) === JSON.stringify(expected) ? 0 : 1);
    const dash = dashes(result.events)[0];
    if (dash) {
      expect(dash).toMatchObject({ type: 'movement', tick: 1, unitId: 'p', from, to: expected, reason: 'ambessa-chain', domain: 'combat', combatId: 'ambessa-vector' });
      expect(result.events.indexOf(dash)).toBeLessThan(result.events.findIndex(e => e.type === 'packetDamage'));
    }
  });

  it.each([
    ['homeward', c(3, 4), c(3, 3), [], c(3, 5)],
    ['target ring full except caster', c(3, 4), c(3, 3), [c(4, 3), c(4, 4), c(2, 3), c(3, 2), c(4, 2)], c(3, 5)],
    ['retreat occupied, no alternate', c(3, 4), c(3, 3), [c(3, 5)], c(3, 4)],
    ['home edge', c(3, 7), c(3, 6), [], c(3, 7)],
    ['no direction both away and homeward', c(3, 4), c(3, 5), [], c(3, 4)],
    ['left edge', c(0, 4), c(0, 3), [], c(0, 5)],
  ] as const)('fists: %s', (_name, from, target, occupied, expected) => {
    const result = cast([ambessa(from, true), dummy(target), ...blockers([...occupied])]);
    expect(player(result.state).cell).toEqual(expected);
    expect(result.state.units.find(u => u.id === 'e')!.hp).toBe(9500); // 100 AD × 500%, zero armor.
    expect(result.state.rngState).toBe(42);
    expect(dashes(result.events)).toHaveLength(JSON.stringify(from) === JSON.stringify(expected) ? 0 : 1);
    const dash = dashes(result.events)[0];
    if (dash) {
      expect(dash).toMatchObject({ tick: 1, unitId: 'p', from, to: expected, reason: 'ambessa-fist-retreat' });
      expect(result.events.indexOf(dash)).toBeGreaterThan(result.events.findIndex(e => e.type === 'packetDamage'));
    }
  });

  it('enemy side retreats toward its own upper half', () => {
    const result = cast([ambessa(c(3, 3), true, { team: 'enemy' }), dummy(c(3, 4), { team: 'player' })]);
    expect(player(result.state).cell).toEqual(c(3, 2));
  });

  it.each([false, true])('target moves before casting, fists=%s: use the new target cell', fists => {
    const result = cast([ambessa(c(1, 3), fists), dummy(c(5, 3), { moveCooldownTicks: 0 })]);
    expect(result.events.find(e => e.type === 'movement' && e.unitId === 'e')).toMatchObject({ from: c(5, 3), to: c(4, 3) });
    expect(player(result.state).cell).toEqual(fists ? c(1, 4) : c(3, 3));
    expect(dashes(result.events)).toHaveLength(1);
  });

  it.each([false, true])('dead previous target before casting, fists=%s: retarget without using the corpse', fists => {
    const result = cast([ambessa(c(1, 3), fists, { targetId: 'dead' }), dummy(c(2, 3), { id: 'dead', hp: 0, alive: false }), dummy(c(5, 3))]);
    expect(player(result.state).targetId).toBe('e');
    expect(player(result.state).cell).toEqual(fists ? c(1, 4) : c(4, 3));
    expect(result.events.find(e => e.type === 'cast')).toMatchObject({ receipt: { targetIds: ['e'] } });
  });

  it.each([false, true])('no living target before casting, fists=%s: no cast, mana or movement', fists => {
    const result = cast([ambessa(c(1, 3), fists), dummy(c(5, 3), { hp: 0, alive: false })]);
    expect(player(result.state).cell).toEqual(c(1, 3));
    expect(player(result.state).mana).toBe(100);
    expect(result.events.filter(e => e.type === 'cast' || e.type === 'movement')).toEqual([]);
  });

  it('a lethal slam still retreats using the cast target cell; a dead caster cannot retreat', () => {
    const kill = cast([ambessa(c(3, 4), true), dummy(c(3, 3), { hp: 100 })]);
    expect(kill.state.units.find(u => u.id === 'e')!.alive).toBe(false);
    expect(player(kill.state).cell).toEqual(c(3, 5));
    const mutual = cast([ambessa(c(3, 4), true, { hp: 1 }), dummy(c(3, 3), { hp: 100, cooldownTicks: 0, attackDamage: 100 })]);
    expect(player(mutual.state).alive).toBe(false);
    expect(dashes(mutual.events)).toEqual([]);
  });
});

function context(unit: CombatUnit, other: CombatUnit[], reserved: string[] = []): AbilityContext {
  return { tick: 1, board: DEFAULT_BOARD, units: [unit, ...other] as S13Unit[], events: [], packets: [], heals: [],
    movementReservations: new Set(reserved), draw: vi.fn(() => { throw Error('dash consumed RNG'); }) };
}
describe('Ambessa occupancy and reservations', () => {
  it.each(['stun', 'channel', 'deep-roots'] as const)('both dashes obey existing %s movement prohibition', kind => {
    const u = ambessa() as S13Unit, t = dummy() as S13Unit, ctx = context(u, [t]);
    if (kind === 'deep-roots') u.mechanics = [{ mechanic: 'g23Anomaly', source: { ...origin(u), sourceKind: 'anomaly', definitionId: kind }, values: { enabled: 1 } }];
    else applyStatus(u, origin(u), kind, 0, 20, 0, [], true);
    ctx.ambessaRetreats = [{ unitId: u.id, targetCell: t.cell }];
    dashAmbessaChain(ctx, u, t); settleAmbessaRetreats(ctx);
    expect(u.cell).toEqual(c(1, 3)); expect(ctx.events).toEqual([]); expect(ctx.draw).not.toHaveBeenCalled();
  });
  it('chain preserves a reserved best cell and uses the next BFS tie', () => {
    const u = ambessa() as S13Unit, t = dummy() as S13Unit, ctx = context(u, [t], ['4:3']);
    dashAmbessaChain(ctx, u, t);
    // (5,4) and (5,2) are both distance 4; E,E,SE,E precedes E,E,NE,E.
    expect(u.cell).toEqual(c(5, 4));
    expect(ctx.movementReservations).toEqual(new Set(['4:3', '5:4']));
    expect(ctx.draw).not.toHaveBeenCalled();
  });
  it.each([{ hp: 0 }, { itemBanish: { untilTick: 20 } }])('living reservation cannot be landed on: %j', patch => {
    const u = ambessa(c(3, 4), true) as S13Unit, t = dummy(c(3, 3));
    const ctx = context(u, [t, dummy(c(3, 5), { id: 'reserved-body', ...patch } as Partial<CombatUnit>)]);
    ctx.ambessaRetreats = [{ unitId: u.id, targetCell: t.cell }];
    settleAmbessaRetreats(ctx);
    expect(u.cell).toEqual(c(3, 4)); expect(ctx.events).toEqual([]); expect(ctx.draw).not.toHaveBeenCalled();
  });
  it('fist obeys tick reservation even when the reserving mover has left', () => {
    const u = ambessa(c(3, 4), true) as S13Unit, t = dummy(c(3, 3)), ctx = context(u, [t], ['3:5']);
    ctx.ambessaRetreats = [{ unitId: u.id, targetCell: t.cell }];
    settleAmbessaRetreats(ctx);
    expect(u.cell).toEqual(c(3, 4)); expect(ctx.events).toEqual([]);
  });
});

it.each([false, true])('sync, JSON resume, sliced replay and first-pass recorder agree, fists=%s', fists => {
  const initial = freeze(battle([ambessa(c(1, 3), fists), dummy(c(5, 3))], { strategy: { traits: [], units: [] }, combatId: 'ambessa-replay', rngState: 42, maxTicks: 8 }));
  const recorder = createCombatReplayRecorder(initial, []);
  let state = initial, resumed = JSON.parse(JSON.stringify(initial)) as CombatState;
  const ledger = [] as ReturnType<typeof toLedgerEvents>, states = [initial];
  while (state.status === 'running') {
    const next = stepCombat(state), restored = stepCombat(resumed);
    expect(restored).toEqual(next);
    recorder.record(state, next); ledger.push(...toLedgerEvents(next.events));
    state = next.state; states.push(state); resumed = JSON.parse(JSON.stringify(restored.state));
  }
  expect(dashes(ledger)).toHaveLength(1);
  const input = { initial, terminal: state, events: ledger }, replay = toCombatReplay(input);
  expect(recorder.finish(state)).toEqual(replay);
  for (const budget of [1, 3]) {
    const task = startCombatReplay(input); let sliced = null;
    while (!sliced) sliced = task.advance(budget);
    expect(sliced).toEqual(replay);
  }
  let view = replay.initial;
  for (const frame of replay.ticks) { view = applyCombatReplayTick(view, frame); expect(view).toEqual(toCombatViewState(states[frame.tick])); }
  const tampered = { ...input, events: ledger.map(e => e.type === 'movement' && e.reason ? { ...e, reason: undefined } : e) };
  expect(() => toCombatReplay(tampered)).toThrow('replay-divergence');
});
