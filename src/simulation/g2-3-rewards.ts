import {canonicalContent} from './content';
import {freezeContent} from './content/freeze';
import {G23_POLICY} from './content/g2-3-policy';
import {G23_SPECIAL_ITEM_POOLS,G23_RADIANT_MAPPING} from './content/g2-3-special-item-source';
import {ITEM_DEFINITIONS} from './content/g2-3-item-registry';
import {M5_UNIT_DEFINITIONS} from './units';
import {SHOP_CATALOG_BY_COST} from './match-rules';
import {nextRandom} from './rng';
import type {G23RewardBundle} from './g2-3-economy';
export interface G23RewardAtom {readonly id:string;readonly kind:'unit'|'item'|'tool'|'gold'|'duplicator';readonly options:readonly string[];readonly quantity:number;readonly gold:number}
export interface G23RewardClaim {readonly id:string;readonly bundleId:string;readonly atomId:string;readonly copy:number;readonly round:number;readonly kind:G23RewardAtom['kind'];readonly definitionId:string;readonly instanceId:string|null;readonly gold:number}
const apiUnits:Readonly<Record<string,string>>={TFT13_Lieutenant:'sevika',TFT13_Chainsaw:'renni',TFT13_Gremlin:'smeech',TFT13_RenataGlasc:'renata',TFT13_Singed:'singed',TFT13_Silco:'silco'};
const ordinary=Object.values(ITEM_DEFINITIONS).filter(i=>i.kind==='completed'&&i.recipe).map(i=>i.id).sort(),components=Object.values(ITEM_DEFINITIONS).filter(i=>i.kind==='component').map(i=>i.id).sort();
function sample(pool:readonly string[],seedText:string,n:number):readonly string[]{
 if(!pool.length)throw new RangeError('Empty G23 reward pool');
 let seed=0x67323372;for(const c of seedText)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 const remaining=[...pool].sort(),out:string[]=[];
 for(let i=0;i<n&&remaining.length;i++){const draw=nextRandom(seed);seed=draw.state;out.push(...remaining.splice(Math.floor(draw.word*remaining.length/2**32),1));}return out;
}
/** Source reward descriptors stay intact; only unresolved choices/bench overflow remain in escrow.
 * 约定值: three distinct anvil choices, and one ordinary component/chemtech roll per item key. */
const atomCache=new Map<string,readonly G23RewardAtom[]>();
export function g23RewardAtoms(bundle:G23RewardBundle,seed:number):readonly G23RewardAtom[]{
 const key=canonicalContent([seed,bundle]),cached=atomCache.get(key);if(cached)return cached;
 const out:G23RewardAtom[]=[],add=(kind:G23RewardAtom['kind'],pool:readonly string[],quantity=1,gold=0,choices=1)=>{
 const id=`${bundle.id}:atom:${out.length}`;out.push({id,kind,options:kind==='gold'?[]:sample(pool,`${seed}:${id}`,choices),quantity,gold});
 };
 const item=(api:string)=>{
  if(api==='TFT_Consumable_ChampionDuplicator_III'){add('duplicator',Object.values(M5_UNIT_DEFINITIONS).filter(u=>u.cost<=3).map(u=>u.id),1,0,60);return;}
  if(api==='TFT_Consumable_ItemRemover'){add('tool',['magnetic-remover']);return;}
  if(api==='TFT_Consumable_ItemReroller'){add('tool',['completed-reforger']);return;}
  if(api==='COMPONENT_NOSPAT'){add('item',components);return;}
  const pools=G23_SPECIAL_ITEM_POOLS as Readonly<Record<string,readonly string[]>>;
  if(pools[api]){add('item',pools[api].filter(id=>api!=='RADIANTITEMS_SET5'||!G23_POLICY.conqueror.radiantPoolExclusions.includes(id)));return;}
  const definition=Object.values(ITEM_DEFINITIONS).find(i=>i.apiName===api);
  if(!definition)throw new RangeError('Unadmitted G23 item '+api);add('item',[definition.id]);
 };
 for(const [key,value] of Object.entries(bundle.reward)){
  const list=()=>{if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new RangeError('Invalid G23 reward list');return value as string[];};
  if(key==='PlayerBuff')continue; // Tier15 conversion is a permanent progress flag, never an inventory object.
  if(key==='Gold'){add('gold',[],1,value as number);continue;}
  if(key==='GoldItems'){for(const api of list())add('gold',[],1,Number(api.slice(api.lastIndexOf('_')+1)));continue;}
  if(key==='Remover'){add('tool',['magnetic-remover'],value as number);continue;}
  if(['Item','ExactItem','ItemByKey'].includes(key)){for(const api of list())item(api);continue;}
  if(key==='Consumables'){for(const _ of list()){void _;add('duplicator',Object.values(M5_UNIT_DEFINITIONS).filter(u=>u.cost<=3).map(u=>u.id),1,0,60);}continue;}
  if(key==='MeepTypeUnit'){
   for(const api of list())add('item',api==='TFT_ArmoryKeyCompleted'?ordinary:api==='TFT_ArmoryKeyOrnn'?G23_SPECIAL_ITEM_POOLS.ORNNARTIFACTS_SET6:G23_SPECIAL_ITEM_POOLS.SUPPORTITEMS,1,0,3);continue;
  }
  if(key==='TwoStarUnit'){for(const cost of list())add('unit',SHOP_CATALOG_BY_COST[cost==='TwoCostUnit'?2:5],3);continue;}
  if(['ThreeCostUnit','FourCostUnit','FiveCostUnit'].includes(key)){for(let n=0;n<(value as number);n++)add('unit',SHOP_CATALOG_BY_COST[key==='ThreeCostUnit'?3:key==='FourCostUnit'?4:5]);continue;}
  if(key.startsWith('Champions')){const copies=key.includes('3Star')?9:key.includes('2Star')?3:1;for(const api of list()){if(!apiUnits[api])throw new RangeError('Unmapped G23 champion '+api);add('unit',[apiUnits[api]],copies);}continue;}
  throw new RangeError('Unimplemented G23 reward descriptor '+key);
 }
 if(atomCache.size>=128)atomCache.delete(atomCache.keys().next().value!);
 const result=freezeContent(out);atomCache.set(key,result);return result;
}
export function g23RadiantDefinitionId(id:string):string|undefined{return (G23_RADIANT_MAPPING as Readonly<Record<string,string>>)[id];}
