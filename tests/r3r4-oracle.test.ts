import { describe, expect, it } from 'vitest';
import { freezeLootThroughRound, drawLootIndex } from '../src/simulation/loot-freeze';
import { createOrbLayout, freezeOrbLayoutThroughRound } from '../src/simulation/orb-layout';
import { lootPlan as v17Plan } from './fixtures/orb-combo-oracle.cjs';

// Independent specification oracle: BigInt arithmetic, literal signed tables,
// no production random, layout, slot or reward-table helpers.
const rounds=['1-2','1-3','1-4','2-7','3-7','4-7','5-7','6-7'];
const oracle=(seed:number,roomSeed=seed)=>{const p=v17Plan(seed,38,roomSeed);return {plans:p.rounds.map(r=>({tiers:r.orbs.map(o=>o.tier),payloads:r.orbs.map(o=>o.entries.map(e=>e.payload))})),layoutRng:p.layoutRng,lootRng:p.rng};};
function stream(seed:number){let state=BigInt(seed>>>0),draws=0;return {draw(n:number){const size=BigInt(n),limit=4294967296n/size*size;do{state=(1664525n*state+1013904223n)%4294967296n;draws++;}while(state>=limit);return Number(state%size);},value:()=>({state:Number(state),draws})};}
describe('signed R3/R4 independent loot oracle',()=>{
  it('matches every PvE entry and both independent RNG cursors for 512 seeds',()=>{
    const seen=new Set<string>();
    for(let seed=0;seed<512;seed++) {
      const expected=oracle(seed),actual=freezeLootThroughRound(seed,38);
      const layout=freezeOrbLayoutThroughRound(createOrbLayout(seed),38);if(!layout.ok)throw Error(layout.reason);
      expect(actual.rng).toEqual(expected.lootRng);expect(layout.layout.rng).toEqual(expected.layoutRng);
      for(const [r,round] of actual.rounds.entries()) {
        expect(round.encounterPlan.roundId).toBe(rounds[r]);
        expect(round.orbs.map(o=>o.tier)).toEqual(expected.plans[r].tiers);
        expect(round.orbs.map(o=>o.entries.map(e=>e.payload))).toEqual(expected.plans[r].payloads);
        expect(round.orbs.map(o=>JSON.parse(o.sourceUnitId)[3])).toEqual(v17Plan(seed,38).rounds[r].orbs.map(o=>JSON.parse(o.sourceUnitId)[3]));
        expect(round.orbs.map(o=>o.slotOrdinal)).toEqual(v17Plan(seed,38).rounds[r].orbs.map(o=>o.slotOrdinal));
        round.orbs.forEach(o=>seen.add(o.tier));
      }
      expect(actual.rounds).toEqual(v17Plan(seed,38).rounds);
    }
    expect([...seen].sort()).toEqual(['blue','gold','gray','prismatic']);
  });
  it('uses the room stream for eight seats while each seat uses its own content stream',()=>{
    const layout=freezeOrbLayoutThroughRound(createOrbLayout(0),38);if(!layout.ok)throw Error(layout.reason);
    for(let seed=1;seed<=8;seed++) {
      const actual=freezeLootThroughRound(seed,38,layout.layout),expected=oracle(seed,0);
      expect(actual.rounds.map(r=>r.orbs.map(o=>o.entries.map(e=>e.payload)))).toEqual(expected.plans.map(r=>r.payloads));
      expect(actual.rng).toEqual(expected.lootRng);
    }
  });
  it.each([7,8,35,36,100])('counts rejected words at the uint32 threshold for n=%i',size=>{
    const limit=Math.floor(4294967296/size)*size;
    // Multiplicative inverse of 1664525 modulo 2^32; derives a seed for each next word.
    for(const word of new Set([limit-1,Math.min(limit,4294967295),4294967295])) {
      const seed=Number(((BigInt(word)-1013904223n)*4276115653n)&0xffffffffn);
      const expected=stream(seed),index=expected.draw(size);
      expect(drawLootIndex({state:seed,draws:0},size)).toEqual({index,rng:expected.value()});
    }
  });
});
