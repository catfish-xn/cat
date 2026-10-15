/**
 * G5 "回看": a floating player over the top of my board that replays my last battle with the saved-replay canvas
 * (ReplayView) while the match goes on. It never touches the session or the board: the countdown keeps running and
 * my bench and deployment rows stay reachable underneath (the panel stays over the enemy half, like the scouting panel).
 */
import { ReplayCursor, type ReviewSpeed } from '../../presentation/replay-cursor';
import { ReplayView } from '../replay-view';
import type { FinishedBattle } from './remote-session';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}

export class ReplayReviewPanel {
  readonly root: HTMLElement;
  private stage = element('div', '', 'review-stage');
  private title = element('strong', '', 'review-title');
  private clock = element('span', '', 'review-clock');
  private play = element('button', '', 'review-play');
  private slider = element('input', '', 'review-seek');
  private speeds: HTMLButtonElement[] = [];
  private view: ReplayView | null = null;
  private cursor: ReplayCursor | null = null;
  private battle: FinishedBattle | null = null;
  private selected: string | null = null;
  constructor(host: HTMLElement, private readonly onClose: () => void) {
    this.root = element('section', '', 'battle-review'); this.root.id = 'battle-review'; this.root.hidden = true;
    this.root.dataset.debug = 'online:review'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', '战斗回看');
    const close = element('button', '关闭', 'review-close'); close.type = 'button'; close.dataset.debug = 'online:review-close';
    close.setAttribute('aria-label', '关闭回看（Esc）'); close.addEventListener('click', () => this.close());
    const head = element('header', '', 'review-head'); head.append(this.title, close);
    this.play.type = 'button'; this.play.dataset.debug = 'online:review-play'; this.play.addEventListener('click', () => { this.cursor?.toggle(); this.draw(); });
    this.slider.type = 'range'; this.slider.min = '0'; this.slider.step = '1'; this.slider.dataset.debug = 'online:review-seek'; this.slider.setAttribute('aria-label', '按 tick 跳转');
    this.slider.addEventListener('input', () => { this.cursor?.seek(Number(this.slider.value)); this.draw(); });
    const speeds = element('div', '', 'review-speeds');
    for (const speed of [1, 2, 4] as const) {
      const button = element('button', `${speed}×`, 'review-speed'); button.type = 'button'; button.dataset.speed = String(speed);
      button.addEventListener('click', () => { if (this.cursor) { this.cursor.speed = speed as ReviewSpeed; this.draw(); } });
      this.speeds.push(button); speeds.append(button);
    }
    // Board on the left, controls beside it: the panel stays short enough to clear my deployment rows.
    const side = element('div', '', 'review-side'); side.append(head, this.clock, this.play, speeds, this.slider);
    this.root.append(this.stage, side);
    host.append(this.root);
    document.addEventListener('keydown', this.onKey);
  }
  get isOpen(): boolean { return this.battle !== null; }
  get openBattle(): FinishedBattle | null { return this.battle; }
  /** Starts `battle` from its first tick (reopening the same battle restarts it). */
  open(battle: FinishedBattle): void {
    this.battle = battle; this.cursor = new ReplayCursor(battle.replay); this.selected = null;
    this.view?.dispose(); this.view = new ReplayView(this.stage);
    this.root.dataset.round = String(battle.round); this.root.dataset.combat = battle.replay.terminal.combatId ?? '';
    this.title.textContent = `回看 · ${battle.roundId}`;
    this.slider.max = String(this.cursor.endTick);
    this.root.hidden = false; this.draw();
  }
  close(): void {
    if (!this.battle) return;
    this.battle = null; this.cursor = null; this.view?.dispose(); this.view = null; this.root.hidden = true; this.onClose();
  }
  /** Highlights a unit (a row clicked in the battle summary). */
  select(unitId: string | null): void { this.selected = unitId; this.draw(); }
  /** Called once per render frame. */
  frame(delta: number): void { if (this.cursor?.advance(delta)) this.draw(); }
  private draw(): void {
    const cursor = this.cursor; if (!cursor || !this.view) return;
    this.view.render(cursor.view, this.selected, cursor.events);
    this.clock.textContent = `${(cursor.tick * 0.05).toFixed(1)} / ${(cursor.endTick * 0.05).toFixed(1)} 秒`;
    this.play.textContent = cursor.ended ? '重播' : cursor.playing ? '暂停' : '播放';
    this.play.dataset.state = cursor.ended ? 'ended' : cursor.playing ? 'playing' : 'paused';
    if (document.activeElement !== this.slider) this.slider.value = String(cursor.tick);
    for (const button of this.speeds) button.classList.toggle('active', Number(button.dataset.speed) === cursor.speed);
    this.root.dataset.tick = String(cursor.tick);
  }
  private onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && this.battle) { event.stopPropagation(); this.close(); } };
  debug() {
    const cursor = this.cursor;
    return cursor && this.battle ? { round: this.battle.round, combatId: cursor.replay.terminal.combatId ?? null, tick: cursor.tick, endTick: cursor.endTick, playing: cursor.playing, speed: cursor.speed } : null;
  }
  dispose(): void { document.removeEventListener('keydown', this.onKey); this.view?.dispose(); this.root.remove(); }
}
