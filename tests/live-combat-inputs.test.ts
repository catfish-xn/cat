import { describe, expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  proposeSettlement, startCombatReplay, type MatchState, type BattleTickInput } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { CombatStream } from '../src/server/room/combat-stream';
import type { BattleInput } from '../src/server/room/types';
import { createG23Progress, replayG23Economy, validateG23Progress } from '../src/simulation/g2-3-match-progress';
import { advanceG23Economy, decideG23Market, type G23BattleFacts } from '../src/simulation/g2-3-economy';

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

describe('v20-black-market live tick determinism and phase-2 input seam', () => {
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

  it.each([9, 42, 991])('seed %i: Chem-Baron battle, N-of-three rewards, keep and economy RNG match full resolution bytes', seed => {
    const chemArmy = (value: number, starLevel: 1 | 3): MatchState => {
      const base = army(value);
      return { ...base, augments: [], preparation: { ...base.preparation,
        units: ['singed', 'renata', 'renni', 'smeech', 'silco', 'sevika'].map((definitionId, i) => ({
          id: `unit-${i + 1}`, definitionId, team: 'player', starLevel,
          location: { kind: 'board', cell: { col: i, row: 4 } },
        })) } };
    };
    const a = chemArmy(seed, 1), b = chemArmy(seed + 1, 3), battleId = `chem-stream:${seed}`;
    const input = compileBattle(snapshotForBattle(a, 'a'), snapshotForBattle(b, 'b'), seed, { battleId });
    expect(input.strategy.traits.some(t => t.traitId === 'chem-baron' && t.tier === 6)).toBe(true);
    const full = resolveTwoSidedBattle(input, 1201), envelope: BattleInput = {
      battleId, roomId: 'chem', round: a.round, roundId: a.roundDefinitionId, roundKind: 'pvp', roomRevision: 1,
      battleSeed: seed, maxSteps: 1201, mirrorOf: null, seats: [{ seatId: 'a', state: a }, { seatId: 'b', state: b }],
    };
    const stream = new CombatStream(envelope);
    while (!stream.done) stream.advancePvp();
    expect(json(stream.result!.battle)).toBe(json(full));
    const oldProposals = Object.values(proposeSettlement(full)), liveProposals = Object.values(proposeSettlement(stream.result!.battle));
    expect(json(liveProposals)).toBe(json(oldProposals));
    let prefix = createG23Progress(seed);
    for (let round = 1; round <= 3; round++) {
      const facts: G23BattleFacts = { battleId: `prefix:${round}`, round, roundKind: 'pvp', result: 'loss',
        conquerorTier: 0, conquestTakedowns: [], chemBaronTier: 7, alliedDeaths: 0, rumbleStar: 0, highRollerGold: 0 };
      prefix = advanceG23Economy(prefix, facts).progress;
    }
    prefix = decideG23Market(prefix, prefix.chem.offer!.id, false, 3);
    let offers = 0;
    for (let i = 0; i < oldProposals.length; i++) {
      const old = advanceG23Economy(prefix, oldProposals[i].g23Facts!).progress;
      const live = advanceG23Economy(prefix, liveProposals[i].g23Facts!).progress;
      expect(json(live)).toBe(json(old));
      const offer = old.chem.offer;
      if (!offer) continue;
      offers++;
      expect(offer.optionIds).toHaveLength(1);
      expect(new Set(offer.optionIds).size).toBe(1);
      for (const optionId of offer.optionIds) {
        const selected = decideG23Market(live, offer.id, true, a.round, optionId);
        expect(json(selected)).toBe(json(decideG23Market(old, offer.id, true, a.round, optionId)));
        expect(json(replayG23Economy(seed, selected.economyReceipts))).toBe(json(selected));
        validateG23Progress(selected, seed, a.round);
        expect(selected.chem.shimmer).toBe(0);
        expect(selected.rewards.at(-1)!.id).toBe(offer.id);
      }
      const kept = decideG23Market(live, offer.id, false, a.round);
      expect(json(kept)).toBe(json(decideG23Market(old, offer.id, false, a.round)));
      expect(kept.chem.shimmer).toBe(old.chem.shimmer);
      expect([kept.rngState, kept.rngDraws]).toEqual([old.rngState, old.rngDraws]);
      validateG23Progress(kept, seed, a.round);
    }
    expect(offers, json({prefix: prefix.chem, facts: oldProposals.map(p => p.g23Facts)})).toBeGreaterThan(0);
  }, 60_000);

  it('rejects unauthenticated input before stepping, does not log a fictitious success, and can retry the same tick', () => {
    const { input } = inputs(42), visited: number[] = [];
    const equipment: BattleTickInput = { kind: 'equipment', seq: 1, effectiveTick: 1, seatId: 'a', itemId: 'item-1', unitId: 'unit-1', slot: 0 };
    let pending: readonly BattleTickInput[] = [equipment];
    const task = startTwoSidedBattle(input, { captureReplay: true, beforeTick: tick => { visited.push(tick); return pending; } });
    expect(() => task.advanceTick()).toThrow('battle-input-invalid');
    expect(task.replay()).toBeNull();
    pending = [];
    expect(task.advanceTick().frame!.tick).toBe(1);
    expect(visited).toEqual([1, 1]);
    const result = task.advance(1201)!;
    expect(result.inputLog).toBeUndefined();
    expect(json(result)).toBe(json(resolveTwoSidedBattle(input, 1201)));
    for (const inputLog of [[equipment], null, {}]) {
      const forged = { ...result, inputLog } as typeof result;
      expect(() => proposeSettlement(forged)).toThrow('battle-input-invalid');
      expect(() => startCombatReplay(forged)).toThrow('battle-input-invalid');
    }
  });
});
