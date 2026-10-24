import { describe, expect, it } from 'vitest';
import { ControlTracker, KNOCKUP_CASTS, knockupLift, unitStunned, type ViewUnitStatuses } from '../src/presentation/control-display';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { statusIcons } from '../src/presentation/status-icons';

const cast = (tick: number, sourceId: string, targetIds: string[]) =>
  ({ type: 'cast', tick, eventSeq: 0, sourceId, actionSeq: 1, completed: true, actualManaSpent: 0, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } }) as unknown as DisplayCombatEvent;
const stun = (tick: number, targetId: string, reason = 'applied') =>
  ({ type: 'statusChanged', tick, eventSeq: 0, reason, targetId, kind: 'stun', effectiveMagnitudeBps: 0 }) as unknown as DisplayCombatEvent;
const definitions: Record<string, string> = { violet: 'violet', vi: 'vi', viktor: 'viktor', jayce: 'jayce', sett: 'sett' };
const tracker = () => new ControlTracker(id => definitions[id] ?? 'dummy');
const unit = (id: string, statuses: ViewUnitStatuses['statuses'] = []): ViewUnitStatuses =>
  ({ id, definitionId: 'dummy', team: 'enemy', starLevel: 1, hp: 500, maxHp: 500, mana: 0, maxMana: 50, shield: 0, alive: true, targetId: null, cell: { col: 0, row: 0 }, attackRange: 1, statuses });

describe('stun vs knock-up as drawn', () => {
  it('draws a knock-up for the stuns of a knock-up cast on the same tick, a plain stun otherwise', () => {
    const t = tracker();
    t.observe([cast(10, 'violet', ['a']), stun(10, 'a'), cast(12, 'sett', ['b']), stun(12, 'b')]);
    expect(t.control('a', true)).toBe('airborne');
    expect(t.control('b', true)).toBe('stun');
    expect(t.control('c', false)).toBeNull();
  });

  it("keeps another unit's stun on the same tick a stun", () => {
    const t = tracker();
    t.observe([cast(10, 'violet', ['a']), stun(10, 'a'), stun(10, 'b')]);
    expect([t.control('a', true), t.control('b', true)]).toEqual(['airborne', 'stun']);
  });

  it('蔚: the slammed target is stunned, the rest of its row knocked up', () => {
    const t = tracker();
    t.observe([cast(5, 'vi', ['a', 'b', 'c']), stun(5, 'a'), stun(5, 'b'), stun(5, 'c')]);
    expect([t.control('a', true), t.control('b', true), t.control('c', true)]).toEqual(['stun', 'airborne', 'airborne']);
  });

  it('matches a cast and its stuns split over two batches, and forgets ticks long gone', () => {
    const t = tracker();
    t.observe([cast(7, 'viktor', ['a', 'b'])]);
    t.observe([stun(7, 'a'), stun(7, 'b')]);
    expect(t.control('a', true)).toBe('airborne');
    t.observe([stun(30, 'z')]);
    t.observe([stun(7, 'c')]); // tick 7's cast is no longer on hand
    expect(t.control('c', true)).toBe('stun');
  });

  it('ends a knock-up with its stun, lets a plain stun take over, and resets', () => {
    const t = tracker();
    t.observe([cast(1, 'jayce', ['a']), stun(1, 'a')]);
    expect(t.control('a', true)).toBe('airborne');
    expect(t.control('a', false)).toBeNull();
    expect(t.control('a', true)).toBe('stun'); // the knock-up is over: a later stun without a cast is a stun
    t.observe([cast(3, 'violet', ['a']), stun(3, 'a'), stun(4, 'a', 'refreshed')]);
    expect(t.control('a', true)).toBe('stun');
    t.observe([cast(9, 'violet', ['a']), stun(9, 'a')]);
    t.reset();
    expect(t.control('a', true)).toBe('stun');
  });

  it('lists only champions whose stun the ability text calls a knock-up', () => {
    expect(Object.keys(KNOCKUP_CASTS).sort()).toEqual(['jayce', 'vi', 'viktor', 'violet']);
  });

  it('reads the online view statuses: stunned, and the yellow star icon', () => {
    const stunned = unit('a', [{ kind: 'stun', harmful: true }, { kind: 'stat-buff', harmful: false }]);
    expect(unitStunned(null, stunned)).toBe(true);
    expect(unitStunned(null, unit('b'))).toBe(false);
    expect(unitStunned(null, { ...stunned, alive: false })).toBe(false);
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
