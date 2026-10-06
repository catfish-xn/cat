import type { CombatEvent, CombatOrigin } from '../simulation/combat-types';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { displayUnitName } from './display-names';

export type UnitNameLookup = (id: string | null) => string;
const unnamed: UnitNameLookup = id => id ? '单位' : '无';
const SOURCES: Readonly<Record<CombatOrigin['sourceKind'], string>> = { attack:'普攻', ability:'技能', item:'装备', trait:'羁绊', augment:'强化', anomaly:'异常', enemyGrowth:'敌方成长' };
const STATUS: Readonly<Record<string,string>> = { stun:'眩晕', damageReduction:'减伤', armorReduction:'护甲削减', resistanceFlat:'双抗提升', attackSpeed:'攻速提升', abilityPower:'法强提升', channel:'引导', redirect:'伤害分担' };
/** Presentation only; the owning view resolves historical unit names without exposing IDs. */
export function originLabel(source: CombatOrigin, lookup?: UnitNameLookup): string {
  const catalog = source.sourceKind === 'item' ? ITEM_DEFINITIONS : source.sourceKind === 'trait' ? TRAIT_DEFINITIONS
    : source.sourceKind === 'augment' ? AUGMENT_DEFINITIONS : source.sourceKind === 'anomaly' ? ANOMALY_DEFINITIONS : UNIT_DEFINITIONS;
  const label = UNIT_DEFINITIONS[source.definitionId] ? displayUnitName(source.definitionId) : catalog[source.definitionId]?.name ?? '效果';
  return `${lookup ? `${lookup(source.ownerId)} · ` : ''}${SOURCES[source.sourceKind]} · ${label}`;
}
/** Read event facts only: never reconstruct damage or trigger rules from unit HP. */
export function combatEventText(event: CombatEvent, name: UnitNameLookup = unnamed): string | null {
  const prefix = `第 ${event.tick} 刻`, source = (origin: CombatOrigin) => originLabel(origin, name);
  switch (event.type) {
    case 'targetChanged': return `${prefix} ${name(event.unitId)} 目标 ${name(event.before)} → ${name(event.after)}`;
    case 'packetDamage': return `${prefix} ${source(event.source)} → ${name(event.unitId)}：${event.damageType === 'physical' ? '物理' : '魔法'}实际生命伤害 ${event.hpDamage}，护盾吸收 ${event.absorbed}${event.critical ? ' · 暴击' : ''}${event.redirected ? ' · 分担' : ''}`;
    case 'heal': return `${prefix} ${source(event.source)} → ${name(event.unitId)}：有效治疗 ${event.actual}，过量治疗 ${event.overheal}`;
    case 'shieldLayerChanged': return `${prefix} ${source(event.layer.source)} → ${name(event.unitId)}：护盾${{granted:'生成',absorbed:'吸收伤害',expired:'到期',decayed:'衰减'}[event.reason]}，剩余 ${event.layer.remaining}，到期第 ${event.layer.expiresAtTick} 刻`;
    case 'statusChanged': return `${prefix} ${source(event.status.source)} → ${name(event.unitId)}：${STATUS[event.status.kind] ?? '效果'}${event.reason === 'applied' ? '生效' : '结束'}，数值 ${event.status.amount}，到期第 ${event.status.expiresAtTick} 刻`;
    case 'kill': return `${prefix} ${source(event.source)} 击败 ${name(event.unitId)}`;
    case 'statChanged': return `${prefix} ${source(event.source)} → ${name(event.unitId)}：${{attackSpeedBps:'攻速',abilityPower:'法强',range:'射程'}[event.stat]} ${event.before} → ${event.after}`;
    case 'growth': return `${prefix} ${name(event.unitId)} 永久攻击力 +${event.amountBps / 100}%（累计 ${event.totalBps / 100}%）`;
    case 'cast': return `${prefix} ${name(event.sourceId)} 施放技能 → ${event.targetIds.map(name).join('、')}`;
    default: return null;
  }
}
