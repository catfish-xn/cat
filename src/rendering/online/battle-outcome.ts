/**
 * TFT's end of my battle: a large 胜利 / 失败 / 平局 banner over the board, and on an HP loss the enemy survivors
 * turned into bolts that fly from the enemy half of the board into my HP bar in the right column. DOM and CSS only
 * (Web Animations), no Phaser. The result comes from the replay's terminal and the damage from the server's seat HP;
 * nothing is computed here.
 */
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
const RESULT_TEXT: Record<string, string> = { playerWin: '胜利', enemyWin: '失败', draw: '平局' };
/** How long the banner stays up. */
const BANNER_MS = 2200;
/** Flight of one bolt, the gap between two bolts and the most bolts drawn for one loss. */
const BOLT_MS = 620;
const BOLT_GAP_MS = 90;
const MAX_BOLTS = 8;
export interface OutcomeShown { readonly result: string; readonly opponent: string | null; readonly damage: number | null; readonly bolts: number }

export class BattleOutcome {
  private banner: HTMLElement;
  private title = element('strong', '', 'outcome-title');
  private detail = element('span', '', 'outcome-detail');
  private timer: number | null = null;
  private bolts: HTMLElement[] = [];
  private last: OutcomeShown | null = null;
  constructor(frame: HTMLElement) {
    this.banner = element('div', '', 'battle-outcome'); this.banner.dataset.debug = 'online:outcome'; this.banner.hidden = true;
    this.banner.setAttribute('role', 'status'); this.banner.append(this.title, this.detail);
    frame.append(this.banner);
  }
  /** The banner for my battle that just finished playing back; `opponent` is the PvP opponent's name (null: PvE). */
  showResult(result: string | null, opponent: string | null): void {
    const text = result ? RESULT_TEXT[result] : undefined;
    if (!text) return;
    this.title.textContent = text; this.detail.textContent = opponent ? `对战 ${opponent}` : '';
    this.banner.dataset.result = result!; this.banner.hidden = false;
    // Restart the CSS entrance when two banners follow each other.
    this.banner.classList.remove('play'); void this.banner.offsetWidth; this.banner.classList.add('play');
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = null; this.banner.hidden = true; }, BANNER_MS);
    this.last = { result: result!, opponent, damage: null, bolts: 0 };
  }
  /**
   * Bolts from the enemy half of the board (`source`) into `target` (my HP bar), one per surviving enemy unit up to
   * MAX_BOLTS; `damage` is shown on the last impact. `onDone` runs after the last bolt lands.
   */
  hit(source: HTMLElement, target: HTMLElement, count: number, damage: number, onDone?: () => void): void {
    const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
    const bolts = Math.max(1, Math.min(MAX_BOLTS, count));
    this.last = { ...(this.last ?? { result: 'enemyWin', opponent: null }), damage, bolts };
    const endX = to.left + to.width * 0.3, endY = to.top + to.height / 2;
    const animate = typeof Element.prototype.animate === 'function';
    for (let index = 0; index < bolts; index++) {
      const startX = from.left + from.width * (index + 1) / (bolts + 1), startY = from.top + from.height * 0.28;
      const bolt = element('span', '', 'outcome-bolt'); bolt.style.left = `${startX}px`; bolt.style.top = `${startY}px`;
      document.body.append(bolt); this.bolts.push(bolt);
      const dx = endX - startX, dy = endY - startY, lift = -Math.min(160, Math.abs(dx) * 0.25);
      const delay = index * BOLT_GAP_MS, last = index === bolts - 1;
      const land = () => {
        bolt.remove(); this.bolts = this.bolts.filter(node => node !== bolt);
        target.classList.remove('outcome-impact'); void target.offsetWidth; target.classList.add('outcome-impact');
        if (last) onDone?.();
      };
      if (!animate) { window.setTimeout(land, delay); continue; }
      const flight = bolt.animate([
        { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 + lift}px)) scale(1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 1 },
      ], { duration: BOLT_MS, delay, easing: 'cubic-bezier(.4, 0, .7, 1)', fill: 'both' });
      flight.onfinish = land; flight.oncancel = () => bolt.remove();
    }
  }
  /** Total time of a hit with `count` bolts, so a follow-up (the placement card) can wait for the last impact. */
  static hitDuration(count: number): number { return BOLT_MS + (Math.max(1, Math.min(MAX_BOLTS, count)) - 1) * BOLT_GAP_MS; }
  /** Acceptance read: the banner on screen and the last result/hit shown. */
  debug() { return { banner: this.banner.hidden ? null : this.title.textContent, last: this.last, flying: this.bolts.length }; }
  clear(): void {
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
    this.banner.hidden = true; for (const bolt of this.bolts) bolt.remove(); this.bolts = [];
  }
  dispose(): void { this.clear(); this.banner.remove(); }
}
