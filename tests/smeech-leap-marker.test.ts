import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { SMEECH_RELEAP_AFTER_KILL_TICKS, SMEECH_RELEAP_FLIGHT_TICKS, SMEECH_STAB_TICKS } from '../src/simulation/cast-windup';
import { battle, unit } from './combat-helpers';

// Smeech's re-leap marker (11-25, authorization ①, display only): when his target dies and he leaps to the next one, an
// abilityMarker 'smeech-leap-again' names the cell he lands on, in the tick of that leap, so the renderer can play that tick's
// movement as a leap rather than a walk. The cast's own leap and his ordinary walking carry no marker; nothing else changes.
const smeech = (patch: Partial<CombatUnit> = {}): CombatUnit => unit('p', 'player', 1, 3, { definitionId: 'smeech', ability: resolveAbility('smeech-ability', 1),
  hp: 4000, maxHp: 5000, armor: 0, magicResist: 0, mana: 100, maxMana: 100, attackDamage: 100, attackRange: 1, abilityPower: 100, baseAttackSpeedBps: 1,
  cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
const dummy = (id: string, col: number, row: number, hp = 10000): CombatUnit => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2',
  ability: resolveAbility('neutral-attack', 1), hp, maxHp: hp, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
  runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
function run(units: CombatUnit[], count: number) {
  let state = battle(units, { rngState: 42 }); const all: CombatEvent[] = [];
  for (let i = 0; i < count && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; all.push(...r.events); }
  return { state, all };
}
const markers = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'abilityMarker' && e.marker === 'smeech-leap-again');

describe('Smeech re-leap marker', () => {
  it('marks the re-leap tick and the landing cell; that tick\'s movement ends on the same cell', () => {
    const { all } = run([smeech(), dummy('e', 2, 3, 380), dummy('far', 5, 3)], 4 * SMEECH_STAB_TICKS);
    const marked = markers(all);
    expect(marked).toHaveLength(1);
    const m = marked[0]!; if (m.type !== 'abilityMarker') throw Error('marker');
    expect(m.arrivalTick).toBe(m.tick + SMEECH_RELEAP_FLIGHT_TICKS); // 11-25 v2: lands after the flight (was m.tick)
    const leap = all.filter(e => e.type === 'movement' && e.unitId === 'p' && e.tick === m.arrivalTick); // the landing's movement (was m.tick)
    expect(leap).toHaveLength(1);
    expect(leap[0]!.type === 'movement' && leap[0]!.to).toEqual(m.cell);
    const deaths = all.filter(e => e.type === 'death' && e.unitId === 'e').map(e => e.tick);
    expect(m.tick - deaths[0]!).toBe(SMEECH_RELEAP_AFTER_KILL_TICKS); // 11-25 re-leap after a kill (was SMEECH_STAB_TICKS)
  });
  it('no marker for the cast\'s own leap, a target that lives, or no enemy left in range', () => {
    expect(markers(run([smeech(), dummy('e', 4, 3)], 4 * SMEECH_STAB_TICKS).all)).toEqual([]);
    expect(markers(run([smeech(), dummy('e', 2, 3, 380)], 4 * SMEECH_STAB_TICKS).all)).toEqual([]);
  });
});
