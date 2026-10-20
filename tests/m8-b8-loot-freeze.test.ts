import { EPIC_SOURCES } from '../src/simulation/content/orbs';
import { lootPlan } from './fixtures/m5/oracle.g2.cjs';
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
import { compareLootChoices, compareLootFreezeSlots, lootChoiceId, lootDropId, lootReceiptId, lootOrbId, lootEntryId } from '../src/simulation/loot-identity';
import type { FrozenLootLedger, LootChoiceDescriptor, LootChoiceEligibility, LootChoiceResolution } from '../src/simulation/loot-types';
import { M5_UNIT_DEFINITIONS } from '../src/simulation/units';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

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
const slot = (sourceSlotId:string,slotOrdinal:number,tier:string,templateId:string)=>({sourceSlotId,slotOrdinal,tier,templateId});
const EXPECTED_SLOTS:Readonly<Record<string,readonly ReturnType<typeof slot>[]>> = {
 '1-2':[slot('m01',0,'gray','opening-unit')],
 '1-3':[slot('m01',0,'gray','opening-unit'),slot('r01',0,'blue','component')],
 '1-4':[slot('m01',0,'gray','remover'),slot('r01',0,'blue','component'),slot('r02',0,'blue','opening-bonus')],
 '2-7':[slot('k01',0,'blue','equipment'),slot('k01',1,'gray','gray-1')],
 '3-7':[slot('w00',0,'blue','equipment'),slot('w00',1,'gray','gray-2')],
 '4-7':[slot('r00',0,'blue','equipment'),slot('r00',1,'gray','gray-3')],
};
// Retained pure legacy helper contracts use an explicit synthetic descriptor.
// Current frozen PvE plans must never generate these descriptors.
const legacyChoice:LootChoiceDescriptor={roundId:'1-3',encounterId:'minions-b-v1',sourceUnitId:'r01',slotOrdinal:0,
 dropId:JSON.stringify(['1-3','minions-b-v1','r01',0]),kind:'component-choice',quantity:1,poolVersion:'m8b-components-v1',
 terminalFallbackDefinitionId:'tear',revealCondition:'source-killed'};
const ENCOUNTERS = [
  ['1-2', 'minions-a-v1', 1], ['1-3', 'minions-b-v1', 2], ['1-4', 'minions-c-v1', 3],
  ['2-7', 'krugs-v1', 10], ['3-7', 'wolves-v1', 17], ['4-7', 'razorbeaks-v1', 24],
  ['5-7', 'elder-dragon-v1', 31], ['6-7', 'rift-herald-v1', 38],
] as const;
const jsonCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const round = (ledger: FrozenLootLedger, id: string) => ledger.rounds.find(r => r.encounterPlan.roundId === id)!;

describe('B8 checkpoint ① approved, bounded loot content', () => {
  it('pins all eight source/slot tables and explicitly excludes every no-loot monster', () => {
    expect(LOOT_POLICY_VERSION).toBe('s13-orbs-project-v16');
    expect(LOOT_HERO_POOL_VERSION).toBe('m8b-heroes-1to4-v1');
    expect(LOOT_SLOTS).toEqual(EXPECTED_SLOTS);
    expect(ROUND_CATALOG.filter(r => r.kind === 'pve').map(r => [r.roundId, r.encounterId, r.ordinal])).toEqual(ENCOUNTERS);
    expect(NEUTRAL_ENCOUNTERS.map(e => [e.roundId, e.slots.filter(s => !(LOOT_SLOTS[e.roundId]??[{sourceSlotId:EPIC_SOURCES[e.roundId as keyof typeof EPIC_SOURCES]}]).some(d => d.sourceSlotId === s.slotId)).map(s => s.slotId)])).toEqual([
      ['1-2', ['m02']], ['1-3', ['m02']], ['1-4', ['m02']], ['2-7', ['k02','k03']],
      ['3-7', ['w01','w02', 'w03', 'w04']], ['4-7', ['r01','r02', 'r03', 'r04', 'r05']], ['5-7', []], ['6-7', []],
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

describe('T13 independent full-route RNG vectors', () => {
  it.each([5,0,1,49,230,3735928559])('seed %i matches the independently transcribed signed orb oracle', seed=>{
    const actual=freezeLootThroughRound(seed,38),expected=lootPlan(seed,38);
    expect(actual.rng).toEqual(expected.rng);expect(actual.rounds).toEqual(expected.rounds);
    expect(actual.rounds.flatMap(r=>r.choices)).toEqual([]);
    expect(freezeLootThroughRound(seed,31).rng).toEqual(lootPlan(seed,31).rng);
  });
  it('preserves seed zero and XOR zero, counting the random opening heroes',()=>{
    for(const seed of [0,3735928559])for(const ordinal of [0,1,2,3]){
      const actual=freezeLootThroughRound(seed,ordinal),expected=lootPlan(seed,ordinal);
      expect(actual.rng).toEqual(expected.rng);expect(actual.rounds).toEqual(expected.rounds);
    }
  });
  it('pins every entered boundary, preserves prefix identities, and consumes no PvP/supply words',()=>{
    let current=freezeLootThroughRound(0,0);
    for(let ordinal=0;ordinal<=38;ordinal++){
      const previous=current;current=advanceFrozenLootLedger(current,ordinal);
      previous.rounds.forEach((r,i)=>expect(current.rounds[i]).toBe(r));
      expect(current.rng).toEqual(lootPlan(0,ordinal).rng);expect(current.rounds).toEqual(lootPlan(0,ordinal).rounds);
      expect(advanceFrozenLootLedger(current,ordinal)).toBe(current);
      expect(restoreFrozenLootLedger(jsonCopy(current),{seed:0,throughRoundOrdinal:ordinal})).toEqual(current);
    }
    expect(()=>advanceFrozenLootLedger(current,37)).toThrow();
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
      expect(r.encounterPlan).toMatchObject({ roundId, encounterId, policyVersion: 'm8b-pve-project-v2' });
      for (const expected of EXPECTED_SLOTS[roundId]??lootPlan(0,38).rounds.find(r=>r.encounterPlan.roundId===roundId)!.orbs.map(o=>({sourceSlotId:EPIC_SOURCES[roundId as keyof typeof EPIC_SOURCES],slotOrdinal:o.slotOrdinal}))) {
        const sourceUnitId=JSON.stringify(['pve',roundId,encounterId,expected.sourceSlotId]);
        const orbId=JSON.stringify(['orb',roundId,encounterId,sourceUnitId,expected.slotOrdinal]);
        expect(lootOrbId(roundId,encounterId,sourceUnitId,expected.slotOrdinal)).toBe(orbId);
        const orb=r.orbs.find(o=>o.orbId===orbId)!;expect(orb).toBeDefined();
        for(const [entryOrdinal,drop] of orb.entries.entries()){
          const dropId=JSON.stringify([orbId,entryOrdinal]);expect(drop.dropId).toBe(dropId);
          expect(lootEntryId(orbId,entryOrdinal)).toBe(dropId);
          expect(lootReceiptId(dropId)).toBe(JSON.stringify([dropId,'grant']));
          expect(lootChoiceId(dropId)).toBe(JSON.stringify(['m8b-loot-choice',dropId]));allIds.push(dropId);
        }
      }
      for (const drop of r.encounterPlan.drops) {
        expect(drop).toMatchObject({ status: 'planned', receiptId: null });
        expect(['gold', 'unit', 'item','consumable','forge']).toContain(drop.payload.kind);
        expect(drop).not.toHaveProperty('terminalFallbackDefinitionId');
      }
      for (const choice of r.choices) {
        expect(choice).toMatchObject({ kind: 'component-choice', poolVersion: 'm8b-components-v1', quantity: 1 });
        for (const field of ['payload', 'itemId', 'status', 'receiptId', 'definitionId']) expect(choice).not.toHaveProperty(field);
      }
    }
    expect(allIds.length).toBeGreaterThan(15);
    expect(new Set(allIds).size).toBe(allIds.length);
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
    const template = legacyChoice;
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
    expect(ledger.rounds.flatMap(r => r.choices)).toEqual([]);
    for (const descriptor of [legacyChoice]) {
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
    expect(LOOT_FREEZE_VERSION).toBe('s13-orb-freeze-v16');
    expect(ledger).toMatchObject({ version: 's13-orb-freeze-v16', seed: 0, replayDigest: LOOT_REPLAY_DIGEST, throughRoundOrdinal: 38 });
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
      .toEqual([]);
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
    ['removed PvE choice injected',s=>{s.rounds[1].choices=[legacyChoice];}],
    ['orb tier',s=>{s.rounds[0].orbs[0].tier='prismatic';}],
    ['orb template',s=>{s.rounds[0].orbs[0].templateId='terminal';}],
    ['orb entry mismatch',s=>{s.rounds[0].orbs[0].entries.reverse();}],
    ['entry ordinal',s=>{s.rounds[1].encounterPlan.drops[0].entryOrdinal=99;}],
    ['extra nested authority',s=>{s.rounds[0].orbs[0].offers=['sword'];}],
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
    bad.rounds[1].orbs[0].tier = 'prismatic';
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
    const descriptor = legacyChoice;
    const pending = jsonCopy(makeLootPendingChoice(descriptor));
    mutate(pending);
    const before = JSON.stringify(pending);
    expect(() => validateLootPendingChoice(pending, descriptor)).toThrow();
    expect(JSON.stringify(pending)).toBe(before);
  });
});
