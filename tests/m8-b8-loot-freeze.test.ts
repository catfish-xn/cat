import { describe, expect, it } from 'vitest';
import archivedHeroes from '../src/simulation/content/source/s13-14.24.json';
import archivedItems from '../src/simulation/content/source/s13-14.24b/normalized/items.json';
import { COMPONENT_POOL } from '../src/simulation/component-pool';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { LOOT_CATEGORIES, LOOT_HERO_POOLS, LOOT_HERO_POOL_VERSION, LOOT_POLICY_VERSION, LOOT_SLOTS } from '../src/simulation/content/loot';
import { NEUTRAL_ENCOUNTERS } from '../src/simulation/content/neutral-encounters';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { makeLootPendingChoice, orderedUnresolvedLootChoices, validateLootPendingChoice } from '../src/simulation/loot-choice';
import { advanceFrozenLootLedger, drawLootIndex, freezeLootThroughRound, LOOT_FREEZE_ALGORITHM, LOOT_FREEZE_VERSION, LOOT_REPLAY_DIGEST, restoreFrozenLootLedger, validateLootContent } from '../src/simulation/loot-freeze';
import { compareLootChoices, compareLootFreezeSlots, lootChoiceId, lootDropId, lootReceiptId } from '../src/simulation/loot-identity';
import type { FrozenLootLedger, LootChoiceDescriptor, LootChoiceEligibility, LootChoiceResolution } from '../src/simulation/loot-types';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';

/**
 * Checkpoint ① only: immutable preparation data, pure choice ordering/projection and
 * local restore validation. These tests do not claim Match awards, death consumers,
 * settlement, inventory, receipts, capacity, or the complete IF-LOOT pipeline work.
 * Tables are transcribed from M8B_LOOT §§2–5 and CONTRACT_ADDENDUM §§2–3.
 * Numeric vectors were calculated separately with unbounded integer arithmetic:
 * s0 = seed XOR 3735928559; s' = (1664525*s + 1013904223) mod 4294967296.
 * Expected outputs never call the production RNG, sampler, catalog or freeze helpers.
 */
const COMPONENTS = [
  ['TFT_Item_BFSword', 'sword'], ['TFT_Item_ChainVest', 'vest'],
  ['TFT_Item_GiantsBelt', 'belt'], ['TFT_Item_NeedlesslyLargeRod', 'rod'],
  ['TFT_Item_NegatronCloak', 'cloak'], ['TFT_Item_RecurveBow', 'bow'],
  ['TFT_Item_SparringGloves', 'gloves'], ['TFT_Item_TearOfTheGoddess', 'tear'],
] as const;
const HEROES = {
  1: [['TFT13_Darius', 'darius'], ['TFT13_Irelia', 'irelia'], ['TFT13_Lux', 'lux'], ['TFT13_Shooter', 'maddie'], ['TFT13_Zyra', 'zyra']],
  2: [['TFT13_Leona', 'leona'], ['TFT13_Prime', 'vander'], ['TFT13_Rell', 'rell'], ['TFT13_Tristana', 'tristana'], ['TFT13_Urgot', 'urgot']],
  3: [['TFT13_Beardy', 'loris'], ['TFT13_Ezreal', 'ezreal'], ['TFT13_FlyGuy', 'scar'], ['TFT13_KogMaw', 'kogmaw'], ['TFT13_Nami', 'nami']],
  4: [['TFT13_Corki', 'corki'], ['TFT13_Garen', 'garen'], ['TFT13_Zoe', 'zoe']],
} as const;
const slot = (sourceSlotId: string, slotOrdinal: number, content: object) => ({ sourceSlotId, slotOrdinal, content });
const EXPECTED_SLOTS = {
  '1-2': [slot('m01', 0, { kind: 'fixed', payload: { kind: 'unit', definitionId: 'maddie', quantity: 1 } })],
  '1-3': [slot('m01', 0, { kind: 'fixed', payload: { kind: 'unit', definitionId: 'lux', quantity: 1 } }), slot('r01', 0, { kind: 'component-choice' })],
  '1-4': [slot('r01', 0, { kind: 'component-choice' })],
  '2-7': [slot('k01', 0, { kind: 'random-component' }), slot('k01', 1, { kind: 'extra', cost: 1 }), slot('k02', 0, { kind: 'component-choice' })],
  '3-7': [slot('w00', 0, { kind: 'random-component' }), slot('w00', 1, { kind: 'extra', cost: 2 }), slot('w01', 0, { kind: 'component-choice' })],
  '4-7': [slot('r00', 0, { kind: 'random-component' }), slot('r00', 1, { kind: 'extra', cost: 3 }), slot('r01', 0, { kind: 'component-choice' })],
  '5-7': [slot('d01', 0, { kind: 'random-component' }), slot('d01', 1, { kind: 'component-choice' }), slot('d01', 2, { kind: 'extra', cost: 4 })],
  '6-7': [slot('h01', 0, { kind: 'fixed', payload: { kind: 'gold', quantity: 5 } })],
};
const ENCOUNTERS = [
  ['1-2', 'minions-a-v1', 1], ['1-3', 'minions-b-v1', 2], ['1-4', 'minions-c-v1', 3],
  ['2-7', 'krugs-v1', 10], ['3-7', 'wolves-v1', 17], ['4-7', 'razorbeaks-v1', 24],
  ['5-7', 'elder-dragon-v1', 31], ['6-7', 'rift-herald-v1', 38],
] as const;
const jsonCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const round = (ledger: FrozenLootLedger, id: string) => ledger.rounds.find(r => r.encounterPlan.roundId === id)!;

describe('B8 checkpoint ① approved, bounded loot content', () => {
  it('pins all eight source/slot tables and explicitly excludes every no-loot monster', () => {
    expect(LOOT_POLICY_VERSION).toBe('m8b-loot-project-v1');
    expect(LOOT_HERO_POOL_VERSION).toBe('m8b-heroes-1to4-v1');
    expect(LOOT_SLOTS).toEqual(EXPECTED_SLOTS);
    expect(ROUND_CATALOG.filter(r => r.kind === 'pve').map(r => [r.roundId, r.encounterId, r.ordinal])).toEqual(ENCOUNTERS);
    expect(NEUTRAL_ENCOUNTERS.map(e => [e.roundId, e.slots.filter(s => !LOOT_SLOTS[e.roundId].some(d => d.sourceSlotId === s.slotId)).map(s => s.slotId)])).toEqual([
      ['1-2', ['m02']], ['1-3', ['m02']], ['1-4', ['m01', 'm02', 'r02']], ['2-7', ['k03']],
      ['3-7', ['w02', 'w03', 'w04']], ['4-7', ['r02', 'r03', 'r04', 'r05']], ['5-7', []], ['6-7', []],
    ]);
    expect(() => validateLootContent()).not.toThrow();
  });

  it('pins all category weights, including the distinct 10% five-gold substitute', () => {
    expect(LOOT_CATEGORIES).toEqual({
      1: [{ id: 'gold_1', weight: 75, payload: { kind: 'gold', quantity: 1 } }, { id: 'unit_1', weight: 25, payload: { kind: 'hero-pool', cost: 1 } }],
      2: [{ id: 'gold_2', weight: 75, payload: { kind: 'gold', quantity: 2 } }, { id: 'unit_2', weight: 25, payload: { kind: 'hero-pool', cost: 2 } }],
      3: [{ id: 'gold_3', weight: 75, payload: { kind: 'gold', quantity: 3 } }, { id: 'unit_3', weight: 25, payload: { kind: 'hero-pool', cost: 3 } }],
      4: [{ id: 'gold_4', weight: 70, payload: { kind: 'gold', quantity: 4 } }, { id: 'gold_5_substitute', weight: 10, payload: { kind: 'gold', quantity: 5 } }, { id: 'unit_4', weight: 20, payload: { kind: 'hero-pool', cost: 4 } }],
    });
    for (const entries of Object.values(LOOT_CATEGORIES)) expect(entries.reduce((n, x) => n + x.weight, 0)).toBe(100);
    expect(Object.keys(LOOT_HERO_POOLS)).toEqual(['1', '2', '3', '4']);
  });

  it('verifies all eight components and all 18 eligible heroes against the independent archive identities', () => {
    expect(COMPONENT_POOL).toEqual(COMPONENTS.map(([apiName, definitionId]) => ({ apiName, definitionId })));
    expect(archivedItems.items.filter(i => i.kind === 'component').map(i => i.apiName).sort()).toEqual(COMPONENTS.map(([api]) => api));
    for (const [apiName, id] of COMPONENTS) expect(ITEM_DEFINITIONS[id]).toMatchObject({ apiName, kind: 'component' });
    expect(LOOT_HERO_POOLS).toEqual(HEROES);
    const archive: Record<string, { apiName: string; cost: number }> = archivedHeroes.champions;
    for (const [cost, entries] of Object.entries(HEROES)) {
      for (const [apiName, id] of entries) {
        expect(archive[id]).toMatchObject({ apiName, cost: Number(cost) });
        expect(M5_UNIT_DEFINITIONS[id].cost).toBe(Number(cost));
      }
    }
    expect(archive.caitlyn).toMatchObject({ apiName: 'TFT13_Caitlyn', cost: 5 });
    expect(Object.values(LOOT_HERO_POOLS).flat().map(([, id]) => id)).not.toContain('caitlyn');
    // Source API order matters: local ID sorting would put loris after ezreal/kogmaw.
    expect(LOOT_HERO_POOLS[3].map(([, id]) => id)).toEqual(['loris', 'ezreal', 'scar', 'kogmaw', 'nami']);
  });
});

// Literal independent route vectors: [seed, draws, last word, six hidden fallbacks,
// four random components, four extra package payloads]. Fixed Maddie/Lux/5G are checked below.
const ROUTES = [
  { seed: 5, draws: 14, state: 2192168264, fallbacks: ['vest', 'cloak', 'bow', 'belt', 'rod', 'bow'], components: ['rod', 'sword', 'vest', 'gloves'], extras: [['gold', 1], ['gold', 2], ['gold', 3], ['gold', 4]] },
  { seed: 0, draws: 15, state: 2186513952, fallbacks: ['belt', 'vest', 'gloves', 'tear', 'cloak', 'gloves'], components: ['cloak', 'bow', 'belt', 'rod'], extras: [['gold', 1], ['gold', 2], ['gold', 3], ['unit', 'corki']] },
  { seed: 1, draws: 16, state: 2400970430, fallbacks: ['bow', 'sword', 'cloak', 'sword', 'vest', 'rod'], components: ['tear', 'rod', 'tear', 'cloak'], extras: [['unit', 'darius'], ['unit', 'vander'], ['gold', 3], ['gold', 4]] },
  { seed: 49, draws: 17, state: 3020261941, fallbacks: ['bow', 'sword', 'cloak', 'sword', 'vest', 'rod'], components: ['tear', 'rod', 'tear', 'cloak'], extras: [['unit', 'zyra'], ['unit', 'tristana'], ['gold', 3], ['unit', 'garen']] },
  { seed: 230, draws: 18, state: 3625804339, fallbacks: ['cloak', 'rod', 'tear', 'rod', 'tear', 'vest'], components: ['gloves', 'belt', 'gloves', 'belt'], extras: [['unit', 'maddie'], ['unit', 'urgot'], ['unit', 'ezreal'], ['unit', 'garen']] },
  { seed: 3735928559, draws: 15, state: 28987765, fallbacks: ['tear', 'belt', 'gloves', 'tear', 'cloak', 'gloves'], components: ['vest', 'bow', 'belt', 'rod'], extras: [['unit', 'lux'], ['gold', 2], ['gold', 3], ['gold', 4]] },
] as const;

describe('B8 checkpoint ① independent full-route RNG vectors', () => {
  it.each(ROUTES)('seed $seed freezes exact payloads and $draws accepted words', vector => {
    const ledger = freezeLootThroughRound(vector.seed, 38);
    expect(ledger.rng).toEqual({ state: vector.state, draws: vector.draws });
    expect(ledger.rounds.map(r => r.encounterPlan.roundId)).toEqual(ENCOUNTERS.map(([id]) => id));
    expect(ledger.rounds.flatMap(r => r.choices.map(c => c.terminalFallbackDefinitionId))).toEqual(vector.fallbacks);
    const lateRounds = ['2-7', '3-7', '4-7', '5-7'].map(id => round(ledger, id));
    expect(lateRounds.map(r => r.encounterPlan.drops[0].payload)).toEqual(vector.components.map(definitionId => ({ kind: 'item', definitionId, quantity: 1 })));
    expect(lateRounds.map(r => r.encounterPlan.drops[1].payload)).toEqual(vector.extras.map(([kind, value]) => kind === 'gold'
      ? { kind: 'gold', quantity: value } : { kind: 'unit', definitionId: value, quantity: 1 }));
    expect(round(ledger, '1-2').encounterPlan.drops[0].payload).toEqual({ kind: 'unit', definitionId: 'maddie', quantity: 1 });
    expect(round(ledger, '1-3').encounterPlan.drops[0].payload).toEqual({ kind: 'unit', definitionId: 'lux', quantity: 1 });
    expect(round(ledger, '6-7').encounterPlan.drops[0].payload).toEqual({ kind: 'gold', quantity: 5 });
    expect(round(ledger, '6-7').choices).toEqual([]);
    expect(ledger.rounds.flatMap(r => r.encounterPlan.drops)).toHaveLength(11);
    expect(ledger.rounds.flatMap(r => r.choices)).toHaveLength(6);
    expect(freezeLootThroughRound(vector.seed, 31).rng).toEqual(ledger.rng); // Terminal 5G consumes zero words.
    expect(freezeLootThroughRound(vector.seed, 38)).toEqual(ledger);
  });

  it('preserves seed zero and an XOR result of zero, with fixed opening heroes consuming zero words', () => {
    expect(freezeLootThroughRound(0, 0).rng).toEqual({ state: 3735928559, draws: 0 });
    expect(freezeLootThroughRound(0, 1).rng).toEqual({ state: 3735928559, draws: 0 });
    expect(freezeLootThroughRound(0, 2).rng).toEqual({ state: 1789648770, draws: 1 });
    expect(freezeLootThroughRound(3735928559, 1).rng).toEqual({ state: 0, draws: 0 });
    expect(freezeLootThroughRound(3735928559, 2).rng).toEqual({ state: 1013904223, draws: 1 });
    expect(round(freezeLootThroughRound(3735928559, 2), '1-3').choices[0].terminalFallbackDefinitionId).toBe('tear');
  });

  it('pins every entered PvE boundary, without consuming future, PvP or .4 supply draws', () => {
    const boundaries = [
      [0, 0, 3735928559, 0], [1, 0, 3735928559, 1], [2, 1, 1789648770, 2], [3, 2, 4125694201, 3],
      [9, 2, 4125694201, 3], [10, 5, 1668495830, 4], [16, 5, 1668495830, 4],
      [17, 8, 4230347895, 5], [23, 8, 4230347895, 5], [24, 11, 1723108908, 6],
      [30, 11, 1723108908, 6], [31, 15, 2186513952, 7], [37, 15, 2186513952, 7], [38, 15, 2186513952, 8],
    ];
    let incremental = freezeLootThroughRound(0, 0);
    for (const [ordinal, draws, state, length] of boundaries) {
      const priorRounds = incremental.rounds;
      incremental = advanceFrozenLootLedger(incremental, ordinal);
      priorRounds.forEach((prior, index) => expect(incremental.rounds[index]).toBe(prior));
      expect(incremental.rng).toEqual({ state, draws });
      expect(incremental.rounds).toHaveLength(length);
      expect(incremental).toEqual(freezeLootThroughRound(0, ordinal));
      expect(advanceFrozenLootLedger(incremental, ordinal)).toBe(incremental);
      const restored = restoreFrozenLootLedger(jsonCopy(incremental), { seed: 0, throughRoundOrdinal: ordinal });
      expect(restored).toEqual(incremental);
      expect(advanceFrozenLootLedger(restored, ordinal)).toBe(restored);
      expect(advanceFrozenLootLedger(restored, 38)).toEqual(freezeLootThroughRound(0, 38));
    }
    for (const ordinal of [4, 7, 11, 14, 18, 21, 25, 28, 32, 35]) {
      const before = freezeLootThroughRound(0, ordinal - 1), after = advanceFrozenLootLedger(before, ordinal);
      expect(after.rng).toEqual(before.rng);
      expect(after.rounds).toEqual(before.rounds);
      before.rounds.forEach((prior, index) => expect(after.rounds[index]).toBe(prior));
    }
    expect(() => advanceFrozenLootLedger(incremental, 37)).toThrow(RangeError);
  });

  it.each([
    [17, '2-7', 74, 'gold', 1], [160, '2-7', 75, 'unit', 'lux'],
    [140, '2-7', 99, 'unit', 'maddie'], [103, '2-7', 0, 'gold', 1],
    [8, '5-7', 69, 'gold', 4], [22, '5-7', 70, 'gold', 5],
    [14, '5-7', 79, 'gold', 5], [117, '5-7', 80, 'unit', 'garen'], [6, '5-7', 99, 'unit', 'garen'],
  ] as const)('seed %i %s category index %i hits %s %s at an exact bucket boundary', (seed, id, _index, kind, value) => {
    const payload = round(freezeLootThroughRound(seed, 31), id).encounterPlan.drops[1].payload;
    expect(payload).toEqual(kind === 'gold' ? { kind, quantity: value } : { kind, definitionId: value, quantity: 1 });
  });

  it('counts all rejection words, accepts the exact limit-1, and never rejects any component word', () => {
    // Independently inverted LCG predecessor states. Initial draws=41 detects reset/off-by-one bugs.
    const vectors = [
      [2463395136, 100, 99, 4294967199, 42], // limit-1 accepted
      [2444543493, 100, 23, 854109823, 43], // 4294967200 rejected
      [653637408, 100, 98, 1012239698, 43], // 4294967295 rejected
      [672489051, 5, 4, 4294967294, 42], [653637408, 5, 3, 1012239698, 43],
      [672489051, 3, 2, 4294967294, 42], [653637408, 3, 2, 1012239698, 43],
      [653637408, 8, 7, 4294967295, 42],
    ];
    for (const [state, n, index, nextState, draws] of vectors) {
      const input = Object.freeze({ state, draws: 41 });
      expect(drawLootIndex(input, n)).toEqual({ index, rng: { state: nextState, draws } });
      expect(input).toEqual({ state, draws: 41 });
    }
  });

  it('rejects each of the last 96 category words using an independent BigInt inverse, retaining both draws', () => {
    // 4276115653 is the inverse of 1664525 modulo 2^32. This oracle never imports nextRandom.
    const modulus = 4294967296n, inverse = 4276115653n;
    expect((1664525n * inverse) % modulus).toBe(1n);
    for (let rejected = 4294967200n; rejected < modulus; rejected++) {
      const predecessor = Number(((rejected - 1013904223n) * inverse) % modulus);
      const next = Number((1664525n * rejected + 1013904223n) % modulus);
      expect(next).toBeLessThan(4294967200);
      expect(drawLootIndex({ state: predecessor, draws: 0 }, 100)).toEqual({ index: next % 100, rng: { state: next, draws: 2 } });
    }
  });

  it('rejects invalid seeds, preparation boundaries, sample sizes and unsafe stream counters', () => {
    for (const seed of [-1, 0x100000000, 0.5, NaN, Infinity]) expect(() => freezeLootThroughRound(seed, 1)).toThrow(RangeError);
    for (const ordinal of [-1, 39, 0.5, NaN, Infinity]) expect(() => freezeLootThroughRound(0, ordinal)).toThrow(RangeError);
    for (const n of [0, -1, 1.5, 0x100000001, NaN, Infinity]) expect(() => drawLootIndex({ state: 0, draws: 0 }, n)).toThrow(RangeError);
    for (const draws of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) expect(() => drawLootIndex({ state: 0, draws }, 8)).toThrow(RangeError);
    for (const state of [-1, 0x100000000, 0.5, NaN]) expect(() => drawLootIndex({ state, draws: 0 }, 8)).toThrow(RangeError);
    expect(drawLootIndex({ state: 0, draws: 0 }, 1)).toEqual({ index: 0, rng: { state: 1013904223, draws: 1 } });
    expect(drawLootIndex({ state: 0, draws: 0 }, 0x100000000)).toEqual({ index: 1013904223, rng: { state: 1013904223, draws: 1 } });
  });
});

describe('B8 checkpoint ① identities, isolated descriptors and pure ordering', () => {
  it('uses exact canonical tuples and one identity across both independent frozen arrays', () => {
    const ledger = freezeLootThroughRound(0, 38), allIds: string[] = [];
    for (const [roundId, encounterId] of ENCOUNTERS) {
      const r = round(ledger, roundId);
      expect(r.encounterPlan).toMatchObject({ roundId, encounterId, policyVersion: 'm8b-pve-project-v1' });
      const entries = [...r.encounterPlan.drops, ...r.choices];
      for (const expected of EXPECTED_SLOTS[roundId]) {
        const sourceUnitId = JSON.stringify(['pve', roundId, encounterId, expected.sourceSlotId]);
        const dropId = JSON.stringify([roundId, encounterId, sourceUnitId, expected.slotOrdinal]);
        const actual = entries.find(d => d.dropId === dropId)!;
        expect(actual).toBeDefined();
        expect(actual).toMatchObject({ roundId, encounterId, sourceUnitId, slotOrdinal: expected.slotOrdinal, dropId, revealCondition: 'source-killed' });
        expect(lootDropId(roundId, encounterId, sourceUnitId, expected.slotOrdinal)).toBe(dropId);
        expect(lootReceiptId(dropId)).toBe(JSON.stringify([dropId, 'grant']));
        expect(lootChoiceId(dropId)).toBe(JSON.stringify(['m8b-loot-choice', dropId]));
        allIds.push(dropId);
      }
      for (const drop of r.encounterPlan.drops) {
        expect(drop).toMatchObject({ status: 'planned', receiptId: null });
        expect(['gold', 'unit', 'item']).toContain(drop.payload.kind);
        expect(drop).not.toHaveProperty('terminalFallbackDefinitionId');
      }
      for (const choice of r.choices) {
        expect(choice).toMatchObject({ kind: 'component-choice', poolVersion: 'm8b-components-v1', quantity: 1 });
        for (const field of ['payload', 'itemId', 'status', 'receiptId', 'definitionId']) expect(choice).not.toHaveProperty(field);
      }
    }
    expect(allIds).toHaveLength(17);
    expect(new Set(allIds).size).toBe(17);
    const quoted = 'source["a",2]';
    expect(JSON.parse(lootDropId('r', 'e', quoted, 10))).toEqual(['r', 'e', quoted, 10]);
    for (const n of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => lootDropId('r', 'e', 's', n)).toThrow(RangeError);
    for (const [r, e, s] of [['', 'e', 's'], ['r', '', 's'], ['r', 'e', '']]) expect(() => lootDropId(r, e, s, 0)).toThrow(RangeError);
  });

  it('distinguishes source code-point + numeric slot freezing from dropId text choice order (2 versus 10)', () => {
    const entries = [
      { sourceUnitId: 'a', slotOrdinal: 10 }, { sourceUnitId: 'Z', slotOrdinal: 10 },
      { sourceUnitId: 'a', slotOrdinal: 2 }, { sourceUnitId: 'Z', slotOrdinal: 2 },
    ].map(e => ({ ...e, dropId: JSON.stringify(['r', 'e', e.sourceUnitId, e.slotOrdinal]) }));
    expect([...entries].sort(compareLootFreezeSlots).map(e => [e.sourceUnitId, e.slotOrdinal])).toEqual([['Z', 2], ['Z', 10], ['a', 2], ['a', 10]]);
    expect([...entries].sort(compareLootChoices).map(e => [e.sourceUnitId, e.slotOrdinal])).toEqual([['Z', 10], ['Z', 2], ['a', 10], ['a', 2]]);
    expect(compareLootFreezeSlots(entries[0], entries[0])).toBe(0);
    expect(compareLootChoices(entries[0], entries[0])).toBe(0);
    expect(entries.map(e => [e.sourceUnitId, e.slotOrdinal])).toEqual([['a', 10], ['Z', 10], ['a', 2], ['Z', 2]]);
  });

  it('orders already-recorded eligibility independently of same-tick/death order, input arrays and restored order', () => {
    // Synthetic multisource/multislot data exercises the pure domain primitive only.
    // No death event consumer or award is being simulated/claimed here.
    const template = round(freezeLootThroughRound(0, 2), '1-3').choices[0];
    const entries: LootChoiceDescriptor[] = [
      ['a', 2], ['Z', 10], ['a', 10], ['Z', 2], ['hidden', 0], ['lost', 0], ['done', 0],
    ].map(([source, ordinal]) => ({ ...template, sourceUnitId: String(source), slotOrdinal: Number(ordinal),
      dropId: JSON.stringify(['1-3', 'minions-b-v1', source, ordinal]) }));
    const eligibility: LootChoiceEligibility[] = entries.map((d, i) => ({ dropId: d.dropId, status: i === 4 ? 'planned' : i === 5 ? 'forfeited' : 'revealed' }));
    const resolutions: LootChoiceResolution[] = [{ dropId: entries[6].dropId, receiptId: JSON.stringify([entries[6].dropId, 'grant']), method: 'player-choice' }];
    const expected = [entries[1].dropId, entries[3].dropId, entries[2].dropId, entries[0].dropId];
    const original = JSON.stringify({ entries, eligibility, resolutions });
    for (const indices of [[0, 1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1, 0], [3, 1, 6, 0, 2, 4, 5]]) {
      for (const facts of [eligibility, [...eligibility].reverse(), [...eligibility.slice(2), ...eligibility.slice(0, 2)]]) {
        const descriptors = indices.map(i => entries[i]);
        expect(orderedUnresolvedLootChoices(descriptors, facts, resolutions).map(d => d.dropId)).toEqual(expected);
        expect(orderedUnresolvedLootChoices(jsonCopy(descriptors), jsonCopy(facts), jsonCopy(resolutions)).map(d => d.dropId)).toEqual(expected);
      }
    }
    expect(JSON.stringify({ entries, eligibility, resolutions })).toBe(original);
    expect(orderedUnresolvedLootChoices(entries, [], resolutions)).toEqual([]);
    expect(orderedUnresolvedLootChoices(entries, eligibility.map(e => ({ ...e, status: 'forfeited' })), [])).toEqual([]);
    const terminal = [{ ...resolutions[0], method: 'terminal-fallback' as const }];
    expect(orderedUnresolvedLootChoices(entries, eligibility, terminal).map(d => d.dropId)).toEqual(expected);
  });

  it('projects eight fixed candidates with no fallback or inventory identity, without consuming RNG', () => {
    const ledger = freezeLootThroughRound(0, 38), before = JSON.stringify(ledger);
    for (const descriptor of ledger.rounds.flatMap(r => r.choices)) {
      const id = JSON.stringify(['m8b-loot-choice', descriptor.dropId]);
      const expected = { kind: 'component', step: 'offer', choiceId: id, eventId: id, generation: 0,
        returnPhase: 'settlement', offers: ['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'], targetId: null, rerollCount: 0 };
      expect(makeLootPendingChoice(descriptor)).toEqual(expected);
      expect(makeLootPendingChoice(descriptor)).toEqual(expected);
      expect(() => validateLootPendingChoice(jsonCopy(expected), descriptor)).not.toThrow();
      expect(Object.isFrozen(makeLootPendingChoice(descriptor).offers)).toBe(true);
    }
    expect(JSON.stringify(ledger)).toBe(before);
  });
});

describe('B8 checkpoint ① strict restore and immutable query boundaries', () => {
  it('deep-freezes all authoritative outputs and restores a detached, equal exact replay', () => {
    const ledger = freezeLootThroughRound(0, 38);
    const checkFrozen = (value: unknown): void => {
      if (value !== null && typeof value === 'object') {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(checkFrozen);
      }
    };
    for (const value of [ledger, LOOT_SLOTS, LOOT_CATEGORIES, LOOT_HERO_POOLS, LOOT_FREEZE_ALGORITHM]) checkFrozen(value);
    expect(LOOT_FREEZE_VERSION).toBe('m8-b8-loot-freeze-v1');
    expect(ledger).toMatchObject({ version: 'm8-b8-loot-freeze-v1', seed: 0, replayDigest: LOOT_REPLAY_DIGEST, throughRoundOrdinal: 38 });
    expect(LOOT_REPLAY_DIGEST).toMatch(/^fnv1a32-utf16:[0-9a-f]{8}$/);
    const serialized = jsonCopy(ledger), restored = restoreFrozenLootLedger(serialized, { seed: 0, throughRoundOrdinal: 38 });
    expect(restored).toEqual(ledger);
    expect(restored).not.toBe(serialized);
    expect(restored.rounds[0]).not.toBe(serialized.rounds[0]);
    checkFrozen(restored);
    expect(Reflect.set(ledger.rng, 'draws', 100)).toBe(false);
    expect(Reflect.set(ledger.rounds[0].encounterPlan.drops[0].payload, 'quantity', 9)).toBe(false);
    const choices = restored.rounds.flatMap(r => r.choices);
    expect(orderedUnresolvedLootChoices([...choices].reverse(), choices.map(c => ({ dropId: c.dropId, status: 'revealed' })), []).map(c => c.roundId))
      .toEqual(['1-3', '1-4', '2-7', '3-7', '4-7', '5-7']);
  });

  const corruptions: [string, (saved: any) => void][] = [
    ['version', s => { s.version = 'm8-b8-loot-freeze-v2'; }],
    ['digest', s => { s.replayDigest = 'fnv1a32-utf16:00000000'; }],
    ['seed', s => { s.seed = 1; }],
    ['boundary', s => { s.throughRoundOrdinal = 37; }],
    ['RNG state', s => { s.rng.state++; }],
    ['RNG draws', s => { s.rng.draws--; }],
    ['missing round', s => { s.rounds.pop(); }],
    ['duplicate round', s => { s.rounds.push(s.rounds[0]); }],
    ['round array order', s => { s.rounds.reverse(); }],
    ['encounter policy', s => { s.rounds[0].encounterPlan.policyVersion = 'other'; }],
    ['encounter identity', s => { s.rounds[0].encounterPlan.encounterId = 'minions-b-v1'; }],
    ['missing direct slot', s => { s.rounds[3].encounterPlan.drops.pop(); }],
    ['direct slot order', s => { s.rounds[3].encounterPlan.drops.reverse(); }],
    ['direct source', s => { s.rounds[0].encounterPlan.drops[0].sourceUnitId = 'm02'; }],
    ['numeric slot', s => { s.rounds[0].encounterPlan.drops[0].slotOrdinal = 10; }],
    ['drop tuple', s => { s.rounds[0].encounterPlan.drops[0].dropId += ' '; }],
    ['fixed hero', s => { s.rounds[0].encounterPlan.drops[0].payload.definitionId = 'lux'; }],
    ['direct random component', s => { s.rounds[3].encounterPlan.drops[0].payload.definitionId = 'sword'; }],
    ['gold quantity', s => { s.rounds[7].encounterPlan.drops[0].payload.quantity = 6; }],
    ['choice smuggled into LootPayload', s => { s.rounds[0].encounterPlan.drops[0].payload = { kind: 'component-choice', quantity: 1 }; }],
    ['revealed status in a frozen plan', s => { s.rounds[0].encounterPlan.drops[0].status = 'revealed'; }],
    ['manufactured grant receipt', s => { s.rounds[0].encounterPlan.drops[0].receiptId = 'grant'; }],
    ['unauthorized guarantee', s => { s.rounds[0].encounterPlan.drops[0].revealCondition = 'approved-guarantee'; }],
    ['missing choice', s => { s.rounds[1].choices = []; }],
    ['duplicate choice', s => { s.rounds[1].choices.push(s.rounds[1].choices[0]); }],
    ['cross-ledger duplicate identity', s => { s.rounds[1].choices[0].dropId = s.rounds[1].encounterPlan.drops[0].dropId; }],
    ['choice pool version', s => { s.rounds[1].choices[0].poolVersion = 'latest'; }],
    ['choice kind', s => { s.rounds[1].choices[0].kind = 'item'; }],
    ['choice quantity', s => { s.rounds[1].choices[0].quantity = 2; }],
    ['choice source', s => { s.rounds[1].choices[0].sourceUnitId = 'r02'; }],
    ['choice slot', s => { s.rounds[1].choices[0].slotOrdinal = 1; }],
    ['valid but rerolled hidden fallback', s => { s.rounds[1].choices[0].terminalFallbackDefinitionId = 'sword'; }],
    ['out-of-pool hidden fallback', s => { s.rounds[1].choices[0].terminalFallbackDefinitionId = 'deathblade'; }],
    ['choice reveal condition', s => { s.rounds[1].choices[0].revealCondition = 'approved-guarantee'; }],
    ['extra nested authority', s => { s.rounds[1].choices[0].offers = ['sword']; }],
    ['extra root authority', s => { s.inventory = []; }],
    ['joint valid-seed forgery against external anchor', s => { Object.assign(s, jsonCopy(freezeLootThroughRound(1, 38))); }],
  ];
  it.each(corruptions)('rejects %s without normalizing or trusting stored output', (_name, mutate) => {
    const saved = jsonCopy(freezeLootThroughRound(0, 38));
    mutate(saved);
    const before = JSON.stringify(saved);
    expect(() => restoreFrozenLootLedger(saved, { seed: 0, throughRoundOrdinal: 38 })).toThrow();
    expect(JSON.stringify(saved)).toBe(before);
  });

  it('binds restore to externally supplied seed and boundary and validates before advancing', () => {
    const ledger = freezeLootThroughRound(0, 10);
    expect(() => restoreFrozenLootLedger(ledger, { seed: 1, throughRoundOrdinal: 10 })).toThrow();
    expect(() => restoreFrozenLootLedger(ledger, { seed: 0, throughRoundOrdinal: 9 })).toThrow();
    expect(() => restoreFrozenLootLedger(ledger, { seed: 0, throughRoundOrdinal: 11 })).toThrow();
    const bad = jsonCopy(ledger) as any;
    bad.rounds[1].choices[0].terminalFallbackDefinitionId = 'sword';
    expect(() => advanceFrozenLootLedger(bad, 10)).toThrow();
    expect(() => advanceFrozenLootLedger(bad, 38)).toThrow();
    for (const value of [null, {}, [], undefined, { ...ledger, rng: { state: NaN, draws: 5 } }]) {
      expect(() => restoreFrozenLootLedger(value, { seed: 0, throughRoundOrdinal: 10 })).toThrow();
    }
  });

  const pendingCorruptions: [string, (choice: any) => void][] = [
    ['kind', c => { c.kind = 'augment'; }], ['generation', c => { c.generation = 1; }],
    ['negative generation', c => { c.generation = -1; }], ['string generation', c => { c.generation = '0'; }],
    ['step', c => { c.step = 'target'; }], ['returnPhase', c => { c.returnPhase = 'preparation'; }],
    ['missing returnPhase', c => { delete c.returnPhase; }], ['choiceId', c => { c.choiceId = '["supply","1-3"]'; }],
    ['eventId', c => { c.eventId = 'supply-1-3'; }], ['candidate order', c => { c.offers.reverse(); }],
    ['missing glove', c => { c.offers.splice(6, 1); }], ['duplicate candidate', c => { c.offers[6] = 'sword'; }],
    ['completed item', c => { c.offers[6] = 'deathblade'; }], ['targetId', c => { c.targetId = 'unit-1'; }],
    ['rerollCount', c => { c.rerollCount = 1; }], ['leaked fallback', c => { c.terminalFallbackDefinitionId = 'belt'; }],
  ];
  it.each(pendingCorruptions)('rejects corrupt pending %s before projection, without normalization', (_name, mutate) => {
    const descriptor = round(freezeLootThroughRound(0, 2), '1-3').choices[0];
    const pending = jsonCopy(makeLootPendingChoice(descriptor));
    mutate(pending);
    const before = JSON.stringify(pending);
    expect(() => validateLootPendingChoice(pending, descriptor)).toThrow();
    expect(JSON.stringify(pending)).toBe(before);
  });
});
