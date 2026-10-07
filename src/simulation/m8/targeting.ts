import { contains, getNeighbors, hexDistance, sameCell, type Board, type HexCell, type Team } from '../board';
import type { AbilityTargeting, Source, TargetSelector } from './contracts';
import { compareCodePoints } from './identity';
import { integer } from './stats';
export interface TargetUnit { readonly id: string; readonly team: Team; readonly cell: HexCell; readonly hp: number; readonly maxHp: number; readonly alive: boolean; readonly untargetable?: boolean; readonly burnSources?: readonly Source[] }
export interface TargetEnvironment {
  readonly board: Board; readonly units: readonly TargetUnit[]; readonly holderId: string; readonly tick: number;
  readonly primaryId?: string | null; readonly previousId?: string | null; readonly eventActorId?: string | null; readonly eventTargetId?: string | null;
  readonly eventActorCell?: HexCell; readonly boundTargetIds?: readonly string[]; readonly randomCenterId?: string | null; readonly source?: Source;
  readonly eligibility?: 'new-selection' | 'bound-packet' | 'area-hit';
}
export function startingRows(team: Team, row: number): 'front-two'|'back-two'|null {
  return team==='player' ? row===4||row===5?'front-two':row===6||row===7?'back-two':null : row===2||row===3?'front-two':row===0||row===1?'back-two':null;
}
export function isSelectable(unit: TargetUnit, holder: TargetUnit, env: TargetEnvironment): boolean {
  return unit.alive && unit.hp>0 && contains(env.board,unit.cell) && (unit.team===holder.team || env.eligibility==='bound-packet' || env.eligibility==='area-hit' || !unit.untargetable);
}
const get=(env:TargetEnvironment,id:string|null|undefined)=>env.units.find(u=>u.id===id);
const distanceOrder=(anchor:HexCell,a:TargetUnit,b:TargetUnit,farthest=false)=>(farthest?-1:1)*(hexDistance(anchor,a.cell)-hexDistance(anchor,b.cell))||compareCodePoints(a.id,b.id);
function enemies(env:TargetEnvironment):TargetUnit[] {
  const holder=get(env,env.holderId);if(!holder)return[];
  return env.units.filter(u=>u.team!==holder.team&&isSelectable(u,holder,env)).sort((a,b)=>compareCodePoints(a.id,b.id));
}
export function selectTargets(selector: TargetSelector, env: TargetEnvironment): string[] {
  integer(selector.maxTargets); if(selector.radius!==null)integer(selector.radius);
  const holder=get(env,env.holderId);if(!holder)return[];
  const primary=get(env,env.primaryId), previous=get(env,env.previousId), actor=get(env,env.eventActorId);
  const anchor=selector.anchor==='holder'?holder.cell:selector.anchor==='primary-target'?primary?.cell:selector.anchor==='previous-target'?previous?.cell:env.eventActorCell ?? actor?.cell;
  if(!anchor)return[];
  const candidateIds=selector.candidates==='event-actor'?[env.eventActorId]:selector.candidates==='event-target'?[env.eventTargetId]:selector.candidates==='bound-target'?env.boundTargetIds??[]:null;
  const qualified=(u:TargetUnit)=>isSelectable(u,holder,env)&&(selector.relation==='self'?u.id===holder.id:selector.relation==='ally'?u.team===holder.team:u.team!==holder.team)
    &&(!selector.excludeSelf||u.id!==holder.id)&&(!selector.excludePrimary||u.id!==primary?.id)&&(selector.radius===null||hexDistance(anchor,u.cell)<=selector.radius);
  let candidates=env.units.filter(u=>(candidateIds===null||candidateIds.includes(u.id))&&qualified(u));
  const burnt=(u:TargetUnit)=>env.source&&u.burnSources?.some(s=>s.ownerId===env.source!.ownerId&&s.sourceKind===env.source!.sourceKind&&s.definitionId===env.source!.definitionId&&s.instanceId===env.source!.instanceId&&s.parentItemInstanceId===env.source!.parentItemInstanceId)?1:0;
  candidates.sort((a,b)=>{
    const d=hexDistance(anchor,a.cell)-hexDistance(anchor,b.cell),id=compareCodePoints(a.id,b.id);
    switch(selector.order){
      case'id':return id;
      case'farthest-id':return -d||id;
      case'hp-ratio-id':{const left=integer(a.hp)*integer(b.maxHp,1),right=integer(b.hp)*integer(a.maxHp,1);return (left<right?-1:left>right?1:0)||id;}
      case'hp-absolute-distance-id':return a.hp-b.hp||d||id;
      case'not-burned-by-this-instance-distance-id':return burnt(a)-burnt(b)||d||id;
      default:return d||id;
    }
  });
  if(selector.primary==='first-required'){
    // Primary is a requirement independent from the secondary exclusion flag.
    if(!primary||!isSelectable(primary,holder,env)||selector.maxTargets===0
      || (candidateIds!==null&&!candidateIds.includes(primary.id))
      || (selector.relation==='self'?primary.id!==holder.id:selector.relation==='ally'?primary.team!==holder.team:primary.team===holder.team)
      || (selector.radius!==null&&hexDistance(anchor,primary.cell)>selector.radius))return[];
    candidates=[primary,...candidates.filter(u=>u.id!==primary.id)];
  }
  return candidates.slice(0,selector.maxTargets).map(u=>u.id);
}
export function shortestPath(board:Board,from:HexCell,to:HexCell):HexCell[]{
  if(!contains(board,from)||!contains(board,to))return[];
  const cells:HexCell[]=[];let at=from;
  while(!sameCell(at,to)){
    const next=getNeighbors(board,at).find(c=>hexDistance(c,to)<hexDistance(at,to));if(!next)break;cells.push(next);at=next;
  }
  return cells;
}
/** Caitlyn's approved one-word modulo mapping stays separate from executing the plan. */
export function chooseRandomCenter(env:TargetEnvironment,draw:()=>number):string|null{
  const candidates=enemies(env);if(!candidates.length)return null;
  const word=draw();integer(word);if(word>0xffffffff)throw new RangeError('Invalid combat random word');
  return candidates[word%candidates.length].id;
}
export interface TargetSelection { readonly targetIds: readonly string[]; readonly centerId?: string | null }
export function selectAbilityTargets(targeting:AbilityTargeting,env:TargetEnvironment):TargetSelection{
  const holder=get(env,env.holderId);if(!holder)return{targetIds:[]};const opponents=enemies(env);
  const bound=(ids:readonly string[])=>ids.filter(id=>{const u=get(env,id);return u&&isSelectable(u,holder,{...env,eligibility:'bound-packet'});});
  switch(targeting.kind){
    case'bound-selection':return{targetIds:bound(env.boundTargetIds??[])};
    case'fixed':return{targetIds:bound(targeting.targetIds)};
    case'select':return{targetIds:selectTargets(targeting.selector,env)};
    case'area-around-selected':{
      const center=get(env,selectTargets(targeting.center,env)[0]);if(!center)return{targetIds:[]};
      return{centerId:center.id,targetIds:env.units.filter(u=>isSelectable(u,holder,{...env,eligibility:'area-hit'})&&(targeting.relation==='ally'?u.team===holder.team:u.team!==holder.team)&&hexDistance(u.cell,center.cell)<=targeting.radius).sort((a,b)=>compareCodePoints(a.id,b.id)).map(u=>u.id)};
    }
    case'random-enemy-center':{
      if(env.randomCenterId===undefined)throw new RangeError('Random center must be sampled before plan execution');
      const center=get(env,env.randomCenterId);if(!center)return{targetIds:[],centerId:null};
      return{centerId:center.id,targetIds:enemies({...env,eligibility:'area-hit'}).filter(u=>hexDistance(u.cell,center.cell)<=targeting.radius).map(u=>u.id)};
    }
    case'path':{
      const aim=opponents.find(u=>u.id===targeting.aimId)??(targeting.fallback==='farthest-enemy'?[...opponents].sort((a,b)=>distanceOrder(holder.cell,a,b,true))[0]:undefined);
      if(!aim)return{targetIds:[]};const cells=shortestPath(env.board,holder.cell,aim.cell);
      const members=targeting.intercept==='all-enemies'?enemies({...env,eligibility:'area-hit'}):opponents;
      let hits=cells.flatMap(c=>members.filter(u=>sameCell(u.cell,c)));
      if(targeting.intercept==='first-enemy')hits=hits.slice(0,1);
      if(targeting.hitOrder==='id')hits.sort((a,b)=>compareCodePoints(a.id,b.id));return{targetIds:hits.map(u=>u.id)};
    }
    case'round-robin':{
      const aim=opponents.find(u=>u.id===targeting.primaryId)??[...opponents].sort((a,b)=>distanceOrder(holder.cell,a,b))[0];if(!aim)return{targetIds:[]};
      const choices=[aim,...opponents.filter(u=>u.id!==aim.id&&hexDistance(u.cell,aim.cell)<=targeting.radius)];integer(targeting.ordinal);
      return{targetIds:[choices[targeting.ordinal%choices.length].id]};
    }
    case'chain':{
      const primary=opponents.find(u=>u.id===targeting.primaryId);if(!primary)return{targetIds:[]};
      const ids=[primary.id],seen=new Set(ids);let previous=primary;
      for(let n=0;n<targeting.additionalTargets;n++){
        const from=targeting.order==='nearest-previous'?previous:primary;
        const next=opponents.filter(u=>!seen.has(u.id)&&hexDistance(from.cell,u.cell)<=targeting.radius).sort((a,b)=>distanceOrder(from.cell,a,b,targeting.order==='farthest-from-primary-return-primary'))[0];
        if(!next)break;ids.push(next.id);seen.add(next.id);previous=next;
        if(targeting.order==='farthest-from-primary-return-primary')ids.push(primary.id);
      }
      return{targetIds:ids};
    }
  }
}
export const AXIAL_DIRECTIONS:readonly (readonly[number,number])[]=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const axial=(c:HexCell):readonly[number,number]=>[c.col-Math.floor(c.row/2),c.row];
export const offset=(q:number,r:number):HexCell=>({col:q+Math.floor(r/2),row:r});
export function coneCells(board:Board,origin:HexCell,primary:HexCell):HexCell[]{
  if(!contains(board,origin)||!contains(board,primary))return[];
  const [q,r]=axial(origin),dIndex=AXIAL_DIRECTIONS.findIndex(([dq,dr])=>{const c=offset(q+dq,r+dr);return contains(board,c)&&hexDistance(c,primary)<hexDistance(origin,primary);});
  if(dIndex<0)return[];
  const d=AXIAL_DIRECTIONS[dIndex],left=AXIAL_DIRECTIONS[(dIndex+5)%6],right=AXIAL_DIRECTIONS[(dIndex+1)%6],[pq,pr]=axial(primary);
  return[[d[0],d[1]],[2*d[0],2*d[1]],[d[0]+left[0],d[1]+left[1]],[d[0]+right[0],d[1]+right[1]]].map(([dq,dr])=>offset(pq+dq,pr+dr)).filter(c=>contains(board,c)&&!sameCell(c,primary));
}
export function selectConeTargets(env:TargetEnvironment):string[]{
  const holder=get(env,env.holderId),primary=get(env,env.primaryId);if(!holder||!primary)return[];
  const cells=coneCells(env.board,holder.cell,primary.cell);
  return enemies(env).filter(u=>u.id!==primary.id&&cells.some(c=>sameCell(c,u.cell))).sort((a,b)=>distanceOrder(primary.cell,a,b)).slice(0,2).map(u=>u.id);
}
