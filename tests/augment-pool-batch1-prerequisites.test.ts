import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { planAugmentGifts, augmentAnvilOffers } from '../src/simulation/augment-gift-plan';
import { grantMechanicConsumable, grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { accepted } from './match-helpers';

const a={definitionId:'test',choiceId:'test:choice',acquiredRound:1};
it('random completed items, support items and five-costs use independent reproducible streams',()=>{
 const s=createMatch(123),before=JSON.stringify(s);
 const specs=[{kind:'random-item',pool:'completed',count:5},{kind:'random-item',pool:'support',count:2},{kind:'random-unit',cost:5,count:2}] as const;
 const gifts=planAugmentGifts(s,a,specs);
 expect(gifts).toEqual(planAugmentGifts(s,a,specs));expect(new Set(gifts.map(g=>g.receiptId)).size).toBe(9);
 expect(gifts.slice(0,5).every(g=>G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(g.definitionId))).toBe(true);
 expect(gifts.slice(5,7).every(g=>G24_FORGE_POOLS.TFT_ArmoryKeySupport.includes(g.definitionId))).toBe(true);
 expect(planAugmentGifts(s,a,[{...specs[0],count:20},specs[1],specs[2]]).slice(-2)).toEqual(gifts.slice(-2));
 expect(JSON.stringify(s)).toBe(before);
 const twins=planAugmentGifts(s,a,[{kind:'random-item',pool:'component',count:2,identical:true}]);
 expect(twins[0].definitionId).toBe(twins[1].definitionId);
});
it.each(Object.keys(G24_FORGE_POOLS) as (keyof typeof G24_FORGE_POOLS)[])('%s offers four distinct in-pool items',id=>{
 const offers=augmentAnvilOffers(123,'receipt',id);
 expect(new Set(offers).size).toBe(4);expect(offers.every(x=>G24_FORGE_POOLS[id].includes(x))).toBe(true);
 expect(augmentAnvilOffers(123,'receipt',id)).toEqual(offers);
});
it('multiple bench anvils grant separately, fail atomically when full, and consume no live RNG',()=>{
 let s=createMatch(42);
 for(let i=0;i<9;i++)s=accepted(grantMechanicUnit(s,{receiptId:`test:${i}`,source:'test',definitionId:i%2?'TFT_ArmoryKeySupport':'TFT_ArmoryKeyCompleted'}));
 const before=s,result=grantMechanicUnit(s,{receiptId:'test:9',source:'test',definitionId:'TFT_ArmoryKeyComponent'});
 expect(result).toEqual({ok:false,state:before,reason:'bench-full'});expect(result.state).toBe(before);
 expect(s.rngState).toBe(createMatch(42).rngState);expect(s.choiceRngState).toBe(createMatch(42).choiceRngState);
});
it.each(['TFT_Consumable_ChampionDuplicator_III','TFT_Consumable_NeekosHelp','masterwork-upgrade','reforger'])('%s grants exactly once with authenticated receipt',definitionId=>{
 const s=createMatch(42),request={receiptId:'test:tool',source:'test',definitionId};
 const granted=grantMechanicConsumable(s,request);const after=accepted(granted);
 expect(after.consumables.at(-1)?.definitionId).toBe(definitionId);
 expect(grantMechanicConsumable(after,request)).toEqual({ok:false,state:after,reason:'duplicate-mechanic-receipt'});
 expect(grantMechanicConsumable(s,{...request,definitionId:'unknown'})).toEqual({ok:false,state:s,reason:'invalid-mechanic-state'});
});
