import type { ChoiceDefinition,Effect } from '../strategy-types';
import { freezeContent } from './freeze';
import { G23_ANOMALY_SOURCE } from './g2-3-anomaly-source';
const raw:Readonly<Record<string,{readonly name:string;readonly description:string;readonly zhName:string;readonly values:Readonly<Record<string,number>>}>>=G23_ANOMALY_SOURCE;
const flat=(stat:'maxHp'|'armor'|'magicResist'|'abilityPower',amount:number):Effect=>({kind:'statFlat',stat,amount});
const pct=(stat:'attackDamage'|'maxHp'|'armor'|'magicResist'|'abilityPower',bps:number):Effect=>({kind:'statPercentBps',stat,bps});
export const G23_ANOMALIES:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(raw).map(([id,d])=>{
  const v=d.values,b=(k:string)=>Math.round(v[k]*10000);let effects:Effect[]=[];
  switch(id){
    case 'titanic-strikes':effects=[{kind:'mechanic',mechanic:'titanic',values:{adBps:b('ADRatio'),radius:1}}];break;
    case 'mage-armor':effects=[{kind:'mechanic',mechanic:'mageArmor',values:{apBps:b('PercentAPToDefenses')}}];break;
    case 'kill-streak':effects=[{kind:'mechanic',mechanic:'killStreak',values:{mana:v.ManaAmount}}];break;
    case 'fortified':effects=[pct('maxHp',b('HealthPercent'))];break;
    case 'bulwark':effects=[flat('armor',v.BonusArmor),flat('magicResist',v.BonusMR)];break;

    case 'giant-sized':effects=[flat('maxHp',v.BonusHP)];break;
    case 'deep-roots':effects=[flat('maxHp',v.BonusHealth),flat('armor',v.BonusArmor),flat('magicResist',v.BonusMagicResist)];break;
    case 'energy-absorption':effects=[flat('abilityPower',v.UpfrontAP)];break;
    case 'power-absorption':effects=[pct('attackDamage',b('UpfrontAD'))];break;
    case 'arcana-overwhelming':effects=[flat('magicResist',v.BonusMR)];break;
    case 'avalanche-of-armor':effects=[flat('armor',v.BonusArmor)];break;
    case 'magic-training':effects=[flat('abilityPower',v.BonusAP)];break;
    case 'strength-training':effects=[pct('attackDamage',Math.round(v.BonusAD*100))];break;
    case 'berserker-rage':effects=[pct('attackDamage',Math.round(v.BonusAD*100)),flat('abilityPower',v.BonusAP)];break;
    case 'hypervelocity':effects=[{kind:'attackSpeedBps',bps:b('ASBonus')}];break;
  }
  if(!['titanic-strikes','mage-armor','kill-streak'].includes(id))effects.push({kind:'mechanic',mechanic:'g23Anomaly',values:{enabled:1}});
  return [id,{id,name:d.zhName||d.name,description:d.description,effects}];
})));
