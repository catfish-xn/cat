/**
 * v15 orb dock (MULTIPLAYER_CONTRACT §claimOrb, docs/UI_REQUESTS.md 法球领取): my unclaimed orbs sit in the board's right
 * gutter, mirroring the item bench on the left, and stay there across rounds until clicked. A click only sends claimOrb;
 * the rules decide whether it is granted now or queued for after the battle, what each entry becomes (bench, item bag,
 * gold, "自动出售 +NG" when the bench is full) and the result arrives as the private view's orbClaimReceipts.
 * Nothing here prices a unit, checks the bench or touches the pool.
 */
import type { MatchState } from '../../simulation/match-types';
import type { LootPayload, LootReceipt } from '../../simulation/m8/contracts';
import type { UnclaimedOrbView } from '../../simulation/m8/ui-contracts';
import { displayUnitName } from '../display-names';
import { itemDisplayName } from '../../presentation/g23-display';
import { consumableName, ORB_TIER_TEXT, payloadLabel } from '../../presentation/orb-loot';

type OrbFields = { readonly unclaimedOrbs?: readonly UnclaimedOrbView[]; readonly orbClaimReceipts?: readonly LootReceipt[] };

/** My unclaimed orbs as the server's private view lists them (oldest first); empty offline and for any older view. */
export function readUnclaimedOrbs(state: MatchState): readonly UnclaimedOrbView[] {
  const orbs = (state as MatchState & OrbFields).unclaimedOrbs;
  return Array.isArray(orbs) ? orbs : [];
}
/** Every claim receipt of my seat so far (private orbClaimReceipts); empty offline. */
export function readOrbClaimReceipts(state: MatchState): readonly LootReceipt[] {
  const receipts = (state as MatchState & OrbFields).orbClaimReceipts;
  return Array.isArray(receipts) ? receipts : [];
}

const stars = (payload: LootPayload) => payload.kind === 'unit' ? '★'.repeat(payload.starLevel ?? 1) : '';
/** Display name of one orb entry, with its count and a unit's star level. */
export function orbPayloadName(payload: LootPayload): string {
  const count = payload.quantity > 1 ? ` ×${payload.quantity}` : '';
  if (payload.kind === 'gold') return `${payload.quantity} 金币`;
  if (payload.kind === 'consumable') return `${consumableName(payload.definitionId)}${count}`;
  if (payload.kind === 'item') return `${itemDisplayName(payload.definitionId)}${count}`;
  return `${displayUnitName(payload.definitionId)}${stars(payload)}${count}`;
}
/**
 * What one claim receipt did, in the player's words; null for receipts with nothing to announce (forfeited entries).
 * The amounts are the receipt's own (`gold`), never a sell price worked out here.
 */
export function orbReceiptText(receipt: LootReceipt): string | null {
  const payload = receipt.payload, name = orbPayloadName(payload);
  if (receipt.resolution === 'forfeited') return null;
  if (payload.kind === 'gold') return `+${receipt.gold ?? payload.quantity} 金币`;
  if (receipt.resolution === 'capacity-sold') return `备战席已满，${name} 自动出售 +${receipt.gold ?? 0} 金币`;
  if (receipt.resolution === 'gold') return `${name} 卡池缺货，补偿 +${receipt.gold ?? 0} 金币`;
  if (payload.kind === 'unit') return `${name} 已进入备战席`;
  return `${name} 已放入物品栏`;
}

/** Another seat's orbs as everyone may see them (SeatPublic.orbs): only how many and which tiers, never the contents. */
export type PublicOrbs = { readonly count: number; readonly tiers: readonly UnclaimedOrbView['tier'][] };
export function readPublicOrbs(seat: object): PublicOrbs | null {
  const orbs = (seat as { readonly orbs?: PublicOrbs }).orbs;
  return orbs && Number.isInteger(orbs.count) && Array.isArray(orbs.tiers) ? orbs : null;
}
/** Small gems for a public board header; null when the seat has no orb waiting. */
export function publicOrbsElement(orbs: PublicOrbs | null): HTMLElement | null {
  if (!orbs?.count) return null;
  const box = element('span', '', 'public-orbs'); box.dataset.debug = 'public-orbs';
  box.setAttribute('aria-label', `未领取的法球 ${orbs.count} 个：${orbs.tiers.map(tier => ORB_TIER_TEXT[tier] ?? tier).join('、')}`);
  box.title = box.getAttribute('aria-label')!;
  for (const tier of orbs.tiers) box.append(element('span', '', `public-orb orb-${tier}`));
  box.append(element('span', `法球 ${orbs.count}`, 'public-orbs-count'));
  return box;
}

export interface OrbDockActions {
  /** Sends claimOrb for one orb (the scene shows the rules' answer). */
  readonly claim: (orbId: string) => void;
  /** Status line for "queued until after the battle" and the claim results. */
  readonly status: (message: string) => void;
}
export interface OrbDockContext {
  /** My battle is on the board or running: a click is queued by the rules and settled after it. */
  readonly inBattle: boolean;
  /** Spectating or the match ended: orbs are shown, nothing is sent. */
  readonly locked: boolean;
}

const QUEUED_TEXT = '战后结算';
const RESULT_MS = 4_000;
const OPEN_MS = 450;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}

/** Renders into the board-frame mount; one instance per scene. */
export class OrbDock {
  private key = '';
  /** Receipt ids already shown; null until the first state is seen, so a reload or a resume does not replay old results. */
  private seen: Set<string> | null = null;
  /**
   * Orbs clicked during the room's combat whose `queued` flag has not arrived yet: a click in the frozen moment before the
   * battle is accepted by the server but only shows as queued with the battle's first push. Shown as queued meanwhile;
   * dropped when the orb leaves the view or the claim is refused.
   */
  private held = new Set<string>();
  /** Orbs clicked within the last OPEN_MS (opening effect), with when it started. */
  private opening = new Map<string, number>();
  private result: HTMLElement | null = null;
  private resultTimer: number | null = null;
  private last: { readonly state: MatchState; readonly context: OrbDockContext } | null = null;
  constructor(private readonly dock: HTMLElement, private readonly actions: OrbDockActions) {
    dock.classList.add('orb-dock'); dock.setAttribute('aria-label', '未领取的法球');
  }
  /** Forget what was announced (new match, back to the lobby). */
  /** The claim was refused: show the orb as claimable again. */
  release(orbId: string): void { if (this.held.delete(orbId) && this.last) this.render(this.last.state, this.last.context); }
  reset(): void { this.seen = null; this.opening.clear(); this.held.clear(); this.key = ''; this.last = null; this.clearResult(); this.dock.replaceChildren(); }
  dispose(): void { this.reset(); this.dock.remove(); }

  render(state: MatchState, context: OrbDockContext): void {
    this.last = { state, context };
    this.announce(readOrbClaimReceipts(state));
    const orbs = readUnclaimedOrbs(state), present = new Set(orbs.map(orb => orb.orbId));
    for (const id of this.opening.keys()) if (!present.has(id)) this.opening.delete(id);
    for (const id of this.held) if (!present.has(id) || orbs.some(orb => orb.orbId === id && orb.queued)) this.held.delete(id);
    const key = JSON.stringify([orbs, context.inBattle, context.locked, [...this.opening.keys()], [...this.held]]);
    if (key === this.key) return;
    this.key = key;
    const list = element('div', '', 'orb-dock-list');
    for (const orb of orbs) list.append(this.orbButton(orb, context));
    this.dock.replaceChildren(list, ...(this.result ? [this.result] : []));
  }

  private orbButton(shown: UnclaimedOrbView, context: OrbDockContext): HTMLButtonElement {
    const orb = this.held.has(shown.orbId) ? { ...shown, queued: true } : shown;
    const button = element('button', '', `orb-token orb-${orb.tier}${orb.source === 'mechanic' ? ' orb-mechanic' : ''}`);
    button.type = 'button'; button.dataset.debug = `orb-claim:${orb.orbId}`; button.dataset.tier = orb.tier; button.dataset.source = orb.source;
    if (orb.queued) button.dataset.queued = 'true';
    if (this.opening.has(orb.orbId)) button.classList.add('orb-opening');
    const tier = ORB_TIER_TEXT[orb.tier] ?? orb.tier, source = orb.source === 'mechanic' ? '奖励法球' : `${orb.roundId} 野怪掉落`;
    button.disabled = orb.queued || context.locked;
    const hint = orb.queued ? '已排队 · 战斗结束后结算' : context.locked ? '当前不能领取' : context.inBattle ? '点击领取 · 战斗中领取会在战后结算' : '点击领取';
    button.setAttribute('aria-label', `${tier} · ${source} · ${orb.entries.map(orbPayloadName).join('、')} · ${hint}`);
    button.append(element('span', '', 'orb-token-gem'));
    if (orb.source === 'mechanic') button.append(element('span', '奖', 'orb-token-mark'));
    if (orb.queued) button.append(element('span', QUEUED_TEXT, 'orb-token-queued'));
    // Hover card: the orb's contents are visible once it dropped (contract: private unclaimedOrbs.entries).
    const tip = element('span', '', 'orb-tip'); tip.setAttribute('role', 'tooltip');
    tip.append(element('strong', `${tier} · ${source}`));
    const entries = element('ul', '', 'orb-tip-entries');
    for (const payload of orb.entries) {
      const row = element('li'); row.insertAdjacentHTML('afterbegin', payloadLabel(payload).icon); row.append(element('span', orbPayloadName(payload))); entries.append(row);
    }
    tip.append(entries, element('span', hint, 'orb-tip-hint'));
    if (orb.entries.some(payload => payload.kind === 'unit')) tip.append(element('span', '备战席放不下的英雄按原售价自动出售', 'orb-tip-hint'));
    button.append(tip);
    button.addEventListener('click', () => {
      if (button.disabled) return;
      if (context.inBattle) { this.held.add(orb.orbId); this.actions.status('战斗中 · 法球将在战后结算'); }
      this.opening.set(orb.orbId, Date.now()); button.classList.add('orb-opening');
      this.actions.claim(orb.orbId);
      // A refused or queued claim leaves the orb on the dock: drop the opening look after its animation.
      window.setTimeout(() => { if (this.opening.delete(orb.orbId) && this.last) this.render(this.last.state, this.last.context); }, OPEN_MS);
    });
    return button;
  }

  /** New receipts since the last state: one line each (金币 +N, 已入库, 自动出售 +NG), shown by the dock and the status line. */
  private announce(receipts: readonly LootReceipt[]): void {
    if (!this.seen) { this.seen = new Set(receipts.map(receipt => receipt.receiptId)); return; }
    const fresh = receipts.filter(receipt => !this.seen!.has(receipt.receiptId));
    if (!fresh.length) return;
    for (const receipt of fresh) this.seen.add(receipt.receiptId);
    const lines = fresh.map(orbReceiptText).filter((line): line is string => line !== null);
    if (!lines.length) return;
    this.showResult(lines);
    // After the command's own success line (the scene sets it once this render returns), so the result stays readable.
    queueMicrotask(() => this.actions.status(`法球已领取 · ${lines.join(' · ')}`));
  }
  private showResult(lines: readonly string[]): void {
    this.clearResult();
    const box = element('div', '', 'orb-result'); box.dataset.debug = 'orb-result'; box.setAttribute('aria-live', 'polite');
    for (const line of lines) box.append(element('p', line, line.includes('自动出售') ? 'orb-result-sold' : ''));
    this.result = box; this.dock.append(box);
    this.resultTimer = window.setTimeout(() => this.clearResult(), RESULT_MS);
  }
  private clearResult(): void {
    if (this.resultTimer !== null) window.clearTimeout(this.resultTimer);
    this.resultTimer = null; this.result?.remove(); this.result = null;
  }
}
