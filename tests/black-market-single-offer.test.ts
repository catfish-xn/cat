import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {G23_BLACK_MARKETS,G23_POLICY} from '../src/simulation/content/g2-3-policy';
import {rollG23BlackMarket} from '../src/simulation/g2-3-progress';
import {readG23Progress} from '../src/simulation/g2-3-state';
import {drainG23Rewards} from '../src/simulation/g2-3-runtime';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {grantMechanicGold,grantMechanicUnit} from '../src/simulation/seat-mechanics';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';

it('pins all eight unchanged source pools and every weighted boundary to exactly one draw',()=>{
 const raw=JSON.parse(gunzipSync(readFileSync('src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz')).toString());
 const rows=Object.values(raw) as {mName?:string;mConstants?:Record<string,{mValue:number}>}[];
 expect(G23_POLICY.chemBaron.candidateCount).toBe(1);
 for(const market of G23_BLACK_MARKETS){
  const source=rows.find(row=>row.mName===market.table)!.mConstants!;
  const weights=Object.entries(source).map(([id,v])=>({id,weight:Math.round(v.mValue*10000)}));
  expect(market.options.map(o=>({id:o.id,weight:o.weightBps}))).toEqual(weights);
  const total=BigInt(weights.reduce((sum,row)=>sum+row.weight,0));
  let cumulative=0n;
  for(const [index,row]of weights.entries()){
   const lower=(cumulative*4294967296n+total-1n)/total;
   cumulative+=BigInt(row.weight);
   const upper=(cumulative*4294967296n+total-1n)/total-1n;
   for(const word of [lower,upper]){
    // Modular inverse of LCG multiplier: construct seeds for exact interval endpoints.
    const seed=Number(((word-1013904223n)*4276115653n)%4294967296n+4294967296n)%4294967296;
    const rolled=rollG23BlackMarket(market.tier,seed);
    expect(rolled.draws).toBe(1);expect(rolled.rngState).toBe(Number(word));
    expect(rolled.options).toEqual([market.options[index]]);
    expect(rolled.id).toBe(row.id);expect(rolled.reward).toEqual(market.options[index].reward);
   }
  }
 }
});

const ok=(result:api.MatchCommandResult):api.MatchState=>{if(!result.ok)throw Error(result.reason);return result.state;};
// A funded test formation, granted through authoritative receipts; all battles,
// shimmer, offers and save history below are real public-command transitions.
function pendingMarket():api.MatchState{
 let state=ok(grantMechanicGold(api.createMatch(9),{receiptId:'test:fund',source:'test',amount:100}));
 while(state.level<3)state=ok(api.buyXp(state));
 for(const unit of state.preparation.units.filter(u=>u.team==='player'))state=ok(api.deployMatchUnit(state,unit.id,{kind:'bench',slot:0}));
 for(const [col,definitionId]of ['singed','renata','renni'].entries()){
  for(let copy=0;copy<9;copy++)state=ok(grantMechanicUnit(state,{receiptId:`test:${definitionId}:${copy}`,source:'test',definitionId}));
  const unit=state.preparation.units.find(u=>u.definitionId===definitionId&&u.starLevel===3)!;
  state=ok(api.deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row:4}}));
 }
 for(let budget=0;budget<16000;budget++){
  if(state.pendingChoice?.kind==='blackMarket')return state;
  if(state.phase==='choice'){const c=state.pendingChoice!;state=ok(api.selectChoice(state,c.choiceId,c.generation,c.offers[0]));}
  else if(state.phase==='preparation')state=ok(api.startMatchCombat(state));
  else if(state.phase==='combat')state=api.stepMatch(state).state;
  else if(state.phase==='settlement')state=ok(api.nextRound(state,state.round));
  else throw Error('Formation did not reach black market: '+state.phase);
 }
 throw Error('Black-market route budget');
}

it('restores a real pending market, grants the entire bundle once, and preserves keep semantics',()=>{
 const pending=pendingMarket(),choice=pending.pendingChoice!,progress=readG23Progress(pending)!;
 expect(choice.offers).toHaveLength(1);
 expect(choice.offers).toEqual([progress.chem.offer!.optionId]);
 expect(choice.payload).toMatchObject({grantItem:false,skippable:true,timeoutOption:'@skip',skipReward:{kind:'health-per-skip',amount:1}});
 expect(toPrivateSeatView(pending).pendingChoice?.offers).toEqual(choice.offers);
 for(const input of [pending,serializeMatch(pending)])expect(restoreMatch(input)).toEqual(pending);
 // A valid source pool ID that was not offered must still be refused atomically.
 const unoffered=G23_BLACK_MARKETS[progress.chem.offer!.tier-1].options.find(o=>o.id!==choice.offers[0])!.id;
 const refused=api.selectChoice(pending,choice.choiceId,choice.generation,unoffered);
 expect(refused).toEqual({ok:false,state:pending,reason:'invalid-choice'});expect(refused.state).toBe(pending);
 const forged=structuredClone(pending);(forged.pendingChoice!.offers as string[]).push(unoffered);
 for(const input of [forged,JSON.stringify(forged)])expect(()=>restoreMatch(input)).toThrow();
 for(const decision of ['take','keep'] as const){
  const result=api.selectChoice(pending,choice.choiceId,choice.generation,decision==='take'?choice.offers[0]:'@skip');
  const state=ok(result),after=readG23Progress(state)!;
  expect([after.rngState,after.rngDraws]).toEqual([progress.rngState,progress.rngDraws]);
  expect(after.chem).toMatchObject({offer:null,shimmer:decision==='take'?0:progress.chem.shimmer,skips:progress.chem.skips+(decision==='take'?0:1)});
  const bundles=after.rewards.filter(b=>b.source==='black-market');
  expect(bundles).toHaveLength(decision==='take'?1:0);
  if(decision==='take'){
   const source=G23_BLACK_MARKETS[progress.chem.offer!.tier-1].options.find(o=>o.id===choice.offers[0])!;
   expect(bundles[0].reward).toEqual(source.reward);
   const atoms=g23RewardAtoms(bundles[0],pending.seed);
   expect(atoms.length).toBeGreaterThan(1); // this route must exercise a multi-part bundle
   for(const atom of atoms)expect(after.rewardClaims.filter(c=>c.atomId===atom.id)).toHaveLength(atom.quantity);
   expect(drainG23Rewards(state)).toEqual(state);
  }else expect(after.rewards).toEqual(progress.rewards);
  for(const input of [state,serializeMatch(state)])expect(restoreMatch(input)).toEqual(state);
  const restored=restoreMatch(serializeMatch(state));
  expect(drainG23Rewards(restored)).toEqual(restored);
  const duplicate=api.selectChoice(restored,choice.choiceId,choice.generation,decision==='take'?choice.offers[0]:'@skip');
  expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(restored);expect(duplicate).not.toHaveProperty('events');
 }
},30_000);
