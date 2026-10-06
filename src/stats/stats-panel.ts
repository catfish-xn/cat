import type { CombatEvent, CombatOrigin, CombatState } from '../simulation/combat-types';
import { readCombatStats } from '../simulation/combat-s13';
import { UNIT_DEFINITIONS } from '../simulation/units';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import type { BattleStats, UnitTotals } from './aggregate';
import { displayUnitName } from '../rendering/display-names';
export interface StatsView { readonly stats: BattleStats; readonly combat: CombatState; readonly events: readonly CombatEvent[]; readonly selectedUnitId: string | null }
export interface StatsPanel { render(view: StatsView): void; dispose(): void }
type EventFilter = 'all' | 'damage' | 'heal' | 'shield' | 'target' | 'skill';
const SOURCE_NAMES: Record<CombatOrigin['sourceKind'], string> = { attack: '普攻', ability: '技能', item: '装备', trait: '羁绊', augment: '强化', anomaly: '异常', enemyGrowth: '敌方成长' };
const STATUS_NAMES: Record<string, string> = { stun: '眩晕', damageReduction: '伤害减免', armorReduction: '护甲削减', resistanceFlat: '双抗提升', attackSpeed: '攻速提升', abilityPower: '法强提升', channel: '引导', redirect: '伤害分担' };
function unitName(combat: CombatState, id: string | null): string {
  if (!id) return '无';
  const unit = combat.units.find(value => value.id === id);
  return unit ? `${displayUnitName(unit.definitionId)} ${unit.starLevel}星` : '历史单位';
}
function sourceName(combat: CombatState, source: CombatOrigin): string {
  const catalog = source.sourceKind === 'item' ? ITEM_DEFINITIONS : source.sourceKind === 'trait' ? TRAIT_DEFINITIONS : source.sourceKind === 'augment' ? AUGMENT_DEFINITIONS : source.sourceKind === 'anomaly' ? ANOMALY_DEFINITIONS : UNIT_DEFINITIONS;
  const name = ['attack', 'ability', 'enemyGrowth'].includes(source.sourceKind)
    ? (UNIT_DEFINITIONS[source.definitionId] ? displayUnitName(source.definitionId) : undefined) : catalog[source.definitionId]?.name;
  return `${unitName(combat, source.ownerId)} · ${SOURCE_NAMES[source.sourceKind]}${name ? `（${name}）` : ''}`;
}
function includesUnit(event: CombatEvent, id: string): boolean {
  if ('unitId' in event && event.unitId === id || 'source' in event && event.source.ownerId === id) return true;
  if (event.type === 'attack') return event.attackerId === id || event.targetId === id;
  if (event.type === 'cast') return event.sourceId === id || event.targetIds.includes(id);
  if (event.type === 'targetChanged') return event.before === id || event.after === id;
  if (event.type === 'shieldLayerChanged') return event.layer.source.ownerId === id;
  if (event.type === 'statusChanged') return event.status.source.ownerId === id;
  return event.type === 'effectTriggered' && event.targetId === id;
}
function matches(event: CombatEvent, filter: EventFilter): boolean {
  return filter === 'all' || filter === 'damage' && event.type === 'packetDamage' || filter === 'heal' && event.type === 'heal'
    || filter === 'shield' && event.type === 'shieldLayerChanged' || filter === 'target' && event.type === 'targetChanged'
    || filter === 'skill' && ['cast', 'effectTriggered', 'statusChanged', 'statChanged', 'growth'].includes(event.type);
}
function eventText(event: CombatEvent, combat: CombatState): string | null {
  const name = (id: string | null) => unitName(combat, id);
  const prefix = `第 ${event.tick} tick：`;
  switch (event.type) {
    case 'packetDamage': return `${prefix}${sourceName(combat, event.source)} → ${name(event.unitId)}，${event.damageType === 'physical' ? '物理' : '魔法'}实际伤害 ${event.hpDamage}，护盾吸收 ${event.absorbed}${event.redirected ? '（分担）' : ''}${event.critical ? '（暴击）' : ''}`;
    case 'heal': return `${prefix}${sourceName(combat, event.source)} → ${name(event.unitId)}，有效治疗 ${event.actual}，过量治疗 ${event.overheal}`;
    case 'targetChanged': return `${prefix}${name(event.unitId)} 目标由 ${name(event.before)} 变为 ${name(event.after)}`;
    case 'cast': return `${prefix}${name(event.sourceId)} 施放技能，目标 ${event.targetIds.map(name).join('、')}`;
    case 'shieldLayerChanged': return `${prefix}${sourceName(combat, event.layer.source)} → ${name(event.unitId)}，护盾${{ granted: '生成', absorbed: '吸收伤害', expired: '到期', decayed: '衰减' }[event.reason]}，剩余 ${event.layer.remaining}`;
    case 'statusChanged': return `${prefix}${sourceName(combat, event.status.source)} → ${name(event.unitId)}，${STATUS_NAMES[event.status.kind] ?? '效果'}${event.reason === 'applied' ? '生效' : '结束'}`;
    case 'statChanged': return `${prefix}${sourceName(combat, event.source)} → ${name(event.unitId)}，${{ attackSpeedBps: '攻速', abilityPower: '法强', range: '射程' }[event.stat]} ${event.before} → ${event.after}`;
    case 'growth': return `${prefix}${name(event.unitId)} 永久攻击力增加 ${event.amountBps / 100}%（累计 ${event.totalBps / 100}%）`;
    case 'kill': return `${prefix}${sourceName(combat, event.source)} 击败 ${name(event.unitId)}`;
    case 'death': return `${prefix}${name(event.unitId)} 阵亡`;
    case 'combatFinished': return `${prefix}战斗结束：${{ playerWin: '我方获胜', enemyWin: '敌方获胜', draw: '平局' }[event.result]}`;
    case 'effectTriggered': return `${prefix}${name(event.source.ownerId)} 的${SOURCE_NAMES[event.source.sourceKind]}生效，目标 ${name(event.targetId)}`;
    default: return null;
  }
}
const zero = (unitId: string): UnitTotals => ({ unitId, hpDamage: 0, physicalHpDamage: 0, magicHpDamage: 0, shieldAbsorbed: 0, effectiveHealing: 0, overhealing: 0 });
/** Read-only DOM component; filtering never modifies authoritative event or stat arrays. */
export function createStatsPanel(host: HTMLElement, onSelect: (id: string | null) => void): StatsPanel {
  const root = document.createElement('section'); root.className = 'm6-stats-panel'; root.setAttribute('aria-label', '战斗统计');
  const heading = document.createElement('h2'); heading.textContent = '战斗统计';
  const explanation = document.createElement('p'); explanation.textContent = '伤害统计实际生命损失；护盾按受击单位统计吸收量；治疗按来源统计有效恢复。';
  const selection = document.createElement('select'); selection.style.minHeight = '44px'; selection.style.minWidth = '44px'; selection.setAttribute('aria-label', '统计选中单位'); selection.dataset.debug = 'm6-stats-unit';
  const filter = document.createElement('select'); filter.style.minHeight = '44px'; filter.style.minWidth = '44px'; filter.setAttribute('aria-label', '战斗事件类型'); filter.dataset.debug = 'm6-stats-filter';
  for (const [value, label] of [['all', '全部事件'], ['damage', '实际伤害'], ['heal', '治疗'], ['shield', '护盾'], ['target', '目标变化'], ['skill', '技能与效果']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; filter.append(option); }
  const table = document.createElement('table'); table.style.width = '100%'; table.style.tableLayout = 'fixed'; table.style.fontSize = '13px'; table.dataset.debug = 'm6-stats-table';
  const head = table.createTHead().insertRow(); for (const label of ['单位', '实际伤害', '护盾吸收', '有效治疗']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; th.style.overflowWrap = 'anywhere'; head.append(th); }
  const body = table.createTBody();
  const detail = document.createElement('p'); detail.dataset.debug = 'm6-stats-details';
  const disclosure = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '战斗事件明细'; summary.style.minHeight = '44px';
  const range = document.createElement('p'); const list = document.createElement('ol'); list.style.maxHeight = '260px'; list.style.overflowY = 'auto'; list.style.overflowWrap = 'anywhere'; disclosure.append(summary, range, list);
  const debug = document.createElement('details'); const debugSummary = document.createElement('summary'); debugSummary.textContent = '调试详情'; debugSummary.style.minHeight = '44px'; const debugText = document.createElement('pre'); debugText.style.whiteSpace = 'pre-wrap'; debugText.style.overflowWrap = 'anywhere'; debug.append(debugSummary, debugText);
  root.append(heading, explanation, selection, filter, table, detail, disclosure, debug); host.append(root);
  let view: StatsView | null = null, rosterKey = '', disposed = false;
  const rows = new Map<string, { button: HTMLButtonElement; cells: HTMLTableCellElement[] }>();
  function renderEvents(): void {
    if (!view) return;
    const selected = selection.value; const visible: string[] = []; let count = 0;
    const shown = new Set(['packetDamage', 'heal', 'targetChanged', 'cast', 'shieldLayerChanged', 'statusChanged', 'statChanged', 'growth', 'kill', 'death', 'combatFinished', 'effectTriggered']);
    for (let i = view.events.length - 1; i >= 0; i--) {
      const event = view.events[i];
      if (shown.has(event.type) && (!selected || includesUnit(event, selected)) && matches(event, filter.value as EventFilter)) {
        count++; if (visible.length < 80) { const text = eventText(event, view.combat); if (text) visible.push(text); }
      }
    }
    visible.reverse(); range.textContent = count > visible.length ? `显示最近 ${visible.length} 条，共 ${count} 条；完整事件保留在战斗档案中。` : `共 ${count} 条事件`;
    list.replaceChildren(...visible.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
  }
  function renderDetail(): void {
    if (!view) return;
    const unit = view.combat.units.find(value => value.id === selection.value);
    if (!unit) { detail.textContent = '选择单位查看生命、法力、伤害来源与当前效果。'; debugText.textContent = `对局：${view.stats.runId}\n战斗：${view.stats.combatId}\n下个事件序号：${view.stats.nextEventSeq}`; return; }
    const totals = view.stats.units.find(value => value.unitId === unit.id) ?? zero(unit.id);
    const current = readCombatStats(unit, view.combat);
    const names = [...new Set((unit.sources ?? []).map(({ source }) => sourceName(view!.combat, { ownerId: source.ownerId, sourceKind: source.sourceKind, definitionId: source.sourceDefinitionId, instanceId: source.sourceInstanceId, effectIndex: source.effectIndex })))];
    detail.textContent = `${unitName(view.combat, unit.id)} · ${unit.alive ? '存活' : '阵亡'}；生命 ${unit.hp}/${unit.maxHp}；法力 ${unit.mana}/${unit.maxMana}；攻击力 ${current.attackDamage}；法强 ${current.abilityPower}；护甲 ${current.armor}；魔抗 ${current.magicResist}；物理实际伤害 ${totals.physicalHpDamage}；魔法实际伤害 ${totals.magicHpDamage}；有效治疗 ${totals.effectiveHealing}；过量治疗 ${totals.overhealing}；当前效果：${unit.statuses?.map(s => STATUS_NAMES[s.kind] ?? '效果').join('、') || '无'}；来源：${names.join('、') || '基础属性'}；目标：${unitName(view.combat, unit.targetId)}`;
    debugText.textContent = `对局：${view.stats.runId}\n战斗：${view.stats.combatId}\n单位：${unit.id}\n内容：${unit.definitionId}\n下个事件序号：${view.stats.nextEventSeq}`;
  }
  const selectChanged = () => { onSelect(selection.value || null); renderDetail(); renderEvents(); };
  const filterChanged = () => renderEvents();
  const rowClicked = (event: Event) => { const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-unit]'); if (target) { selection.value = target.dataset.unit ?? ''; selectChanged(); } };
  selection.addEventListener('change', selectChanged); filter.addEventListener('change', filterChanged); body.addEventListener('click', rowClicked);
  return {
    render(next) {
      if (disposed) return; view = next;
      const ids = [...new Set([...next.combat.units.map(unit => unit.id), ...next.stats.units.map(unit => unit.unitId)])];
      const key = `${next.stats.runId}/${next.stats.combatId}/${ids.join(',')}`;
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
      for (const [id, row] of rows) { const totals = next.stats.units.find(unit => unit.unitId === id) ?? zero(id); [totals.hpDamage, totals.shieldAbsorbed, totals.effectiveHealing].forEach((value, i) => { row.cells[i].textContent = String(value); }); row.button.setAttribute('aria-pressed', String(selection.value === id)); }
      renderDetail(); renderEvents();
    },
    dispose() { disposed = true; view = null; rows.clear(); selection.removeEventListener('change', selectChanged); filter.removeEventListener('change', filterChanged); body.removeEventListener('click', rowClicked); root.remove(); },
  };
}
