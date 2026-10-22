import { describe, expect, it } from 'vitest';
import { createMatch, createCarouselMatch, selectChoice, rerollAugment, startMatchCombat, nextRound,
  type MatchState } from '../src/simulation/match';
import { OPENING_ENCOUNTERS, createOpeningEncounter, applyOpeningEffects, planOpeningRound,
  pendingOpeningForges, openOpeningForge, readOpeningEncounterProgress, validateOpeningEncounterState } from '../src/simulation/opening-encounter';
import { augmentCandidates, deriveAugmentTier, resolveAugmentTier, validateAugmentOfferHistory } from '../src/simulation/augment-offers';
import { FINAL_ROUND } from '../src/simulation/round-schedule';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { createSharedPool, initializeSharedSeat, runSharedMatchCommand, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { accepted, emptyBoard, freeze, reachRound, resolveM5Choices } from './match-helpers';

const seeds = new Map<string, number>();
for (let seed = 0; seeds.size < 16 && seed < 20000; seed++) {
  const id = createOpeningEncounter(seed).selection.encounterId;
  if (!seeds.has(id)) seeds.set(id, seed);
}
const policies = ['golden-gala','prismatic-party','prismatic-prelude','prismatic-finale'] as const;
const forges = ['component-anvils','artifact-anvil'] as const;
const nodes = ['2-1','3-2','4-2'];
const expectedTier = (id: string, seed: number, node: string) => id === 'golden-gala' ? 'gold'
  : id === 'prismatic-party' || id === 'prismatic-prelude' && node === '2-1'
    || id === 'prismatic-finale' && node === '4-2' ? 'prismatic' : deriveAugmentTier(seed, `round:${node}:augment`);

// Independent BigInt stream specification; neither the production hash nor sampling helper is used.
function forgeOracle(seed: number, seat: string, index: number, ids: readonly string[]) {
  let hash = 2166136261n;
  for (const ch of `opening-encounter-v1/seat/${seat}/anvil/${index}`) hash = ((hash ^ BigInt(ch.charCodeAt(0))) * 16777619n) & 0xffffffffn;
  let rng = BigInt(seed) ^ hash;
  const pool = [...ids].sort();
  for (let i = 0; i < 4; i++) {
    rng = (rng * 1664525n + 1013904223n) & 0xffffffffn;
    const j = i + Number(rng % BigInt(pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 4);
}
function room(seed: number, carousel = false) {
  let pool = createSharedPool('pr2', seed);
  const states: MatchState[] = [];
  for (let i = 0; i < 8; i++) {
    const raw = carousel ? createCarouselMatch(900 + i) : createMatch(900 + i, {mode: 'shared-deferred'});
    const result = initializeSharedSeat(pool, raw, `seat-${i}`, i);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.filter(e => e.type === 'openingEffectApplied')).toHaveLength(forges.includes(createOpeningEncounter(seed).selection.encounterId as typeof forges[number])
      ? createOpeningEncounter(seed).selection.encounterId === 'component-anvils' ? 2 : 1 : 1);
    pool = result.pool; states.push(result.state);
  }
  return {pool, states};
}

describe('PR2 augment constraints', () => {
  it.each(policies)('%s: three scheduled nodes, rerolls, owned/removed exclusion and history replay', id => {
    const seed = seeds.get(id)!;
    let state = reachRound('2-1', false, seed);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const discarded: string[] = [];
    for (const node of nodes) {
      while (state.roundDefinitionId !== node) {
        state = resolveM5Choices(state);
        // Isolated survival budget, as in augment-card-reroll.test; no claim of full save validity after HP injection.
        if (state.phase === 'preparation') state = accepted(startMatchCombat(emptyBoard({...state, playerHp: 100})));
        state = resolveM5Choices(state);
        state = accepted(nextRound(state, state.round));
      }
      const tier = expectedTier(id, seed, node);
      expect(state.pendingChoice).toMatchObject({kind: 'augment', augmentTier: tier});
      expect(state.pendingChoice!.offers.every(a => AUGMENT_TIERS[a] === tier && !discarded.includes(a)
        && !state.augments.some(owned => owned.definitionId === a))).toBe(true);
      for (const slot of [2,0,1]) {
        const c = state.pendingChoice!;
        discarded.push(c.offers[slot]);
        state = accepted(rerollAugment(freeze(state), c.choiceId, c.generation, slot));
        expect(state.pendingChoice!.offers.every(a => AUGMENT_TIERS[a] === tier && !discarded.includes(a)
          && !state.augments.some(owned => owned.definitionId === a))).toBe(true);
        expect(() => validateAugmentOfferHistory(state)).not.toThrow();
      }
    }
    expect(state.augmentOffers.map(r => r.tier)).toEqual(nodes.map(n => expectedTier(id, seed, n)));
  });
  it.each(['prismatic-prelude','prismatic-finale'])('%s: unforced nodes still allow all three equal-project tiers', id => {
    const tiers = new Set<string>();
    for (let seed = 0; seed < 20000; seed++) if (createOpeningEncounter(seed).selection.encounterId === id) {
      const context = createOpeningEncounter(seed);
      const state = {openingEncounter: {mode: 'solo' as const, context, receipts: []}, augmentTierSeed: seed};
      for (const node of id === 'prismatic-prelude' ? ['3-2','4-2'] : ['2-1','3-2']) {
        const choice = `round:${node}:augment`;
        expect(resolveAugmentTier(state, choice)).toBe(deriveAugmentTier(seed, choice));
        tiers.add(resolveAugmentTier(state, choice));
      }
      if (tiers.size === 3) break;
    }
    expect([...tiers].sort()).toEqual(['gold','prismatic','silver']);
  });
  it.each(policies)('%s: exhausted reroll is atomic and never falls back to another tier', id => {
    const state = reachRound('2-1', false, seeds.get(id)!); const c = state.pendingChoice!;
    const excluded = augmentCandidates(c.augmentTier!, [], c.offers);
    const before = freeze({...state, removedAugmentIds: excluded});
    const result = rerollAugment(before, c.choiceId, 0, 0);
    expect(result).toEqual({ok: false, state: before, reason: 'augment-pool-too-small'});
    expect(result.state).toBe(before);
    expect(toPrivateSeatView(before).pendingChoice!.augmentOptions!.every(o => !o.rerollAvailable)).toBe(true);
  });
  it('initial shortage refuses Continue before any income/shop/loot/RNG change', () => {
    let state = reachRound('1-4', true, seeds.get('golden-gala')!);
    state = resolveM5Choices(accepted(startMatchCombat(emptyBoard(state))));
    const pool = augmentCandidates('gold', []);
    const before = freeze({...state, removedAugmentIds: pool.slice(2)});
    const result = nextRound(before, before.round);
    expect(result).toEqual({ok: false, state: before, reason: 'augment-pool-too-small'});
    expect(result.state).toBe(before);
  });
  it.each(policies)('%s: restoration rejects forged tier and missing activation receipt', id => {
    const state = reachRound('2-1', false, seeds.get(id)!);
    expect(() => restoreMatch({...state, pendingChoice: {...state.pendingChoice!, augmentTier: 'invalid'}})).toThrow();
    expect(() => restoreMatch({...state, openingEncounter: {...state.openingEncounter, receipts: []}})).toThrow();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
});

describe('PR2 opening anvils', () => {
  it.each(forges)('%s: independent four-option oracle, sequential grants and exact restore after every choice', id => {
    const seed = seeds.get(id)!; let state = createMatch(seed);
    const count = id === 'component-anvils' ? 2 : 1;
    const context = createOpeningEncounter(seed), facts = planOpeningRound(context, '1-2').facts;
    expect(facts).toHaveLength(count);
    expect(planOpeningRound(context, '1-3').facts).toEqual([]);
    const originalStreams = [state.rngState, state.choiceRngState, state.rewardRngState, state.battleSeedRngState];
    for (let i = 0; i < count; i++) {
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      expect(applyOpeningEffects(state, facts)).toEqual({ok: true, state, events: []});
      expect(readOpeningEncounterProgress(state)).toMatchObject({forgesGranted: count, forgesPending: count-i, forgesResolved: i});
      const c = state.pendingChoice!;
      expect(c).toMatchObject({kind: 'forge', payload: {source: 'opening-encounter'}});
      expect(c.offers).toEqual(forgeOracle(seed, 'solo', i, id === 'component-anvils' ? G24_FORGE_POOLS.TFT_ArmoryKeyComponent : G24_FORGE_POOLS.TFT_ArmoryKeyOrnn));
      expect(new Set(c.offers).size).toBe(4);
      const before = freeze(state);
      expect(selectChoice(before, c.choiceId, c.generation, '@invalid')).toEqual({ok: false, state: before, reason: 'invalid-choice'});
      state = accepted(selectChoice(before, c.choiceId, c.generation, c.offers[2]));
      expect(state.items).toHaveLength(i + 1);
      expect(state.items.at(-1)?.definitionId).toBe(c.offers[2]);
      const repeated = selectChoice(state, c.choiceId, c.generation, c.offers[2]);
      expect(repeated.ok).toBe(false); expect(repeated.state).toBe(state);
      expect([state.rngState,state.choiceRngState,state.rewardRngState,state.battleSeedRngState]).toEqual(originalStreams);
    }
    expect(state.phase).toBe('preparation');
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    expect(pendingOpeningForges(state)).toEqual([]);
    expect(state.m8.loot.receipts).toEqual([]);
    expect(applyOpeningEffects(state, facts).state).toBe(state);
    const advanced = accepted(nextRound(resolveM5Choices(accepted(startMatchCombat(emptyBoard(state)))),1));
    expect(advanced.openingEncounter).toBe(state.openingEncounter);
    expect(pendingOpeningForges(advanced)).toEqual([]);
  });
  it.each(forges)('%s: tampered queue/offers/source/grant is rejected on restore', id => {
    const state = createMatch(seeds.get(id)!);
    const mutations = [
      (s: any) => {s.openingEncounter.receipts = [];},
      (s: any) => {s.openingEncounter.receipts.push(s.openingEncounter.receipts[0]);},
      (s: any) => {s.pendingChoice.offers.reverse();},
      (s: any) => {s.pendingChoice.payload.source = 'epic-loot';},
      (s: any) => {s.pendingChoice.payload.timeoutOption = s.pendingChoice.offers[1];},
      (s: any) => {s.phase = 'preparation'; s.pendingChoice = null;},
    ];
    for (const mutate of mutations) {const forged = structuredClone(state); mutate(forged); expect(() => restoreMatch(forged)).toThrow();}
    const c = state.pendingChoice!, chosen = accepted(selectChoice(state,c.choiceId,0,c.offers[1]));
    const forged = structuredClone(chosen);
    Object.assign(forged.seatMechanics!.receipts.at(-1)!, {timedOut: true});
    expect(() => restoreMatch(forged)).toThrow();
    if (id === 'component-anvils') {
      const reordered = structuredClone(state);
      Object.assign(reordered.openingEncounter, {receipts: [...(state.openingEncounter as any).receipts].reverse()});
      expect(() => restoreMatch(reordered)).toThrow();
    }
  });
  it('rejects fabricated effects and wrong nodes without changing state or RNG', () => {
    const state = freeze(createMatch(seeds.get('component-anvils')!));
    const result = applyOpeningEffects(state, [{factId:'fake',effectKey:'anvil/0',nodeId:'1-2'}]);
    expect(result).toEqual({ok:false,state,reason:'invalid-opening-effect'});expect(result.state).toBe(state);
  });
});

it.each([...policies,...forges])('%s: eight seats share policy, use private candidates and restore against the root', id => {
  const seed = seeds.get(id)!, {pool,states} = room(seed);
  for (const [i,state] of states.entries()) {
    expect(() => validateOpeningEncounterState(state,pool.openingEncounter)).not.toThrow();
    expect(restoreSharedOrbSnapshot(pool,JSON.stringify(state))).toEqual(state);
    for (const node of nodes) expect(resolveAugmentTier(state,`round:${node}:augment`)).toBe(expectedTier(id,seed,node));
    if (id === 'component-anvils' || id === 'artifact-anvil') {
      expect(state.pendingChoice!.offers).toEqual(forgeOracle(seed,`seat-${i}`,0,
        id === 'component-anvils' ? G24_FORGE_POOLS.TFT_ArmoryKeyComponent : G24_FORGE_POOLS.TFT_ArmoryKeyOrnn));
      const view = toPrivateSeatView(state);
      expect(view.openingEncounterProgress).toMatchObject({forgesPending:id==='component-anvils'?2:1});
      expect(view.openingEncounter).not.toHaveProperty('receipts');
      expect(view).not.toHaveProperty('augmentTierSeed');
    }
  }
  if (id === 'component-anvils' || id === 'artifact-anvil') expect(new Set(states.map(s=>JSON.stringify(s.pendingChoice!.offers))).size).toBeGreaterThan(1);
});

it.each([false,true])('two anvils: shared timeout drains one choice at a time, restores and rejects stale retries (carousel=%s)', carousel => {
  let {pool,states} = room(seeds.get('component-anvils')!,carousel), state = states[0];
  const others = JSON.stringify(states.slice(1));
  for (let i = 0; i < 2; i++) {
    const c = state.pendingChoice!;
    const command = {type:'timeoutChoice' as const,round:1,choiceId:c.choiceId,generation:0};
    const result = runSharedMatchCommand(pool,state,command);
    if (!result.ok) throw Error(result.reason);
    pool = result.pool;state = result.state;
    expect(state.items.at(-1)?.definitionId).toBe(c.offers[0]);
    expect(state.seatMechanics!.receipts.at(-1)).toMatchObject({source:'opening-encounter',timedOut:true});
    expect(restoreSharedOrbSnapshot(pool,state)).toEqual(state);
    const retry = runSharedMatchCommand(pool,state,command);
    expect(retry.ok).toBe(false);expect(retry.state).toBe(state);expect(retry.pool).toBe(pool);
    expect(applyOpeningEffects(state,planOpeningRound(pool.openingEncounter,'1-2').facts,pool.openingEncounter)).toEqual({ok:true,state,events:[]});
  }
  expect(state.items).toHaveLength(2);expect(state.pendingChoice).toBeNull();
  expect(JSON.stringify(states.slice(1))).toBe(others);
});

it('exactly six PR2 effects become enabled; unimplemented effects retain original weights and null evidence', () => {
  expect(OPENING_ENCOUNTERS.filter(e=>e.enabled).map(e=>e.id)).toEqual(['none',...policies,'component-anvils','artifact-anvil']);
  expect(OPENING_ENCOUNTERS.reduce((sum,e)=>sum+e.weightBps,0)).toBe(10000);
  expect(OPENING_ENCOUNTERS.find(e=>e.id==='gold-subscription')!.researchParameters).toMatchObject({amount_by_stage_and_bucket:null});
});

it('opening queue never replaces another active choice', () => {
  const state = createMatch(seeds.get('component-anvils')!);
  const busy = {...state, pendingChoice: {...state.pendingChoice!, choiceId:'another-choice',eventId:'another-choice'}} as MatchState;
  expect(openOpeningForge(busy)).toEqual({state:busy,events:[]});
  expect(openOpeningForge(busy).state).toBe(busy);
});
it('shared augment replay accepts overtime without looking up nonexistent scheduled nodes', () => {
  const {states} = room(seeds.get('golden-gala')!);
  // Schedule-boundary vector only: no future nodes exist, and this is not a complete online save fixture.
  expect(() => validateAugmentOfferHistory({...states[0],round:FINAL_ROUND+7})).not.toThrow();
});
