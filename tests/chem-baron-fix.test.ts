import {expect,it} from 'vitest';
import {blackMarket,validateChemTransition} from './fixtures/m5/oracle.g2.cjs';
import {activateFamily} from '../src/simulation/family-heist';
import {replayG23Economy} from '../src/simulation/g2-3-match-progress';
import {G23_SPECIAL_ITEM_SOURCE as runtime} from '../src/simulation/content/g2-3-special-item-runtime';
import {G23_SPECIAL_ITEM_SOURCE as archive} from '../src/simulation/content/g2-3-special-item-source';
import {G23_SPECIAL_ITEMS} from '../src/simulation/content/g2-3-item-registry';
import {CHEM_BARON_B_OVERRIDES} from '../src/simulation/content/chem-baron-b-overrides';
import {G23_BLACK_MARKETS} from '../src/simulation/content/g2-3-policy';
import {createG23Progress,validateG23Progress} from '../src/simulation/g2-3-match-progress';
import {advanceG23Economy,decideG23Market,type G23BattleFacts} from '../src/simulation/g2-3-economy';
import {rollG23BlackMarket} from '../src/simulation/g2-3-progress';
import {createMatch,selectChoice,forfeitPendingChoice} from '../src/simulation/match';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {openG23Choice} from '../src/simulation/g2-3-runtime';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';

// Independent literal expectations from the 12/17 B notice entries 1..15 (entry 10 has two fields).
const changes:[string,string,number,number][]=[
 ['Silver_DestabilizedChemtank','InitialPercentShield',0.2,0.25],
 ['Gold_DestabilizedChemtank','InitialPercentShield',0.35,0.5],
 ['Prismatic_DestabilizedChemtank','Health',600,999],
 ['Prismatic_DestabilizedChemtank','PercentShield',0.1,0.2],
 ['Prismatic_DestabilizedChemtank','PrismaticDamagePercent',0.1,0.15],
 ['Prismatic_FleshRipper','AD',0.45,0.6],
 ['Prismatic_PiltovenHexplating','ArmorPerStack',10,5],
 ['Prismatic_ShimmerBloom','IncreasedHealShieldPercent',0.6,0.5],
 ['Prismatic_ShimmerBloom','ShieldAmount',600,400],
 ['Prismatic_ShimmerBloom','PrismaticAllyAP',30,25],
 ['Prismatic_ShimmerBloom','PrismaticAllyAS',0.3,0.25],
 ['Prismatic_UnleashedToxins','PrismaticWaveDamage',450,200],
 ['Prismatic_UnleashedToxins','PrismaticWaveStunDuration',1.5,1],
 ['Prismatic_VirulentVirus','AP',75,50],
 ['Prismatic_VirulentVirus','PrismaticReducedDamage',0.25,0.2],
 ['Prismatic_VirulentVirus','PrismaticZombieHealth',1600,1200],
];
it.each(changes)('adopts B %s.%s without altering archived %s', (name,key,old,value)=>{
 const id='TFT13_Crime_'+name;
 expect((runtime[id as keyof typeof runtime].values as Record<string,number|null>)[key]).toBe(value);
 expect((archive as Record<string,{values:Record<string,number|null>}>)[id].values[key]).toBeCloseTo(old,4);
});
it('overrides exactly the 16 confirmed fields and leaves every other archive parameter intact',()=>{
 const actual:string[]=[];
 for(const [id,row] of Object.entries(runtime))for(const [key,value]of Object.entries(row.values)){
  const original=(archive as Record<string,{values:Record<string,number|null>}>)[id].values[key];
  if(value!==original)actual.push(id+'.'+key);
 }
 expect(actual.sort()).toEqual(changes.map(([name,key])=>'TFT13_Crime_'+name+'.'+key).sort());
 expect(Object.values(CHEM_BARON_B_OVERRIDES).flatMap(Object.keys)).toHaveLength(16);
 expect(runtime.TFT13_Crime_Prismatic_PiltovenHexplating.values['{992e2747}']).toBe(10);
});
it('compiles the new HP, AD and AP into actual equipped-unit strategy stats',()=>{
 const base=createMatch(42),id='holder';
 const state={...base,preparation:{...base.preparation,units:[{id,definitionId:'singed',team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:0,row:4}}}]}};
 const plain=buildStrategySnapshot(state).units[0];
 const expected=[['Prismatic_DestabilizedChemtank','maxHp',999],['Prismatic_FleshRipper','attackDamage',6000],['Prismatic_VirulentVirus','abilityPower',50]] as const;
 for(const [name,stat,amount]of expected){
  const definitionId='TFT13_Crime_'+name;
  expect(G23_SPECIAL_ITEMS[definitionId].effects).toContainEqual(stat==='attackDamage'?{kind:'statPercentBps',stat,bps:amount}:{kind:'statFlat',stat,amount});
  const unit=buildStrategySnapshot({...state,items:[{id:'item-1',definitionId,location:{kind:'unit',unitId:id,slot:0}}]}).units[0];
  if(stat==='maxHp')expect(unit.stats.health-plain.stats.health).toBe(amount);
  else if(stat==='abilityPower')expect(unit.abilityPower!-plain.abilityPower!).toBe(amount);
  else expect(unit.attackDamagePercentBps!-plain.attackDamagePercentBps!).toBe(amount);
 }
});
const facts=(round:number,patch:Partial<G23BattleFacts>={}):G23BattleFacts=>({battleId:'synthetic-'+round,round,roundKind:'pvp',result:'loss',conquerorTier:0,conquestTakedowns:[],chemBaronTier:7,alliedDeaths:0,rumbleStar:0,highRollerGold:0,...patch});
it.each([3,4,5,6,7])('standard PvE grants no shimmer or offers at Chem-Baron %s, regardless of deaths',chemBaronTier=>{
 const base=createG23Progress(42),p={...base,chem:{...base.chem,shimmer:95,losses:2}};
 for(const alliedDeaths of [0,30]){
  const next=advanceG23Economy(p,facts(1,{roundKind:'pve',chemBaronTier,alliedDeaths})).progress;
  expect(next.chem).toEqual(p.chem);expect(next.rngState).toBe(p.rngState);expect(next.rngDraws).toBe(p.rngDraws);
  expect(advanceG23Economy(next,facts(1,{roundKind:'pve',chemBaronTier,alliedDeaths}))).toEqual({progress:next,gold:0});
 }
});
it('counts the third PvP loss immediately, preserves streak through PvE and inactive traits, and resets on a win',()=>{
 let p=createG23Progress(42);
 for(const [round,patch,shimmer,losses]of [
  [1,{chemBaronTier:3},15,1],[2,{chemBaronTier:0},15,2],
  [3,{roundKind:'pve',chemBaronTier:3,alliedDeaths:30},15,2],
  [4,{chemBaronTier:3},50,3],[5,{chemBaronTier:3,result:'win'},65,0],
 ] as const){p=advanceG23Economy(p,facts(round,patch)).progress;expect(p.chem).toMatchObject({shimmer,losses});}
 validateG23Progress(p,42,5);
});
// Independent BigInt LCG and integer interval oracle; no production RNG or weighted-index helper.
function oracle(tier:number,seed:number){
 const remaining=G23_BLACK_MARKETS[tier-1].options.filter(o=>o.weightBps>0).map(o=>({id:o.id,weight:o.weightBps}));
 let word=BigInt(seed);const ids:string[]=[];
 while(ids.length<1&&remaining.length){
  word=(1664525n*word+1013904223n)%4294967296n;
  let ticket=word*BigInt(remaining.reduce((n,o)=>n+o.weight,0))/4294967296n;
  const index=remaining.findIndex(o=>{ticket-=BigInt(o.weight);return ticket<0n;});
  ids.push(remaining.splice(index,1)[0].id);
 }
 return {ids,state:Number(word)};
}
it('samples exactly one whole source bundle with one explicit weighted LCG draw',()=>{
 for(let tier=1;tier<=8;tier++)for(const seed of [0,1,42,0xffffffff]){
  const expected=oracle(tier,seed),actual=rollG23BlackMarket(tier,seed);
  expect(actual.options.map(o=>o.id)).toEqual(expected.ids);expect(actual.rngState).toBe(expected.state);
  expect(blackMarket(tier,seed)).toEqual({offers:expected.ids,rng:expected.state,draws:expected.ids.length});expect(actual.draws).toBe(expected.ids.length);expect(new Set(expected.ids).size).toBe(expected.ids.length);
 }
 expect(rollG23BlackMarket(8,42).draws).toBe(1);
});
function market(){let p=createG23Progress(9);for(let round=1;round<=3;round++)p=advanceG23Economy(p,facts(round)).progress;return p;}
it('accepts only the selected bundle, retains shimmer on keep, and rejects stale/unoffered decisions without mutation',()=>{
 const p=market(),offer=p.chem.offer!,saved=structuredClone(p);
 expect(offer.optionIds).toHaveLength(1);
 const selected=offer.optionIds[0],chosen=decideG23Market(p,offer.id,true,3,selected);
 expect(chosen.rewards).toEqual([{id:offer.id,round:3,source:'black-market',tier:1,reward:G23_BLACK_MARKETS[0].options.find(o=>o.id===selected)!.reward}]);
 expect(chosen.chem).toMatchObject({shimmer:0,offer:null});
 expect([chosen.rngState,chosen.rngDraws]).toEqual([p.rngState,p.rngDraws]);validateG23Progress(chosen,9,3);
 const kept=decideG23Market(p,offer.id,false,3);
 expect(kept.chem).toMatchObject({shimmer:160,skips:1,offeredThrough:1,offer:null});expect(kept.rewards).toEqual([]);
 expect([kept.rngState,kept.rngDraws]).toEqual([p.rngState,p.rngDraws]);
 const next=advanceG23Economy(kept,facts(4)).progress;expect(next.chem).toMatchObject({shimmer:260,offer:{tier:2}});validateG23Progress(next,9,4);
 for(const command of [()=>decideG23Market(p,'stale',true,3,selected),()=>decideG23Market(p,offer.id,true,2,selected),()=>decideG23Market(p,offer.id,true,3,'unoffered'),()=>decideG23Market(chosen,offer.id,true,3,selected)])expect(command).toThrow();
 expect(p).toEqual(saved);
 const forged={...chosen,economyReceipts:chosen.economyReceipts.map(r=>r.kind==='market'?{...r,optionId:'unoffered'}:r)};
 expect(()=>validateG23Progress(forged,9,3)).toThrow();
});
it.each([false,true])('public choose/keep and timeout preserve choice projection and atomic failures (timeout=%s)',timeout=>{
 const p=market(),base=createMatch(9),state=writeG23Progress({...base,round:3,roundDefinitionId:'1-3',multiplayer:{version:'multiplayer-settlement-v1' as const,seatId:'A',status:'active' as const,receipts:[],forfeitedChoices:[]}},p),opened=openG23Choice(state).state,choice=opened.pendingChoice!;
 expect(choice).toMatchObject({choiceId:p.chem.offer!.id,generation:0,offers:p.chem.offer!.optionIds,payload:{grantItem:false}});
 expect(toPrivateSeatView(opened).pendingChoice?.offers).toEqual(choice.offers);
 for(const [id,generation,option]of [['stale',0,choice.offers[0]],[choice.choiceId,1,choice.offers[0]],[choice.choiceId,0,'unoffered']] as const){
  const refused=selectChoice(opened,id,generation,option);expect(refused.ok).toBe(false);expect(refused.state).toBe(opened);expect(refused).not.toHaveProperty('events');
 }
 const result=timeout?forfeitPendingChoice(opened,opened.round,choice.choiceId,0):selectChoice(opened,choice.choiceId,0,'@skip');
 expect(result.ok).toBe(true);expect(readG23Progress(result.state)!.chem).toMatchObject({shimmer:160,offer:null,skips:1});
 expect(readG23Progress(result.state)!.rngState).toBe(p.rngState);
 const timeoutAgain=forfeitPendingChoice(result.state,result.state.round,choice.choiceId,0);
 expect(timeoutAgain.ok).toBe(false);expect(timeoutAgain.state).toBe(result.state);expect(timeoutAgain).not.toHaveProperty('events');
 const accepted=selectChoice(opened,choice.choiceId,0,choice.offers[0]);expect(accepted.ok).toBe(true);
 expect(readG23Progress(accepted.state)!.rewards).toHaveLength(1);
 const duplicate=selectChoice(accepted.state,choice.choiceId,0,choice.offers[0]);expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(accepted.state);
});

it('replays Family, Mel and the sole black-market bundle together without losing v19 receipts',()=>{
 let p=activateFamily(createG23Progress(42),1);
 const familyRng=p.family!.rngState;
 for(let round=1;round<=3;round++)p=advanceG23Economy(p,facts(round,{
  melCasts:4,family:{stage:4,eligible:true,openingIds:Array.from({length:9},(_,i)=>'f'+i),survivorIds:Array.from({length:9},(_,i)=>'f'+i)},
 })).progress;
 expect(p.mel).toEqual({pvpCasts:12,savedBattleId:null});
 expect(p.rewards.some(r=>r.source==='family')).toBe(true);
 expect(p.family!.rngState).not.toBe(familyRng);
 const saved={kind:'mel-save' as const,battleId:'synthetic-3',round:3};
 p={...p,mel:{...p.mel!,savedBattleId:saved.battleId},economyReceipts:[...p.economyReceipts,saved]};
 const offer=p.chem.offer!,optionId=offer.optionIds[0];
 p=decideG23Market(p,offer.id,true,3,optionId);
 const restored=replayG23Economy(42,JSON.parse(JSON.stringify(p.economyReceipts)));
 expect(restored).toEqual(p);validateG23Progress(restored,42,3);
 expect(restored.rewards.filter(r=>r.source==='black-market')).toEqual([{id:offer.id,round:3,source:'black-market',tier:offer.tier,reward:G23_BLACK_MARKETS[offer.tier-1].options.find(o=>o.id===optionId)!.reward}]);
 expect(restored.mel!.savedBattleId).toBe('synthetic-3');
 const pve=advanceG23Economy(restored,facts(4,{roundKind:'pve',melCasts:99,family:{stage:4,eligible:true,openingIds:['a'],survivorIds:['a']}})).progress;
 expect(pve.chem).toEqual(restored.chem);expect(pve.family).toEqual(restored.family);expect(pve.mel).toEqual(restored.mel);
 validateG23Progress(pve,42,4);
});

it('independently audits standard PvE, single bundle offers and keep in the route oracle',()=>{
 let p=createG23Progress(42);
 for(let round=1;round<=4;round++){
  const before=writeG23Progress(createMatch(42),p);
  p=advanceG23Economy(p,facts(round,{roundKind:round===2?'pve':'pvp'})).progress;
  const after=writeG23Progress(createMatch(42),p);
  validateChemTransition(before,after);
  expect(()=>validateChemTransition(before,writeG23Progress(after,{...p,chem:{...p.chem,shimmer:p.chem.shimmer+1}}))).toThrow();
 }
 const before=writeG23Progress(createMatch(42),p),offer=p.chem.offer!;
 for(const take of [false,true]){
  const selected=offer.optionIds[0],next=decideG23Market(p,offer.id,take,4,selected);
  const after=writeG23Progress({...before,seatMechanics:{...before.seatMechanics!,receipts:[...before.seatMechanics!.receipts,{
   kind:'choice' as const,choiceKind:'blackMarket' as const,receiptId:offer.id,round:4,roundId:'2-1',source:'black-market',optionId:take?selected:'@skip',skipped:!take,itemId:null,price:0,timedOut:!take,
  }]}},next);
  validateChemTransition(before,after);
 }
});
