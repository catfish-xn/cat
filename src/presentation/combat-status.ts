/**
 * M8 U4 combat status/source presentation. Reads authoritative B3 fields only
 * (StatusGroup, CombatActivity, ShieldLayer.m8State, event outcomes); never evaluates
 * stack policies, durations or damage itself. Tick→seconds is display formatting only.
 */
import { COMBAT_TICK_MS, type CombatEvent, type CombatOrigin, type CombatStatus, type CombatUnit } from '../simulation/combat-types';
import type { CombatActivity, DamageType, Stat, StatusContribution, StatusGroup, StatusKind } from '../simulation/m8/contracts';

export const DAMAGE_TYPE_NAMES: Readonly<Record<DamageType, string>> = { physical: '物理', magic: '魔法', true: '真实' };
export const STATUS_KIND_NAMES: Readonly<Record<StatusKind, string>> = {
  burn: '灼烧', wound: '重伤', sunder: '护甲击碎', shred: '魔抗击碎', stun: '眩晕', 'control-immunity': '免疫控制',
  untargetable: '不可选中', 'damage-prevention': '伤害防止', 'stat-buff': '属性提升', 'stat-debuff': '属性削弱', 'damage-reduction': '减伤',
};
/** One glyph per kind for the compact board strip; the full name is always in the panels. */
const STATUS_BADGES: Readonly<Record<StatusKind, string>> = {
  burn: '灼', wound: '伤', sunder: '甲', shred: '抗', stun: '晕', 'control-immunity': '免',
  untargetable: '隐', 'damage-prevention': '防', 'stat-buff': '增', 'stat-debuff': '削', 'damage-reduction': '减',
};
const LEGACY_STATUS_NAMES: Readonly<Record<CombatStatus['kind'], string>> = {
  stun: '眩晕', damageReduction: '减伤', armorReduction: '护甲削减', resistanceFlat: '双抗提升', attackSpeed: '攻速提升', abilityPower: '法强提升', channel: '引导', redirect: '伤害分担',
};
const ACTIVITY_NAMES: Readonly<Record<CombatActivity['kind'], string>> = { channel: '引导', redirect: '伤害分担' };
const ACTIVITY_BADGES: Readonly<Record<CombatActivity['kind'], string>> = { channel: '引', redirect: '担' };
const STAT_NAMES: Readonly<Record<Stat, string>> = {
  maxHp: '最大生命', attackDamage: '攻击力', abilityPower: '法强', armor: '护甲', magicResist: '魔抗', attackSpeed: '攻速', range: '射程',
  critChance: '暴击率', critMultiplier: '暴击伤害', damageAmp: '增伤', damageReduction: '减伤', omnivamp: '全能吸血',
};
/** Legacy statChanged keeps attackSpeed in Bps and range in hexes (B2 §3 mapping). */
const legacyStatValue = (stat: string, value: number) => stat === 'attackSpeedBps' ? pct(value) : stat === 'range' ? `${value}格` : String(value);
const LEGACY_STAT_NAMES: Readonly<Record<string, string>> = { attackSpeedBps: '攻速', abilityPower: '法强', range: '射程' };
export const STATUS_REASON_NAMES: Readonly<Record<string, string>> = {
  applied: '生效', refreshed: '刷新', expired: '到期', cleansed: '被净化', 'source-lost': '来源失效', 'death-cleanup': '阵亡清除',
  replaced: '被替换', 'combat-end': '战斗结束', 'control-cancelled': '被控制打断',
};
export const SHIELD_REASON_NAMES: Readonly<Record<string, string>> = {
  granted: '生成', absorbed: '吸收伤害', decayed: '自然衰减', expired: '到期', depleted: '耗尽', 'death-cleanup': '阵亡清除', replaced: '被替换', 'combat-end': '战斗结束',
};
const MANA_REASON_NAMES: Readonly<Record<string, string>> = { attack: '普攻回蓝', damage: '受伤回蓝', 'incoming-basic-hit': '受击回蓝', periodic: '周期回蓝', 'cast-refund': '施法返还', kill: '击杀回蓝' };

export type UnitNameLookup = (id: string | null) => string;
export type SourceLabel = (source: CombatOrigin) => string;

const pct = (bps: number) => `${bps / 100}%`;
export const ticksToSeconds = (ticks: number) => `${(Math.max(0, ticks) * COMBAT_TICK_MS / 1000).toFixed(1)}秒`;

function magnitudeText(contribution: StatusContribution): string {
  const modifier = contribution.application.modifier;
  if (modifier && modifier.value.kind === 'constant') {
    const amount = modifier.value.amount, sign = amount > 0 ? '+' : '';
    const value = modifier.unit === 'bps' ? `${sign}${pct(amount)}` : modifier.unit === 'hexes' ? `${sign}${amount}格` : `${sign}${amount}`;
    return `${STAT_NAMES[modifier.stat]} ${value}`;
  }
  if (modifier) return `${STAT_NAMES[modifier.stat]} 按比例变化`;
  return contribution.application.magnitudeBps ? pct(contribution.application.magnitudeBps) : '';
}

export interface StatusRow {
  readonly key: string;
  readonly kind: StatusKind | CombatActivity['kind'];
  readonly name: string;
  readonly badge: string;
  readonly harmful: boolean;
  readonly magnitude: string;
  readonly source: CombatOrigin;
  /** Domain-recorded fields, copied verbatim. */
  readonly appliedAtTick: number;
  readonly expiresAtTick: number | null;
  readonly nextPulseAtTick: number | null;
  /** Domain marks the winning contribution; a retained weaker one keeps its own clock. */
  readonly state: 'effective' | 'suppressed' | 'pending' | 'active';
}

/**
 * Current statuses of one combat unit, from the B3 mechanism store (the same data the
 * future readCombatStatuses projection will return). Ended activities are never shown.
 */
export function readUnitStatusRows(unit: CombatUnit, tick: number): StatusRow[] {
  const store = unit.mechanismState, rows: StatusRow[] = [];
  for (const group of store?.statuses ?? []) {
    if (group.targetId !== unit.id) continue;
    for (const contribution of group.contributions) rows.push(groupRow(group, contribution, tick));
  }
  for (const activity of store?.activities ?? []) {
    if (activity.lifecycle !== 'active' || activity.targetId !== unit.id) continue;
    rows.push({ key: activity.key, kind: activity.kind, name: ACTIVITY_NAMES[activity.kind], badge: ACTIVITY_BADGES[activity.kind], harmful: false,
      magnitude: activity.kind === 'redirect' ? `分担 ${pct(activity.shareBps)}` : '', source: activity.source, appliedAtTick: activity.startsAtTick,
      expiresAtTick: activity.expiresAtTick, nextPulseAtTick: null, state: 'active' });
  }
  // Units restored without the mechanism store keep the legacy projection readable.
  if (!store) for (const status of unit.statuses ?? []) rows.push({ key: status.key, kind: status.kind === 'channel' || status.kind === 'redirect' ? status.kind : 'stat-buff',
    name: LEGACY_STATUS_NAMES[status.kind] ?? '效果', badge: '·', harmful: status.kind === 'stun' || status.kind === 'armorReduction', magnitude: String(status.amount),
    source: status.source, appliedAtTick: status.startsAtTick, expiresAtTick: status.expiresAtTick, nextPulseAtTick: null, state: 'active' });
  return rows;
}
function groupRow(group: StatusGroup, contribution: StatusContribution, tick: number): StatusRow {
  const state = contribution.appliedAtTick > tick ? 'pending' : group.effectiveSourceKey === contribution.key ? 'effective'
    : contribution.application.stackPolicy.kind === 'strongest-category' ? 'suppressed' : 'active';
  return { key: contribution.key, kind: group.kind, name: STATUS_KIND_NAMES[group.kind], badge: STATUS_BADGES[group.kind],
    harmful: contribution.application.polarity === 'harmful',
    magnitude: magnitudeText(contribution), source: contribution.source, appliedAtTick: contribution.appliedAtTick, expiresAtTick: contribution.expiresAtTick,
    nextPulseAtTick: group.kind === 'burn' ? group.nextPulseAtTick : null, state };
}

/** Full sentence for detail panels; timing comes from recorded ticks. */
export function statusRowText(row: StatusRow, tick: number, source: SourceLabel): string {
  const parts = [row.name + (row.magnitude ? ` ${row.magnitude}` : '')];
  if (row.state === 'suppressed') parts.push('被更强来源压制（保留）');
  if (row.state === 'pending') parts.push(`第 ${row.appliedAtTick} 刻生效`);
  parts.push(row.expiresAtTick === null ? '持续至战斗结束' : `剩余 ${ticksToSeconds(row.expiresAtTick - tick)}（第 ${row.expiresAtTick} 刻结束）`);
  if (row.nextPulseAtTick !== null) parts.push(`下一跳第 ${row.nextPulseAtTick} 刻`);
  parts.push(`来源 ${source(row.source)}`);
  return parts.join(' · ');
}

/** Board strip: one glyph per kind that currently applies; harmful and beneficial kept apart. */
export function statusBadges(unit: CombatUnit, tick: number): { harmful: string; beneficial: string } {
  const harmful = new Set<string>(), beneficial = new Set<string>();
  for (const row of readUnitStatusRows(unit, tick)) {
    if (row.state === 'pending' || row.state === 'suppressed') continue;
    (row.harmful ? harmful : beneficial).add(row.badge);
  }
  return { harmful: [...harmful].slice(0, 4).join(''), beneficial: [...beneficial].slice(0, 4).join('') };
}

/** Status kind carried by a statusChanged event: the frozen group kind wins over the legacy anchor. */
export function eventStatusName(event: Extract<CombatEvent, { type: 'statusChanged' }>): string {
  if (event.activity) return ACTIVITY_NAMES[event.activity.kind];
  if (event.group) return STATUS_KIND_NAMES[event.group.kind];
  return LEGACY_STATUS_NAMES[event.status.kind] ?? '效果';
}
/** Harmful status kinds worth a short float on the board when applied. */
export function appliedStatusFloat(event: CombatEvent): string | null {
  if (event.type !== 'statusChanged' || event.reason !== 'applied' || event.activity) return null;
  const kind: StatusKind | null = event.group ? event.group.kind : event.status.kind === 'stun' ? 'stun' : event.status.kind === 'armorReduction' ? 'sunder' : null;
  return kind && ['burn', 'wound', 'sunder', 'shred', 'stun', 'untargetable', 'damage-prevention'].includes(kind) ? STATUS_KIND_NAMES[kind] : null;
}

/** Shared event sentences for the strategy log and the stats panel. */
export function m8EventText(event: CombatEvent, name: UnitNameLookup, source: SourceLabel): string | null {
  switch (event.type) {
    case 'packetDamage': {
      const o = event.outcome, type = DAMAGE_TYPE_NAMES[o?.context.damageType ?? event.damageType];
      const extra = [o && o.prevented > 0 ? `被防止 ${o.prevented}` : '', o && o.overkill > 0 ? `溢出 ${o.overkill}` : '', event.critical ? '暴击' : '', event.redirected ? '分担' : '', o?.killingPacket ? '致命' : ''].filter(Boolean);
      return `${source(event.source)} → ${name(event.unitId)}：${type}实际生命伤害 ${event.hpDamage}，护盾吸收 ${event.absorbed}${extra.length ? ` · ${extra.join(' · ')}` : ''}`;
    }
    case 'heal': {
      const o = event.outcome;
      const wound = o && o.preventedByWound > 0 ? `，重伤减少 ${o.preventedByWound}` : '';
      const shares = o && o.shares.length > 1 ? `（${o.shares.map(share => `${source(share.source)} ${share.actual}`).join('；')}）` : '';
      return `${source(event.source)} → ${name(event.unitId)}：有效治疗 ${event.actual}，过量治疗 ${event.overheal}${wound}${shares}`;
    }
    case 'shieldLayerChanged': {
      const m8 = event.layer.m8State, end = event.endReason && event.endReason !== event.reason ? `（${SHIELD_REASON_NAMES[event.endReason] ?? event.endReason}）` : '';
      const ledger = m8 ? `，已吸收 ${m8.absorbed}${m8.decayed ? `，已衰减 ${m8.decayed}` : ''}${m8.expiredDiscarded ? `，到期作废 ${m8.expiredDiscarded}` : ''}` : '';
      return `${source(event.layer.source)} → ${name(event.unitId)}：护盾${SHIELD_REASON_NAMES[event.reason] ?? event.reason}${end}，剩余 ${event.layer.remaining}${ledger}，到期第 ${event.layer.expiresAtTick} 刻`;
    }
    case 'statusChanged': {
      const contribution = event.group?.contributions.find(c => c.key === event.status.key) ?? event.group?.contributions[0];
      const origin = contribution?.source ?? event.activity?.source ?? event.status.source;
      const detail = contribution ? magnitudeText(contribution) : event.activity ? '' : String(event.status.amount);
      const until = event.reason === 'applied'
        ? (contribution ? (contribution.expiresAtTick === null ? '，持续至战斗结束' : `，至第 ${contribution.expiresAtTick} 刻`) : event.activity ? `，至第 ${event.activity.expiresAtTick} 刻` : `，至第 ${event.status.expiresAtTick} 刻`) : '';
      return `${source(origin)} → ${name(event.unitId)}：${eventStatusName(event)}${detail ? ` ${detail}` : ''} ${STATUS_REASON_NAMES[event.activity?.endReason ?? event.reason] ?? event.reason}${until}`;
    }
    case 'manaChanged': {
      const o = event.outcome;
      if (o) return `${source(o.source)} → ${name(event.unitId)}：${MANA_REASON_NAMES[o.reason] ?? '法力'} ${o.applied}${o.blocked ? `，锁蓝阻止 ${o.blocked}` : ''}${o.overflow ? `，溢出 ${o.overflow}` : ''}，法力 ${o.before} → ${o.after}`;
      const parts = [event.spent ? `消耗 ${event.spent}` : '', event.attackGain ? `普攻 +${event.attackGain}` : '', event.damageGain ? `受伤 +${event.damageGain}` : '', event.hookGain ? `效果 +${event.hookGain}` : '', event.overflow ? `溢出 ${event.overflow}` : ''].filter(Boolean);
      return `${name(event.unitId)} 法力 ${event.before} → ${event.after}${parts.length ? `（${parts.join('，')}）` : ''}`;
    }
    case 'maxHpChanged': return `${source(event.source)} → ${name(event.unitId)}：最大生命 ${event.beforeMax} → ${event.afterMax}，当前生命 ${event.beforeHp} → ${event.afterHp}（不计治疗）`;
    case 'statChanged': return `${source(event.source)} → ${name(event.unitId)}：${LEGACY_STAT_NAMES[event.stat] ?? event.stat} ${legacyStatValue(event.stat, event.before)} → ${legacyStatValue(event.stat, event.after)}`;
    case 'cast': return `${name(event.sourceId)} 施放技能 → ${event.targetIds.map(name).join('、') || '无目标'}`;
    default: return null;
  }
}
