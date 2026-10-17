import type { CombatOrigin, CombatState } from '../simulation/combat-types';
import type { LedgerCombatEvent } from '../simulation/combat-types';
import { readCombatStats } from '../simulation/combat-s13';
import type { BattleStats, UnitTotals } from './aggregate';
import { displayUnitName } from '../rendering/display-names';
import { originLabel } from '../rendering/combat-feedback';
import { eventSource, eventUnitId, m8EventText, readUnitStatusRows, STATUS_KIND_NAMES, statusRowText } from '../presentation/combat-status';
import { tallyViewEvents, type CombatViewState, type DisplayCombatEvent, type ViewTotals } from '../presentation/combat-display';
/** Offline and saved replays: the local engine state and its ledger, aggregated by the stats module. */
export interface LedgerStatsView { readonly stats: BattleStats; readonly combat: CombatState; readonly events: readonly LedgerCombatEvent[]; readonly selectedUnitId: string | null }
/**
 * Online (C6): the replay's CombatViewState and its §14.2 events. Totals come from the events' own numbers;
 * what the whitelist cannot carry (healing by source, effect sources, status rows) is hidden, not guessed.
 */
export interface ReplayStatsView { readonly stats: null; readonly runId: string; readonly combat: CombatViewState; readonly events: readonly DisplayCombatEvent[]; readonly selectedUnitId: string | null }
export type StatsView = LedgerStatsView | ReplayStatsView;
export interface StatsPanel { render(view: StatsView): void; dispose(): void }
type EventFilter = 'all' | 'damage' | 'heal' | 'shield' | 'status' | 'mana' | 'target' | 'skill';
const SOURCE_NAMES: Record<CombatOrigin['sourceKind'], string> = { attack: '普攻', ability: '技能', item: '装备', trait: '羁绊', augment: '强化', anomaly: '异常', enemyGrowth: '敌方成长' };
function unitName(combat: { readonly units: readonly { readonly id: string; readonly definitionId: string; readonly starLevel: number }[] }, id: string | null): string {
  if (!id) return '无';
  const unit = combat.units.find(value => value.id === id);
  return unit ? `${displayUnitName(unit.definitionId)} ${unit.starLevel}星` : '历史单位';
}
/** Same provenance text as the strategy panel (originLabel), including the temporary-child marker. */
function sourceName(combat: CombatState, source: CombatOrigin): string { return originLabel(source, id => unitName(combat, id)); }
function includesUnit(event: LedgerCombatEvent, id: string): boolean {
  if (eventUnitId(event) === id || eventSource(event)?.ownerId === id) return true;
  if (event.type === 'attack') return event.targetId === id;
  if (event.type === 'cast') return event.receipt.targetIds.includes(id);
  if (event.type === 'targetChanged') return event.before === id || event.after === id;
  if (event.type === 'statusChanged') return event.group.contributions.some(c => c.source.ownerId === id);
  if (event.type === 'heal') return event.outcome.shares.some(share => share.source.ownerId === id);
  return false;
}
function matches(event: LedgerCombatEvent, filter: EventFilter): boolean {
  // Mana changes accompany nearly every attack, so they are listed under their own filter.
  return filter === 'all' && event.type !== 'manaChanged' || filter === 'damage' && event.type === 'packetDamage' || filter === 'heal' && event.type === 'heal'
    || filter === 'shield' && event.type === 'shieldLayerChanged' || filter === 'status' && (event.type === 'statusChanged' || event.type === 'activityChanged')
    || filter === 'mana' && event.type === 'manaChanged' || filter === 'target' && event.type === 'targetChanged'
    || filter === 'skill' && ['cast', 'effectTriggered', 'statChanged', 'maxHpChanged', 'growth'].includes(event.type);
}
function eventText(event: LedgerCombatEvent, combat: CombatState): string | null {
  const name = (id: string | null) => unitName(combat, id);
  const prefix = `第 ${event.tick} tick：`;
  switch (event.type) {
    case 'packetDamage': case 'heal': case 'shieldLayerChanged': case 'statusChanged': case 'activityChanged': case 'statChanged': case 'maxHpChanged': case 'manaChanged': case 'cast': {
      const text = m8EventText(event, name, origin => sourceName(combat, origin)); return text && `${prefix}${text}`;
    }
    case 'targetChanged': return `${prefix}${name(event.unitId)} 目标由 ${name(event.before)} 变为 ${name(event.after)}`;
    case 'growth': return `${prefix}${name(event.unitId)} 永久攻击力增加 ${event.amountBps / 100}%（累计 ${event.totalBps / 100}%）`;
    case 'kill': return `${prefix}${sourceName(combat, event.source)} 击败 ${name(event.unitId)}`;
    case 'unitRevived': return `${prefix}${sourceName(combat, event.source)} 复活 ${name(event.unitId)}，生命 ${event.hp}`;
    case 'death': return `${prefix}${name(event.unitId)} 阵亡`;
    case 'combatFinished': return `${prefix}战斗结束：${{ playerWin: '我方获胜', enemyWin: '敌方获胜', draw: '平局' }[event.result]}`;
    case 'effectTriggered': return `${prefix}${name(event.source.ownerId)} 的${SOURCE_NAMES[event.source.sourceKind]}生效，目标 ${name(event.targetId)}`;
    default: return null;
  }
}
const DAMAGE_NAMES = { physical: '物理', magic: '魔法', true: '真实' } as const;
/** Sentences for §14.2 wire events: only the fields the event carries (no source kinds, no shares). */
function viewEventText(event: DisplayCombatEvent, combat: CombatViewState): string | null {
  if (event.type === 'unitUpdated' || event.type === 'unitEntered' || event.type === 'unitLeft') return null; // values, not a fact to list
  const name = (id: string | null) => unitName(combat, id);
  const prefix = `第 ${event.tick} tick：`;
  switch (event.type) {
    case 'packetDamage': return `${prefix}${name(event.sourceId)} → ${name(event.targetId)}：${DAMAGE_NAMES[event.damageType]}实际生命伤害 ${event.hpDamage}，护盾吸收 ${event.absorbed}${event.critical ? ' · 暴击' : ''}${event.killingPacket ? ' · 致命' : ''}`;
    case 'heal': return `${prefix}${name(event.targetId)} 恢复生命 ${event.actual}`;
    case 'shieldLayerChanged': return `${prefix}${name(event.targetId)} 护盾${event.reason === 'granted' ? '获得' : event.reason === 'absorbed' ? '吸收' : '变化'}，剩余 ${event.remaining}`;
    case 'statusChanged': return `${prefix}${name(event.targetId)} ${STATUS_KIND_NAMES[event.kind]}${event.reason === 'applied' ? '生效' : event.reason === 'refreshed' ? '刷新' : '结束'}`;
    case 'manaChanged': return `${prefix}${name(event.targetId)} 法力 ${event.before} → ${event.after}`;
    case 'cast': return `${prefix}${name(event.sourceId)} 施放技能${event.targetIds.length ? `，目标 ${event.targetIds.map(name).join('、')}` : ''}`;
    case 'statChanged': return `${prefix}${name(event.unitId)} ${event.stat} ${event.before} → ${event.after}`;
    case 'maxHpChanged': return `${prefix}${name(event.unitId)} 最大生命 ${event.beforeMax} → ${event.afterMax}`;
    case 'targetChanged': return `${prefix}${name(event.unitId)} 目标由 ${name(event.before)} 变为 ${name(event.after)}`;
    case 'growth': return `${prefix}${name(event.unitId)} 永久攻击力增加 ${event.amountBps / 100}%（累计 ${event.totalBps / 100}%）`;
    case 'kill': return `${prefix}${name(event.sourceId)} 击败 ${name(event.unitId)}`;
    case 'unitRevived': return `${prefix}${name(event.sourceId)} 复活 ${name(event.unitId)}，生命 ${event.hp}`;
    case 'death': return `${prefix}${name(event.unitId)} 阵亡`;
    case 'combatFinished': return `${prefix}战斗结束：${{ playerWin: '我方获胜', enemyWin: '敌方获胜', draw: '平局' }[event.result]}`;
    default: return null;
  }
}
function viewIncludesUnit(event: DisplayCombatEvent, id: string): boolean {
  switch (event.type) {
    case 'packetDamage': return event.sourceId === id || event.targetId === id;
    case 'attack': return event.attackerId === id || event.targetId === id;
    case 'cast': return event.sourceId === id || event.targetIds.includes(id);
    case 'targetChanged': return event.unitId === id || event.before === id || event.after === id;
    case 'kill': case 'unitRevived': return event.unitId === id || event.sourceId === id;
    case 'heal': case 'manaChanged': case 'shieldLayerChanged': case 'statusChanged': return event.targetId === id;
    case 'combatFinished': return false;
    case 'effectTriggered': return event.ownerId === id || event.targetId === id;
    case 'unitEntered': return event.unit.id === id;
    default: return event.unitId === id;
  }
}
function viewMatches(event: DisplayCombatEvent, filter: EventFilter): boolean {
  return filter === 'all' && event.type !== 'manaChanged' || filter === 'damage' && event.type === 'packetDamage' || filter === 'heal' && event.type === 'heal'
    || filter === 'shield' && event.type === 'shieldLayerChanged' || filter === 'status' && event.type === 'statusChanged'
    || filter === 'mana' && event.type === 'manaChanged' || filter === 'target' && event.type === 'targetChanged'
    || filter === 'skill' && ['cast', 'statChanged', 'maxHpChanged', 'growth'].includes(event.type);
}
const zeroView = (unitId: string): ViewTotals => ({ unitId, hpDamage: 0, physicalHpDamage: 0, magicHpDamage: 0, trueHpDamage: 0, shieldAbsorbed: 0, healingReceived: 0 });
const zero = (unitId: string): UnitTotals => ({ unitId, hpDamage: 0, physicalHpDamage: 0, magicHpDamage: 0, shieldAbsorbed: 0, effectiveHealing: 0, overhealing: 0 });
/** Read-only DOM component; filtering never modifies authoritative event or stat arrays. */
export function createStatsPanel(host: HTMLElement, onSelect: (id: string | null) => void): StatsPanel {
  const root = document.createElement('section'); root.className = 'm6-stats-panel'; root.setAttribute('aria-label', '战斗统计');
  const heading = document.createElement('h2'); heading.textContent = '战斗统计';
  const explanation = document.createElement('p'); explanation.textContent = '伤害统计实际生命损失，选中单位后查看物理/魔法/真实三类明细；护盾按受击单位统计吸收量，自然衰减不计；治疗按来源统计有效恢复。';
  const selection = document.createElement('select'); selection.style.minHeight = '44px'; selection.style.minWidth = '44px'; selection.setAttribute('aria-label', '统计选中单位'); selection.dataset.debug = 'm6-stats-unit';
  const filter = document.createElement('select'); filter.style.minHeight = '44px'; filter.style.minWidth = '44px'; filter.setAttribute('aria-label', '战斗事件类型'); filter.dataset.debug = 'm6-stats-filter';
  for (const [value, label] of [['all', '全部事件（法力单列）'], ['damage', '实际伤害'], ['heal', '治疗'], ['shield', '护盾'], ['status', '状态'], ['mana', '法力'], ['target', '目标变化'], ['skill', '技能与效果']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; filter.append(option); }
  const table = document.createElement('table'); table.style.width = '100%'; table.style.tableLayout = 'fixed'; table.style.fontSize = '13px'; table.dataset.debug = 'm6-stats-table';
  const header = table.createTHead();
  // Chromium's UA thead if(media(...)) rule retains a fresh query on every recalc.
  // Keep the same screen/print values with one panel-owned query, released on disposal.
  const paged = matchMedia('(overflow-block: paged)');
  const pagination = () => { header.style.breakInside = paged.matches ? 'avoid' : 'auto'; };
  paged.addEventListener('change', pagination); pagination();
  const head = header.insertRow(); const headings: HTMLTableCellElement[] = [];
  for (const label of ['单位', '实际伤害', '护盾吸收', '有效治疗']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; th.style.overflowWrap = 'anywhere'; head.append(th); headings.push(th); }
  const body = table.createTBody();
  const detail = document.createElement('p'); detail.dataset.debug = 'm6-stats-details';
  const effects = document.createElement('ul'); effects.dataset.debug = 'm8-stats-statuses'; effects.style.overflowWrap = 'anywhere'; effects.style.margin = '0'; effects.style.paddingLeft = '18px';
  const disclosure = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '战斗事件明细'; summary.style.minHeight = '44px';
  const range = document.createElement('p'); const list = document.createElement('ol'); list.style.maxHeight = '260px'; list.style.overflowY = 'auto'; list.style.overflowWrap = 'anywhere'; disclosure.append(summary, range, list);
  const debug = document.createElement('details'); const debugSummary = document.createElement('summary'); debugSummary.textContent = '调试详情'; debugSummary.style.minHeight = '44px'; const debugText = document.createElement('pre'); debugText.style.whiteSpace = 'pre-wrap'; debugText.style.overflowWrap = 'anywhere'; debug.append(debugSummary, debugText);
  root.append(heading, explanation, selection, filter, table, detail, effects, disclosure, debug); host.append(root);
  let view: StatsView | null = null, rosterKey = '', disposed = false;
  const rows = new Map<string, { button: HTMLButtonElement; cells: HTMLTableCellElement[] }>();
  function renderEvents(): void {
    if (!view) return;
    const selected = selection.value; const visible: string[] = []; let count = 0;
    const shown = new Set(['packetDamage', 'heal', 'targetChanged', 'cast', 'shieldLayerChanged', 'statusChanged', 'activityChanged', 'statChanged', 'maxHpChanged', 'manaChanged', 'growth', 'kill', 'death', 'unitRevived', 'combatFinished', 'effectTriggered']);
    if (view.stats === null) {
      const online = view;
      for (let i = online.events.length - 1; i >= 0; i--) {
        const event = online.events[i];
        if (shown.has(event.type) && (!selected || viewIncludesUnit(event, selected)) && viewMatches(event, filter.value as EventFilter)) {
          count++; if (visible.length < 80) { const text = viewEventText(event, online.combat); if (text) visible.push(text); }
        }
      }
    } else for (let i = view.events.length - 1; i >= 0; i--) {
      const event = view.events[i];
      if (shown.has(event.type) && (!selected || includesUnit(event, selected)) && matches(event, filter.value as EventFilter)) {
        count++; if (visible.length < 80) { const text = eventText(event, view.combat); if (text) visible.push(text); }
      }
    }
    visible.reverse(); range.textContent = count > visible.length ? `显示最近 ${visible.length} 条，共 ${count} 条；${view.stats === null ? '完整事件账本保留在服务器。' : '完整事件保留在战斗档案中。'}` : `共 ${count} 条事件`;
    list.replaceChildren(...visible.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
  }
  /** Online detail: the view's current values and the event tally; sources, healing shares and statuses are not sent. */
  function renderViewDetail(online: ReplayStatsView): void {
    const unit = online.combat.units.find(value => value.id === selection.value);
    effects.replaceChildren();
    if (!unit) { detail.textContent = '选择单位查看生命、法力与伤害明细。'; debugText.textContent = `对局：${online.runId}\n战斗：${online.combat.combatId ?? ''}\n事件数：${online.events.length}`; return; }
    const totals = tallyViewEvents(online.events).find(value => value.unitId === unit.id) ?? zeroView(unit.id);
    detail.textContent = `${unitName(online.combat, unit.id)} · ${unit.alive ? '存活' : '阵亡'}；生命 ${unit.hp}/${unit.maxHp}；法力 ${unit.mana}/${unit.maxMana}；攻击力 ${unit.attackDamage}；法强 ${unit.abilityPower}；护甲 ${unit.armor}；魔抗 ${unit.magicResist}；物理实际伤害 ${totals.physicalHpDamage}；魔法实际伤害 ${totals.magicHpDamage}；真实实际伤害 ${totals.trueHpDamage}；受击护盾吸收 ${totals.shieldAbsorbed}；受到治疗 ${totals.healingReceived}；目标：${unitName(online.combat, unit.targetId)}`;
    debugText.textContent = `对局：${online.runId}\n战斗：${online.combat.combatId ?? ''}\n单位：${unit.id}\n内容：${unit.definitionId}`;
  }
  function renderDetail(): void {
    if (!view) return;
    if (view.stats === null) { renderViewDetail(view); return; }
    const unit = view.combat.units.find(value => value.id === selection.value);
    if (!unit) { effects.replaceChildren(); detail.textContent = '选择单位查看生命、法力、伤害来源与当前效果。'; debugText.textContent = `对局：${view.stats.runId}\n战斗：${view.stats.combatId}\n下个事件序号：${view.stats.nextEventSeq}`; return; }
    const totals = view.stats.units.find(value => value.unitId === unit.id) ?? zero(unit.id);
    const current = readCombatStats(unit, view.combat);
    const combatState = view.combat;
    const names = [...new Set((unit.sources ?? []).map(({ source }) => sourceName(combatState, { ownerId: source.ownerId, sourceKind: source.sourceKind, definitionId: source.sourceDefinitionId, instanceId: source.sourceInstanceId, effectIndex: source.effectIndex })))];
    detail.textContent = `${unitName(view.combat, unit.id)} · ${unit.alive ? '存活' : '阵亡'}；生命 ${unit.hp}/${unit.maxHp}；法力 ${unit.mana}/${unit.maxMana}；攻击力 ${current.attackDamage}；法强 ${current.abilityPower}；护甲 ${current.armor}；魔抗 ${current.magicResist}；物理实际伤害 ${totals.physicalHpDamage}；魔法实际伤害 ${totals.magicHpDamage}；真实实际伤害 ${totals.trueHpDamage ?? 0}；受击护盾吸收 ${totals.shieldAbsorbed}；有效治疗 ${totals.effectiveHealing}；过量治疗 ${totals.overhealing}；来源：${names.join('、') || '基础属性'}；目标：${unitName(view.combat, unit.targetId)}`;
    const combat = view.combat, rows = readUnitStatusRows(combat, unit.id);
    effects.replaceChildren(...(rows.length ? rows.map(row => { const item = document.createElement('li'); item.dataset.kind = row.kind; item.textContent = statusRowText(row, combat.tick, origin => sourceName(combat, origin)); return item; })
      : [Object.assign(document.createElement('li'), { textContent: '当前效果：无' })]));
    debugText.textContent = `对局：${view.stats.runId}\n战斗：${view.stats.combatId}\n单位：${unit.id}\n内容：${unit.definitionId}\n下个事件序号：${view.stats.nextEventSeq}`;
  }
  const selectChanged = () => { onSelect(selection.value || null); renderDetail(); renderEvents(); };
  const filterChanged = () => renderEvents();
  const rowClicked = (event: Event) => { const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-unit]'); if (target) { selection.value = target.dataset.unit ?? ''; selectChanged(); } };
  selection.addEventListener('change', selectChanged); filter.addEventListener('change', filterChanged); body.addEventListener('click', rowClicked);
  return {
    render(next) {
      if (disposed) return; view = next;
      // Online the totals are tallied from the replay's own events and healing by source is not sent: that column hides.
      const totalsOf: readonly { readonly unitId: string; readonly hpDamage: number; readonly shieldAbsorbed: number; readonly effectiveHealing?: number }[] = next.stats ? next.stats.units : tallyViewEvents(next.events);
      const online = next.stats === null;
      headings[3]!.hidden = online;
      const ids = [...new Set([...next.combat.units.map(unit => unit.id), ...totalsOf.map(unit => unit.unitId)])];
      const key = `${next.stats ? next.stats.runId : next.runId}/${next.stats ? next.stats.combatId : next.combat.combatId ?? ''}/${online}/${ids.join(',')}`;
      if (key !== rosterKey) {
        rosterKey = key; rows.clear(); body.replaceChildren(); selection.replaceChildren();
        const all = document.createElement('option'); all.value = ''; all.textContent = '全部单位'; selection.append(all);
        for (const id of ids) {
          const option = document.createElement('option'); option.value = id; option.textContent = unitName(next.combat, id); selection.append(option);
          const row = body.insertRow(); const nameCell = row.insertCell(); const button = document.createElement('button'); button.type = 'button'; button.dataset.unit = id; button.textContent = unitName(next.combat, id); button.style.minHeight = '44px'; button.style.minWidth = '44px'; button.style.width = '100%'; button.style.overflowWrap = 'anywhere'; nameCell.append(button);
          const cells = [row.insertCell(), row.insertCell(), row.insertCell()]; for (const cell of cells) cell.style.overflowWrap = 'anywhere'; rows.set(id, { button, cells });
        }
      }
      selection.value = next.selectedUnitId ?? '';
      for (const [id, row] of rows) {
        const totals = totalsOf.find(unit => unit.unitId === id) ?? zero(id);
        [totals.hpDamage, totals.shieldAbsorbed, totals.effectiveHealing ?? 0].forEach((value, i) => { row.cells[i].textContent = String(value); });
        row.cells[2].hidden = online; row.button.setAttribute('aria-pressed', String(selection.value === id));
      }
      renderDetail(); renderEvents();
    },
    dispose() { disposed = true; view = null; rows.clear(); paged.removeEventListener('change', pagination); selection.removeEventListener('change', selectChanged); filter.removeEventListener('change', filterChanged); body.removeEventListener('click', rowClicked); root.remove(); },
  };
}
