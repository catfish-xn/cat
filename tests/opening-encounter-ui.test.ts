/**
 * Opening encounters PR8 (client): the texts of the opening-encounter HUD and the HUD's once-only intro, opening-round
 * banner, reviewable chip and 3-5 monkey toast, on the rules' own public view; plus the masterwork / opening-forge popup
 * wording. Minimal DOM stub (no jsdom here), as in scout-minimap.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch, readOpeningEncounterView, readOpeningMelProgress, OPENING_ENCOUNTERS } from '../src/simulation/match';
import { createOpeningEncounter } from '../src/server-entry';
import {
  forgeProgressText, masterworkOffer, melProgressText, monkeyToastText, NOT_ENABLED_TEXT, openingBannerLine, openingBannerText, openingStatusText,
  readOpeningDisplay, type OpeningEncounterDisplay,
} from '../src/presentation/opening-encounter-text';
import { isMasterworkChoice, isShopChoice, readChoiceExtras } from '../src/presentation/choice-fallback';
import { OpeningEncounterHud } from '../src/rendering/opening-encounter-hud';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';

const seedFor = (id: string) => { for (let seed = 1; seed < 400_000; seed++) if (createOpeningEncounter(seed).selection.encounterId === id) return seed; throw new Error(id); };
const viewFor = (id: string): OpeningEncounterDisplay => readOpeningDisplay(readOpeningEncounterView(createMatch(seedFor(id))))!;

describe('PR8 opening-encounter texts', () => {
  it('an enabled encounter shows name, champion, description and the rules\' status text', () => {
    const view = viewFor('component-anvils');
    const text = openingBannerText(view);
    expect(text).toMatchObject({ title: view.nameZh, champion: view.champion!.name_zh, description: view.descriptionZh, status: '本局奇遇效果已启用', closed: false });
    expect(openingBannerLine(view)).toBe(`${view.nameZh} · ${view.champion!.name_zh}`);
  });
  it('every closed encounter (enabled=false) says 效果尚未启用 plainly', () => {
    const closed = OPENING_ENCOUNTERS.filter(entry => !entry.enabled);
    expect(closed.length).toBeGreaterThan(0);
    for (const entry of closed) {
      const view = viewFor(entry.id);
      expect(view.enabled).toBe(false);
      expect(openingStatusText(view), entry.id).toContain(NOT_ENABLED_TEXT);
      expect(openingBannerText(view).closed).toBe(true);
    }
    // Even a status text that does not carry the words gets them.
    expect(openingStatusText({ ...viewFor('trainer-golems'), statusTextZh: '本局抽中此奇遇' })).toBe(`本局抽中此奇遇 · ${NOT_ENABLED_TEXT}`);
  });
  it('"no encounter" has its own title and no champion', () => {
    const view = viewFor('none');
    expect(openingBannerText(view)).toMatchObject({ title: '本局没有奇遇', champion: null, status: '本局不附加奇遇规则', closed: false });
    expect(openingBannerLine(view)).toBe('本局没有奇遇');
  });
  it('monkey toast per outcome; nothing for other nodes or unknown outcomes', () => {
    expect(monkeyToastText({ nodeId: '3-5', outcome: 'damage' })).toBe('发条猴子 · 所有存活玩家受到 10 点伤害');
    expect(monkeyToastText({ nodeId: '3-5', outcome: 'gold' })).toBe('发条猴子 · 所有存活玩家获得 25 金币');
    expect(monkeyToastText({ nodeId: '3-5', outcome: 'masterwork' })).toContain('杰作升级');
    expect(monkeyToastText({ nodeId: '3-5', outcome: 'components' })).toBe('发条猴子 · 所有存活玩家获得 4 件基础装备');
    expect(monkeyToastText({ nodeId: '1-2', outcome: 'gold' })).toBeNull();
    expect(monkeyToastText({ nodeId: '3-5', outcome: 'jackpot' })).toBeNull();
    expect(monkeyToastText(undefined)).toBeNull();
  });
  it('Mel progress: before and after the threshold, the reward always closed, never claimable', () => {
    const progress = readOpeningMelProgress(createMatch(seedFor('mels-blessing')))!;
    expect(melProgressText(progress)).toBe('梅尔的赐福 · 生命值降到 40 及以下时触发（奖励尚未启用）');
    expect(melProgressText({ ...progress, thresholdReached: true })).toBe('梅尔的赐福 · 已达门槛（奖励尚未启用）');
    expect(melProgressText(null)).toBeNull();
    for (const text of [melProgressText(progress), melProgressText({ ...progress, thresholdReached: true })]) expect(text).not.toMatch(/领取|已获得/);
  });
  it('opening forges left; masterwork offers keep the instance id', () => {
    expect(forgeProgressText({ forgesGranted: 2, forgesPending: 2 })).toBe('锻造器 剩余 2');
    expect(forgeProgressText({ forgesGranted: 2, forgesPending: 0 })).toBeNull();
    const offer = masterworkOffer({ itemId: 'item-7', definitionId: 'deathblade', radiantDefinitionId: 'radiant-deathblade' });
    expect(offer.id).toBe('item-7');
    expect(offer.name).toContain('→');
  });
  it('popup wording: the opening anvil names its source; the masterwork pick is a popup, not the shop row', () => {
    const offers = G24_FORGE_POOLS.TFT_ArmoryKeyComponent.slice(0, 4);
    expect(readChoiceExtras({ kind: 'forge', offers, payload: { kind: 'forge', source: 'opening-encounter', timeoutOption: offers[0] } }).title).toBe('本局奇遇 · 基础装备锻造器 · 4 选 1');
    const masterwork = { kind: 'armory', offers: ['item-3'], payload: { kind: 'armory', source: 'masterwork-upgrade', masterwork: { consumableId: 'consumable-1', unitId: 'unit-1' } } };
    expect(isMasterworkChoice(masterwork)).toBe(true);
    expect(isShopChoice(masterwork)).toBe(false);
    const junker = { kind: 'armory', payload: { source: 'junker-king' } };
    expect(isShopChoice(junker)).toBe(true);
    expect(readChoiceExtras(masterwork).title).toBe('杰作升级 · 选择一件装备升级为光明版');
  });
});

/** Minimal DOM: what the HUD touches. */
class Node {
  children: Node[] = []; dataset: Record<string, string> = {}; className = ''; textContent = ''; title = ''; type = ''; hidden = false; offsetWidth = 0;
  listeners: Record<string, () => void> = {};
  classList = { add() {}, remove() {} };
  setAttribute() {} append(...nodes: Node[]) { this.children.push(...nodes); for (const node of nodes) node.parent = this; this.syncText(); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; this.syncText(); } remove() {}
  addEventListener(type: string, handler: () => void) { this.listeners[type] = handler; }
  parent: Node | null = null;
  private syncText() { if (this.children.length) this.textContent = this.children.map(child => child.textContent).join(' '); }
}
function stubDom() {
  const body = new Node(), storage = new Map<string, string>();
  vi.stubGlobal('document', { createElement: () => new Node(), body });
  vi.stubGlobal('window', { setTimeout: () => 1, clearTimeout: () => {}, sessionStorage: {
    get length() { return storage.size; }, key: (index: number) => [...storage.keys()][index] ?? null,
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); },
  } });
  return { body, storage };
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('PR8 opening-encounter HUD', () => {
  it('shows the intro once per match (not again on a later view or a reconnect), the banner in the opening round, the chip always', () => {
    stubDom();
    const view = viewFor('trainer-golems');
    const hud = new OpeningEncounterHud(new Node() as unknown as HTMLElement);
    hud.update({ encounter: view, matchKey: 'm1', round: 1 });
    let shown = hud.debug();
    expect(shown.card).toContain(view.nameZh);
    expect(shown.card).toContain(NOT_ENABLED_TEXT);
    expect(shown.card).toContain('跳过');
    expect(shown.banner).toContain(`本局奇遇 · ${view.nameZh} · ${view.champion!.name_zh}`);
    expect(shown.chip).toContain('本局奇遇');
    hud.closeCard();
    hud.update({ encounter: view, matchKey: 'm1', round: 2 });
    shown = hud.debug();
    expect(shown.card).toBeNull();
    expect(shown.banner).toBeNull();
    expect(shown.chip).toContain(view.nameZh);
    // A new page (reconnect) of the same match in the opening round: the session remembers the intro.
    const again = new OpeningEncounterHud(new Node() as unknown as HTMLElement);
    again.update({ encounter: view, matchKey: 'm1', round: 1 });
    expect(again.debug().card).toBeNull();
    // The chip reopens the same description at any time.
    (hud.chip as unknown as Node).listeners.click!();
    expect(hud.debug().card).toContain(view.descriptionZh);
    expect(hud.debug().card).toContain('知道了');
    // After the match, the next one shows its intro again.
    hud.forgetMatch();
    const next = new OpeningEncounterHud(new Node() as unknown as HTMLElement);
    next.update({ encounter: view, matchKey: 'm1', round: 1 });
    expect(next.debug().card).toContain(view.nameZh);
  });
  it('a reconnect past the opening round shows no intro; my progress lines go on the chip', () => {
    stubDom();
    const view = viewFor('component-anvils');
    const hud = new OpeningEncounterHud(new Node() as unknown as HTMLElement);
    hud.update({ encounter: view, matchKey: 'm2', round: 5, forge: { forgesGranted: 2, forgesPending: 1 } });
    expect(hud.debug().card).toBeNull();
    expect(hud.debug().chip).toContain('锻造器 剩余 1');
    const mel = viewFor('mels-blessing');
    hud.update({ encounter: mel, matchKey: 'm3', round: 5, mel: { thresholdHp: 40, thresholdReached: false } });
    expect(hud.debug().chip).toContain('生命值降到 40 及以下时触发（奖励尚未启用）');
  });
  it('toasts the monkey result when the shared fact is revealed, never for one already there on first sight', () => {
    stubDom();
    const view = viewFor('wind-up-monkey');
    const hud = new OpeningEncounterHud(new Node() as unknown as HTMLElement);
    hud.update({ encounter: view, matchKey: 'm4', round: 14 });
    expect(hud.debug().toast).toBeNull();
    const revealed = { ...view, revealedFacts: [{ nodeId: '3-5', outcome: 'gold' }] };
    hud.update({ encounter: revealed, matchKey: 'm4', round: 15 });
    expect(hud.debug().toast).toBe('发条猴子 · 所有存活玩家获得 25 金币');
    const late = new OpeningEncounterHud(new Node() as unknown as HTMLElement);
    late.update({ encounter: revealed, matchKey: 'm5', round: 16 });
    expect(late.debug().toast).toBeNull();
  });
  it('no encounter view hides everything', () => {
    stubDom();
    const hud = new OpeningEncounterHud(new Node() as unknown as HTMLElement);
    hud.update({ encounter: null, matchKey: 'm6', round: 1 });
    expect(hud.debug()).toEqual({ banner: null, chip: null, card: null, toast: null });
  });
});
