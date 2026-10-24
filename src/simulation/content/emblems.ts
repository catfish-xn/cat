import type { Effect, ItemDefinition } from '../strategy-types';
import { V19_EMBLEM_VALUES } from './v19-emblems';
import { periodic, mana, modifier } from './item-programs';
import { EMBLEM_SOURCE } from './emblem-source';
import { freezeContent } from './freeze';

const names: Readonly<Record<string,string>> = {
  ambusher:'伏击专家', rebel:'蓝发小队', enforcer:'执法官', sorcerer:'法师', academy:'皮城学院',
  'black-rose':'黑色玫瑰', experiment:'试验品', bruiser:'格斗家', automata:'海克斯机械', artillerist:'炮手',
  dominator:'统领', 'chem-baron':'炼金男爵', scrap:'极客', firelight:'野火帮', conqueror:'铁血征服者',
  quickstriker:'迅击战士', sentinel:'哨兵', sniper:'狙神', 'pit-fighter':'搏击手', visionary:'先知', family:'家人', watcher:'监察',
};

/** Crafting inputs are excluded from ordinary component anvils/random component draws. */
export const CRAFTING_ITEMS: Readonly<Record<string, ItemDefinition>> = freezeContent(Object.fromEntries([
  ['spatula', 'TFT_Item_Spatula', '金铲铲'], ['frying-pan', 'TFT_Item_FryingPan', '金锅铲'],
].map(([id, apiName, name]) => [id, { id, apiName, name, kind: 'component', unique: false, slotCost: 1,
  effects: [], combatProgram: {}, evidenceStatus: 'source-reviewed', craftingOnly: true }])));

export const EMBLEM_ITEMS: Readonly<Record<string, ItemDefinition>> = freezeContent(Object.fromEntries(EMBLEM_SOURCE.map(row => {
  const v: Readonly<Record<string, number | undefined>> = V19_EMBLEM_VALUES[row.traitId], effects: Effect[] = [];
  for (const [key, stat] of [['Health','maxHp'], ['AP','abilityPower'], ['Armor','armor'], ['MagicResist','magicResist'], ['Mana','initialMana']] as const)
    if (v[key]) effects.push({kind:'statFlat',stat,amount:v[key]});
  if (v.AD) effects.push({kind:'statPercentBps',stat:'attackDamage',bps:Math.round(v.AD*10000)});
  if (v.AS) effects.push({kind:'attackSpeedBps',bps:v.AS*100});
  return [row.apiName, {id:row.apiName, apiName:row.apiName, name:names[row.traitId]+'纹章', kind:'completed',
    emblemTrait:row.traitId, restriction:{kind:'exclude-trait',traitId:row.traitId}, unique:true, slotCost:1, effects,
    ...(row.recipe.length ? {recipe:row.recipe as [string,string]} : {}),
    combatProgram:{modifiers:[...(v.CritChance ? [modifier('critChance',v.CritChance*100,'bps')] : []),
      ...(v.CritDamage ? [modifier('critMultiplier',v.CritDamage*100,'bps')] : []),
      ...(v.RangeIncrease ? [modifier('range',v.RangeIncrease,'hexes')] : [])],...(v.ManaPerSecond?{periodic:[periodic(20,[mana(v.ManaPerSecond,'periodic')])]}:{})},
    evidenceStatus:'approved-provisional', conventionIds:['V19-EMBLEM-CUSTOM'], effectDescriptions:[...(v.ManaPerSecond?[`每秒回复 ${v.ManaPerSecond} 法力。`]:[]),...(v.CritChance?[`暴击率 +${v.CritChance} 个百分点。`]:[]),...(v.CritDamage?[`暴击伤害 +${v.CritDamage} 个百分点。`]:[]),...(v.RangeIncrease?[`射程 +${v.RangeIncrease} 格。`]:[]),`携带者获得${names[row.traitId]}羁绊。`,
      ...(row.traitId==='experiment' ? ['【试验品】加成：站在试验格上时，试验格上的试验品在 8 秒后或阵亡时（先到者，一次）召唤自身复制体，生命为其开战最大生命的 69%/78%/90%（3/5/7 档）。'] : [])]} satisfies ItemDefinition];
})));
