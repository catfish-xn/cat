import type { ItemProgram } from './m8/item-program';
import type { Effect as ProgramEffect,StatModifier } from './m8/contracts';
import { amount,modifier,stat,trigger,selector,enemies,periodic,shield,status,survival,vamp,hp,filter,burn } from './content/item-programs';
import { G23_ANOMALY_SOURCE } from './content/g2-3-anomaly-source';
import { G23_TRAIT_SOURCE } from './content/g2-3-trait-source';
const stack=(m:StatModifier):ProgramEffect=>({...stat(m),stackPolicy:{kind:'add-stacks',cap:10000}});
const proc=(damageType:'physical'|'magic'|'true',patch:Parameters<typeof amount>[0]):ProgramEffect=>({kind:'damage',damageType,delivery:'equipment-proc',critEligibility:'never',amount:amount(patch)});
const maxHp=(bps:number):ProgramEffect=>({kind:'change-max-hp',bonusBps:bps,currentHp:'add-max-delta',countsAsHeal:false});
const team=()=>selector({relation:'ally',maxTargets:100,order:'id'});
const onceAt=(at:number,effects:readonly ProgramEffect[],s=selector())=>periodic(2401,effects,s,{startsAtTick:at,endsAtTick:at+1});
const counter=(id:string,event:'attack-completed'|'cast-completed',everyN:number)=>({counters:[{id,events:[{event,listener:{subject:'actor' as const,relationToHolder:'self' as const,withinHexes:null},qualifies:'completed-event' as const}],scope:'source-instance' as const,reset:'combat-start' as const,cap:null}],gate:{kind:'every-n' as const,counterId:id,everyN,firstAt:everyN}});
export function g23AnomalyProgram(id:string,maxMana:number):ItemProgram{
  const source=(G23_ANOMALY_SOURCE as Readonly<Record<string,{readonly values:Readonly<Record<string,number>>}>>)[id];if(!source)return {};
  const v=source.values,b=(k:string)=>Math.round(v[k]*10000);
  switch(id){
    case 'fortified':return {periodic:Array.from({length:v.StackCap},(_,i)=>onceAt(Math.round(v.ReapplyTimer*20)*(i+1),[maxHp(b('HealthGrow'))]))};
    case 'bulwark':return {modifiers:[modifier('armor',2*v.BonusArmor,'flat',hp('gt',Math.round(v.HealthThreshold*100))),modifier('magicResist',2*v.BonusMR,'flat',hp('gt',Math.round(v.HealthThreshold*100)))]};
    case 'berserker-rage':return {modifiers:[modifier('attackDamage',Math.round(v.BonusAD*200),'bps',hp('lt',Math.round(v.HealthThreshold*100))),modifier('abilityPower',2*v.BonusAP,'flat',hp('lt',Math.round(v.HealthThreshold*100)))]};
    case 'legacy-of-shurima':return {periodic:[onceAt(Math.round(v.Duration*20),[maxHp(b('MaxHPRatio')),stat(modifier('attackSpeed',b('ASRatio'),'bps'))])]};
    case 'hypervelocity':return {triggers:[trigger({id:'speed-on-cast',event:'cast-completed',effects:[stack(modifier('attackSpeed',b('ASOnCast'),'bps'))]})]};
    case 'heavy-hitter':return {triggers:[trigger({id:'heavy-hitter',internalCooldownTicks:Math.round(v.Cooldown*20),selector:enemies({candidates:'event-target'}),effects:[proc('physical',{maxHpBps:b('HealthToDamagePercent')})]})]};
    case 'strength-training':return {triggers:[trigger({id:'team-strength',...counter('attacks','attack-completed',v.NumAttacks),selector:team(),effects:[stack(modifier('attackDamage',Math.round(v.ADPerStack*100),'bps'))]})]};
    case 'magic-training':return {triggers:[trigger({id:'team-magic',event:'cast-completed',selector:team(),effects:[stack(modifier('abilityPower',Math.floor(maxMana/v.PerManaSpent)*v.APPerStack))]})]};
    case 'deep-roots':return {effects:[status('control-immunity',0,1201,{activation:'immediate'})]};
    case 'eagle-eye':return {modifiers:[modifier('range',v.BonusRange,'hexes')],triggers:[trigger({id:'stationary',event:'counter-updated',effects:[stack(modifier('attackDamage',b('BonusAD'),'bps'))]})]};
    case 'slime-time':return {periodic:[periodic(Math.round(v.Period*20),[proc('magic',{abilityPowerBps:b('APRatio')})],enemies({radius:1,maxTargets:100}))]};
    case 'laser-eyes':return {periodic:[periodic(20,[proc('magic',{abilityPowerBps:b('PercentAP')}),...burn(Math.round(v.BurnDuration*20))],enemies({radius:3,maxTargets:100,geometry:'line-to-primary'}))]};
    case 'slow-cooker':return {periodic:Array.from({length:11},(_,i)=>periodic(20,[proc('magic',{maxHpBps:b('HealthRatio'),hpBasis:'holder'})],enemies({radius:v.HexRadiusBase+i,maxTargets:100}),{startsAtTick:Math.max(20,i*Math.round(v.Period*20)),endsAtTick:(i+1)*Math.round(v.Period*20)}))};
    case 'protective-shielding':{
      const ticks=Math.round(v.ShieldDuration*20),effects=[shield(b('PercentHealth'),ticks)],allies=selector({relation:'ally',excludeSelf:true,maxTargets:v.AlliesNumber,order:'hp-absolute-distance-id'});
      // Shield samples the holder's maximum health for both the holder and allies.
      return {triggers:[trigger({id:'self-shield',event:'combat-start',effects}),trigger({id:'ally-shield',event:'combat-start',selector:allies,effects})],periodic:[periodic(Math.round(v.ShieldTimer*20),effects),periodic(Math.round(v.ShieldTimer*20),effects,allies)]};
    }
    case 'bully':return {modifiers:[modifier('damageAmp',b('BonusDamage'),'bps')]};
    default:return {};
  }
}
/** Source tier parameters compiled into the existing declarative trigger vocabulary. */
export function g23TraitProgram(id:string,tier:number,maxMana:number):ItemProgram{
  const source=(G23_TRAIT_SOURCE as Readonly<Record<string,{readonly tiers:readonly {readonly threshold:number;readonly values:Readonly<Record<string,number|null|undefined>>}[]}>>)[id];
  const v=source?.tiers.find(t=>t.threshold===tier)?.values;if(!v)return {};
  const n=(k:string)=>v[k]??0,b=(k:string)=>Math.round(n(k)*10000);
  switch(id){
    case 'ambusher':return {modifiers:[modifier('critChance',b('CritChance'),'bps'),modifier('critMultiplier',b('CritDamage'),'bps'),modifier('damageReduction',b('DamageReductionPct'),'bps',undefined,filter())],effects:[{kind:'authorize-spell-crit',duplicateBonusBps:1000}]};
    case 'dominator':return {triggers:[trigger({id:'dominator-cast',event:'cast-completed',effects:[stack(modifier('abilityPower',Math.floor(maxMana*n('APPercent'))))]})],effects:[{...shield(0,Math.round(n('ShieldDuration')*20)),amount:amount({flat:n('ShieldAmount')})}]};
    case 'pit-fighter':return {vamp:[vamp(b('OmnivampPercent'))],triggers:[trigger({id:'pit-true',event:'damage-dealt',aggregation:'action-damage-total',condition:{kind:'positive-hp-damage'},selector:enemies({candidates:'event-target'}),effects:[proc('true',{actualDamageBps:b('TrueDamagePercent')})]})],survival:[survival(b('HealthThreshold'),[{kind:'heal',amount:amount({maxHpBps:b('HealPercent')})}])]};
    case 'quickstriker':return {modifiers:[modifier('attackSpeed',b('MinBonusAS'),'bps'),modifier('attackSpeed',b('MaxBonusAS')-b('MinBonusAS'),'bps',hp('lt',5000))],...(tier>=4?{survival:[survival(5000,[{...shield(0,Math.round(n('ShieldDuration')*20)),amount:amount({flat:n('ShieldAmount')})}])]}:{})};
    case 'sniper':return n('BonusHexRangeIncrease')?{modifiers:[modifier('range',n('BonusHexRangeIncrease'),'hexes')]}:{};
    default:return {};
  }
}
/** Experiment donors are frozen from Laboratory occupancy at combat start. */
export function g23ExperimentProgram(v:Readonly<Record<string,number>>):ItemProgram{
 const triggers:NonNullable<ItemProgram['triggers']>[number][]=[];
 if(v.urgot)triggers.push(trigger({id:'lab-urgot',event:'cast-completed',effects:[shield(800,100),stat(modifier('attackSpeed',v.urgot,'bps'),100)]}));
 if(v.nunu)triggers.push(trigger({id:'lab-nunu',event:'damage-dealt',condition:{kind:'positive-hp-damage'},internalCooldownTicks:20,selector:enemies({candidates:'event-target'}),effects:[proc('magic',{maxHpBps:v.nunu})]}));
 if(v.twitch)triggers.push(trigger({id:'lab-twitch',...counter('lab-attacks','attack-completed',5),selector:enemies(),effects:[proc('physical',{maxHpBps:v.twitch,hpBasis:'target'})]}));
 return {triggers};
}
