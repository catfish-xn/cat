import { ROOM_LITTLE_LEGENDS, ROOM_CAPACITY, type LobbyView } from './protocol';
import { watchLegendPicker, type LegendPicker } from '../board-feed';
import { isLittleLegend, readLegendChoice, writeLegendChoice } from '../legend-choice';

export interface LobbyActions { join(name: string): void; leave(): void; start(): void }
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
/** Matchmaking page: one 匹配 button, the queue (up to 8), 开始. No rooms, no invite codes. */
export class Lobby {
  readonly root: HTMLElement;
  private name: HTMLInputElement;
  private list: HTMLElement;
  private error: HTMLElement;
  private joinButton: HTMLButtonElement;
  private leaveButton: HTMLButtonElement;
  private startButton: HTMLButtonElement;
  private count: HTMLElement;
  private connectionLine: HTMLElement;
  /** 对局正在进行: a match holds the room; with every player gone, the seconds until the server frees it. */
  private busyLine: HTMLElement;
  private busyTimer: number | null = null;
  /** 外观: only while a mounted 3D layer with an asset root offers its picker, and only before joining (as in TFT, no change in a match). */
  private looksButton: HTMLButtonElement;
  private picker: LegendPicker | null = null;
  private closePicker: (() => void) | null = null;
  private joined = false;
  private readonly unwatchPicker: () => void;
  constructor(host: HTMLElement, private readonly actions: LobbyActions) {
    this.root = element('section', '', 'online-lobby'); this.root.id = 'lobby-root'; this.root.setAttribute('aria-label', '匹配');
    const card = element('div', '', 'lobby-card');
    card.append(element('h1', 'HEX / 自动战棋 · 八人联机'), element('p', '点击匹配进入队列；人数不足时由机器人补满八个席位。', 'lobby-hint'));
    const form = element('div', '', 'lobby-form');
    this.name = element('input'); this.name.type = 'text'; this.name.maxLength = 12; this.name.placeholder = '昵称'; this.name.dataset.debug = 'online:name';
    try { this.name.value = localStorage.getItem('hex-online-name') ?? ''; } catch { /* storage unavailable */ }
    this.joinButton = this.button('online:join', '匹配', () => { try { localStorage.setItem('hex-online-name', this.name.value); } catch { /* ignore */ } this.actions.join(this.name.value); });
    this.joinButton.classList.add('primary-action');
    this.leaveButton = this.button('online:leave', '退出队列', () => this.actions.leave());
    this.looksButton = this.button('online:looks', '外观 · 小小英雄', () => this.openPicker());
    this.looksButton.classList.add('lobby-looks');
    form.append(this.name, this.joinButton, this.leaveButton, this.looksButton); card.append(form);
    const plannerError = element('p', '', 'lobby-error'); plannerError.hidden = true; plannerError.setAttribute('role', 'alert');
    const plannerFailed = (text: string) => { plannerError.textContent = text; plannerError.hidden = false; };
    const planner = this.button('planner:open', '阵容规划', () => {
      import('../../presentation/team-planner/team-planner').then(module => {
        try { module.openPlanner(planner); plannerError.hidden = true; }
        catch { plannerFailed('阵容规划打开失败，请重试'); }
      }, () => plannerFailed('阵容规划加载失败，请重试'));
    }); form.append(planner); card.append(plannerError);
    this.count = element('p', '', 'lobby-count'); card.append(this.count);
    this.list = element('ol', '', 'lobby-queue'); this.list.setAttribute('aria-label', '队列'); card.append(this.list);
    this.busyLine = element('p', '', 'lobby-busy'); this.busyLine.dataset.debug = 'online:lobby-busy'; this.busyLine.setAttribute('role', 'status'); this.busyLine.hidden = true;
    card.append(this.busyLine);
    this.error = element('p', '', 'lobby-error'); this.error.setAttribute('role', 'alert'); card.append(this.error);
    this.startButton = this.button('online:start', '开始对局', () => this.actions.start()); this.startButton.classList.add('primary-action', 'lobby-start');
    card.append(this.startButton);
    this.connectionLine = element('p', '', 'lobby-connection'); this.connectionLine.dataset.debug = 'online:lobby-connection'; this.connectionLine.hidden = true;
    card.append(this.connectionLine);
    this.root.append(card); host.append(this.root);
    this.unwatchPicker = watchLegendPicker(picker => { this.picker = picker; if (!picker) this.hidePicker(); this.syncLooks(); });
  }
  private syncLooks() { this.looksButton.hidden = !this.picker || this.joined; }
  private openPicker() {
    if (!this.picker || this.closePicker) return;
    this.closePicker = this.picker(document.body, { choices: ROOM_LITTLE_LEGENDS, current: readLegendChoice(),
      pick: id => { if (isLittleLegend(id)) writeLegendChoice(id); }, closed: () => { this.closePicker = null; } });
  }
  private hidePicker() { const close = this.closePicker; this.closePicker = null; close?.(); }
  private button(name: string, label: string, action: () => void) { const b = element('button', label); b.type = 'button'; b.dataset.debug = name; b.addEventListener('click', action); return b; }
  render(view: LobbyView): void {
    // No queue to join (a build without a room, local-room-unavailable.ts): no 队列 / 机器人 line.
    this.count.hidden = !view.capacity;
    this.count.textContent = `队列 ${view.queue.length} / ${view.capacity}${view.queue.length < ROOM_CAPACITY ? ` · 开局时补 ${ROOM_CAPACITY - view.queue.length} 个机器人` : ' · 已满'}`;
    this.list.replaceChildren(...view.queue.map(entry => {
      const item = element('li', '', `queue-entry${entry.me ? ' me' : ''}`); item.dataset.debug = 'online:queue-entry';
      item.append(element('span', entry.name, 'queue-name'), element('span', entry.me ? '我' : '真人', 'queue-kind')); return item;
    }));
    this.error.textContent = view.error ?? ''; this.error.hidden = !view.error;
    this.joinButton.hidden = view.joined; this.name.hidden = view.joined; this.leaveButton.hidden = !view.joined;
    this.startButton.hidden = !view.joined; this.startButton.disabled = !view.canStart;
    this.joined = view.joined; if (view.joined) this.hidePicker(); this.syncLooks();
    this.renderBusy(view.busy ?? null);
  }
  /**
   * The room is taken by a running match. When every player of it has disconnected the server frees it after its abandon
   * window (CAT_ABANDON_SEC, 90 s by default): the remaining time is counted down here from the view's `releaseInMs`.
   */
  private renderBusy(busy: NonNullable<LobbyView['busy']> | null): void {
    this.stopBusyTimer();
    this.busyLine.hidden = !busy;
    if (!busy) { this.busyLine.textContent = ''; return; }
    if (busy.releaseInMs === null) { this.busyLine.textContent = '对局正在进行，请等待本局结束'; return; }
    const endsAt = performance.now() + busy.releaseInMs;
    const tick = () => {
      const left = Math.ceil((endsAt - performance.now()) / 1000);
      this.busyLine.textContent = left > 0 ? `对局正在进行（玩家均已掉线），约 ${left} 秒后释放` : '对局正在进行，即将释放…';
      if (left <= 0) this.stopBusyTimer();
    };
    tick(); if (this.busyTimer === null && endsAt > performance.now()) this.busyTimer = window.setInterval(tick, 1000);
  }
  private stopBusyTimer() { if (this.busyTimer !== null) { window.clearInterval(this.busyTimer); this.busyTimer = null; } }
  /** Connection trouble of a network client (reconnecting, opened elsewhere); null hides the line. */
  connection(text: string | null): void { this.connectionLine.textContent = text ?? ''; this.connectionLine.hidden = !text; }
  show(visible: boolean) { this.root.hidden = !visible; if (!visible) this.hidePicker(); }
  dispose() { this.stopBusyTimer(); this.unwatchPicker(); this.hidePicker(); this.root.remove(); }
}
