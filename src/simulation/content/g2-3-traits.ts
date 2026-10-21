import type { Effect,TraitDefinition,TraitTier } from '../strategy-types';
import { G23_TRAIT_SOURCE } from './g2-3-trait-runtime';
import { freezeContent } from './freeze';
const raw:Readonly<Record<string,{readonly name:string;readonly enabled:boolean;readonly tiers:readonly {readonly threshold:number;readonly values:Readonly<Record<string,number|null|undefined>>}[]}>>=G23_TRAIT_SOURCE;
const flat=(stat:'maxHp'|'armor'|'magicResist'|'abilityPower',amount:number):Effect=>({kind:'statFlat',stat,amount});
const pct=(stat:'maxHp'|'attackDamage',bps:number):Effect=>({kind:'statPercentBps',stat,bps});
const mechanic=(name:string,values:Readonly<Record<string,number>>):Effect=>({kind:'mechanic',mechanic:name,values});
const names:Readonly<Record<string,string>>={'chem-baron':'炼金男爵',visionary:'先知',dominator:'统领',experiment:'试验品',bruiser:'格斗家','pit-fighter':'搏击手','black-rose':'黑色玫瑰','high-roller':'百变铁手','junker-king':'机械公敌',quickstriker:'迅击战士',ambusher:'伏击专家'};
/** Source tier catalogue, including the innate row-frozen Form Swapper trait. */
export const G23_TRAITS:Readonly<Record<string,TraitDefinition>>=freezeContent(Object.fromEntries(Object.entries(raw).filter(([,d])=>d.enabled).map(([id,d])=>{
  const team=['sentinel','sorcerer','academy','emissary','bruiser'].includes(id);
  const tiers=d.tiers.map(({threshold,values:v}):TraitTier=>{
    const n=(k:string)=>v[k]??0,b=(k:string)=>Math.round(n(k)*10000);
    let effects:Effect[]=[],memberEffects:Effect[]|undefined;
    switch(id){
      case 'sentinel':effects=[flat('armor',n('BonusArmor')),flat('magicResist',n('BonusArmor'))];memberEffects=[flat('armor',n('BonusArmor')*2),flat('magicResist',n('BonusArmor')*2)];break;
      case 'sorcerer':effects=[flat('abilityPower',n('TeamAP'))];memberEffects=[flat('abilityPower',(threshold===8?125:n('BaseAP'))-n('TeamAP')),mechanic('g23Trait',{tier:threshold})];break;
      // 12/17 B patch (M9_DATA_LEDGER); keep the source mirror at its archived 60%.
      case 'artillerist':effects=[pct('attackDamage',threshold===6?7000:b('AD')),mechanic('artillery',{everyN:n('NumOfAttacks'),adBps:b('PercentDamage'),radius:1})];break;
      case 'quickstriker':effects=[mechanic('quickstriker',{minBps:b('MinBonusAS'),maxBps:b('MaxBonusAS'),shield:n('ShieldAmount'),durationTicks:Math.max(1,Math.round(n('ShieldDuration')*20))})];break;
      case 'sniper':effects=[mechanic('sniper',{damageBpsPerHex:(threshold===6?36:threshold===4?18:n('PercentDamageIncrease'))*100}),mechanic('g23Trait',{tier:threshold})];break;
      case 'watcher':effects=[mechanic('watcher',{reductionBps:b('BaseDR'),healthyReductionBps:b('IncreasedDR'),thresholdBps:b('HealthBreakpoint')})];break;
      case 'automata':effects=[flat('armor',n('Resists')),flat('magicResist',n('Resists')),mechanic('automata',{crystals:n('TriggerNumCrystals'),damage:n('MagicDamage'),conversionBps:b('ConversionDamagePct')})];break;
      case 'family':effects=[mechanic('family',{manaReductionBps:b('ManaReduction'),damageReductionBps:b('DamageReduction'),heist:threshold>=5?1:0}),...(threshold>=4?[{kind:'attackSpeedBps' as const,bps:b('AttackSpeed')}]:[])];break;
      case 'firelight':effects=[mechanic('firelight',{periodTicks:120,healBps:b('PercentDamageTakenHeal'),attackSpeedBps:0,dashTicks:20})];break;
      case 'rebel':effects=[pct('maxHp',1200),mechanic('rebel',{thresholdBps:2500,adApBps:b('ADAP'),bonusHpBps:b('PercentMaxHealthBonus'),stunTicks:Math.round(n('StunDuration')*20),attackSpeedBps:6000,durationTicks:100,...(threshold===10?{forcedPeriodTicks:Math.round(n('ForceDuration')*20)}:{})})];break;
      case 'enforcer':effects=[mechanic('damageAmp',{bps:b('BaseDA')}),mechanic('enforcer',{shieldBps:b('PercentMaxHealthShield'),wanted:n('NumOfWantedEnemies'),attackSpeedBps:3000})];break;
      case 'scrap':effects=[mechanic('scrap',{shieldPerComponent:n('HPShieldAmount'),conversions:n('NumComponents'),durationTicks:Math.round(n('ShieldDuration')*20),componentCount:0})];break;
      case 'academy':effects=[mechanic('academy',{sponsoredBps:b('PercentIncreaseSponsored'),memberBaseBps:b('BaseValues')})];break;
      case 'emissary':effects=[mechanic('emissary',{armorPerWin:n('AmbessaArmor'),healthBps:b('GarenHealthPercent'),mana:n('NamiMana'),starSpeedBps:b('StarAS')})];if(threshold===4)memberEffects=[flat('maxHp',n('BonusHealth')),mechanic('damageAmp',{bps:b('SelfishDamageAmp')})];break;
      case 'conqueror':effects=[pct('attackDamage',b('ADAPBase')),flat('abilityPower',Math.round(n('ADAPBase')*100)),mechanic('g23Trait',{tier:threshold})];break;
      case 'visionary':effects=[mechanic('visionary',{manaBps:b('EnlightenedBonusMana'),allyHealingBps:b('AllyHealing')})];break;
      case 'form-swapper':effects=[mechanic('formSwapper',{frontReductionBps:b('DR'),backAmpBps:b('DA')})];break;
      case 'bruiser':effects=[flat('maxHp',n('TeamFlatHealth'))];memberEffects=[pct('maxHp',b('BonusPercentHealth'))];break;
      default:effects=[mechanic('g23Trait',{tier:threshold})];break;
    }
    return {threshold,effects,...(memberEffects?{memberEffects}:{})};
  });
  return [id,{id,name:names[id]??d.name,target:team?'team':'members',tiers}];
})));
