import type { ChoiceDefinition, Effect } from '../strategy-types';
import { P4_SOURCE } from './source';
import { freezeContent } from '../content/freeze';
export function definition(name: keyof typeof P4_SOURCE, effects: readonly Effect[] = name === 'Repulsor' ? [{kind:'attackSpeedBps',bps:Math.round(P4_SOURCE.Repulsor.values.BonusAS*10000)}] : []): ChoiceDefinition {
  const d = P4_SOURCE[name];
  const values: Readonly<Record<string, number>> = d.values;
  const description = (name === 'WolfFamiliars' ? '召唤两头不可被选取的狼，它们拥有1.0攻击速度和这个弈子的50%攻击力。' : d.description).replace(/@([A-Za-z0-9]+)(\*100)?@/g, (_token, key: string, percent: string) => {
    if (!Object.hasOwn(values, key)) throw new RangeError('Unknown anomaly tooltip value: ' + key);
    return String(Math.round(values[key] * (percent ? 100 : 1) * 1000000) / 1000000);
  }).replace(/\s*\(%i:[^%]+%\)/g, '').replace(/<\/?TFTKeyword>/g, '');
  return { id: d.id, name: d.name, description, effects: [...effects,
    { kind: 'mechanic', mechanic: 's13Anomaly', values: { enabled: 1 } }] };
}
export const S13_ANOMALY_DEFINITIONS = freezeContent(Object.fromEntries(
  (Object.keys(P4_SOURCE) as (keyof typeof P4_SOURCE)[]).map(name => { const d = definition(name); return [d.id, d]; })));
