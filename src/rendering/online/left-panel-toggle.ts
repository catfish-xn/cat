/**
 * Online left column fold (TFT keeps only the trait list on the left): a button at the top of #panels-root hides the
 * strategy panel and the legal notice, leaving the trait column in a narrower rail so the board column gets the room.
 * Presentation only; the choice is a per-viewer convenience kept in localStorage when the browser allows it.
 */
import { PANEL_STATUS_EVENT } from '../strategy-panel';
import { readRenderMode } from '../render-mode';

const STORAGE_KEY = 'hex-online-left-collapsed';
const TOAST_MS = 4_000;

/** Stored choice, or null when none: 3D (board fills the window) then starts folded, 2D open. */
function readStored(): boolean | null {
  try { const value = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY); return value === null ? null : value === '1'; } catch { return null; }
}
function writeStored(collapsed: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch { /* storage blocked */ }
}

export class LeftPanelToggle {
  readonly button: HTMLButtonElement;
  private collapsed: boolean;
  /** While folded, the panel's status line (refusals, phase lines) shows here over the board instead. */
  private readonly toast: HTMLElement;
  private toastTimer: number | null = null;
  private readonly onStatus = (event: Event) => {
    const text = (event as CustomEvent<string>).detail;
    if (!this.collapsed || !text) return;
    this.toast.textContent = text; this.toast.hidden = false;
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toastTimer = null; this.toast.hidden = true; }, TOAST_MS);
  };
  constructor(host: HTMLElement | null = document.getElementById('panels-root')) {
    this.toast = document.createElement('p'); this.toast.className = 'left-panel-toast'; this.toast.dataset.debug = 'online:status-toast';
    this.toast.setAttribute('role', 'status'); this.toast.hidden = true;
    (document.getElementById('board-frame') ?? document.body).append(this.toast);
    document.addEventListener(PANEL_STATUS_EVENT, this.onStatus);
    this.button = document.createElement('button'); this.button.type = 'button'; this.button.className = 'left-panel-toggle';
    this.button.dataset.debug = 'online:left-toggle'; this.button.setAttribute('aria-controls', 'strategy-root');
    this.button.addEventListener('click', () => this.set(!this.collapsed));
    host?.prepend(this.button);
    this.collapsed = readStored() ?? readRenderMode(window.location.search) === '3d'; this.apply();
  }
  get isCollapsed(): boolean { return this.collapsed; }
  set(collapsed: boolean): void { if (collapsed === this.collapsed) return; this.collapsed = collapsed; writeStored(collapsed); this.apply(); }
  private apply(): void {
    if (this.collapsed) document.body.dataset.onlineLeft = 'collapsed'; else delete document.body.dataset.onlineLeft;
    if (!this.collapsed) this.toast.hidden = true;
    this.button.textContent = this.collapsed ? '展开面板 ›' : '‹ 收起面板';
    this.button.setAttribute('aria-expanded', String(!this.collapsed));
    this.button.title = this.collapsed ? '展开左侧操作面板（装备、部署）' : '收起左侧操作面板，只留羁绊列表';
  }
  dispose(): void {
    document.removeEventListener(PANEL_STATUS_EVENT, this.onStatus);
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.button.remove(); this.toast.remove(); delete document.body.dataset.onlineLeft;
  }
}
