import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatUnit, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { readUnitStatusRows } from '../src/presentation/combat-status';
import { unitControl } from '../src/presentation/control-display';
import { toCombatViewState } from '../src/simulation/combat-replay-view';
import { battle, unit } from './combat-helpers';

function hero(name: string): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: name, ability: resolveAbility(name + '-ability', 1), hp: 4000, maxHp: 5000, armor: 0, magicResist: 0, mana: 100, maxMana: 100,
    attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] });
}
function dummy(id: string, col: number): CombatUnit {
  return unit(id, 'enemy', col, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0,
    cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
}
/** Per stunned unit: whether the stun the cast applied is marked as a knock-up. */
function stunsOf(name: string) {
  const { state, events } = stepCombat(battle([hero(name), dummy('e', 2), dummy('f', 3)], { rngState: 42 }));
  const applied = events.filter((e): e is Extract<CombatEvent, { type: 'statusChanged' }> => e.type === 'statusChanged' && e.reason === 'applied' && e.group.kind === 'stun');
  return { state, marks: Object.fromEntries(applied.map(e => [e.group.targetId, e.group.contributions.some(c => c.application.knockup === true)])) };
}

describe('knock-up stuns carry the rules mark', () => {
  it('维奥莱特 knocks up her target', () => expect(stunsOf('violet').marks).toEqual({ e: true }));
  it('蔚 stuns the slammed target and knocks up the rest of its row', () => expect(stunsOf('vi').marks).toEqual({ e: false, f: true }));
  it('杰斯锤形态 knocks its target into the gate', () => expect(stunsOf('jayce').marks).toEqual({ e: true }));
  it('维克托 knocks up every enemy', () => expect(stunsOf('viktor').marks).toEqual({ e: true, f: true }));
  it('瑟提 stuns without a knock-up', () => expect(Object.values(stunsOf('sett').marks)).toEqual([false, false]));

  it('the status rows and the drawn control read the mark once it takes effect', () => {
    let { state } = stunsOf('vi');
    expect(readUnitStatusRows(state, 'f').find(row => row.kind === 'stun')?.knockup).toBe(true);
    expect(readUnitStatusRows(state, 'e').find(row => row.kind === 'stun')?.knockup).toBeUndefined();
    state = stepCombat(state).state;
    const view = (id: string) => state.units.find(u => u.id === id)!;
    expect([unitControl(state, view('e')), unitControl(state, view('f')), unitControl(state, view('p'))]).toEqual(['stun', 'airborne', null]);
    const online = toCombatViewState(state).units;
    expect(online.find(u => u.id === 'f')!.statuses).toContainEqual({ kind: 'stun', harmful: true, knockup: true });
    expect(online.find(u => u.id === 'e')!.statuses).toContainEqual({ kind: 'stun', harmful: true });
    expect(Object.fromEntries(online.map(u => [u.id, unitControl(null, u)]))).toEqual({ e: 'stun', f: 'airborne', p: null });
  });

  it('online: the replay view statuses carry the mark', () => {
    const view = (statuses: { kind: string; harmful: boolean; knockup?: true }[]) =>
      ({ id: 'a', definitionId: 'dummy', team: 'enemy', starLevel: 1, hp: 1, maxHp: 1, mana: 0, maxMana: 1, shield: 0, alive: true, targetId: null, cell: { col: 0, row: 0 }, attackRange: 1, statuses }) as const;
    expect(unitControl(null, view([{ kind: 'stun', harmful: true, knockup: true }]))).toBe('airborne');
    expect(unitControl(null, view([{ kind: 'stun', harmful: true }]))).toBe('stun');
    expect(unitControl(null, view([{ kind: 'stat-buff', harmful: false }]))).toBeNull();
    expect(unitControl(null, { ...view([{ kind: 'stun', harmful: true, knockup: true }]), alive: false })).toBeNull();
  });
});
