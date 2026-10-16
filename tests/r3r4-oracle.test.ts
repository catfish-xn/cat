import { describe, expect, it } from 'vitest';
import { freezeLootThroughRound, drawLootIndex } from '../src/simulation/loot-freeze';
import { createOrbLayout, freezeOrbLayoutThroughRound } from '../src/simulation/orb-layout';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';

// Independent specification oracle: BigInt arithmetic, literal signed tables,
// no production random, layout, slot or reward-table helpers.
const components = ['sword','vest','belt','rod','cloak','bow','gloves','tear'];
const heroes = [['darius','irelia','lux','maddie','zyra'],['leona','vander','rell','tristana','urgot'],
  ['loris','ezreal','scar','kogmaw','nami'],['corki','garen','zoe']];
const rounds = ['1-2','1-3','1-4','2-7','3-7','4-7','5-7','6-7'];
const sources = [['m01'],['m01','r01'],['m01','r01','r02'],['k01','k01'],['w00','w00'],['r00','r00'],['d01','d01'],['h01']];
function stream(seed:number) {
  let state=BigInt(seed>>>0),draws=0;
  return { draw(n:number) {const size=BigInt(n),limit=(4294967296n/size)*size;
    do {state=(1664525n*state+1013904223n)%4294967296n;draws++;} while(state>=limit);
    return Number(state%size);
  }, value:()=>({state:Number(state),draws}) };
}
const gold=(quantity:number)=>({kind:'gold',quantity});
const item=(definitionId:string)=>({kind:'item',definitionId,quantity:1});
const tool=(definitionId:string)=>({kind:'consumable',definitionId,quantity:1});
function oracle(seed:number,roomSeed=seed) {
  const layout=stream((roomSeed^0x4f524253)>>>0),contents=stream((seed^0xdeadbeef)>>>0);
  const completed=Object.values(ITEM_DEFINITIONS).filter(d=>d.kind==='completed').sort((a,b)=>a.apiName!<b.apiName!?-1:1).map(d=>d.id);
  const component=()=>item(components[contents.draw(8)]);
  const hero=(cost:number)=>({kind:'unit',definitionId:heroes[cost-1][contents.draw(heroes[cost-1].length)],quantity:1});
  const remover=()=>tool('magnetic-remover');
  const plans=rounds.map((roundId,index)=>{
    const tiers:string[]=[], payloads:ReturnType<typeof gold | typeof item | typeof hero>[][]=[];
    if(index===0){hero(1);tiers.push('gray');payloads.push([{kind:'unit',definitionId:'maddie',quantity:1},remover()]);}
    else if(index===1){hero(1);tiers.push('gray','blue');payloads.push([{kind:'unit',definitionId:'lux',quantity:1},remover()],[component()]);}
    else if(index===2){const extra=layout.draw(100)<50;tiers.push('gray','blue',extra?'blue':'gray');payloads.push([remover()],[component()],extra?[component()]:[gold(3)]);}
    else if(index===7){tiers.push('gray');payloads.push([gold(5),remover()]);}
    else {
      const bucket=layout.draw(100),cost=index-2;
      tiers.push(bucket<90?'blue':bucket<99?'gold':'prismatic','gray');
      payloads.push(bucket<90?[component(),component()]:bucket<99?[component(),component(),gold(4)]
        :[item(completed[contents.draw(36)]),gold(8),tool('component-reforger'),tool('completed-reforger')]);
      const base=contents.draw(100),threshold=cost===4?80:75;
      const gray=[base<threshold?gold(cost===4&&base>=70?5:cost):hero(cost),remover()];
      const extra=contents.draw(100);if(extra>=80)gray.push(tool(extra<90?'component-reforger':'completed-reforger'));
      payloads.push(gray);
    }
    return {roundId,tiers,payloads};
  });
  return {plans,layoutRng:layout.value(),lootRng:contents.value()};
}
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
        expect(round.orbs.map(o=>JSON.parse(o.sourceUnitId)[3])).toEqual(sources[r]);
        expect(round.orbs.map(o=>o.slotOrdinal)).toEqual(r>=3&&r<=6?[0,1]:sources[r].map(()=>0));
        round.orbs.forEach(o=>seen.add(o.tier));
      }
      const entries=actual.rounds.flatMap(r=>r.encounterPlan.drops),equipment=entries.filter(e=>e.payload.kind==='item');
      const value=equipment.reduce((n,e)=>n+(ITEM_DEFINITIONS[(e.payload as {definitionId:string}).definitionId].kind==='completed'?2:1),0);
      expect([15,16]).toContain(value+5); // Five unchanged supply choices.
      expect(entries.filter(e=>e.payload.kind==='consumable'&&e.payload.definitionId==='magnetic-remover')).toHaveLength(8);
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
