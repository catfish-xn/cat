import { freezeContent } from './freeze';
import { ITEM_DEFINITIONS } from './items';
export const CONSUMABLE_DEFINITIONS = freezeContent({
  'magnetic-remover':{id:'magnetic-remover',effect:'remove-all',target:'unit',targetKind:'unit',name:'拆卸器',description:'拆下己方单位的全部永久装备，保留原物品并放回库存；战斗中使用下场生效。'},
  'component-reforger':{id:'component-reforger',effect:'reforge-component',target:'item',targetKind:'item',name:'组件重铸器',description:'消耗一件永久普通组件，随机获得一件不同的普通组件并放入库存。'},
  'completed-reforger':{id:'completed-reforger',effect:'reforge-completed',target:'item',targetKind:'item',name:'成装重铸器',description:'消耗一件永久普通成装，随机获得一件不同的普通成装并放入库存；不包含临时装备。'},
} as const);
export const CONSUMABLE_RULES = freezeContent({version:'s13-consumables-project-v1',reforge:'s13-reforge-v1',seedXor:0x52454647,
  phases:['preparation','combat','choice','settlement'],excludeOriginal:true,destination:'inventory',quantity:1,
  remover:'all-permanent-original-ids',currentBattle:false});
const pool=(kind:'component'|'completed')=>Object.values(ITEM_DEFINITIONS).filter(d=>d.kind===kind)
  .sort((a,b)=>a.apiName!<b.apiName! ? -1 : a.apiName!>b.apiName! ? 1 : 0)
  .map(d=>({apiName:d.apiName!,definitionId:d.id}));
export const REFORGE_POOLS=freezeContent({component:pool('component'),completed:pool('completed')});
if (REFORGE_POOLS.component.length!==8 || REFORGE_POOLS.completed.length!==36) throw new RangeError('Invalid ordinary reforge pool');
