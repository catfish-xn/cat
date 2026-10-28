import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
import { ConfiscationDisplay } from '../src/rendering/online/confiscation-display';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import { toCombatViewState, type CombatViewState } from '../src/presentation/combat-display';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import type { PlayerView, PublicBoard } from '../src/server/protocol';

const emblem = Object.values(EMBLEM_ITEMS).find(item => item.emblemTrait === 'enforcer')!.id;
const empty = { reserved: 0, temporary: [] };
const enforcers = ['maddie', 'loris', 'caitlyn', 'camille', 'steb', 'twistedfate', 'vi'];
const army = (ten = true): PublicBoard => ({ units: [...enforcers, ...(ten ? ['corki', 'ekko', 'powder'] : [])].map((definitionId, index) => ({
  definitionId, starLevel: 1, cell: { col: index % 7, row: 4 + Math.floor(index / 7) }, items: index >= 7 ? [emblem, 'belt'] : [],
})) });
const victim: PublicBoard = { units: [{ definitionId: 'corki', starLevel: 1, cell: { col: 3, row: 4 }, items: ['deathblade', emblem] },
  { definitionId: 'training-dummy', starLevel: 1, cell: { col: 4, row: 4 }, items: ['deathblade'], summon: true }] };
function fixture(left = victim, right = army()) {
  const start = startMatchCombat(createMatch(42));
  if (!start.ok || !start.state.combat) throw Error('fixture combat');
  const base = toCombatViewState(start.state.combat);
  const units = [left, right].flatMap((board, side) => board.units.map((unit, index) => ({ ...base.units[0],
    id: `${side}:${index}`, definitionId: unit.definitionId, starLevel: 1 as const,
    team: side === 0 ? 'player' as const : 'enemy' as const,
    cell: { col: unit.cell.col, row: side === 0 ? unit.cell.row : base.board.rows - 1 - unit.cell.row },
  })));
  const initial: CombatViewState = { ...base, combatId: 'test-confiscation', units };
  const view = { mySeatId: 'me', opponentSeatId: 'other', phase: { kind: 'combat', round: 5 },
    seats: [{ seatId: 'me', publicBoard: left }, { seatId: 'other', publicBoard: right }] } as unknown as PlayerView;
  const display = new ConfiscationDisplay(); display.observe(view); display.capture(initial);
  return { display, initial, view };
}

describe('v26 confiscation presentation', () => {
  it('stamps a victim whose frame has no replacement loadout, retains emblems, and leaves all source data untouched', () => {
    const { display, initial, view } = fixture();
    const before = JSON.stringify({ initial, view });
    expect(display.gear(initial.combatId, '0:0', ['deathblade', emblem], { reserved: 2, temporary: ['belt'] }))
      .toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    expect(display.gear(initial.combatId, '0:0', [emblem], empty).confiscated).toBe(true);
    expect(display.gear(initial.combatId, '0:1', ['deathblade'], empty).confiscated).toBe(false); // non-champion
    expect(display.gear(initial.combatId, '1:0', ['deathblade'], empty).confiscated).toBe(false); // unaffected side
    expect(JSON.stringify({ initial, view })).toBe(before);
  });
  it('does not label lower tiers or missing/legacy public data as confiscation', () => {
    const { display, initial } = fixture(victim, army(false));
    expect(display.gear(initial.combatId, '0:0', ['deathblade'], empty).confiscated).toBe(false);
    const unknown = new ConfiscationDisplay(); unknown.capture(initial);
    expect(unknown.gear(initial.combatId, '0:0', ['deathblade'], empty).equipped).toEqual(['deathblade']);
  });
  it('supports mutual confiscation and latches the stamp when gear arrives during combat', () => {
    const { display, initial } = fixture(army(), army());
    for (const side of [0, 1]) {
      expect(display.gear(initial.combatId, `${side}:0`, [], empty).confiscated).toBe(false);
      expect(display.gear(initial.combatId, `${side}:0`, ['belt'], empty).equipped).toEqual([]);
      expect(display.gear(initial.combatId, `${side}:0`, [], empty).confiscated).toBe(true);
      expect(display.gear(initial.combatId, `${side}:7`, [emblem], empty)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    }
  });
  it('freezes combat formations and clears the notice at a new round', () => {
    const { display, initial, view } = fixture();
    display.observe({ ...view, seats: [] });
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
    display.observe({ ...view, phase: { ...view.phase, round: 6, kind: 'preparation' } });
    expect(display.gear(initial.combatId, '0:0', ['deathblade'], empty).confiscated).toBe(false);
  });
  it('identifies a watched opponent from its unique opening formation', () => {
    const { initial, view } = fixture();
    const display = new ConfiscationDisplay();
    display.observe({ ...view, mySeatId: 'spectator', opponentSeatId: null }); display.capture(initial, 'me');
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
  });
});
