import { describe, expect, it } from 'vitest';
import { deriveAugmentTier, deriveAugmentTierSequence, resolveAugmentTier } from '../src/simulation/augment-offers';
import { AUGMENT_OFFER_POLICY, AUGMENT_TIER_COMBINATIONS } from '../src/simulation/content/augment-policy';
import { createMatch } from '../src/simulation/match';
import { createOpeningEncounter } from '../src/simulation/opening-encounter';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { room } from './tp-helpers';
import { reachRound } from './match-helpers';

const nodes = ['round:2-1:augment','round:3-2:augment','round:4-2:augment'];
const abbreviations = {silver:'S',gold:'G',prismatic:'P'};
const key = (tiers: readonly ('silver'|'gold'|'prismatic')[]) => tiers.map(t => abbreviations[t]).join('');
// Independent transcription of the approved source, including its rounded denominator.
const table = [['SSG',25],['SGG',15],['GSG',12],['GGG',10],['SSP',6],['GSS',5],['PSG',5],['SGP',4],
  ['PGG',4],['GGP',3],['SPS',3],['GPG',3],['GSP',2],['PPP',2],['PSP',1],['SPP',1]] as const;

function oracleTicket(seed: number): number {
  let hash = 2166136261n;
  for (const ch of 'augment-tier-sequence-v1') hash = ((hash ^ BigInt(ch.charCodeAt(0))) * 16777619n) & 0xffffffffn;
  const input = BigInt(seed) ^ 0x61756774n ^ hash;
  return Number(((input * 1664525n + 1013904223n) & 0xffffffffn) % 101n);
}

it('freezes the exact 16 source rows and the rounded denominator 101 into the digest policy', () => {
  expect(AUGMENT_TIER_COMBINATIONS.map(row => [key(row.tiers),row.weight])).toEqual(table);
  expect(AUGMENT_TIER_COMBINATIONS.reduce((sum,row) => sum + row.weight,0)).toBe(101);
  expect(AUGMENT_OFFER_POLICY.tierWeightTotal).toBe(101);
  expect(AUGMENT_OFFER_POLICY.tierCombinations).toBe(AUGMENT_TIER_COMBINATIONS);
  expect(Object.isFrozen(AUGMENT_TIER_COMBINATIONS)).toBe(true);
  expect(AUGMENT_TIER_COMBINATIONS.every(row => Object.isFrozen(row) && Object.isFrozen(row.tiers))).toBe(true);
});

it('uses exactly the first word of the private stream, covers all ticket boundaries and ignores node access order', () => {
  const tickets = new Set<number>();
  for (const seed of [...Array.from({length:2048},(_,i)=>i),0x80000000,0xffffffff]) {
    let ticket = oracleTicket(seed); tickets.add(ticket);
    const expected = table.find(([,weight]) => ticket < weight || (ticket -= weight, false))![0];
    expect(key(deriveAugmentTierSequence(seed))).toBe(expected);
    for (const index of [2,0,1,2]) expect(abbreviations[deriveAugmentTier(seed,nodes[index])]).toBe(expected[index]);
  }
  expect(tickets.size).toBe(101);
  expect(() => deriveAugmentTier(42,'round:5-2:augment')).toThrow('Unknown augment tier node');
});

it('matches all combination weights across 101000 distinct roots within a fixed frequency error bound', () => {
  const sampleSize = 101000, counts = new Map<string,number>();
  for (let seed=0; seed<sampleSize; seed++) {
    const combination = key(deriveAugmentTierSequence(seed));
    counts.set(combination,(counts.get(combination) ?? 0)+1);
  }
  expect(counts.size).toBe(16);
  for (const [combination,weight] of table) {
    const expected = sampleSize * weight / 101;
    // Six binomial standard deviations plus one count; deterministic, with no statistical flakiness.
    const bound = 6 * Math.sqrt(expected * (1-weight/101)) + 1;
    expect(Math.abs(counts.get(combination)!-expected),combination).toBeLessThan(bound);
  }
});

const encounterSeeds = new Map<string,number>();
for (let seed=0; seed<20000 && encounterSeeds.size<16; seed++) {
  const id = createOpeningEncounter(seed).selection.encounterId;
  if (!encounterSeeds.has(id)) encounterSeeds.set(id,seed);
}

describe.each(['none','golden-gala','prismatic-party','prismatic-prelude','prismatic-finale'])('%s shared combination and overrides', id => {
  it('uses the same root in solo and all eight seats, preserves unspecified positions and survives JSON restore', () => {
    const seed = encounterSeeds.get(id)!;
    expect(seed).toBeDefined();
    const solo = createMatch(seed), {pool,states} = room(undefined,8,seed);
    const sequence = deriveAugmentTierSequence(seed);
    const expected = sequence.map((tier,index) => id==='golden-gala' ? 'gold'
      : id==='prismatic-party' || id==='prismatic-prelude' && index===0 || id==='prismatic-finale' && index===2 ? 'prismatic' : tier);
    expect(states.every(state => state.augmentTierSeed===seed && state.seed!==seed)).toBe(true);
    const before = JSON.stringify({pool,states});
    const saved = JSON.parse(before);
    for (const [index,node] of nodes.entries()) {
      expect(resolveAugmentTier(solo,node)).toBe(expected[index]);
      for (const state of states) expect(resolveAugmentTier(state,node)).toBe(expected[index]);
      for (const raw of saved.states) {
        const restored = restoreSharedOrbSnapshot(saved.pool,raw);
        expect(resolveAugmentTier(restored,node)).toBe(expected[index]);
      }
    }
    expect(JSON.stringify({pool,states})).toBe(before);
  });
});

it('restores an opened solo offer and keeps all future tier positions without advancing any stored RNG', () => {
  const seed = encounterSeeds.get('none')!, state = reachRound('2-1',false,seed);
  const restored = restoreMatch(serializeMatch(state));
  expect(restored).toEqual(state);
  const before = JSON.stringify(restored);
  expect(nodes.map(node=>resolveAugmentTier(restored,node))).toEqual(deriveAugmentTierSequence(seed));
  expect(state.pendingChoice!.augmentTier).toBe(deriveAugmentTierSequence(seed)[0]);
  expect(JSON.stringify(restored)).toBe(before);
});
