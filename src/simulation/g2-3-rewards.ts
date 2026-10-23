import { familyTaskAt } from './family-heist';
import {canonicalContent} from './content';
import {freezeContent} from './content/freeze';
import {G23_POLICY,G23_CONQUEROR_CHESTS,G23_BLACK_MARKETS,g23ConquerorReward} from './content/g2-3-policy';
import {G24_FORGE_POLICY,resolveG24ForgePool} from './content/g2-4-forges';
import {G23_SPECIAL_ITEM_POOLS,G23_RADIANT_MAPPING} from './content/g2-3-special-item-runtime';
import {ITEM_DEFINITIONS} from './content/g2-3-item-registry';
import {M5_UNIT_DEFINITIONS} from './units';
import {SHOP_CATALOG_BY_COST} from './match-rules';
import {nextRandom} from './rng';
import type {G23RewardBundle} from './g2-3-economy';
export interface G23RewardAtom {readonly id:string;readonly kind:'unit'|'item'|'tool'|'gold'|'duplicator';readonly options:readonly string[];readonly quantity:number;readonly gold:number;readonly starLevel?:1|2|3;readonly duplicatorDefinitionId?:keyof typeof G23_POLICY.duplicators}
export interface G23RewardClaim {readonly id:string;readonly bundleId:string;readonly atomId:string;readonly copy:number;readonly round:number;readonly kind:G23RewardAtom['kind'];readonly definitionId:string;readonly instanceId:string|null;readonly gold:number}
const apiUnits:Readonly<Record<string,string>>={TFT13_Lieutenant:'sevika',TFT13_Chainsaw:'renni',TFT13_Gremlin:'smeech',TFT13_RenataGlasc:'renata',TFT13_Singed:'singed',TFT13_Silco:'silco'};
const components=Object.values(ITEM_DEFINITIONS).filter(i=>i.kind==='component'&&!i.craftingOnly).map(i=>i.id).sort();
export function sampleG24Reward(pool:readonly string[],seedText:string,n:number):readonly string[]{
 if(!pool.length)throw new RangeError('Empty G23 reward pool');
 let seed=0x67323372;for(const c of seedText)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
 const remaining=[...pool].sort(),out:string[]=[];
 for(let i=0;i<n&&remaining.length;i++){const draw=nextRandom(seed);seed=draw.state;out.push(...remaining.splice(Math.floor(draw.word*remaining.length/2**32),1));}return out;
}
/** Source reward descriptors stay intact; only unresolved choices/bench overflow remain in escrow.
 * 约定值: four distinct anvil choices (user 2026-10-17), and one ordinary component/chemtech roll per item key. */
const atomCache=new Map<string,readonly G23RewardAtom[]>();
// Atom indices seed every draw. Read descriptor order from the admitted source,
// never from a caller/save's object insertion order (canonical JSON sorts keys).
// Conqueror policy deliberately moves tier 4's duplicator after its hero.
/** Admit the entire descriptor against its frozen tier before any atom allocation.
 * Pure preview callers may include chest gold; persisted bundles exclude paid gold. */
function frozenReward(bundle:G23RewardBundle):Readonly<Record<string,unknown>>{
 const candidates=bundle.source==='conqueror'&&Number.isInteger(bundle.tier)
  ?G23_CONQUEROR_CHESTS.filter(c=>c.tier===bundle.tier).flatMap(c=>{
   const full=g23ConquerorReward(c),{Gold:_paid,...escrow}=full;return [full,escrow];
  })
  :bundle.source==='black-market'&&Number.isInteger(bundle.tier)
   ?G23_BLACK_MARKETS.filter(m=>m.tier===bundle.tier).flatMap(m=>m.options.map(o=>o.reward)):[];
 const admitted=candidates.find(reward=>canonicalContent(reward)===canonicalContent(bundle.reward));
 if(!admitted)throw new RangeError('Invalid G23 frozen reward descriptor');
 return admitted;
}
export function g23RewardAtoms(bundle:G23RewardBundle,seed:number,multiplayer=false):readonly G23RewardAtom[]{
 if(bundle.source==='family'){
  const task=familyTaskAt(seed,bundle.tier);if(bundle.id!==`family:orb:${bundle.tier}`||canonicalContent(bundle.reward)!==canonicalContent({payloads:task.payloads}))throw new RangeError('Invalid frozen family reward');
  return task.payloads.map((p,i)=>({id:bundle.id+':atom:'+i,kind:p.kind==='consumable'?'tool':p.kind==='forge'?'item':p.kind,options:p.kind==='gold'?[]:[p.definitionId],quantity:1,gold:p.kind==='gold'?p.quantity:0,...(p.kind==='unit'?{starLevel:p.starLevel??1}:{})}));
 }
 const reward=frozenReward(bundle);
 if(bundle.concreteItems!==undefined&&(bundle.source!=='black-market'||!Array.isArray(bundle.concreteItems)
  ||new Set(bundle.concreteItems.map(i=>i.atomId)).size!==bundle.concreteItems.length
  ||bundle.concreteItems.some(i=>Object.keys(i).sort().join(',')!=='atomId,definitionId'||typeof i.atomId!=='string'||typeof i.definitionId!=='string')))
  throw new RangeError('Invalid G23 concrete equipment');
 const key=canonicalContent([seed,bundle,multiplayer]),cached=atomCache.get(key);if(cached)return cached;
 const out:G23RewardAtom[]=[],add=(kind:G23RewardAtom['kind'],pool:readonly string[],quantity=1,gold=0,choices=1,duplicatorDefinitionId?:G23RewardAtom['duplicatorDefinitionId'])=>{
 const id=`${bundle.id}:atom:${out.length}`;
 const concrete=kind==='item'&&choices===1&&bundle.concreteItems!==undefined;
 const stored=concrete?bundle.concreteItems!.find(i=>i.atomId===id):undefined;
 if(concrete&&(!stored||!pool.includes(stored.definitionId)))throw new RangeError('Invalid G23 concrete equipment');
 out.push({id,kind,options:kind==='gold'?[]:concrete?[stored!.definitionId]:sampleG24Reward(pool,`${seed}:${id}`,choices),quantity,gold,...(duplicatorDefinitionId?{duplicatorDefinitionId}:{})});
 };
 const item=(api:string)=>{
  if(Object.hasOwn(G23_POLICY.duplicators,api)){
   const rule=G23_POLICY.duplicators[api as keyof typeof G23_POLICY.duplicators];
   add('duplicator',Object.values(M5_UNIT_DEFINITIONS).filter(u=>(rule.maxCost===null||u.cost<=rule.maxCost)
    &&(rule.traitId===null||u.traits.includes(rule.traitId))).map(u=>u.id),1,0,60,api as G23RewardAtom['duplicatorDefinitionId']);return;
  }
  if(api==='TFT_Consumable_ItemRemover'){add('tool',['magnetic-remover']);return;}
  if(api==='TFT_Consumable_ItemReroller'){add('tool',['reforger']);return;}
  if(api==='COMPONENT_NOSPAT'){add('item',components);return;}
  const pools=G23_SPECIAL_ITEM_POOLS as Readonly<Record<string,readonly string[]>>;
  if(pools[api]){add('item',pools[api].filter(id=>api!=='RADIANTITEMS_SET5'||!G23_POLICY.conqueror.radiantPoolExclusions.includes(id)));return;}
  const definition=Object.values(ITEM_DEFINITIONS).find(i=>i.apiName===api);
  if(!definition)throw new RangeError('Unadmitted G23 item '+api);add('item',[definition.id]);
 };
 for(const key of Object.keys(reward)){
  const value=reward[key];
  const list=()=>{if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new RangeError('Invalid G23 reward list');return value as string[];};
  if(key==='PlayerBuff')continue; // Tier15 conversion is a permanent progress flag, never an inventory object.
  if(key==='Gold'){add('gold',[],1,value as number);continue;}
  if(key==='GoldItems'){for(const api of list())add('gold',[],1,Number(api.slice(api.lastIndexOf('_')+1)));continue;}
  if(key==='Remover'){add('tool',['magnetic-remover'],value as number);continue;}
  if(['Item','ExactItem','ItemByKey'].includes(key)){for(const api of list())item(api);continue;}
  if(key==='Consumables'){for(const api of list())item(api);continue;}
  if(key==='MeepTypeUnit'){
   for(const api of list())add('item',resolveG24ForgePool(api),1,0,G24_FORGE_POLICY.choices);continue;
  }
  if(key==='TwoStarUnit'){for(const cost of list())add('unit',SHOP_CATALOG_BY_COST[cost==='TwoCostUnit'?2:5],3);continue;}
  if(['ThreeCostUnit','FourCostUnit','FiveCostUnit'].includes(key)){for(let n=0;n<(value as number);n++)add('unit',SHOP_CATALOG_BY_COST[key==='ThreeCostUnit'?3:key==='FourCostUnit'?4:5]);continue;}
  if(key.startsWith('Champions')){const copies=key.includes('3Star')?9:key.includes('2Star')?3:1;for(const api of list()){if(!apiUnits[api])throw new RangeError('Unmapped G23 champion '+api);add('unit',[apiUnits[api]],copies);}continue;}
  throw new RangeError('Unimplemented G23 reward descriptor '+key);
 }
 if(bundle.concreteItems!==undefined&&bundle.concreteItems.length!==out.filter(a=>a.kind==='item'&&a.options.length===1).length)
  throw new RangeError('Invalid G23 concrete equipment');
 if(multiplayer) for(let i=0;i<out.length;i++) {
  const atom=out[i];
  if(atom.kind==='unit' && (atom.quantity===3||atom.quantity===9)) out[i]={...atom,quantity:1,starLevel:atom.quantity===3?2:3};
 }
 if(atomCache.size>=128)atomCache.delete(atomCache.keys().next().value!);
 const result=freezeContent(out);atomCache.set(key,result);return result;
}
export function g23RadiantDefinitionId(id:string):string|undefined{return (G23_RADIANT_MAPPING as Readonly<Record<string,string>>)[id];}
