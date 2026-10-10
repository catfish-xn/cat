import type { SaveStatus } from '../m6/contracts';
import type { CompatibilityView, LegacyListResult, LegacyRecord, M8SaveControlsCallbacks } from '../simulation/m8/ui-contracts';
import { parseSeed } from './seed';
/** onExport stays the current-run adapter; U7 callbacks are optional additions (M8_UI_CONTRACT §6 A13). */
export interface SaveControlsCallbacks extends Partial<M8SaveControlsCallbacks> {
  onNewRandom(): void | Promise<void>;
  onNewFixed(seed: number): void | Promise<void>;
  onContinue(): void | Promise<void>;
  onImport(file: File): void | Promise<void>;
  onExport(): void | Promise<void>;
  onListLegacy?(): Promise<LegacyListResult>;
}
/** What a new match or import would actually replace; null when nothing is replaced. */
export interface ReplacementImpact { readonly roundName: string; readonly completedBattles: number; readonly gameOver: boolean }
export interface SaveControlsView {
  startup: boolean; canContinue: boolean; seed: number; runId: string;
  busy: boolean; status: SaveStatus | null; hasActive: boolean;
  /** Result of the latest slot read or file selection, from B9 version routing; never inferred here. */
  compatibility?: CompatibilityView | null;
  replacement?: ReplacementImpact | null;
}
const REJECTED: Record<Extract<CompatibilityView, { status: 'rejected' }>['reason'], string> = {
  'unsupported-version': '文件版本不受支持', 'digest-mismatch': '内容摘要与当前版本不一致',
  'invalid-data': '文件数据损坏或校验未通过', 'capacity-exceeded': '文件超过容量上限',
};
const LEGACY_FAILURE: Record<string, string> = {
  'not-found': '找不到该记录，请刷新列表', 'stale-reference': '记录内容已变化，请刷新列表后重新选择',
  'invalid-record': '记录已损坏，无法导出', 'missing-history': '记录缺少战斗历史，无法导出',
  unavailable: '旧版存储不可用', 'read-failed': '读取旧版存储失败',
};
export function compatibilityText(view: CompatibilityView | null | undefined): string {
  if (!view) return '';
  if (view.status === 'current') return `存档版本 ${view.fileRulesVersion}：可继续对局与回放。`;
  if (view.status === 'legacy-preserved') return `这是旧版（${view.fileRulesVersion}）对局，只能原样保全导出，不能继续或回放；请开始新局。`;
  return `未导入：${REJECTED[view.reason]}（文件规则 ${view.fileRulesVersion ?? '未知'}，当前 ${view.currentRulesVersion}）。当前对局保持不变。`;
}
function download(bytes: Uint8Array, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
export interface SaveControls { update(view: SaveControlsView): void; releaseRunResources(): void; dispose(): void }
/** Ordinary updates retain editing owners; an accepted run handoff releases the old undo history. */
export function createSaveControls(host: HTMLElement, callbacks: SaveControlsCallbacks): SaveControls {
  const root = document.createElement('section'); root.className = 'm6-save-controls';
  root.setAttribute('aria-label', '对局与存档');
  const title = document.createElement('h2'); title.textContent = '开始与继续'; root.append(title);
  const seedLabel = document.createElement('label'); seedLabel.textContent = '固定种子 '; seedLabel.htmlFor = 'm6-seed-input';
  let seed = document.createElement('input'); seed.id = 'm6-seed-input'; seed.dataset.debug = 'm6-seed-input'; seed.type = 'text'; seed.inputMode = 'numeric'; seed.placeholder = '0 至 4294967295'; seed.setAttribute('aria-label', '固定种子'); seed.style.minHeight = '44px'; seed.style.maxWidth = '100%'; seed.style.boxSizing = 'border-box';
  seedLabel.append(seed); root.append(seedLabel);
  const buttons: HTMLButtonElement[] = [];
  const listeners: (() => void)[] = [];
  let disposed = false, pending = false, view: SaveControlsView | null = null;
  const error = document.createElement('p'); error.setAttribute('role', 'alert');
  const run = document.createElement('p'); run.dataset.debug = 'm6-current-seed';
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.dataset.debug = 'm6-save-status';
  function invoke(action: () => void | Promise<void>): void {
    if (pending || view?.busy || disposed) return;
    error.textContent = ''; pending = true; render();
    void Promise.resolve().then(action).catch(reason => { if (!disposed) error.textContent = reason instanceof Error ? reason.message : String(reason); }).finally(() => { pending = false; if (!disposed) render(); });
  }
  function button(text: string, debug: string, action: () => void | Promise<void>): HTMLButtonElement {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.debug = debug;
    b.style.minHeight = '44px'; b.style.minWidth = '44px'; b.style.margin = '4px';
    const click = () => invoke(action); b.addEventListener('click', click); listeners.push(() => b.removeEventListener('click', click));
    buttons.push(b); root.append(b); return b;
  }
  button('随机新局', 'm6-random-start', callbacks.onNewRandom);
  button('以固定种子开始', 'm6-fixed-start', () => { const result = parseSeed(seed.value); if (!result.ok) { error.textContent = result.reason; return; } return callbacks.onNewFixed(result.seed); });
  const continuing = button('继续对局', 'm6-continue', callbacks.onContinue);
  const exporting = button('导出当前局', 'm6-export', callbacks.onExportCurrent ?? callbacks.onExport);
  const fileLabel = document.createElement('label'); fileLabel.textContent = '导入对局文件 '; fileLabel.style.display = 'inline-block'; fileLabel.style.minHeight = '44px';
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.dataset.debug = 'm6-import'; file.style.minHeight = '44px'; file.style.maxWidth = '100%'; file.style.boxSizing = 'border-box'; file.setAttribute('aria-label', '导入对局文件');
  const change = () => { const selected = file.files?.[0]; file.value = ''; if (selected) invoke(() => callbacks.onImport(selected)); };
  file.addEventListener('change', change); listeners.push(() => file.removeEventListener('change', change)); fileLabel.append(file); root.append(fileLabel, run, status, error);
  const warning = document.createElement('p'); warning.textContent = '开始新局或导入将替换当前自动存档。需要保留当前进度时，请先导出当前局。'; root.append(warning);
  const compatibility = document.createElement('p'); compatibility.dataset.debug = 'm8-compatibility'; root.append(compatibility);
  const legacy = callbacks.onListLegacy && callbacks.onExportLegacy ? createLegacySection(root, callbacks.onListLegacy, callbacks.onExportLegacy, listeners, () => disposed) : null;
  host.append(root);
  function render(): void {
    if (!view) return;
    const busy = pending || view.busy;
    for (const b of buttons) b.disabled = busy;
    seed.disabled = busy; file.disabled = busy;
    continuing.disabled = busy || !view.canContinue; continuing.hidden = !view.startup && !view.canContinue;
    exporting.disabled = busy || (!view.hasActive && !view.canContinue);
    title.textContent = view.startup ? '开始与继续' : '对局与存档';
    run.textContent = view.hasActive ? `本局种子：${view.seed}` : '选择继续对局，或开始一个新局。';
    run.title = view.hasActive ? `对局身份：${view.runId}` : '';
    warning.hidden = !view.hasActive && !view.canContinue;
    const impact = view.replacement;
    warning.textContent = impact ? `开始新局或导入将替换当前自动存档（${impact.roundName}，已完成 ${impact.completedBattles} 场战斗${impact.gameOver ? '，已终局' : ''}）。旧版（M7）记录不受影响。需要保留当前进度时，请先导出当前局。`
      : '开始新局或导入将替换当前自动存档。需要保留当前进度时，请先导出当前局。';
    compatibility.textContent = compatibilityText(view.compatibility);
    compatibility.hidden = !compatibility.textContent;
    const s = view.status;
    status.textContent = s?.kind === 'saving' ? '保存中…' : s?.kind === 'saved' ? `最近保存成功：${new Date(s.at).toLocaleTimeString()}` : s?.kind === 'failed' ? `保存失败：${s.message}。仍可导出当前局。` : '';
  }
  return {
    update(next) { view = { ...next }; render(); },
    releaseRunResources() {
      if (disposed) return;
      // Detaching the old editable owner releases its browser undo/redo entries.
      // Preserve the field's value, attributes, focus and selection; callbacks read the new owner.
      const previous = seed, focused = document.activeElement === previous;
      const start = previous.selectionStart, end = previous.selectionEnd, direction = previous.selectionDirection;
      seed = previous.cloneNode(true) as HTMLInputElement;
      seed.value = previous.value;
      previous.replaceWith(seed);
      if (focused) seed.focus({ preventScroll: true });
      if (start !== null && end !== null) seed.setSelectionRange(start, end, direction ?? undefined);
    },
    dispose() { disposed = true; legacy?.dispose(); for (const remove of listeners) remove(); root.remove(); },
  };
}
/** Read-only legacy catalogue and per-record export. A late response only belongs to its own request. */
function createLegacySection(root: HTMLElement, list: () => Promise<LegacyListResult>, exportLegacy: NonNullable<SaveControlsCallbacks['onExportLegacy']>,
  listeners: (() => void)[], disposed: () => boolean): { dispose(): void } {
  const section = document.createElement('section'); section.dataset.debug = 'm8-legacy-records'; section.setAttribute('aria-label', '旧版（M7）记录');
  const heading = document.createElement('h3'); heading.textContent = '旧版（M7）记录';
  const note = document.createElement('p'); note.textContent = '旧版记录只读保全，可原样导出为原格式文件，不能在新版本中继续或回放。';
  const items = document.createElement('ul'); items.dataset.debug = 'm8-legacy-list'; items.style.paddingLeft = '0'; items.style.listStyle = 'none';
  const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); feedback.dataset.debug = 'm8-legacy-status';
  const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = '刷新旧版记录'; refresh.dataset.debug = 'm8-legacy-refresh';
  refresh.style.minHeight = '44px'; refresh.style.minWidth = '44px'; refresh.style.margin = '4px';
  section.append(heading, note, refresh, items, feedback); root.append(section);
  let listRequest = 0, exportRequest = 0, selected: string | null = null;
  const load = async () => {
    const id = ++listRequest; feedback.textContent = '正在读取旧版记录…';
    let result: LegacyListResult;
    try { result = await list(); } catch { result = { ok: false, namespace: 'hex-autobattler-m6', reason: 'read-failed' }; }
    if (disposed() || id !== listRequest) return;
    items.replaceChildren();
    if (!result.ok) { feedback.textContent = `无法列出旧版记录：${LEGACY_FAILURE[result.reason]}。这不表示没有旧记录。`; return; }
    feedback.textContent = result.records.length ? `共 ${result.records.length} 条旧版记录。` : '没有旧版记录。';
    for (const record of result.records) items.append(row(record));
  };
  const row = (record: LegacyRecord): HTMLLIElement => {
    const li = document.createElement('li'); li.dataset.runId = record.recordRef.runId;
    const created = Number.isFinite(Date.parse(record.createdAt)) ? new Date(record.createdAt).toLocaleString() : '时间未知';
    const label = document.createElement('span');
    label.textContent = `${record.location === 'active' ? '旧版当前局' : '旧版历史局'} · ${created} · ${record.rulesVersion}${record.reason ? ` · ${LEGACY_FAILURE[record.reason]}` : ''}`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '原样导出'; button.dataset.debug = 'm8-legacy-export';
    button.style.minHeight = '44px'; button.style.minWidth = '44px'; button.style.margin = '4px'; button.disabled = !record.canExportOriginal;
    button.setAttribute('aria-label', `原样导出旧版记录 ${record.recordRef.runId}`);
    button.onclick = () => {
      const requestId = `legacy-export-${++exportRequest}`; selected = requestId;
      feedback.textContent = '正在导出旧版记录…';
      void exportLegacy({ requestId, recordRef: record.recordRef }).then(result => {
        if (disposed() || result.requestId !== selected) return;
        if (result.ok) { download(result.bytes, result.fileName, result.mediaType); feedback.textContent = `已原样导出：${result.fileName}`; }
        else feedback.textContent = `导出失败：${LEGACY_FAILURE[result.reason]}。`;
      }, () => { if (!disposed() && requestId === selected) feedback.textContent = `导出失败：${LEGACY_FAILURE['read-failed']}。`; });
    };
    li.append(label, button); return li;
  };
  const click = () => { void load(); };
  refresh.addEventListener('click', click); listeners.push(() => refresh.removeEventListener('click', click));
  void load();
  return { dispose() { listRequest++; selected = null; items.querySelectorAll('button').forEach(b => { b.onclick = null; }); section.remove(); } };
}
