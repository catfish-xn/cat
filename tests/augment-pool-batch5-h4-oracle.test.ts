import { describe, expect, it } from 'vitest';
import { activeTraits, goldPlan } from './fixtures/m5/h4-rewards-oracle.cjs';
import { rewardPlan, validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';
import { CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from './fixtures/m5/oracle.g2.cjs';
import { portfolioGoldPlan } from '../src/simulation/augment-pool-batch5-h4';

const env = { CATALOG, COST, ROUNDS, xp, entryXp, benchXp };
const source = 'augment-pool-batch5-h4', survivor = source + '-survivor';
const three = ['irelia','illaoi','vex','renata'];
const six = ['irelia','illaoi','vex','rell','heimerdinger','lux','leona','swain'];
const roster = (ids: string[]) => ({ units: ids.map((definitionId,i) => ({ id: 'u'+i, definitionId, team: 'player', starLevel: 1,
  location: { kind: 'board', cell: { col:i%7,row:4+Math.floor(i/7) } } })), items: [] as any[] });
// Deliberately structural input vectors; mutations below must reach the oracle, not a production validator.
function state(id: string, round = 4): any {
  return { phase:'settlement', seed:29, augmentTierSeed:29, round, roundDefinitionId:ROUNDS[round-1].roundId,
    gold:20, level:4, xp:0, nextMatchEventSeq:10, multiplayer:{seatId:'s0'},
    augments:[{definitionId:id, choiceId:'round:2-1:augment', acquiredRound:4}],
    preparation:roster(three), items:[], roundResults:[{round}], resourceProvenance:{entries:[]},
    augmentHistory:{facts:[]}, seatMechanics:{receipts:[],seat:{},hidden:{progress:{economyReceipts:[]}}} };
}
function fact(s: any, value: any) {
  return {...value, sequence:s.augmentHistory.facts.length, seatId:'s0', round:s.round, roundId:s.roundDefinitionId, resourcePrefix:0};
}
function payment(s: any, src=source, amount=1) {
  return {receiptId:JSON.stringify([src,'round:2-1:augment',...(src===source?[s.round]:[])]), source:src,
    kind:'gold', amount, round:s.round, roundId:s.roundDefinitionId};
}
function paid(s: any, receipts: any[]) {
  return {...s, gold:s.gold+receipts.reduce((n,r)=>n+r.amount,0), nextMatchEventSeq:s.nextMatchEventSeq+receipts.length,
    seatMechanics:{...s.seatMechanics,receipts:[...s.seatMechanics.receipts,...receipts]}};
}
const grants = (before: any, receipts: any[]) => receipts.map((receipt,i)=>({type:'mechanicGranted',domain:'match',eventSeq:before.nextMatchEventSeq+i,receipt}));
function entry(id='diversified-portfolio', ids=three) {
  const before=state(id);before.preparation=roster(ids);
  const after={...structuredClone(before), phase:'preparation', round:5, roundDefinitionId:'2-2'};
  after.augmentHistory.facts.push(fact(after,{kind:'round-entry',roster:{units:structuredClone(before.preparation.units),items:before.items}}));
  return {before,after};
}
function table(dead: string[] = ['s1','s2','s3'], round=4) {
  return Array.from({length:8},(_,index)=>({seatId:'s'+index,index,alive:!dead.includes('s'+index), hp:dead.includes('s'+index)?0:100,
    eliminatedRound:dead.includes('s'+index)?round:null,rank:index+1,units:[],items:[]}));
}
function elimination(dead?: string[]) {
  const before=state('survivor');before.augmentHistory.facts.push(fact(before,{kind:'acquire',definitionId:'survivor',choiceId:'round:2-1:augment'}));
  const seats=table(dead), after=structuredClone(before);
  after.augmentHistory.facts.push(fact(after,{kind:'table',stage:'settlement',seats}));
  return {before,after,command:{type:'recordAugmentSettlementTable',seats}};
}

it.each([
  [[],[]], [three,['rebel','sentinel','visionary']],
  [six,['academy','conqueror','rebel','sentinel','sorcerer','visionary']],
  [six.filter(id=>id!=='leona'),['conqueror','rebel','sentinel','sorcerer','visionary']],
  [['irelia','illaoi','vex','viktor','mel','sevika','rumble'],['rebel','sentinel']],
  [['nami'],['emissary']], [['nami','garen'],[]], [['nami','garen','tristana'],[]],
  [['nami','garen','tristana','ambessa'],['emissary']],
] as const)('independently counts active non-unique traits on %j', (ids,expected)=>{
  expect(activeTraits(roster([...ids]))).toEqual(expected);
  const {after}=entry('diversified-portfolio',[...ids]);
  const amount=Math.floor(expected.length/3);
  expect(portfolioGoldPlan(after).map(p=>p.amount)).toEqual(amount?[amount]:[]);
});
it('counts equipped emblems, but not inventory, bench, enemies, native duplicates or duplicate champions',()=>{
  const input=roster(['irelia','illaoi','vex','irelia']);
  const emblem={id:'emblem',definitionId:'TFT13_Item_InvokerEmblemItem',location:{kind:'unit',unitId:'u0',slot:0}};
  expect(activeTraits(input)).toEqual(['rebel','sentinel']);
  expect(activeTraits({...input,items:[emblem]})).toEqual(['rebel','sentinel','visionary']);
  const {after}=entry();after.augmentHistory.facts[0].roster={...input,items:[emblem]};
  expect(portfolioGoldPlan(after).map(p=>p.amount)).toEqual([1]);
  expect(activeTraits({...input,items:[emblem,{...emblem,id:'duplicate',location:{...emblem.location,unitId:'u3'}}]})).toEqual(['rebel','sentinel','visionary']);
  for(const location of [{kind:'inventory',slot:0},{kind:'unit',unitId:'u2',slot:0},{kind:'unit',unitId:'absent',slot:0}])
    expect(activeTraits({...input,items:[{...emblem,location}]})).toEqual(['rebel','sentinel']);
  input.units[3].location={kind:'bench',slot:0} as any;
  expect(activeTraits({...input,items:[{...emblem,location:{...emblem.location,unitId:'u3'}}]})).toEqual(['rebel','sentinel']);
  after.augmentHistory.facts[0].roster={...input,items:[{...emblem,location:{...emblem.location,unitId:'u3'}}]};
  expect(portfolioGoldPlan(after)).toEqual([]);
  input.units[3].location={kind:'board',cell:{col:3,row:4}};input.units[3].team='enemy';
  expect(activeTraits({...input,items:[{...emblem,location:{...emblem.location,unitId:'u3'}}]})).toEqual(['rebel','sentinel']);
});
it('only owned, fielded team-ups add traits; Menaces adds Dominator and Sisters is non-unique',()=>{
  expect(activeTraits(roster(['powder','silco']))).toEqual([]);
  expect(activeTraits(roster(['powder','silco']),[{definitionId:'menaces'}])).toEqual(['dominator','menaces']);
  expect(activeTraits(roster(['jinx','vi']),[{definitionId:'sisters'}])).toEqual(['sisters']);
  expect(activeTraits(roster(['powder']),[{definitionId:'menaces'}])).toEqual([]);
});

describe.each(['diversified-portfolio','diversified-portfolio-plus'])('%s independent recurring rewards', id=>{
  it.each([[[],0],[three,1],[six,2]] as const)('plans %j without consulting any receipts', (ids,amount)=>{
    const {before,after}=entry(id,[...ids]), rs=amount?[payment(after,source,amount)]:[];
    expect(goldPlan(after)).toEqual(rs.map(({roundId:_roundId,...r})=>r));
    expect(portfolioGoldPlan(after)).toEqual(rs.map(({kind:_kind,roundId:_roundId,...r})=>r));
    expect(rewardPlan(after,{...env,pools:{}}).gold).toEqual(goldPlan(after));
    expect(()=>validateRewards(before,paid(after,rs),{type:'continue'},grants(before,rs),env)).not.toThrow();
    after.seatMechanics.receipts=[payment(after,source,123)];
    expect(goldPlan(after)).toEqual(rs.map(({roundId:_roundId,...r})=>r));
  });
  it('rejects omitted, inflated, extra, duplicate, mistimed and renamed payments, even with matching events/balance',()=>{
    const {before,after}=entry(id),r=payment(after);
    for(const rs of [[],[{...r,amount:2}],[r,{...r,receiptId:'extra'}],[r,r],[{...r,round:4}],[{...r,roundId:'2-3'}],
      [{...r,receiptId:'invented'}],[{...r,source:'augment-pool-batch5'}]])
      expect(()=>validateRewards(before,paid(after,rs),{type:'continue'},grants(before,rs),env)).toThrow(/independent H4/);
  });
  it('requires one numbered grant event and the actual pre-entry roster',()=>{
    const {before,after}=entry(id),r=payment(after),next=paid(after,[r]),ev=grants(before,[r]);
    for(const events of [[],[...ev,...ev],[{...ev[0],eventSeq:999}],[{...ev[0],receipt:{...r,amount:2}}]])
      expect(()=>validateRewards(before,next,{type:'continue'},events,env)).toThrow(/independent H4/);
    const forged=structuredClone(before);forged.preparation=roster([]);
    expect(()=>validateRewards(forged,next,{type:'continue'},ev,env)).toThrow(/entry roster/);
  });
  it('never backpays the acquisition round, accumulates remainders, or uses a later board',()=>{
    const acquired=state(id);expect(goldPlan(acquired)).toEqual([]);
    const {before,after}=entry(id,['irelia','illaoi','vex']);
    expect(()=>validateRewards(before,after,{type:'continue'},[],env)).not.toThrow();
    const next={...after,round:6,roundDefinitionId:'2-3'};
    next.augmentHistory=structuredClone(after.augmentHistory);
    next.augmentHistory.facts.push(fact(next,{kind:'round-entry',roster:roster(['irelia','illaoi','vex'])}));
    next.preparation=roster(six);
    expect(goldPlan(next)).toEqual([]);
    const r=payment(next);
    expect(()=>validateRewards(after,paid(next,[r]),{type:'continue'},grants(after,[r]),env)).toThrow(/complete payments/);
  });
  it('rejects retries and paid-prefix tampering, and requires the next natural round to pay independently',()=>{
    const {before,after}=entry(id),r=payment(after),first=paid(after,[r]);
    expect(()=>validateRewards(first,first,{type:'equip'},[],env)).not.toThrow();
    expect(()=>validateRewards(first,paid(first,[r]),{type:'equip'},grants(first,[r]),env)).toThrow(/complete payments/);
    const next={...structuredClone(first),round:6,roundDefinitionId:'2-3'};
    next.augmentHistory.facts.push(fact(next,{kind:'round-entry',roster:roster(three)}));
    const r2=payment(next);
    expect(()=>validateRewards(first,paid(next,[r2]),{type:'continue'},grants(first,[r2]),env)).not.toThrow();
    const second=paid(next,[r2]),supply={...structuredClone(second),round:7,roundDefinitionId:'2-4'};
    supply.augmentHistory.facts.push(fact(supply,{kind:'round-entry',roster:roster(three)}));
    const r3=payment(supply);
    expect(()=>validateRewards(second,paid(supply,[r3]),{type:'continue'},grants(second,[r3]),env)).not.toThrow();
    const corrupt=structuredClone(first);corrupt.seatMechanics.receipts[0].amount=123;
    expect(()=>validateRewards(corrupt,corrupt,{type:'equip'},[],env)).toThrow(/prior payments/);
    const missing=structuredClone(first);missing.seatMechanics.receipts=[];
    expect(()=>validateRewards(missing,paid(next,[r2]),{type:'continue'},grants(missing,[r2]),env)).toThrow(/prior payments/);
    expect(before.round).toBe(4);
  });
});

it('requires the entry fact, ignores post-entry edits and refuses fabricated entry on an unrelated command',()=>{
  const {before,after}=entry(),r=payment(after),next=paid(after,[r]);
  next.preparation=roster([]); // The stored entry roster remains authoritative for this already paid round.
  expect(()=>validateRewards(next,next,{type:'equip'},[],env)).not.toThrow();
  const missing=structuredClone(next);missing.augmentHistory.facts=[];
  expect(()=>validateRewards(before,missing,{type:'continue'},grants(before,[r]),env)).toThrow(/entry timing/);
  const duplicate=structuredClone(next);duplicate.augmentHistory.facts.push({...duplicate.augmentHistory.facts[0],sequence:1});
  expect(()=>validateRewards(before,duplicate,{type:'continue'},grants(before,[r]),env)).toThrow(/entry timing/);
  expect(()=>validateRewards(before,next,{type:'equip'},grants(before,[r]),env)).toThrow(/entry timing/);
});

it('Survivor derives 60 gold from the whole table, with no reward receipts as input',()=>{
  const {before,after,command}=elimination(),r=payment(after,survivor,60);
  expect(goldPlan(after)).toEqual([{receiptId:JSON.stringify([survivor,'round:2-1:augment']),source:survivor,kind:'gold',amount:60,round:4}]);
  expect(()=>validateRewards(before,paid(after,[r]),command,grants(before,[r]),env)).not.toThrow();
  for(const rs of [[],[{...r,amount:61}],[r,r],[r,{...r,receiptId:'extra'}],[{...r,round:5}],[{...r,receiptId:'invented'}]])
    expect(()=>validateRewards(before,paid(after,rs),command,grants(before,rs),env)).toThrow(/independent H4/);
  const noMoney=paid(after,[r]);noMoney.gold=before.gold;
  expect(()=>validateRewards(before,noMoney,command,grants(before,[r]),env)).toThrow(/gold balance/);
});
it('Survivor pays catch-up on selection, without retroactive or arbitrary command grants',()=>{
  const {before:owned,after}=elimination();after.augmentHistory.facts.at(-1).stage='acquire';
  after.phase='preparation';
  const before={...owned,phase:'choice',augments:[],augmentHistory:undefined,
    pendingChoice:{kind:'augment',step:'offer',choiceId:'round:2-1:augment',generation:0,offers:['survivor']}};
  const r=payment(after,survivor,60),result=paid(after,[r]);result.nextMatchEventSeq++;
  const command={type:'select',choiceId:'round:2-1:augment',generation:0,definitionId:'survivor'};
  const selected={type:'choiceSelected',choiceId:command.choiceId,definitionId:'survivor',domain:'match',eventSeq:10};
  const events=[selected,...grants({...before,nextMatchEventSeq:11},[r])];
  expect(()=>validateRewards(before,result,command,events,env)).not.toThrow();
  expect(()=>validateRewards(before,after,command,[selected],env)).toThrow(/complete payments/);
  const mistimed=structuredClone(result);mistimed.augmentHistory.facts.at(-1).stage='settlement';
  expect(()=>validateRewards(before,mistimed,command,events,env)).toThrow(/Survivor only/);
});
it.each([['s1','s2'],['s0','s1','s2','s3'],['s0','s1','s2']].map(dead=>({dead})))('Survivor grants nothing for dead seats $dead',({dead})=>{
  const {before,after,command}=elimination(dead);
  expect(()=>validateRewards(before,after,command,[],env)).not.toThrow();
  const r=payment(after,survivor,60);
  expect(()=>validateRewards(before,paid(after,[r]),command,grants(before,[r]),env)).toThrow(/complete payments/);
});
it('Survivor ignores pre-acquisition/entry tables, and pays catch-up only with acquisition table',()=>{
  const s=state('survivor');
  s.augmentHistory.facts.push(fact(s,{kind:'table',stage:'settlement',seats:table()}));
  s.augmentHistory.facts.push(fact(s,{kind:'acquire',definitionId:'survivor',choiceId:'round:2-1:augment'}));
  s.augmentHistory.facts.push(fact(s,{kind:'table',stage:'entry',seats:table()}));
  expect(goldPlan(s)).toEqual([]);
  s.augmentHistory.facts.push(fact(s,{kind:'table',stage:'acquire',seats:table()}));
  expect(goldPlan(s).map(r=>[r.amount,r.round])).toEqual([[60,4]]);
  s.round=5;s.roundDefinitionId='2-2';
  s.augmentHistory.facts.push(fact(s,{kind:'table',stage:'settlement',seats:table(['s1','s2','s3','s4'])}));
  expect(goldPlan(s).map(r=>[r.amount,r.round])).toEqual([[60,4]]);
});
it('Survivor rejects duplicate/partial or co-forged table facts and repeated grants after restore',()=>{
  const {before,after,command}=elimination(),r=payment(after,survivor,60),next=paid(after,[r]);
  expect(()=>validateRewards(next,next,command,[],env)).not.toThrow();
  expect(()=>validateRewards(next,paid(next,[r]),command,grants(next,[r]),env)).toThrow(/complete payments/);
  for(const seats of [table().slice(1),[table()[1],...table().slice(1)],table(['s1','s2'])]){
    const forged=structuredClone(next);forged.augmentHistory.facts.at(-1).seats=seats;
    expect(()=>validateRewards(before,forged,command,grants(before,[r]),env)).toThrow(/authoritative table/);
  }
  expect(()=>validateRewards(before,next,{type:'equip'},grants(before,[r]),env)).toThrow(/Survivor only/);
  expect(()=>validateRewards(before,next,command,[],env)).toThrow(/one event/);
});
