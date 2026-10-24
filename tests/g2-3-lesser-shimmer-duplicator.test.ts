import {expect,it} from 'vitest';
import {deepStrictEqual} from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {createMatch,buyXp,deployMatchUnit,sellUnit,selectChoice,nextRound,startMatchCombat,stepMatch,claimG23Reward,type MatchState} from '../src/simulation/match';
import {grantMechanicGold,grantMechanicUnit} from '../src/simulation/seat-mechanics';
import {G23_BLACK_MARKETS,G23_CONQUEROR_CHESTS,G23_POLICY,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {drainG23Rewards} from '../src/simulation/g2-3-runtime';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {readG23MechanismState} from '../src/simulation/g2-3-view';
import type {G23RewardBundle} from '../src/simulation/g2-3-economy';
import {advanceG23Economy,decideG23Market,type G23BattleFacts} from '../src/simulation/g2-3-economy';
import {createG23Progress} from '../src/simulation/g2-3-match-progress';
import {augmentAcquisition} from '../src/simulation/augment-acquisition';
import {P2_ITEM_GRANTS} from '../src/simulation/content/s13-augments-p2';

const shimmer='TFT13_Crime_Consumable_LesserShimmerDuplicator';
const lesser='TFT_Consumable_ChampionDuplicator_III';
const ok=<T extends {ok:boolean;state:MatchState}>(r:T):MatchState=>{if(!r.ok)throw Error('Public fixture command refused');return r.state;};
/** Take the first offer, except augments: their first offer that grants no item, forge or remover. */
function choose(state:MatchState):MatchState{
 const c=state.pendingChoice!;
 const grants=(definitionId:string)=>{const a=augmentAcquisition({definitionId,choiceId:c.choiceId,acquiredRound:state.round});
  return definitionId in P2_ITEM_GRANTS||a.items.length>0||a.forge!==null||a.remover;};
 const id=c.kind==='augment'?c.offers.find(id=>!grants(id))??c.offers[0]:c.offers[0];
 return ok(selectChoice(state,c.choiceId,c.generation,id));
}
function preparation(input:MatchState):MatchState{
 let state=input;
 for(let guard=0;guard<20;guard++){
  if(state.phase==='preparation')return state;
  if(state.phase==='choice'){
   state=choose(state);
  }else if(state.phase==='settlement')state=ok(nextRound(state,state.round));
  else throw Error(`Unexpected public fixture phase ${state.phase}`);
 }
 throw Error('Preparation budget');
}
const marketEntry=G23_BLACK_MARKETS[0].options.find(o=>o.id==='TFT13_Crime_LootA')!;
const bundle:G23RewardBundle={id:marketEntry.id,round:1,source:'black-market',tier:1,reward:marketEntry.reward};
/** Unit-level reward vector; save tests below use only natural battles and public commands. */
function rewardVector():MatchState{
 const state=preparation(createMatch(42));
 const pending=drainG23Rewards(writeG23Progress(state,{...readG23Progress(state)!,rewards:[bundle]}));
 // Resolve LootA's single sampled item before isolating the duplicator vector.
 expect(readG23Progress(pending)!.rewardClaims).toMatchObject([{kind:'item'}]);
 return pending;
}

it('keeps the official zh_cn identity, the three source packages, quantities and 35%/20% weights',()=>{
 const strings=JSON.parse(gunzipSync(readFileSync('src/simulation/content/source/s13-14.24b/raw/zh_cn.tft.stringtable.json.gz')).toString('utf8'));
 expect(G23_POLICY.duplicators[shimmer].name).toBe(strings.entries.tft_item_name_tft13_crime_consumable_lessershimmerduplicator);
 expect(G23_POLICY.duplicators[shimmer].name).toBe('次级微光复制器');
 const packages=G23_BLACK_MARKETS.flatMap(m=>m.options.filter(o=>Array.isArray(o.reward.Consumables)&&o.reward.Consumables.includes(shimmer)).map(o=>({tier:m.tier,id:o.id,weight:o.weightBps,ids:o.reward.Consumables})));
 expect(packages).toEqual([
  {tier:1,id:'TFT13_Crime_LootA',weight:2500,ids:[shimmer]},
  {tier:1,id:'TFT13_Crime_LootA4',weight:1000,ids:[shimmer]},
  {tier:2,id:'TFT13_Crime_LootB1',weight:2000,ids:[shimmer]},
 ]);
 for(const market of G23_BLACK_MARKETS)for(const option of market.options.filter(o=>packages.some(p=>p.id===o.id))){
  const atoms=g23RewardAtoms({id:option.id,round:1,source:'black-market',tier:market.tier,reward:option.reward},42);
  const atom=atoms.find(a=>a.kind==='duplicator')!;
  expect(atom).toMatchObject({duplicatorDefinitionId:shimmer,quantity:1});
  expect([...atom.options].sort()).toEqual(['renata','renni','singed','smeech']);
 }
 const chest=G23_CONQUEROR_CHESTS[3];
 expect(g23ConquerorReward(chest)).toEqual({Item:[lesser],ThreeCostUnit:1});
 const atom=g23RewardAtoms({id:'g23:conqueror:4',round:1,source:'conqueror',tier:4,reward:g23ConquerorReward(chest)},42).find(a=>a.kind==='duplicator')!;
 expect(atom).toMatchObject({duplicatorDefinitionId:lesser,quantity:1});
 expect(atom.options).toContain('irelia');expect(atom.options).toContain('swain');expect(atom.options).not.toContain('silco');
});

it.each(['singed','renata','renni','smeech'].flatMap(id=>['board','bench'].map(location=>({id,location}))))('copies the eligible $id on the $location exactly once',({id,location})=>{
 let state=rewardVector();
 const unitId=`unit-${state.nextUnitSerial}`;
 state=ok(grantMechanicUnit(state,{receiptId:'fixture:target',source:'fixture',definitionId:id}));
 if(location==='board'){
  const holder=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
  state=ok(deployMatchUnit(state,unitId,holder.location));
 }
 expect(state.preparation.units.find(u=>u.id===unitId)!.location.kind).toBe(location);
 const serial=state.nextUnitSerial;
 const claimed=drainG23Rewards(state),claims=readG23Progress(claimed)!.rewardClaims.filter(c=>c.kind==='duplicator');
 expect(claims).toMatchObject([{kind:'duplicator',definitionId:id,instanceId:`unit-${serial}`}]);
 expect(claimed.preparation.units.find(u=>u.id===`unit-${serial}`)).toMatchObject({definitionId:id,starLevel:1});
 expect(drainG23Rewards(claimed)).toBe(claimed);
});

it('rejects non-Chem-Barons and Silco, retaining escrow until a legal bench target is owned',()=>{
 let state=rewardVector();
 state=ok(grantMechanicUnit(state,{receiptId:'fixture:ineligible',source:'fixture',definitionId:'silco'}));
 // Opening Irelia is on board; 4-cost Chem-Baron Silco is on the bench.
 expect(state.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId)).toEqual(['irelia','silco']);
 const before=JSON.stringify(state),atom=g23RewardAtoms(bundle,state.seed).find(a=>a.kind==='duplicator')!;
 expect(drainG23Rewards(state)).toBe(state);
 for(const id of ['irelia','silco','renni'])expect(claimG23Reward(state,atom.id,id)).toMatchObject({ok:false,reason:'stale-choice',state});
 expect(JSON.stringify(state)).toBe(before);
 expect(readG23MechanismState(state)!.rewards).toContainEqual(expect.objectContaining({duplicatorDefinitionId:shimmer,remaining:1}));
 state=ok(grantMechanicUnit(state,{receiptId:'fixture:late-target',source:'fixture',definitionId:'renni'}));
 const claimed=drainG23Rewards(state);
 expect(readG23Progress(claimed)!.rewardClaims.filter(c=>c.kind==='duplicator')).toMatchObject([{definitionId:'renni'}]);
 expect(readG23MechanismState(claimed)!.rewards).toEqual([]);
});

it.each(['TFT13_Crime_Consumable_ShimmerDuplicator'])('does not admit the unsupported large duplicator %s',id=>{
 expect(Object.hasOwn(G23_POLICY.duplicators,id)).toBe(false);
 expect(()=>g23RewardAtoms({...bundle,reward:{...bundle.reward,Consumables:[id]}},42)).toThrow('frozen reward descriptor');
});

it('admits the full ordinary duplicator policy without admitting a forged frozen reward package',()=>{
 expect(G23_POLICY.duplicators.TFT_Consumable_NeekosHelp.maxCost).toBe(null);
 expect(()=>g23RewardAtoms({...bundle,reward:{...bundle.reward,Consumables:['TFT_Consumable_NeekosHelp']}},42)).toThrow('frozen reward descriptor');
});

let pendingMarket:MatchState|undefined;
/** Seed1's first real 100-Shimmer market draws LootA4. No fabricated progress or receipts. */
function publicMarket():MatchState{
 if(pendingMarket)return pendingMarket;
 let state=preparation(createMatch(1));
 state=ok(grantMechanicGold(state,{receiptId:'fixture:gold',source:'fixture',amount:120}));
 while(state.level<4)state=ok(buyXp(state));
 for(const unit of state.preparation.units.filter(u=>u.team==='player'))state=ok(deployMatchUnit(state,unit.id,{kind:'bench',slot:0}));
 for(const [col,definitionId]of ['singed','renata','renni','garen'].entries()){
  for(let copy=0;copy<9;copy++)state=ok(grantMechanicUnit(state,{receiptId:`fixture:${definitionId}:${copy}`,source:'fixture',definitionId}));
  const target=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId&&u.starLevel===3)!;
  state=ok(deployMatchUnit(state,target.id,{kind:'board',cell:{col,row:4}}));
 }
 for(let battle=0;battle<12;battle++){
  state=ok(startMatchCombat(state));
  for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
  for(let choices=0;state.phase==='choice'&&choices<10;choices++){
   if(state.pendingChoice!.kind==='blackMarket'){
    expect(readG23Progress(state)!.chem.offer).toMatchObject({tier:1,optionId:'TFT13_Crime_LootA4'});
    pendingMarket=state;return state;
   }
   state=choose(state);
  }
  state=preparation(state);
 }
 throw Error('Public market battle budget');
}

/** The three save entrances; a long replay can check one entrance per case. */
const ENTRIES=['serialized save','state object','JSON string'] as const;
type Entry=typeof ENTRIES[number];
const restoreVia=(state:MatchState,entry:Entry)=>entry==='serialized save'?restoreMatch(serializeMatch(state)):entry==='state object'?restoreMatch(state):restoreMatch(JSON.stringify(state));
function expectRoundTripAndNextBattle(state:MatchState,entries:readonly Entry[]=ENTRIES):void{
 const copies=entries.map(entry=>restoreVia(state,entry));
 for(const copy of copies)expect(copy).toEqual(state);
 let original=preparation(state),restored=copies.map(preparation);
 const start=startMatchCombat(original);original=ok(start);
 restored=restored.map(copy=>{const result=startMatchCombat(copy);expect(result).toEqual(start);return ok(result);});
 expect(original.phase).toBe('combat');
 let ticks=0;
 while(original.phase==='combat'&&ticks++<1200){
  const step=stepMatch(original);original=step.state;
  // node:assert compares a full step result several times faster than toEqual.
  restored=restored.map(copy=>{const next=stepMatch(copy);deepStrictEqual(next,step);return next.state;});
 }
 expect(ticks).toBeGreaterThan(0);expect(original.combat?.status).toBe('finished');
}
/** Built once per file; the first case to use it also runs its assertions. */
function once<T>(build:()=>T):()=>T{let value:T|undefined;return ()=>value??=build();}

it('restores the naturally obtained pending black-market reward and the next battle tick for tick',()=>{
 const state=publicMarket();
 expect(state.pendingChoice).toMatchObject({kind:'blackMarket',payload:{source:'black-market',grantItem:false}});
 expectRoundTripAndNextBattle(state);
 // 临时、用户 10-21 批准：只因 CI 机器计时超时（断言都过），按约 2 倍放宽；断言不变。5 秒 → 11 秒（原因：首个黑市移到第 12 回合，路线变长；按 CI 实测 5.19 秒取约 2 倍，本机 2.611 秒）。
},11_000);

it('restores the sole naturally offered bundle without duplicate grants',()=>{
 const pending=publicMarket(),choice=pending.pendingChoice!;
 expect(choice.offers).toHaveLength(1);
 for(const optionId of choice.offers){
  const accepted=ok(selectChoice(pending,choice.choiceId,choice.generation,optionId)),p=readG23Progress(accepted)!;
  const option=G23_BLACK_MARKETS[0].options.find(o=>o.id===optionId)!;
  expect(p.rewards.filter(b=>b.source==='black-market')).toEqual([{id:choice.choiceId,round:pending.round,source:'black-market',tier:1,reward:option.reward,concreteItems:readG23Progress(pending)!.chem.offer!.concreteItems}]);
  expect(p.economyReceipts.at(-1)).toMatchObject({kind:'market',take:true,optionId});
  expect(restoreMatch(serializeMatch(accepted))).toEqual(accepted);
  const duplicate=selectChoice(accepted,choice.choiceId,choice.generation,optionId);
  expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(accepted);
 }
});

const usedDuplicator=once(()=>{
 const pending=publicMarket(),choice=pending.pendingChoice!;
 const used=ok(selectChoice(pending,choice.choiceId,choice.generation,choice.offers[0]));
 const claim=readG23Progress(used)!.rewardClaims.find(c=>c.kind==='duplicator')!;
 expect(['singed','renata','renni','smeech']).toContain(claim.definitionId);
 expect(used.preparation.units.some(u=>u.id===claim.instanceId)).toBe(true);
 return used;
});
// One save entrance per case keeps each next-battle replay inside the default timeout under parallel load.
it.each(ENTRIES)('restores the used lesser shimmer duplicator and the next battle tick for tick (%s)',entry=>{
 expectRoundTripAndNextBattle(usedDuplicator(),[entry]);
});

function usedMarket():MatchState{
 const pending=publicMarket(),choice=pending.pendingChoice!;
 return ok(selectChoice(pending,choice.choiceId,choice.generation,choice.offers[0]));
}
function rejectsEveryEntry(state:MatchState,message?:string):void{
 expect(()=>serializeMatch(state)).toThrow(message);
 expect(()=>restoreMatch(state)).toThrow(message);
 expect(()=>restoreMatch(JSON.stringify(state))).toThrow(message);
}
it.each(['settlement','next preparation'].flatMap(phase=>['smeech','silco','irelia','renata','renni'].map(target=>({phase,target}))))('rejects jointly edited copy/receipt $target in $phase at all three save entries',({phase,target})=>{
 const pending=publicMarket(),used=usedMarket();
 const claim=readG23Progress(used)!.rewardClaims.find(c=>c.kind==='duplicator')!;
 expect(claim.definitionId).toBe('singed');
 expect(pending.preparation.units.some(u=>u.team==='player'&&u.definitionId==='smeech')).toBe(false);
 expect(used.preparation.units.some(u=>u.team==='player'&&u.definitionId==='smeech')).toBe(true);
 const base=phase==='settlement'?used:preparation(used);
 if(phase!=='settlement'){expect(base.round).toBe(13);expect(base.combat).toBeNull();}
 const forged=structuredClone(base);
 Object.assign(forged.seatMechanics!.receipts.find(r=>r.receiptId===claim.id)!,{definitionId:target});
 Object.assign(forged.preparation.units.find(u=>u.id===claim.instanceId)!,{definitionId:target});
 rejectsEveryEntry(forged,['smeech','renata','renni'].includes(target)?'mechanic duplicator target':undefined);
});

it.each(['singed','renni'])('rejects moving the earning settlement and prefix past the forged %s birth',target=>{
 const forged=structuredClone(preparation(usedMarket()));
 const claim=readG23Progress(forged)!.rewardClaims.find(c=>c.kind==='duplicator')!;
 // v23: seed 42's fmix32 opening is Golden Gala (was Scuttle Puddle), which shifts the route's unit serials by two.
 expect(forged.round).toBe(13);expect(claim.instanceId).toBe('unit-41');
 Object.assign(forged.seatMechanics!.receipts.find(r=>r.receiptId===claim.id)!,{definitionId:target});
 Object.assign(forged.preparation.units.find(u=>u.id===claim.instanceId)!,{definitionId:target});
 const entries=[...forged.resourceProvenance.entries];
 const index=entries.findIndex(e=>e.kind==='combat-growth-committed'&&e.combatId==='round-12');
 expect(index).toBeGreaterThan(0);
 const [commit]=entries.splice(index,1);
 entries.splice(index+1,0,{...commit,combatStartProvenancePrefixLength:index+1} as typeof commit);
 Object.assign(forged.resourceProvenance,{entries:entries.map((entry,sequence)=>({...entry,sequence}))});
 rejectsEveryEntry(forged,'mechanic reward settlement order');
});

it.each([15,17])('restores historical duplicator births at round %s and the next battle tick for tick',round=>{
 let state=preparation(usedMarket());
 while(state.round<round){
  state=ok(startMatchCombat(state));
  for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
  state=preparation(state);
 }
 expect(state.round).toBe(round);
 expectRoundTripAndNextBattle(state);
 // 临时、用户 10-20 批准：只因 CI 机器计时超时（断言都过），按约 2 倍放宽；断言不变。5 秒 → 10 秒（CI 上本文件超时 1 次，round 15 满负载用掉约 62%）。
},10_000);

it.each(['settlement','next preparation'])('rejects a reward package changed to the ordinary lesser duplicator in %s',phase=>{
 const used=usedMarket(),forged=structuredClone(phase==='settlement'?used:preparation(used));
 const p=readG23Progress(forged)!;
 const changed=writeG23Progress(forged,{...p,rewards:p.rewards.map(b=>b.source==='black-market'?{...b,reward:{...b.reward,Consumables:[lesser]}}:b)});
 rejectsEveryEntry(changed);
});

function fullMarket():MatchState{
 let state=publicMarket();
 for(const definitionId of ['leona','lux','darius','draven','tristana','maddie','vex','zyra']){
  if(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length===9)break;
  state=ok(grantMechanicUnit(state,{receiptId:`fixture:capacity:${definitionId}`,source:'fixture',definitionId}));
 }
 expect(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')).toHaveLength(9);
 const c=state.pendingChoice!;return ok(selectChoice(state,c.choiceId,c.generation,c.offers[0]));
}
it('escrows a full-bench market and redeems its duplicator and later heroes in order as space is freed',()=>{
 let state=fullMarket();
 const market=readG23Progress(state)!.rewards.find(b=>b.source==='black-market')!;
 const ids=()=>readG23Progress(state)!.rewardClaims.filter(c=>c.bundleId===market.id);
 expect(ids()).toEqual([]);
 expectRoundTripAndNextBattle(state);
 state=preparation(state);
 for(const expected of ['singed','renni','smeech']){
  const previous=state.nextUnitSerial;
  const filler=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&['leona','lux','darius'].includes(u.definitionId))!;
  state=ok(sellUnit(state,filler.id));
  expect(ids().at(-1)).toMatchObject({definitionId:expected,instanceId:`unit-${previous}`});
  expect(ids()).toHaveLength(['singed','renni','smeech'].indexOf(expected)+1);
  expectRoundTripAndNextBattle(state);
 }
 const saved=serializeMatch(preparation(state));expect(serializeMatch(restoreMatch(saved))).toBe(saved);
},20_000);

const escrowedClaims=new Map<number,MatchState>();
function escrowedClaim(round:number):MatchState{
 const cached=escrowedClaims.get(round);if(cached)return cached;
 let state=preparation(fullMarket());
 while(state.round<round){
  state=ok(startMatchCombat(state));
  for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
  state=preparation(state);
 }
 expect(state.round).toBe(round);
 while(state.level<5)state=ok(buyXp(state));
 const filler=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&u.definitionId==='leona')!;
 state=ok(deployMatchUnit(state,filler.id,{kind:'board',cell:{col:4,row:4}}));
 const p=readG23Progress(state)!,market=p.rewards.find(b=>b.source==='black-market')!;
 const atom=g23RewardAtoms(market,p.seed).find(a=>a.kind==='duplicator')!;
 expect(atom.options.find(id=>state.preparation.units.some(u=>u.team==='player'&&u.definitionId===id))).toBe('singed');
 state=ok(claimG23Reward(state,atom.id,'renata'));
 expect(readG23Progress(state)!.rewardClaims.find(c=>c.atomId===atom.id)).toMatchObject({definitionId:'renata'});
 escrowedClaims.set(round,state);return state;
}
it.each([13,15].flatMap(round=>ENTRIES.map(entry=>({round,entry}))))('preserves an escrowed public claim at round $round choosing another owned eligible target ($entry)',({round,entry})=>{
 expectRoundTripAndNextBattle(escrowedClaim(round),[entry]);
});

it('keeps consecutive black-market RNG cursors and offers equal to the baseline stream',()=>{
 // Independent source-weight oracle for the single-word market stream.
 let word=(BigInt((1^0x67323370)>>>0)*1664525n+1013904223n)%4294967296n,draws=1,shimmerTotal=0,offeredThrough=0,offerCount=0;
 const baseline=Array.from({length:18},(_,i)=>{
  shimmerTotal+=i<2?30:100;
  const tier=Math.min(8,Math.floor(shimmerTotal/100));let first:string|null=null;
  if(tier>offeredThrough){
   const remaining=G23_BLACK_MARKETS[tier-1].options.map(o=>({id:o.id,weight:o.weightBps})).filter(o=>o.weight>0);
   for(let n=0;n<1&&remaining.length;n++){
    word=(word*1664525n+1013904223n)%4294967296n;draws++;
    let roll=word*BigInt(remaining.reduce((sum,o)=>sum+o.weight,0))/4294967296n;
    const index=remaining.findIndex(o=>{roll-=BigInt(o.weight);return roll<0n;});
    const chosen=remaining.splice(index,1)[0];if(!n)first=chosen.id;
   }
   offeredThrough=tier;offerCount++;
   if(offerCount%2===0){shimmerTotal=0;offeredThrough=0;}
  }
  return [Number(word),draws,first];
 });
 let p=createG23Progress(1),offers=0;
 for(let round=1;round<=18;round++){
  const facts:G23BattleFacts={battleId:`rng-${round}`,round,roundKind:'pvp',result:'loss',conquerorTier:0,conquestTakedowns:[],chemBaronTier:7,alliedDeaths:3,rumbleStar:0,highRollerGold:0};
  p=advanceG23Economy(p,facts).progress;
  expect([p.rngState,p.rngDraws,p.chem.offer?.optionId??null]).toEqual(baseline[round-1]);
  if(p.chem.offer){
   const offer=p.chem.offer;offers++;
   const b=G23_BLACK_MARKETS[offer.tier-1].options.find(o=>o.id===offer.optionId)!;
   // Resolving candidate lists and decisions must not consume the economy RNG.
   for(let repeat=0;repeat<3;repeat++)g23RewardAtoms({id:offer.id,round,source:'black-market',tier:offer.tier,reward:b.reward},p.seed);
   p=decideG23Market(p,offer.id,offers%2===0,round);
  }
  expect([p.rngState,p.rngDraws]).toEqual(baseline[round-1].slice(0,2));
 }
 expect(offers).toBe(16);
});

let usedConqueror:MatchState|undefined;
let beforeConqueror:MatchState|undefined;
function publicConqueror():MatchState{
 if(usedConqueror)return usedConqueror;
 let state=preparation(createMatch(1));
 // Keep the later copied Irelia as a separate birth instead of consuming it
 // in an upgrade with the opening copy and the second chest's copy.
 for(let copy=0;copy<8;copy++)state=ok(grantMechanicUnit(state,{receiptId:`fixture:irelia:${copy}`,source:'fixture',definitionId:'irelia'}));
 state=ok(grantMechanicGold(state,{receiptId:'fixture:gold',source:'fixture',amount:120}));
 while(state.level<4)state=ok(buyXp(state));
 state=ok(deployMatchUnit(state,state.preparation.units.find(u=>u.team==='player')!.id,{kind:'bench',slot:0}));
 for(const [col,definitionId]of ['darius','draven','swain','ambessa'].entries()){
  for(let copy=0;copy<9;copy++)state=ok(grantMechanicUnit(state,{receiptId:`fixture:${definitionId}:${copy}`,source:'fixture',definitionId}));
  const target=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId&&u.starLevel===3)!;
  state=ok(deployMatchUnit(state,target.id,{kind:'board',cell:{col,row:4}}));
 }
 for(let battle=0;battle<20;battle++){
  const before=state;
  state=ok(startMatchCombat(state));
  for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
  if(readG23Progress(state)!.rewardClaims.some(c=>c.kind==='duplicator')){beforeConqueror=before;usedConqueror=state;return state;}
  state=preparation(state);
 }
 throw Error('Public conqueror battle budget');
}
it.each(['settlement','next preparation'])('rejects a different owned ordinary lesser duplicator target in %s',phase=>{
 const used=publicConqueror(),claim=readG23Progress(used)!.rewardClaims.find(c=>c.kind==='duplicator')!;
 expect(claim.bundleId).toBe('g23:conqueror:4');
 const p=readG23Progress(used)!,bundle=p.rewards.find(b=>b.id===claim.bundleId)!;
 const atom=g23RewardAtoms(bundle,p.seed).find(a=>a.id===claim.atomId)!;
 const target=['darius','draven','swain','irelia'].find(id=>id!==claim.definitionId)!;
 expect(atom.options).toContain(target);
 expect(used.preparation.units.some(u=>u.team==='player'&&u.definitionId===target)).toBe(true);
 const base=phase==='settlement'?used:preparation(used);
 expect(restoreMatch(serializeMatch(base))).toEqual(base);
 const forged=structuredClone(base);
 Object.assign(forged.seatMechanics!.receipts.find(r=>r.receiptId===claim.id)!,{definitionId:target});
 Object.assign(forged.preparation.units.find(u=>u.id===claim.instanceId)!,{definitionId:target});
 rejectsEveryEntry(forged,'mechanic duplicator target');
});

const ordinaryEscrowClaim=once(()=>{
 publicConqueror();
 let state=beforeConqueror!;
 for(const definitionId of ['leona','lux','tristana','maddie','vex','zyra','singed','renata','renni']){
  if(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length===9)break;
  state=ok(grantMechanicUnit(state,{receiptId:`fixture:ordinary-capacity:${definitionId}`,source:'fixture',definitionId}));
 }
 state=ok(startMatchCombat(state));
 for(let tick=0;state.phase==='combat'&&tick<1200;tick++)state=stepMatch(state).state;
 state=preparation(state);
 const p=readG23Progress(state)!,bundle=p.rewards.find(b=>b.id==='g23:conqueror:4')!;
 expect(bundle).toBeDefined();
 const atom=g23RewardAtoms(bundle,p.seed).find(a=>a.kind==='duplicator')!;
 expect(p.rewardClaims.some(c=>c.atomId===atom.id)).toBe(false);
 while(state.level<5)state=ok(buyXp(state));
 const filler=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&u.definitionId==='leona')!;
 state=ok(deployMatchUnit(state,filler.id,{kind:'board',cell:{col:4,row:4}}));
 const first=atom.options.find(id=>state.preparation.units.some(u=>u.team==='player'&&u.definitionId===id));
 const target=['darius','draven','swain','irelia'].find(id=>id!==first)!;
 state=ok(claimG23Reward(state,atom.id,target));
 expect(readG23Progress(state)!.rewardClaims.find(c=>c.atomId===atom.id)).toMatchObject({definitionId:target});
 return state;
});
it.each(ENTRIES)('restores an ordinary duplicator manually claimed from escrow and the next battle tick for tick (%s)',entry=>{
 expectRoundTripAndNextBattle(ordinaryEscrowClaim(),[entry]);
});
