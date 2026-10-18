import * as api from './recorded-match';
import {createRequire} from 'node:module';
import {readG23Progress} from '../../src/simulation/g2-3-state';
const {run}=createRequire(import.meta.url)('../../scripts/generate-m5-route.cjs');
const accept=(r:api.MatchCommandResult)=>{if(!r.ok)throw Error(r.reason);return r.state;};
/** Acquire and deploy a third Academy definition using actual shop/public commands. */
export async function publicAcademyGrant():Promise<api.MatchState>{
 let state:api.MatchState|undefined;const reached=Error('academy preparation');
 try{await run(api,{build:'cannon',seed:42,onStep(before:api.MatchState,_r:api.MatchCommandResult,c?:{type:string}){
  if(c?.type==='start'&&before.roundDefinitionId==='5-1'){state=before;throw reached;}
 }});}catch(e){if(e!==reached)throw e;}
 if(!state)throw Error('Missing Academy public prefix');
 const all=['lux','leona','ezreal','heimerdinger','jayce'];
 // Sell through the public command; no fabricated income or shop outcomes.
 for(const u of state.preparation.units.filter(u=>u.team==='player'&&!all.includes(u.definitionId)))state=accept(api.sellUnit(state,u.id));
 const owned=()=>[...new Set(state!.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId))];
 while(owned().length<3){
  const slot=state.shop.slots.findIndex(s=>s.status==='available'&&all.includes(s.definitionId)&&!owned().includes(s.definitionId));
  if(slot>=0)state=accept(api.buyUnit(state,slot,state.shop.generation));
  else{if(state.gold<7)throw Error('Academy public search budget');state=accept(api.rerollShop(state));}
 }
 for(const [i,name] of owned().entries()){
  const unit=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===name)!;
  state=accept(api.deployMatchUnit(state,unit.id,{kind:'board',cell:{col:i,row:4}}));
 }
 if(readG23Progress(state)!.itemReceipts.length!==1)throw Error('Expected public Academy3 grant');
 return state;
}
