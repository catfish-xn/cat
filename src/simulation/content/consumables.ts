import { freezeContent } from './freeze';
import { ITEM_DEFINITIONS } from './items';
import { EMBLEM_REFORGE_SOURCE } from './emblem-source';
import { G24_FORGE_POOLS } from './g2-4-forges';
import { G23_RADIANT_MAPPING } from './g2-3-special-item-runtime';
export const CONSUMABLE_DEFINITIONS = freezeContent({
  'magnetic-remover':{id:'magnetic-remover',apiName:'TFT_Consumable_ItemRemover',effect:'remove-all',target:'unit',targetKind:'unit',name:'装备拆卸器',description:'拆下己方单位的全部永久装备，保留原物品并放回库存；战斗中使用下场生效。'},
  'masterwork-upgrade':{id:'masterwork-upgrade',apiName:'TFT_Consumable_MasterworkUpgrade',effect:'masterwork-upgrade',target:'unit',targetKind:'unit',name:'杰作升级',description:'选择己方弈子携带的一件可合成成装，升级为对应光明版并卸下。'},
  reforger:{id:'reforger',apiName:'TFT_Consumable_ItemReroller',effect:'reforge-all',target:'unit',targetKind:'unit',name:'装备重铸器',description:'拆下己方单位全部永久装备，每件随机重铸为同类别的另一件并放入库存；无其他候选则原样退回。'},
  TFT_Consumable_ChampionDuplicator_III:{id:'TFT_Consumable_ChampionDuplicator_III',apiName:'TFT_Consumable_ChampionDuplicator_III',effect:'duplicate-unit',target:'unit',targetKind:'unit',name:'次级英雄复制器',maxCost:3,description:'复制一名己方至多3费英雄，获得一张1星英雄；无空位时不消耗。'},
  TFT_Consumable_NeekosHelp:{id:'TFT_Consumable_NeekosHelp',apiName:'TFT_Consumable_NeekosHelp',effect:'duplicate-unit',target:'unit',targetKind:'unit',name:'英雄复制器',maxCost:null,description:'复制一名己方任意费用英雄，获得一张1星英雄；无空位时不消耗。'},
} as const);
export const CONSUMABLE_RULES = freezeContent({version:'s13-consumables-project-v16',reforge:'s13-reforge-all-v16',seedXor:0x52454647,
  phases:['preparation','combat','choice','settlement'],excludeOriginal:true,destination:'inventory',quantity:1,
  remover:'all-permanent-original-ids',currentBattle:false,
  pveRemover:{source:'original-14.23-onward',quantity:1,definitionId:'magnetic-remover',
    timing:'after-settlement-if-alive',receiptSource:'pve-remover',receiptPrefix:'pve-remover:',independentOfOrbLoot:true}} as const);
const pool=(kind:'component'|'completed')=>Object.values(ITEM_DEFINITIONS).filter(d=>d.kind===kind)
  .sort((a,b)=>a.apiName!<b.apiName! ? -1 : a.apiName!>b.apiName! ? 1 : 0)
  .map(d=>({apiName:d.apiName!,definitionId:d.id}));
const entries=(ids:readonly string[])=>[...ids].sort().map(definitionId=>({apiName:definitionId,definitionId}));
export const REFORGE_POOLS=freezeContent({component:pool('component'),completed:pool('completed'),
  radiant:entries(Object.values(G23_RADIANT_MAPPING)),artifact:entries(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn),
  support:entries(G24_FORGE_POOLS.TFT_ArmoryKeySupport),emblem:entries(EMBLEM_REFORGE_SOURCE)});
if (REFORGE_POOLS.component.length!==8 || REFORGE_POOLS.completed.length!==36) throw new RangeError('Invalid ordinary reforge pool');
