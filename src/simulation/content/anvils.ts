import { freezeContent } from './freeze';
import type { UnitDefinition } from '../unit-types';
/** 14.24 client TftShopData / SellOverwriteTra; approved 2026-10-23. */
export const ANVIL_KINDS = freezeContent({TFT_ArmoryKeyCompleted:'成装',TFT_ArmoryKeyComponent:'基础装备',TFT_ArmoryKeyOrnn:'神器装备',TFT_ArmoryKeySupport:'辅助装'});
export type AnvilDefinitionId = keyof typeof ANVIL_KINDS;
export const isAnvil = (id:string):id is AnvilDefinitionId => Object.hasOwn(ANVIL_KINDS,id);
export const ANVIL_POLICY = freezeContent({version:'anvil-units-v2',choices:4,timeoutMs:30000,benchOnly:true,sellGold:0,component47:{roundId:'4-7',definitionId:'TFT_ArmoryKeyComponent',quantity:1,placement:'append-first-orb',rngDraws:0} as const});
export function anvilDisplay(id:string) {
  if(!isAnvil(id))return undefined;
  const kind=ANVIL_KINDS[id];
  return {kind:id,name:`${kind}锻造器`,sellText:`开启一个由${kind}组成的武器库`,description:`将此物拖拽至商店，即可打开一个满是${kind}的武器库！你将有30秒时间来进行选择。`,timeoutMs:ANVIL_POLICY.timeoutMs,sellGold:0};
}
export const ANVIL_UNITS:Readonly<Record<string,UnitDefinition>> = freezeContent(Object.fromEntries(Object.keys(ANVIL_KINDS).map(id=>[id,{
 id,name:anvilDisplay(id)!.name,symbol:'锻',color:0,cost:1,summon:{sellable:true,countsTowardPopulation:false},
 baseStats:{health:1,attack:0,armor:0,magicResist:0},attackRange:1,attackIntervalTicks:20,initialMana:0,maxMana:1,abilityId:'sentinel-guard',traits:[],
}])));
