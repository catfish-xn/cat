import { describe, expect, it } from 'vitest';
import { augmentCandidates, deriveAugmentTier, deriveAugmentTierSequence, resolveAugmentTier } from '../src/simulation/augment-offers';
import { AUGMENT_OFFER_POLICY, AUGMENT_TIER_COMBINATIONS, AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { createMatch, selectChoice } from '../src/simulation/match';
import { generateChoices } from '../src/simulation/choices';
import { createOpeningEncounter } from '../src/simulation/opening-encounter';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { room } from './tp-helpers';
import { accepted, reachRound } from './match-helpers';

const nodes = ['round:2-1:augment','round:3-2:augment','round:4-2:augment'];
const abbreviations = {silver:'S',gold:'G',prismatic:'P'};
const key = (tiers: readonly ('silver'|'gold'|'prismatic')[]) => tiers.map(t => abbreviations[t]).join('');
// Independent transcription of the approved 14.24 client CSV; zero rows excluded.
const table = [['SSG',5],['SSP',5],['SGG',12],['SGP',5],['SPP',1],['GSG',18],['GSP',2],['GGG',22],['GGP',12],['GPS',6],['GPG',10],['GPP',1],['PSG',4],['PSP',1],['PGG',2],['PGP',1],['PPG',1],['PPP',1]] as const;

function oracleTicket(seed: number): number {
  let hash = 2166136261n;
  for (const ch of 'augment-tier-sequence-v1') hash = ((hash ^ BigInt(ch.charCodeAt(0))) * 16777619n) & 0xffffffffn;
  const input = BigInt(seed) ^ 0x61756774n ^ hash;
  return Number(((input * 1664525n + 1013904223n) & 0xffffffffn) % 109n);
}

it('freezes the exact 18 nonzero client rows and denominator 109 into the digest policy', () => {
  expect(AUGMENT_TIER_COMBINATIONS.map(row => [key(row.tiers),row.weight])).toEqual(table);
  expect(AUGMENT_TIER_COMBINATIONS.reduce((sum,row) => sum + row.weight,0)).toBe(109);
  expect(AUGMENT_OFFER_POLICY.tierWeightTotal).toBe(109);
  expect(AUGMENT_OFFER_POLICY.tierCombinations).toBe(AUGMENT_TIER_COMBINATIONS);
  expect(Object.isFrozen(AUGMENT_TIER_COMBINATIONS)).toBe(true);
  expect(AUGMENT_TIER_COMBINATIONS.every(row => Object.isFrozen(row) && Object.isFrozen(row.tiers))).toBe(true);
});

// Hand vectors: FNV stream hash 0x9cacfe8b, seed xor namespace xor hash,
// first LCG word mod 109; intervals [10,22)=SGG, [28,46)=GSG, [48,70)=GGG, [88,98)=GPG.
it.each([[0,19,'SGG'],[1,33,'GSG'],[42,62,'GGG'],[0x80000000,36,'GSG'],[0xffffffff,93,'GPG']] as const)(
  'matches independent hand vector seed %s / ticket %s / %s', (seed,ticket,expected) => {
    expect(oracleTicket(seed)).toBe(ticket);
    expect(key(deriveAugmentTierSequence(seed))).toBe(expected);
  });

it('offers Geniuses only at prismatic tier, preserving owned and removed exclusion', () => {
  expect(AUGMENT_TIERS.geniuses).toBe('prismatic');
  expect(augmentCandidates('prismatic',[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]})).toContain('geniuses');
  for (const tier of ['silver','gold'] as const) expect(augmentCandidates(tier,[])).not.toContain('geniuses');
  expect(augmentCandidates('prismatic',[{definitionId:'geniuses',choiceId:nodes[0],acquiredRound:4}])).not.toContain('geniuses');
  expect(augmentCandidates('prismatic',[],['geniuses'])).not.toContain('geniuses');
});

it('public prismatic Geniuses acquisition restores the same offer history, grants and RNG', () => {
  let root = -1;
  for (let seed=0; seed<20000; seed++) {
    if (createOpeningEncounter(seed).selection.encounterId!=='none' || deriveAugmentTierSequence(seed)[0]!=='prismatic') continue;
    const initial = createMatch(seed);
    if (generateChoices(augmentCandidates('prismatic',[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),initial.choiceRngState).offers.includes('geniuses')) { root=seed; break; }
  }
  expect(root).toBeGreaterThanOrEqual(0);
  const state = reachRound('2-1',false,root), c = state.pendingChoice!;
  expect(c.augmentTier).toBe('prismatic'); expect(c.offers).toContain('geniuses');
  const selected = accepted(selectChoice(state,c.choiceId,c.generation,'geniuses'));
  expect(selected.augments.at(-1)?.definitionId).toBe('geniuses');
  for (const id of ['heimerdinger','ekko']) expect(selected.preparation.units.some(u=>u.definitionId===id)).toBe(true);
  expect([selected.rngState,selected.choiceRngState,selected.rewardRngState,selected.battleSeedRngState])
    .toEqual([state.rngState,state.choiceRngState,state.rewardRngState,state.battleSeedRngState]);
  expect(restoreMatch(serializeMatch(selected))).toEqual(selected);
  const retry = selectChoice(selected,c.choiceId,c.generation,'geniuses');
  expect(retry.ok).toBe(false); expect(retry.state).toBe(selected);
});

it('uses exactly the first word of the private stream, covers all ticket boundaries and ignores node access order', () => {
  const tickets = new Set<number>();
  for (const seed of [...Array.from({length:2048},(_,i)=>i),0x80000000,0xffffffff]) {
    let ticket = oracleTicket(seed); tickets.add(ticket);
    const expected = table.find(([,weight]) => ticket < weight || (ticket -= weight, false))![0];
    expect(key(deriveAugmentTierSequence(seed))).toBe(expected);
    for (const index of [2,0,1,2]) expect(abbreviations[deriveAugmentTier(seed,nodes[index])]).toBe(expected[index]);
  }
  expect(tickets.size).toBe(109);
  expect(() => deriveAugmentTier(42,'round:5-2:augment')).toThrow('Unknown augment tier node');
});

it('matches all combination weights across 109000 distinct roots within a fixed frequency error bound', () => {
  const sampleSize = 109000, counts = new Map<string,number>();
  for (let seed=0; seed<sampleSize; seed++) {
    const combination = key(deriveAugmentTierSequence(seed));
    counts.set(combination,(counts.get(combination) ?? 0)+1);
  }
  expect(counts.size).toBe(18);
  for (const [combination,weight] of table) {
    const expected = sampleSize * weight / 109;
    // Six binomial standard deviations plus one count; deterministic, with no statistical flakiness.
    const bound = 6 * Math.sqrt(expected * (1-weight/109)) + 1;
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
