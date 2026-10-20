import { ORB_BOXES } from './content/loot';
import { ORB_RULES } from './content/orbs';
import { COMPONENT_POOL } from './component-pool';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { deriveOrbStream } from './orb-stage-plan';
import { drawIndex } from './orb-layout';
import type { LootPayload, RngStream } from './m8/contracts';

/** Each orb owns its full cursor. No caller-owned stream is read or advanced. */
export function sampleOrbBox(seed:number,orbId:string,templateId:string):{payloads:LootPayload[];rng:RngStream;rowId:string} {
  let rng=deriveOrbStream(ORB_RULES.boxStream,seed,orbId);
  const draw=(size:number)=>{const r=drawIndex(rng,size);rng=r.rng;return r.index;};
  if(templateId==='component')return {payloads:[{kind:'item',definitionId:COMPONENT_POOL[draw(COMPONENT_POOL.length)].definitionId,quantity:1}],rng,rowId:'component'};
  if(!Object.hasOwn(ORB_BOXES,templateId))throw new RangeError('Invalid orb template');
  const rows=ORB_BOXES[templateId as keyof typeof ORB_BOXES];let index=draw(100);
  const row=rows.find(r=>{if(index<r.weight)return true;index-=r.weight;return false;});
  if(!row)throw new RangeError('Invalid orb box weights');
  const payloads=row.rewards.map((atom):LootPayload=>{
    if(atom.kind!=='hero')return atom;
    const pool=SHOP_CATALOG_BY_COST[atom.cost];
    return {kind:'unit',definitionId:pool[draw(pool.length)],quantity:1,...(atom.starLevel?{starLevel:atom.starLevel}:{})};
  });
  return {payloads,rng,rowId:row.id};
}
