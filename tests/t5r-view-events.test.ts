import { describe, expect, it } from 'vitest';
import { toCombatViewEvents, type LedgerCombatEvent, type CombatViewEvent } from '../src/server-entry';
import { asDisplayEvents, toDisplayEvents } from '../src/presentation/combat-display';
import { freeze } from './combat-helpers';

const movement: LedgerCombatEvent = { domain: 'combat', combatId: 'test', eventSeq: 4, tick: 0,
  type: 'movement', unitId: 'wolf', from: { col: 1, row: 2 }, to: { col: 3, row: 6 } };
const effect: LedgerCombatEvent = { domain: 'combat', combatId: 'test', eventSeq: 5, tick: 1,
  type: 'effectTriggered', effectKey: 'private-program', targetId: 'wolf',
  source: { ownerId: 'wolf', sourceKind: 'item', sourceDefinitionId: 'shojin', sourceInstanceId: 'item-1', effectIndex: 0 },
  action: { kind: 'gainMana', amount: 5 } };
const attack: LedgerCombatEvent = { domain: 'combat', combatId: 'test', eventSeq: 6, tick: 1,
  type: 'attack', attackerId: 'wolf', targetId: 'enemy' };

describe('SR-C6-01 shared animation whitelist', () => {
  it('projects only whitelisted fields, detaches cells and preserves tick0/sequence gaps without mutating input', () => {
    const events = freeze([Object.assign(structuredClone(movement), { futurePlan: 'DO_NOT_SEND',
      from: { col: 1, row: 2, rngState: 'DO_NOT_SEND' } }), effect, attack]);
    const before = JSON.stringify(events), views = toCombatViewEvents(events);
    expect(views).toEqual([
      { type: 'movement', tick: 0, eventSeq: 4, unitId: 'wolf', from: { col: 1, row: 2 }, to: { col: 3, row: 6 } },
      { type: 'attack', tick: 1, eventSeq: 6, attackerId: 'wolf', targetId: 'enemy' },
    ]);
    const moved = views.find(e => e.type === 'movement')!, original = events.find(e => e.type === 'movement')!;
    expect(moved.from).not.toBe(original.from);expect(moved.to).not.toBe(original.to);
    expect(JSON.stringify(views)).not.toContain('DO_NOT_SEND');expect(JSON.stringify(events)).toBe(before);
    expect(toCombatViewEvents([])).toEqual([]);expect(toCombatViewEvents([effect])).toEqual([]);
  });
  it('client retains only the offline effect label in its original position', () => {
    const events = freeze([movement, effect, attack]), local = toDisplayEvents(events);
    expect(local.map(e => e.type)).toEqual(['movement', 'effectTriggered', 'attack']);
    expect(local[1]).toEqual({ type: 'effectTriggered', tick: 1, eventSeq: 5, ownerId: 'wolf',
      sourceKind: 'item', sourceDefinitionId: 'shojin', targetId: 'wolf' });
    expect(local.filter(e => e.type !== 'effectTriggered')).toEqual(toCombatViewEvents(events));
    expect(JSON.stringify(local)).not.toMatch(/private-program|sourceInstanceId|gainMana/);
  });
  it('mixed display streams project ledger events and pass existing view events through once', () => {
    const update: CombatViewEvent = { type: 'unitUpdated', unitId: 'wolf', changes: { hp: 17 } };
    const wire = toCombatViewEvents([attack])[0];
    const displayed = asDisplayEvents([movement, effect, update, wire]);
    expect(displayed).toEqual([...toDisplayEvents([movement, effect]), update, wire]);
    expect(displayed[2]).toBe(update);expect(displayed[3]).toBe(wire);
  });
});
