/**
 * Opening encounters PR8: the encounter of this match as the player sees it, in DOM over the board frame so the 2D board
 * and the online 3D layer share it.
 *  - Intro card: centered, a few seconds after the match starts (first view in the opening round), skippable; shown once
 *    per match, never again on a reconnect or a later view.
 *  - Top banner during the opening round: encounter name, champion, description and the status line.
 *  - "本局奇遇" chip, always there while a match shows: reopens the same card at any time, with my own progress lines
 *    (opening forges left, Mel's threshold).
 *  - Toast for the 3-5 wind-up monkey result the moment the shared fact is revealed.
 * Every text comes from `presentation/opening-encounter-text`; nothing here reads a seed or decides an outcome.
 */
import {
  forgeProgressText, melProgressText, monkeyFact, monkeyToastText, openingBannerLine, openingBannerText,
  type OpeningEncounterDisplay, type OpeningForgeProgressDisplay, type OpeningMelProgressDisplay,
} from '../presentation/opening-encounter-text';

/** How long the intro card stays without a click. */
export const OPENING_INTRO_MS = 6_000;
/** How long the monkey toast stays. */
export const OPENING_TOAST_MS = 5_000;
const STORAGE_PREFIX = 'cat:opening-intro:';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
function seen(key: string): boolean {
  try { return window.sessionStorage.getItem(STORAGE_PREFIX + key) === '1'; } catch { return false; }
}
function remember(key: string): void {
  try { window.sessionStorage.setItem(STORAGE_PREFIX + key, '1'); } catch { /* private mode: the in-memory set still holds it */ }
}

export interface OpeningHudInput {
  /** The public encounter of this match; null hides everything (lobby, older server). */
  readonly encounter: OpeningEncounterDisplay | null;
  /** Identifies this match for the once-only intro (survives a reload of the same match through sessionStorage). */
  readonly matchKey: string;
  /** Room/match round ordinal; the opening round is 1 (1-2). */
  readonly round: number;
  readonly forge?: OpeningForgeProgressDisplay | null;
  readonly mel?: OpeningMelProgressDisplay | null;
  /** A choice popup (the encounter's own forge, an augment) is open: the intro card would cover its offers, so it stays closed. */
  readonly choiceOpen?: boolean;
}

export class OpeningEncounterHud {
  readonly banner = element('div', '', 'opening-banner');
  readonly chip = element('button', '', 'opening-chip');
  readonly card = element('section', '', 'opening-card');
  readonly toast = element('div', '', 'opening-toast');
  readonly tooltip = element('div', '', 'opening-tooltip');
  private readonly introduced = new Set<string>();
  private introTimer: number | null = null;
  private toastTimer: number | null = null;
  private key = '';
  private matchKey: string | null = null;
  /** The monkey fact already accounted for in this match (a view that already carries it on first sight shows no toast). */
  private factSeen: string | null = null;
  private input: OpeningHudInput | null = null;
  constructor(frame: HTMLElement, private readonly online = false) {
    this.banner.dataset.debug = 'opening:banner'; this.banner.hidden = true; this.banner.setAttribute('role', 'status');
    this.chip.type = 'button'; this.chip.dataset.debug = 'opening:chip'; this.chip.hidden = true;
    this.chip.addEventListener('click', () => { this.tooltip.hidden = true; this.openCard(false); });
    this.tooltip.hidden = true; this.tooltip.id = 'opening-encounter-tooltip';
    this.tooltip.dataset.debug = 'opening:tooltip'; this.tooltip.setAttribute('role', 'tooltip');
    if (online) {
      this.chip.setAttribute('aria-describedby', this.tooltip.id);
      for (const event of ['mouseenter', 'focus'] as const) this.chip.addEventListener(event, () => this.showTooltip());
      for (const event of ['mouseleave', 'blur'] as const) this.chip.addEventListener(event, () => { this.tooltip.hidden = true; });
      this.chip.addEventListener('keydown', event => { if (event.key === 'Escape') this.tooltip.hidden = true; });
      document.body.append(this.tooltip);
    }
    this.card.dataset.debug = 'opening:card'; this.card.hidden = true; this.card.setAttribute('role', 'dialog'); this.card.setAttribute('aria-label', '本局奇遇');
    this.toast.dataset.debug = 'opening:toast'; this.toast.hidden = true; this.toast.setAttribute('role', 'status');
    frame.append(this.banner, this.chip, this.toast);
    document.body.append(this.card);
  }

  /** Idempotent: redraws only when something shown changed. */
  update(input: OpeningHudInput): void {
    this.input = input;
    const encounter = input.encounter;
    if (!encounter) { this.hideAll(); return; }
    if (this.matchKey !== input.matchKey) { this.matchKey = input.matchKey; this.factSeen = monkeyFact(encounter)?.outcome ?? null; }
    const key = JSON.stringify([input.matchKey, encounter.encounterId, encounter.statusTextZh, encounter.enabled, encounter.revealedFacts, input.round <= 1,
      input.forge?.forgesPending ?? null, input.mel?.thresholdReached ?? null, input.choiceOpen === true]);
    if (key === this.key) return;
    this.key = key;
    this.renderBanner(encounter, input.round <= 1);
    this.renderChip(encounter, input);
    if (input.choiceOpen && this.card.dataset.intro === 'true') this.closeCard();
    if (!this.card.hidden) this.renderCard(encounter, input, this.card.dataset.intro === 'true');
    // Intro: once per match, only when the match is still in its opening round when first seen. Under an open choice (the
    // opening anvils' popup names the encounter itself) it is spent without showing.
    const introKey = `${input.matchKey}|${encounter.encounterId}`;
    if (input.round <= 1 && !input.choiceOpen && !this.introduced.has(introKey) && !seen(introKey)) {
      this.introduced.add(introKey); remember(introKey); this.openCard(true);
    } else this.introduced.add(introKey);
    const fact = monkeyFact(encounter), text = monkeyToastText(fact);
    if (text && fact?.outcome && this.factSeen !== fact.outcome) { this.factSeen = fact.outcome; this.showToast(text); }
  }
  /** The card as the chip opens it (`intro`: the timed start card with a skip button). */
  openCard(intro: boolean): void {
    const input = this.input;
    if (!input?.encounter) return;
    this.renderCard(input.encounter, input, intro);
    this.card.hidden = false;
    if (this.introTimer !== null) { window.clearTimeout(this.introTimer); this.introTimer = null; }
    if (intro) this.introTimer = window.setTimeout(() => { this.introTimer = null; this.closeCard(); }, OPENING_INTRO_MS);
  }
  closeCard(): void {
    if (this.introTimer !== null) { window.clearTimeout(this.introTimer); this.introTimer = null; }
    this.card.hidden = true; delete this.card.dataset.intro;
  }
  showToast(text: string): void {
    this.toast.textContent = text; this.toast.hidden = false;
    this.toast.classList.remove('play'); void this.toast.offsetWidth; this.toast.classList.add('play');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toastTimer = null; this.toast.hidden = true; }, OPENING_TOAST_MS);
  }
  /** The match is over (or left): the next match, even with the same seats, shows its intro again. */
  forgetMatch(): void {
    this.introduced.clear(); this.matchKey = null; this.factSeen = null;
    try {
      const storage = window.sessionStorage;
      for (let index = storage.length - 1; index >= 0; index--) { const key = storage.key(index); if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key); }
    } catch { /* storage unavailable */ }
  }
  debug(): { readonly banner: string | null; readonly chip: string | null; readonly card: string | null; readonly toast: string | null } {
    const shown = (node: HTMLElement) => (node.hidden ? null : node.textContent);
    return { banner: shown(this.banner), chip: shown(this.chip), card: shown(this.card), toast: shown(this.toast) };
  }
  hideAll(): void {
    this.tooltip.hidden = true; this.key = ''; this.banner.hidden = true; this.chip.hidden = true; this.closeCard();
  }
  dispose(): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.closeCard(); this.banner.remove(); this.chip.remove(); this.card.remove(); this.toast.remove(); this.tooltip.remove();
  }

  private renderBanner(encounter: OpeningEncounterDisplay, opening: boolean): void {
    if (!opening) { this.banner.hidden = true; return; }
    const text = openingBannerText(encounter);
    this.banner.dataset.closed = String(text.closed); this.banner.dataset.encounter = encounter.encounterId;
    this.banner.replaceChildren(element('strong', `本局奇遇 · ${openingBannerLine(encounter)}`, 'opening-banner-title'),
      element('span', text.description, 'opening-banner-desc'), element('span', text.status, 'opening-banner-status'));
    this.banner.hidden = false;
  }
  private renderChip(encounter: OpeningEncounterDisplay, input: OpeningHudInput): void {
    const text = openingBannerText(encounter);
    const lines = [forgeProgressText(input.forge), melProgressText(input.mel)].filter((line): line is string => line !== null);
    this.chip.dataset.closed = String(text.closed);
    const icon = element('span', '✦', 'opening-chip-icon'); icon.setAttribute('aria-hidden', 'true');
    this.chip.replaceChildren(...(this.online ? [icon] : []), element('span', '本局奇遇', 'opening-chip-label'), element('span', text.title, 'opening-chip-name'),
      ...lines.map(line => element('span', line, 'opening-chip-progress')));
    const description = `${openingBannerLine(encounter)}\n${text.description}\n${text.status}${lines.length ? `\n${lines.join('\n')}` : ''}\n点击查看说明`;
    this.tooltip.textContent = description;
    this.chip.title = this.online ? '' : description;
    this.chip.hidden = false;
  }
  private showTooltip(): void {
    if (this.chip.hidden) return;
    this.tooltip.hidden = false;
    const rect = this.chip.getBoundingClientRect();
    const width = this.tooltip.offsetWidth;
    this.tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    this.tooltip.style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - this.tooltip.offsetHeight - 8))}px`;
  }
  private renderCard(encounter: OpeningEncounterDisplay, input: OpeningHudInput, intro: boolean): void {
    const text = openingBannerText(encounter);
    if (intro) this.card.dataset.intro = 'true'; else delete this.card.dataset.intro;
    this.card.dataset.closed = String(text.closed);
    const lines = [forgeProgressText(input.forge), melProgressText(input.mel)].filter((line): line is string => line !== null);
    const close = element('button', intro ? '跳过' : '知道了', 'opening-card-close');
    close.type = 'button'; close.dataset.debug = 'opening:close';
    close.addEventListener('click', () => this.closeCard());
    this.card.replaceChildren(
      element('p', '本局奇遇', 'opening-card-kicker'),
      element('h2', text.title, 'opening-card-title'),
      ...(text.champion ? [element('p', text.champion, 'opening-card-champion')] : []),
      element('p', text.description, 'opening-card-desc'),
      element('p', text.status, 'opening-card-status'),
      ...lines.map(line => element('p', line, 'opening-card-progress')),
      close,
    );
  }
}
