import { UNIT_DEFINITIONS } from './units';
import { nextRandom } from './rng';
import { d11OpeningSeed } from './d11-fill';
import type { Unit } from './unit-types';
import type { OwnedAugment } from './strategy-types';

/** Deterministic, independent opening stream: rebuilding a frozen snapshot never consumes live RNG. */
export function moonlightSelection(board:readonly Unit[], augments:readonly OwnedAugment[], round:number, seed:number, stars:ReadonlyMap<string,number>):ReadonlyMap<string,{star:3|4;definitionId:string;choiceId:string;adBps:number;ap:number}> {
 const selected=new Map<string,{star:3|4;definitionId:string;choiceId:string;adBps:number;ap:number}>();
 for(const [id,star,adBps,ap] of [['greater-moonlight',4,500,5],['moonlight',3,2500,25]] as const){
  const a=augments.find(x=>x.definitionId===id);if(!a)continue;
  const candidates=board.filter(u=>u.team==='player'&&u.location.kind==='board'&&UNIT_DEFINITIONS[u.definitionId]?.cost===1&&!UNIT_DEFINITIONS[u.definitionId].summon&&UNIT_DEFINITIONS[u.definitionId].unitKind!=='neutral'&&(selected.get(u.id)?.star??stars.get(u.id)??u.starLevel)<star).sort((x,y)=>x.id<y.id?-1:x.id>y.id?1:0);
  if(!candidates.length)continue;
  const word=nextRandom(d11OpeningSeed(seed,round,a.choiceId+':'+id)).word;
  const unit=candidates[Math.floor(word*candidates.length/4294967296)];selected.set(unit.id,{star,definitionId:id,choiceId:a.choiceId,adBps,ap});
 }
 return selected;
}
