import { describe, expect, it } from 'vitest';
import { createCombat } from '../src/simulation/combat';
import type { CombatState } from '../src/simulation/combat-types';
import { lootPlan, COMPONENTS } from './fixtures/m5/oracle.g2.cjs';
import { createMatch, type MatchState } from '../src/simulation/match';
import { prepareMatchLoot, revealMatchLoot, grantDirectLoot, grantLootChoice, unresolvedLootChoices, hasPendingLootCapacity } from '../src/simulation/loot-runtime';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { getCatalogRoundByOrdinal } from '../src/simulation/round-selectors';
import { appendResourceProvenance, RESOURCE_PROVENANCE_VERSION } from '../src/simulation/resource-provenance';
import type { Unit } from '../src/simulation/unit-types';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

// Pure runtime vectors intentionally isolate the award transaction from Match phase/settlement.
// The integration suite separately exercises real ticks, commands, economy and restoration.
const key = (round: string) => JSON.stringify(['s13-orbs-project-v16', round, 'components-granted']);
function fixture(round = 1, seed = 5): MatchState {
  const base = createMatch(seed), definition = getCatalogRoundByOrdinal(round), enemies = createRoundEnemies(round);
  return { ...base, round, roundDefinitionId: definition.roundId, phase: 'preparation', combat: null, combatInputBasis: null,
    m8: { ...base.m8, round: definition, loot: prepareMatchLoot(seed, round), preparation: { ...base.m8.preparation,
      roundId: definition.roundId, encounterId: definition.encounterId, enemies } },
    preparation: { ...base.preparation, units: [...base.preparation.units.filter(unit => unit.team === 'player'), ...enemies] },
    resourceProvenance: appendResourceProvenance({ version: RESOURCE_PROVENANCE_VERSION, entries: [] }, '1-2',
      { kind: 'unit-acquired', unitId: 'unit-1', source: { kind: 'opening', seed, seatId: 'solo' } }),
  };
}
const plan = (state: MatchState) => state.m8.loot.frozen.rounds.find(value => value.encounterPlan.roundId === state.roundDefinitionId)!;
function observed(state: MatchState, killed?: readonly string[], finished = true): MatchState {
  const ids = killed ?? [...new Set([...plan(state).encounterPlan.drops, ...plan(state).choices].map(value => value.sourceUnitId!))];
  const initial = createCombat(state.preparation);
  const common = { ...initial, combatId: `round-${state.round}`, nextEventSeq: 30, tick: 5,
    units: initial.units.map(unit => ids.includes(unit.id) ? { ...unit, alive: false, hp: 0 } : unit),
    neutralReceipts: { deaths: ids.map((unitId, index) => ({ unitId, tick: 4, eventSeq: 7 + index })), controls: [] } };
  const combat: CombatState = { ...common, status: finished ? 'finished' : 'running', result: finished ? 'draw' : null };
  const revealed = revealMatchLoot(state, combat).state;
  return finished ? { ...revealed, phase: 'settlement', combat: { ...combat, status: 'finished', result: 'draw' } }
    : { ...revealed, phase: 'combat', combat: { ...combat, status: 'running', result: null } };
}
function fillBench(state: MatchState): MatchState {
  return { ...state, nextUnitSerial: 20, preparation: { ...state.preparation, units: [...state.preparation.units,
    ...Array.from({ length: 9 }, (_, slot): Unit => ({ id: `unit-${slot + 2}`, definitionId: 'irelia', team: 'player', starLevel: 3,
      location: { kind: 'bench', slot } }))] } };
}

describe('B8 real loot preparation and earned-only transitions', () => {
  it('initializes all eight counters, preserves frozen authority, and appends each preparation exactly once', () => {
    const first = prepareMatchLoot(5, 1);
    expect(first.guaranteeCounters).toEqual(Object.fromEntries(['1-2', '1-3', '1-4', '2-7', '3-7', '4-7', '5-7', '6-7'].map(id => [key(id), 0])));
    expect(prepareMatchLoot(5, 1, first)).toBe(first);
    const second = prepareMatchLoot(5, 2, first);
    expect(second.direct).toHaveLength(5); expect(second.choiceEligibility).toHaveLength(0);
    expect(second.frozen.rounds[0]).toBe(first.frozen.rounds[0]);
    // Independently calculated: ((5 XOR 3735928559) * 1664525 + 1013904223) mod 2^32.
    expect(second.frozen.rng).toEqual(lootPlan(5,2).rng);
    expect(() => prepareMatchLoot(6, 2, first)).toThrow();
    expect(() => prepareMatchLoot(5, 1, second)).toThrow();
  });

  it('reveals all earned source slots from formal deaths without resources, IDs, RNG or phase changes', () => {
    const state = fixture(10), source = plan(state).encounterPlan.drops[0].sourceUnitId!;
    const running = observed(state, [source], false);
    expect(running.m8.loot.direct.filter(value => value.status === 'revealed')).toHaveLength(plan(state).encounterPlan.drops.length);
    expect(running.m8.loot.choiceEligibility).toEqual([]);
    expect(running.m8.loot.earnedEvidence.map(value=>value.death)).toEqual(plan(state).encounterPlan.drops.map(()=>({combatId:'round-10',tick:4,eventSeq:7})));
    for (const field of ['items', 'preparation', 'gold', 'nextItemSerial', 'nextUnitSerial', 'resourceProvenance', 'rngState', 'equipmentState'] as const) expect(running[field]).toEqual(state[field]);
    expect(running.m8.loot.frozen).toBe(state.m8.loot.frozen);
    const again = revealMatchLoot(running, running.combat!); expect(again.state).toBe(running); expect(again.events).toEqual([]);
    expect(() => grantDirectLoot(running, false)).toThrow('before combat finish');
    const finished = { ...running.combat!, status: 'finished' as const, result: 'enemyWin' as const };
    const forfeited = revealMatchLoot(running, finished);
    expect(forfeited.events).toEqual([]);
    expect(forfeited.state.m8.loot.choiceEligibility).toEqual([]);
    expect(forfeited.state.m8.loot.earnedEvidence).toEqual(running.m8.loot.earnedEvidence);
  });

  it('forfeits unearned slots, ignores no-loot monsters and rejects forged observation inputs', () => {
    const state = fixture(), noLoot = state.m8.preparation.enemies.find(unit => !plan(state).encounterPlan.drops.some(drop => drop.sourceUnitId === unit.id))!;
    const running = observed(state, [noLoot.id], false);
    expect(running.m8.loot.direct[0].status).toBe('planned'); expect(running.m8.loot.earnedEvidence).toEqual([]);
    const finished = observed(state, [noLoot.id]); expect(finished.m8.loot.direct[0].status).toBe('forfeited');
    expect(grantDirectLoot(finished, false).state).toBe(finished);
    const earned = observed(state);
    expect(() => revealMatchLoot(state, { ...earned.combat!, combatId: 'round-2' })).toThrow();
    const death = earned.combat!.neutralReceipts!.deaths[0];
    for (const deaths of [[death, death], [{ ...death, tick: 6 }], [{ ...death, eventSeq: 30 }]]) {
      expect(() => revealMatchLoot(state, { ...earned.combat!, neutralReceipts: { deaths, controls: [] } })).toThrow();
    }
  });
});

describe('B8 atomic direct awards, capacity and actual purchase lineage', () => {
  it('grants the real opening hero once, recording the candidate birth and unique receipt', () => {
    const state = observed(fixture()), { state: granted, events, upgradeEvents } = grantDirectLoot(state, false);
    expect(granted.preparation.units.find(unit => unit.id === 'unit-2')).toMatchObject({ definitionId: 'darius', starLevel: 1, location: { kind: 'bench', slot: 0 } });
    expect(granted.m8.loot.receipts).toHaveLength(2); expect(granted.m8.loot.receipts[0].grantedUnitIds).toEqual(['unit-2']);
    expect(granted.resourceProvenance.entries.at(-1)).toMatchObject({ kind: 'unit-acquired', unitId: 'unit-2', source: { kind: 'loot', receiptId: granted.m8.loot.receipts[0].receiptId } });
    expect(granted.nextUnitSerial).toBe(3); expect(events.map(value => value.type)).toEqual(['lootGranted','lootGranted']); expect(upgradeEvents).toEqual([]);
    expect(grantDirectLoot(granted, false)).toEqual({ state: granted, events: [], upgradeEvents: [] });
    expect(Object.values(granted.m8.loot.guaranteeCounters)).toEqual(Array(8).fill(0));
  });

  it('keeps a full-bench hero pending without allocating, retries after release, and retains at terminal', () => {
    const original = observed(fillBench(fixture()));
    const pending = grantDirectLoot(original, false);
    expect(pending.events.map(e=>e.type)).toEqual(['lootGranted']); expect(hasPendingLootCapacity(pending.state)).toBe(true);
    expect(pending.state.m8.loot.receipts.map(r=>r.payload.kind)).toEqual(['consumable']); expect(pending.state.nextUnitSerial).toBe(20);
    expect(pending.state.resourceProvenance).toBe(original.resourceProvenance); expect(pending.state.gold).toBe(original.gold);
    expect(grantDirectLoot(pending.state, false).state).toBe(pending.state);
    const released = { ...pending.state, preparation: { ...pending.state.preparation, units: pending.state.preparation.units.filter(unit => unit.id !== 'unit-2') } };
    const granted = grantDirectLoot(released, false).state;
    expect(hasPendingLootCapacity(granted)).toBe(false); expect(granted.m8.loot.receipts.find(r=>r.payload.kind==='unit')!.grantedUnitIds).toEqual(['unit-20']);
    const terminal = grantDirectLoot(pending.state, true).state;
    expect(terminal.m8.loot.direct[0].status).toBe('retained-terminal'); expect(hasPendingLootCapacity(terminal)).toBe(false);
    expect(terminal.m8.loot.receipts.map(r=>r.payload.kind)).toEqual(['consumable']); expect(grantDirectLoot(terminal, true).state).toBe(terminal);
  });

  it('uses two real purchase upgrades including a changed survivor, carrying stock, equipment and anomaly', () => {
    // Both independent loot oracles pin a real Tristana drop at seed48, 3-7.
    const original = fixture(17, 48);
    const players: Unit[] = [
      { id: 'unit-1', definitionId: 'tristana', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 4 } } },
      { id: 'unit-2', definitionId: 'tristana', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } },
      { id: 'unit-3', definitionId: 'tristana', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 1, row: 4 } } },
      { id: 'unit-4', definitionId: 'tristana', team: 'player', starLevel: 2, location: { kind: 'bench', slot: 1 } },
    ];
    const state = observed({ ...original, nextUnitSerial: 5, nextItemSerial: 3,
      preparation: { ...original.preparation, units: [...players, ...original.m8.preparation.enemies] },
      persistentGrowth: players.map((unit, index) => ({ unitId: unit.id, attackDamageBps: 250 + index * 125 })),
      items: [{ id: 'item-1', definitionId: 'sword', location: { kind: 'unit', unitId: 'unit-2', slot: 0 } },
        { id: 'item-2', definitionId: 'vest', location: { kind: 'unit', unitId: 'unit-1', slot: 0 } }],
      anomalyBinding: { definitionId: 'bulwark', unitId: 'unit-2', choiceId: 'fixture-anomaly', boundRound: 15 },
    });
    const result = grantDirectLoot(state, false);
    expect(result.upgradeEvents.map(value => [value.survivorId, value.consumedIds, value.fromStar, value.toStar])).toEqual([
      ['unit-1', ['unit-2', 'unit-5'], 1, 2], ['unit-3', ['unit-1', 'unit-4'], 2, 3],
    ]);
    expect(result.state.persistentGrowth).toEqual([{ unitId: 'unit-3', attackDamageBps: 1750 }]);
    expect(result.state.items.slice(0, 2).map(item => item.location)).toEqual([
      { kind: 'unit', unitId: 'unit-3', slot: 1 }, { kind: 'unit', unitId: 'unit-3', slot: 0 },
    ]);
    expect(result.state.anomalyBinding?.unitId).toBe('unit-3');
    expect(result.state.m8.loot.receipts.find(r=>r.payload.kind==='unit')?.grantedUnitIds).toEqual(['unit-5']);
    expect(result.state.preparation.units.some(unit => unit.id === 'unit-5')).toBe(false);
    const facts = result.state.resourceProvenance.entries.slice(-3);
    expect(facts[0]).toMatchObject({ kind: 'unit-acquired', unitId: 'unit-5' });
    expect(facts.slice(1)).toEqual(result.upgradeEvents.map((event, index) => ({ kind: 'unit-upgraded', acquisitionSequence: facts[0].sequence,
      event, sequence: facts[0].sequence + index + 1, roundId: '3-7' })));
    expect(result.state.combat).toBe(state.combat); expect(result.state.m8.loot.frozen).toBe(state.m8.loot.frozen);
  });

  it('grants all signed entries before income or XP, with no PvE choice',()=>{
    const state=observed({...fixture(10),gold:9}),result=grantDirectLoot(state,false);
    const expected=lootPlan(5,10).rounds.at(-1)!.encounterPlan.drops.map(d=>d.payload);
    expect(result.state.m8.loot.receipts.map(r=>r.payload)).toEqual(expected);
    expect(result.state.gold).toBe(9+expected.reduce((n,p)=>n+(p.kind==='gold'?p.quantity:0),0));
    expect(result.state.level).toBe(state.level);expect(result.state.xp).toBe(state.xp);
    expect(result.state.m8.loot.guaranteeCounters[key('2-7')]).toBe(2);
    expect(result.state.roundResults).toBe(state.roundResults);expect(unresolvedLootChoices(result.state)).toEqual([]);
    expect(result.state.scheduleReceipts).toBe(state.scheduleReceipts);
    const terminal=grantDirectLoot(observed(fixture(38)),true).state;
    const final=lootPlan(5,38).rounds.at(-1)!.encounterPlan.drops.map(d=>d.payload);expect(terminal.gold).toBe(final.reduce((n,p)=>n+(p.kind==='gold'?p.quantity:0),0));expect(terminal.consumables).toHaveLength(final.filter(p=>p.kind==='consumable').length);
    expect(terminal.m8.loot.receipts.map(r=>r.payload)).toEqual(final);
  });

  it('preserves every prior receipt and derives the full-clear 0/1/1/2/2/2/2/0 component vector', () => {
    let state = fixture();
    for (const ordinal of [1, 2, 3, 10, 17, 24, 31, 38]) {
      const round = getCatalogRoundByOrdinal(ordinal), enemies = createRoundEnemies(ordinal);
      state = { ...state, round: ordinal, roundDefinitionId: round.roundId, phase: 'preparation', combat: null,
        m8: { ...state.m8, round, loot: prepareMatchLoot(5, ordinal, state.m8.loot), preparation: {
          ...state.m8.preparation, roundId: round.roundId, encounterId: round.encounterId, enemies } },
        preparation: { ...state.preparation, units: [...state.preparation.units.filter(unit => unit.team === 'player'), ...enemies] } };
      state = grantDirectLoot(observed(state), ordinal === 38).state;
      for (const descriptor of unresolvedLootChoices(state)) state = grantLootChoice(state, descriptor, 'tear', 'player-choice').state;
    }
    const expected=lootPlan(5,38),drops=expected.rounds.flatMap(r=>r.encounterPlan.drops);
    expect(Object.values(state.m8.loot.guaranteeCounters)).toEqual(expected.rounds.map(r=>r.encounterPlan.drops.reduce((n,d)=>n+(d.payload.kind==='item'?(COMPONENTS.includes(d.payload.definitionId)?1:2):0),0)));
    const items=drops.filter(d=>d.payload.kind==='item').length;
    expect(state.items).toHaveLength(items);expect(state.nextItemSerial).toBe(items+1);
    expect(state.m8.loot.receipts).toHaveLength(drops.length);expect(state.m8.loot.earnedEvidence).toHaveLength(drops.length);
    expect(state.m8.loot.choiceResolutions).toEqual([]);
    expect(state.gold).toBe(drops.reduce((n,d)=>n+(d.payload.kind==='gold'?d.payload.quantity:0),0));
    expect(state.m8.loot.frozen.rng).toEqual(expected.rng);

  });
});

describe('T13 removal of PvE choices and fallback',()=>{
 it.each([1,2,3,10,17,24,31,38])('round %i grants only the frozen direct package and rejects a synthetic old choice',ordinal=>{
  const state=observed(fixture(ordinal)),before=JSON.stringify(state);
  expect(unresolvedLootChoices(state)).toEqual([]);expect(plan(state).choices).toEqual([]);
  const descriptor={roundId:state.roundDefinitionId,encounterId:state.m8.round.encounterId!,sourceUnitId:'old',slotOrdinal:0,dropId:'old',
    kind:'component-choice' as const,quantity:1 as const,poolVersion:'m8b-components-v1' as const,terminalFallbackDefinitionId:'sword',revealCondition:'source-killed' as const};
  expect(()=>grantLootChoice(state,descriptor,'sword','player-choice')).toThrow();
  expect(()=>grantLootChoice(state,descriptor,'sword','terminal-fallback')).toThrow();expect(JSON.stringify(state)).toBe(before);
 });
});
