import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../src/simulation/match';
import { readAugmentGrowth } from '../src/simulation/augment-history';
import { applyRoundSettlement } from '../src/simulation/round-settlement';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { createSoloOpeningEncounter, openingEncounterId } from '../src/simulation/opening-encounter';
import { nextRandom } from '../src/simulation/rng';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { makeRoom, runUntil } from './server/helpers';
import { COST, Ledger, createH3Ledger, checkH3Growth, h3GrowthForUnit, type H3Ledger } from './fixtures/m5/oracle.g2.cjs';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const copy = <T>(x:T):Mutable<T> => structuredClone(x) as Mutable<T>;
type Transition = {before:MatchState;after:MatchState;memory:H3Ledger};
type Route = {trace:Transition[];final:MatchState;memory:H3Ledger};
const routes:Record<string,Route>={};

// All observations precede the checked transition. Expected growth never comes
// from a production planner, history reader, deserializer, or authority token.
function roomSeedFor(id:string) {
  for (let seed=0;seed<10000;seed++) {
    let seatSeed=seed;
    for (let index=0;index<4;index++) {
      seatSeed=nextRandom(seatSeed).word;
      const state={...createMatch(seatSeed),augmentTierSeed:seed,openingEncounter:createSoloOpeningEncounter(seed)};
      const tier=resolveAugmentTier(state,'round:2-1:augment');
      const offers=generateChoices(augmentCandidates(tier,[],[],openingEncounterId(state),{node:'2-1',fieldedTraits:[],blocked:[]}),state.choiceRngState).offers;
      if (offers.includes(id)) return {seed,seatId:`s${index}`};
    }
  }
  throw new Error(`No room offer for ${id} in 0..9999`);
}
for(const id of ['no-scout-no-pivot','cooking-pot'] as const) {
  beforeAll(()=>{
    const {seed,seatId}=roomSeedFor(id);
    const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed});
    const mine=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
    const trace:Transition[]=[];
    try {
      room.start();runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='preparation');
      const c=mine().pendingChoice!;expect(c.offers).toContain(id);
      let memory=createH3Ledger(mine());
      const command={type:'choose' as const,choiceId:c.choiceId,generation:c.generation,definitionId:id},before=mine();
      expect(room.handle(seatId,command)).toMatchObject({ok:true});memory=checkH3Growth(memory,before,mine(),command);
      const act=(command:Parameters<typeof room.handle>[1])=>{
        const before=mine();expect(room.handle(seatId,command)).toMatchObject({ok:true});memory=checkH3Growth(memory,before,mine(),{...command});
      };
      const slot=mine().shop.slots.findIndex(o=>o.status==='available'&&COST[o.definitionId]<=mine().gold);
      expect(slot).toBeGreaterThanOrEqual(0);act({type:'buy',slot,generation:mine().shop.generation});
      const units=mine().preparation.units.filter(u=>u.team==='player'&&COST[u.definitionId]);expect(units.length).toBeGreaterThanOrEqual(2);
      // Explicit placement makes the pre-freeze observation independent of auto-deploy.
      for(let i=0;i<2;i++)act({type:'deploy',unitId:units[i].id,target:{kind:'board',cell:{col:2+i,row:4}}});
      if(id==='cooking-pot') {
        const pan=mine().items.find(i=>i.definitionId==='frying-pan')!;expect(pan).toBeDefined();
        act({type:'equip',itemId:pan.id,unitId:units[0].id,slot:0});
      }
      for(let ticks=0;!(room.state.roundId==='2-2'&&room.state.phase==='preparation');ticks++) {
        expect(ticks).toBeLessThan(2000);const before=mine(),prior=memory;expect(clock.runNext()).toBe(true);
        const after=mine();memory=checkH3Growth(memory,before,after);trace.push({before,after,memory:prior});
      }
      expect(room.state.fault).toBeNull();
      const final=mine();
      // Holding either augment through a room disconnect/reconnect must preserve
      // receipts and independently computed growth, including the battle snapshot.
      const snapshot=snapshotForBattle(final,seatId);
      expect(room.setConnected(seatId,false)).toBe(true);expect(room.setConnected(seatId,true)).toBe(true);
      memory=checkH3Growth(memory,final,mine());expect(mine()).toEqual(final);
      expect(snapshotForBattle(mine(),seatId)).toEqual(snapshot);
      expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(mine()),room.augmentHistoryAuthority(seatId))).toEqual(final);
      routes[id]={trace,final,memory};
    } finally {room.dispose();}
  });
}
const growthStep=(id:string)=>routes[id].trace.find(t=>t.after.augmentHistory!.facts.filter(f=>f.kind==='growth').length>t.before.augmentHistory!.facts.filter(f=>f.kind==='growth').length)!;
const latestGrowth=(s:Mutable<MatchState>)=>s.augmentHistory!.facts.filter(f=>f.kind==='growth').at(-1)!;

it('Ledger.apply rejects an unsolicited +999999 HP receipt with no command or event',()=>{
  const before=createMatch(1),after=copy(before);
  after.augmentHistory={version:'augment-history-v1',seatId:'solo',proof:{kind:'server'},facts:[{
    kind:'growth',sequence:0,seatId:'solo',round:before.round,roundId:before.roundDefinitionId,resourcePrefix:before.resourceProvenance.entries.length,
    choiceId:'forged',receiptId:'unsolicited',deltas:[{unitId:before.preparation.units[0].id,healthFlat:999999,healthBps:0,attackDamageBps:0,abilityPowerCenti:0}],
  }]};
  expect(()=>new Ledger(before).apply(before,after)).toThrow(/H3 independent complete growth receipts/);
});

describe.each(['no-scout-no-pivot','cooking-pot'])('%s independent online growth',id=>{
  it('accepts the observed room boundaries and matches independently calculated totals',()=>{
    const {final,memory}=routes[id],step=growthStep(id);expect(step).toBeDefined();
    const values=final.preparation.units.filter(u=>u.team==='player').map(u=>h3GrowthForUnit(memory,u.id));
    expect(values.some(g=>g.healthFlat>0)).toBe(true);
    for(const g of values)expect(readAugmentGrowth(final,g.unitId)).toEqual(g);
    expect(values.reduce((n,g)=>n+g.healthFlat,0)).toBe(id==='cooking-pot'?50:40);
  });
  const mutations:Record<string,(s:Mutable<MatchState>)=>void>={
    missing:s=>{s.augmentHistory!.facts=s.augmentHistory!.facts.filter(f=>f.kind!=='growth');},
    extra:s=>{const f=copy(latestGrowth(s));f.sequence=s.augmentHistory!.facts.length;f.receiptId+=':extra';s.augmentHistory!.facts.push(f);},
    duplicate:s=>{const f=copy(latestGrowth(s));f.sequence=s.augmentHistory!.facts.length;s.augmentHistory!.facts.push(f);},
    'wrong target':s=>{latestGrowth(s).deltas[0].unitId='another-seat-unit';},
    'wrong amount':s=>{latestGrowth(s).deltas[0].healthFlat=999999;},
    'extra AP':s=>{latestGrowth(s).deltas[0].abilityPowerCenti++;},
    'wrong owner':s=>{latestGrowth(s).choiceId='another-choice';},
    'wrong receipt':s=>{latestGrowth(s).receiptId='another-receipt';},
    'wrong round':s=>{latestGrowth(s).round++;},
    'wrong seat':s=>{latestGrowth(s).seatId='s7';},
    'duplicate recipient':s=>{latestGrowth(s).deltas.push(copy(latestGrowth(s).deltas[0]));},
  };
  it.each(Object.entries(mutations))('rejects %s',(name,mutate)=>{
    const t=growthStep(id),after=copy(t.after);mutate(after);
    expect(()=>checkH3Growth(t.memory,t.before,after),name).toThrow(/H3/);
  });
  it('rejects jointly rewritten source facts and receipts',()=>{
    const t=growthStep(id),after=copy(t.after);
    if(id==='cooking-pot') {
      const entry=after.augmentHistory!.facts.find(f=>f.kind==='round-entry'&&f.round===after.round)!;
      if(entry.kind!=='round-entry')throw Error('missing entry');entry.roster.items=[];latestGrowth(after).deltas=[];
    } else {
      const pvp=after.augmentHistory!.facts.find(f=>f.kind==='pvp-roster')!;
      if(pvp.kind!=='pvp-roster')throw Error('missing PvP');pvp.seats.find(s=>s.seatId===after.multiplayer!.seatId)!.units=[];latestGrowth(after).deltas=[];
    }
    expect(()=>checkH3Growth(t.memory,t.before,after)).toThrow(/H3/);
  });
  it('rejects mutation of both before and after against the detached checkpoint',()=>{
    const t=growthStep(id),before=copy(t.before),after=copy(t.after);
    before.preparation.units=[];after.preparation.units=[];latestGrowth(after).deltas=[];
    expect(()=>checkH3Growth(t.memory,before,after)).toThrow(/H3 independent observed checkpoint/);
  });
  it('rejects a repeated grant on an otherwise inert transition',()=>{
    const {final,memory}=routes[id],after=copy(final),f=copy(latestGrowth(after));f.sequence=after.augmentHistory!.facts.length;
    f.round=after.round;f.roundId=after.roundDefinitionId;f.resourcePrefix=after.resourceProvenance.entries.length;after.augmentHistory!.facts.push(f);
    expect(()=>checkH3Growth(memory,final,after)).toThrow(/H3 independent complete growth receipts/);
    expect(()=>checkH3Growth(memory,final,final)).not.toThrow();
  });
  it('replaying the real online settlement cannot grant growth twice',()=>{
    const {final,memory}=routes[id],r=final.multiplayer!.receipts.at(-1)!;
    expect(r).toBeDefined();const retry=applyRoundSettlement(final,r);
    expect(retry).toMatchObject({ok:false,reason:'duplicate-settlement'});expect(retry.state).toBe(final);
    expect(()=>checkH3Growth(memory,final,retry.state)).not.toThrow();
  });
  it('rejects removing settlement facts together with growth receipts',()=>{
    const t=routes[id].trace.find(t=>t.after.multiplayer!.receipts.length>t.before.multiplayer!.receipts.length)!;
    const after=copy(t.after);after.roundResults=copy(t.before.roundResults);
    after.multiplayer!.receipts=copy(t.before.multiplayer!.receipts);
    after.augmentHistory!.facts=after.augmentHistory!.facts.filter(f=>f.kind!=='growth');
    expect(()=>checkH3Growth(t.memory,t.before,after)).toThrow(/H3 required settlement boundary/);
  });
});

// Hand-authored boundary vectors. These are oracle unit inputs, never submitted
// to production as valid Match saves. Expected recipients and amounts are literal.
const hero=(id:string,col:number,row=4,definitionId='amumu')=>({id,definitionId,team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col,row}}});
const item=(id:string,definitionId:string,unitId:string,slot=0)=>({id,definitionId,location:{kind:'unit' as const,unitId,slot}});
const delta=(unitId:string,healthFlat:number,attackDamageBps=0,abilityPowerCenti=0)=>({unitId,healthFlat,healthBps:0,attackDamageBps,abilityPowerCenti});
function origin(id:string,units:MatchState['preparation']['units'],items:MatchState['items']=[]) {
  const s=copy(growthStep(id).before);s.augmentHistory!.facts=[];s.resourceProvenance.entries=[];
  s.preparation.units=copy(units);s.items=copy(items);return s;
}
function cookingVector(units:MatchState['preparation']['units'],items:MatchState['items'],deltas:ReturnType<typeof delta>[]) {
  const before=origin('cooking-pot',units,items),after=copy(before),owner=before.augments.find(a=>a.definitionId==='cooking-pot')!;
  after.round++;after.roundDefinitionId='2-2';after.phase='preparation';
  const common={seatId:after.multiplayer!.seatId,round:after.round,roundId:after.roundDefinitionId,resourcePrefix:0};
  after.augmentHistory!.facts=[{...common,kind:'round-entry',sequence:0,roster:{units:copy(units.filter(u=>u.team==='player')),items:copy(items)}},
    {...common,kind:'growth',sequence:1,choiceId:owner.choiceId,receiptId:JSON.stringify(['cooking-pot',owner.choiceId,after.round]),deltas}];
  return {before,after,memory:createH3Ledger(before)};
}
it('independently pins hex ties, raw items, holder dedupe, bench/summon exclusion and stacked grants',()=>{
  const units=[hero('holder',3),hero('a',2),hero('b',4),hero('dummy',3,5,'training-dummy'),
    {...hero('bench',0),location:{kind:'bench' as const,slot:0}}];
  const items=[item('p','frying-pan','holder'),item('s','spatula','holder',1),item('a-pan','spatula','a'),item('ring','TFT_Item_TacticiansRing','b'),item('bench-pan','frying-pan','bench')];
  const t=cookingVector(units,items,[delta('a',50),delta('holder',50)]);
  expect(()=>checkH3Growth(t.memory,t.before,t.after)).not.toThrow();
  const doubled=copy(t.after);latestGrowth(doubled).deltas[0].healthFlat=100;
  expect(()=>checkH3Growth(t.memory,t.before,doubled)).toThrow(/H3 independent complete growth receipts/);
  const stacked=cookingVector([hero('one',2),hero('center',3),hero('two',4)],
    [item('p','frying-pan','one'),item('s','spatula','two')],[delta('center',100)]);
  expect(()=>checkH3Growth(stacked.memory,stacked.before,stacked.after)).not.toThrow();
  // On odd row 5, (3,4) and (4,4) are equally near (3,5); IDs break the tie.
  const odd=cookingVector([hero('holder',3,5),hero('b',3,4),hero('a',4,4)],
    [item('p','frying-pan','holder')],[delta('a',50)]);
  expect(()=>checkH3Growth(odd.memory,odd.before,odd.after)).not.toThrow();
});
it.each([{units:[]},{units:[hero('alone',3)]}])('requires an empty receipt when there is no other eligible hero ($units)',({units})=>{
  const t=cookingVector(units,[item('p','frying-pan','alone')],[]);
  expect(()=>checkH3Growth(t.memory,t.before,t.after)).not.toThrow();
  const missing=copy(t.after);missing.augmentHistory!.facts.pop();
  expect(()=>checkH3Growth(t.memory,t.before,missing)).toThrow(/H3 independent complete growth receipts/);
});
it('rejects deletion of both the entry fact and its receipt, even if the live board has changed',()=>{
  const t=cookingVector([hero('holder',2),hero('target',3)],[item('p','frying-pan','holder')],[delta('target',50)]);
  t.after.preparation.units=[];t.after.items=[];
  expect(()=>checkH3Growth(t.memory,t.before,t.after)).not.toThrow(); // Entry precedes new-round effects.
  t.after.augmentHistory!.facts=[];
  expect(()=>checkH3Growth(t.memory,t.before,t.after)).toThrow(/H3 required entry/);
});
function deferredMergeVector() {
  const units=[hero('a',2),hero('b',3),hero('c',4),{...hero('bench',0,4,'lux'),location:{kind:'bench' as const,slot:0}}];
  const before=origin('no-scout-no-pivot',units),frozen=copy(before),battleId='independent-pvp',owner=before.augments.find(a=>a.definitionId==='no-scout-no-pivot')!;
  const common={seatId:before.multiplayer!.seatId,round:before.round,roundId:before.roundDefinitionId,resourcePrefix:0};
  delete before.multiplayer!.combatRosterLocked;frozen.multiplayer!.combatRosterLocked=true;
  frozen.augmentHistory!.facts=[{...common,kind:'pvp-roster',sequence:0,battleId,mirrorOfSeatId:null,
    seats:[{seatId:common.seatId,index:0,hp:100,alive:true,rank:1,eliminatedRound:null,units,items:[]}]}];
  const memory=checkH3Growth(createH3Ledger(before),before,frozen),after=copy(frozen),real=growthStep('no-scout-no-pivot').after;
  after.phase='settlement';after.roundResults=copy(real.roundResults);after.multiplayer!.receipts=copy(real.multiplayer!.receipts);
  delete after.multiplayer!.combatRosterLocked;
  after.multiplayer!.receipts.at(-1)!.battleId=battleId;
  after.preparation.units=[{...hero('a',2),starLevel:2},units[3]];
  after.resourceProvenance.entries=[{sequence:0,roundId:after.roundDefinitionId,kind:'unit-upgraded-after-combat',event:{type:'unitUpgraded',survivorId:'a',consumedIds:['b','c'],definitionId:'amumu',fromStar:1,toStar:2,location:{kind:'board',cell:{col:2,row:4}}}}];
  after.augmentHistory!.facts.push({...common,kind:'growth',sequence:1,choiceId:owner.choiceId,receiptId:JSON.stringify(['no-scout-no-pivot',owner.choiceId,battleId]),
    deltas:[delta('a',20,150,150),delta('b',20,150,150),delta('c',20,150,150)]});
  return {before:frozen,after,memory};
}
it('derives three participants before deferred merging, then inherits 60 HP / 450 Bps AD / 450 centi AP',()=>{
  const t=deferredMergeVector(),memory=checkH3Growth(t.memory,t.before,t.after);
  expect(h3GrowthForUnit(memory,'a')).toEqual(delta('a',60,450,450));
  expect(h3GrowthForUnit(memory,'bench')).toEqual(delta('bench',0));
  expect(h3GrowthForUnit(memory,'b')).toEqual(delta('b',0));
});
it.each(['survivor','consumed','star','duplicate'] as const)('rejects jointly forged %s merge facts, roster and growth',kind=>{
  const t=deferredMergeVector(),after=copy(t.after),f=after.resourceProvenance.entries[0];
  if(f.kind!=='unit-upgraded-after-combat')throw Error('missing merge');
  if(kind==='survivor') {f.event.survivorId='b';f.event.consumedIds=['a','c'];after.preparation.units[0].id='b';}
  if(kind==='consumed')f.event.consumedIds=['b','bench'];
  if(kind==='star') {f.event.toStar=3;after.preparation.units[0].starLevel=3;}
  if(kind==='duplicate')after.resourceProvenance.entries.push({...copy(f),sequence:1});
  latestGrowth(after).deltas=[delta(f.event.survivorId,60,450,450)];
  expect(()=>checkH3Growth(t.memory,t.before,after)).toThrow(/H3/);
});
it('inherits Cooking Pot growth through an independently checked shop merge without issuing another receipt',()=>{
  const t=cookingVector([hero('a',1),hero('b',2),hero('holder',0,4,'lux')],[item('p','frying-pan','holder')],[delta('a',50)]);
  t.after.shop={generation:77,locked:false,slots:[{status:'available',definitionId:'amumu'}]};
  const memory=checkH3Growth(t.memory,t.before,t.after),before=t.after,after=copy(before);
  after.preparation.units=[{...hero('a',1),starLevel:2},hero('holder',0,4,'lux')];
  after.resourceProvenance.entries=[
    {sequence:0,roundId:after.roundDefinitionId,kind:'unit-acquired',unitId:'c',source:{kind:'shop',generation:77,slotIndex:0,definitionId:'amumu'}},
    {sequence:1,roundId:after.roundDefinitionId,kind:'unit-upgraded',acquisitionSequence:0,event:{type:'unitUpgraded',survivorId:'a',consumedIds:['b','c'],definitionId:'amumu',fromStar:1,toStar:2,location:{kind:'board',cell:{col:1,row:4}}}},
  ];
  const next=checkH3Growth(memory,before,after);
  expect(h3GrowthForUnit(next,'a')).toEqual(delta('a',50));
  expect(after.augmentHistory!.facts.filter(f=>f.kind==='growth')).toHaveLength(1);
  const changed=copy(after);latestGrowth(changed).deltas[0].unitId='b';
  expect(()=>checkH3Growth(memory,before,changed)).toThrow(/H3 retained facts/);
  const forged=copy(after),acquisition=forged.resourceProvenance.entries[0];
  if(acquisition.kind!=='unit-acquired'||acquisition.source.kind!=='shop')throw Error('missing acquisition');
  acquisition.source.definitionId='lux';
  expect(()=>checkH3Growth(memory,before,forged)).toThrow(/H3 merge acquisition definition/);
});

it('rejects a forged PvP freeze before there is any growth receipt to compare',()=>{
  const t=routes['no-scout-no-pivot'].trace.find(t=>t.after.augmentHistory!.facts.some(f=>f.kind==='pvp-roster')&&!t.before.augmentHistory!.facts.some(f=>f.kind==='pvp-roster'))!;
  const after=copy(t.after),f=after.augmentHistory!.facts.find(f=>f.kind==='pvp-roster')!;
  if(f.kind!=='pvp-roster')throw Error('missing freeze');f.seats.find(s=>s.seatId===t.before.multiplayer!.seatId)!.units=[];
  expect(()=>checkH3Growth(t.memory,t.before,after)).toThrow(/H3 independent frozen roster/);
});
