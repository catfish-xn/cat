import { hasB5VoidSwarm } from './augment-pool-batch5-g4-swarm';
import type {TraitSnapshot} from './strategy-types';
import {isCombatRosterLocked} from './operation-policy';
import type {CombatStrategyInputs} from './combat-input';
import type {MatchState,MatchCommandResult} from './match-types';
import type {HexCell} from './board';
import type {StarLevel} from './unit-types';
import type {ItemSummonOrigin} from './g2-4b-summons';
import {DEFAULT_BOARD,isDeploymentCell,sameCell} from './board';
import {g22Equipment} from './strategy-g2-2';
import {ROUND_CATALOG} from './content/round-catalog';
import {projectG23Summons,SION_POSITION_KEY} from './g2-3-summons';
import {projectStrategyMembership} from './strategy-membership';
import {nearestItemCell} from './g2-4b-item-kernel';
import {G24_VOIDSPAWN_POLICY} from './content/g2-4b-voidspawn';
import {writeSeatMechanic} from './seat-mechanics/state';
import {combatBenchProjection} from './bench-capacity';
export const VOIDSPAWN_ITEM='TFT5_Item_ZzRotPortalRadiant';
/** Saved preparation cells of movable summons: a Voidspawn's by its portal item instance (`item-N`), a Hextech Forge's by
 * its Jayce (`unit-N`), and Black Rose Sion by `g23-sion` (P user 2026-10-29). Cells are in the owner's own rows. */
export type ItemSummonPositions=Readonly<Record<string,HexCell>>;
export function readItemSummonPositions(state:Pick<MatchState,'seatMechanics'>):ItemSummonPositions|undefined {
 return state.seatMechanics?.seat.g24ItemPositions as ItemSummonPositions|undefined;
}
export function validateItemSummonPositions(value:unknown,nextItemSerial?:number,nextUnitSerial?:number):asserts value is ItemSummonPositions {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new RangeError('Invalid item summon positions');
 for(const [id,cell] of Object.entries(value)){
  const match=/^(item|unit)-([1-9][0-9]*)$/.exec(id),next=match?.[1]==='unit'?nextUnitSerial:nextItemSerial;
  if((!match&&id!==SION_POSITION_KEY)||match&&next!==undefined&&Number(match[2])>=next||!cell||typeof cell!=='object'
    ||Object.keys(cell).sort().join()!=='col,row'||!Number.isSafeInteger(cell.col)||!Number.isSafeInteger(cell.row)
    ||!isDeploymentCell(DEFAULT_BOARD,'player',cell))throw new RangeError('Invalid item summon cell');
 }
}
export function voidspawnStage(round:number){
 // Overtime ordinals lie past the catalog and count as the stage after the last one (clamped to the final row).
 const stage=ROUND_CATALOG.find(r=>r.ordinal===round)?.stage??Math.max(...ROUND_CATALOG.map(r=>r.stage))+1,index=Math.max(0,Math.min(4,stage-2));
 return {health:G24_VOIDSPAWN_POLICY.health[index],attack:G24_VOIDSPAWN_POLICY.attack[index],stars:G24_VOIDSPAWN_POLICY.stars[index] as StarLevel};
}
/** Preparation projection only: no inventory mint, shop identity or population.
 * Persisted cells belong to item instances, so moving/selling the holder does
 * not reset a still-equipped portal's chosen position on the next round. */
export function projectVoidspawns(state:CombatStrategyInputs,traits?:readonly TraitSnapshot[]){
 const preparation=projectG23Summons(state.preparation,traits,state.itemSummonPositions),units=[...preparation.units],origins:ItemSummonOrigin[]=[];
 const equipment=g22Equipment(state).filter(i=>i.definitionId===VOIDSPAWN_ITEM).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(!equipment.length||hasB5VoidSwarm(state))return {preparation,origins};
 const stats=voidspawnStage(state.round);
 for(const item of equipment){
  const owner=units.find(u=>u.id===item.unitId);if(!owner||owner.location.kind!=='board')continue;
  const zone=preparation.board.deploymentZones[owner.team];
  const front=owner.team==='player'?zone.firstRow:zone.lastRow;
  const preferred=state.itemSummonPositions?.[item.id]??{col:owner.location.cell.col,row:front};
  const cells=Array.from({length:zone.lastRow-zone.firstRow+1},(_,r)=>Array.from({length:preparation.board.columns},(_,col)=>({col,row:zone.firstRow+r}))).flat();
  const free=cells.filter(c=>!units.some(u=>u.location.kind==='board'&&sameCell(u.location.cell,c)));
  const cell=nearestItemCell(preferred,free);if(!cell)continue;
  const id=JSON.stringify(['g24-summon','voidspawn',owner.id,item.id]);
  const unit={id,definitionId:'g24-voidspawn',team:owner.team,starLevel:stats.stars,location:{kind:'board' as const,cell}};
  if(units.some(u=>u.id===id))throw new RangeError('Duplicate Voidspawn');
  units.push(unit);origins.push({kind:'voidspawn',ownerId:owner.id,itemInstanceId:item.id,unit,formCell:cell,healthBps:10000});
 }
 return {preparation:{...preparation,units},origins};
}
/** A movable preparation summon as its owner sees it. `forge`: Jayce's Hextech Forge, keyed by its Jayce (`itemInstanceId`
 * is then the Jayce unit id); Sion uses the seat-local `g23-sion` key. Neither is a combat item summon. */
export type MovableSummon=Pick<ItemSummonOrigin,'ownerId'|'itemInstanceId'|'unit'>&{readonly kind:ItemSummonOrigin['kind']|'forge'|'sion'};
function movableSummons(state:MatchState){
 // Combat projection parks over-encumbered reserves before membership, so they do not grant traits or summons.
 const membership=projectStrategyMembership({...state,preparation:combatBenchProjection(state.preparation)});
 const projection=projectVoidspawns({...membership.state,itemSummonPositions:readItemSummonPositions(state)},membership.traits);
 // Combat-only Jayce copies must not introduce a movable forge key absent from the owned roster/snapshot.
 const forges:MovableSummon[]=projection.preparation.units.filter(u=>u.definitionId==='g23-forge'&&u.team==='player'&&u.location.kind==='board'
   &&state.preparation.units.some(owner=>owner.id===u.id.slice(0,-':g23-forge'.length)&&owner.definitionId==='jayce')).map(unit=>{
  const ownerId=unit.id.slice(0,-':g23-forge'.length);
  return {kind:'forge',ownerId,itemInstanceId:ownerId,unit};
 });
 const sions:MovableSummon[]=projection.preparation.units.filter(u=>u.definitionId==='g23-sion'&&u.team==='player'&&u.location.kind==='board').map(unit=>({
  kind:'sion',ownerId:unit.id.slice(0,-':g23-sion'.length),itemInstanceId:SION_POSITION_KEY,unit
 }));
 return {projection,summons:[...projection.origins as readonly MovableSummon[],...forges,...sions]};
}
/** Owner-visible movable preparation summons. Rendering remains an adapter. */
export function readItemSummons(state:MatchState):readonly MovableSummon[] {
 return movableSummons(state).summons;
}
/** Movable summons stay editable during preparation and during an augment or anomaly choice that returns there. */
export function isSummonPreparation(state:Pick<MatchState,'phase'|'pendingChoice'>):boolean {
 return state.phase==='preparation'||state.phase==='choice'&&state.pendingChoice?.returnPhase==='preparation'
   &&(state.pendingChoice.kind==='augment'||state.pendingChoice.kind==='anomaly');
}
export function moveItemSummon(state:MatchState,itemInstanceId:string,cell:HexCell):MatchCommandResult {
 if(!isSummonPreparation(state)||isCombatRosterLocked(state)||state.multiplayer?.status==='eliminated'
   ||state.pendingChoice?.payload?.source==='masterwork-upgrade')return {ok:false,state,reason:'wrong-phase'};
 const {projection,summons}=movableSummons(state);
 const origin=summons.find(o=>o.itemInstanceId===itemInstanceId&&o.unit.team==='player');
 if(!origin)return {ok:false,state,reason:'unknown-unit'};
 if(!Number.isSafeInteger(cell.col)||!Number.isSafeInteger(cell.row)||!isDeploymentCell(state.preparation.board,'player',cell))return {ok:false,state,reason:'outside-deployment-zone'};
 if(projection.preparation.units.some(u=>u.id!==origin.unit.id&&u.location.kind==='board'&&sameCell(u.location.cell,cell)))return {ok:false,state,reason:'occupied'};
 const positions={...readItemSummonPositions(state),[itemInstanceId]:{...cell}};
 return {ok:true,state:writeSeatMechanic(state,'g24ItemPositions',Object.fromEntries(Object.entries(positions).map(([id,c])=>[id,{col:c.col,row:c.row}]))),events:[{type:'seatMechanicChanged',key:'g24ItemPositions'}]};
}
