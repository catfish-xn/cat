import {expect,it} from 'vitest';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {createMatch,buyXp,deployMatchUnit,selectChoice,nextRound,startMatchCombat,stepMatch,claimG23Reward,type MatchState} from '../src/simulation/match';
import {grantMechanicGold,grantMechanicUnit} from '../src/simulation/seat-mechanics';
import {G23_BLACK_MARKETS,G23_CONQUEROR_CHESTS,G23_POLICY,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {drainG23Rewards} from '../src/simulation/g2-3-runtime';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {readG23MechanismState} from '../src/simulation/g2-3-view';
import type {G23RewardBundle} from '../src/simulation/g2-3-economy';

const shimmer='TFT13_Crime_Consumable_LesserShimmerDuplicator';
const lesser='TFT_Consumable_ChampionDuplicator_III';
const ok=<T extends {ok:boolean;state:MatchState}>(r:T):MatchState=>{if(!r.ok)throw Error('Public fixture command refused');return r.state;};
function preparation(input:MatchState):MatchState{
 let state=input;
 for(let guard=0;guard<20;guard++){
  if(state.phase==='preparation')return state;
  if(state.phase==='choice'){
   const c=state.pendingChoice!;state=ok(selectChoice(state,c.choiceId,c.generation,c.offers[0]));
  }else if(state.phase==='settlement')state=ok(nextRound(state,state.round));
  else throw Error(`Unexpected public fixture phase ${state.phase}`);
 }
 throw Error('Preparation budget');
}
const bundle:G23RewardBundle={id:'fixture:shimmer',round:1,source:'black-market',tier:1,reward:{Consumables:[shimmer]}};
/** Unit-level reward vector; save tests below use only natural battles and public commands. */
function rewardVector():MatchState{
 const state=preparation(createMatch(42));
 return writeG23Progress(state,{...readG23Progress(state)!,rewards:[bundle]});
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
 const claimed=drainG23Rewards(state),claims=readG23Progress(claimed)!.rewardClaims;
 expect(claims).toMatchObject([{kind:'duplicator',definitionId:id,instanceId:`unit-${serial}`}]);
 expect(claimed.preparation.units.find(u=>u.id===`unit-${serial}`)).toMatchObject({definitionId:id,starLevel:1});
 expect(drainG23Rewards(claimed)).toBe(claimed);
});

it('rejects non-Chem-Barons and Silco, retaining escrow until a legal bench target is owned',()=>{
 let state=rewardVector();
 state=ok(grantMechanicUnit(state,{receiptId:'fixture:ineligible',source:'fixture',definitionId:'silco'}));
 // Opening Irelia is on board; 4-cost Chem-Baron Silco is on the bench.
 expect(state.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId)).toEqual(['irelia','silco']);
 const before=JSON.stringify(state),atom=g23RewardAtoms(bundle,state.seed)[0];
 expect(drainG23Rewards(state)).toBe(state);
 for(const id of ['irelia','silco','renni'])expect(claimG23Reward(state,atom.id,id)).toMatchObject({ok:false,reason:'stale-choice',state});
 expect(JSON.stringify(state)).toBe(before);
 expect(readG23MechanismState(state)!.rewards).toContainEqual(expect.objectContaining({duplicatorDefinitionId:shimmer,remaining:1}));
 state=ok(grantMechanicUnit(state,{receiptId:'fixture:late-target',source:'fixture',definitionId:'renni'}));
 const claimed=drainG23Rewards(state);
 expect(readG23Progress(claimed)!.rewardClaims).toMatchObject([{definitionId:'renni'}]);
 expect(readG23MechanismState(claimed)!.rewards).toEqual([]);
});

it.each(['TFT_Consumable_NeekosHelp','TFT13_Crime_Consumable_ShimmerDuplicator'])('does not admit the unsupported large duplicator %s',id=>{
 expect(()=>g23RewardAtoms({...bundle,reward:{Consumables:[id]}},42)).toThrow('Unadmitted G23 item');
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
   const c=state.pendingChoice!;state=ok(selectChoice(state,c.choiceId,c.generation,c.offers[0]));
  }
  state=preparation(state);
 }
 throw Error('Public market battle budget');
}

function expectRoundTripAndNextBattle(state:MatchState):void{
 const saved=serializeMatch(state),copies=[restoreMatch(saved),restoreMatch(state),restoreMatch(JSON.stringify(state))];
 for(const copy of copies)expect(copy).toEqual(state);
 let original=preparation(state),restored=copies.map(preparation);
 const start=startMatchCombat(original);original=ok(start);
 restored=restored.map(copy=>{const result=startMatchCombat(copy);expect(result).toEqual(start);return ok(result);});
 expect(original.phase).toBe('combat');
 let ticks=0;
 while(original.phase==='combat'&&ticks++<1200){
  const step=stepMatch(original);original=step.state;
  restored=restored.map(copy=>{const next=stepMatch(copy);expect(next).toEqual(step);return next.state;});
 }
 expect(ticks).toBeGreaterThan(0);expect(original.combat?.status).toBe('finished');
}

it('restores the naturally obtained pending black-market reward and the next battle tick for tick',()=>{
 const state=publicMarket();
 expect(state.pendingChoice).toMatchObject({kind:'blackMarket',payload:{source:'black-market',grantItem:false}});
 expectRoundTripAndNextBattle(state);
});

it('restores the used lesser shimmer duplicator and the next battle tick for tick',()=>{
 const pending=publicMarket(),choice=pending.pendingChoice!;
 const used=ok(selectChoice(pending,choice.choiceId,choice.generation,choice.offers[0]));
 const claim=readG23Progress(used)!.rewardClaims.find(c=>c.kind==='duplicator')!;
 expect(['singed','renata','renni','smeech']).toContain(claim.definitionId);
 expect(used.preparation.units.some(u=>u.id===claim.instanceId)).toBe(true);
 expectRoundTripAndNextBattle(used);
});

it('rejects a jointly edited copy/receipt using a hero granted later by the same black-market package',()=>{
 const pending=publicMarket(),choice=pending.pendingChoice!;
 const used=ok(selectChoice(pending,choice.choiceId,choice.generation,choice.offers[0]));
 const claim=readG23Progress(used)!.rewardClaims.find(c=>c.kind==='duplicator')!;
 expect(pending.preparation.units.some(u=>u.team==='player'&&u.definitionId==='smeech')).toBe(false);
 expect(used.preparation.units.some(u=>u.team==='player'&&u.definitionId==='smeech')).toBe(true);
 const forged=structuredClone(used);
 Object.assign(forged.seatMechanics!.receipts.find(r=>r.receiptId===claim.id)!,{definitionId:'smeech'});
 Object.assign(forged.preparation.units.find(u=>u.id===claim.instanceId)!,{definitionId:'smeech'});
 expect(()=>serializeMatch(forged)).toThrow('mechanic duplicator target');
 expect(()=>restoreMatch(forged)).toThrow('mechanic duplicator target');
 expect(()=>restoreMatch(JSON.stringify(forged))).toThrow('mechanic duplicator target');
});
