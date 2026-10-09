import type { Unit, StarLevel } from './unit-types';
import { M5_UNIT_DEFINITIONS } from './units';
import { FINAL_ROUND, ROUND_PREPARATION_RULES, getRoundKind, getStageRound } from './round-schedule';
import { freezeContent } from './content/freeze';
import { ROUND_CATALOG } from './content/round-catalog';
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
  // Stage 1 deliberately uses an existing neutral placeholder until B7 integration.
  if(stage===1) return [ROUND_PREPARATION_RULES.openingEnemyPlaceholder];
  if(kind==='pve') return Array.from({length:stage<4?3:stage===4?4:1},()=>`neutral-stage-${stage}`);
  const count=stage===2?(sub>=5?4:3):stage+2;
  let pool:readonly string[]=ENEMY_TEMPLATES[templateIndex(round)];
  if(stage===2) pool=pool.filter(id=>M5_UNIT_DEFINITIONS[id].cost<=2);
  return Array.from({length:count},(_,index)=>pool[index%pool.length]);
}
export function createRoundEnemies(round:number):readonly Unit[] {
  const {stage}=getStageRound(round),kind=getRoundKind(round);
  return idsForRound(round).map((definitionId,index)=>({
    id:round===1?`enemy-${index+1}`:`enemy-r${round}-${index+1}`,definitionId,team:'enemy',
    starLevel:(kind==='pve'?1:stage>=5?2:stage===4&&index<3?2:stage===3&&index===0?2:1) as StarLevel,
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
export function readRoundEnemyProjection(round:number): typeof ROUND_ENEMY_PROJECTIONS[number] {
  getStageRound(round);return ROUND_ENEMY_PROJECTIONS[round-1];
}
