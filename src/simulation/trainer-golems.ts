import { appendResourceProvenance } from './resource-provenance';
import { freezeContent } from './content/freeze';
import { TRAINER_EMBLEMS, TRAINER_ID, trainerStar } from './content/opening-batch-b';
import { OpeningEncounterError, openingEncounterId, validateOpeningEncounterState, type OpeningEncounterContext } from './opening-encounter';
import { openingSeatDraw } from './opening-batch-b-rng';
import { grantMechanicUnit, grantMechanicItem } from './seat-mechanics/grants';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import type { MatchCommandResult, MatchState, MatchEvent } from './match-types';
export { TRAINER_GOLEMS_POLICY } from './content/trainer-golems';
export type TrainerGolemEmblems = readonly [string,string,string];
const source='opening-trainer-golems', receiptId='opening-batch-b/trainer-golems';
export function validateTrainerGolemEmblems(input:unknown):TrainerGolemEmblems {
 if(!Array.isArray(input)||input.length!==3||new Set(input).size!==3||[...input].some(id=>!TRAINER_EMBLEMS.includes(id)))throw new OpeningEncounterError('invalid-opening-effect');
 return freezeContent([...input] as [string,string,string]);
}
export function trainerEmblems(seed:number,seat:string):TrainerGolemEmblems {
 const draw=openingSeatDraw(seed,seat,'trainer-golems/emblems'),pool=[...TRAINER_EMBLEMS];
 for(let i=0;i<3;i++){const j=i+Math.floor(draw()*(pool.length-i)/4294967296);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return validateTrainerGolemEmblems(pool.slice(0,3));
}
export function growTrainerGolem(state:MatchState):MatchState {
 const starLevel=trainerStar(getMultiplayerRoundByOrdinal(state.round).stage);
 if(!state.preparation.units.some(u=>u.definitionId===TRAINER_ID&&u.starLevel!==starLevel))return state;
 return {...state,preparation:{...state.preparation,units:state.preparation.units.map(u=>u.definitionId===TRAINER_ID?{...u,starLevel}:u)}};
}
/** Internal lifecycle hook. Grant once; subsequent entries only derive the stage star. */
export function enterTrainerGolems(state:MatchState):{state:MatchState;events:readonly MatchEvent[]} {
 if(openingEncounterId(state)!=='trainer-golems')return {state,events:[]};
 if(state.seatMechanics?.receipts.some(r=>r.receiptId===receiptId))return {state:growTrainerGolem(state),events:[]};
 if(state.round!==1||state.phase!=='preparation'||state.nextUnitSerial!==2||state.nextItemSerial!==1||state.preparation.units.some(u=>u.definitionId===TRAINER_ID))throw new OpeningEncounterError('invalid-opening-effect');
 const cells=[4,5,6,7].flatMap(row=>[3,2,4,1,5,0,6].map(col=>({col,row})));
 const cell=cells.find(c=>!state.preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.col===c.col&&u.location.cell.row===c.row));
 if(!cell)throw new OpeningEncounterError('invalid-opening-effect');
 const born=grantMechanicUnit(state,{receiptId,source,definitionId:TRAINER_ID});
 if(!born.ok||born.receipt.kind!=='unit'||!born.receipt.unitId)throw new OpeningEncounterError('invalid-opening-effect');
 const unitId=born.receipt.unitId,events:MatchEvent[]=[...born.events];state=born.state;
 state={...state,preparation:{...state.preparation,units:state.preparation.units.map(u=>u.id===unitId?{...u,location:{kind:'board',cell}}:u)}};
 for(const [slot,definitionId] of trainerEmblems(state.augmentTierSeed,state.sharedPool?.seatId??'solo').entries()){
  const grant=grantMechanicItem(state,{receiptId:`${receiptId}/emblem/${slot}`,source,definitionId});
  if(!grant.ok||grant.receipt.kind!=='item')throw new OpeningEncounterError('invalid-opening-effect');
  const itemId=grant.receipt.itemId;
  state={...grant.state,resourceProvenance:appendResourceProvenance(grant.state.resourceProvenance,state.roundDefinitionId,{kind:'item-equipped',itemId,unitId,slot}),items:grant.state.items.map(i=>i.id===itemId?{...i,location:{kind:'unit',unitId,slot}}:i)};
  events.push(...grant.events,{type:'itemEquipped',itemId,unitId,slot});
 }
 return {state,events};
}
export function validateTrainerGolems(state:MatchState):void {
 const check=(v:unknown)=>{if(!v)throw new OpeningEncounterError('opening-context-mismatch');};
 const grants=state.seatMechanics?.receipts.filter(r=>r.source===source||r.receiptId.startsWith(receiptId))??[];
 const units=state.preparation.units.filter(u=>u.definitionId===TRAINER_ID);
 if(openingEncounterId(state)!=='trainer-golems'){check(!grants.length&&!units.length);return;}
 check(grants.length===4&&units.length===1);
 const unit=units[0],birth=grants[0];
 check(unit&&unit.team==='player'&&unit.location.kind==='board'&&unit.starLevel===trainerStar(getMultiplayerRoundByOrdinal(state.round).stage));
 check(birth?.kind==='unit'&&birth.resolution==='held'&&birth.unitId===unit?.id&&birth.definitionId===TRAINER_ID&&birth.receiptId===receiptId);
 const emblems=trainerEmblems(state.augmentTierSeed,state.sharedPool?.seatId??'solo');
 grants.forEach((r,i)=>{check(r.source===source&&r.round===1&&r.roundId==='1-2');if(i){check(r.kind==='item'&&r.receiptId===`${receiptId}/emblem/${i-1}`&&r.definitionId===emblems[i-1]);if(r.kind==='item')check(state.items.some(x=>x.id===r.itemId&&x.definitionId===r.definitionId&&x.location.kind==='unit'&&x.location.unitId===unit.id&&x.location.slot===i-1));}});
 check(state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit.id).length===3);
}
export function applyTrainerGolemsOpening(state:MatchState,shared?:OpeningEncounterContext):MatchCommandResult {
 try{
  if(openingEncounterId(state)!=='trainer-golems')throw new OpeningEncounterError('invalid-opening-effect');
  // Public retries authenticate before returning; lifecycle alone creates the initial grant.
  validateOpeningEncounterState(state,shared);
  return {ok:true,state,events:[]};
 }catch(e){return {ok:false,state,reason:e instanceof OpeningEncounterError?e.reason:'opening-context-mismatch'};}
}
