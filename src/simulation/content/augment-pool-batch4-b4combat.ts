import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
interface Row { readonly apiName:string; readonly tier:'gold'; readonly source:{readonly patch:string;readonly archive:string;readonly values:Readonly<Record<string,number|null>>}; readonly gifts:readonly AugmentGiftSpec[] }
/** Four combat rows; original 14.24 values, including null, retained verbatim. */
export const AUGMENT_BATCH4_B4COMBAT:Readonly<Record<string,Row>>=freezeContent({
  "long-distance-pals": {
    "apiName": "TFT9_Augment_LongDistanceRelationship2",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "PercentShare": 0.2199999988079071
      }
    },
    "gifts": []
  },
  "category-five": {
    "apiName": "TFT_Augment_CategoryFive",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "AS": null,
        "TotalDamage": 0.8500000238418579,
        "additionalbolts": 1.0
      }
    },
    "gifts": [
      {
        "kind": "item",
        "definitionId": "runaans-hurricane"
      }
    ]
  },
  "overheal": {
    "apiName": "TFT_Augment_Overheal",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "BonusDamage": 1.149999976158142,
        "Duration": 3.0,
        "MaxShield": 300.0,
        "NumAttacks": 3.0,
        "PercentHeal": 0.5
      }
    },
    "gifts": []
  },
  "sated-spellweaver": {
    "apiName": "TFT_Augment_SatedSpellweaver",
    "tier": "gold",
    "source": {
      "patch": "14.24",
      "archive": "augments-research-2026-10-23/data/augments-14.24.json",
      "values": {
        "Duration": 3.0,
        "MaxShield": 300.0,
        "Omnivamp": 0.20000000298023224
      }
    },
    "gifts": []
  }
});
export const B4COMBAT_FIELDS:Readonly<Record<string,readonly string[]>>=freezeContent({
 longDistancePals:['shareBps'],categoryFive:['extraBolts','damageBps'],overheal:['every','damageBps','healBps','maxShield','durationTicks'],satedSpellweaver:['omnivampBps','maxShield','durationTicks']
});
const mechanics:Record<string,string>={'long-distance-pals':'longDistancePals','category-five':'categoryFive','overheal':'overheal','sated-spellweaver':'satedSpellweaver'};
function values(id:string,v:Readonly<Record<string,number|null>>):Record<string,number>{
 const b=(k:string)=>Math.round(v[k]!*10000);
 switch(id){
 case 'long-distance-pals':return {shareBps:b('PercentShare')};
 case 'category-five':return {extraBolts:v.additionalbolts!,damageBps:b('TotalDamage')};
 case 'overheal':return {every:v.NumAttacks!,damageBps:b('BonusDamage'),healBps:b('PercentHeal'),maxShield:v.MaxShield!,durationTicks:v.Duration!*20};
 default:return {omnivampBps:b('Omnivamp'),maxShield:v.MaxShield!,durationTicks:v.Duration!*20};
 }
}
export const AUGMENT_BATCH4_B4COMBAT_DEFINITIONS:Readonly<Record<string,ChoiceDefinition>>=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4COMBAT).map(([id,row])=>[id,{id,name:id,description:id,effects:[{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}},{kind:'mechanic',mechanic:mechanics[id],values:values(id,row.source.values)}]}])));
export const AUGMENT_BATCH4_B4COMBAT_TIERS=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4COMBAT).map(([id,r])=>[id,r.tier])));
export const AUGMENT_BATCH4_B4COMBAT_API_NAMES=freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4COMBAT).map(([id,r])=>[id,r.apiName])));
export const AUGMENT_BATCH4_B4COMBAT_NODE_BANS=freezeContent({TFT_Augment_CategoryFive:['4-2'],TFT_Augment_Overheal:['2-1'],TFT_Augment_SatedSpellweaver:['2-1']});
