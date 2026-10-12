import type { PlayerView, SeatPublic } from './protocol';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
const PHASE_TEXT = { lobby: '等待', preparation: '准备阶段', choice: '选择', combat: '战斗中', settlement: '结算', ended: '对局结束' } as const;
/** TFT-style right column: phase + countdown on top, eight seats ordered by HP below. */
export class PlayersSidebar {
  readonly root: HTMLElement;
  private phaseBadge: HTMLElement;
  private roundLabel: HTMLElement;
  private timerLabel: HTMLElement;
  private list: HTMLElement;
  private view: PlayerView | null = null;
  /** performance.now() minus the server clock, so the countdown follows the server. */
  private clockOffset = 0;
  constructor(host: HTMLElement) {
    this.root = element('aside', '', 'online-sidebar'); this.root.id = 'online-sidebar'; this.root.setAttribute('aria-label', '玩家列表');
    const top = element('div', '', 'online-topbar');
    this.phaseBadge = element('span', '', 'online-phase'); this.roundLabel = element('strong', '', 'online-round'); this.timerLabel = element('span', '', 'online-timer');
    this.timerLabel.dataset.debug = 'online:timer';
    top.append(this.phaseBadge, this.roundLabel, this.timerLabel); this.root.append(top);
    this.list = element('ol', '', 'online-seats'); this.list.dataset.debug = 'online:seats'; this.root.append(this.list);
    host.append(this.root);
  }
  render(view: PlayerView): void {
    this.view = view; this.clockOffset = performance.now() - view.phase.serverNow;
    this.phaseBadge.textContent = PHASE_TEXT[view.phase.kind]; this.phaseBadge.dataset.phase = view.phase.kind;
    this.roundLabel.textContent = view.phase.roundName;
    const ordered = [...view.seats].sort(compareSeats);
    this.list.replaceChildren(...ordered.map(seat => this.seatRow(seat, seat.seatId === view.mySeatId, seat.seatId === view.opponentSeatId)));
    this.tick();
  }
  private seatRow(seat: SeatPublic, me: boolean, opponent: boolean) {
    const row = element('li', '', `online-seat${me ? ' me' : ''}${opponent ? ' opponent' : ''}${seat.alive ? '' : ' eliminated'}`);
    row.dataset.debug = `online:seat:${seat.seatId}`;
    const head = element('div', '', 'seat-head');
    head.append(element('span', seat.name, 'seat-name'), element('span', seat.kind === 'bot' ? '机' : me ? '我' : '人', `seat-kind seat-${seat.kind}`));
    if (opponent) head.append(element('span', '对手', 'seat-opponent'));
    if (!seat.connected) head.append(element('span', '断线', 'seat-offline'));
    const bar = element('div', '', 'seat-bar'); const fill = element('div', '', 'seat-fill'); fill.style.width = `${Math.max(0, Math.min(100, seat.hp))}%`; bar.append(fill);
    const foot = element('div', '', 'seat-foot');
    foot.append(element('span', seat.alive ? `${seat.hp}` : `第 ${seat.rank ?? '?'} 名`, 'seat-hp'), element('span', `Lv ${seat.level}`, 'seat-level'));
    row.append(head, bar, foot); return row;
  }
  /** Called every frame; only touches the countdown text. */
  tick(): void {
    const view = this.view; if (!view) return;
    const endsAt = view.phase.endsAt;
    if (endsAt === null) { this.timerLabel.textContent = ''; return; }
    const remaining = Math.max(0, endsAt - (performance.now() - this.clockOffset));
    const seconds = Math.ceil(remaining / 1000); const text = `${seconds}`;
    if (this.timerLabel.textContent !== text) this.timerLabel.textContent = text;
    this.timerLabel.classList.toggle('urgent', seconds <= 5);
  }
  show(visible: boolean) { this.root.hidden = !visible; }
  dispose() { this.root.remove(); }
}
function compareSeats(a: SeatPublic, b: SeatPublic): number {
  if (a.alive !== b.alive) return a.alive ? -1 : 1;
  if (a.alive) return b.hp - a.hp || a.name.localeCompare(b.name, 'zh');
  return (a.rank ?? 99) - (b.rank ?? 99);
}
