/* Independent M5_RULES R3/R4 and approved M8B_OPENING arithmetic. Deliberately imports no production code. */
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
function settlement(before,combat){
 const round=before.round,definition=ROUNDS[round-1];assert(definition,'Round outside approved campaign');
 const {roundId,stage,sub,kind:roundKind}=definition,result=combat?.result??'supply';
 const survivingEnemyCount=combat?.units.filter(u=>u.team==='enemy'&&u.alive).length??0;
 let streakAfter=before.streak;
 if(roundKind==='pvp'){const kind=result==='playerWin'?'win':'loss';streakAfter={kind,count:before.streak.kind===kind?before.streak.count+1:1};}
 const base=stage===1?{2:2,3:3,4:5}[sub]:5,naturalXp=stage===1&&sub===4?0:2;
 const win=roundKind==='pvp'&&result==='playerWin'?1:0,interestBasis=before.gold+win;
 const interest=stage===1?0:Math.min(5,Math.floor(interestBasis/10));
 const streak=roundKind!=='pvp'?0:streakAfter.count>=6?3:streakAfter.count>=4?2:streakAfter.count>=2?1:0;
 const baseDamage=roundKind==='pvp'?[2,5,8,10,12][stage-2]:roundKind==='pve'?3:0;
 const playerDamage=result==='playerWin'||roundKind==='supply'?0:roundKind==='pve'?3:baseDamage+survivingEnemyCount;
 const progression=xp(before.level,before.xp,naturalXp),income=base+win+interest+streak,hpLost=Math.min(before.playerHp,playerDamage);
 return {round,roundId,result,combatTicks:combat?.tick??0,settlementId:`round-${round}-settled`,roundKind,
  incomeBreakdown:{base,win,interest,streak},interestBasis,streakBefore:before.streak,streakAfter,xpRequested:naturalXp,
  income,goldBefore:before.gold,goldAfter:before.gold+income,xpAwarded:progression.xpApplied,levelBefore:before.level,
  levelAfter:progression.level,xpBefore:before.xp,xpAfter:progression.xp,hpBefore:before.playerHp,hpAfter:before.playerHp-hpLost,
  baseDamage,survivingEnemyCount,playerDamage,hpLost};
}
class Ledger {
 constructor(initial){this.gold=0;this.cards=1;this.combinations=0;this.costs={purchases:0,sales:0,saleLoss:0,rerolls:0,xp:0,anomaly:0,income:0,rewards:0};this.rows=[];this.receipts=new Set();this.check(initial);}
 apply(before,after,command,events=[]){let choice=before.choiceRngState,reward=before.rewardRngState,battle=before.battleSeedRngState;if(command?.type==='start')battle=word(battle);if(command?.type==='target'||command?.type==='anomalyReroll'){choice=word(choice);const pool=ANOMALIES.filter(id=>command.type!=='anomalyReroll'||!before.pendingChoice.offers.includes(id));assert.deepEqual(after.pendingChoice.offers,[pool[Number(BigInt(choice) * BigInt(pool.length) / 4294967296n)]],'independent anomaly offer');}for(const event of events){if(event.type==='choiceOpened'&&event.choice.kind==='augment'){const pool=AUGMENTS.filter(id=>!after.augments.some(a=>a.definitionId===id));for(let i=0;i<3;i++){choice=word(choice);const j=i+choice%(pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}assert.deepEqual(event.choice.offers,pool.slice(0,3),'independent augment offers');}if(event.type==='rewardGranted'){reward=word(reward);assert.equal(event.receipt.itemIds.length,1);assert.equal(after.items.find(i=>i.id===event.receipt.itemIds[0]).definitionId,COMPONENTS[reward%8],'independent random component');}}assert.equal(after.choiceRngState,choice,'choice RNG conservation');assert.equal(after.rewardRngState,reward,'reward RNG conservation');assert.equal(after.battleSeedRngState,battle,'battle seed RNG conservation');const domain=events.filter(e=>e.domain==='match');assert.deepEqual(domain.map(e=>e.eventSeq),domain.map((_,i)=>before.nextMatchEventSeq+i),'match event sequence');assert.equal(after.nextMatchEventSeq,before.nextMatchEventSeq+domain.length);assert.equal(after.nextUnitSerial,before.nextUnitSerial+(command?.type==='buy'?1:0),'unit serial accounting');const costs=this.costs;if(command?.type==='buy'){const cost=COST[before.shop.slots[command.slot].definitionId];this.gold-=cost;costs.purchases+=cost;this.cards++;}if(command?.type==='sell'){const unit=before.preparation.units.find(u=>u.id===command.id),cost=COST[unit.definitionId],copies=3**(unit.starLevel-1),value=SELL[cost][unit.starLevel-1];this.gold+=value;costs.sales+=value;costs.saleLoss+=cost*copies-value;this.cards-=copies;}for(const [type,cost,key] of [['reroll',2,'rerolls'],['buyXp',4,'xp'],['anomalyReroll',1,'anomaly']])if(command?.type===type){this.gold-=cost;costs[key]+=cost;}for(const receipt of after.scheduleReceipts)if(!this.receipts.has(receipt.eventId)){this.receipts.add(receipt.eventId);this.gold+=receipt.gold;costs.rewards+=receipt.gold;}
  for(const record of after.roundResults.slice(before.roundResults.length)){const expected=settlement(before,after.combat);assert.deepEqual(record,expected,`independent settlement R${before.round}`);this.gold+=expected.income;costs.income+=expected.income;this.rows.push(expected);}this.combinations+=events.filter(e=>e.type==='itemCombined').length;this.check(after);}
 check(state){assert.equal(state.gold,this.gold,'independent gold ledger');assert.equal(state.preparation.units.filter(u=>u.team==='player').reduce((n,u)=>n+3**(u.starLevel-1),0),this.cards,'card-equivalent conservation');assert.equal(new Set(state.items.map(i=>i.id)).size,state.items.length,'unique item IDs');const grants=state.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0);assert.equal(state.items.length,grants-this.combinations,'component/completed-item conservation');assert.equal(new Set(state.scheduleReceipts.map(r=>r.eventId)).size,state.scheduleReceipts.length,'receipt identity');assert.equal(state.nextItemSerial,1+grants+this.combinations,'item serial accounting');}
}
module.exports={ROUNDS,roundOrdinal,CATALOG,COST,ODDS,XP,SELL,word,shop,xp,settlement,Ledger};
