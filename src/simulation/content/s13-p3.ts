import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
import { S13_P3_SOURCE } from './s13-p3-source';

export const P3_AUGMENT_ITEMS: Readonly<Record<string, string>> = freezeContent({
  'high-voltage': 'ionic-spark', pyromaniac: 'red-buff',
  'thorn-plated-armor': 'bramble-vest', 'unleash-the-beast': 'steraks-gage',
});
const choices = (kind: 'augment' | 'anomaly'): Readonly<Record<string, ChoiceDefinition>> => freezeContent(Object.fromEntries(
  Object.entries(S13_P3_SOURCE).filter(([, d]) => d.kind === kind).map(([id, d]) => [id, {
    id, name: d.name, description: d.description,
    effects: [{ kind: 'mechanic', mechanic: 's13P3', values: { enabled: 1, stage: 1 } },
      ...(id === 'knockout' ? [{ kind: 'statPercentBps', stat: 'attackDamage', bps: 1500 }] : []),
      ...(id === 'thornskin' ? [{ kind: 'statFlat', stat: 'armor', amount: 60 }, { kind: 'statFlat', stat: 'magicResist', amount: 60 }] : [])],
  }])) as Record<string, ChoiceDefinition>);
export const P3_AUGMENTS = choices('augment');
export const P3_ANOMALIES = choices('anomaly');
export const P3_TIERS = freezeContent({ 'defense-call': 'gold', 'high-voltage': 'gold', 'piercing-lotus-i': 'gold',
  'piercing-lotus-ii': 'prismatic', pyromaniac: 'gold', 'thorn-plated-armor': 'gold', 'unleash-the-beast': 'gold' } as const);
/** 项目约定；原始归档没有可验证的脚本体。合并时由 Claude 统一升版本。 */
export const P3_CONVENTIONS = freezeContent({
  thornskin: { basis: 'resistance-and-durability-prevented', excludes: ['shield', 'immunity', 'redirect', 'deferral'], reflectionRecursion: false },
  knockout: { basis: 'raw-basic-packet', operation: 'replace', coefficientBps: 9000, order: ['convert', 'critical', 'damage-pipeline'], consumes: 'next-attack-action', repeatedCast: 'refresh' },
  fireball: { target: 'current-attack-target', radius: 2, directDot: 'six-percent-over-five-seconds-plus-standard-burn', sample: 'target-current-max-hp-per-pulse', rounding: 'cumulative-floor-difference', repeatedCast: 'stack-direct-refresh-burn' },
  stage: { first: 2, last: 5, overtime: 'clamp-last' },
} as const);
