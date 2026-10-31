import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANOMALY_BOARD_LOCKED, StrategyPanel } from '../../src/rendering/strategy-panel';
import { MatchSession } from '../../src/rendering/match-session';
import { OnlineApplication } from '../../src/rendering/online/online-application';
import { CarouselHoldingSlot } from '../../src/rendering/online/carousel-panel';
import { ANOMALY_SELL_BLOCKED } from '../../src/rendering/strategy-panel';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { anomalyDisplayName, anomalyPlayerDescription } from '../../src/presentation/g23-display';
import { displayUnitName } from '../../src/rendering/display-names';
import { toPublicBoard, toSeatPrivateView } from '../../src/server/room/projection';
import { forfeitPendingChoice, rerollAnomaly, selectAnomalyTarget, selectChoice } from '../../src/simulation/match';
import { enableMultiplayerSettlement } from '../../src/simulation/round-settlement';
import type { MatchState } from '../../src/simulation/match-types';
import { accepted, catalogPreparation } from '../t5r-helpers';

// Isolated projection fixture (not a restore-valid save); commands and view adapters are real.
function targetStep(): MatchState {
  const base = accepted(enableMultiplayerSettlement(catalogPreparation('4-6'), 's0'));
  const unit = base.preparation.units.find(u => u.team === 'player')!;
  return { ...base, gold: 2, phase: 'choice', combat: null,
    preparation: { ...base.preparation, units: [
      { ...unit, id: 'target-b', definitionId: 'irelia', location: { kind: 'board', cell: { row: 4, col: 0 } } },
      { ...unit, id: 'target-a', definitionId: 'vex', location: { kind: 'bench', slot: 0 } },
      { ...unit, id: 'enemy', team: 'enemy', location: { kind: 'board', cell: { row: 0, col: 0 } } },
    ] },
    pendingChoice: { kind: 'anomaly', step: 'target', choiceId: 'round:4-6:anomaly', eventId: 'round:4-6:anomaly',
      generation: 0, offers: [], targetId: null, rerollCount: 0, returnPhase: 'preparation' } };
}
function offerStep(): MatchState {
  const state = targetStep(), c = state.pendingChoice!;
  return accepted(selectAnomalyTarget(state, c.choiceId, c.generation, 'target-b'));
}
const display = (state: MatchState) => toDisplayMatch(toSeatPrivateView(state));

// Tiny DOM recorder: exercise the production renderChoice/button code without Phaser or a browser.
// No selectors/layout are emulated; assertions inspect the actual nodes and callbacks it creates.
class Node {
  children: Node[] = []; dataset: Record<string, string> = {}; textContent = ''; className = '';
  parent: Node | null = null;
  hidden = false; disabled = false; inert = false; type = ''; listeners: Record<string, () => void> = {};
  title = ''; style: Record<string, string> = {};
  classList = { add() {}, toggle() {} };
  constructor(readonly tag: string) {}
  append(...nodes: Node[]) { this.children.push(...nodes); nodes.forEach(node => { node.parent = this; }); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  addEventListener(type: string, fn: () => void) { this.listeners[type] = fn; }
  setAttribute() {}
  contains() { return false; }
  querySelector() { return this.all().find(node => node.tag === 'button' && !node.disabled) ?? null; }
  focus() {}
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  click() { if (!this.disabled) this.listeners.click?.(); }
  all(): Node[] { return [this, ...this.children.flatMap(child => child.all())]; }
}
function panel(initial: MatchState, online = true, project = true) {
  const body = new Node('body'); if (online) body.dataset.online = 'true';
  vi.stubGlobal('document', { body, createElement: (tag: string) => new Node(tag), createTextNode: (text: string) => Object.assign(new Node('#text'), { textContent: text }), getElementById: () => null, activeElement: null });
  const focusFrame = vi.fn(() => 1);
  vi.stubGlobal('requestAnimationFrame', focusFrame);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.stubGlobal('getComputedStyle', () => ({ display: 'block' }));
  let current = initial;
  const actions = { state: () => current, target: vi.fn(), rerollAnomaly: vi.fn(), choose: vi.fn(), choiceVisibilityChanged: vi.fn(), equip: vi.fn(), status: vi.fn(),
    selectedUnit: () => 'target-a', deploy: vi.fn(), highlight: vi.fn() };
  const modal = new Node('section');
  const instance = Object.assign(Object.create(StrategyPanel.prototype), {
    actions, modal, root: new Node('section'), choiceToken: '', dismissalTimer: null, focusFrame: null,
    clearChoiceDismissal: () => undefined, shieldChoiceDismissal: vi.fn(), choiceReopen: null,
  }) as { readonly blocksBoard: boolean; renderChoice(state: MatchState): void; choiceRefused(choiceId: string, generation: number): void;
    render(): void; equipAt(itemId: string, unitId: string, slot: number): void; dropPreviewText(itemId: string, unitId: string, slot: number | null): string };
  const render = (state: MatchState) => { current = state; instance.renderChoice(project ? display(state) : state); };
  render(initial);
  return { actions, body, modal, render, instance, focusFrame, button: (debug: string) => {
    const found = modal.all().find(node => node.dataset.debug === debug);
    if (!found) throw new Error(`missing button ${debug}`);
    return found;
  } };
}
afterEach(() => vi.unstubAllGlobals());

describe('4-6 anomaly private view and rendered steps', () => {
  it('single-player choice enables the actual deployment grid and bench controls only while hidden', () => {
    const base = targetStep(), state = { ...base, multiplayer: undefined, m8: { ...base.m8, preparation: { ...base.m8.preparation, enemies: [] } } };
    const ui = panel(state, false, false), root = new Node('section');
    Object.assign(ui.instance, { root, selectedItems: [], tab: 'units', augmentStrip: new Node('section'), traitColumn: { render: vi.fn() },
      renderShop: vi.fn(), updateCombat: vi.fn(), lootPanel: () => null });
    for (const hidden of [false, true, false]) {
      if (hidden) ui.button('choice-collapse').click();
      else ui.body.all().find(node => node.dataset.debug === 'choice-reopen')?.click();
      ui.instance.render();
      const cell = root.all().find(node => node.dataset.debug === 'deploy:1,4')!, bench = root.all().find(node => node.dataset.debug === 'mobile:bench:1')!;
      expect(cell.disabled).toBe(!hidden); expect(bench.disabled).toBe(!hidden);
      cell.click(); bench.click();
      expect(ui.actions.deploy).toHaveBeenCalledTimes(hidden ? 2 : 0);
      if (hidden) {
        expect(ui.actions.deploy.mock.calls).toEqual([['target-a', { kind: 'board', cell: { col: 1, row: 4 } }], ['target-a', { kind: 'bench', slot: 1 }]]);
        ui.actions.deploy.mockClear();
      }
    }
  });

  it('held carousel units show the anomaly sale refusal and recover after the choice is resolved', () => {
    const state = targetStep(); panel(state);
    const root = new Node('aside'), sell = vi.fn();
    const holding = Object.assign(Object.create(CarouselHoldingSlot.prototype), { root, onSell: sell, key: '' }) as CarouselHoldingSlot;
    const heldCarouselUnits = [{ receiptId: 'r', unitId: 'held', definitionId: 'vex' }];
    const session: { state: MatchState & { heldCarouselUnits: typeof heldCarouselUnits } } = { state: { ...state, heldCarouselUnits } };
    const application = Object.assign(Object.create(OnlineApplication.prototype), { session, mode: 'active', spectating: false,
      view: { phase: { kind: 'choice' } }, economy: { render: vi.fn() }, syncSummary: vi.fn(), carouselHolding: holding }) as { syncBattleViews(): void };
    const button = () => root.all().find(node => node.dataset.debug === 'online:carousel-holding-sell:held')!;
    for (const phase of ['choice', 'preparation'] as const) {
      session.state = phase === 'choice' ? { ...state, phase: 'choice', combat: null, heldCarouselUnits }
        : { ...state, phase: 'preparation', combat: null, heldCarouselUnits };
      application.syncBattleViews();
      expect(button().disabled).toBe(true); expect(button().title).toBe(ANOMALY_SELL_BLOCKED);
      button().click(); expect(sell).not.toHaveBeenCalled();
    }
    session.state = { ...session.state, pendingChoice: null }; application.syncBattleViews();
    expect(button().disabled).toBe(false); button().click(); expect(sell).toHaveBeenCalledExactlyOnceWith('held');
  });

  for (const online of [false, true]) it(`online=${online}: blocks equipment previews and submission while open and permits them while hidden`, () => {
    const state: MatchState = { ...offerStep(), multiplayer: online ? offerStep().multiplayer : undefined,
      items: [{ id: 'item-1', definitionId: 'sword', location: { kind: 'inventory' } }] };
    const session = new MatchSession(state), ui = panel(session.state, online, false);
    ui.actions.equip.mockImplementation((item, unit, slot) => {
      const result = session.equip(item, unit, slot); expect(result.ok).toBe(true); ui.render(session.state);
    });
    try {
      for (const slot of [null, 0]) expect(ui.instance.dropPreviewText('item-1', 'target-b', slot)).toBe(ANOMALY_BOARD_LOCKED);
      ui.instance.equipAt('item-1', 'target-b', 0);
      expect(ui.actions.equip).not.toHaveBeenCalled(); expect(ui.actions.status).toHaveBeenLastCalledWith(ANOMALY_BOARD_LOCKED);
      expect(session.state.items[0].location).toEqual({ kind: 'inventory' });
      ui.button('choice-collapse').click();
      expect(ui.instance.dropPreviewText('item-1', 'target-b', null)).toContain('装备');
      ui.body.all().find(node => node.dataset.debug === 'choice-reopen')!.click();
      // Even a slot/drop prepared while hidden must be refused after the interface reopens.
      ui.instance.equipAt('item-1', 'target-b', 0); expect(ui.actions.equip).not.toHaveBeenCalled();
      ui.button('choice-collapse').click(); ui.instance.equipAt('item-1', 'target-b', 0);
      expect(ui.actions.equip).toHaveBeenCalledExactlyOnceWith('item-1', 'target-b', 0, undefined);
      expect(session.state.items[0].location).toEqual({ kind: 'unit', unitId: 'target-b', slot: 0 });
    } finally { session.dispose(); }
  });

  it('locks all target buttons across duplicate clicks, unrelated snapshots and hiding until the matching refusal', () => {
    const state = targetStep(), c = state.pendingChoice!, ui = panel(state), first = ui.button('anomaly-target:target-b');
    first.click(); first.click(); ui.button('anomaly-target:target-a').click();
    expect(ui.actions.target).toHaveBeenCalledExactlyOnceWith(c.choiceId, c.generation, 'target-b');
    expect(first.disabled).toBe(true); expect(ui.button('anomaly-target:target-a').disabled).toBe(true);
    ui.button('choice-collapse').click(); ui.render({ ...state, gold: 1 });
    ui.instance.choiceRefused('other', c.generation); ui.instance.choiceRefused(c.choiceId, c.generation + 1);
    expect(first.disabled).toBe(true); expect(ui.modal.hidden).toBe(true);
    ui.instance.choiceRefused(c.choiceId, c.generation);
    expect(first.disabled).toBe(false); expect(ui.modal.hidden).toBe(true);
    ui.body.all().find(node => node.dataset.debug === 'choice-reopen')!.click();
    ui.button('anomaly-target:target-a').click(); expect(ui.actions.target).toHaveBeenCalledTimes(2);
    const next = accepted(selectAnomalyTarget(state, c.choiceId, c.generation, 'target-a'));
    ui.render(next); first.click(); expect(ui.actions.target).toHaveBeenCalledTimes(2);
    expect(ui.button(`choice:${next.pendingChoice!.offers[0]}`).disabled).toBe(false);
  });

  for (const online of [false, true]) for (const phase of ['preparation', 'choice'] as const) {
    it.each(['target', 'offer'] as const)(`online=${online} ${phase}/%s: hides and restores the board lock without answering`, step => {
      // R1 can retain choice or use preparation; exercise the panel with either supplied view, independently of the old projection.
      const state: MatchState = { ...(step === 'target' ? targetStep() : offerStep()), phase, combat: null };
      const before = JSON.stringify(state), ui = panel(state, online, false);
      expect(ui.instance.blocksBoard).toBe(true);
      expect(ui.button('choice-collapse').textContent).toBe('隐藏界面 · 查看棋盘');
      expect(ui.modal.all().some(node => node.textContent.includes('完成进化后可出售'))).toBe(true);
      ui.button('choice-collapse').click();
      expect(ui.modal.hidden).toBe(true); expect(ui.instance.blocksBoard).toBe(false);
      expect(ui.actions.choiceVisibilityChanged).toHaveBeenCalledTimes(2);
      const reopen = ui.body.all().find(node => node.dataset.debug === 'choice-reopen')!;
      expect(reopen.textContent).toContain('恢复界面');
      reopen.click();
      expect(ui.modal.hidden).toBe(false); expect(ui.instance.blocksBoard).toBe(true);
      expect(ui.actions.choiceVisibilityChanged).toHaveBeenCalledTimes(3);
      expect(ui.actions.target).not.toHaveBeenCalled(); expect(ui.actions.choose).not.toHaveBeenCalled();
      expect(ui.actions.rerollAnomaly).not.toHaveBeenCalled(); expect(JSON.stringify(state)).toBe(before);
    });
  }

  it('keeps an anomaly hidden across a new generation, clears it at timeout and ignores the old restore button', () => {
    const state = offerStep(), ui = panel(state), c = state.pendingChoice!;
    ui.button('choice-collapse').click();
    const next = accepted(rerollAnomaly(state, c.choiceId, c.generation));
    ui.render(next);
    expect(ui.modal.hidden).toBe(true); expect(ui.instance.blocksBoard).toBe(false);
    expect(ui.body.all().filter(node => node.dataset.debug === 'choice-reopen')).toHaveLength(1);
    const stale = ui.body.all().find(node => node.dataset.debug === 'choice-reopen')!;
    const timedOut = accepted(forfeitPendingChoice(next, next.round, c.choiceId, next.pendingChoice!.generation));
    ui.render(timedOut);
    expect(ui.instance.blocksBoard).toBe(false); expect(ui.modal.hidden).toBe(true);
    expect(ui.body.all().filter(node => node.dataset.debug === 'choice-reopen')).toHaveLength(0);
    stale.click(); expect(ui.modal.hidden).toBe(true);
    const another = { ...state, pendingChoice: { ...c, choiceId: 'another-anomaly' } };
    ui.render(another);
    expect(ui.instance.blocksBoard).toBe(true); expect(ui.modal.hidden).toBe(false);
  });

  it('keeps the in-flight action locked while hidden and releases only its matching interrupted receipt', () => {
    const state = offerStep(), ui = panel(state), c = state.pendingChoice!;
    ui.button('anomaly-reroll').click(); ui.button('choice-collapse').click();
    ui.render({ ...state, gold: 1 });
    expect(ui.modal.hidden).toBe(true); expect(ui.instance.blocksBoard).toBe(false);
    expect(ui.button(`choice:${c.offers[0]}`).disabled).toBe(true);
    ui.instance.choiceRefused(c.choiceId, c.generation);
    expect(ui.modal.hidden).toBe(true);
    expect(ui.button('anomaly-reroll').disabled).toBe(false);
    ui.body.all().find(node => node.dataset.debug === 'choice-reopen')!.click();
    expect(ui.instance.blocksBoard).toBe(true);
    ui.button(`choice:${c.offers[0]}`).click();
    expect(ui.actions.choose).toHaveBeenCalledExactlyOnceWith(c.choiceId, c.generation, c.offers[0]);
  });
  it('keeps a trainer golem in the online target list and accepts the ordinary anomaly command', () => {
    const base = targetStep();
    const golem = { ...base.preparation.units[0], id: 'trainer', definitionId: 'trainer-golem', starLevel: 2 as const };
    const state = { ...base, preparation: { ...base.preparation, units: [golem] } };
    const ui = panel(state), choice = state.pendingChoice!;
    ui.button('anomaly-target:trainer').click();
    expect(ui.actions.target).toHaveBeenCalledExactlyOnceWith(choice.choiceId, 0, 'trainer');
    const selected = accepted(selectAnomalyTarget(state, choice.choiceId, 0, 'trainer'));
    expect(selected.pendingChoice).toMatchObject({ step: 'offer', targetId: 'trainer' });
    // This records v23 behaviour only; it is not evidence of original 14.24 eligibility.
    expect(selected.pendingChoice!.offers).toHaveLength(1);
    expect(selected.pendingChoice!.offers).not.toContain('ultimate-hero');
    expect(selected.pendingChoice!.offers).not.toContain('into-the-unknown');
    const bound = accepted(selectChoice(selected, choice.choiceId, 1, selected.pendingChoice!.offers[0]));
    expect(bound.anomalyBinding?.unitId).toBe('trainer');
  });

  it('projects the target step and renders only own board/bench targets with the current command token', () => {
    const state = targetStep(), view = toSeatPrivateView(state), vm = display(state);
    expect(vm.pendingChoice).toEqual(view.pendingChoice);
    expect(vm.pendingChoice).toMatchObject({ kind: 'anomaly', step: 'target', offers: [], targetId: null, generation: 0 });
    const ui = panel(state);
    expect(ui.modal.all().filter(n => n.dataset.debug?.startsWith('anomaly-target:')).map(n => n.dataset.debug))
      .toEqual(['anomaly-target:target-b', 'anomaly-target:target-a']);
    expect(ui.modal.all().map(n => n.textContent)).toContain('先选择一个单位。锁定后不能换目标；升级时随单位保留。');
    expect(ui.modal.all().some(n => n.dataset.debug === 'anomaly-reroll')).toBe(false);
    ui.button('anomaly-target:target-a').click();
    expect(ui.actions.target).toHaveBeenCalledExactlyOnceWith('round:4-6:anomaly', 0, 'target-a');
  });

  it('lists only anomalyTargetIds, in that order, and refreshes when the projection gains a unit', () => {
    const base = targetStep(), source = base.preparation.units[0]!;
    const state: MatchState = { ...base, preparation: { ...base.preparation, units: [
      base.preparation.units[0]!,
      { ...source, id: 'anvil', definitionId: 'TFT_ArmoryKeyCompleted', location: { kind: 'bench', slot: 1 } },
      { ...source, id: 'trainer', definitionId: 'trainer-golem', starLevel: 2, location: { kind: 'bench', slot: 2 } },
      base.preparation.units[1]!,
      { ...source, id: 'ghost', definitionId: 'not-a-champion', location: { kind: 'bench', slot: 3 } },
      base.preparation.units[2]!,
    ] } };
    const shown = display(state);
    expect(shown.anomalyTargetIds).toEqual(['target-b', 'trainer', 'target-a']);
    expect(shown.anomalyTargetIds).not.toEqual(expect.arrayContaining(['anvil', 'ghost', 'enemy']));
    const reversed = { ...shown, preparation: { ...shown.preparation, units: [...shown.preparation.units].reverse() } };
    const ui = panel(reversed as MatchState, true, false);
    const buttons = () => ui.modal.all().filter(node => node.dataset.debug?.startsWith('anomaly-target:')).map(node => node.dataset.debug);
    expect(buttons()).toEqual(shown.anomalyTargetIds!.map(id => `anomaly-target:${id}`));
    const bought = { ...source, id: 'bought', definitionId: 'vex', location: { kind: 'bench' as const, slot: 6 } };
    const grown: MatchState = { ...state, preparation: { ...state.preparation, units: [...state.preparation.units, bought] } };
    ui.render(grown);
    expect(buttons()).toEqual(['anomaly-target:target-b', 'anomaly-target:trainer', 'anomaly-target:target-a', 'anomaly-target:bought']);
    expect(toSeatPrivateView(grown).anomalyTargetIds).toEqual(['target-b', 'trainer', 'target-a', 'bought']);
  });

  it('projects the locked target and one offer, renders its Chinese text, and sends choice/reroll ids unchanged', () => {
    const state = offerStep(), c = state.pendingChoice!, vm = display(state), ui = panel(state);
    expect(vm.pendingChoice).toEqual(toSeatPrivateView(state).pendingChoice);
    expect(c).toMatchObject({ step: 'offer', generation: 1, targetId: 'target-b', rerollCount: 0 });
    expect(c.offers).toHaveLength(1);
    expect(ui.modal.all().find(n => n.className === 'anomaly-target-lock')?.textContent)
      .toBe(`已锁定 ${displayUnitName('irelia')} ★ · 棋盘 (0,4) · 余额 2 金币 · 已刷新 0 次`);
    const offer = ui.button(`choice:${c.offers[0]}`), description = ui.button(`anomaly-offer:${c.offers[0]}`);
    expect(description.all().map(n => n.textContent)).toContain(anomalyDisplayName(c.offers[0]));
    expect(description.all().map(n => n.textContent)).toContain(anomalyPlayerDescription(c.offers[0]));
    expect(description.tag).toBe('article');
    expect(description.all().some(n => n.tag === 'button')).toBe(false);
    description.click();
    expect(ui.actions.choose).not.toHaveBeenCalled();
    expect(offer.textContent).toBe('进化 · 免费');
    expect(offer.dataset).toMatchObject({ choiceId: c.choiceId, generation: '1' });
    expect(ui.button('anomaly-reroll').textContent).toBe('刷新异常 · 1 金币（余额 2 金币）');
    expect(ui.button('anomaly-reroll').disabled).toBe(false);
    ui.button('anomaly-reroll').click();
    expect(ui.actions.rerollAnomaly).toHaveBeenCalledExactlyOnceWith(c.choiceId, 1);
    const confirmation = panel(state);
    confirmation.button(`choice:${c.offers[0]}`).click(); confirmation.button(`choice:${c.offers[0]}`).click();
    expect(confirmation.actions.choose).toHaveBeenCalledExactlyOnceWith(c.choiceId, 1, c.offers[0]);
  });

  it.each([0, 1])('gold=%i: reroll UI and authoritative cost agree at the affordability boundary', gold => {
    const state = { ...offerStep(), gold }, c = state.pendingChoice!, ui = panel(state);
    expect(ui.button('anomaly-reroll').disabled).toBe(gold === 0);
    ui.button('anomaly-reroll').click();
    expect(ui.actions.rerollAnomaly).toHaveBeenCalledTimes(gold);
    const result = rerollAnomaly(state, c.choiceId, c.generation);
    if (!gold) {
      expect(result).toMatchObject({ ok: false, reason: 'insufficient-gold' });
      expect(result).not.toHaveProperty('events');
      expect(result.state).toBe(state);
    } else {
      const next = accepted(result);
      expect(next.gold).toBe(0);
      expect(next.pendingChoice).toMatchObject({ targetId: c.targetId, generation: 2, rerollCount: 1 });
      expect(next.pendingChoice!.offers).toHaveLength(1);
      expect(next.pendingChoice!.offers[0]).not.toBe(c.offers[0]);
      ui.render(next);
      expect(ui.button('anomaly-reroll').disabled).toBe(true);
      expect(ui.button(`choice:${next.pendingChoice!.offers[0]}`).dataset.generation).toBe('2');
    }
  });

  it('zero gold still permits confirming the current offer, closes the modal and rejects a duplicate click', () => {
    const state = { ...offerStep(), gold: 0 }, c = state.pendingChoice!, ui = panel(state);
    expect(ui.button(`choice:${c.offers[0]}`).disabled).toBe(false);
    ui.button(`choice:${c.offers[0]}`).click(); ui.button(`choice:${c.offers[0]}`).click();
    expect(ui.actions.choose).toHaveBeenCalledExactlyOnceWith(c.choiceId, c.generation, c.offers[0]);
    expect(ui.button(`choice:${c.offers[0]}`).disabled).toBe(true);
    const chosen = accepted(selectChoice(state, c.choiceId, c.generation, c.offers[0]));
    expect(chosen.pendingChoice).toBeNull();
    expect(chosen.anomalyBinding).toMatchObject({ definitionId: c.offers[0], unitId: c.targetId, choiceId: c.choiceId });
    expect(display(chosen).anomalyBinding).toEqual(toSeatPrivateView(chosen).anomalyBinding);
    ui.render(chosen);
    expect(ui.modal.hidden).toBe(true);
    const duplicate = selectChoice(chosen, c.choiceId, c.generation, c.offers[0]);
    expect(duplicate).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(duplicate.state).toBe(chosen);
    expect(duplicate).not.toHaveProperty('events');
  });

  it('same-generation gold updates refresh the displayed balance and reroll affordability', () => {
    const state = { ...offerStep(), gold: 1 }, ui = panel(state);
    // Online shopping can change gold without changing choiceId/generation/step.
    ui.render({ ...state, gold: 0 });
    expect(ui.button('anomaly-reroll').disabled).toBe(true);
    expect(ui.button('anomaly-reroll').textContent).toBe('刷新异常 · 1 金币（余额 0 金币）');
    expect(ui.button(`choice:${state.pendingChoice!.offers[0]}`).disabled).toBe(false);
  });

  it('keeps choose in flight across unrelated receipts and target updates with the same choiceId/generation', () => {
    const state = offerStep(), c = state.pendingChoice!, ui = panel(state), evolve = ui.button(`choice:${c.offers[0]}`);
    evolve.click();
    ui.render({ ...state, gold: 0, pendingChoice: { ...c } });
    expect(ui.button(`choice:${c.offers[0]}`)).toBe(evolve);
    expect(evolve.disabled).toBe(true);
    evolve.click();
    expect(ui.actions.choose).toHaveBeenCalledExactlyOnceWith(c.choiceId, c.generation, c.offers[0]);
    ui.render({ ...state, gold: 0, pendingChoice: { ...c }, preparation: { ...state.preparation,
      units: state.preparation.units.map(unit => ({ ...unit, starLevel: 2 })) } });
    expect(ui.button(`choice:${c.offers[0]}`)).toBe(evolve);
    expect(evolve.disabled).toBe(true);
    expect(ui.button('anomaly-reroll').disabled).toBe(true);
    evolve.click(); ui.button(`choice:${c.offers[0]}`).click();
    expect(ui.actions.choose).toHaveBeenCalledExactlyOnceWith(c.choiceId, c.generation, c.offers[0]);
    expect(ui.actions.rerollAnomaly).not.toHaveBeenCalled();
    expect(ui.modal.all().find(n => n.className === 'anomaly-target-lock')?.textContent)
      .toBe(`已锁定 ${displayUnitName('irelia')} ★★ · 棋盘 (0,4) · 余额 0 金币 · 已刷新 0 次`);
  });

  it('disables both actions during a reroll until a new generation arrives', () => {
    const state = offerStep(), c = state.pendingChoice!, ui = panel(state), evolve = ui.button(`choice:${c.offers[0]}`), reroll = ui.button('anomaly-reroll');
    reroll.click();
    expect(evolve.disabled).toBe(true); expect(reroll.disabled).toBe(true);
    ui.render({ ...state, pendingChoice: { ...c } });
    evolve.click(); reroll.click();
    expect(ui.actions.choose).not.toHaveBeenCalled();
    expect(ui.actions.rerollAnomaly).toHaveBeenCalledExactlyOnceWith(c.choiceId, c.generation);
    const next = accepted(rerollAnomaly(state, c.choiceId, c.generation));
    ui.render(next);
    expect(ui.button('anomaly-reroll').disabled).toBe(false);
    expect(ui.button(`choice:${next.pendingChoice!.offers[0]}`).disabled).toBe(false);
    evolve.click(); reroll.click();
    expect(ui.actions.choose).not.toHaveBeenCalled();
    expect(ui.actions.rerollAnomaly).toHaveBeenCalledTimes(1);
    ui.button(`choice:${next.pendingChoice!.offers[0]}`).click();
    expect(ui.actions.choose).toHaveBeenCalledExactlyOnceWith(c.choiceId, next.pendingChoice!.generation, next.pendingChoice!.offers[0]);
  });

  it.each(['choose', 'reroll'] as const)('reenables an online %s only on its matching refusal', action => {
    const state = offerStep(), c = state.pendingChoice!, ui = panel(state), evolve = ui.button(`choice:${c.offers[0]}`), reroll = ui.button('anomaly-reroll');
    (action === 'choose' ? evolve : reroll).click();
    ui.instance.choiceRefused('another-choice', c.generation);
    ui.instance.choiceRefused(c.choiceId, c.generation - 1);
    expect(evolve.disabled).toBe(true); expect(reroll.disabled).toBe(true);
    ui.render({ ...state, pendingChoice: { ...c } });
    expect(evolve.disabled).toBe(true); expect(reroll.disabled).toBe(true);
    ui.instance.choiceRefused(c.choiceId, c.generation);
    expect(evolve.disabled).toBe(false); expect(reroll.disabled).toBe(false);
    (action === 'choose' ? evolve : reroll).click();
    expect(action === 'choose' ? ui.actions.choose : ui.actions.rerollAnomaly).toHaveBeenCalledTimes(2);
    expect(evolve.disabled).toBe(true); expect(reroll.disabled).toBe(true);
  });

  it.each(['choose', 'reroll'] as const)('immediately reenables a synchronous offline %s refusal with unchanged pending choice', action => {
    const state = offerStep(), c = state.pendingChoice!, ui = panel(state, false), evolve = ui.button(`choice:${c.offers[0]}`), reroll = ui.button('anomaly-reroll');
    (action === 'choose' ? evolve : reroll).click();
    expect(evolve.disabled).toBe(false); expect(reroll.disabled).toBe(false);
    (action === 'choose' ? evolve : reroll).click();
    expect(action === 'choose' ? ui.actions.choose : ui.actions.rerollAnomaly).toHaveBeenCalledTimes(2);
  });

  it('updates target identity, stars, position and balance in place without reopening a collapsed choice', () => {
    const state = offerStep(), c = state.pendingChoice!, ui = panel(state), evolve = ui.button(`choice:${c.offers[0]}`);
    ui.button('choice-collapse').click();
    expect(ui.modal.hidden).toBe(true);
    const frames = ui.focusFrame.mock.calls.length;
    ui.render({ ...state, gold: 1, preparation: { ...state.preparation, units: state.preparation.units.map(unit => unit.id === c.targetId
      ? { ...unit, definitionId: 'vex', starLevel: 2, location: { kind: 'bench', slot: 2 } } : unit) } });
    expect(ui.modal.hidden).toBe(true);
    expect(ui.button(`choice:${c.offers[0]}`)).toBe(evolve);
    expect(ui.focusFrame).toHaveBeenCalledTimes(frames);
    expect(ui.modal.all().find(n => n.className === 'anomaly-target-lock')?.textContent)
      .toBe(`已锁定 ${displayUnitName('vex')} ★★ · 备战席 3 · 余额 1 金币 · 已刷新 0 次`);
  });

  it('a detached evolve control cannot submit after the authority has advanced the offer', () => {
    const state = offerStep(), ui = panel(state), previous = ui.button(`choice:${state.pendingChoice!.offers[0]}`), previousReroll = ui.button('anomaly-reroll');
    const next = accepted(rerollAnomaly(state, state.pendingChoice!.choiceId, state.pendingChoice!.generation));
    ui.render(next); previous.click(); previousReroll.click();
    expect(ui.actions.choose).not.toHaveBeenCalled();
    expect(ui.actions.rerollAnomaly).not.toHaveBeenCalled();
    ui.button(`choice:${next.pendingChoice!.offers[0]}`).click();
    expect(ui.actions.choose).toHaveBeenCalledExactlyOnceWith(next.pendingChoice!.choiceId, next.pendingChoice!.generation, next.pendingChoice!.offers[0]);
  });

  it('refuses stale target/offer/reroll tokens without events, resources or RNG changes', () => {
    const state = offerStep(), c = state.pendingChoice!;
    for (const result of [selectAnomalyTarget(state, c.choiceId, 0, 'target-a'),
      selectChoice(state, c.choiceId, 0, c.offers[0]), rerollAnomaly(state, c.choiceId, 0),
      selectChoice(state, 'round:4-5:anomaly', c.generation, c.offers[0])]) {
      expect(result).toMatchObject({ ok: false, reason: 'stale-choice' });
      expect(result).not.toHaveProperty('events');
      expect(result.state).toBe(state);
    }
    expect(selectAnomalyTarget(state, c.choiceId, c.generation, 'target-a'))
      .toMatchObject({ ok: false, reason: 'invalid-choice', state });
  });

  it('never projects hidden RNG/ledgers or pending offers onto an opponent board', () => {
    const state = offerStep(), before = JSON.stringify(state), view = toSeatPrivateView(state);
    for (const key of ['seed', 'rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState', 'resourceProvenance', 'scheduleReceipts'])
      expect(view).not.toHaveProperty(key);
    const publicBoard = toPublicBoard(state);
    expect(publicBoard).not.toHaveProperty('pendingChoice');
    expect(publicBoard).not.toHaveProperty('gold');
    expect(JSON.stringify(publicBoard)).not.toContain(state.pendingChoice!.choiceId);
    expect(display(state).pendingChoice).toEqual(view.pendingChoice);
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(['target', 'offer', 'empty'] as const)('timeout from %s closes the modal and publishes the authoritative binding', step => {
    let state = step === 'offer' ? offerStep() : targetStep();
    if (step === 'empty') state = { ...state, preparation: { ...state.preparation, units: [] } };
    const c = state.pendingChoice!, ui = panel(state);
    const result = forfeitPendingChoice(state, state.round, c.choiceId, c.generation);
    if (!result.ok) throw new Error(result.reason);
    const next = result.state;
    expect(next.pendingChoice).toBeNull();
    expect(next.phase).toBe('preparation');
    if (step === 'empty') {
      expect(next.anomalyBinding).toBeNull();
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'choiceTimedOut', resolution: 'empty-anomaly' }));
    } else {
      expect(next.anomalyBinding).toMatchObject({ choiceId: c.choiceId, unitId: step === 'target' ? 'target-a' : 'target-b' });
      if (step === 'offer') expect(next.anomalyBinding!.definitionId).toBe(c.offers[0]);
      expect(display(next).anomalyBinding).toEqual(toSeatPrivateView(next).anomalyBinding);
    }
    ui.render(next);
    expect(ui.modal.hidden).toBe(true);
    expect(ui.modal.children).toEqual([]);
    expect(forfeitPendingChoice(next, next.round, c.choiceId, c.generation)).toMatchObject({ ok: false, reason: 'stale-choice' });
  });

  it('eliminated final view drops a stale pending choice and closes an already open panel', () => {
    const state = offerStep(), ui = panel(state);
    const eliminated: MatchState = { ...state, phase: 'gameOver', combat: null, playerHp: 0,
      multiplayer: { ...state.multiplayer!, status: 'eliminated' } };
    expect(toSeatPrivateView(eliminated).pendingChoice).toBeNull();
    expect(display(eliminated).pendingChoice).toBeNull();
    ui.render(eliminated);
    expect(ui.modal.hidden).toBe(true);
    expect(ui.modal.children).toEqual([]);
    const c = state.pendingChoice!;
    expect(forfeitPendingChoice(eliminated, eliminated.round, c.choiceId, c.generation))
      .toMatchObject({ ok: false, reason: 'seat-eliminated', state: eliminated });
  });
});
