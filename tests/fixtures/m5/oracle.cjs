/* Independent M5_RULES R3/R4 and approved M8B_OPENING/LOOT/ADDENDUM arithmetic. No production imports. */
const assert = require('node:assert/strict');
const CATALOG = [[], ['darius','irelia','lux','maddie','zyra'], ['leona','rell','tristana','urgot','vander'], ['ezreal','kogmaw','loris','nami','scar'], ['corki','garen','zoe'], ['caitlyn']];
const COST = Object.fromEntries(CATALOG.flatMap((ids,cost)=>ids.map(id=>[id,cost])));
const ODDS = {1:[100,0,0,0,0],2:[100,0,0,0,0],3:[75,25,0,0,0],4:[55,30,15,0,0],5:[45,33,20,2,0],6:[30,40,25,5,0],7:[19,30,40,10,1],8:[18,25,32,22,3],9:[15,20,25,30,10]};
const XP = {1:2,2:2,3:6,4:10,5:20,6:36,7:48,8:76};
const AUGMENTS=['bulky-buddies-i','glass-cannon-i','investment-strategy-i','manaflow-i','placebo','pumping-up-i'];
const ANOMALIES=['kill-streak','mage-armor','titanic-strikes'];
const COMPONENTS=['sword','vest','belt','rod','cloak','bow','gloves','tear'];
const SELL = {1:[1,3,9],2:[2,5,17],3:[3,8,26],4:[4,11,35],5:[5,14,44]};
function word(value){return Number((BigInt(value)*1664525n+1013904223n)%4294967296n);}
function shop(rng,generation,level,locked=false){const slots=[];for(let i=0;i<5;i++){rng=word(rng);const roll=Number(BigInt(rng)*100n/4294967296n);let total=0,cost=0;for(let j=0;j<5;j++){total+=ODDS[level][j];if(roll<total){cost=j+1;break;}}rng=word(rng);const bucket=CATALOG[cost];slots.push({status:'available',definitionId:bucket[Number(BigInt(rng)*BigInt(bucket.length)/4294967296n)]});}return {rngState:rng,shop:{generation,slots,locked}};}
function xp(level,value,amount){let applied=0;while(amount>0&&level<9){const take=Math.min(amount,XP[level]-value);amount-=take;applied+=take;value+=take;if(value===XP[level]){value=0;level++;}}return {level,xp:value,xpApplied:applied};}
// Hand-transcribed 38-round identity list from approved OPENING; no production imports.
const ROUND_IDS=['1-2','1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7',
 '3-1','3-2','3-3','3-4','3-5','3-6','3-7','4-1','4-2','4-3','4-4','4-5','4-6','4-7',
 '5-1','5-2','5-3','5-4','5-5','5-6','5-7','6-1','6-2','6-3','6-4','6-5','6-6','6-7'];
const ROUNDS=ROUND_IDS.map((roundId,index)=>{const [stage,sub]=roundId.split('-').map(Number);return {roundId,ordinal:index+1,stage,sub,kind:stage===1?'pve':sub===4?'supply':sub===7?'pve':'pvp'};});
function roundOrdinal(id){const round=ROUNDS.find(r=>r.roundId===id);assert(round,`Unknown independent round ${id}`);return round.ordinal;}
// Public helper accepts the pre-combat snapshot too. Derive ungranted gold from the
// approved independent plan plus formal source deaths, never from production income.
function ungrantedLootGold(before,combat){
 if(before.seed===undefined||!combat)return 0;
 const drops=lootPlan(before.seed,before.round).rounds.find(r=>r.encounterPlan.roundId===ROUNDS[before.round-1].roundId)?.encounterPlan.drops??[];
 return drops.filter(d=>d.payload.kind==='gold'&&!before.m8?.loot.receipts.some(r=>r.dropId===d.dropId)
  &&combat.neutralReceipts?.deaths.some(e=>e.unitId===d.sourceUnitId)
  &&combat.units.some(u=>u.id===d.sourceUnitId&&u.team==='enemy'&&!u.alive)).reduce((sum,d)=>sum+d.payload.quantity,0);
}
function settlement(before,combat,goldBefore=before.gold+ungrantedLootGold(before,combat)){
 const round=before.round,definition=ROUNDS[round-1];assert(definition,'Round outside approved campaign');
 const {roundId,stage,sub,kind:roundKind}=definition,result=combat?.result??'supply';
 const survivingEnemyCount=combat?.units.filter(u=>u.team==='enemy'&&u.alive).length??0;
 let streakAfter=before.streak;
 if(roundKind==='pvp'){const kind=result==='playerWin'?'win':'loss';streakAfter={kind,count:before.streak.kind===kind?before.streak.count+1:1};}
 const base=stage===1?{2:2,3:3,4:5}[sub]:5,naturalXp=stage===1&&sub===4?0:2;
 const win=roundKind==='pvp'&&result==='playerWin'?1:0,interestBasis=goldBefore+win;
 const interest=stage===1?0:Math.min(5,Math.floor(interestBasis/10));
 const streak=roundKind!=='pvp'?0:streakAfter.count>=6?3:streakAfter.count>=4?2:streakAfter.count>=2?1:0;
 const baseDamage=roundKind==='pvp'?[2,5,8,10,12][stage-2]:roundKind==='pve'?3:0;
 const playerDamage=result==='playerWin'||roundKind==='supply'?0:roundKind==='pve'?3:baseDamage+survivingEnemyCount;
 const progression=xp(before.level,before.xp,naturalXp),income=base+win+interest+streak,hpLost=Math.min(before.playerHp,playerDamage);
 return {round,roundId,result,combatTicks:combat?.tick??0,combatEventCount:combat?.nextEventSeq??0,settlementId:`round-${round}-settled`,roundKind,
  incomeBreakdown:{base,win,interest,streak},interestBasis,streakBefore:before.streak,streakAfter,xpRequested:naturalXp,
  income,goldBefore,goldAfter:goldBefore+income,xpAwarded:progression.xpApplied,levelBefore:before.level,
  levelAfter:progression.level,xpBefore:before.xp,xpAfter:progression.xp,hpBefore:before.playerHp,hpAfter:before.playerHp-hpLost,
  baseDamage,survivingEnemyCount,playerDamage,hpLost};
}
// Independent transcription of LOOT §§2–5,7 and ADDENDUM §§1–3. Never import a planner.
const LOOT_HEROES=[[],['darius','irelia','lux','maddie','zyra'],['leona','vander','rell','tristana','urgot'],['loris','ezreal','scar','kogmaw','nami'],['corki','garen','zoe']];
const LOOT_TABLE=[
 ['1-2','minions-a-v1',[['m01',0,'unit','maddie']]],
 ['1-3','minions-b-v1',[['m01',0,'unit','lux'],['r01',0,'choice']]],
 ['1-4','minions-c-v1',[['r01',0,'choice']]],
 ['2-7','krugs-v1',[['k01',0,'component'],['k01',1,'extra',1],['k02',0,'choice']]],
 ['3-7','wolves-v1',[['w00',0,'component'],['w00',1,'extra',2],['w01',0,'choice']]],
 ['4-7','razorbeaks-v1',[['r00',0,'component'],['r00',1,'extra',3],['r01',0,'choice']]],
 ['5-7','elder-dragon-v1',[['d01',0,'component'],['d01',1,'choice'],['d01',2,'extra',4]]],
 ['6-7','rift-herald-v1',[['h01',0,'gold',5]]],
];
const counterKey=id=>JSON.stringify(['m8b-loot-project-v1',id,'components-granted']);
const receiptId=id=>JSON.stringify([id,'grant']);
const choiceId=id=>JSON.stringify(['m8b-loot-choice',id]);
function lootIndex(rng,n){const limit=4294967296n/BigInt(n)*BigInt(n);let state=rng.state,draws=rng.draws;do{state=word(state);draws++;}while(BigInt(state)>=limit);return {index:state%n,rng:{state,draws}};}
const lootPlans=new Map();
function lootPlan(seed,ordinal){
 const key=JSON.stringify([seed,ordinal]);if(lootPlans.has(key))return lootPlans.get(key);
 assert(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff);assert(Number.isInteger(ordinal)&&ordinal>=0&&ordinal<=38);
 let rng={state:(seed^0xdeadbeef)>>>0,draws:0};const rounds=[];
 const draw=n=>{const next=lootIndex(rng,n);rng=next.rng;return next.index;};
 for(const [roundId,encounterId,slots] of LOOT_TABLE){if(roundOrdinal(roundId)>ordinal)break;const drops=[],choices=[];
  for(const [local,slotOrdinal,kind,value] of slots){
   const sourceUnitId=JSON.stringify(['pve',roundId,encounterId,local]);
   const identity={roundId,encounterId,sourceUnitId,slotOrdinal,dropId:JSON.stringify([roundId,encounterId,sourceUnitId,slotOrdinal])};
   if(kind==='choice'){choices.push({...identity,kind:'component-choice',quantity:1,poolVersion:'m8b-components-v1',terminalFallbackDefinitionId:COMPONENTS[draw(8)],revealCondition:'source-killed'});continue;}
   let payload;
   if(kind==='unit')payload={kind:'unit',definitionId:value,quantity:1};
   if(kind==='gold')payload={kind:'gold',quantity:value};
   if(kind==='component')payload={kind:'item',definitionId:COMPONENTS[draw(8)],quantity:1};
   if(kind==='extra'){const roll=draw(100),gold=roll<(value===4?70:75)?value:value===4&&roll<80?5:0;
    payload=gold?{kind:'gold',quantity:gold}:{kind:'unit',definitionId:LOOT_HEROES[value][draw(LOOT_HEROES[value].length)],quantity:1};}
   drops.push({...identity,payload,status:'planned',revealCondition:'source-killed',receiptId:null});
  }
  rounds.push({encounterPlan:{roundId,encounterId,policyVersion:'m8b-pve-project-v1',drops},choices});
 }
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const result=freeze({rng,rounds});lootPlans.set(key,result);return result;
}
function appended(before,after,key,label){assert.deepEqual(after.slice(0,before.length),before,`${label} append-only`);assert.equal(new Set(after.map(x=>x[key])).size,after.length,`${label} unique identity`);return after.slice(before.length);}
function bare(event){const {domain,eventSeq,...value}=event;return value;}
function validateLoot(state){
 const loot=state.m8.loot,expected=lootPlan(state.seed,state.round),frozen=loot.frozen;
 assert.equal(frozen.version,'m8-b8-loot-freeze-v1');assert.equal(frozen.seed,state.seed);assert.equal(frozen.throughRoundOrdinal,state.round);
 assert.deepEqual(frozen.rounds,expected.rounds,'independent frozen loot source/payload/fallback');assert.deepEqual(frozen.rng,expected.rng,'independent loot RNG conservation');
 const direct=expected.rounds.flatMap(r=>r.encounterPlan.drops),choices=expected.rounds.flatMap(r=>r.choices);
 const entries=new Map([...direct,...choices].map(d=>[d.dropId,d]));
 assert.deepEqual(loot.direct.map(d=>d.dropId),direct.map(d=>d.dropId),'direct loot identity');
 assert.deepEqual(loot.choiceEligibility.map(d=>d.dropId),choices.map(d=>d.dropId),'choice loot identity');
 for(const [records,key,label] of [[loot.receipts,'receiptId','loot receipt'],[loot.receipts,'dropId','loot drop receipt'],[loot.earnedEvidence,'dropId','earned loot'],[loot.choiceResolutions,'dropId','choice resolution']])assert.equal(new Set(records.map(r=>r[key])).size,records.length,`${label} unique identity`);
 const earned=new Map(loot.earnedEvidence.map(e=>[e.dropId,e]));
 for(const evidence of earned.values()){
  const entry=entries.get(evidence.dropId);assert(entry,'earned loot must have approved source');
  assert.equal(evidence.death.combatId,`round-${roundOrdinal(entry.roundId)}`,'earned combat identity');
  assert(Number.isSafeInteger(evidence.death.tick)&&evidence.death.tick>=0);assert(Number.isSafeInteger(evidence.death.eventSeq)&&evidence.death.eventSeq>=0);
  if(entry.roundId===state.roundDefinitionId){const combat=state.combat;assert(combat,'earned loot requires combat');
   assert(combat.units.some(u=>u.id===entry.sourceUnitId&&u.team==='enemy'&&u.unitKind==='neutral'&&!u.alive),'earned source must be dead');
   const deaths=combat.neutralReceipts.deaths.filter(d=>d.unitId===entry.sourceUnitId);assert.equal(deaths.length,1,'unique source death');
   assert.deepEqual(evidence.death,{combatId:combat.combatId,tick:deaths[0].tick,eventSeq:deaths[0].eventSeq},'earned source death identity');
   assert(evidence.death.tick<=combat.tick&&evidence.death.eventSeq<combat.nextEventSeq,'earned death boundary');
  }
 }
 const receipts=new Map(loot.receipts.map(r=>[r.dropId,r]));
 const resolutions=new Map(loot.choiceResolutions.map(r=>[r.dropId,r]));
 for(const drop of loot.direct){assert(['planned','revealed','pending-capacity','retained-terminal','forfeited','granted'].includes(drop.status));
  assert.equal(earned.has(drop.dropId),!['planned','forfeited'].includes(drop.status),'direct earned-only status');
  assert.equal(receipts.has(drop.dropId),drop.status==='granted','direct actual receipt');
  assert.equal(drop.receiptId,drop.status==='granted'?receiptId(drop.dropId):null);
  if(['pending-capacity','retained-terminal'].includes(drop.status))assert.equal(entries.get(drop.dropId).payload.kind,'unit','only heroes wait for capacity');
 }
 for(const choice of loot.choiceEligibility){assert(['planned','revealed','forfeited'].includes(choice.status));assert.equal(earned.has(choice.dropId),choice.status==='revealed','choice earned-only status');
  assert.equal(receipts.has(choice.dropId),resolutions.has(choice.dropId),'choice receipt and resolution atomic');
  if(resolutions.has(choice.dropId))assert.equal(choice.status,'revealed','resolved choice is earned');
 }
 const itemIds=[],unitIds=[],counters=Object.fromEntries(LOOT_TABLE.map(([id])=>[counterKey(id),0]));
 for(const receipt of loot.receipts){const entry=entries.get(receipt.dropId);assert(entry,'receipt must have approved source');assert(earned.has(receipt.dropId),'receipt must be earned');
  assert.equal(receipt.receiptId,receiptId(receipt.dropId),'canonical loot receipt');
  if(entry.payload)assert.deepEqual(receipt.payload,entry.payload,'independent loot receipt payload');
  else{const resolution=resolutions.get(receipt.dropId);assert(resolution,'choice resolution required');assert.equal(resolution.receiptId,receipt.receiptId);
   assert(['player-choice','terminal-fallback'].includes(resolution.method));
   assert.deepEqual(receipt.payload,{kind:'item',definitionId:receipt.payload.definitionId,quantity:1});assert(COMPONENTS.includes(receipt.payload.definitionId),'all eight component candidates only');
   if(resolution.method==='terminal-fallback'){assert.equal(receipt.payload.definitionId,entry.terminalFallbackDefinitionId,'pre-frozen terminal fallback');assert.equal(state.phase,'gameOver','terminal fallback remains terminal');}
  }
  const {payload,grantedItemIds,grantedUnitIds}=receipt;
  assert.equal(grantedItemIds.length,payload.kind==='item'?1:0,'actual loot item count');assert.equal(grantedUnitIds.length,payload.kind==='unit'?1:0,'actual loot unit count');
  itemIds.push(...grantedItemIds);unitIds.push(...grantedUnitIds);if(payload.kind==='item')counters[counterKey(entry.roundId)]++;
 }
 for(const resolution of resolutions.values())assert(choices.some(c=>c.dropId===resolution.dropId)&&receipts.has(resolution.dropId),'resolution requires actual choice receipt');
 assert.equal(new Set(itemIds).size,itemIds.length,'unique loot item identities');assert.equal(new Set(unitIds).size,unitIds.length,'unique loot unit births');assert.deepEqual(loot.guaranteeCounters,counters,'actual-only component counters');
 const pending=state.pendingChoice;
 if(pending?.kind==='component'){
  const descriptor=choices.find(c=>choiceId(c.dropId)===pending.choiceId);
  if(descriptor){assert(earned.has(descriptor.dropId)&&!resolutions.has(descriptor.dropId),'pending earned choice');
   assert.deepEqual(pending,{kind:'component',step:'offer',choiceId:choiceId(descriptor.dropId),eventId:choiceId(descriptor.dropId),generation:0,returnPhase:'settlement',offers:COMPONENTS,targetId:null,rerollCount:0},'complete loot choice');}
  else assert.equal(pending.eventId,`round:${state.roundDefinitionId}:supply`,'schedule component source');
 }
 // OPENING removed both old starting components and old .7 ScheduleReceipts.
 for(const receipt of state.scheduleReceipts){const round=ROUNDS[receipt.round-1];assert(round,'schedule round');
  const kind=round.kind==='supply'?'component':['2-1','3-2','4-2'].includes(round.roundId)?'augment':round.roundId==='4-6'?'anomaly':null;
  assert(kind,'approved schedule receipt source');assert.equal(receipt.kind,kind);assert.equal(receipt.eventId,`round:${round.roundId}:${kind==='component'?'supply':kind}`,'schedule namespace');
 }
 return entries;
}
function validateLootTransition(before,after,command,events){
 const prior=before.m8.loot,next=after.m8.loot,entries=validateLoot(after);
 const receipts=appended(prior.receipts,next.receipts,'receiptId','loot receipts');
 const earned=appended(prior.earnedEvidence,next.earnedEvidence,'dropId','loot evidence');
 const resolved=appended(prior.choiceResolutions,next.choiceResolutions,'dropId','loot resolutions');
 assert.deepEqual(events.filter(e=>e.type==='lootGranted').map(e=>e.receipt),receipts,'exactly one event per actual loot receipt');
 assert.deepEqual(events.filter(e=>e.type==='lootRevealed').map(e=>bare(e)),earned.map(e=>({type:'lootRevealed',...e})),'exactly one event per earned loot');
 assert.deepEqual(events.filter(e=>e.type==='lootChoiceResolved').map(e=>bare(e)),resolved.map(e=>({type:'lootChoiceResolved',...e})),'exactly one event per choice resolution');
 const newlyForfeited=[...next.direct,...next.choiceEligibility].filter(d=>d.status==='forfeited'&&![...prior.direct,...prior.choiceEligibility].some(p=>p.dropId===d.dropId&&p.status==='forfeited'));
 assert.deepEqual(events.filter(e=>e.type==='lootForfeited').map(e=>e.dropId),newlyForfeited.map(d=>d.dropId),'exactly one event per loot forfeit');
 for(const drop of newlyForfeited){assert.equal(after.combat?.status,'finished','forfeit only after combat');assert.equal(entries.get(drop.dropId).roundId,after.roundDefinitionId,'forfeit only current round');}
 for(const evidence of earned){const entry=entries.get(evidence.dropId);assert(events.some(e=>e.domain==='combat'&&e.type==='death'&&e.unitId===entry.sourceUnitId&&e.tick===evidence.death.tick&&e.eventSeq===evidence.death.eventSeq),'reveal requires this transition actual source death');}
 for(const receipt of receipts){assert.equal(after.combat?.status,'finished','loot only after combat');const entry=entries.get(receipt.dropId);assert.equal(entry.roundId,after.roundDefinitionId,'grant only current round');
  for(const id of receipt.grantedItemIds)assert.equal(after.items.find(i=>i.id===id)?.definitionId,receipt.payload.definitionId,'actual granted component definition');
 }
 for(const resolution of resolved){if(resolution.method==='terminal-fallback')assert.equal(after.phase,'gameOver','fallback only terminal');
  else{assert.equal(command?.type,'select','player choice needs command');assert.equal(command.choiceId,choiceId(resolution.dropId));assert.equal(command.generation,0);assert.equal(command.definitionId,receipts.find(r=>r.dropId===resolution.dropId).payload.definitionId);}}
 return receipts;
}
function investment(before,record){return {pumpingRounds:before.augmentProgress.pumpingRounds+(before.augments.some(a=>a.definitionId==='pumping-up-i')?1:0),investmentHp:before.augmentProgress.investmentHp+(before.augments.some(a=>a.definitionId==='investment-strategy-i')?8*record.incomeBreakdown.interest:0)};}
class Ledger {
 constructor(initial){this.gold=0;this.cards=1;this.combinations=0;this.costs={purchases:0,sales:0,saleLoss:0,rerolls:0,xp:0,anomaly:0,income:0,rewards:0};this.rows=[];this.receipts=new Set();this.check(initial);}
 apply(before,after,command,events=[]){
  const lootReceipts=validateLootTransition(before,after,command,events);
  let choice=before.choiceRngState,reward=before.rewardRngState,battle=before.battleSeedRngState;
  if(command?.type==='start')battle=word(battle);
  if(command?.type==='target'||command?.type==='anomalyReroll'){choice=word(choice);const pool=ANOMALIES.filter(id=>command.type!=='anomalyReroll'||!before.pendingChoice.offers.includes(id));assert.deepEqual(after.pendingChoice.offers,[pool[Number(BigInt(choice)*BigInt(pool.length)/4294967296n)]],'independent anomaly offer');}
  for(const event of events){
   if(event.type==='choiceOpened'&&event.choice.kind==='augment'){const pool=AUGMENTS.filter(id=>!after.augments.some(a=>a.definitionId===id));for(let i=0;i<3;i++){choice=word(choice);const j=i+choice%(pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}assert.deepEqual(event.choice.offers,pool.slice(0,3),'independent augment offers');}
   if(event.type==='rewardGranted'){reward=word(reward);assert.equal(event.receipt.itemIds.length,1);assert.equal(after.items.find(i=>i.id===event.receipt.itemIds[0]).definitionId,COMPONENTS[reward%8],'independent random component');}
  }
  assert.equal(after.choiceRngState,choice,'choice RNG conservation');assert.equal(after.rewardRngState,reward,'reward RNG conservation');assert.equal(after.battleSeedRngState,battle,'battle seed RNG conservation');
  const domain=events.filter(e=>e.domain==='match');assert.deepEqual(domain.map(e=>e.eventSeq),domain.map((_,i)=>before.nextMatchEventSeq+i),'match event sequence');assert.equal(after.nextMatchEventSeq,before.nextMatchEventSeq+domain.length);
  const costs=this.costs,units=new Map(before.preparation.units.filter(u=>u.team==='player').map(u=>[u.id,{definitionId:u.definitionId,starLevel:u.starLevel}]));
  let serial=before.nextUnitSerial;
  if(command?.type==='buy'){const definitionId=before.shop.slots[command.slot].definitionId,cost=COST[definitionId];this.gold-=cost;costs.purchases+=cost;this.cards++;units.set(`unit-${serial++}`,{definitionId,starLevel:1});}
  if(command?.type==='sell'){const unit=before.preparation.units.find(u=>u.id===command.id),cost=COST[unit.definitionId],copies=3**(unit.starLevel-1),value=SELL[cost][unit.starLevel-1];this.gold+=value;costs.sales+=value;costs.saleLoss+=cost*copies-value;this.cards-=copies;units.delete(unit.id);}
  for(const [type,cost,key] of [['reroll',2,'rerolls'],['buyXp',4,'xp'],['anomalyReroll',1,'anomaly']])if(command?.type===type){this.gold-=cost;costs[key]+=cost;}
  for(const receipt of lootReceipts){if(receipt.payload.kind==='gold'){this.gold+=receipt.payload.quantity;costs.rewards+=receipt.payload.quantity;}
   if(receipt.payload.kind==='unit'){assert.deepEqual(receipt.grantedUnitIds,[`unit-${serial}`],'true loot candidate serial');units.set(`unit-${serial++}`,{definitionId:receipt.payload.definitionId,starLevel:1});this.cards++;}}
  assert.equal(after.nextUnitSerial,serial,'unit serial accounting');
  for(const event of events.filter(e=>e.type==='unitUpgraded')){assert.equal(event.consumedIds.length,2);assert.equal(new Set([event.survivorId,...event.consumedIds]).size,3);for(const id of [event.survivorId,...event.consumedIds])assert.deepEqual(units.get(id),{definitionId:event.definitionId,starLevel:event.fromStar},'upgrade consumes actual candidate lineage');assert.equal(event.toStar,event.fromStar+1);for(const id of event.consumedIds)units.delete(id);units.set(event.survivorId,{definitionId:event.definitionId,starLevel:event.toStar});}
  assert.deepEqual(new Map(after.preparation.units.filter(u=>u.team==='player').map(u=>[u.id,{definitionId:u.definitionId,starLevel:u.starLevel}])),units,'actual player unit lineage');
  const schedule=appended(before.scheduleReceipts,after.scheduleReceipts,'eventId','schedule receipts');
  for(const receipt of schedule){assert(!this.receipts.has(receipt.eventId),'schedule receipt only once');this.receipts.add(receipt.eventId);this.gold+=receipt.gold;costs.rewards+=receipt.gold;}
  let itemSerial=before.nextItemSerial;
  for(const receipt of lootReceipts)for(const id of receipt.grantedItemIds)assert.equal(id,`item-${itemSerial++}`,'loot item serial');
  for(const receipt of schedule)for(const id of receipt.itemIds)assert.equal(id,`item-${itemSerial++}`,'schedule item serial');
  const records=appended(before.roundResults,after.roundResults,'settlementId','settlements');assert(records.length<=1,'one settlement per command');
  let growth=before.augmentProgress;
  for(const record of records){const expected=settlement(before,after.combat,this.gold);assert.deepEqual(record,expected,`independent settlement R${before.round}`);this.gold+=expected.income;costs.income+=expected.income;this.rows.push(expected);growth=investment(before,expected);}
  assert.deepEqual(after.augmentProgress,growth,'once-only independent augment growth');
  this.combinations+=events.filter(e=>e.type==='itemCombined').length;this.check(after,true);
 }
 check(state,lootChecked=false){if(!lootChecked)validateLoot(state);assert.equal(state.gold,this.gold,'independent gold ledger');assert.equal(state.preparation.units.filter(u=>u.team==='player').reduce((n,u)=>n+3**(u.starLevel-1),0),this.cards,'card-equivalent conservation');assert.equal(new Set(state.items.map(i=>i.id)).size,state.items.length,'unique item IDs');
  const grants=state.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)+state.m8.loot.receipts.reduce((n,r)=>n+r.grantedItemIds.length,0);
  assert.equal(state.items.length,grants-this.combinations,'component/completed-item conservation');assert.equal(new Set(state.scheduleReceipts.map(r=>r.eventId)).size,state.scheduleReceipts.length,'receipt identity');assert.equal(state.nextItemSerial,1+grants+this.combinations,'item serial accounting');}
}
module.exports={ROUNDS,roundOrdinal,CATALOG,COST,ODDS,XP,SELL,COMPONENTS,word,shop,xp,settlement,investment,lootIndex,lootPlan,validateLoot,validateLootTransition,Ledger};
