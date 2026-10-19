import type { ChoiceDefinition, Effect } from '../strategy-types';
import { freezeContent } from './freeze';
import { S13_P2_SOURCE } from './s13-augments-p2-source';

export const P2_IDS = Object.keys(S13_P2_SOURCE);
export const P2_ANOMALY_IDS = ['share-your-energy', 'cull-the-weak', 'stoneskin'];
const definitions = (anomaly: boolean): Readonly<Record<string, ChoiceDefinition>> => freezeContent(Object.fromEntries(
  Object.entries(S13_P2_SOURCE).filter(([id]) => P2_ANOMALY_IDS.includes(id) === anomaly).map(([id, source]) => [id, {
    id, name: source.name, description: source.description.replace(/@([a-z0-9_]+)(\*100)?@/gi, (token,key:string,percent:string|undefined) => {
      const entry=Object.entries(source.values).find(([name])=>name.toLowerCase()===key.toLowerCase());
      return entry?String(Number((entry[1]*(percent?100:1)).toFixed(6))):token;
    }),
    effects: [{ kind: 'mechanic', mechanic: anomaly ? 's13P2Anomaly' : 's13P2Augment', values: { enabled: 1 } } as Effect],
  }])));
export const S13_P2_AUGMENTS = definitions(false);
export const S13_P2_ANOMALIES = definitions(true);
export const S13_P2_TIERS = freezeContent(Object.fromEntries(Object.entries(S13_P2_SOURCE).flatMap(([id,source]) => 'tier' in source ? [[id,source.tier]] : []))) as Readonly<Record<string, 'silver' | 'gold' | 'prismatic'>>;
export const p2Values = (id: string): Readonly<Record<string, number>> => S13_P2_SOURCE[id as keyof typeof S13_P2_SOURCE]?.values ?? {};

/** One shared declaration for component overflow; components consumed into recipes cease to qualify. */
export const P2_ITEM_GRANTS: Readonly<Record<string, { readonly id: string; readonly count: number }>> = freezeContent({
  'crown-guarded': { id: 'crownguard', count: 1 }, 'not-today': { id: 'edge-of-night', count: 1 },
  'belt-overflow': { id: 'belt', count: p2Values('belt-overflow').NumItems },
  'sword-overflow': { id: 'sword', count: p2Values('sword-overflow').NumItems },
  'wand-overflow': { id: 'rod', count: p2Values('wand-overflow').NumItems },
  'crownguard-spirit': { id: 'rod', count: 1 }, 'guardbreaker-spirit': { id: 'gloves', count: 1 },
  'shojin-spirit': { id: 'sword', count: 1 }, 'flurry-of-blows': { id: 'TFT_Item_ZekesHerald', count: 1 },
  'immovable-object': { id: 'TFT4_Item_OrnnRanduinsSanctum', count: 1 },
});
