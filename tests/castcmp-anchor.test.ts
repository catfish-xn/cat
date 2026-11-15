import { describe, expect, it } from 'vitest';
import { CAST_ANCHOR, anchorMatches, auditWindow, parseAnchor, realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// castcmp --anchor: a real recording's window can be about a basic attack hit or a display event of `me`, so a unit that
// never casts (Amumu: no active; Zeri: an empowered attack, no cast) still gets a window.
describe('castcmp real-combat window anchors', () => {
  it('parses cast (the default), attack-hit and event:<type>, and refuses anything else', () => {
    expect(parseAnchor(undefined)).toEqual(CAST_ANCHOR);
    expect(parseAnchor('cast')).toEqual(CAST_ANCHOR);
    expect(parseAnchor('attack-hit')).toEqual({ kind: 'attack-hit' });
    expect(parseAnchor('event:packetDamage')).toEqual({ kind: 'event', type: 'packetDamage' });
    for (const bad of ['', 'attack', 'event:', 'event:9x', 'event:a b']) expect(parseAnchor(bad), bad).toBeNull();
  });

  it('matches only me: its cast, its landed basic-attack packet, an event it sends or is the subject of', () => {
    const hit = { type: 'packetDamage', sourceId: 'me', targetId: 'foe', delivery: 'basic-attack', hit: true };
    expect(anchorMatches(CAST_ANCHOR, { type: 'cast', sourceId: 'me' })).toBe(true);
    expect(anchorMatches(CAST_ANCHOR, { type: 'cast', sourceId: 'foe' })).toBe(false);
    expect(anchorMatches({ kind: 'attack-hit' }, hit)).toBe(true);
    expect(anchorMatches({ kind: 'attack-hit' }, { ...hit, hit: false })).toBe(false);
    expect(anchorMatches({ kind: 'attack-hit' }, { ...hit, delivery: 'ability-direct' })).toBe(false);
    expect(anchorMatches({ kind: 'attack-hit' }, { ...hit, sourceId: 'foe' })).toBe(false);
    expect(anchorMatches({ kind: 'event', type: 'packetDamage' }, { ...hit, delivery: 'ability-direct' })).toBe(true);
    expect(anchorMatches({ kind: 'event', type: 'attack' }, { type: 'attack', attackerId: 'me' })).toBe(true);
    expect(anchorMatches({ kind: 'event', type: 'death' }, { type: 'death', unitId: 'foe' })).toBe(false);
  });

  it('a unit that never casts finds no cast window but an attack-hit one, with that hit inside the window and its target', () => {
    const units = realUnits({ unit: 'zeri', star: 1, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 2 });
    const byCast = runRealCombat(units, 20, () => {});
    expect(byCast.castIndex).toBe(-1);
    const events: any[][] = [], alive: Record<string, boolean>[] = [];
    const run = runRealCombat(units, 60, (state, shown) => { events.push(shown); alive.push(Object.fromEntries(state.units.map((u: any) => [u.id, !!u.alive]))); },
      3, { kind: 'attack-hit' });
    expect(run.castIndex).toBeGreaterThan(0);
    const hits = events.flat().filter(e => anchorMatches({ kind: 'attack-hit' }, e));
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(events[run.castIndex]!.some(e => anchorMatches({ kind: 'attack-hit' }, e))).toBe(true);
    const audit = auditWindow(events, alive, run.castIndex, 3000, 10, { kind: 'attack-hit' });
    expect(audit.anchorInWindow).toBe(true);
    expect(audit.targets.every(id => id.startsWith('foe'))).toBe(true);
    expect(audit.targets.length).toBe(1);
  });

  it('N counts ticks, not events: a pulse striking both foes in one tick counts once', () => {
    const units = realUnits({ unit: 'amumu', star: 1, form: null, foe: 'amumu', dist: 2, nfoes: 2, foestar: 2 });
    const anchor = { kind: 'event', type: 'packetDamage' } as const, ticks: number[] = [];
    const perTick: number[] = [];
    const run = runRealCombat(units, 5, (_state, shown) => { const n = shown.filter(e => anchorMatches(anchor, e)).length; perTick.push(n); if (n) ticks.push(perTick.length - 1); }, 4, anchor);
    expect(perTick.slice(0, run.castIndex + 1).some(n => n > 1)).toBe(true);
    expect(run.castIndex).toBe(ticks[3]);
  });

  it('an anchor that never happened is not in the window', () => {
    expect(auditWindow([[], []], [{}, {}], 1, 1000, 1, { kind: 'attack-hit' }).anchorInWindow).toBe(false);
  });
});
