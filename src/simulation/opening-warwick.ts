import { WARWICK_DROP_BPS, WARWICK_COMMON_BPS, WARWICK_COMMON_WEIGHTS, WARWICK_RARE_WEIGHTS } from './content/opening-batch-b';
import { openingSeatDraw, weightedOpeningIndex } from './opening-batch-b-rng';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { getShopOdds } from './progression';
import { COMPONENT_POOL } from './component-pool';
import type { LootPayload } from './m8/contracts';
export function warwickBranch(dropWord:number,poolWord:number,rewardWord:number):number|null {
 if(Math.floor(dropWord*10000/4294967296)>=WARWICK_DROP_BPS)return null;
 return Math.floor(poolWord*10000/4294967296)<WARWICK_COMMON_BPS
  ?weightedOpeningIndex(rewardWord,WARWICK_COMMON_WEIGHTS):3+weightedOpeningIndex(rewardWord,WARWICK_RARE_WEIGHTS);
}
export function warwickLoot(seed:number,seat:string,battleId:string,victimId:string,level:number):readonly LootPayload[] {
 const draw=openingSeatDraw(seed,seat,`warwicks-hunger/${JSON.stringify([battleId,victimId])}`);
 const branch=warwickBranch(draw(),draw(),draw());if(branch===null)return [];
 if(branch<3)return [{kind:'gold',quantity:branch+1}];
 if(branch===3)return [{kind:'item',definitionId:COMPONENT_POOL[Math.floor(draw()*COMPONENT_POOL.length/4294967296)].definitionId,quantity:1}];
 if(branch===4||branch===8)return [{kind:'consumable',definitionId:branch===4?'TFT_Consumable_ChampionDuplicator_III':'TFT_Consumable_NeekosHelp',quantity:1}];
 if(branch===6)return [{kind:'gold',quantity:4}];
 return Array.from({length:branch===5?1:2},()=>{
  const cost=(weightedOpeningIndex(draw(),getShopOdds(branch===5?Math.min(level+1,10):level).map(p=>p*100))+1) as 1|2|3|4|5;
  const pool=SHOP_CATALOG_BY_COST[cost];return {kind:'unit' as const,definitionId:pool[Math.floor(draw()*pool.length/4294967296)],starLevel:1 as const,quantity:1};
 });
}
