/**
 * M8 U4 combat status/source presentation. Reads authoritative B3 fields only
 * (StatusGroup, CombatActivity, ShieldLayer.m8State, event outcomes); never evaluates
 * stack policies, damage filters, durations or damage itself. Tick→seconds is display only.
 *
 * Entry points take the whole combat snapshot plus a unit id, so switching to the frozen
 * readCombatStatuses(combat) query (UR-U4-01) only changes statusSource() below.
 */
import { COMBAT_TICK_MS, type CombatEvent, type CombatOrigin, type CombatState, type CombatStatus, type ShieldLayer } from '../simulation/combat-types';
import type { CombatActivity, DamageDelivery, DamageFilter, DamageType, Stat, StatusContribution, StatusGroup, StatusKind } from '../simulation/m8/contracts';

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
const ACTIVITY_NAMES: Readonly<Record<CombatActivity['kind'], string>> = { channel: '引导', redirect: '伤害分担' };
const ACTIVITY_BADGES: Readonly<Record<CombatActivity['kind'], string>> = { channel: '引', redirect: '担' };
const STAT_NAMES: Readonly<Record<Stat, string>> = {
  maxHp: '最大生命', attackDamage: '攻击力', abilityPower: '法强', armor: '护甲', magicResist: '魔抗', attackSpeed: '攻速', range: '射程',
  critChance: '暴击率', critMultiplier: '暴击伤害', damageAmp: '增伤', damageReduction: '减伤', omnivamp: '全能吸血',
};
const DELIVERY_NAMES: Readonly<Record<DamageDelivery, string>> = {
  'basic-attack': '普攻', 'ability-direct': '技能直接伤害', 'ability-periodic': '技能持续伤害', 'attack-extra': '普攻附加伤害', 'equipment-proc': '装备触发伤害', 'item-burn': '装备灼烧',
};
/** Legacy statChanged keeps attackSpeed in Bps and range in hexes (B2 §3 mapping). */
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
const signed = (text: string, value: number) => `${value > 0 ? '+' : ''}${text}`;
export const ticksToSeconds = (ticks: number) => `${(Math.max(0, ticks) * COMBAT_TICK_MS / 1000).toFixed(1)}秒`;
const legacyStatValue = (stat: string, value: number) => stat === 'attackSpeedBps' ? pct(value) : stat === 'range' ? `${value}格` : String(value);

/**
 * Legacy compatibility anchor (statusChanged without group). Only fields whose meaning
 * and unit are fixed by applyStatus() are interpreted; resistanceFlat may touch armor,
 * magic resist or both, so it is shown neutrally (UR-U4-05 asks for the frozen group).
 */
const LEGACY_ANCHOR: Readonly<Record<CombatStatus['kind'], { name: string; value: (amount: number) => string }>> = {
  stun: { name: '眩晕', value: () => '' },
  damageReduction: { name: '减伤', value: pct },
  armorReduction: { name: '护甲击碎', value: pct },
  resistanceFlat: { name: '属性变化', value: amount => signed(String(amount), amount) },
  attackSpeed: { name: '攻速变化', value: amount => signed(pct(amount), amount) },
  abilityPower: { name: '法强变化', value: amount => signed(String(amount), amount) },
  channel: { name: '引导', value: () => '' },
  redirect: { name: '伤害分担', value: pct },
};
/** A legacy anchor is a real stored record only when it links to contributions or an activity. */
const trustedAnchor = (status: CombatStatus) => Boolean(status.contributionKeys?.length || status.activity);

function magnitudeText(contribution: StatusContribution): string {
  const modifier = contribution.application.modifier;
  if (modifier && modifier.value.kind === 'constant') {
    const amount = modifier.value.amount;
    const value = modifier.unit === 'bps' ? pct(amount) : modifier.unit === 'hexes' ? `${amount}格` : String(amount);
    return `${STAT_NAMES[modifier.stat]} ${signed(value, amount)}`;
  }
  if (modifier) return `${STAT_NAMES[modifier.stat]} 随条件变化`;
  return contribution.application.magnitudeBps ? pct(contribution.application.magnitudeBps) : '';
}
/** Declared scope of a filtered contribution (A08); which packet it applies to is decided by the domain. */
export function damageFilterText(filter: DamageFilter): string {
  const deliveries = filter.deliveries === 'all' ? '全部伤害' : filter.deliveries.map(d => DELIVERY_NAMES[d]).join('/');
  const types = filter.damageTypes === 'all' ? '' : `；${filter.damageTypes.map(t => DAMAGE_TYPE_NAMES[t]).join('/')}`;
  const redirected = filter.redirected === 'include' ? '；含分担' : filter.redirected === 'exclude' ? '；不含分担' : '；仅分担';
  return `适用：${deliveries}${types}${redirected}`;
}

export interface StatusRow {
  readonly key: string;
  readonly kind: StatusKind | CombatActivity['kind'];
  readonly name: string;
  readonly badge: string;
  readonly harmful: boolean;
  readonly magnitude: string;
  /** Declared packet scope; such rows are never judged suppressed without a packet. */
  readonly scope: string | null;
  readonly source: CombatOrigin;
  /** Domain-recorded fields, copied verbatim. */
  readonly appliedAtTick: number;
  readonly expiresAtTick: number | null;
  readonly nextPulseAtTick: number | null;
  /** 'suppressed' only for unfiltered strongest-category contributions the domain did not pick (stronger or tie-break). */
  readonly state: 'effective' | 'suppressed' | 'pending' | 'active';
}

/** The single read of current statuses; replace with readCombatStatuses(combat) once delivered. */
function statusSource(combat: CombatState, unitId: string): { groups: readonly StatusGroup[]; activities: readonly CombatActivity[]; legacy: readonly CombatStatus[] | null } | null {
  const unit = combat.units.find(value => value.id === unitId);
  if (!unit) return null;
  const store = unit.mechanismState;
  return store
    ? { groups: store.statuses.filter(g => g.targetId === unitId), activities: store.activities.filter(a => a.targetId === unitId && a.lifecycle === 'active'), legacy: null }
    : { groups: [], activities: [], legacy: unit.statuses ?? [] };
}

/** Current statuses of one unit in this snapshot (live or replay). Ended activities are never shown. */
export function readUnitStatusRows(combat: CombatState, unitId: string): StatusRow[] {
  const read = statusSource(combat, unitId), rows: StatusRow[] = [];
  if (!read) return rows;
  for (const group of read.groups) for (const contribution of group.contributions) rows.push(groupRow(group, contribution, combat.tick));
  for (const activity of read.activities) rows.push({ key: activity.key, kind: activity.kind, name: ACTIVITY_NAMES[activity.kind], badge: ACTIVITY_BADGES[activity.kind], harmful: false,
    magnitude: activity.kind === 'redirect' ? `分担 ${pct(activity.shareBps)}` : '', scope: null, source: activity.source, appliedAtTick: activity.startsAtTick,
    expiresAtTick: activity.expiresAtTick, nextPulseAtTick: null, state: 'active' });
  // Units restored without the mechanism store keep the legacy projection readable.
  for (const status of read.legacy ?? []) {
    const anchor = LEGACY_ANCHOR[status.kind];
    rows.push({ key: status.key, kind: status.kind === 'channel' || status.kind === 'redirect' ? status.kind : 'stat-buff', name: anchor?.name ?? '状态', badge: '·',
      harmful: false, magnitude: anchor?.value(status.amount) ?? '', scope: null, source: status.source, appliedAtTick: status.startsAtTick,
      expiresAtTick: status.expiresAtTick, nextPulseAtTick: null, state: 'active' });
  }
  return rows;
}
function groupRow(group: StatusGroup, contribution: StatusContribution, tick: number): StatusRow {
  const filter = contribution.application.damageFilter ?? contribution.application.modifier?.damageFilter ?? null;
  // A08: the group maximum is a summary without packet context; filtered contributions
  // (damage reduction) are chosen per packet by the domain, so none is shown as suppressed.
  const state = contribution.appliedAtTick > tick ? 'pending'
    : filter === null && group.effectiveSourceKey !== null && group.effectiveSourceKey !== contribution.key && contribution.application.stackPolicy.kind === 'strongest-category' ? 'suppressed'
    : group.effectiveSourceKey === contribution.key && filter === null ? 'effective' : 'active';
  return { key: contribution.key, kind: group.kind, name: STATUS_KIND_NAMES[group.kind], badge: STATUS_BADGES[group.kind],
    harmful: contribution.application.polarity === 'harmful', magnitude: magnitudeText(contribution), scope: filter ? damageFilterText(filter) : null,
    source: contribution.source, appliedAtTick: contribution.appliedAtTick, expiresAtTick: contribution.expiresAtTick,
    nextPulseAtTick: group.kind === 'burn' ? group.nextPulseAtTick : null, state };
}

/** Full sentence for detail panels; timing comes from recorded ticks. */
export function statusRowText(row: StatusRow, tick: number, source: SourceLabel): string {
  const parts = [row.name + (row.magnitude ? ` ${row.magnitude}` : '')];
  if (row.scope) parts.push(row.kind === 'damage-reduction' ? `${row.scope}（对每次适用伤害取最高减伤）` : row.scope);
  // The domain picks one contribution (stronger, or by key on a tie); the UI never compares magnitudes.
  if (row.state === 'suppressed') parts.push('同类状态由另一来源提供（本来源保留）');
  if (row.state === 'pending') parts.push(`第 ${row.appliedAtTick} 刻生效`);
  parts.push(row.expiresAtTick === null ? '持续至战斗结束' : `剩余 ${ticksToSeconds(row.expiresAtTick - tick)}（第 ${row.expiresAtTick} 刻结束）`);
  if (row.nextPulseAtTick !== null) parts.push(`下一跳第 ${row.nextPulseAtTick} 刻`);
  parts.push(`来源 ${source(row.source)}`);
  return parts.join(' · ');
}

/** Board strip: one glyph per kind that currently applies; harmful and beneficial kept apart. */
export function statusBadges(combat: CombatState, unitId: string): { harmful: string; beneficial: string } {
  const harmful = new Set<string>(), beneficial = new Set<string>();
  for (const row of readUnitStatusRows(combat, unitId)) {
    if (row.state === 'pending' || row.state === 'suppressed') continue;
    (row.harmful ? harmful : beneficial).add(row.badge);
  }
  return { harmful: [...harmful].slice(0, 4).join(''), beneficial: [...beneficial].slice(0, 4).join('') };
}

/** Full provenance when the domain kept it: m8State/outcome carry parentItemInstanceId, legacy fields do not. */
export const shieldSource = (layer: ShieldLayer): CombatOrigin => layer.m8State?.source ?? layer.source;
export function eventSource(event: CombatEvent): CombatOrigin | null {
  switch (event.type) {
    case 'packetDamage': return event.outcome?.context.source ?? event.source;
    case 'heal': return event.outcome?.shares[0]?.source ?? event.source;
    case 'shieldLayerChanged': return shieldSource(event.layer);
    case 'statusChanged': return event.group?.contributions.find(c => c.key === event.status.key)?.source ?? event.group?.contributions[0]?.source ?? event.activity?.source ?? event.status.source;
    case 'manaChanged': return event.outcome?.source ?? null;
    case 'kill': case 'statChanged': case 'maxHpChanged': return event.source;
    default: return null;
  }
}

/** Status name carried by a statusChanged event; unknown compatibility anchors stay neutral. */
export function eventStatusName(event: Extract<CombatEvent, { type: 'statusChanged' }>): string {
  if (event.activity) return ACTIVITY_NAMES[event.activity.kind];
  if (event.group) return STATUS_KIND_NAMES[event.group.kind];
  return trustedAnchor(event.status) ? LEGACY_ANCHOR[event.status.kind]?.name ?? '状态' : '状态';
}
/** Harmful status kinds worth a short float on the board when applied. */
export function appliedStatusFloat(event: CombatEvent): string | null {
  if (event.type !== 'statusChanged' || event.reason !== 'applied' || event.activity) return null;
  const kind: StatusKind | null = event.group ? event.group.kind
    : !trustedAnchor(event.status) ? null : event.status.kind === 'stun' ? 'stun' : event.status.kind === 'armorReduction' ? 'sunder' : null;
  return kind && ['burn', 'wound', 'sunder', 'shred', 'stun', 'untargetable', 'damage-prevention'].includes(kind) ? STATUS_KIND_NAMES[kind] : null;
}

/** Shared event sentences for the strategy log and the stats panel. */
export function m8EventText(event: CombatEvent, name: UnitNameLookup, source: SourceLabel): string | null {
  const from = eventSource(event);
  switch (event.type) {
    case 'packetDamage': {
      // Live events do not carry outcome yet (UR-U4-03); the outcome-only details appear once it is published.
      const o = event.outcome, type = DAMAGE_TYPE_NAMES[o?.context.damageType ?? event.damageType];
      const extra = [o && o.prevented > 0 ? `被防止 ${o.prevented}` : '', o && o.overkill > 0 ? `溢出 ${o.overkill}` : '', event.critical ? '暴击' : '', event.redirected ? '分担' : '', o?.killingPacket ? '致命' : ''].filter(Boolean);
      return `${source(from!)} → ${name(event.unitId)}：${type}实际生命伤害 ${event.hpDamage}，护盾吸收 ${event.absorbed}${extra.length ? ` · ${extra.join(' · ')}` : ''}`;
    }
    case 'heal': {
      const o = event.outcome;
      if (!o) return `${source(from!)} → ${name(event.unitId)}：有效治疗 ${event.actual}，过量治疗 ${event.overheal}`;
      // One heal event, one HP change; the per-source split is the domain's shares[], shown verbatim.
      const shares = o.shares.map(s => `${source(s.source)}：请求 ${s.requested}，有效 ${s.actual}，过量 ${s.overheal}，重伤减少 ${s.preventedByWound}`);
      return `${o.shares.length > 1 ? `${o.shares.length} 个来源` : source(from!)} → ${name(event.unitId)}：请求 ${o.requested}，有效治疗 ${event.actual}，过量治疗 ${event.overheal}，重伤减少 ${o.preventedByWound}${o.shares.length > 1 ? `（${shares.join('；')}）` : ''}`;
    }
    case 'shieldLayerChanged': {
      const m8 = event.layer.m8State, end = event.endReason && event.endReason !== event.reason ? `（${SHIELD_REASON_NAMES[event.endReason] ?? event.endReason}）` : '';
      const ledger = m8 ? `，已吸收 ${m8.absorbed}${m8.decayed ? `，已衰减 ${m8.decayed}` : ''}${m8.expiredDiscarded ? `，到期作废 ${m8.expiredDiscarded}` : ''}` : '';
      return `${source(from!)} → ${name(event.unitId)}：护盾${SHIELD_REASON_NAMES[event.reason] ?? event.reason}${end}，剩余 ${event.layer.remaining}${ledger}，到期第 ${event.layer.expiresAtTick} 刻`;
    }
    case 'statusChanged': {
      const contribution = event.group?.contributions.find(c => c.key === event.status.key) ?? event.group?.contributions[0];
      const reason = STATUS_REASON_NAMES[event.activity?.endReason ?? event.reason] ?? event.reason;
      if (!contribution && !event.activity && !trustedAnchor(event.status)) return `${name(event.unitId)}：状态清理（${reason}）`;
      const detail = contribution ? magnitudeText(contribution) : event.activity ? (event.activity.kind === 'redirect' ? pct(event.activity.shareBps) : '') : LEGACY_ANCHOR[event.status.kind]?.value(event.status.amount) ?? '';
      const until = event.reason !== 'applied' ? '' : contribution ? (contribution.expiresAtTick === null ? '，持续至战斗结束' : `，至第 ${contribution.expiresAtTick} 刻`)
        : `，至第 ${event.activity?.expiresAtTick ?? event.status.expiresAtTick} 刻`;
      return `${source(from!)} → ${name(event.unitId)}：${eventStatusName(event)}${detail ? ` ${detail}` : ''} ${reason}${until}`;
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
