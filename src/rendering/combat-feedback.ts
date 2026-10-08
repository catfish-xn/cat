import type { CombatEvent, CombatOrigin } from '../simulation/combat-types';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { displayUnitName } from './display-names';
import { m8EventText } from '../presentation/combat-status';

export type UnitNameLookup = (id: string | null) => string;
const unnamed: UnitNameLookup = id => id ? '单位' : '无';
const SOURCES: Readonly<Record<CombatOrigin['sourceKind'], string>> = { attack:'普攻', ability:'技能', item:'装备', trait:'羁绊', augment:'强化', anomaly:'异常', enemyGrowth:'敌方成长' };
/** Presentation only; the owning view resolves historical unit names without exposing IDs. */
export function originLabel(source: CombatOrigin, lookup?: UnitNameLookup): string {
  const catalog = source.sourceKind === 'item' ? ITEM_DEFINITIONS : source.sourceKind === 'trait' ? TRAIT_DEFINITIONS
    : source.sourceKind === 'augment' ? AUGMENT_DEFINITIONS : source.sourceKind === 'anomaly' ? ANOMALY_DEFINITIONS : UNIT_DEFINITIONS;
  // Champion attack/ability ids are not catalog keys; the owner's name already identifies them.
  const label = UNIT_DEFINITIONS[source.definitionId] ? displayUnitName(source.definitionId) : catalog[source.definitionId]?.name
    ?? (['attack', 'ability', 'enemyGrowth'].includes(source.sourceKind) && lookup ? '' : '效果');
  // M8 Source carries the parent instance for temporary child items; the plain origin has none.
  const parent = (source as CombatOrigin & { readonly parentItemInstanceId?: string | null }).parentItemInstanceId;
  return `${lookup ? `${lookup(source.ownerId)} · ` : ''}${SOURCES[source.sourceKind]}${label ? ` · ${label}` : ''}${parent ? ' · 临时子件' : ''}`;
}
/** Read event facts only: never reconstruct damage or trigger rules from unit HP. */
export function combatEventText(event: CombatEvent, name: UnitNameLookup = unnamed): string | null {
  const prefix = `第 ${event.tick} 刻`, source = (origin: CombatOrigin) => originLabel(origin, name);
  switch (event.type) {
    case 'targetChanged': return `${prefix} ${name(event.unitId)} 目标 ${name(event.before)} → ${name(event.after)}`;
    case 'kill': return `${prefix} ${source(event.source)} 击败 ${name(event.unitId)}`;
    case 'growth': return `${prefix} ${name(event.unitId)} 永久攻击力 +${event.amountBps / 100}%（累计 ${event.totalBps / 100}%）`;
    case 'packetDamage': case 'heal': case 'shieldLayerChanged': case 'statusChanged': case 'statChanged': case 'maxHpChanged': case 'cast': {
      const text = m8EventText(event, name, source); return text && `${prefix} ${text}`;
    }
    default: return null;
  }
}
