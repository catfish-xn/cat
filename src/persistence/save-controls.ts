import type { SaveStatus } from '../m6/contracts';
import { parseSeed } from './seed';
export interface SaveControlsCallbacks {
  onNewRandom(): void | Promise<void>;
  onNewFixed(seed: number): void | Promise<void>;
  onContinue(): void | Promise<void>;
  onImport(file: File): void | Promise<void>;
  onExport(): void | Promise<void>;
}
export interface SaveControlsView {
  startup: boolean; canContinue: boolean; seed: number; runId: string;
  busy: boolean; status: SaveStatus | null; hasActive: boolean;
}
export interface SaveControls { update(view: SaveControlsView): void; dispose(): void }
/** Stable DOM: updates never replace seed/file inputs or interrupt a user's typing. */
export function createSaveControls(host: HTMLElement, callbacks: SaveControlsCallbacks): SaveControls {
  const root = document.createElement('section'); root.className = 'm6-save-controls';
  root.setAttribute('aria-label', '对局与存档');
  const title = document.createElement('h2'); title.textContent = '开始与继续'; root.append(title);
  const seedLabel = document.createElement('label'); seedLabel.textContent = '固定种子 '; seedLabel.htmlFor = 'm6-seed-input';
  const seed = document.createElement('input'); seed.id = 'm6-seed-input'; seed.dataset.debug = 'm6-seed-input'; seed.type = 'text'; seed.inputMode = 'numeric'; seed.placeholder = '0 至 4294967295'; seed.setAttribute('aria-label', '固定种子'); seed.style.minHeight = '44px'; seed.style.maxWidth = '100%'; seed.style.boxSizing = 'border-box';
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
  const exporting = button('导出当前局', 'm6-export', callbacks.onExport);
  const fileLabel = document.createElement('label'); fileLabel.textContent = '导入对局文件 '; fileLabel.style.display = 'inline-block'; fileLabel.style.minHeight = '44px';
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.dataset.debug = 'm6-import'; file.style.minHeight = '44px'; file.style.maxWidth = '100%'; file.style.boxSizing = 'border-box'; file.setAttribute('aria-label', '导入对局文件');
  const change = () => { const selected = file.files?.[0]; file.value = ''; if (selected) invoke(() => callbacks.onImport(selected)); };
  file.addEventListener('change', change); listeners.push(() => file.removeEventListener('change', change)); fileLabel.append(file); root.append(fileLabel, run, status, error);
  const warning = document.createElement('p'); warning.textContent = '开始新局或导入将替换当前自动存档。需要保留当前进度时，请先导出当前局。'; root.append(warning);
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
    const s = view.status;
    status.textContent = s?.kind === 'saving' ? '保存中…' : s?.kind === 'saved' ? `最近保存成功：${new Date(s.at).toLocaleTimeString()}` : s?.kind === 'failed' ? `保存失败：${s.message}。仍可导出当前局。` : '';
  }
  return { update(next) { view = { ...next }; render(); }, dispose() { disposed = true; for (const remove of listeners) remove(); root.remove(); } };
}
