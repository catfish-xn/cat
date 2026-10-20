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
/**
 * TFT's placement card, shown the moment my seat is eliminated while the match goes on: 第 N 名, then 继续观看 (close the
 * card, keep spectating) or 返回匹配 (leave the match). The rank is the server's (`SeatPublic.rank`). The backdrop lets
 * clicks through, so the player list stays usable while it shows; the final ranking replaces it when the match ends.
 */
export class EliminationCard {
  readonly root: HTMLElement;
  private rank: HTMLElement;
  private note: HTMLElement;
  private keydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !this.root.hidden) this.hide(); };
  constructor(host: HTMLElement, onLeave: () => void) {
    this.root = element('div', '', 'elimination-overlay'); this.root.id = 'elimination-root'; this.root.dataset.debug = 'online:elimination'; this.root.hidden = true;
    const card = element('div', '', 'elimination-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', '本局名次');
    this.rank = element('strong', '', 'elimination-rank'); this.note = element('span', '', 'elimination-note');
    const actions = element('div', '', 'elimination-actions');
    const watch = element('button', '继续观看'); watch.type = 'button'; watch.dataset.debug = 'online:elimination-watch'; watch.addEventListener('click', () => this.hide());
    const leave = element('button', '返回匹配'); leave.type = 'button'; leave.dataset.debug = 'online:elimination-leave'; leave.classList.add('primary-action'); leave.addEventListener('click', onLeave);
    actions.append(watch, leave); card.append(element('span', '已淘汰', 'elimination-kicker'), this.rank, this.note, actions);
    this.root.append(card); host.append(this.root);
    document.addEventListener('keydown', this.keydown);
  }
  show(rank: number | null): void {
    this.rank.textContent = `第 ${rank ?? '?'} 名`; this.root.dataset.rank = String(rank ?? '');
    this.root.dataset.tier = rank === null ? '' : rank <= 4 ? 'top4' : 'bottom4';
    this.note.textContent = rank !== null && rank <= 4 ? '进入前四 · 对局仍在进行' : '对局仍在进行，最终排名在终局公布';
    this.root.hidden = false;
  }
  get showing(): boolean { return !this.root.hidden; }
  hide() { this.root.hidden = true; }
  dispose() { document.removeEventListener('keydown', this.keydown); this.root.remove(); }
}
