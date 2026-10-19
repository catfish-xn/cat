/**
 * Online left column fold (TFT keeps only the trait list on the left): a button at the top of #panels-root hides the
 * strategy panel and the legal notice, leaving the trait column in a narrower rail so the board column gets the room.
 * Presentation only; the choice is a per-viewer convenience kept in localStorage when the browser allows it.
 */
const STORAGE_KEY = 'hex-online-left-collapsed';

function readStored(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function writeStored(collapsed: boolean): void {
  try { if (collapsed) localStorage.setItem(STORAGE_KEY, '1'); else localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
}

export class LeftPanelToggle {
  readonly button: HTMLButtonElement;
  private collapsed: boolean;
  constructor(host: HTMLElement | null = document.getElementById('panels-root')) {
    this.button = document.createElement('button'); this.button.type = 'button'; this.button.className = 'left-panel-toggle';
    this.button.dataset.debug = 'online:left-toggle'; this.button.setAttribute('aria-controls', 'strategy-root');
    this.button.addEventListener('click', () => this.set(!this.collapsed));
    host?.prepend(this.button);
    this.collapsed = readStored(); this.apply();
  }
  get isCollapsed(): boolean { return this.collapsed; }
  set(collapsed: boolean): void { if (collapsed === this.collapsed) return; this.collapsed = collapsed; writeStored(collapsed); this.apply(); }
  private apply(): void {
    if (this.collapsed) document.body.dataset.onlineLeft = 'collapsed'; else delete document.body.dataset.onlineLeft;
    this.button.textContent = this.collapsed ? '» 展开面板' : '« 收起面板';
    this.button.setAttribute('aria-expanded', String(!this.collapsed));
    this.button.title = this.collapsed ? '展开左侧操作面板（装备、部署、构筑、记录）' : '收起左侧操作面板，只留羁绊列表';
  }
  dispose(): void { this.button.remove(); delete document.body.dataset.onlineLeft; }
}
