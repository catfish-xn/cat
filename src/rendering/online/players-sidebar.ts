import { heroEmblemSvg } from '../../presentation/hero-identity';
import { heroPortraitHtml } from '../../presentation/s13-assets';
import { avatarUnit } from './opponent-board';
import type { PlayerView, SeatPublic } from './protocol';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
/** G1-P6 mark of a seat in my pairing: drawn opponent (strong), possible opponent before the freeze (weak), or none. */
type Pairing = 'opponent' | 'candidate' | null;
/** How long a seat's HP drop stays marked (lost segment and -N chip). */
const HIT_MS = 2600;
const PHASE_TEXT = { lobby: '等待', preparation: '准备阶段', choice: '选择', carousel: '选秀', combat: '战斗中', settlement: '结算', ended: '对局结束' } as const;
/** TFT-style right column: phase badge on top, eight seats ordered by HP below. The big countdown sits above the
 *  board when a countdown host is given (TFT top centre); without one it stays in the sidebar's top bar.
 *  Each seat shows an avatar (its most expensive deployed unit) and opens that seat's public board when clicked. */
export class PlayersSidebar {
  readonly root: HTMLElement;
  private phaseBadge: HTMLElement;
  private roundLabel: HTMLElement;
  private timerLabel: HTMLElement;
  private connectionBadge: HTMLElement;
  private countdownRound: HTMLElement | null = null;
  private list: HTMLElement;
  private view: PlayerView | null = null;
  private viewing: string | null = null;
  private spectateBanner: HTMLElement;
  /** Last HP shown per seat: a drop leaves a fading "lost" segment and a -N chip on the bar (presentation only). */
  private shownHp = new Map<string, { hp: number; from: number; at: number }>();
  /** performance.now() minus the server clock, so the countdown follows the server. */
  private clockOffset = 0;
  constructor(host: HTMLElement, private readonly countdownHost: HTMLElement | null = null, private readonly onSelect: ((seatId: string) => void) | null = null) {
    this.root = element('aside', '', 'online-sidebar'); this.root.id = 'online-sidebar'; this.root.setAttribute('aria-label', '玩家列表');
    const top = element('div', '', 'online-topbar');
    this.phaseBadge = element('span', '', 'online-phase'); this.roundLabel = element('strong', '', 'online-round'); this.timerLabel = element('span', '', 'online-timer');
    this.timerLabel.dataset.debug = 'online:timer'; this.timerLabel.setAttribute('role', 'timer'); this.timerLabel.setAttribute('aria-label', '阶段倒计时');
    if (countdownHost) {
      countdownHost.classList.add('online-countdown'); this.countdownRound = element('span', '', 'countdown-round');
      countdownHost.replaceChildren(this.countdownRound, this.timerLabel); top.append(this.phaseBadge, this.roundLabel);
    } else top.append(this.phaseBadge, this.roundLabel, this.timerLabel);
    this.connectionBadge = element('span', '', 'online-connection'); this.connectionBadge.dataset.debug = 'online:connection'; this.connectionBadge.hidden = true;
    this.connectionBadge.setAttribute('role', 'status'); top.append(this.connectionBadge);
    this.spectateBanner = element('span', '', 'online-spectate'); this.spectateBanner.dataset.debug = 'online:spectate'; this.spectateBanner.hidden = true;
    top.append(this.spectateBanner);
    this.root.append(top);
    this.list = element('ol', '', 'online-seats'); this.list.dataset.debug = 'online:seats'; this.root.append(this.list);
    host.append(this.root);
  }
  render(view: PlayerView): void {
    this.view = view; this.clockOffset = performance.now() - view.phase.serverNow;
    this.phaseBadge.textContent = PHASE_TEXT[view.phase.kind]; this.phaseBadge.dataset.phase = view.phase.kind;
    this.roundLabel.textContent = view.phase.roundName;
    // Eliminated before the end: TFT keeps the screen and labels it; the ranking still arrives at the end.
    const me = view.seats.find(seat => seat.seatId === view.mySeatId);
    const spectating = me !== undefined && !me.alive && view.phase.kind !== 'ended';
    const spectateText = spectating ? `已淘汰 · 第 ${me!.rank ?? '?'} 名 · 观战中` : '';
    this.spectateBanner.textContent = spectateText; this.spectateBanner.hidden = !spectating;
    if (this.countdownRound) {
      this.countdownRound.textContent = spectating ? `${spectateText} · ${view.phase.roundName}` : `${view.phase.roundName} · ${PHASE_TEXT[view.phase.kind]}`;
      this.countdownHost!.dataset.phase = view.phase.kind; this.countdownHost!.toggleAttribute('data-spectating', spectating);
    }
    const ordered = [...view.seats].sort(compareSeats);
    // G1-P6: before the freeze only candidates are known (weak mark); the drawn opponent, or a single candidate, is certain (strong mark).
    const candidates = view.opponentCandidates ?? [];
    const opponent = view.opponentSeatId ?? (candidates.length === 1 ? candidates[0]! : null);
    const pairing = (seatId: string): Pairing => seatId === opponent ? 'opponent' : candidates.includes(seatId) ? 'candidate' : null;
    this.list.replaceChildren(...ordered.map(seat => this.seatRow(seat, seat.seatId === view.mySeatId, pairing(seat.seatId))));
    this.tick();
  }
  private seatRow(seat: SeatPublic, me: boolean, pairing: Pairing) {
    const row = element('li', '', `online-seat${me ? ' me' : ''}${pairing ? ` ${pairing}` : ''}${seat.alive ? '' : ' eliminated'}${seat.seatId === this.viewing ? ' viewing' : ''}`);
    row.dataset.debug = `online:seat:${seat.seatId}`;
    if (pairing) row.dataset.pairing = pairing;
    if (this.onSelect) {
      row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-label', `查看 ${seat.name} 的阵容`);
      row.setAttribute('aria-pressed', String(seat.seatId === this.viewing));
      row.addEventListener('click', () => this.onSelect!(seat.seatId));
      row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.onSelect!(seat.seatId); } });
    }
    const avatar = element('span', '', 'seat-avatar'); avatar.dataset.debug = `online:avatar:${seat.seatId}`;
    const unit = avatarUnit(seat.publicBoard);
    if (unit) { avatar.dataset.definition = unit.definitionId; avatar.innerHTML = heroPortraitHtml(unit.definitionId, 30, heroEmblemSvg(unit.definitionId, 30)); }
    else avatar.append(element('span', [...seat.name][0] ?? '?', 'seat-avatar-placeholder'));
    const head = element('div', '', 'seat-head');
    // 机: a fill-in bot for the whole match; a human seat a bot is playing while its player is away shows 机 in the
    // takeover style plus 接管中 (B6). Only one of them controls a seat at a time.
    const kind = seat.controller === 'takeover' ? element('span', '机', 'seat-kind seat-takeover') : element('span', seat.kind === 'bot' ? '机' : me ? '我' : '人', `seat-kind seat-${seat.kind}`);
    kind.title = seat.controller === 'takeover' ? '真人断线，机器人临时接管' : seat.kind === 'bot' ? '补位机器人' : me ? '你' : '真人玩家';
    head.append(avatar, element('span', seat.name, 'seat-name'), kind);
    if (pairing === 'opponent') head.append(element('span', '对手', 'seat-opponent'));
    else if (pairing === 'candidate') { const tag = element('span', '可能', 'seat-candidate'); tag.title = '本回合可能的对手，开战时确定'; head.append(tag); }
    // Bots never hold a connection; a dropped human shows 断线, and 接管中 once a bot plays the seat.
    if (seat.controller === 'takeover') head.append(element('span', '接管中', 'seat-offline seat-takeover-tag'));
    else if (seat.kind === 'human' && !seat.connected) head.append(element('span', '断线', 'seat-offline'));
    const bar = element('div', '', 'seat-bar'); const fill = element('div', '', 'seat-fill');
    const percent = (hp: number) => `${Math.max(0, Math.min(100, hp))}%`;
    fill.style.width = percent(seat.hp); bar.dataset.tier = seat.hp > 60 ? 'high' : seat.hp > 30 ? 'mid' : 'low';
    // The row is rebuilt on every view push; a drop is kept for HIT_MS so a push right after it does not cut the effect short.
    const now = performance.now(), last = this.shownHp.get(seat.seatId);
    const hit = last && seat.hp < last.hp ? { hp: seat.hp, from: last.hp, at: now } : last && seat.hp === last.hp && now - last.at < HIT_MS ? last : { hp: seat.hp, from: seat.hp, at: -Infinity };
    this.shownHp.set(seat.seatId, hit);
    const foot = element('div', '', 'seat-foot');
    foot.append(element('span', seat.alive ? `${seat.hp}` : `第 ${seat.rank ?? '?'} 名`, 'seat-hp'), element('span', `Lv ${seat.level}`, 'seat-level'));
    if (hit.from > seat.hp) {
      const lost = element('div', '', 'seat-lost'); lost.style.width = percent(hit.at === now ? hit.from : seat.hp); bar.append(lost);
      if (hit.at === now) requestAnimationFrame(() => requestAnimationFrame(() => { lost.style.width = percent(seat.hp); }));
      const chip = element('span', `-${hit.from - seat.hp}`, 'seat-damage'); chip.dataset.debug = `online:seat-damage:${seat.seatId}`;
      chip.style.animationDelay = row.style.animationDelay = `${-(now - hit.at)}ms`; foot.insertBefore(chip, foot.lastChild); row.classList.add('hit');
    }
    bar.append(fill);
    row.append(head, bar, foot); return row;
  }
  /** Called every frame; only touches the countdown text. */
  tick(): void {
    const view = this.view; if (!view) return;
    const endsAt = view.phase.endsAt;
    if (endsAt === null) { this.timerLabel.textContent = ''; this.timerLabel.classList.remove('urgent'); return; }
    const remaining = Math.max(0, endsAt - (performance.now() - this.clockOffset));
    const seconds = Math.ceil(remaining / 1000); const text = `${seconds}`;
    if (this.timerLabel.textContent !== text) this.timerLabel.textContent = text;
    this.timerLabel.classList.toggle('urgent', seconds <= 5);
  }
  /** Marks the seat whose board is open in the opponent panel (null: none). */
  setViewing(seatId: string | null): void {
    if (this.viewing === seatId) return;
    this.viewing = seatId;
    for (const row of Array.from(this.list.children) as HTMLElement[]) {
      const on = row.dataset.debug === `online:seat:${seatId}`; row.classList.toggle('viewing', on); if (row.hasAttribute('aria-pressed')) row.setAttribute('aria-pressed', String(on));
    }
  }
  /** Connection badge next to the phase (断线重连中 / 已在别处打开 as warnings, 已接回席位 as `ok`); null hides it. */
  connection(text: string | null, tone: 'warn' | 'ok' = 'warn'): void {
    this.connectionBadge.textContent = text ?? ''; this.connectionBadge.hidden = !text; this.connectionBadge.dataset.tone = tone;
  }
  show(visible: boolean) { this.root.hidden = !visible; }
  dispose() { this.root.remove(); this.countdownHost?.replaceChildren(); }
}
function compareSeats(a: SeatPublic, b: SeatPublic): number {
  if (a.alive !== b.alive) return a.alive ? -1 : 1;
  if (a.alive) return b.hp - a.hp || a.name.localeCompare(b.name, 'zh');
  return (a.rank ?? 99) - (b.rank ?? 99);
}
