import { expect, it } from 'vitest';
import { createMatch, createCarouselMatch } from './fixtures/recorded-match';
import { selectOpeningUnit } from '../src/simulation/opening-unit';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { createSharedPool, initializeSharedSeat, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { serializeMatch, restoreMatch } from './fixtures/history-evidence';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { validateB8Resources } from '../src/simulation/b8-restore';
import { generateShop } from '../src/simulation/shop';

const hero = (state: ReturnType<typeof createMatch>) => state.preparation.units.find(u => u.id === 'unit-1')!;
it('uses a dedicated reproducible stream with independently calculated seed/seat vectors', () => {
  expect(SHOP_CATALOG_BY_COST[1]).toHaveLength(14);
  // FNV-1a UTF-16 namespace, XOR 0x6f706844, then one lcg32-v1 word and full-word scaling.
  expect(selectOpeningUnit(42)).toBe('irelia');
  expect(selectOpeningUnit(3328)).toBe('trundle');
  expect(createMatch(42)).toEqual(createMatch(42));
  const state = createMatch(42);
  expect(state.shop).toEqual(generateShop(42, 1, 1).shop);
  expect(state.rngState).toBe(generateShop(42, 1, 1).rngState);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  expect(hero(createCarouselMatch(42))).toEqual(hero(state));
  expect(hero(state)).toEqual({ id:'unit-1',definitionId:'irelia',team:'player',starLevel:1,location:{kind:'board',cell:{col:1,row:4}} });
  expect([state.gold,state.level,state.xp,state.playerHp,state.nextUnitSerial]).toEqual([0,1,0,100,2]);
});
it('draws every seat independently from the game seed, permits collisions and debits one shared copy', () => {
  let pool = createSharedPool('opening-test',42);
  const states = [];
  const expected = ['steb','singed','maddie','violet','trundle','singed','powder','maddie'];
  for (let i=0;i<8;i++) {
    // Seat-local shop/loot seeds deliberately differ from the authoritative game seed.
    const joined = initializeSharedSeat(pool,createMatch(100+i,{mode:'shared-deferred'}),`seat-${i}`,i);
    if (!joined.ok) throw new Error(joined.reason);
    pool = joined.pool; states.push(joined.state);
    expect(hero(joined.state).definitionId).toBe(expected[i]);
    expect(() => validateB8Resources(joined.state)).not.toThrow();
  }
  expect(new Set(expected).size).toBeGreaterThan(1);
  for (const id of SHOP_CATALOG_BY_COST[1]) expect(pool.available[id]).toBe(30-expected.filter(x=>x===id).length);
  expect(pool.available.maddie).toBe(28);
  expect(pool.holdings).toHaveLength(8);
  expect(pool.shops).toEqual([]);
  assertSharedPoolConservation(pool,states);
});
it('uses the same selection in solo and shared modes and preserves baseline random 1-2/1-3 reward plans', () => {
  const solo = createMatch(42);
  const joined = initializeSharedSeat(createSharedPool('solo-comparison',42),createMatch(99,{mode:'shared-deferred'}),'solo',0);
  if (!joined.ok) throw new Error(joined.reason);
  expect(hero(joined.state).definitionId).toBe(hero(solo).definitionId);
  expect(joined.state.choiceRngState).toBe(createMatch(99,{mode:'shared-deferred'}).choiceRngState);
  expect(joined.state.rewardRngState).toBe(createMatch(99,{mode:'shared-deferred'}).rewardRngState);
  const candidates = ['darius','irelia','lux','maddie','zyra'];
  const seen = new Set<string>();
  for (const seed of [...Array.from({length:100},(_,i)=>i),3328,4166519247,0xffffffff]) {
    // Independent baseline sampler: loot seed XOR, lcg32-v1 rejection, modulo 5.
    let word = BigInt((seed ^ 0xdeadbeef) >>> 0), draws = 0;
    const draw = (size: number) => {
      const n = BigInt(size), limit = (4294967296n / n) * n;
      do { word = (word * 1664525n + 1013904223n) % 4294967296n; draws++; } while (word >= limit);
      return Number(word % n);
    };
    const expected = [candidates[draw(5)],candidates[draw(5)]];
    draw(8); // 1-3 component follows the two unit words, as on multiplayer.
    const frozen = prepareMatchLoot(seed,2).frozen;
    const actual = frozen.rounds.map(p=>p.encounterPlan.drops.filter(d=>d.payload.kind==='unit').map(d=>d.payload.kind==='unit'?d.payload.definitionId:''));
    expect(actual).toEqual(expected.map(id=>[id]));
    expect(frozen.rng).toEqual({state:Number(word),draws});
    actual.flat().forEach(id=>seen.add(id));
  }
  expect([...seen].sort()).toEqual([...candidates].sort());
  expect(() => selectOpeningUnit(-1)).toThrow();
  expect(() => selectOpeningUnit(42,'')).toThrow();
});
it('rejects opening provenance tampering and never retries an exhausted selected hero', () => {
  const solo = createMatch(42);
  const source = solo.resourceProvenance.entries[0];
  if (source.kind !== 'unit-acquired' || source.source.kind !== 'opening') throw new Error('missing opening');
  expect(() => restoreMatch({...solo, resourceProvenance:{...solo.resourceProvenance,entries:[{...source,source:{...source.source,seed:1}},...solo.resourceProvenance.entries.slice(1)]}})).toThrow();
  const pool = createSharedPool('empty-selected',42,{capacities:{irelia:30}});
  const initial = createMatch(100,{mode:'shared-deferred'});
  const snapshot = structuredClone({pool,initial});
  const result = initializeSharedSeat(pool,initial,'seat-0',0); // seed 42/seat-0 draws Steb, whose capacity is zero.
  expect(result).toEqual({ok:false,pool,state:initial,reason:'pool-empty'});
  expect(result.pool).toBe(pool); expect(result.state).toBe(initial);
  expect({pool,initial}).toEqual(snapshot);
  const replayA=initializeSharedSeat(createSharedPool('repeat',42),initial,'seat-0',0);
  const replayB=initializeSharedSeat(createSharedPool('repeat',42),structuredClone(initial),'seat-0',0);
  expect(replayA).toEqual(replayB);
});
