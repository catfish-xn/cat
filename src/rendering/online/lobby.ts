import { ROOM_CAPACITY, type LobbyView } from './protocol';

export interface LobbyActions { join(name: string): void; leave(): void; start(): void; addFakeFriend?(): void }
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
    form.append(this.name, this.joinButton, this.leaveButton); card.append(form);
    this.count = element('p', '', 'lobby-count'); card.append(this.count);
    this.list = element('ol', '', 'lobby-queue'); this.list.setAttribute('aria-label', '队列'); card.append(this.list);
    this.error = element('p', '', 'lobby-error'); this.error.setAttribute('role', 'alert'); card.append(this.error);
    this.startButton = this.button('online:start', '开始对局', () => this.actions.start()); this.startButton.classList.add('primary-action', 'lobby-start');
    card.append(this.startButton);
    if (actions.addFakeFriend) {
      const debug = element('details', '', 'lobby-debug'); debug.append(element('summary', '测试工具（假服务器）'));
      debug.append(element('p', '真服务器接入前，用这个按钮模拟其他好友点击匹配，看列表填满和第 9 人报错。', 'lobby-hint'));
      debug.append(this.button('online:fake-friend', '模拟好友加入', () => actions.addFakeFriend!())); card.append(debug);
    }
    this.root.append(card); host.append(this.root);
  }
  private button(name: string, label: string, action: () => void) { const b = element('button', label); b.type = 'button'; b.dataset.debug = name; b.addEventListener('click', action); return b; }
  render(view: LobbyView): void {
    this.count.textContent = `队列 ${view.queue.length} / ${view.capacity}${view.queue.length < ROOM_CAPACITY ? ` · 开局时补 ${ROOM_CAPACITY - view.queue.length} 个机器人` : ' · 已满'}`;
    this.list.replaceChildren(...view.queue.map(entry => {
      const item = element('li', '', `queue-entry${entry.me ? ' me' : ''}`); item.dataset.debug = 'online:queue-entry';
      item.append(element('span', entry.name, 'queue-name'), element('span', entry.me ? '我' : '真人', 'queue-kind')); return item;
    }));
    this.error.textContent = view.error ?? ''; this.error.hidden = !view.error;
    this.joinButton.hidden = view.joined; this.name.hidden = view.joined; this.leaveButton.hidden = !view.joined;
    this.startButton.hidden = !view.joined; this.startButton.disabled = !view.canStart;
  }
  show(visible: boolean) { this.root.hidden = !visible; }
  dispose() { this.root.remove(); }
}
