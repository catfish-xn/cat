import { contains, getNeighbors, hexDistance, sameCell, type Board, type HexCell } from '../board';
import type { Effect, Source } from './contracts';
import { axial, offset, type TargetUnit } from './targeting';
import { canonicalSource, compareCodePoints } from './identity';
export interface OpeningUnit extends TargetUnit { readonly controlled?: boolean }
export type OpeningDefinition = { readonly kind: 'backline-jump'; readonly source: Source }
  | { readonly kind: 'path-charge'; readonly source: Source; readonly effects: readonly Extract<Effect,{kind:'damage'|'apply-status'}>[] };
export interface OpeningTask { readonly key: string; readonly source: Source; readonly executeAtTick: 1; readonly status: 'pending'|'executed'|'cancelled'; readonly targetIds: readonly string[]; readonly effects: readonly Effect[] }
export interface OpeningPlan {
  readonly key: string; readonly source: Source; readonly kind: OpeningDefinition['kind']; readonly from: HexCell; readonly to: HexCell;
  readonly aimId: string | null; readonly path: readonly HexCell[]; readonly targetIds: readonly string[]; readonly consumed: true;
  readonly result: 'moved'|'no-target'|'blocked'|'no-space'; readonly task: OpeningTask | null;
}
export interface OpeningState { readonly combatId: string; readonly initialUnits: readonly OpeningUnit[]; readonly plans: readonly OpeningPlan[]; readonly committed: boolean }
const cellKey=(c:HexCell)=>JSON.stringify([c.col,c.row]);
export function planOpening(combatId:string,board:Board,units:readonly OpeningUnit[],definitions:readonly OpeningDefinition[]):OpeningState{
  const initialUnits=units.map(u=>({id:u.id,team:u.team,cell:{...u.cell},hp:u.hp,maxHp:u.maxHp,alive:u.alive,untargetable:!!u.untargetable,controlled:!!u.controlled})).sort((a,b)=>compareCodePoints(a.id,b.id));
  if(new Set(initialUnits.map(u=>u.id)).size!==units.length || new Set(initialUnits.filter(u=>u.alive).map(u=>cellKey(u.cell))).size!==initialUnits.filter(u=>u.alive).length)throw new RangeError('Invalid opening occupancy');
  const occupied=new Set(initialUnits.filter(u=>u.alive).map(u=>cellKey(u.cell))),reserved=new Set<string>(),owners=new Set<string>();
  const plans:OpeningPlan[]=[];
  for(const d of [...definitions].sort((a,b)=>compareCodePoints(a.source.ownerId,b.source.ownerId)||compareCodePoints(canonicalSource(a.source),canonicalSource(b.source)))){
    const holder=initialUnits.find(u=>u.id===d.source.ownerId);if(!holder||owners.has(holder.id))throw new RangeError('Invalid opening owner');owners.add(holder.id);
    const key=JSON.stringify([combatId,'opening',canonicalSource(d.source)]);
    const plan:OpeningPlan={key,source:d.source,kind:d.kind,from:holder.cell,to:holder.cell,aimId:null,path:[],targetIds:[],consumed:true,result:'no-target',task:null};
    if(!holder.alive||holder.controlled){plans.push({...plan,result:'blocked'});continue;}
    const enemies=initialUnits.filter(u=>u.alive&&u.hp>0&&u.team!==holder.team&&!u.untargetable&&contains(board,u.cell)).sort((a,b)=>hexDistance(holder.cell,b.cell)-hexDistance(holder.cell,a.cell)||compareCodePoints(a.id,b.id));
    if(!enemies.length){plans.push(plan);continue;}
    const free=(c:HexCell)=>contains(board,c)&&!occupied.has(cellKey(c))&&!reserved.has(cellKey(c));
    if(d.kind==='backline-jump'){
      let chosen:OpeningPlan|undefined;
      for(const enemy of enemies){
        const to=getNeighbors(board,enemy.cell).filter(free).sort((a,b)=>(holder.team==='enemy'?b.row-a.row:a.row-b.row)||hexDistance(holder.cell,a)-hexDistance(holder.cell,b)||a.col-b.col||a.row-b.row)[0];
        if(to){chosen={...plan,to,aimId:enemy.id,result:'moved'};reserved.add(cellKey(to));break;}
      }
      plans.push(chosen??{...plan,aimId:enemies[0].id,result:'no-space'});continue;
    }
    const aim=enemies[0],path:HexCell[]=[];let reached=false;let at=holder.cell,direction:readonly[number,number]|undefined;
    for(let step=0;step<4;step++){
      const [q,r]=axial(at); if (sameCell(at,aim.cell)) reached=true;
      const next=reached
        ? direction?offset(q+direction[0],r+direction[1]):undefined
        : getNeighbors(board,at).find(c=>hexDistance(c,aim.cell)<hexDistance(at,aim.cell));
      if(!next||!contains(board,next))break;
      const [nq,nr]=axial(next);direction=[nq-q,nr-r];path.push(next);at=next;
    }
    const last=path.map((c,index)=>free(c)?index:-1).reduce((a,b)=>Math.max(a,b),-1);
    if(last<0){plans.push({...plan,aimId:aim.id,result:'no-space'});continue;}
    const truncated=path.slice(0,last+1),to=truncated[truncated.length-1];reserved.add(cellKey(to));
    const targetIds=truncated.flatMap(c=>enemies.filter(u=>sameCell(u.cell,c)).map(u=>u.id));
    const task:OpeningTask={key:JSON.stringify([key,'damage']),source:d.source,executeAtTick:1,status:'pending',targetIds,effects:d.effects};
    plans.push({...plan,to,aimId:aim.id,path:truncated,targetIds,result:'moved',task});
  }
  return{combatId,initialUnits,plans,committed:false};
}
export function commitOpening<T extends OpeningUnit>(state:OpeningState,units:readonly T[]):{state:OpeningState;units:T[];movements:{type:'movement';tick:0;unitId:string;from:HexCell;to:HexCell}[]}{
  if(state.committed)return{state,units:[...units],movements:[]};
  const movements=state.plans.filter(p=>p.result==='moved').map(p=>({type:'movement' as const,tick:0 as const,unitId:p.source.ownerId,from:p.from,to:p.to}));
  const next=units.map(u=>{const movement=movements.find(m=>m.unitId===u.id);if(movement&&!sameCell(u.cell,movement.from))throw new RangeError('Opening snapshot changed');return movement?{...u,cell:{...movement.to}}:u;});
  return{state:{...state,committed:true},units:next,movements};
}
export function advanceOpeningTasks(state:OpeningState,tick:number,units:readonly OpeningUnit[]):{state:OpeningState;ready:OpeningTask[]}{
  const ready:OpeningTask[]=[];
  const plans=state.plans.map(p=>{
    const task=p.task;if(!task||task.status!=='pending'||task.executeAtTick>tick)return p;
    if(!state.committed)throw new RangeError('Uncommitted opening task');
    const owner=units.find(u=>u.id===task.source.ownerId),status=!owner?.alive||owner.hp<=0||owner.controlled?'cancelled' as const:'executed' as const;
    const next={...task,status};if(status==='executed')ready.push(next);return{...p,task:next};
  });
  return{state:{...state,plans},ready};
}
export function validateOpeningState(state:OpeningState,combatId:string,board:Board,definitions:readonly OpeningDefinition[],trustedInitial:readonly OpeningUnit[]=state.initialUnits):void{
  if(state.combatId!==combatId||typeof state.committed!=='boolean')throw new RangeError('Invalid opening namespace/commit');
  const expected=planOpening(combatId,board,trustedInitial,definitions);
  const normalized={...state,committed:false,plans:state.plans.map(p=>{
    if(p.task&&!['pending','executed','cancelled'].includes(p.task.status))throw new RangeError('Invalid opening task status');
    if(!state.committed&&p.task?.status!=='pending'&&p.task!==null)throw new RangeError('Uncommitted task consumed');
    return{...p,task:p.task?{...p.task,status:'pending'}:null};
  })};
  if(JSON.stringify(normalized)!==JSON.stringify(expected))throw new RangeError('Invalid frozen opening plan');
}
