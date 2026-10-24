import { describe, expect, it } from 'vitest';
import { DISPLACEMENT_REASONS, isDisplacement, knockupLift, unitControl, type ViewUnitStatuses } from '../src/presentation/control-display';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { statusIcons } from '../src/presentation/status-icons';

const unit = (id: string, statuses: ViewUnitStatuses['statuses'] = []): ViewUnitStatuses =>
  ({ id, definitionId: 'dummy', team: 'enemy', starLevel: 1, hp: 500, maxHp: 500, mana: 0, maxMana: 50, shield: 0, alive: true, targetId: null, cell: { col: 0, row: 0 }, attackRange: 1, statuses });

describe('stun vs knock-up as drawn', () => {
  it('reads the online view statuses: stunned, and the yellow star icon', () => {
    const stunned = unit('a', [{ kind: 'stun', harmful: true }, { kind: 'stat-buff', harmful: false }]);
    expect(unitControl(null, stunned)).toBe('stun');
    expect(unitControl(null, unit('b'))).toBeNull();
    expect(unitControl(null, { ...stunned, alive: false })).toBeNull();
    expect(unitControl(null, unit('c', [{ kind: 'stun', harmful: true, knockup: true }]))).toBe('airborne');
    expect(statusIcons(null, stunned).map(icon => [icon.kind, icon.harmful, icon.badge])).toEqual([['stun', true, '晕'], ['stat-buff', false, '增']]);
  });

  it('lifts with an ease-out rise, holds, and falls from where it was', () => {
    expect(knockupLift(null, null, 0, 0.2, 0.2)).toBe(0);
    expect(knockupLift(0.1, null, 0, 0.2, 0.2)).toBeCloseTo(0.875);
    expect(knockupLift(1, null, 0, 0.2, 0.2)).toBe(1);
    expect(knockupLift(null, 0, 0.6, 0.2, 0.2)).toBeCloseTo(0.6);
    expect(knockupLift(null, 0.1, 1, 0.2, 0.2)).toBeCloseTo(0.75);
    expect(knockupLift(null, 0.2, 1, 0.2, 0.2)).toBe(0);
  });
});

describe('forced moves as drawn', () => {
  const move = (reason?: string) =>
    ({ type: 'movement', tick: 5, eventSeq: 0, unitId: 'a', from: { col: 1, row: 1 }, to: { col: 2, row: 1 }, ...(reason ? { reason } : {}) }) as unknown as DisplayCombatEvent;
  it('skids the pull, grab and knockback reasons only; walks and dashes stay walks', () => {
    for (const reason of ['mordekaiser-pull', 'sett-grab', 'sevika-knockback']) expect(isDisplacement(move(reason))).toBe(true);
    for (const reason of [undefined, 'ambessa-chain', 'ambessa-fist-retreat']) expect(isDisplacement(move(reason))).toBe(false);
    expect(isDisplacement({ type: 'statusChanged', tick: 5, eventSeq: 0, reason: 'applied', targetId: 'a', kind: 'stun', effectiveMagnitudeBps: 0 } as unknown as DisplayCombatEvent)).toBe(false);
  });
  it('matches the 3D list', async () => {
    const { DISPLACEMENT_REASONS: three } = await import('../src/rendering/three-mode/unit-control');
    expect([...DISPLACEMENT_REASONS].sort()).toEqual([...three].sort());
  });
});
