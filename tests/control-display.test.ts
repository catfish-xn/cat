import { describe, expect, it } from 'vitest';
import { knockupLift, unitControl, type ViewUnitStatuses } from '../src/presentation/control-display';
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
