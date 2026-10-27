import { expect, it } from 'vitest';
import { CATALOG, COST, ROUNDS, xp, entryXp, benchXp, validateScoreboardCombat } from './fixtures/m5/oracle.g2.cjs';
import { validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';

const env = {CATALOG,COST,ROUNDS,xp,entryXp,benchXp};
const hero = (id: string, definitionId = 'lux', slot = 0) => ({id,definitionId,team:'player',starLevel:1,location:{kind:'bench',slot}});
const delta = (unitId: string, amount = 150) => ({unitId,healthFlat:0,healthBps:0,attackDamageBps:amount,abilityPowerCenti:amount});
function state(definitionId: string): any {
  return {phase:'preparation',seed:29,round:4,roundDefinitionId:'2-1',level:4,xp:0,
    multiplayer:{seatId:'s0'},augments:[{definitionId,choiceId:'choice',acquiredRound:4}],
    preparation:{units:[hero('a'),hero('b','lux',1),hero('dummy','training-dummy',2)]},items:[],
    resourceProvenance:{entries:[]},roundResults:[],
    augmentHistory:{version:'augment-history-v1',seatId:'s0',facts:[],proof:{kind:'server'}},
    seatMechanics:{receipts:[],seat:{},hidden:{progress:{economyReceipts:[]}}}};
}
function fact(s: any, data: any) {
  return {...data,sequence:s.augmentHistory.facts.length,round:s.round,roundId:s.roundDefinitionId,seatId:'s0',resourcePrefix:s.resourceProvenance.entries.length};
}
function enter(before: any, rank: number): any {
  const s=structuredClone(before);s.round++;s.roundDefinitionId=ROUNDS[s.round-1].roundId;
  s.augmentHistory.facts.push(fact(s,{kind:'round-entry',roster:{units:structuredClone(before.preparation.units),items:[]}}));
  s.augmentHistory.facts.push(fact(s,{kind:'table',stage:'entry',seats:[{seatId:'s0',rank,units:[],items:[],alive:true,index:0,hp:90,eliminatedRound:null}]}));
  if(rank>4)s.augmentHistory.facts.push(fact(s,{kind:'growth',choiceId:'choice',receiptId:JSON.stringify(['scoreboard-scrapper','choice',s.round]),deltas:[delta('a'),delta('b')]}));
  return s;
}
function contested(count: number) {
  const before=state('contested');before.round=12;before.roundDefinitionId='3-2';before.augments[0].acquiredRound=12;before.phase='combat';
  const seats=Array.from({length:4},(_,i)=>({seatId:`s${i}`,alive:true,units:i===0?[hero('bench')]:[{...hero(`enemy${i}`,i<=count?'lux':'vex'),location:{kind:'board',cell:{col:0,row:4}}}]}));
  before.augmentHistory.facts.push(fact(before,{kind:'pvp-roster',battleId:'battle',seats,mirrorOfSeatId:null}));
  const after=structuredClone(before);after.phase='settlement';after.xp=2;
  after.roundResults.push({round:12,roundKind:'pvp'});
  after.seatMechanics.hidden.progress.economyReceipts.push({kind:'battle',facts:{round:12,roundKind:'pvp',result:'loss'}});
  const receipt={receiptId:JSON.stringify(['augment-pool-batch5-h6','choice',12]),source:'augment-pool-batch5-h6',kind:'gold',amount:2,round:12,roundId:'3-2'};
  if(count>=2)after.seatMechanics.receipts.push(receipt);
  return {before,after,receipt};
}
it('contested rejects jointly forged frozen opponents and a matching 2-gold receipt',()=>{
  const {before,after,receipt}=contested(0);
  expect(()=>validateRewards(before,after,null,[{type:'combatFinished'}],env)).not.toThrow();
  for(const seat of after.augmentHistory.facts[0].seats.slice(1,3))seat.units[0].definitionId='lux';
  after.seatMechanics.receipts.push(receipt);
  expect(()=>validateRewards(before,after,null,[{type:'combatFinished'}],env)).toThrow(/history.*append-only/);
});
it('contested pays nonzero from the pre-settlement freeze despite later preparation changes',()=>{
  const {before,after}=contested(3);after.preparation.units=[];
  expect([...validateRewards(before,after,null,[{type:'combatFinished'}],env).gold.values()]).toMatchObject([{amount:2}]);
  for(const edit of [(s:any)=>s.augmentHistory.facts.pop(),(s:any)=>s.augmentHistory.facts[0].seats[0].units[0].definitionId='vex']){
    const bad=structuredClone(after);edit(bad);
    expect(()=>validateRewards(before,bad,null,[{type:'combatFinished'}],env)).toThrow(/history.*append-only/);
  }
});
it('scoreboard rejects fabricated 999999 AD/AP growth without an operation',()=>{
  const before=state('scoreboard-scrapper'),after=structuredClone(before);
  expect(()=>validateRewards(before,after,null,[],env)).not.toThrow();
  after.augmentHistory.facts.push(fact(after,{kind:'growth',choiceId:'choice',receiptId:'invented',deltas:[delta('a',999999)]}));
  expect(()=>validateRewards(before,after,null,[],env)).toThrow(/scoreboard/);
});
it('cannot disguise fake scoreboard stats under a second owned augment',()=>{
  const before=state('scoreboard-scrapper');
  before.augments.push({definitionId:'contested',choiceId:'second-choice',acquiredRound:4});
  const after=structuredClone(before);
  after.augmentHistory.facts.push(fact(after,{kind:'growth',choiceId:'second-choice',receiptId:'invented',deltas:[delta('a',999999)]}));
  expect(()=>validateRewards(before,after,null,[],env)).toThrow(/scoreboard/);
});
it.each([1,4,5,8])('scoreboard independently validates rank %s entry and the permanent receipt',rank=>{
  const before=state('scoreboard-scrapper'),after=enter(before,rank);
  expect(()=>validateRewards(before,after,{type:'continue'},[],env)).not.toThrow();
  if(rank<=4){
    after.augmentHistory.facts.push(fact(after,{kind:'growth',choiceId:'choice',receiptId:JSON.stringify(['scoreboard-scrapper','choice',after.round]),deltas:[delta('a'),delta('b')]}));
    expect(()=>validateRewards(before,after,{type:'continue'},[],env)).toThrow(/scoreboard/);
    return;
  }
  const edits=[
    (s:any)=>s.augmentHistory.facts.pop(),
    (s:any)=>s.augmentHistory.facts.push({...s.augmentHistory.facts.at(-1),sequence:s.augmentHistory.facts.length}),
    (s:any)=>s.augmentHistory.facts.at(-1).deltas[0].attackDamageBps++,
    (s:any)=>s.augmentHistory.facts.at(-1).deltas[0].abilityPowerCenti=999999,
    (s:any)=>s.augmentHistory.facts.at(-1).deltas[0].healthBps=1000,
    (s:any)=>s.augmentHistory.facts.at(-1).deltas[0].unitId='dummy',
    (s:any)=>s.augmentHistory.facts.at(-1).deltas.push(delta('held-carousel-card')),
    (s:any)=>s.augmentHistory.facts.at(-1).deltas.pop(),
    (s:any)=>s.augmentHistory.facts.at(-1).receiptId='invented',
    (s:any)=>s.augmentHistory.facts.at(-1).choiceId='wrong-owner',
    (s:any)=>s.augmentHistory.facts.at(-1).round++,
    (s:any)=>{s.augmentHistory.facts[0].roster.units.push(hero('forged'));s.augmentHistory.facts.at(-1).deltas.push(delta('forged'));},
  ];
  for(const edit of edits){const bad=structuredClone(after);edit(bad);expect(()=>validateRewards(before,bad,{type:'continue'},[],env)).toThrow(/scoreboard/);}
});
it('scoreboard checks temporary HP through 5 -> 4 -> 8 while preserving earlier AD/AP',()=>{
  let before=state('scoreboard-scrapper');
  for(const [rank,permanent,hp] of [[5,150,0],[4,150,1000],[8,300,0]]){
    const after=enter(before,rank);
    after.combatInputBasis={provenancePrefixLength:0,inputs:{preparation:after.preparation,h6Growth:[{...delta('a',permanent),healthBps:hp},{...delta('b',permanent),healthBps:hp},delta('dummy',0)]}};
    expect(()=>validateRewards(before,after,{type:'continue'},[],env)).not.toThrow();
    const bad=structuredClone(after);bad.combatInputBasis.inputs.h6Growth[0].healthBps=hp?0:1000;
    expect(()=>validateRewards(before,bad,{type:'continue'},[],env)).toThrow(/scoreboard combat/);
    const badDummy=structuredClone(after);badDummy.combatInputBasis.inputs.h6Growth[2].healthBps=1000;
    expect(()=>validateRewards(before,badDummy,{type:'continue'},[],env)).toThrow(/scoreboard combat/);
    delete after.combatInputBasis;before=after;
  }
});
it('scoreboard grants no retroactive growth or HP on acquisition and never pays again on a no-op',()=>{
  const before=state('scoreboard-scrapper');
  before.combatInputBasis={provenancePrefixLength:0,inputs:{preparation:before.preparation,h6Growth:before.preparation.units.map((u:any)=>delta(u.id,0))}};
  expect(()=>validateRewards(before,before,null,[],env)).not.toThrow();
  const bad=structuredClone(before);bad.combatInputBasis.inputs.h6Growth[0].healthBps=1000;
  expect(()=>validateRewards(before,bad,null,[],env)).toThrow(/scoreboard combat/);
  delete before.combatInputBasis;
  const paid=enter(before,5),duplicate=structuredClone(paid);
  expect(()=>validateRewards(paid,paid,null,[],env)).not.toThrow();
  duplicate.augmentHistory.facts.push({...duplicate.augmentHistory.facts.at(-1),sequence:duplicate.augmentHistory.facts.length});
  expect(()=>validateRewards(paid,duplicate,null,[],env)).toThrow(/scoreboard/);
});
it.each(['carousel-preparation-settled','carousel-unit-claimed'])('independent combat oracle folds recursive %s growth to 300',kind=>{
  const s=enter(state('scoreboard-scrapper'),5);
  s.resourceProvenance.entries.push({kind,upgrades:[{survivorId:'a',consumedIds:['b','new-card']},{survivorId:'final',consumedIds:['a','other-two-star']}]});
  const input={units:[hero('final')],h6Growth:[delta('final',300)]};
  expect(()=>validateScoreboardCombat(s,input)).not.toThrow();
  input.h6Growth[0]=delta('final',150);
  expect(()=>validateScoreboardCombat(s,input)).toThrow(/scoreboard combat/);
  expect(()=>validateScoreboardCombat(s,{units:[hero('a'),hero('b')],h6Growth:[delta('a'),delta('b')]},0)).not.toThrow();
});
