import {g23RadiantProgram} from './g2-3-radiant-programs';
import {ITEM_DEFINITIONS as ORDINARY} from './items';
import {G23_SPECIAL_ITEM_SOURCE,G23_RADIANT_MAPPING} from './g2-3-special-item-source';
import type {Effect,ItemDefinition} from '../strategy-types';
import type {ItemProgram} from '../m8/item-program';
import {modifier,periodic,stat,trigger,shield,survival,vamp,amount} from './item-programs';
import {freezeContent} from './freeze';
/** 约定值: reward-only special items execute a finite subset; archived text is not an execution claim. */
export const G23_SPECIAL_ITEMS:Readonly<Record<string,ItemDefinition>>=freezeContent(Object.fromEntries(Object.entries(G23_SPECIAL_ITEM_SOURCE).map(([id,s])=>{
 const v:Readonly<Record<string,number|null>>=s.values,n=(key:string)=>v[key]??0,effects:Effect[]=[],program:{-readonly [K in keyof ItemProgram]:ItemProgram[K]}={};
 for(const [key,statName] of [['Health','maxHp'],['AP','abilityPower'],['Armor','armor'],['MagicResist','magicResist'],['Mana','initialMana']] as const)if(n(key))effects.push({kind:'statFlat',stat:statName,amount:Math.round(n(key))});
 if(id==='TFT5_Item_GargoyleStoneplateRadiant')effects.push({kind:'mechanic',mechanic:'gargoyle',values:{resistPerEnemy:n('ArmorPerEnemy')}});
 if(n('AD'))effects.push({kind:'statPercentBps',stat:'attackDamage',bps:Math.round(n('AD')*10000)});
 if(n('AS'))effects.push({kind:'attackSpeedBps',bps:Math.round(n('AS')*100)});
 const health=n('BonusPercentHP')||n('PercentMaxHP');if(health)effects.push({kind:'statPercentBps',stat:'maxHp',bps:Math.round(health*10000)});
 program.modifiers=[...(n('CritChance')?[modifier('critChance',Math.round(n('CritChance')*100),'bps')]:[]),...(n('BonusDamage')||n('DamageAmp')?[modifier('damageAmp',Math.round((n('BonusDamage')||n('DamageAmp'))*10000),'bps')]:[])];
 const isRadiant=id.startsWith('TFT5_Item_');
 // Conditional radiant bonuses are emitted only by their named programs.
 if(isRadiant&&['TFT5_Item_BlueBuffRadiant','TFT5_Item_TrapClawRadiant','TFT5_Item_GiantSlayerRadiant'].includes(id))program.modifiers=program.modifiers.filter(m=>m.stat!=='damageAmp');
 const omni=n('StatOmnivamp')||n('StatOmnivamp_NotStatBar');if(omni)program.vamp=[vamp(Math.round(omni*10000))];
 program.periodic=[...(n('HealthRegenInterval')&&n('MaxHealthRegen')?[periodic(Math.round(n('HealthRegenInterval')*20),[{kind:'heal',amount:amount({maxHpBps:Math.round(n('MaxHealthRegen')*100)})}])]:[]),...(n('APPerInterval')?[periodic(Math.round(n('IntervalSeconds')*20),[{...stat(modifier('abilityPower',n('APPerInterval'))),stackPolicy:{kind:'add-stacks',cap:10000}}])]:[])];
 program.triggers=[...(n('AttackSpeedPerStack')?[trigger({id:'reward-rageblade',effects:[{...stat(modifier('attackSpeed',Math.round(n('AttackSpeedPerStack')*100),'bps')),stackPolicy:{kind:'add-stacks',cap:10000}}]})]:[])];
 if(n('ShieldHealthPercent')&&n('HealthThreshold'))program.survival=[survival(Math.round(n('HealthThreshold')*100),[shield(Math.round(n('ShieldHealthPercent')*100),Math.round(n('ShieldDuration')*20))])];
 if(isRadiant){
  if(id==='TFT5_Item_HextechGunbladeRadiant'||id==='TFT5_Item_HandOfJusticeRadiant')program.vamp=[];
  if(id==='TFT5_Item_FrozenHeartRadiant')program.survival=[];
  const radiant=g23RadiantProgram(id,v);
  for(const key of ['modifiers','effects','triggers','survival','periodic','vamp'] as const)Object.assign(program,{[key]:[...program[key]??[],...radiant[key]??[]]});
 }
 // Finite conversion fallback: retain ordinary TG's receipted temporary pair until radiant-pair policy lands.
 const gloves=id==='TFT5_Item_ThiefsGlovesRadiant';
 if(gloves)program.effects=[...program.effects??[],...ORDINARY['thiefs-gloves'].combatProgram!.effects!];
 // G2-4a: the crown has no combat stats; its permanent team size lives in deployment-cap.ts.
 const crown=id==='TFT_Item_ForceOfNature';
 return [id,{id,apiName:id,name:s.name,kind:isRadiant?'radiant':'completed',...(isRadiant?{radiantOf:Object.keys(G23_RADIANT_MAPPING).find(k=>(G23_RADIANT_MAPPING as Readonly<Record<string,string>>)[k]===id)!}:{}),...(!isRadiant&&id.includes('TFT13_')?{restriction:{kind:'trait' as const,traitId:'chem-baron'}}:{}),evidenceStatus:'approved-provisional',unique:s.unique,slotCost:gloves?3:1,effects,combatProgram:program,conventionIds:['G23-SPECIAL-FINITE-01'],effectDescriptions:[crown?'获得时队伍人口上限永久+1，与是否装备无关。':'有限奖励装备：源基础属性与部分程序；省略清单见 G2-3 RECONCILIATION。']} satisfies ItemDefinition];
})));
/** Acquisition pools/recipes retain the ordinary 44-entry catalogue. Domain ownership admits reward-only identities too. */
export const ITEM_DEFINITIONS:Readonly<Record<string,ItemDefinition>>=freezeContent({...ORDINARY,...G23_SPECIAL_ITEMS});
export {COMPONENT_IDS} from './items';
