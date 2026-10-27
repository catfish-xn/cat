import { freezeContent } from './freeze';
import { ANOMALY_DEFINITIONS } from './anomalies';
import { PORTABLE_ANOMALY_EXCLUDED, PORTABLE_ANOMALY_PREFIX } from './augment-pool-batch5-r2';
import type { ItemDefinition } from '../strategy-types';

/** Immutable effect identity is encoded in the item definition, never copied from a unit runtime.
 * All variants share the one unique apiName, stats and ordinary equipment/remover semantics. */
export const PORTABLE_ANOMALY_ITEMS:Readonly<Record<string,ItemDefinition>> = freezeContent(Object.fromEntries(
  Object.values(ANOMALY_DEFINITIONS).filter(a=>!PORTABLE_ANOMALY_EXCLUDED.includes(a.id)).map(a=>{
    const id=PORTABLE_ANOMALY_PREFIX+a.id;
    return [id,{id,apiName:'TFT13_AnotherAnomaly_Item',name:`便携异常：${a.name}`,kind:'completed',evidenceStatus:'approved-provisional',unique:true,slotCost:1,
      effects:[{kind:'statFlat',stat:'maxHp',amount:250},{kind:'statPercentBps',stat:'attackDamage',bps:2000},{kind:'statFlat',stat:'abilityPower',amount:25}],
      conventionIds:['P-B5-81'],effectDescriptions:[a.description,'复制效果定义，不携带原英雄累计状态；卸下即失效，原异常英雄不能装备。']} satisfies ItemDefinition];
  })));
