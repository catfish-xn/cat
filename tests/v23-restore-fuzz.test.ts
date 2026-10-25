import { describe, expect, it } from 'vitest';
import { bytes, declarationWalk, randomWalk, seeded, RestoreProbe } from './fixtures/restore-fuzz';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { ManualClock } from '../src/server/room/clock';
import { createMatch, deployMatchUnit, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';

import { accepted, emptyBoard, reachRound } from './match-helpers';
import { validateMechanisms } from '../src/simulation/m8/restore';
import { validateAbilityStatusFacts } from '../src/simulation/combat-runtime-facts';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';

describe('v23 deterministic legitimate save/restore fuzz', () => {
  it('sampling RNG repeats exactly and does not use the match stream', () => {
    const a = seeded(42), b = seeded(42);
    expect(Array.from({ length: 100 }, () => a(997))).toEqual(Array.from({ length: 100 }, () => b(997)));
  });
  it('detects a continuation RNG divergence rather than silently resynchronizing', () => {
    const state = createMatch(42), probe = new RestoreProbe(42, 'checker');
    probe.checkpoint(state);
    const expected = stepMatch(state);
    expect(() => probe.observe(state, expected, s => {
      const result = stepMatch(s);
      return { ...result, state: { ...result.state, rngState: (result.state.rngState ^ 1) >>> 0 } };
    })).toThrow(/continuation bytes/);
  });
  for (const seed of [1, 7, 42, 2025, 0xffffffff]) {
    it(`three entrances and every continuation byte agree: seed=${seed}`, () => {
      const { probe } = randomWalk(seed, 45, true, 5);
      expect(probe.failures).toEqual([]);
      expect(probe.checkpoints).toBeGreaterThan(1);
      expect(probe.continuations).toBeGreaterThan(0);
      expect(probe.coverage.preparation).toBeGreaterThan(0);
      expect(probe.coverage.combat).toBeGreaterThan(0);
    });
  }
});

const entrances = {
  json: (state: MatchState) => restoreMatch(JSON.stringify(state)),
  object: (state: MatchState) => restoreMatch(state),
  serialized: (state: MatchState) => restoreMatch(serializeMatch(state)),
};
function rejectAbilityForgeries(state: MatchState, restore: (state: MatchState) => MatchState, rejection: string): void {
  const unitIndex = state.combat!.units.findIndex(u => u.statuses?.some(s => s.source.sourceKind === 'ability'
    && s.contributionKeys?.includes(s.key)));
  expect(unitIndex).toBeGreaterThanOrEqual(0);
  const replay = createRestoreCombatReplay(state.combatInputBasis!, state.combat!.strategy!, state.combat!.tick);
  const mutations = [
    (u: NonNullable<MatchState['combat']>['units'][number]) => { Object.assign(u, { statuses: u.statuses!.filter(s => s.source.sourceKind !== 'ability') }); },
    (u: NonNullable<MatchState['combat']>['units'][number]) => { Object.assign(u.mechanismState!, { statuses: u.mechanismState!.statuses.map(g => ({ ...g, contributions: g.contributions.filter(c => c.source.sourceKind !== 'ability') })) }); },
    (u: NonNullable<MatchState['combat']>['units'][number]) => { const s = u.statuses!.find(s => s.source.sourceKind === 'ability')!; Object.assign(s, { amount: s.amount + 1 }); },
    (u: NonNullable<MatchState['combat']>['units'][number]) => { const s = u.statuses!.find(s => s.source.sourceKind === 'ability')!; Object.assign(s, { expiresAtTick: s.expiresAtTick + 1 }); },
    (u: NonNullable<MatchState['combat']>['units'][number]) => {
      const c = u.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.source.sourceKind === 'ability')!;
      Object.assign(c, { source: { ...c.source, effectIndex: c.source.effectIndex + 1 } });
    },
    (u: NonNullable<MatchState['combat']>['units'][number]) => {
      const c = u.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.source.sourceKind === 'ability')!;
      Object.assign(c, { application: { ...c.application, magnitudeBps: c.application.magnitudeBps + 1 } });
    },
    (u: NonNullable<MatchState['combat']>['units'][number]) => {
      const c = u.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.source.sourceKind === 'ability')!;
      Object.assign(c, { appliedAtTick: c.appliedAtTick + 1 });
    },
    (u: NonNullable<MatchState['combat']>['units'][number]) => {
      const c = u.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.source.sourceKind === 'ability')!;
      Object.assign(c, { expiresAtTick: (c.expiresAtTick ?? 1201) + 1 });
    },
    (u: NonNullable<MatchState['combat']>['units'][number]) => {
      const c = u.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.source.sourceKind === 'ability')!;
      const status = u.statuses!.find(s => s.contributionKeys?.includes(c.key))!;
      expect(c.application.modifier?.value.kind).toBe('constant');
      if (c.application.modifier?.value.kind !== 'constant') throw Error('expected constant declaration');
      const amount = c.application.modifier.value.amount - 1;
      Object.assign(c, { application: { ...c.application, modifier: { ...c.application.modifier, value: { kind: 'constant', amount } } } });
      Object.assign(status, { amount });
    },
    (u: NonNullable<MatchState['combat']>['units'][number]) => {
      const c = u.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.source.sourceKind === 'ability')!;
      const status = u.statuses!.find(s => s.contributionKeys?.includes(c.key))!;
      Object.assign(c, { expiresAtTick: (c.expiresAtTick ?? 1201) + 1 });
      Object.assign(status, { expiresAtTick: c.expiresAtTick });
    },
  ];
  for (const mutate of mutations) {
    const forged = structuredClone(state);
    mutate(forged.combat!.units[unitIndex]);
    expect(() => validateAbilityStatusFacts(forged.combat!, replay, (a, b) => bytes(a) === bytes(b)))
      .toThrow('Invalid Match save: ability status binding facts');
    expect(() => restore(forged)).toThrow(rejection);
  }
  expect(restore(state)).toEqual(state);
}

// Current-content public-command witnesses do not depend on epoch fixture identity.
for (const definitionId of ['blitzcrank', 'ekko']) {
  let witness: MatchState | undefined;
  const currentWitness = () => {
    if (witness) return witness;
    let state = emptyBoard(reachRound('2-1', true, 12));
    state = accepted(grantMechanicUnit(state, { receiptId: `restore-${definitionId}`, source: 'test', definitionId }));
    const unit = state.preparation.units.find(u => u.definitionId === definitionId && u.team === 'player')!;
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col: 3, row: 4 } }));
    state = accepted(startMatchCombat(state));
    const hasDeclaration = (s: MatchState) => s.combat!.units.some(u => u.statuses?.some(status =>
      status.source.definitionId === `${definitionId}-ability` && status.contributionKeys?.includes(status.key)));
    while (state.phase === 'combat' && !hasDeclaration(state)) state = stepMatch(state).state;
    expect(hasDeclaration(state)).toBe(true);
    const combat = state.combat!, strategy = combat.strategy!;
    const replay = createRestoreCombatReplay(state.combatInputBasis!, strategy, combat.tick);
    const proven = validateAbilityStatusFacts(combat, replay, (a, b) => bytes(a) === bytes(b));
    // Exercise the structural adapter even when this battle uses full replay admission.
    for (const u of combat.units) if (u.statuses?.some(s => s.source.definitionId === `${definitionId}-ability`))
      validateMechanisms(u, combat.units, combat.tick, combat.combatId!, false, combat.nextActionSeq!, new Set(), false, strategy.traits, proven);
    return witness = state;
  };
  for (const [entry, restore] of Object.entries(entrances)) {
    it(`current-content ${definitionId} ${entry} rejects ability tampering`, () => {
      rejectAbilityForgeries(currentWitness(), restore, 'Invalid Match save: ability status binding facts');
    });
    it(`current-content ${definitionId} ${entry} restores and continues byte-identically through battle end`, () => {
      const state = currentWitness();
      let live = state, restored = restore(state);
      expect(bytes(restored)).toBe(bytes(live));
      // Include refreshes, stacks, expiration and cleanup through the battle end.
      while (live.phase === 'combat') {
        const a = stepMatch(live), b = stepMatch(restored);
        expect(bytes(b)).toBe(bytes(a));
        live = a.state; restored = b.state;
      }
    });
  }
}

// Current-content reductions of the old seed-2036/1039 failures. Each route
// stops immediately before the first identity-key skill declaration is produced;
// no saved state or content identity is transplanted from an old epoch.
for (const [definitionId, oldSeed, reason] of [
  ['blitzcrank', 2036, 'status display identity'],
  ['ekko', 1039, 'status source/timing projection'],
] as const) {
  let predecessor: MatchState | undefined;
  const declarations = (state: MatchState) => state.combat!.units.flatMap(unit =>
    (unit.statuses ?? []).filter(status => status.source.definitionId === `${definitionId}-ability`
      && status.contributionKeys?.includes(status.key)).map(status => ({ unit, status })));
  const currentPredecessor = () => {
    if (predecessor) return predecessor;
    const run = declarationWalk(12, definitionId);
    expect([run.declarationStep, run.state.combat!.tick]).toEqual(definitionId === 'blitzcrank' ? [115, 104] : [109, 98]);
    expect(run.probe.failures).toEqual([]);
    expect(run.probe.checkpoints).toBe(2);
    expect(run.probe.continuations).toBe(3);
    return predecessor = run.previous;
  };
  const assertDeclaration = (state: MatchState) => {
    const rows = declarations(state);
    expect(rows.length).toBeGreaterThan(0);
    for (const { unit, status } of rows) {
      expect(status.source.sourceKind).toBe('ability');
      expect(status.source.effectIndex).toBe(0);
      expect(status.kind).toBe('resistanceFlat');
      expect(status.amount).toBe(definitionId === 'blitzcrank' ? -1000 : -5);
      expect(status.startsAtTick).toBe(state.combat!.tick);
      const contribution = unit.mechanismState!.statuses.flatMap(group => group.contributions)
        .find(c => c.key === status.key)!;
      expect(contribution).toBeDefined();
      expect(contribution.source).toEqual(status.source);
      expect(contribution.targetId).toBe(unit.id);
      expect(contribution.appliedAtTick).toBe(status.startsAtTick);
      // The two original defects: declaration identity and permanent timing projection.
      expect(status.contributionKeys).toEqual([contribution.key]);
      expect(status.expiresAtTick).toBe(definitionId === 'blitzcrank' ? status.startsAtTick + 80 : 1201);
      expect(contribution.expiresAtTick).toBe(definitionId === 'blitzcrank' ? status.expiresAtTick : null);
    }
  };
  it(`public predecessor is accepted and deterministically produces ${definitionId} (old seed=${oldSeed})`, () => {
    const previous = currentPredecessor();
    expect(declarations(previous)).toEqual([]);
    const live = stepMatch(previous);
    expect(live.state.combat!.tick).toBe(previous.combat!.tick + 1);
    assertDeclaration(live.state);
    for (const restore of Object.values(entrances)) expect(stepMatch(restore(previous))).toEqual(live);
  });
  for (const [entry, restore] of Object.entries(entrances)) {
    it(`${entry} accepts legal ${definitionId} declaration (old seed=${oldSeed}, ${reason})`, () => {
      const previous = currentPredecessor();
      expect(declarations(previous)).toEqual([]);
      const state = stepMatch(previous).state;
      assertDeclaration(state);
      const restored = restore(state);
      expect(restored).toEqual(state);
      expect(stepMatch(restored)).toEqual(stepMatch(state));
    });
  }
}

it('real Room seats are explicitly outside the Match save contract (seed=42, step=0)', () => {
  const room = new Room(Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `bot${i}`, kind: 'bot' as const })),
    { ...ROOM_TIMING_DEFAULTS, roomId: 'restore-fuzz-contract', seed: 42, clock: new ManualClock(), resolver: new TwoSidedBattleResolver() });
  try {
    room.start();
    const state = room.state.seats[0].match;
    expect(() => restoreMatch(state)).toThrow('multiplayer-state');
    expect(() => restoreMatch(JSON.stringify(state))).toThrow('multiplayer-state');
    expect(() => serializeMatch(state)).toThrow('multiplayer-state');
  } finally { room.dispose(); }
});
