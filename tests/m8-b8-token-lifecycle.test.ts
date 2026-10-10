import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Unit } from '../src/simulation/units';
import type { CombatState, CombatUnit } from '../src/simulation/combat-types';
import { createMatch, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { MatchSession } from '../src/rendering/match-session';

/** Display-only substitutes. No Match state, reward, phase or command is mocked. */
const display = vi.hoisted(() => {
  class Token {
    active = true;
    visible = true;
    alpha = 1;
    scaleX = 1;
    scaleY = 1;
    depth = 0;
    input: { enabled: boolean; draggable: boolean } | undefined;
    destroyCount = 0;
    private data = new Map<string, unknown>();
    private handlers = new Map<string, () => void>();
    constructor(readonly name: string, public x: number, public y: number) {}
    setData(key: string, value: unknown) { this.data.set(key, value); return this; }
    getData(key: string) { return this.data.get(key); }
    setInteractive() { this.input = { enabled: true, draggable: false }; return this; }
    disableInteractive() { if (this.input) this.input.enabled = false; return this; }
    on(event: string, callback: () => void) { this.handlers.set(event, callback); return this; }
    click() { if (this.active && this.visible && this.input?.enabled) this.handlers.get('pointerdown')?.(); }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    setVisible(value: boolean) { this.visible = value; return this; }
    setAlpha(value: number) { this.alpha = value; return this; }
    setScale(value: number) { this.scaleX = value; this.scaleY = value; return this; }
    setDepth(value: number) { this.depth = value; return this; }
    destroy() { this.destroyCount++; this.active = false; this.visible = false; }
  }
  class View {
    readonly token: Token;
    lastUnit: Unit;
    lastCombatUnit: CombatUnit | undefined;
    ring = 'normal';
    destroyCount = 0;
    resetCount = 0;
    constructor(_scene: unknown, unit: Unit, x: number, y: number) {
      this.token = new Token(`unit:${unit.id}`, x, y).setData('unitId', unit.id);
      this.lastUnit = unit;
      created.push(this);
    }
    update(unit: Unit, _equipped: readonly string[]) { this.lastUnit = unit; }
    setRing(ring: string) { this.ring = ring; }
    drawCombat(unit: CombatUnit, _combat: CombatState) { this.lastCombatUnit = unit; }
    resetMeters() { this.resetCount++; }
    destroy() { this.destroyCount++; this.token.destroy(); }
  }
  const created: View[] = [];
  return { Token, View, created };
});
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../src/presentation/unit-view', () => ({ UnitView: display.View }));
import { BoardScene } from '../src/rendering/BoardScene';

type Token = InstanceType<typeof display.Token>;
type View = InstanceType<typeof display.View>;
/** Narrow test bridge to the actual private methods; never an alternative renderer. */
interface SceneBridge {
  session: MatchSession;
  tokens: Map<string, Token>;
  views: Map<string, View>;
  namedObjects: Map<string, Token>;
  renderedCells: Map<string, string>;
  selectedId: string | null;
  input: { setDraggable(token: Token, draggable?: boolean): void };
  tweens: { killTweensOf(token: Token): void; add(config: { targets: Token; x: number; y: number }): void };
  timer: { setText(value: string): void };
  selectionLabel: { setText(value: string): void };
  sellButton: { setText(value: string): void; setAlpha(value: number): void };
  sync(): void;
  reconcileTokens(): void;
  syncCombat(): void;
  syncSelection(): void;
  syncHud(): void;
  renderFeedback(): void;
  renderActiveStats(): void;
  showEvents(): void;
  setStatus(): void;
  clearCombatEffects(): void;
  command(result: MatchCommandResult, message: string): void;
  update(time: number, delta: number): void;
}
const sessions: MatchSession[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); display.created.length = 0; vi.restoreAllMocks(); });

function makeScene(initial: MatchState = createMatch(42)) {
  const scene = new BoardScene() as unknown as SceneBridge;
  scene.session.dispose();
  scene.session = new MatchSession(initial);
  sessions.push(scene.session);
  scene.input = { setDraggable(token, draggable = true) {
    if (!token.input) throw Error(`setDraggable requires an interactive token: ${token.name}`);
    token.input.draggable = draggable;
  } };
  scene.tweens = { killTweensOf: vi.fn(), add: ({ targets, x, y }) => { targets.setPosition(x, y); } };
  scene.timer = { setText: vi.fn() };
  scene.selectionLabel = { setText: vi.fn() };
  scene.sellButton = { setText: vi.fn(), setAlpha: vi.fn() };
  // DOM panels, numeric feedback and cosmetic effects are outside this regression.
  // Selection and every method that creates, reconciles or synchronizes tokens remain real.
  scene.syncHud = () => scene.syncSelection();
  scene.renderFeedback = vi.fn(); scene.renderActiveStats = vi.fn();
  scene.showEvents = vi.fn(); scene.setStatus = vi.fn(); scene.clearCombatEffects = vi.fn();
  scene.sync();
  return scene;
}
function command(scene: SceneBridge, result: MatchCommandResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.reason);
  scene.command(result, 'test command');
}
function finish(scene: SceneBridge) {
  command(scene, scene.session.start());
  expect(scene.session.phase).toBe('combat');
  for (let tick = 0; scene.session.phase === 'combat' && tick < 1201; tick++) scene.update(tick * 50, 50);
  expect(scene.session.phase).not.toBe('combat');
}
function token(scene: SceneBridge, id: string): Token {
  const found = scene.tokens.get(id);
  expect(found, `rendered token ${id}`).toBeDefined();
  return found!;
}
function creations(id: string) { return display.created.filter(view => view.token.getData('unitId') === id); }
function prepareConsumedCombatUnit() {
  const scene = makeScene(createMatch(1));
  finish(scene);
  command(scene, scene.session.continue(1));
  // The real seed-1 shop has Lux in slots 0 and 4. The 1-2 win pays the full 2G.
  for (const slot of [0, 4]) command(scene, scene.session.buy(slot, scene.session.state.shop.generation));
  command(scene, scene.session.deploy('unit-1', { kind: 'bench', slot: 3 }));
  command(scene, scene.session.deploy('unit-3', { kind: 'board', cell: { col: 2, row: 4 } }));
  command(scene, scene.session.deploy('unit-4', { kind: 'board', cell: { col: 3, row: 4 } }));
  return scene;
}
function resolveRewardAndContinue(scene: SceneBridge, beforeContinue?: () => void) {
  const choice = scene.session.state.pendingChoice;
  expect(choice).not.toBeNull();
  command(scene, scene.session.choose(choice!.choiceId, choice!.generation, 'sword'));
  expect(scene.session.phase).toBe('settlement');
  beforeContinue?.();
  command(scene, scene.session.continue(scene.session.state.round));
  expect(scene.session.phase).toBe('preparation');
  expect(scene.session.combat).toBeNull();
}

describe('B8 real BoardScene reward-token lifecycle (display mocks, no browser claim)', () => {
  it('creates the actual seed-42 Maddie before final-frame syncCombat and keeps one selectable, non-draggable bench token', () => {
    const scene = makeScene();
    const initialIds = [...scene.tokens.keys()];
    const calls: string[] = [];
    const reconcile = scene.reconcileTokens.bind(scene), syncCombat = scene.syncCombat.bind(scene);
    vi.spyOn(scene, 'reconcileTokens').mockImplementation(() => { calls.push('reconcile'); reconcile(); });
    vi.spyOn(scene, 'syncCombat').mockImplementation(() => {
      calls.push('syncCombat');
      // Check at method entry, before the real syncCombat reads token.input.
      for (const unit of [...scene.session.preparation.units, ...(scene.session.combat?.units ?? [])]) {
        expect(scene.tokens.has(unit.id), `token must precede combat sync: ${unit.id}`).toBe(true);
      }
      syncCombat();
    });
    command(scene, scene.session.start());
    expect(scene.session.phase).toBe('combat');
    expect(scene.tokens.has('unit-2')).toBe(false);
    for (let tick = 0; scene.session.phase === 'combat' && tick < 1201; tick++) {
      calls.length = 0;
      scene.update(tick * 50, 50);
    }
    expect(scene.session.phase).toBe('settlement');
    expect(calls).toEqual(['reconcile', 'syncCombat']);
    expect(scene.session.state.roundResults[0].result).toBe('playerWin');
    expect(scene.session.state.m8.loot.receipts).toHaveLength(1);
    expect(scene.session.state.m8.loot.receipts[0]).toMatchObject({
      payload: { kind: 'unit', definitionId: 'maddie', quantity: 1 }, grantedUnitIds: ['unit-2'],
    });
    expect(scene.session.preparation.units.find(unit => unit.id === 'unit-2')).toMatchObject({ definitionId: 'maddie', location: { kind: 'bench', slot: 0 } });
    expect(scene.session.combat!.units.some(unit => unit.id === 'unit-2')).toBe(false);
    expect([...scene.tokens.keys()]).toEqual([...initialIds, 'unit-2']);
    const reward = token(scene, 'unit-2'), view = scene.views.get('unit-2')!;
    expect(reward).toMatchObject({ x: 27, y: 480, active: true, visible: true, alpha: 0.35, input: { enabled: true, draggable: false } });
    expect(view.lastUnit.definitionId).toBe('maddie');
    expect(view.lastCombatUnit).toBeUndefined();
    reward.click();
    expect(scene.selectedId).toBe('unit-2');
    expect(view.ring).toBe('selected');
    const finishedState = scene.session.state, created = display.created.length;
    for (let repeat = 0; repeat < 3; repeat++) { scene.sync(); scene.update(repeat * 50, 50); }
    expect(scene.session.state).toBe(finishedState);
    expect(display.created).toHaveLength(created);
    expect(creations('unit-2')).toHaveLength(1);
    expect(token(scene, 'unit-2')).toBe(reward);
    expect(scene.views.get('unit-2')).toBe(view);
    expect(reward.input).toEqual({ enabled: true, draggable: false });
    command(scene, scene.session.continue(1));
    expect(scene.session.phase).toBe('preparation');
    expect(scene.session.combat).toBeNull();
    expect(token(scene, 'unit-2')).toBe(reward);
    expect(reward).toMatchObject({ alpha: 1, visible: true, input: { enabled: true, draggable: true } });
    expect(view.resetCount).toBeGreaterThan(0);
    reward.click(); expect(scene.selectedId).toBe('unit-2');
    for (const id of initialIds.filter(id => id !== 'unit-1')) {
      expect(scene.tokens.has(id)).toBe(false);
      expect(scene.views.has(id)).toBe(false);
      expect(scene.namedObjects.has(`unit:${id}`)).toBe(false);
      expect(scene.renderedCells.has(id)).toBe(false);
    }
  });

  it('retains an actually consumed Combat Lux through reward choice, then destroys every cached reference on Continue', () => {
    const scene = prepareConsumedCombatUnit();
    const consumed = token(scene, 'unit-4'), consumedView = scene.views.get('unit-4')!;
    finish(scene);
    expect(scene.session.phase).toBe('choice');
    expect(scene.session.state.roundResults[1].result).toBe('playerWin');
    expect(scene.session.state.m8.loot.receipts.at(-1)).toMatchObject({ payload: { kind: 'unit', definitionId: 'lux', quantity: 1 }, grantedUnitIds: ['unit-5'] });
    expect(scene.session.state.resourceProvenance.entries.find(entry => entry.kind === 'unit-upgraded')).toMatchObject({
      event: { survivorId: 'unit-3', consumedIds: ['unit-4', 'unit-5'], fromStar: 1, toStar: 2 },
    });
    expect(scene.session.preparation.units.some(unit => unit.id === 'unit-4' || unit.id === 'unit-5')).toBe(false);
    const oldCombatUnit = scene.session.combat!.units.find(unit => unit.id === 'unit-4')!;
    expect(oldCombatUnit).toMatchObject({ definitionId: 'lux', starLevel: 1 });
    expect(token(scene, 'unit-4')).toBe(consumed);
    expect(scene.views.get('unit-4')).toBe(consumedView);
    expect(consumedView.lastCombatUnit).toBe(oldCombatUnit);
    expect(consumedView.lastUnit).toMatchObject({ id: 'unit-4', definitionId: 'lux', starLevel: 1 });
    expect(scene.views.get('unit-3')!.lastUnit.starLevel).toBe(2);
    expect(consumed.input?.draggable).toBe(false);
    expect(consumed.active).toBe(true);
    expect(consumed.visible).toBe(oldCombatUnit.alive);
    expect(scene.namedObjects.get('unit:unit-4')).toBe(consumed);
    expect(scene.renderedCells.has('unit-4')).toBe(true);
    expect(scene.tokens.has('unit-5')).toBe(false);
    expect(creations('unit-5')).toHaveLength(0);
    consumed.click(); expect(scene.selectedId).toBeNull();
    token(scene, 'unit-2').click(); expect(scene.selectedId).toBe('unit-2');
    const created = display.created.length;
    for (let repeat = 0; repeat < 3; repeat++) { scene.sync(); scene.update(repeat * 50, 50); }
    expect(display.created).toHaveLength(created);
    expect(creations('unit-4')).toHaveLength(1);
    expect(consumed.input?.draggable).toBe(false);
    expect(consumedView.destroyCount).toBe(0);
    // Stale presentation-only selection must be purged with the retired view.
    resolveRewardAndContinue(scene, () => { scene.selectedId = 'unit-4'; });
    expect(consumedView.destroyCount).toBe(1);
    expect(consumed.destroyCount).toBe(1);
    expect(consumed.active).toBe(false);
    expect(scene.tokens.has('unit-4')).toBe(false);
    expect(scene.views.has('unit-4')).toBe(false);
    expect(scene.namedObjects.has('unit:unit-4')).toBe(false);
    expect(scene.renderedCells.has('unit-4')).toBe(false);
    expect(scene.selectedId).toBeNull();
    expect(token(scene, 'unit-3').input).toEqual({ enabled: true, draggable: true });
    consumed.click(); expect(scene.selectedId).toBeNull();
    scene.sync();
    expect(consumed.destroyCount).toBe(1);
    expect(creations('unit-4')).toHaveLength(1);
  });

  it('reconstructs the consumed Combat view from an authentic finished session without reviving it in preparation', () => {
    const original = prepareConsumedCombatUnit();
    finish(original);
    const finished = original.session.state;
    const scene = makeScene(finished), consumed = token(scene, 'unit-4');
    expect(scene.session.state).toEqual(finished);
    expect(scene.session.state).not.toBe(finished);
    expect(scene.session.preparation.units.some(unit => unit.id === 'unit-4')).toBe(false);
    expect(scene.views.get('unit-4')!.lastUnit).toMatchObject({ id: 'unit-4', definitionId: 'lux', starLevel: 1 });
    expect(scene.views.get('unit-4')!.lastCombatUnit?.id).toBe('unit-4');
    expect(consumed.input).toEqual({ enabled: false, draggable: false });
    consumed.click(); expect(scene.selectedId).toBeNull();
    const beforeSale = scene.session.state;
    expect(scene.session.sell('unit-4')).toEqual({ ok: false, state: beforeSale, reason: 'wrong-phase' });
    expect(scene.session.state).toBe(beforeSale);
    expect(scene.tokens.has('unit-5')).toBe(false);
    const created = display.created.length;
    scene.sync(); scene.update(0, 50);
    expect(display.created).toHaveLength(created);
    expect(token(scene, 'unit-4')).toBe(consumed);
    resolveRewardAndContinue(scene);
    expect(consumed.destroyCount).toBe(1);
    expect(scene.tokens.has('unit-4')).toBe(false);
    expect(scene.views.has('unit-4')).toBe(false);
    expect(scene.namedObjects.has('unit:unit-4')).toBe(false);
    expect(scene.renderedCells.has('unit-4')).toBe(false);
    expect(scene.session.preparation.units.some(unit => unit.id === 'unit-4')).toBe(false);
  });
});
