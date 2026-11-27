import { describe, expect, it } from 'vitest';
import { createCombatWithEvents, stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { toCombatViewEvents } from '../src/simulation/combat-replay-view';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { packets } from './helpers/replay2-views';

// Display only (11-21, authorization ①): an attack, and a ranged attack's launch, say whether the shot crits. The crit is rolled
// on the attack tick, as before; until now only the packet on landing carried it.
function battle(crit?: number): { out: { tick: number; events: readonly CombatEvent[] }[] } {
  const ids = ['caitlyn', 'jinx', 'ezreal', 'garen', 'darius', 'vi'];
  const units: any[] = ids.map((definitionId, i) => ({ id: `p${i}`, definitionId, team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: i, row: i < 3 ? 7 : 5 } } }))
    .concat(['leona', 'sett', 'zeri', 'maddie', 'corki', 'tristana'].map((definitionId, i) => ({ id: `e${i}`, definitionId, team: 'enemy', starLevel: 2, location: { kind: 'board', cell: { col: i, row: i < 3 ? 2 : 0 } } })));
  const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
  let { state } = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [], augments: [], persistentGrowth: [], augmentProgress: [] } as any), 'crit-field', 11) as { state: CombatState };
  if (crit !== undefined) state = { ...state, units: state.units.map(u => ({ ...u, baseCritChanceBps: crit })) } as CombatState;
  const out: { tick: number; events: readonly CombatEvent[] }[] = [];
  for (let i = 0; i < 400 && state.status === 'running'; i++) { const r = stepCombat(state); state = r.state; out.push({ tick: r.state.tick, events: r.events }); }
  return { out };
}
const basicHits = (out: { tick: number; events: readonly CombatEvent[] }[]) => out.flatMap(s => packets(s.events).filter(p => p.source.sourceKind === 'attack').map(p => ({ tick: s.tick, attacker: p.source.ownerId, target: p.unitId, critical: p.critical })));
describe('attack critical (display only)', () => {
  it("every ranged launch says what its shot's landing packet shows; every attack says what its first packet on the target shows", () => {
    const { out } = battle(), hits = basicHits(out);
    const launches = out.flatMap(s => s.events.filter(e => e.type === 'attackLaunched') as any[]);
    expect(launches.length).toBeGreaterThan(20);
    let checked = 0, crits = 0;
    for (const l of launches) {
      const landed = hits.find(h => h.attacker === l.attackerId && h.target === l.targetId && h.tick === l.arrivalTick);
      if (!landed) continue; // the target died or moved out of the shot first
      expect(typeof l.critical).toBe('boolean');
      expect(l.critical, `${l.attackerId}@${l.tick}`).toBe(landed.critical); checked++; if (l.critical) crits++;
    }
    expect(checked).toBeGreaterThan(20);
    expect(crits).toBeGreaterThan(0);
    const attacks = out.flatMap(s => s.events.filter(e => e.type === 'attack').map(e => ({ tick: s.tick, ...(e as any) })));
    expect(attacks.every(a => typeof a.critical === 'boolean')).toBe(true);
  });
  it('always true with a certain crit, always false with none; the replay view keeps the field', () => {
    for (const [chance, want] of [[10000, true], [0, false]] as const) {
      const { out } = battle(chance);
      const shown = out.flatMap(s => s.events.filter(e => e.type === 'attackLaunched' || e.type === 'attack') as any[]);
      expect(shown.length).toBeGreaterThan(10);
      // A shot that carries no basic-attack packet to its target (only an on-hit effect) has nothing to crit: false.
      // Ranged attack wind-up (#791): a shot whose target died in flight (its attackLanded says hit false) still carried its rolled
      // packet, so it counts as carrying ...
      const missed = out.flatMap(s => s.events.filter(e => e.type === 'attackLanded' && !(e as any).hit) as any[]);
      const hits = basicHits(out), carries = (e: any) => e.type === 'attack' || hits.some(h => h.attacker === e.attackerId && h.target === e.targetId && h.tick === e.arrivalTick)
        || missed.some(m => m.attackerId === e.attackerId && m.targetId === e.targetId && m.tick === e.arrivalTick)
        // ... and so did a shot still in flight when the fight ended.
        || e.arrivalTick > out.at(-1)!.tick;
      expect(new Set(shown.filter(carries).map(e => e.critical))).toEqual(new Set([want]));
      expect(shown.filter(e => !carries(e)).every(e => e.critical === false)).toBe(true);
      const view = toCombatViewEvents(toLedgerEvents(out.flatMap(s => s.events))).filter((e: any) => e.type === 'attackLaunched' || e.type === 'attack') as any[];
      expect(view.length).toBe(shown.length);
      expect(view.map(e => e.critical)).toEqual(shown.map(e => e.critical));
    }
  });
});
