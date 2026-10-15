import type { TraitDefinition, TraitTier } from '../strategy-types';
import { freezeContent } from './freeze';
/** Source values: normalized/g2-2-traits.json. Only naturally reachable tiers. */
export const G22_TRAITS: Readonly<Record<string,TraitDefinition>> = freezeContent({
  rebel: { id:'rebel',name:'蓝发小队',target:'members',tiers:[[3,2000,0,0],[5,4000,1200,0],[7,4500,1500,40]].map(([threshold,adApBps,bonusHpBps,stunTicks]): TraitTier=>({threshold,effects:[
    {kind:'statPercentBps' as const,stat:'maxHp' as const,bps:1200},
    {kind:'mechanic' as const,mechanic:'rebel',values:{thresholdBps:2500,adApBps,bonusHpBps,stunTicks,attackSpeedBps:6000,durationTicks:100}},
  ]}))},
  enforcer:{id:'enforcer',name:'执法官',target:'members',tiers:[[2,1200,1200,1],[4,2000,2000,2],[6,3000,3300,4]].map(([threshold,shieldBps,damageBps,wanted]): TraitTier=>({threshold,effects:[
    {kind:'mechanic' as const,mechanic:'damageAmp',values:{bps:damageBps}},
    {kind:'mechanic' as const,mechanic:'enforcer',values:{shieldBps,wanted,attackSpeedBps:3000}},
  ]}))},
  conqueror:{id:'conqueror',name:'征服者',target:'members',tiers:[[2,1800],[4,2500]].map(([threshold,bps]): TraitTier=>({threshold,effects:[
    {kind:'statPercentBps' as const,stat:'attackDamage' as const,bps},
    {kind:'statFlat' as const,stat:'abilityPower' as const,amount:bps/100},
  ]}))},
  academy:{id:'academy',name:'皮城学院',target:'team',tiers:[[3,200],[4,300]].map(([threshold,bps]): TraitTier=>({threshold,effects:[
    {kind:'mechanic' as const,mechanic:'academy',values:{sponsoredBps:bps,memberBaseBps:500}},
  ]}))},
  scrap:{id:'scrap',name:'极客',target:'members',tiers:[[2,25,1],[4,35,3],[6,50,20]].map(([threshold,shieldPerComponent,conversions]): TraitTier=>({threshold,effects:[
    {kind:'mechanic' as const,mechanic:'scrap',values:{shieldPerComponent,conversions,durationTicks:400,componentCount:0}},
  ]}))},
  emissary:{id:'emissary',name:'外交官',target:'team',tiers:[1,4].map((threshold): TraitTier=>({threshold,effects:[
    {kind:'mechanic' as const,mechanic:'emissary',values:{armorPerWin:2,healthBps:1200,mana:2,starSpeedBps:600}},
  ],...(threshold===4?{memberEffects:[{kind:'statFlat' as const,stat:'maxHp' as const,amount:200},{kind:'mechanic' as const,mechanic:'damageAmp',values:{bps:2000}}]}:{})}))},
});
/** Approved finite release; missing source details stay explicit, never masquerade as CDragon values. */
export const G22_CONVENTIONS = freezeContent({
  revision:'g2-2-finite-v1', blockedForms:['swain','jayce','gangplank'],
  conqueror:'base AD/AP only; no chests, conquest progression or chest scaling',
  academy:{sponsored:['archangel','deathblade','warmog'],grants:'none',selection:'fixed project pool',stacking:'one bonus per holder'},
  scrap:{selection:'component instances by id; lexicographically first legal ordinary recipe respecting unique/slot rules',lucky:'not modeled',radiant:'excluded'},
  emissary:{ambessa:'2 resist per prior PvP victory, capped at 7; no distinct-opponent identity in solo inputs',garen:'12% base star HP plus four-emissary 200; before items/other traits'},
  geometry:'finite hex paths; no animation travel time except source Vex DOTDuration; detailed per-skill audit',
});
