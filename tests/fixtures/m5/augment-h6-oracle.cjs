/* Independent P-B5-37/38 (2026-10-25), 14.24 literals. No production imports.
 * Round/table/roster observations are inputs; growth receipts and combat bonuses
 * are outputs. Never derive the expected amount or recipients from those outputs.
 */
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const {observedPrefixEqual}=require('./observed-equal.cjs');
const ID='scoreboard-scrapper';
const owner=s=>s.augments.find(a=>a.definitionId===ID);
const ordinary=(u,base)=>u.team==='player'&&Object.hasOwn(base.COST,u.definitionId);
const zero=unitId=>({unitId,healthFlat:0,healthBps:0,attackDamageBps:0,abilityPowerCenti:0});
function boundary(s,round,base){
 const facts=s.augmentHistory?.facts??[];
 const entries=facts.filter(f=>f.kind==='round-entry'&&f.round===round);
 const tables=facts.filter(f=>f.kind==='table'&&f.stage==='entry'&&f.round===round);
 assert.equal(entries.length,1,'scoreboard unique entry roster');
 assert.equal(tables.length,1,'scoreboard unique entry table');
 const entry=entries[0],table=tables[0],seatId=s.multiplayer?.seatId??'solo';
 for(const f of [entry,table]){
  assert.equal(f.seatId,seatId,'scoreboard entry seat');
  assert.equal(f.roundId,base.ROUNDS[round-1]?.roundId,'scoreboard entry round identity');
 }
 assert(entry.sequence<table.sequence,'scoreboard roster frozen before table/growth');
 const selves=table.seats.filter(s=>s.seatId===seatId);
 assert.equal(selves.length,1,'scoreboard unique ranked seat');
 const rank=selves[0].rank;
 assert(Number.isInteger(rank)&&rank>=1&&rank<=8,'scoreboard full-table rank');
 return {entry,table,rank};
}
function expectedGrowth(s,base){
 const a=owner(s),expected=[];
 if(!a)return expected;
 for(let round=a.acquiredRound+1;round<=s.round;round++){
  const {entry,table,rank}=boundary(s,round,base);
  if(rank<=4)continue;
  const units=entry.roster.units.filter(u=>ordinary(u,base));
  assert.equal(new Set(units.map(u=>u.id)).size,units.length,'scoreboard unique official heroes');
  expected.push({kind:'growth',choiceId:a.choiceId,receiptId:JSON.stringify([ID,a.choiceId,round]),
   round,roundId:base.ROUNDS[round-1].roundId,seatId:table.seatId,sequence:table.sequence+1,resourcePrefix:table.resourcePrefix,
   deltas:units.map(u=>({...zero(u.id),attackDamageBps:150,abilityPowerCenti:150}))});
 }
 return expected;
}
const GROWTH_ASSERT='independent scoreboard growth (amount, recipients, owner, unique receipt, round)';
// v26 D5 (7953c99a) added no-scout-no-pivot to the public 2-1 pool. Headless mage
// seed 0x9e3779b9 (2654435769) takes it as offers[0] at round:2-1:augment — it is
// not on the route priority list — and then records +20 HP / +150 AD bps / +150 AP
// per locked board hero (old H6 expectation was []). Cooking-pot uses the same
// growth ledger. Those receipts are checked by the independent H3 ledger
// (tests/fixtures/m5/h3-growth-oracle.cjs); Ledger.apply passes that ledger as
// base.h3Growth. A label H3 did not explain still fails this assertion, including
// a second augment disguising scoreboard stats. Callers that omit h3Growth keep
// the old complete-set check.
function growthReceipt(f){return {kind:f.kind,seatId:f.seatId,round:f.round,roundId:f.roundId,choiceId:f.choiceId,receiptId:f.receiptId,deltas:f.deltas};}
function validateScoreboardHistory(s,base){
 const actual=(s.augmentHistory?.facts??[]).filter(f=>f.kind==='growth');
 const expected=expectedGrowth(s,base);
 const remaining=(base.h3Growth??[]).slice();
 const unexplained=[];
 for(const fact of actual){
  const index=remaining.findIndex(peer=>isDeepStrictEqual(peer,growthReceipt(fact)));
  if(index>=0)remaining.splice(index,1);else unexplained.push(fact);
 }
 assert.deepEqual(remaining,[],GROWTH_ASSERT);
 assert.deepEqual(unexplained,expected,GROWTH_ASSERT);
 return expected;
}
function validateScoreboardCombat(s,input,base,provenancePrefixLength=s.resourceProvenance.entries.length){
 const a=owner(s);
 if(!a){assert.equal(input.h6Growth,undefined,'scoreboard combat requires owner');return;}
 // Forward-fold independently calculated grants through chronological merge events.
 const totals=new Map();
 for(const row of validateScoreboardHistory(s,base))for(const d of row.deltas)totals.set(d.unitId,(totals.get(d.unitId)??0)+150);
 assert(Number.isInteger(provenancePrefixLength)&&provenancePrefixLength>=0&&provenancePrefixLength<=s.resourceProvenance.entries.length,'scoreboard combat provenance prefix');
 for(const f of s.resourceProvenance.entries.slice(0,provenancePrefixLength)){
  const merges=['unit-upgraded','unit-upgraded-after-combat'].includes(f.kind)?[f.event]:['carousel-preparation-settled','carousel-unit-claimed'].includes(f.kind)?f.upgrades:[];
  for(const e of merges)for(const id of e.consumedIds){totals.set(e.survivorId,(totals.get(e.survivorId)??0)+(totals.get(id)??0));totals.delete(id);}
 }
 const hp=s.round>a.acquiredRound&&boundary(s,s.round,base).rank<=4?1000:0;
 // Accept either a Match combat input or the multiplayer battle snapshot.
 const units=input.preparation?input.preparation.units.filter(u=>u.team==='player'):input.units.map(u=>({...u,team:'player'}));
 const expected=units.map(u=>({...zero(u.id),attackDamageBps:totals.get(u.id)??0,abilityPowerCenti:totals.get(u.id)??0,healthBps:ordinary(u,base)?hp:0}));
 assert.deepEqual(input.h6Growth,expected,'independent scoreboard combat AD/AP and temporary top-four HP');
}
function validateH6Transition(before,after,command,base){
 const prior=before.augmentHistory?.facts??[],next=after.augmentHistory?.facts??[];
 observedPrefixEqual(next,prior,'augment history facts append-only');
 const a=owner(after);
 if(a){
  const appended=next.slice(prior.length);
  const entry=command?.type==='continue'&&after.round===before.round+1;
  if(!entry)assert(!appended.some(f=>f.kind==='round-entry'||f.kind==='table'&&f.stage==='entry'||f.kind==='growth'&&(f.choiceId===a.choiceId||f.receiptId.startsWith('["scoreboard-scrapper",'))),'scoreboard growth requires a natural round entry');
  else {
   const {entry:f}=boundary(after,after.round,base);
   assert(f.sequence>=prior.length,'scoreboard new entry boundary');
   assert.deepEqual(f.roster,{units:before.preparation.units.filter(u=>u.team==='player'),items:before.items},'scoreboard official pre-entry roster');
  }
 }
 validateScoreboardHistory(after,base);
 if(after.combatInputBasis)validateScoreboardCombat(after,after.combatInputBasis.inputs,base,after.combatInputBasis.provenancePrefixLength);
}
module.exports={validateH6Transition,validateScoreboardCombat};
