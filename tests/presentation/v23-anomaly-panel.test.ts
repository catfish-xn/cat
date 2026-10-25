import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrategyPanel } from '../../src/rendering/strategy-panel';
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
  hidden = false; disabled = false; inert = false; type = ''; listeners: Record<string, () => void> = {};
  constructor(readonly tag: string) {}
  append(...nodes: Node[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  addEventListener(type: string, fn: () => void) { this.listeners[type] = fn; }
  contains() { return false; }
  focus() {}
  remove() {}
  click() { if (!this.disabled) this.listeners.click?.(); }
  all(): Node[] { return [this, ...this.children.flatMap(child => child.all())]; }
}
function panel(initial: MatchState) {
  vi.stubGlobal('document', { body: { dataset: { online: 'true' } }, createElement: (tag: string) => new Node(tag), activeElement: null });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  let current = initial;
  const actions = { state: () => current, target: vi.fn(), rerollAnomaly: vi.fn(), choose: vi.fn() };
  const modal = new Node('section');
  const instance = Object.assign(Object.create(StrategyPanel.prototype), {
    actions, modal, root: new Node('section'), choiceToken: '', dismissalTimer: null, focusFrame: null,
    clearChoiceDismissal: () => undefined, dropChoiceReopen: () => undefined, shieldChoiceDismissal: () => undefined,
  }) as { renderChoice(state: MatchState): void };
  const render = (state: MatchState) => { current = state; instance.renderChoice(display(state)); };
  render(initial);
  return { actions, modal, render, button: (debug: string) => {
    const found = modal.all().find(node => node.dataset.debug === debug);
    if (!found) throw new Error(`missing button ${debug}`);
    return found;
  } };
}
afterEach(() => vi.unstubAllGlobals());

describe('4-6 anomaly private view and rendered steps', () => {
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

  it('projects the locked target and one offer, renders its Chinese text, and sends choice/reroll ids unchanged', () => {
    const state = offerStep(), c = state.pendingChoice!, vm = display(state), ui = panel(state);
    expect(vm.pendingChoice).toEqual(toSeatPrivateView(state).pendingChoice);
    expect(c).toMatchObject({ step: 'offer', generation: 1, targetId: 'target-b', rerollCount: 0 });
    expect(c.offers).toHaveLength(1);
    expect(ui.modal.all().find(n => n.className === 'anomaly-target-lock')?.textContent)
      .toBe(`已锁定 ${displayUnitName('irelia')} · 余额 2 金币 · 已刷新 0 次`);
    const offer = ui.button(`choice:${c.offers[0]}`);
    expect(offer.textContent).toContain(anomalyDisplayName(c.offers[0]));
    expect(offer.textContent).toContain(anomalyPlayerDescription(c.offers[0]));
    expect(offer.dataset).toMatchObject({ choiceId: c.choiceId, generation: '1' });
    expect(ui.button('anomaly-reroll').textContent).toBe('刷新异常 · 1 金币（余额 2 金币）');
    expect(ui.button('anomaly-reroll').disabled).toBe(false);
    ui.button('anomaly-reroll').click(); offer.click();
    expect(ui.actions.rerollAnomaly).toHaveBeenCalledExactlyOnceWith(c.choiceId, 1);
    expect(ui.actions.choose).toHaveBeenCalledExactlyOnceWith(c.choiceId, 1, c.offers[0]);
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
