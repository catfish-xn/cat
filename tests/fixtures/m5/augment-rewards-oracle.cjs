/* Independent reward ledger. Only test data and raw archive inputs; no production modules.
 * Specs use tuples: U fixed unit, I fixed item, C consumable, R random hero,
 * Q random item, A all heroes. All counts/thresholds are literal source transcriptions.
 * Stream namespaces/order, capacity retry and delayed supply births: P-AG1/4, P-B4.
 */
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const b2=require('../../augment-pool-batch2-oracle-data.cjs');
const b3=require('../../augment-pool-batch3-oracle-data.cjs');
const b4=require('../../augment-pool-batch4-oracle-data.cjs');
const U=(id,n=1,star=1)=>['U',id,n,star],I=(id,n=1)=>['I',id,n],C=(id,n=1)=>['C',id,n],R=(cost,n=1,star=1,distinct=false)=>['R',cost,n,star,distinct],Q=(pool,n=1,identical=false)=>['Q',pool,n,identical];
const lesser='TFT_Consumable_ChampionDuplicator_III';
// Source descriptions (including counts absent from effects), existing P-AG conventions.
const initial={
 'cluttered-mind':[R(1,4)],slammin:[Q('component')],'slammin-plus':[Q('component')],
 'two-much-value':[R(2,2)],
 'cooking-pot':[I('frying-pan')],
 'loot-explosion':[U('camille'),U('powder')],
 'category-five':[I('runaans-hurricane')],'a-change-of-fate':[I('blue-buff')],
 coronation:[I('TFT_Item_ForceOfNature')], 'tacticians-kitchen':[I('TFT_Item_TacticiansRing'),Q('emblem')],
 'branching-out':[Q('emblem'),C('reforger')], 'item-grab-bag-i':[Q('completed')],
 'one-two-five':[Q('component'),R(5)],'band-of-thieves-i':[I('thiefs-gloves')],
 'teaming-up-i':[Q('component'),R(3,2)],'iron-assets':[U('TFT_ArmoryKeyComponent')],
 'missed-connections':[['A',1]],'ones-twos-three':[R(1,2),R(2,2),R(3)],
 'heroic-grab-bag':[C(lesser,2)],'big-grab-bag':[Q('component',3),C('reforger')],
 'teaming-up-ii':[Q('support'),R(4,2)],'support-cache':[U('TFT_ArmoryKeySupport')],
 'duo-queue':[R(5,2),Q('component',2,true)],'two-trick':[R(2,1,2),R(1,2,2)],
 'build-a-bud':[R(1,1,3)],'radiant-refactor':[C('masterwork-upgrade'),U('TFT_ArmoryKeyComponent')],
 'final-polish':[U('TFT_ArmoryKeySupport'),U('TFT_ArmoryKeyCompleted')],
 'one-buff-two-buff':[I('red-buff'),I('blue-buff'),C('TFT_Consumable_NeekosHelp')],
};
// Crest/crown grants: independent 14.24 description identities, project item aliases.
const families=[
 ['academy','Academy','leona',null,null],['ambusher','Ambusher','camille','hand-of-justice','camille'],
 ['artillerist','Demolitionist','tristana','runaans-hurricane','tristana'],['automata','Automata','nocturne','guardbreaker','nocturne'],
 ['bruiser','Bruiser','sett','redemption','sett'],['black-rose','Cabal',null,'shojin',null],
 ['chem-baron','Crime','renata','nashors-tooth','smeech'],['conqueror','Warband','rell','last-whisper','rell'],
 ['dominator','Infused','blitzcrank','protectors-vow','blitzcrank'],['enforcer','Squad',null,'infinity-edge','maddie'],
 ['experiment','Experiment','urgot','bloodthirster','urgot'],['family','Family','violet','redemption','vander'],
 ['firelight','Hoverboard','zeri','protectors-vow','scar'],['pit-fighter','PitFighter','urgot','steraks-gage','gangplank'],
 ['quickstriker','Challenger','akali','rageblade','nocturne'],['rebel','Rebel','akali','jeweled-gauntlet','akali'],
 ['scrap','Scrap','ziggs',null,'ziggs'],['sentinel','Titan','rell','crownguard','loris'],
 ['sniper','Sniper','zeri','infinity-edge','zeri'],['sorcerer','Sorcerer','vladimir','adaptive-helm','vladimir'],
 ['visionary','Invoker','renata','shojin','renata'],['watcher','Watcher','vander','steadfast-heart','scar'],
];
for(const [id,api,hero,item,crownHero]of families){
 initial[id+'-crest']=[I(`TFT13_Item_${api}EmblemItem`),...(hero?[U(hero)]:[])];
 initial[id+'-crown']=[I(`TFT13_Item_${api}EmblemItem`),...(item?[I(item)]:[]),...(crownHero?[U(crownHero)]:[])];
}
initial['academy-crown'].push(Q('sponsored'));initial['family-crown'].push(U('violet'));initial['scrap-crown'].push(Q('component',2));
Object.assign(initial,b2.gifts,b3.gifts);
const MOD=4294967296n;
const word=n=>Number((BigInt(n)*1664525n+1013904223n)%MOD);
function salt(seed,parts,mix=false){let h=2166136261n;for(const c of JSON.stringify(parts))h=((h^BigInt(c.charCodeAt(0)))*16777619n)%MOD;let n=Number(BigInt(seed)^h)>>>0;if(mix){n^=n>>>16;n=Math.imul(n,0x85ebca6b);n^=n>>>13;n=Math.imul(n,0xc2b2ae35);n^=n>>>16;}return n>>>0;}
const pick=(w,n)=>Number(BigInt(w)*BigInt(n)/MOD);
function outcome(s,a){
 let rng=salt(s.seed,['augment-pool-batch3',a.definitionId==='magic-roll'?'dice':'chaos',s.multiplayer?.seatId??'solo',a.choiceId,a.definitionId],true);
 if(a.definitionId==='call-to-chaos')return ['gold','three-star','hullbreakers','horizon-focus','thiefs-gloves','solari-dummy','zeke-dummy','emblems','xp','rerolls'][pick(word(rng),10)];
 const dice=Array.from({length:3},()=>{rng=word(rng);return pick(rng,6)+1;});
 if(dice.join()==='6,2,6')return 'egg';
 if(dice.every(n=>n===dice[0]))return dice[0]<=3?'low-triple':'high-triple';
 // P 2026-10-24 ratio table bands, in dice sum order.
 const sum=dice.reduce((a,b)=>a+b,0);return sum<=8?'health':sum<=11?'units':sum<=15?'components':'pan';
}
function outcomeGifts(s,a){const o=outcome(s,a);return ({
 units:[R(3,2,2),R(2,1,2)],components:[Q('component',4,true)],pan:[I('frying-pan'),Q('component',2)],
 'high-triple':[I('TFT_Item_TacticiansRing')],'low-triple':[C(lesser,3)],
 'three-star':[R(3,1,3)],hullbreakers:[I('TFT9_Item_OrnnHullbreaker',3),C('magnetic-remover')],
 'horizon-focus':[I('TFT9_Item_OrnnHorizonFocus',3),C('magnetic-remover')],
 'thiefs-gloves':[I('thiefs-gloves',3),C('magnetic-remover')],
 'solari-dummy':[U('training-dummy')],'zeke-dummy':[U('training-dummy')],emblems:[Q('emblem',5)],
 })[o]??[];}
function expand(s,a,specs,env){return specs.flatMap((spec,index)=>{
 const [type,value,n=1,star=1,distinct=false]=spec;
 const pool=type==='R'||type==='A'?[...env.CATALOG[value]].sort():type==='F'?[...value].sort():type==='Q'?[...env.pools[value]]:null;
 let rng=salt(s.seed,['augment-pool-batch1',s.multiplayer?.seatId??'solo',a.choiceId,a.definitionId,index]),first;
 return Array.from({length:type==='A'?pool.length:n},(_,copy)=>{
  let definitionId=value;
  if(type==='A')definitionId=pool[copy];
  else if(pool){rng=word(rng);const i=pick(rng,pool.length);definitionId=pool[i];if(type==='R'&&distinct)pool.splice(i,1);if(type==='Q'&&spec[3]===true)definitionId=first??=definitionId;}
  return {receiptId:JSON.stringify(['augment-pool-batch1',a.choiceId,a.definitionId,index,copy]),source:'augment-pool-batch1',kind:['U','R','A','F'].includes(type)?'unit':type==='C'?'consumable':'item',definitionId,starLevel:['U','R'].includes(type)?star:1,acquiredRound:a.acquiredRound};
 });
});}
const owner=(a,part,round=a.acquiredRound)=>({...a,choiceId:JSON.stringify([a.choiceId,...part]),acquiredRound:round});
// Batch 5: independent literal 14.24 tasks; P-B5 pre-entry bank and no retroactive entry.
function b5Entry(s,round){
 const p=s.roundResults.find(r=>r.round===round-1);assert(p,'independent fate entry history');
 let bank=p.goldAfter;
 for(const r of (s.seatMechanics?.receipts??[]).slice(p.mechanicReceiptPrefixLength))if(r.round===p.round)bank+=r.kind==='gold'?r.amount:r.kind==='unit'?r.gold:r.kind==='choice'?-r.price:0;
 for(const e of s.resourceProvenance.entries)if(e.kind==='unit-sold'&&e.context==='settlement-capacity'&&e.roundId===p.roundId)bank+=e.goldGranted;
 return bank;
}
function rewardPlan(s,env){
 const gifts=[],batch2=[],batch3=[],forms=[],levelsOut=[],gold=[],battles=s.seatMechanics?.hidden?.progress?.economyReceipts.filter(r=>r.kind==='battle').map(r=>r.facts)??[];
 const addGold=(source,a,parts,amount,round)=>{if(amount)gold.push({receiptId:JSON.stringify([source,a.choiceId,...parts]),source,kind:'gold',amount,round});};
 const nonSupply=r=>{while(env.ROUNDS[r-1]?.kind==='supply')r++;return r;};
 for(const a of s.augments){
  const start=expand(s,a,initial[a.definitionId]??[],env);gifts.push(...start);
  const facts=battles.filter(f=>f.round>=a.acquiredRound);
  if(a.definitionId==='a-change-of-fate'){
   let bank;for(let r=a.acquiredRound+1;r<=s.round;r++)if(b5Entry(s,r)>=60){bank=r;break;}
   const win=s.roundResults.find(r=>r.round>=a.acquiredRound&&r.roundKind==='pvp'&&r.result==='playerWin')?.round;
   if(bank!==undefined&&win!==undefined){const due=Math.max(bank,win),hero=nonSupply(due);
    levelsOut.push(...expand(s,owner(a,['batch5-fate','item'],due),[I('gunblade')],env));
    if(hero<=s.round)levelsOut.push(...expand(s,owner(a,['batch5-fate','unit'],hero),[U('mel')],env));
   }
  }
  const counts=b2.rewards[a.definitionId];
  if(counts){let total=0,paid=0;for(const f of facts){total+=f.batch2?.find(x=>x.definitionId===a.definitionId)?.count??0;
   const due=Math.min(counts.max??Infinity,Math.floor(total/counts.every));
   while(paid<due){const index=paid++;if(counts.gold)addGold('augment-pool-batch2',a,['enforce',index],counts.gold,f.round);
    else batch2.push(...expand(s,owner(a,['batch2-reward',index],f.round),counts.gifts,env));}
  }}
  if(a.definitionId==='crimson-pact')for(const r of s.seatMechanics?.receipts??[])if(r.source==='black-market'&&r.kind==='choice'&&r.skipped&&r.round>=a.acquiredRound)addGold('augment-pool-batch2',a,['market',r.receiptId],6,r.round);
  const schedules=b3.schedules[a.definitionId]??[];
  for(const [si,rule]of schedules.entries()){
   const events=[];let total=0;
   const emit=round=>events.push(round);
   const [counter,every,repeat,max=Infinity,specs=[],amount=0,from=1]=rule;
   if(counter==='round'||counter==='stage'){
    for(let r=a.acquiredRound+1;r<=s.round&&events.length<max;r++)if(counter==='stage'?env.ROUNDS[r-1]?.sub===1:r-a.acquiredRound>=from){const due=specs==='copy'?nonSupply(r):r;if(due<=s.round)emit(due);}
   }else if(counter==='outcome')emit(a.acquiredRound);
   else if(counter==='egg'){if(outcome(s,a)==='egg'&&nonSupply(a.acquiredRound+3)<=s.round)emit(nonSupply(a.acquiredRound+3));}
   else if(counter==='golden'){
    for(let r=a.acquiredRound+1;r<=s.round;r++)if(r-a.acquiredRound+facts.filter(f=>f.round<r&&f.roundKind==='pvp'&&f.result==='win').length>=11){const due=nonSupply(r);if(due<=s.round)emit(due);break;}
   }else if(counter==='adventure'){
    const defs=new Set(start.filter(g=>g.kind==='unit').map(g=>g.definitionId)),done=new Set();
    for(const e of s.resourceProvenance.entries)if(['unit-upgraded','unit-upgraded-after-combat'].includes(e.kind)&&e.event.toStar===3&&defs.has(e.event.definitionId)&&env.ROUNDS.find(r=>r.roundId===e.roundId)?.ordinal>=a.acquiredRound){done.add(e.event.definitionId);if(done.size>=2){const due=nonSupply(env.ROUNDS.find(r=>r.roundId===e.roundId).ordinal+1);if(due<=s.round)emit(due);break;}}
   }else if(counter==='kills'){
    const table=env.spoils(s,a,Number(a.definitionId.endsWith('iii')?3:a.definitionId.endsWith('ii')?2:1));let k=0;
    for(const f of facts)for(let remaining=f.batch2?.find(x=>x.definitionId==='spoils-of-war')?.count??0;remaining>0;remaining--){k++;const n=table[3*((k-1)%83+1)]??0;if(n)addGold('augment-pool-batch3',a,[si,k],n,f.round);}
   }else{
    const dummy=start.find(g=>g.kind==='unit'&&['training-dummy','forming-dummy','tower-dummy'].includes(g.definitionId));
    const dummyId=dummy?s.seatMechanics?.receipts.find(r=>r.receiptId===dummy.receiptId)?.unitId:null;
    for(const f of facts){
     total+=counter==='deaths'?f.alliedDeaths:counter==='healing'?f.batch3Healing??0:counter==='damage'?f.batch3DamageDealt??0:
      counter==='dummy-deaths'?(f.batch3Dummy?.deaths.includes(dummyId)?1:0):counter==='dummy-first'?(f.roundKind==='pvp'&&f.batch3Dummy?.first===dummyId?1:0):counter==='dummy-gold'?f.batch3Dummy?.gold??0:
      f.roundKind==='pvp'&&(counter==='pvp'||f.result===(counter==='wins'?'win':'loss'))?1:0;
     const due=Math.min(max,repeat?Math.floor(total/every):total>=every?1:0);while(events.length<due)emit(f.round);
    }
   }
   for(const [ordinal,round]of events.entries()){
    const o=owner(a,['batch3',si,ordinal],round);
    let gs=specs==='copy'?[U(start[0].definitionId)]:specs,n=amount;
    if(counter==='outcome'){gs=outcomeGifts(s,a);n=({'gold':58,'three-star':20,'low-triple':6})[outcome(s,a)]??0;}
    if(counter==='golden'||counter==='adventure'){const loot=env.loot(s,a,counter);gs=loot.gifts;n=loot.gold;}
    batch3.push(...expand(s,o,gs,env));addGold('augment-pool-batch3',a,[si,ordinal],n,round);
   }
  }
  // Form-swapper rewards are upgrades after the acquisition marker, not ownership alone.
  if(a.definitionId==='why-not-both'){
   const marker=s.resourceProvenance.entries.find(e=>e.kind==='form-swapper-selected'&&e.choiceId===a.choiceId);
   if(marker)for(const e of s.resourceProvenance.entries.filter(e=>e.sequence>marker.sequence)){
    const upgrades=['unit-upgraded','unit-upgraded-after-combat'].includes(e.kind)?[e.event]:['carousel-preparation-settled','carousel-unit-claimed'].includes(e.kind)?e.upgrades:[];
    for(const [i,u]of upgrades.entries())if(u.toStar===3&&['swain','gangplank','elise','jayce'].includes(u.definitionId))forms.push(...expand(s,owner(a,['form-swapper-upgrade',e.sequence,i],env.ROUNDS.find(r=>r.roundId===e.roundId).ordinal),[U(u.definitionId,1,2)],env));
   }
  }
  const results=s.roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=a.acquiredRound);
  if(a.definitionId==='risky-moves'&&results.length>=7)addGold('augment-risky-moves',a,[],30,results[6].round);
  if(a.definitionId==='kingslayer')for(const r of results.filter(r=>r.result==='playerWin'))addGold('augment-kingslayer',a,[r.round],(s.multiplayer?.receipts.find(x=>x.round===r.round)?.opponentHp??0)>r.hpBefore?4:1,r.round);
  const levels=b4[a.definitionId];if(levels){
   const from=s.seatMechanics?.seat['augment-acquisition-levels']?.[a.choiceId];assert(Number.isInteger(from),'independent acquisition level required');
   const first=levels.initialCost?expand(s,a,[R(levels.initialCost)],env):[];levelsOut.push(...first);
   const levelRound=n=>n<=from?a.acquiredRound:s.roundResults.find(r=>r.round>=a.acquiredRound&&(r.levelBefore>=n||r.levelAfter>=n))?.round??s.round;
   for(let n=1;n<=s.level;n++){
    let specs=levels.anvils?.filter(([v])=>v===n).map(([,kind])=>U('TFT_ArmoryKey'+kind))??[];
    if(n>from&&levels.repeatCopy)specs=[U(first[0].definitionId)];
    if(n>from&&levels.offset)specs=[R(Math.max(levels.min,n-levels.offset),1,levels.star)];
    levelsOut.push(...expand(s,owner(a,['batch4-level',n],levelRound(n)),specs,env));
   }
   if(levels.gold&&s.level>=levels.gold[0])addGold('augment-pool-batch4',a,['level',levels.gold[0]],levels.gold[1],levelRound(levels.gold[0]));
  }
 }
 const explosion=lootExplosionPlan(s);
 return {gifts:[...gifts,...batch2,...batch3,...forms,...levelsOut,...explosion.gifts],gold:[...gold,...explosion.gold]};
}
// P-B5-69 (2026-10-27): independent integer weights and reward mapping, not production receipts.
function lootExplosionPlan(s) {
 const gifts=[],gold=[],a=s.augments.find(a=>a.definitionId==='loot-explosion');if(!a)return {gifts,gold};
 for(const r of s.roundResults.filter(r=>r.round>=a.acquiredRound&&r.roundKind!=='supply')) {
  const rows=s.augmentHistory?.facts.filter(f=>f.kind==='deaths'&&f.round===r.round)??[];
  assert(rows.some(f=>f.completeThroughTick===r.combatTicks),'independent loot explosion complete deaths');
  const stage=Number(r.roundId.split('-')[0]),weights=stage===2?[80,20]:stage===3?[30,60,5,5]:stage===4?[30,35,25,5,5]:[15,30,35,13,5,2];
  const seen=new Set();
  for(const d of rows.flatMap(f=>f.deaths).sort((a,b)=>a.eventSeq-b.eventSeq)) {
   assert(!seen.has(d.eventSeq),'independent loot explosion unique death');seen.add(d.eventSeq);
   const k=d.lootExplosion,seat=s.multiplayer?.seatId??'solo';
   if(!k||!d.ordinaryHero||k.killerSeatId!==seat||d.ownerSeatId===seat)continue;
   assert(Number.isInteger(k.critChanceBps)&&k.critChanceBps>=0&&k.critChanceBps<=10000);
   const ns=['augment-pool-batch5-g7',seat,a.choiceId,r.round,d.combatId,d.eventSeq];
   let rng=salt(s.seed,ns);const draw=()=>rng=word(rng);
   if(BigInt(draw())*10000n>=BigInt(Math.min(10000,1100+k.critChanceBps))*MOD)continue;
   let ticket=pick(draw(),weights.reduce((a,b)=>a+b,0)),tier=1;
   for(const w of weights){if(ticket<w)break;ticket-=w;tier++;}
   if(BigInt(draw())*10000n<BigInt(k.critChanceBps)*MOD)tier=Math.min(6,tier+1);
   const receiptId=i=>JSON.stringify([...ns,i]);
   if(tier<=3)gold.push({receiptId:receiptId(0),source:ns[0],kind:'gold',amount:tier,round:r.round});
   else {
    const pool=data.pools[tier===6?'completed':'component'];
    for(let i=0;i<(tier===5?2:1);i++)gifts.push({receiptId:receiptId(i),source:ns[0],kind:'item',definitionId:pool[pick(draw(),pool.length)],starLevel:1,acquiredRound:r.round});
   }
  }
 }
 return {gifts,gold};
}
function validateLootExplosionReceipts(s) {
 const plan=lootExplosionPlan(s),expected=[...plan.gold,...plan.gifts].map(r=>({receiptId:r.receiptId,source:r.source,round:r.round??r.acquiredRound,kind:r.kind,...(r.kind==='gold'?{amount:r.amount}:{definitionId:r.definitionId})}));
 const actual=(s.seatMechanics?.receipts??[]).filter(r=>r.source==='augment-pool-batch5-g7'||r.receiptId.startsWith('["augment-pool-batch5-g7",')).map(r=>({receiptId:r.receiptId,source:r.source,round:r.round,kind:r.kind,...(r.kind==='gold'?{amount:r.amount}:{definitionId:r.definitionId})}));
 const sort=rs=>rs.sort((a,b)=>a.receiptId.localeCompare(b.receiptId));
 assert.deepEqual(sort(actual),sort(expected),'independent Loot Explosion receipts');
}
module.exports={rewardPlan,expand,salt,pick,word,outcome,initial,lootExplosionPlan,validateLootExplosionReceipts};
const data=require('../../augment-reward-pools-oracle-data.cjs');
function environment(s,base){return {...base,pools:{...data.pools,sponsored:[...(s.seatMechanics?.seat.academy?.sponsored??[])].sort()},
 spoils(s,a,tier){const tables=data.spoils[tier],rng=salt(s.seed,['augment-pool-batch3','spoils',s.multiplayer?.seatId??'solo',a.choiceId,a.definitionId]);return tables[pick(word(rng),tables.length)];},
 loot(s,a,kind){const tables=data.loot[kind],weights=tables.map(t=>Math.round(t.weight*1e8));
 let ticket=pick(word(salt(s.seed,['augment-pool-batch3','loot',s.multiplayer?.seatId??'solo',a.choiceId,a.definitionId])),weights.reduce((a,b)=>a+b,0));
 return tables[weights.findIndex(w=>{if(ticket<w)return true;ticket-=w;return false;})];},
};}
// No prefix admission: a fabricated augment-pool-anything must never enter the ledger.
const admitted=new Set(['augment-pool-shop','s13-augments-p2','d11-fill','g24-item-gold','conqueror-chest','high-roller','tacticians-crown',
 'augment-kingslayer','augment-risky-moves','augment-pool-batch1','augment-pool-batch2','augment-pool-batch3','augment-pool-batch4','augment-pool-batch5','augment-pool-batch5-h6',
 'augment-pool-batch5-g7','augment-pool-batch3-dummy','opening-encounter-batch-a','opening-batch-b','conqueror','pve-remover','academy','black-market','junker-king',
 's13-augment-acquisition','s13-anomaly-acquisition','anvil-unit','opening-encounter','opening-encounter-monkey','consumable-copy','family','masterwork-upgrade','mel']);
// Project only the counters needed by these rewards from the finished combat, not reward receipts.
function validateBattleCounters(before,after,f,base){
 const combat=after.combat;if(!combat)return; // Hand-written unit vectors supply facts explicitly.
 assert.equal(f.battleId,combat.combatId,'independent completed battle identity');
 assert.equal(f.roundKind,base.ROUNDS[before.round-1].kind,'independent completed battle kind');
 const us=combat.units,team=us.filter(u=>u.team==='player'),allies=team.filter(u=>!u.anomalySummon&&!u.definitionId.startsWith('g23-'));
 assert.equal(f.result,combat.result==='playerWin'?'win':combat.result==='enemyWin'?'loss':'draw','independent combat result counter');
 assert.equal(f.alliedDeaths,allies.filter(u=>!u.alive&&!u.itemSummon).length,'independent allied deaths');
 assert.equal(f.batch3Healing??0,team.reduce((n,u)=>n+(u.batch2?.healed??0),0),'independent healing counter');
 const dummies=team.filter(u=>['training-dummy','forming-dummy','tower-dummy'].includes(u.definitionId));
 const deaths=[...(combat.openingDeaths??[])].sort((a,b)=>a.eventSeq-b.eventSeq);
 if(dummies.length)assert.deepEqual(f.batch3Dummy,{deaths:dummies.filter(u=>!u.alive).map(u=>u.id).sort(),first:deaths.find(d=>team.some(u=>u.id===d.unitId))?.unitId??null,gold:dummies.reduce((n,u)=>n+(u.batch2?.dummyGold??0),0)},'independent dummy counters');
 const survivors=team.filter(u=>u.alive&&!u.itemSummon&&!u.anomalySummon&&!['trainer-golem','g23-sion','g23-forge','g23-barrel','v20-silco-minion'].includes(u.definitionId));
 const damage=f.roundKind==='pvp'&&combat.result==='playerWin'?[2,5,8,10,12][base.ROUNDS[before.round-1].stage-2]+survivors.length:0;
 assert.equal(f.batch3DamageDealt??0,damage,'independent damage counter');
 const opening=new Set(before.combatInputBasis?.inputs.preparation.units.filter(u=>u.location.kind==='board').map(u=>u.id)??before.preparation.units.filter(u=>u.location.kind==='board').map(u=>u.id));
 const enemyDeaths=deaths.filter(d=>{const u=us.find(u=>u.id===d.unitId);return u&&u.team!=='player'&&opening.has(u.id)&&!u.itemSummon&&!u.anomalySummon&&(f.roundKind==='pvp'?(base.COST[u.definitionId]!==undefined||['elise-ranged','jayce-ranged','swain-ranged','gangplank-ranged'].includes(u.definitionId)):u.definitionId.startsWith('pve-scuttle-')||u.definitionId==='pve-giant-crab');}).map(d=>({victimId:d.unitId,eventSeq:d.eventSeq}));
 assert.deepEqual(f.openingDeaths,enemyDeaths,'independent enemy kill counter');
 const active=new Set(team.flatMap(u=>u.mechanics?.filter(m=>m.mechanic==='traitAugmentB2').map(m=>m.source.definitionId)??[])),expected=[];
 for(const id of ['rocket-collection','rocket-collection-plus','enforce','welcome-to-the-playground','scrap-recycling','betrayal','blood-brothers','blood-brothers-deaths'].filter(id=>active.has(id==='blood-brothers-deaths'?'blood-brothers':id))){
  const members=team.filter(u=>u.mechanics?.some(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId===id));let count;
  if(id.startsWith('rocket-collection'))count=members.reduce((n,u)=>n+(u.batch2?.rockets??0),0);
  if(id==='enforce')count=new Set(members.flatMap(u=>u.g22?.wanted??[]).filter(id=>deaths.some(d=>d.unitId===id))).size;
  if(id==='scrap-recycling')count=members.reduce((n,u)=>n+(u.mechanics.find(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId===id)?.values.converted??0),0);
  if(id==='welcome-to-the-playground')count=members.some(u=>u.batch2?.familyQualified)||members.filter(u=>u.alive&&u.hp>0).length>=2?1:0;
  if(id==='betrayal')count=members.some(u=>(u.batch2?.kills??0)>=2)?1:0;
  if(id==='blood-brothers')count=team.filter(u=>u.definitionId==='silco').reduce((n,u)=>n+(u.batch2?.casts??0),0);
  if(id==='blood-brothers-deaths')count=team.filter(u=>u.definitionId==='vander').reduce((n,u)=>n+(u.batch2?.deaths??0),0);
  expected.push({definitionId:id,count:count??0});
 }
 // P-SPOILS-FACT-OWNERSHIP: the legacy openingDeaths envelope only covers PvP/crabs;
 // Spoils counts every opening ordinary PvE death as well, but needs our opening augment source.
 const openingStrategy=before.phase==='combat'&&before.combat?.strategy?before.combat.strategy:combat.strategy;
 const ownsSpoils=(openingStrategy?.units??[]).some(u=>opening.has(u.unitId)&&team.some(t=>t.id===u.unitId)&&u.sources.some(s=>s.source.sourceKind==='augment'&&['spoils-of-war-i','spoils-of-war-ii','spoils-of-war-iii'].includes(s.source.sourceDefinitionId)));
 const spoilsKills=deaths.filter(d=>{const u=us.find(x=>x.id===d.unitId);return u&&u.team!=='player'&&opening.has(u.id)&&!u.itemSummon&&!u.anomalySummon&&(base.COST[u.definitionId]!==undefined||['elise-ranged','jayce-ranged','swain-ranged','gangplank-ranged'].includes(u.definitionId)||f.roundKind==='pve'&&u.definitionId.startsWith('pve-'));}).length;
 if(ownsSpoils&&spoilsKills)expected.push({definitionId:'spoils-of-war',count:spoilsKills});
 assert.deepEqual(f.batch2??[],expected,'independent batch2 counter existence and values');
}
function validateRewardsCore(before,after,command,events,base){
 assert.equal(after.seed,before.seed,'immutable reward seed');
 assert.equal(after.augmentTierSeed,before.augmentTierSeed,'immutable opening seed');
 assert.equal(after.multiplayer?.seatId,before.multiplayer?.seatId,'immutable reward seat');
 const prior=before.seatMechanics?.receipts??[],appended=(after.seatMechanics?.receipts??[]).slice(prior.length);
 for(const r of appended)assert(admitted.has(r.source),'unknown mechanic reward source '+r.source);
 if(command?.type==='select'){
  const c=before.pendingChoice;assert.equal(before.phase,'choice');assert(c,'selection needs a pending choice');
  assert.equal(command.choiceId,c.choiceId,'selection identity');assert.equal(command.generation,c.generation,'selection generation');assert.equal(c.step,'offer');
  assert(c.offers.includes(command.definitionId)||c.kind==='blackMarket'&&c.payload.skippable&&command.definitionId==='@skip','selected reward was offered');
  assert(events.some(e=>e.type==='choiceSelected'&&e.choiceId===c.choiceId&&e.definitionId===command.definitionId),'reward needs selection event');
 }
 const select=command?.type==='select'&&before.pendingChoice?.kind==='augment';
 if(select){const c=before.pendingChoice;assert.equal(before.phase,'choice');assert.equal(command.choiceId,c.choiceId);assert.equal(command.generation,c.generation);assert(c.offers.includes(command.definitionId),'acquired augment was actually offered');assert(events.some(e=>e.type==='choiceSelected'&&e.choiceId===c.choiceId&&e.definitionId===command.definitionId),'augment reward needs selection event');}
 const augments=select?[...before.augments,{choiceId:before.pendingChoice.choiceId,definitionId:command.definitionId,acquiredRound:before.round}]:before.augments;
 assert.deepEqual(after.augments,augments,'independent owned augment transition');
 const terminal=after.phase!=='combat'&&(before.phase==='combat'||command?.type==='start');
 if(command==null&&!terminal)assert.equal(appended.length,0,'no mechanic reward without command/combat settlement');
 const entry=command?.type==='continue';
 assert.equal(after.round,before.round+(entry?1:0),'independent round entry');
 assert.equal(after.roundDefinitionId,base.ROUNDS[after.round-1].roundId,'independent reward round identity');
 const supply=command?.type==='select'&&before.pendingChoice?.kind==='component'&&base.ROUNDS[before.round-1].kind==='supply';
 if(supply)assert(events.some(e=>e.type==='roundSettled'&&e.round===before.round),'supply XP needs its settlement event');
 let xpGain=terminal?2+base.benchXp(before):supply?2:0;
 if(command?.type==='buyXp')xpGain=before.augments.some(a=>a.definitionId==='level-up')?6:4;
 if(entry)xpGain=base.entryXp(before);
 if(select){xpGain=({'silver-spoon':10,epoch:6,'epoch-plus':8,'level-up':12,'slammin-plus':10})[command.definitionId]??0;
  if(command.definitionId==='call-to-chaos'&&outcome(before,augments.at(-1))==='xp')xpGain+=64;}
 const progression=base.xp(before.level,before.xp,xpGain);
 assert.deepEqual([after.level,after.xp],[progression.level,progression.xp],'independent XP state before reward thresholds');
 const priorLevels=before.seatMechanics?.seat['augment-acquisition-levels']??{};
 const tracked=['shopping-spree','upward-mobility','risky-moves',...Object.keys(b4)];
 const levels=select&&tracked.includes(command.definitionId)?{...priorLevels,[before.pendingChoice.choiceId]:progression.level}:priorLevels;
 assert.deepEqual(after.seatMechanics?.seat['augment-acquisition-levels']??{},levels,'independent acquisition level baseline');
 const history=before.resourceProvenance.entries,nextHistory=after.resourceProvenance.entries;
 if(history!==nextHistory)assert.deepEqual(nextHistory.slice(0,history.length),history,'reward provenance append-only');
 const facts=nextHistory.slice(history.length);
 const upgrade=e=>Object.fromEntries(['type','survivorId','consumedIds','definitionId','fromStar','toStar','location'].map(k=>[k,e[k]]));
 for(const [i,f]of facts.entries()){
  assert.equal(f.sequence,history.length+i,'reward provenance sequence');
  const upgrades=['unit-upgraded','unit-upgraded-after-combat'].includes(f.kind)?[f.event]:['carousel-preparation-settled','carousel-unit-claimed'].includes(f.kind)?f.upgrades:[];
  if(upgrades.length)assert([before.roundDefinitionId,after.roundDefinitionId].includes(f.roundId),'upgrade provenance belongs to command round');
  for(const u of upgrades)assert(events.some(e=>e.type==='unitUpgraded'&&isDeepStrictEqual(upgrade(e),upgrade(u))),'reward upgrade needs actual upgrade event');
 }
 const markers=facts.filter(f=>f.kind==='form-swapper-selected');
 assert.equal(markers.length,select&&command.definitionId==='why-not-both'?1:0,'independent form-swapper selection marker');
 for(const marker of markers){assert.equal(marker.roundId,before.roundDefinitionId);assert.equal(marker.choiceId,before.pendingChoice.choiceId);assert.equal(marker.sequence,history.length);}
 const dualMarkers=facts.filter(f=>f.kind==='dual-purpose-selected');
 assert.equal(dualMarkers.length,select&&command.definitionId==='dual-purpose'?1:0,'independent Dual Purpose selection marker');
 if(dualMarkers.length)assert.deepEqual(dualMarkers[0],{kind:'dual-purpose-selected',sequence:history.length,roundId:before.roundDefinitionId,choiceId:before.pendingChoice.choiceId,level:before.level,xp:before.xp},'independent Dual Purpose acquisition XP');

 const oldFacts=before.seatMechanics?.hidden.progress?.economyReceipts??[],newFacts=after.seatMechanics?.hidden.progress?.economyReceipts??[];
 if(oldFacts!==newFacts)assert.deepEqual(newFacts.slice(0,oldFacts.length),oldFacts,'reward battle counters append-only');
 const battleSuffix=newFacts.slice(oldFacts.length).filter(r=>r.kind==='battle');
 assert.equal(battleSuffix.length,terminal?1:0,'reward counters need an actual completed combat');
 if(terminal){assert(events.some(e=>e.type==='combatFinished'),'reward counter needs terminal combat event');assert.equal(battleSuffix[0].facts.round,before.round);validateBattleCounters(before,after,battleSuffix[0].facts,base);}
 // Reward receipts never select the owner, threshold, random outcome, gift identity or amount.
 // Prior receipts are only the exactly-once set and pre-existing dummy identities.
 const choiceReceipts=appended.filter(r=>r.kind==='choice');
 let price=0;
 if(choiceReceipts.length){
  assert.equal(choiceReceipts.length,1,'one resolved mechanic choice');const c=before.pendingChoice,r=choiceReceipts[0];
  assert.equal(command?.type,'select');assert(events.some(e=>e.type==='choiceSelected'&&e.choiceId===c?.choiceId&&e.definitionId===command.definitionId),'choice reward needs selection event');assert(c?.payload,'choice requires pending payload');assert.equal(r.receiptId,c.choiceId);
  assert.equal(r.source,c.payload.source);assert.equal(r.optionId,command.definitionId);assert(c.offers.includes(r.optionId)||r.optionId==='@skip');
  assert.equal(r.choiceKind,c.kind);assert.equal(r.skipped,r.optionId==='@skip');
  assert.equal(r.round,before.round,'independent choice grant round');assert.equal(r.roundId,before.roundDefinitionId);
  if(c.kind==='armory'){
   assert.equal(r.source,'junker-king','known priced choice source');
   price=['flamethrower','petricite-rod','repairing-microbots','self-destruct','tankbuster'].includes(command.definitionId)?5:0;
   assert(price===5||['spare-parts','finishing-touch','junkyard-titan'].includes(command.definitionId),'known junker option');
  }
  assert.equal(r.price,price,'independent mechanic choice price');
 }else if(command?.type==='select'&&['forge','blackMarket','armory'].includes(before.pendingChoice?.kind))assert.fail('missing mechanic choice receipt');
 for(const r of appended)if(r.receiptId.startsWith('[\"augment-pool-batch'))assert.equal(r.source,JSON.parse(r.receiptId)[0],'reward source/namespace binding');
 const shopGold=new Map(),shopGifts=new Map();
 const shopId=(rule,a,n)=>JSON.stringify(['augment-pool-shop',rule,a.choiceId,n]);
 for(const a of augments){
  if(a.definitionId==='subscription-service'&&entry&&after.round>a.acquiredRound&&base.ROUNDS[after.round-1].sub===1)shopGold.set(shopId('subscription',a,after.round),{amount:6});
  if(a.definitionId==='firesale'&&entry&&after.round>a.acquiredRound){
   const {shopTransition}=require('./oracle.g2.cjs'),offer=shopTransition(before,command).stolen;
   if(offer)shopGifts.set(shopId('firesale',a,after.round),{definitionId:offer.definitionId,starLevel:offer.starLevel??1});
  }
  if(a.definitionId==='reinfourcement'&&command?.type==='buy'&&base.COST[before.shop.slots[command.slot].definitionId]===4&&!prior.some(r=>r.receiptId===shopId('reinfourcement',a,0)))for(let i=0;i<2;i++)shopGifts.set(shopId('reinfourcement',a,i),{definitionId:before.shop.slots[command.slot].definitionId,starLevel:1});
 }
 const shopActual=appended.filter(r=>r.source==='augment-pool-shop');
 assert.deepEqual(shopActual.map(r=>r.receiptId).sort(),[...shopGold.keys(),...shopGifts.keys()].sort(),'independent due shop rewards');
 for(const r of shopActual){
  assert(events.some(e=>e.type==='mechanicGranted'&&isDeepStrictEqual(e.receipt,r)),'shop reward requires actual grant event');
  assert.equal(r.round,after.round);assert.equal(r.roundId,after.roundDefinitionId);
  const expected=shopGold.get(r.receiptId)??shopGifts.get(r.receiptId);
  if(shopGold.has(r.receiptId)){assert.equal(r.kind,'gold');assert.equal(r.amount,expected.amount);}
  else {assert.equal(r.kind,'unit');assert.equal(r.definitionId,expected.definitionId);assert.equal(r.starLevel??1,expected.starLevel);if(r.resolution==='orb'){
   const orbId=JSON.stringify(['orb',after.roundDefinitionId,'mechanic',r.receiptId,0]),dropId=JSON.stringify([orbId,0]);
   assert.equal(r.orbId,orbId);assert.deepEqual(after.m8.loot.rewardOrbs.find(o=>o.orbId===orbId),{orbId,roundId:after.roundDefinitionId,tier:'gray',source:'mechanic',entries:[{orbId,entryOrdinal:0,dropId,roundId:after.roundDefinitionId,encounterId:'mechanic',sourceUnitId:r.receiptId,slotOrdinal:0,status:'planned',receiptId:null,revealCondition:'source-killed',payload:{kind:'unit',definitionId:expected.definitionId,quantity:1,starLevel:expected.starLevel}}]},'shop gift orb payload derived from the command');
  }assert.equal(r.gold,r.resolution==='gold'?base.COST[expected.definitionId]*3**(expected.starLevel-1):0);}
 }
 const activeDrain=command!=null||terminal;
 if(!activeDrain){assert.equal(appended.filter(r=>r.source.startsWith('augment-pool-')).length,0,'no reward without a draining command');return {gold:new Map(),gifts:new Map(),price};}
 const ctx={...after,seed:before.seed,augments,level:progression.level,xp:progression.xp,multiplayer:before.multiplayer?{...after.multiplayer,seatId:before.multiplayer.seatId}:undefined,
  seatMechanics:{...after.seatMechanics,seat:{...after.seatMechanics?.seat,'augment-acquisition-levels':levels},receipts:[...prior,...choiceReceipts]}};
 const env=environment(before,base),plan=rewardPlan(ctx,env),claimed=new Set(prior.map(r=>r.receiptId));
 const dueGold=plan.gold.filter(p=>!claimed.has(p.receiptId));
 const dual=before.augments.find(a=>a.definitionId==='dual-purpose');
 if(dual&&command?.type==='buyXp'){
  const purchase=facts.filter(f=>f.kind==='dual-purpose-xp-purchased');
  assert.equal(purchase.length,1,'one Dual Purpose fact per successful owned purchase');
  assert.deepEqual(purchase[0],{kind:'dual-purpose-xp-purchased',sequence:history.length,roundId:before.roundDefinitionId,levelBefore:before.level,xpBefore:before.xp,generation:before.shop.generation+1,settled:before.roundResults.some(r=>r.round===before.round)},'independent purchase evidence');
  const receiptId=JSON.stringify(['augment-pool-batch5',dual.choiceId,before.round]);
  if(!claimed.has(receiptId))dueGold.push({receiptId,source:'augment-pool-batch5',kind:'gold',amount:2,round:before.round});
 }else assert.equal(facts.filter(f=>f.kind==='dual-purpose-xp-purchased').length,0,'no Dual Purpose fact without purchase');
 const contested=before.augments.find(a=>a.definitionId==='contested');
 const newResult=(after.roundResults??[]).find(r=>r.round===before.round&&!(before.roundResults??[]).some(old=>old.round===r.round));
 if(contested&&newResult?.roundKind==='pvp'){
  const f=after.augmentHistory.facts.find(f=>f.kind==='pvp-roster'&&f.round===before.round);
  assert(f,'contested frozen roster');const self=f.seats.find(s=>s.seatId===f.seatId);assert(self,'contested own roster');
  const bench=self.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&base.COST[u.definitionId]).sort((a,b)=>a.location.slot-b.location.slot);
  const count=bench.length?f.seats.filter(s=>s.alive&&s.seatId!==f.seatId&&s.units.some(u=>u.team==='player'&&u.location.kind==='board'&&u.definitionId===bench[0].definitionId)).length:0;
  const amount=2*Math.floor(count/2),receiptId=JSON.stringify(['augment-pool-batch5-h6',contested.choiceId,before.round]);
  if(amount&&!claimed.has(receiptId))dueGold.push({receiptId,source:'augment-pool-batch5-h6',kind:'gold',amount,round:before.round});
 }
 const actualGold=appended.filter(r=>['augment-pool-batch5-g7','augment-pool-batch5-h6','augment-pool-batch2','augment-pool-batch3','augment-pool-batch4','augment-pool-batch5','augment-kingslayer','augment-risky-moves'].includes(r.source));
 const goldKey=r=>({receiptId:r.receiptId,source:r.source,kind:r.kind,amount:r.amount,round:r.round});
 const sorted=xs=>xs.map(goldKey).sort((a,b)=>a.receiptId.localeCompare(b.receiptId));
 assert.deepEqual(sorted(actualGold),sorted(dueGold),'independent due augment gold receipts (count, identity, amount, round)');
 for(const r of actualGold)assert.equal(r.roundId,base.ROUNDS[r.round-1]?.roundId);
 const locked=Boolean(before.multiplayer&&(before.multiplayer.combatRosterLocked||before.phase==='combat'&&!terminal));
 if(locked||before.phase==='combat'&&!terminal){
  assert.equal(appended.filter(r=>['augment-pool-batch1','augment-pool-batch3-dummy'].includes(r.source)).length,0,'locked roster defers unit and item rewards');
  return {gold:new Map([...dueGold.map(g=>[g.receiptId,g]),...shopGold]),gifts:new Map([...shopGifts]),price};
 }

 const pending=plan.gifts.filter(p=>!claimed.has(p.receiptId));
 const actual=appended.filter(r=>['augment-pool-batch1','augment-pool-batch5-g7'].includes(r.source)),expected=new Map(pending.map(g=>[g.receiptId,g]));
 for(const r of actual){const g=expected.get(r.receiptId);assert(g,'independent due augment gift identity '+r.receiptId);expected.delete(r.receiptId);
  assert.equal(r.kind,g.kind);assert.equal(r.definitionId,g.definitionId,'independent gift draw');assert.equal(r.starLevel??1,g.starLevel,'independent gift stars');
  assert(r.round>=g.acquiredRound&&r.round<=ctx.round,'independent gift timing');assert.equal(r.round,ctx.round,'independent gift grant round');assert.equal(r.roundId,base.ROUNDS[r.round-1]?.roundId);
  if(r.kind==='unit'){
   assert(['held','gold','orb'].includes(r.resolution));
   assert.equal(r.gold,r.resolution==='gold'?base.COST[g.definitionId]:0,'independent unit fallback gold');
   if(before.multiplayer&&base.COST[g.definitionId]){
    assert.equal(r.resolution,'orb','online heroes queue orbs');assert.equal(r.unitId,null);
    assert.equal(r.orbId,JSON.stringify(['orb',ctx.roundDefinitionId,'mechanic',g.receiptId,0]),'independent reward orb identity');
    const queued=after.m8?.loot.rewardOrbs?.filter(o=>o.orbId===r.orbId)??[];assert.equal(queued.length,1,'unit reward needs its escrow orb');
    assert.equal(queued[0].entries.length,1);assert.deepEqual(queued[0].entries[0].payload,{kind:'unit',definitionId:g.definitionId,quantity:1,starLevel:g.starLevel},'independent reward orb payload');
   }else assert.equal(r.resolution,'held','solo heroes and summons are held');
  }
 }
 // Emblems carried by augment-owned dummies have their own namespace and no inventory draw.
 const dummyExpected=[];
 for(const a of augments){
  const chaos=a.definitionId==='call-to-chaos'?outcome(ctx,a):null;
  const fixed=chaos==='solari-dummy'?['TFT_Item_LocketOfTheIronSolari','TFT_Item_LocketOfTheIronSolari']:chaos==='zeke-dummy'?['TFT_Item_ZekesHerald','TFT_Item_ZekesHerald']:null;
  const n=({'wandering-trainer-i':2,'wandering-trainer-ii':3,'tower-defense':1})[a.definitionId]??0;
  if(!fixed&&!n)continue;
  const dummy=plan.gifts.find(g=>g.kind==='unit'&&g.definitionId==='training-dummy'&&JSON.parse(g.receiptId)[2]===a.definitionId)
   ??plan.gifts.find(g=>g.kind==='unit'&&g.definitionId==='tower-dummy'&&JSON.parse(g.receiptId)[2]===a.definitionId);
  if(!dummy||![...prior,...actual].some(r=>r.receiptId===dummy.receiptId))continue;
  let pool=[...env.pools.emblem],rng=salt(ctx.seed,['augment-pool-batch3-dummy',ctx.multiplayer?.seatId??'solo',a.choiceId,a.definitionId]);
  for(let i=0;i<n;i++){rng=word(rng);const j=i+pick(rng,pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
  (fixed??pool.slice(0,n)).forEach((definitionId,i)=>{const receiptId=JSON.stringify(['augment-pool-batch3-dummy',a.choiceId,i]);if(!claimed.has(receiptId))dummyExpected.push({receiptId,kind:'item',source:'augment-pool-batch3-dummy',definitionId});});
 }
 const dummyActual=appended.filter(r=>r.source==='augment-pool-batch3-dummy');
 const dummyKeys=r=>({receiptId:r.receiptId,kind:r.kind,source:r.source,definitionId:r.definitionId});
 assert.deepEqual(dummyActual.map(dummyKeys),dummyExpected,'independent dummy emblem receipt existence and draws');
 // Capacity escrow is the only reason to omit a due unit. Check against the pre-command roster,
 // accounting for paid births, sale/deploy, forming removals and all earlier independent gift births.
 const roster=before.preparation.units.filter(u=>u.team==='player').map(u=>({...u}));
 if(command?.type==='sell'){const i=roster.findIndex(u=>u.id===command.id);if(i>=0)roster.splice(i,1);}
 if(command?.type==='deploy'){const u=roster.find(u=>u.id===command.id);if(u)u.location=command.target;}

 if(select&&['dummify','golemify'].includes(command.definitionId))for(let i=roster.length-1;i>=0;i--)if(base.COST[roster[i].definitionId])roster.splice(i,1);
 let births=0;
 function birth(g){
  const id=`oracle-birth-${births++}`,working=[...roster,{id,definitionId:g.definitionId,starLevel:g.starLevel,location:null}];
  const priority=u=>!u.location?[2,0,0]:u.location.kind==='board'?[0,u.location.cell.row,u.location.cell.col]:[1,u.location.slot,0];
  const compare=(a,b)=>{const x=priority(a),y=priority(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]||String(a.id).localeCompare(String(b.id));};
  for(let star=g.starLevel;star<3;star++){
   let peers=working.filter(u=>u.definitionId===g.definitionId&&u.starLevel===star).sort(compare);
   while(peers.length>=3){const [keep,...remove]=peers.slice(0,3);for(const u of remove)working.splice(working.indexOf(u),1);working[working.indexOf(keep)]={...keep,starLevel:star+1};peers=working.filter(u=>u.definitionId===g.definitionId&&u.starLevel===star).sort(compare);}
  }
  const candidate=working.find(u=>u.id===id);
  if(candidate){const occupied=new Set(working.filter(u=>u.location?.kind==='bench').map(u=>u.location.slot)),slot=Array.from({length:9},(_,i)=>i).find(i=>!occupied.has(i));if(slot===undefined)return false;candidate.location={kind:'bench',slot};}
  roster.splice(0,roster.length,...working);return true;
 }
 if(command?.type==='buy')assert(birth({definitionId:before.shop.slots[command.slot].definitionId,starLevel:before.shop.slots[command.slot].starLevel??1}),'independent purchased birth capacity');
 // Include non-augment direct births already independently checked by the outer loot/P2 ledger.
 for(const r of appended.filter(r=>r.kind==='unit'&&r.source!=='augment-pool-batch1'&&r.resolution==='held'))birth({definitionId:r.definitionId,starLevel:r.starLevel??1});
 for(const r of base.lootReceipts??[])if(['unit','forge'].includes(r.payload.kind)&&r.grantedUnitIds.length)assert(birth({definitionId:r.payload.definitionId,starLevel:r.payload.starLevel??1}),'independent loot birth capacity');
 const required=new Set(pending.filter(g=>g.kind!=='unit').map(g=>g.receiptId));let progress;
 do{progress=false;for(const g of pending.filter(g=>g.kind==='unit'&&!required.has(g.receiptId)))if(before.multiplayer&&base.COST[g.definitionId]||birth(g)){required.add(g.receiptId);progress=true;}}while(progress);
 for(const g of pending)assert.equal(actual.some(r=>r.receiptId===g.receiptId),required.has(g.receiptId),'independent '+g.kind+' receipt existence '+g.receiptId);
 return {gold:new Map([...dueGold.map(g=>[g.receiptId,g]),...shopGold]),gifts:new Map([...pending.map(g=>[g.receiptId,g]),...shopGifts]),price};
}
// Inventory is a complete transition, including commands with no reward receipt.
function validateRewards(before,after,command,events,base){
 const result=validateRewardsCore(before,after,command,events,base);
 // Hand-written counter vectors may omit the inventory entirely.
 if(before.consumables===undefined&&after.consumables===undefined)return result;
 const inventory=[...before.consumables];let serial=before.nextConsumableSerial;
 const add=(definitionId,id)=>{const expected=`consumable-${serial++}`;assert.equal(id,expected,'independent consumable grant ID');inventory.push({consumableId:expected,definitionId});};
 for(const r of base.lootReceipts??[]){
  const ids=r.grantedConsumableIds??[];assert.equal(ids.length,r.payload.kind==='consumable'?1:0,'independent loot consumable count');
  if(r.payload.kind==='consumable')add(r.payload.definitionId,ids[0]);
 }
 for(const r of (after.seatMechanics?.receipts??[]).slice(before.seatMechanics?.receipts.length??0))if(r.kind==='consumable'){
  const g=result.gifts.get(r.receiptId);
  if(r.source==='augment-pool-batch1')assert(g&&g.kind==='consumable','independent consumable reward plan');
  add(g?.definitionId??r.definitionId,r.consumableId);
 }
 let used=null;
 if(command?.type==='useConsumable'){
  const tool=before.consumables.find(c=>c.consumableId===command.consumableId);assert(tool,'independent consumed tool exists');
  if(tool.definitionId!=='masterwork-upgrade')used=tool.consumableId;
 }
 if(command?.type==='select'&&before.pendingChoice?.payload?.source==='masterwork-upgrade'){
  used=before.pendingChoice.payload.masterwork.consumableId;
  assert(before.consumables.some(c=>c.consumableId===used&&c.definitionId==='masterwork-upgrade'),'independent masterwork tool exists');
 }
 if(used!==null)inventory.splice(inventory.findIndex(c=>c.consumableId===used),1);
 assert.deepEqual(after.consumables,inventory,'independent consumable inventory additions/removals');
 assert.equal(after.nextConsumableSerial,serial,'independent consumable serial');
 return result;
}
module.exports.validateRewards=validateRewards;
