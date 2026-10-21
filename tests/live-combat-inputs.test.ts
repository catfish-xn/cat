import { describe, expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  proposeSettlement, startCombatReplay, type MatchState, type BattleTickInput } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { CombatStream } from '../src/server/room/combat-stream';
import type { BattleInput } from '../src/server/room/types';

function army(seed: number): MatchState {
  const state = createMatch(seed), round = getCatalogRoundById('2-1');
  return { ...state, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...state.m8, round }, level: 10,
    augments: [{ definitionId: 'geniuses', choiceId: 'geniuses', acquiredRound: 1 }],
    preparation: { ...state.preparation, units: ['akali', 'nocturne', 'ambessa', 'twistedfate', 'zeri', 'scar', 'ekko', 'heimerdinger'].map((id, i) => ({
      id: `unit-${i + 1}`, definitionId: id, team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: i % 7, row: 4 + Math.floor(i / 7) } },
    })) } };
}
function inputs(seed: number) {
  const a = army(seed), b = army(seed + 1), battleId = `traits-stream:${seed}`;
  const input = compileBattle(snapshotForBattle(a, 'a'), snapshotForBattle(b, 'b'), seed, { battleId });
  const envelope: BattleInput = { battleId, roomId: 'traits', round: a.round, roundId: a.roundDefinitionId,
    roundKind: 'pvp', roomRevision: 1, battleSeed: seed, maxSteps: 1201, mirrorOf: null,
    seats: [{ seatId: 'a', state: a }, { seatId: 'b', state: b }] };
  return { input, envelope };
}
const json = (value: unknown) => JSON.stringify(value);

describe('v20-traits live tick determinism and phase-2 input seam', () => {
  it.each([7, 42, 991])('seed %i: Quickstriker/Firelight/teamup bytes match full advance and small slices', seed => {
    const { input, envelope } = inputs(seed), full = resolveTwoSidedBattle(input, 1201);
    for (const traitId of ['quickstriker', 'firelight', 'geniuses'])
      expect(input.strategy.traits.some(t => t.traitId === traitId && t.tier > 0)).toBe(true);
    expect(full.terminal.tick).toBeGreaterThan(120);
    expect(full.terminal.units.some(u => (u.v20Traits?.nextDashTick ?? 0) > 120 && (u.v20Traits?.dashUntilTick ?? 0) >= 140)).toBe(true);
    expect(full.terminal.units.some(u => u.v20Traits?.moveTenths !== undefined)).toBe(true);
    expect(full.events.some(e => e.type === 'movement' && e.tick >= 120)).toBe(true);
    expect(full.events.some(e => e.type === 'packetDamage' && e.outcome.context.source.definitionId === 'geniuses')).toBe(true);
    const fullReplay = startCombatReplay(full).advance(1201)!;
    for (const budget of [1, 2, 7]) {
      const visited: number[] = [];
      const task = startTwoSidedBattle(input, { captureReplay: true, beforeTick: tick => { visited.push(tick); return []; } });
      let result = task.advance(budget);
      while (!result) result = task.advance(budget);
      expect(visited).toEqual(Array.from({ length: full.terminal.tick }, (_, i) => i + 1));
      expect(json(result)).toBe(json(full)); // full terminal, RNG, dash/window state and ordered domain ledger
      expect(json(task.replay())).toBe(json(fullReplay));
      expect(json(proposeSettlement(result))).toBe(json(proposeSettlement(full)));
    }
    const visited: number[] = [], stream = new CombatStream(envelope, undefined, tick => { visited.push(tick); return []; });
    while (!stream.done) stream.advancePvp();
    expect(visited).toHaveLength(full.terminal.tick);
    expect(json(stream.result!.battle)).toBe(json(full));
    const view = stream.view('a')!;
    expect(json({ initial: view.initial, ticks: view.ticks, terminal: view.terminal })).toBe(json(fullReplay));
  }, 60_000);

  it('rejects nonempty input before stepping, does not log a fictitious success, and can retry the same tick', () => {
    const { input } = inputs(42), visited: number[] = [];
    const equipment: BattleTickInput = { kind: 'equipment', seq: 1, effectiveTick: 1, seatId: 'a', itemId: 'item-1', unitId: 'unit-1', slot: 0 };
    let pending: readonly BattleTickInput[] = [equipment];
    const task = startTwoSidedBattle(input, { captureReplay: true, beforeTick: tick => { visited.push(tick); return pending; } });
    expect(() => task.advanceTick()).toThrow('battle-input-unsupported');
    expect(task.replay()).toBeNull();
    pending = [];
    expect(task.advanceTick().frame!.tick).toBe(1);
    expect(visited).toEqual([1, 1]);
    const result = task.advance(1201)!;
    expect(result.inputLog).toBeUndefined();
    expect(json(result)).toBe(json(resolveTwoSidedBattle(input, 1201)));
    for (const inputLog of [[equipment], null, {}]) {
      const forged = { ...result, inputLog } as typeof result;
      expect(() => proposeSettlement(forged)).toThrow('battle-input-unsupported');
      expect(() => startCombatReplay(forged)).toThrow('battle-input-unsupported');
    }
  });
});
