import { describe, expect, it } from 'vitest';
import type { HexCell } from '../src/simulation/board';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { stepCombat, type CombatUnit, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { toCombatViewEvents } from '../src/simulation/combat-replay-view';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit, freeze } from './combat-helpers';

// The cast branch is display output written where the rule picks the branch; these cases check it names the branch
// that actually resolved (chain dashes and strikes, fist slams and stuns) and changes nothing else.
const c = (col: number, row: number): HexCell => ({ col, row });
function ambessa(castCount: number, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: 'ambessa', ability: resolveAbility('ambessa-ability', 1),
    hp: 5000, maxHp: 5000, mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6,
    moveCooldownTicks: 1000, baseAttackSpeedBps: 10000, abilityPower: 100,
    runtime: { ...EMPTY_RUNTIME, castCount }, tasks: [], statuses: [], shieldLayers: [], mechanics: [], ...patch });
}
const dummy = (cell = c(5, 3)): CombatUnit => unit('e', 'enemy', cell.col, cell.row, { definitionId: 'neutral-stage-2',
  ability: resolveAbility('neutral-attack', 1), hp: 10000, maxHp: 10000, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000 });
const step = (units: CombatUnit[]) => stepCombat(freeze(battle(units, { strategy: { traits: [], units: [] }, combatId: 'ambessa-branch', rngState: 42 })));
const casts = (events: readonly CombatEvent[]) => events.flatMap(e => e.type === 'cast' && 'receipt' in e ? [e.receipt] : []);
const stunned = (state: CombatState) => JSON.stringify(state.units.find(u => u.id === 'e')).includes('"stun"');
const dashed = (events: readonly CombatEvent[]) => events.some(e => e.type === 'movement' && e.reason === 'ambessa-chain');

describe('Ambessa cast branch output', () => {
  it.each([[0, 1, 'chain'], [1, 2, 'fist'], [2, 3, 'chain'], [3, 4, 'fist']] as const)('prior casts %i: cast #%i is %s', (prior, index, branch) => {
    const result = step([ambessa(prior), dummy()]);
    const [receipt] = casts(result.events);
    expect(receipt.branch).toEqual({ castIndex: index, branch });
    expect(result.state.units.find(u => u.id === 'p')!.runtime.castCount).toBe(index);
    // The branch named is the one that resolved.
    expect(stunned(result.state)).toBe(branch === 'fist');
    expect(dashed(result.events)).toBe(branch === 'chain');
  });

  it('the field sits only on the cast receipt and consumes no RNG', () => {
    for (const prior of [0, 1]) {
      const result = step([ambessa(prior), dummy()]);
      const strip = (events: readonly CombatEvent[]) => JSON.stringify(events.map(e => e.type === 'cast' && 'receipt' in e
        ? { ...e, receipt: (({ branch: _b, ...rest }) => rest)(e.receipt) } : e));
      expect(casts(result.events)).toHaveLength(1);
      expect(result.state.rngState).toBe(42);
      expect(strip(result.events)).not.toContain('"branch"');
      expect(JSON.stringify(result.events).match(/"branch":\{/g)).toHaveLength(1);
    }
  });

  it('the replay view carries the branch on the cast event; casts without a branch carry none', () => {
    const result = step([ambessa(1), dummy()]);
    const view = toCombatViewEvents(toLedgerEvents(result.events)).find(e => e.type === 'cast');
    expect(view).toMatchObject({ type: 'cast', sourceId: 'p', branch: { castIndex: 2, branch: 'fist' } });
    const plain = step([unit('q', 'player', 1, 3, { mana: 100, maxMana: 100, ability: resolveAbility('neutral-attack', 1) }), dummy()]);
    for (const e of plain.events) if (e.type === 'cast' && 'receipt' in e) expect(e.receipt).not.toHaveProperty('branch');
  });
});
