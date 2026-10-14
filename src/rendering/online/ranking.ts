import type { SeatPublic } from './protocol';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
/** Final standings overlay. */
export class RankingOverlay {
  readonly root: HTMLElement;
  private list: HTMLElement;
  private title: HTMLElement;
  private fault: HTMLElement;
  constructor(host: HTMLElement, onAgain: () => void) {
    this.root = element('div', '', 'ranking-overlay'); this.root.id = 'ranking-root'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', '最终排名'); this.root.hidden = true;
    const card = element('div', '', 'ranking-card');
    this.title = element('h2', '最终排名'); this.list = element('ol', '', 'ranking-list'); this.list.dataset.debug = 'online:ranking';
    this.fault = element('p', '', 'ranking-fault'); this.fault.dataset.debug = 'online:fault'; this.fault.setAttribute('role', 'alert'); this.fault.hidden = true;
    const again = element('button', '返回匹配'); again.type = 'button'; again.dataset.debug = 'online:again'; again.classList.add('primary-action'); again.addEventListener('click', onAgain);
    card.append(this.title, this.fault, this.list, again); this.root.append(card); host.append(this.root);
  }
  /** The room stopped abnormally (resolver error, stuck seat…): no ranking, only the server's reason and a way back. */
  renderFault(detail: string): void {
    this.title.textContent = '对局异常结束';
    this.fault.textContent = `对局异常结束：${detail}`; this.fault.hidden = false;
    this.list.replaceChildren(); this.list.hidden = true;
    this.root.hidden = false;
  }
  render(ranking: readonly SeatPublic[], mySeatId: string): void {
    this.fault.hidden = true; this.list.hidden = false;
    const mine = ranking.find(seat => seat.seatId === mySeatId);
    this.title.textContent = mine ? `第 ${mine.rank} 名 · ${mine.rank === 1 ? '胜利' : mine.rank && mine.rank <= 4 ? '前四' : '对局结束'}` : '最终排名';
    this.list.replaceChildren(...ranking.map(seat => {
      const item = element('li', '', `ranking-entry${seat.seatId === mySeatId ? ' me' : ''}`);
      item.append(element('span', `${seat.rank ?? '?'}`, 'ranking-rank'), element('span', seat.name, 'ranking-name'), element('span', seat.kind === 'bot' ? '机器人' : '真人', 'ranking-kind'), element('span', seat.alive ? `${seat.hp} HP` : '淘汰', 'ranking-hp'));
      return item;
    }));
    this.root.hidden = false;
  }
  hide() { this.root.hidden = true; }
  dispose() { this.root.remove(); }
}
