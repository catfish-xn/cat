import { describe, expect, it } from 'vitest';
import { createCombatWithEvents, stepCombat, type CombatEvent } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { createHash } from 'node:crypto';

// Jinx, Cassiopeia and Mel already pick a branch from their cast count; the cast receipt now reports it (display output
// only). Amumu never casts, so only the caster's casts are in play. Each case runs a real combat (combat-start hooks applied) and checks every cast against what resolved.
function run(unit: string, star: number, foes: number, foeStar: number, casts: number) {
  const units: any[] = [{ id: 'me', definitionId: unit, team: 'player', starLevel: star, location: { kind: 'board', cell: { col: 3, row: 5 } } },
    ...[[3, 2], [2, 2], [4, 2], [3, 1]].slice(0, foes).map(([col, row], i) =>
      ({ id: `foe${i}`, definitionId: 'amumu', team: 'enemy', starLevel: foeStar, location: { kind: 'board', cell: { col, row } } }))];
  const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
  let { state } = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [],
    augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'branch', 42) as { state: any };
  const out: { castIndex: number; branch?: string; castCount: number; events: readonly CombatEvent[] }[] = [];
  for (let t = 0; t < 1200 && state.status !== 'finished' && out.length < casts; t++) {
    const step = stepCombat(state); state = step.state;
    for (const e of step.events) if (e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId === 'me') {
      const me = state.units.find((u: any) => u.id === 'me');
      out.push({ castIndex: e.receipt.branch?.castIndex ?? -1, branch: e.receipt.branch?.branch, castCount: me.runtime.castCount, events: step.events });
    }
  }
  return out;
}
const MIXED_DIGEST = '00232cbba2af1ffeb56bacfbb66c15edd3abee03b8e7a6d215dc3c0fbf5a447d';
const hitTargets = (events: readonly CombatEvent[]) => new Set(events.flatMap(e => e.type === 'packetDamage'
  && e.outcome.context.source.ownerId === 'me' && e.outcome.context.delivery !== 'basic-attack' ? [e.outcome.context.targetId] : []));

describe('cast branch output for count-driven abilities', () => {
  it('Jinx: zap, chompers, rocket in turn, matching the rule phase', () => {
    const casts = run('jinx', 2, 1, 3, 4);
    expect(casts.length).toBe(4);
    casts.forEach((c, i) => {
      expect(c.castIndex).toBe(i + 1); expect(c.castIndex).toBe(c.castCount);
      expect(c.branch).toBe(['zap', 'chompers', 'rocket'][i % 3]);
    });
  });

  it('Cassiopeia: every third cast splashes, the others are single', () => {
    const casts = run('cassiopeia', 2, 3, 1, 3);
    expect(casts.map(c => c.branch)).toEqual(['single', 'single', 'splash']);
    casts.forEach((c, i) => expect(c.castIndex).toBe(i + 1));
    expect(hitTargets(casts[2].events).size).toBeGreaterThan(hitTargets(casts[0].events).size);
  });

  it('Mel: the third cast spends the stored energy, the others are normal', () => {
    const casts = run('mel', 2, 2, 3, 3);
    expect(casts.map(c => c.branch)).toEqual(['normal', 'normal', 'third']);
    const spent = (events: readonly CombatEvent[]) => events.some(e => (e as any).type === 'melEnergyChanged' && (e as any).after === 0);
    expect(casts.map(c => spent(c.events))).toEqual([false, false, true]);
  });

  it('castIndex: per unit, 1 on its first cast, counts every cast, restarts each combat', () => {
    const board = (units: any[]) => { const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
      return (createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [],
        augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'index', 7) as { state: any }).state; };
    const units = [['a', 'jinx', 2, 5], ['b', 'cassiopeia', 4, 5]].map(([id, definitionId, col, row]) =>
      ({ id, definitionId, team: 'player', starLevel: 2, location: { kind: 'board', cell: { col, row } } }))
      .concat([[3, 2], [2, 2]].map(([col, row], i) => ({ id: `foe${i}`, definitionId: 'amumu', team: 'enemy', starLevel: 3, location: { kind: 'board', cell: { col, row } } }) as any));
    for (let combat = 0; combat < 2; combat++) {
      let state = board(units); const seen: Record<string, number[]> = { a: [], b: [] };
      for (let t = 0; t < 400 && state.status !== 'finished'; t++) {
        const step = stepCombat(state); state = step.state;
        for (const e of step.events) if (e.type === 'cast' && 'receipt' in e) {
          seen[e.receipt.source.ownerId].push(e.receipt.castIndex!);
          expect(e.receipt.castIndex).toBe(state.units.find((u: any) => u.id === e.receipt.source.ownerId).runtime.castCount);
        }
      }
      for (const id of ['a', 'b']) { expect(seen[id].length).toBeGreaterThan(1); expect(seen[id]).toEqual(seen[id].map((_, i) => i + 1)); }
    }
  });

  it('output only: with the two display fields removed, a mixed combat is byte-identical to the pre-change run', () => {
    // Pinned digest of the events and the final state with castIndex/branch stripped. The same script at 0b245f80 (before
    // this change; #623 already there) gives the same digest, so nothing but the two fields moved.
    const units: any[] = [['jinx', 1, 5], ['cassiopeia', 2, 5], ['mel', 3, 5], ['ambessa', 4, 5], ['ekko', 5, 5]]
      .map(([definitionId, col, row], i) => ({ id: `p${i}`, definitionId, team: 'player', starLevel: 2, location: { kind: 'board', cell: { col, row } } }))
      .concat(['garen', 'amumu', 'vi', 'sett'].map((definitionId, i) => ({ id: `e${i}`, definitionId, team: 'enemy', starLevel: 2, location: { kind: 'board', cell: { col: 2 + i, row: 1 } } })));
    const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
    let { state } = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [],
      augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'digest', 1234) as { state: any };
    const log: unknown[] = [];
    for (let t = 0; t < 1200 && state.status !== 'finished'; t++) { const step = stepCombat(state); state = step.state; log.push(...step.events); }
    const strip = (_k: string, v: any) => v && typeof v === 'object' && !Array.isArray(v) && 'actionSeq' in v && 'targetIds' in v
      ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'castIndex' && k !== 'branch')) : v;
    const digest = createHash('sha256').update(JSON.stringify({ log, state }, strip)).digest('hex');
    expect(log.filter((e: any) => e.type === 'cast').length).toBeGreaterThan(5);
    expect(digest).toBe(MIXED_DIGEST);
  });
});
