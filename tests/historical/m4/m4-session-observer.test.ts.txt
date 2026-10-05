import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/rendering/match-session';
import { createMatch, deployMatchUnit } from '../src/simulation/match';

describe('complete combat observer ledger', () => {
  it('includes tick-zero command hooks, every advance event, and clears at Continue/reset', () => {
    const initial = createMatch(42), deployed = deployMatchUnit(initial, 'unit-1', { kind: 'board', cell: { col: 2, row: 7 } }).state;
    const session = new MatchSession({ ...deployed, augments: [{ definitionId: 'opening-guard', choiceId: 'observer-test', acquiredRound: 1 }] });
    const start = session.start(); if (!start.ok) throw new Error(start.reason);
    const commandEvents = start.events.filter(event => 'tick' in event);
    expect(commandEvents.some(event => event.type === 'effectTriggered' && event.tick === 0)).toBe(true);
    expect(session.combatEvents).toEqual(commandEvents);
    const advances = session.advance(60_000);
    expect(session.combatEvents).toEqual([...commandEvents, ...advances]);
    expect(session.combatEvents.map(event => event.eventSeq)).toEqual(session.combatEvents.map((_, index) => index));
    expect(session.combatEvents.length).toBeGreaterThan(0);
    const detached = session.combatEvents as unknown[]; detached.length = 0;
    expect(session.combatEvents.length).toBeGreaterThan(0);
    session.continue(1); expect(session.combatEvents).toEqual([]);
    session.newMatch(); expect(session.combatEvents).toEqual([]);
  });
  it('captures a tick-zero finished combat without a render frame', () => {
    const session = new MatchSession(), start = session.start(); if (!start.ok) throw new Error(start.reason);
    expect(session.phase).toBe('settlement');
    expect(session.combatEvents).toEqual(start.events.filter(event => 'tick' in event));
    expect(session.combatEvents.some(event => event.type === 'combatFinished')).toBe(true);
    expect(session.advance(60_000)).toEqual([]);
    expect(session.combatEvents).toEqual(start.events.filter(event => 'tick' in event));
  });
});
