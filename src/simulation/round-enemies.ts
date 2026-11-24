import type { Unit, StarLevel } from './unit-types';
import { M5_UNIT_DEFINITIONS } from './units';
import { FINAL_ROUND, getRoundKind, getStageRound } from './round-schedule';
import { freezeContent } from './content/freeze';
import { COMPILED_NEUTRAL_ENCOUNTERS } from './neutral-encounter-compiler';
import { ROUND_CATALOG } from './content/round-catalog';
import { ITEM_DEFINITIONS } from './content/items';
/** A unit's equipment slots. */
const ENEMY_ITEM_SLOTS=3;
/** Frontline precedes backline. Duplicate fill at stage two is intentional and never counts twice for traits. */
export const ENEMY_TEMPLATES=freezeContent([
  ['irelia','rell','leona','loris','tristana','urgot','ezreal','corki'],
  ['darius','vander','scar','garen','irelia','loris','maddie','kogmaw'],
  ['irelia','rell','leona','loris','lux','zyra','nami','zoe'],
] as const);
export const ENEMY_POSITIONS=freezeContent([[1,3],[3,3],[5,3],[0,2],[6,2],[1,0],[3,0],[5,0]] as const);
export const ENEMY_GROWTH=freezeContent({fromRound:FINAL_ROUND+1,bpsPerRound:0,maxBps:0});
export function getEnemyGrowthBps(round:number):number {getStageRound(round);return 0;}
function templateIndex(round:number):number {
  // Only PvP rounds advance the rotation; supply/PvE do not consume a template.
  let count=0;for(let n=1;n<round;n++) if(getRoundKind(n)==='pvp') count++;
  return count%ENEMY_TEMPLATES.length;
}
function idsForRound(round:number):readonly string[] {
  const {stage,round:sub}=getStageRound(round),kind=getRoundKind(round);
  if(kind==='supply') return [];
  if(kind==='pve') return [];
  const count=stage===2?(sub>=5?4:3):stage+2;
  let pool:readonly string[]=ENEMY_TEMPLATES[templateIndex(round)];
  if(stage===2) pool=pool.filter(id=>M5_UNIT_DEFINITIONS[id].cost<=2);
  return Array.from({length:count},(_,index)=>pool[index%pool.length]);
}
export function createRoundEnemies(round:number):readonly Unit[] {
  const {stage}=getStageRound(round),kind=getRoundKind(round);
  if(kind==='pve') {
    const encounter=COMPILED_NEUTRAL_ENCOUNTERS.find(e=>e.roundId===ROUND_CATALOG[round-1].roundId);
    if(!encounter) throw new RangeError('Missing approved neutral encounter');
    return encounter.deployment;
  }
  return idsForRound(round).map((definitionId,index)=>({
    id:round===1?`enemy-${index+1}`:`enemy-r${round}-${index+1}`,definitionId,team:'enemy',
    starLevel:(stage>=5?2:stage===4&&index<3?2:stage===3&&index===0?2:1) as StarLevel,
    location:{kind:'board',cell:{col:ENEMY_POSITIONS[index][0],row:ENEMY_POSITIONS[index][1]}},
  }));
}
export interface EnemyItem {readonly unitId:string;readonly definitionId:string;readonly slot:number}
/** Public difficulty equipment is frozen content, independent of owned player item instances. */
export function getRoundEnemyItems(round:number):readonly EnemyItem[] {
  const {stage}=getStageRound(round);
  if(getRoundKind(round)!=='pvp'||stage<4) return [];
  const units=createRoundEnemies(round),line=templateIndex(round);
  const carryPreference=line===0?['corki','ezreal','tristana','urgot']:line===1?['kogmaw','maddie','garen']:['zoe','nami','zyra','lux'];
  const carry=carryPreference.map(id=>units.find(u=>u.definitionId===id)).find(Boolean)??units[units.length-1];
  const tank=units.find(unit=>unit.id!==carry.id)??units[0];
  const carryItems=line===0?['deathblade','shojin','gunblade']:line===1?['rageblade','archangel','gunblade']:['shojin','deathcap','gunblade'];
  const result:EnemyItem[]=carryItems.slice(0,stage-3).map((definitionId,slot)=>({unitId:carry.id,definitionId,slot}));
  if(stage>=5) result.push(...['warmog','dragons-claw'].slice(0,stage-4).map((definitionId,slot)=>({unitId:tank.id,definitionId,slot})));
  return result;
}

/** Versioned expected content, compiled once at module initialization; restore only reads it. */
export const ROUND_ENEMY_PROJECTIONS = freezeContent(ROUND_CATALOG.map(round => ({
  round:round.ordinal,roundId:round.roundId,units:createRoundEnemies(round.ordinal),items:getRoundEnemyItems(round.ordinal),
})));
export function readRoundEnemyProjection(round:number,openingId?:string|null): typeof ROUND_ENEMY_PROJECTIONS[number] {
  getStageRound(round);const base=ROUND_ENEMY_PROJECTIONS[round-1];const crab=COMPILED_NEUTRAL_ENCOUNTERS.find(e=>e.encounterId===`${openingId}/${base.roundId}`);return crab?{...base,units:crab.deployment}:base;
}
/** Why recording-only enemy items were refused (CombatStrategyInputs.recordingEnemyItems), one code per kind of mistake. */
export type RecordingEnemyItemsProblem='not-an-enemy'|'unknown-item'|'bad-slot'|'slot-taken'|'too-many';
export class RecordingEnemyItemsError extends Error {
  constructor(readonly problem:RecordingEnemyItemsProblem,detail:string){super(`recording enemy items: ${problem} (${detail})`);this.name='RecordingEnemyItemsError';}
}
/** Each item on an enemy unit of the board, a known item, in its own slot 0-2 of that unit: anything else is refused by name. */
export function validateRecordingEnemyItems(items:readonly EnemyItem[],units:readonly {readonly id:string;readonly team:string}[]):void {
  const enemies=new Set(units.filter(u=>u.team==='enemy').map(u=>u.id)),taken=new Map<string,Set<number>>(),count=new Map<string,number>();
  for(const item of items)count.set(item.unitId,(count.get(item.unitId)??0)+1);
  for(const [unitId,n] of count)if(n>ENEMY_ITEM_SLOTS)throw new RecordingEnemyItemsError('too-many',unitId);
  for(const item of items){
    if(!enemies.has(item.unitId))throw new RecordingEnemyItemsError('not-an-enemy',item.unitId);
    if(!Object.hasOwn(ITEM_DEFINITIONS,item.definitionId))throw new RecordingEnemyItemsError('unknown-item',item.definitionId);
    if(!Number.isSafeInteger(item.slot)||item.slot<0||item.slot>=ENEMY_ITEM_SLOTS)throw new RecordingEnemyItemsError('bad-slot',`${item.unitId} ${item.slot}`);
    const slots=taken.get(item.unitId)??new Set<number>();
    if(slots.has(item.slot))throw new RecordingEnemyItemsError('slot-taken',`${item.unitId} ${item.slot}`);
    slots.add(item.slot);taken.set(item.unitId,slots);
  }
}
/**
 * The enemy items the strategy reads: the round's own (when enemies stand on the board), unless a recording tool names
 * them (CombatStrategyInputs.recordingEnemyItems; dev/castcmp --foe-items). A match never sets that field, so it reads
 * exactly the round's items as before.
 */
export function roundEnemyItems(state:{readonly round:number;readonly preparation:{readonly units:readonly {readonly id:string;readonly team:string}[]};readonly recordingEnemyItems?:readonly EnemyItem[]}):readonly EnemyItem[] {
  if(state.recordingEnemyItems!==undefined){validateRecordingEnemyItems(state.recordingEnemyItems,state.preparation.units);return state.recordingEnemyItems;}
  return state.preparation.units.some(u=>u.team==='enemy')?readRoundEnemyProjection(state.round).items:[];
}
