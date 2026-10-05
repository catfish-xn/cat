import type { CombatEvent, CombatOrigin } from '../simulation/combat-types';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';

/** Presentation only: never reconstruct damage or trigger rules from unit HP. */
export function originLabel(source: CombatOrigin): string {
  const catalog = source.sourceKind === 'item' ? ITEM_DEFINITIONS : source.sourceKind === 'trait' ? TRAIT_DEFINITIONS
    : source.sourceKind === 'augment' ? AUGMENT_DEFINITIONS : source.sourceKind === 'anomaly' ? ANOMALY_DEFINITIONS : UNIT_DEFINITIONS;
  return `${catalog[source.definitionId]?.name ?? source.definitionId} · ${source.sourceKind} · ${source.ownerId}`;
}
export function combatEventText(event: CombatEvent): string | null {
  const prefix = `#${event.eventSeq ?? '—'} · t${event.tick}`;
  switch (event.type) {
    case 'targetChanged': return `${prefix} ${event.unitId} 目标 ${event.before ?? '无'} → ${event.after ?? '无'}`;
    case 'packetDamage': return `${prefix} ${originLabel(event.source)} → ${event.unitId}：${event.damageType === 'physical' ? '物理' : '魔法'} HP -${event.hpDamage}，盾吸收 ${event.absorbed}${event.critical ? ' · 暴击' : ''}${event.redirected ? ' · 分担' : ''}`;
    case 'heal': return `${prefix} ${originLabel(event.source)} → ${event.unitId}：治疗 +${event.actual}，溢出 ${event.overheal}`;
    case 'shieldLayerChanged': return `${prefix} ${originLabel(event.layer.source)} → ${event.unitId}：护盾 ${event.reason}，剩余 ${event.layer.remaining}，到期 t${event.layer.expiresAtTick}`;
    case 'statusChanged': return `${prefix} ${originLabel(event.status.source)} → ${event.unitId}：${event.status.kind} ${event.reason}，数值 ${event.status.amount}，到期 t${event.status.expiresAtTick}`;
    case 'kill': return `${prefix} ${originLabel(event.source)} 击败 ${event.unitId}`;
    case 'statChanged': return `${prefix} ${originLabel(event.source)} → ${event.unitId}：${event.stat} ${event.before} → ${event.after}`;
    case 'growth': return `${prefix} ${event.unitId} 永久AD +${event.amountBps / 100}%（累计 ${event.totalBps / 100}%）`;
    case 'cast': return `${prefix} ${event.sourceId} 施放 ${event.abilityId} → ${event.targetIds.join('、')}`;
    default: return null;
  }
}
