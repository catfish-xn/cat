import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
// Only the unrelated DOM widgets are passive; the application loader and push handlers stay real.
const widgets = vi.hoisted(() => {
  class Widget {
    root = { querySelector: () => null, querySelectorAll: () => [] };
    render() {} update() {} show() {} close() {} dispose() {}
    createToggle() { return {}; }
  }
  return { Widget };
});
vi.mock('../src/rendering/online/lobby', () => ({ Lobby: widgets.Widget }));
vi.mock('../src/rendering/online/players-sidebar', () => ({ PlayersSidebar: widgets.Widget }));
vi.mock('../src/rendering/online/opponent-board', () => ({ OpponentBoardPanel: widgets.Widget }));
vi.mock('../src/rendering/online/scout-minimap', () => ({ ScoutMinimap: widgets.Widget }));
vi.mock('../src/rendering/online/carousel-panel', () => ({ CarouselPanel: widgets.Widget, CarouselHoldingSlot: widgets.Widget }));
vi.mock('../src/rendering/online/battle-summary', () => ({ BattleSummaryPanel: widgets.Widget }));
vi.mock('../src/rendering/online/economy-hint', () => ({ EconomyHint: widgets.Widget }));
vi.mock('../src/rendering/online/left-panel-toggle', () => ({ LeftPanelToggle: widgets.Widget }));
vi.mock('../src/rendering/online/sound', () => ({ OnlineSound: widgets.Widget }));
vi.mock('../src/rendering/online/ranking', () => ({ RankingOverlay: widgets.Widget, EliminationCard: widgets.Widget }));
vi.mock('../src/rendering/online/battle-outcome', () => ({ BattleOutcome: widgets.Widget }));
vi.mock('../src/rendering/opening-encounter-hud', () => ({ OpeningEncounterHud: widgets.Widget }));
import type { UnitView } from '../src/presentation/unit-view';
import { OnlineApplication } from '../src/rendering/online/online-application';
import ConfiscationDisplay, { syncCombatEquipment } from '../src/presentation/confiscation-display';
import { enforcerConfiscates } from '../src/simulation/strategy-snapshot';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { combatEquipmentDisplay } from '../src/presentation/battle-equipment';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import { toCombatViewState, type CombatViewState } from '../src/presentation/combat-display';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import type { PlayerView, PublicBoard } from '../src/server/protocol';
import type { ClientListeners, GameClient } from '../src/rendering/online/protocol';
import type { RemoteSession } from '../src/rendering/online/remote-session';
import type { CombatReplay } from '../src/simulation/combat-replay-view';

const applications: OnlineApplication[] = [];
afterEach(() => {
  for (const app of applications.splice(0)) app.dispose();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function mountApplication() {
  const root = { prepend() {} };
  vi.stubGlobal('document', { body: { dataset: {} }, getElementById: (id: string) => id === 'app' ? root : null,
    addEventListener() {}, removeEventListener() {} });
  // Phase/HUD/scouting behavior has its own suites; isolate only those unrelated updates.
  type Peripheral = 'syncMode' | 'syncScout' | 'syncSpectating' | 'syncCarousel' | 'syncBattleViews' | 'syncStatus' | 'syncOpening' | 'viewSound' | 'noteOutcome';
  const prototype = OnlineApplication.prototype as unknown as Record<Peripheral, () => void>;
  for (const method of ['syncMode', 'syncScout', 'syncSpectating', 'syncCarousel', 'syncBattleViews', 'syncStatus', 'syncOpening', 'viewSound', 'noteOutcome'] as const)
    vi.spyOn(prototype, method).mockImplementation(() => {});
  let listeners!: ClientListeners;
  const client = { transport: 'websocket', listen(value: ClientListeners) { listeners = value; return () => {}; }, dispose() {} } as unknown as GameClient;
  const session = { pause() {}, resume() {}, subscribe: () => () => {}, receiveReplay: vi.fn(), dispose() {} } as unknown as RemoteSession;
  const app = new OnlineApplication(session, client, { refresh() {}, clearInput() {}, status() {} });
  applications.push(app);
  return { app, listeners, session };
}

const dependencies: ConstructorParameters<typeof ConfiscationDisplay> = [enforcerConfiscates, UNIT_DEFINITIONS, ITEM_DEFINITIONS, deriveTraits, combatEquipmentDisplay];
const emblem = Object.values(EMBLEM_ITEMS).find(item => item.emblemTrait === 'enforcer')!.id;
const empty = { reserved: 0, temporary: [] };
const enforcers = ['maddie', 'loris', 'caitlyn', 'camille', 'steb', 'twistedfate', 'vi'];
const army = (ten = true): PublicBoard => ({ units: [...enforcers, ...(ten ? ['corki', 'ekko', 'powder'] : [])].map((definitionId, index) => ({
  definitionId, starLevel: 1, cell: { col: index % 7, row: 4 + Math.floor(index / 7) }, items: index >= 7 ? [emblem, 'belt'] : [],
})) });
const victim: PublicBoard = { units: [{ definitionId: 'corki', starLevel: 1, cell: { col: 3, row: 4 }, items: ['deathblade', emblem] },
  { definitionId: 'training-dummy', starLevel: 1, cell: { col: 4, row: 4 }, items: ['deathblade'], summon: true }] };
function fixture(left = victim, right = army()) {
  const start = startMatchCombat(createMatch(42));
  if (!start.ok || !start.state.combat) throw Error('fixture combat');
  const base = toCombatViewState(start.state.combat);
  const units = [left, right].flatMap((board, side) => board.units.map((unit, index) => ({ ...base.units[0],
    id: `${side}:${index}`, definitionId: unit.definitionId, starLevel: 1 as const,
    team: side === 0 ? 'player' as const : 'enemy' as const,
    cell: { col: unit.cell.col, row: side === 0 ? unit.cell.row : base.board.rows - 1 - unit.cell.row },
  })));
  const initial: CombatViewState = { ...base, combatId: 'test-confiscation', units };
  const view = { mySeatId: 'me', opponentSeatId: 'other', phase: { kind: 'combat', round: 5 },
    seats: [{ seatId: 'me', publicBoard: left }, { seatId: 'other', publicBoard: right }] } as unknown as PlayerView;
  const display = new ConfiscationDisplay(...dependencies); display.observe(view); display.capture(initial);
  return { display, initial, view };
}

describe('v26 confiscation presentation', () => {
  it('stamps a victim whose frame has no replacement loadout, retains emblems, and leaves all source data untouched', () => {
    const { display, initial, view } = fixture();
    const before = JSON.stringify({ initial, view });
    expect(display.gear(initial.combatId, '0:0', ['deathblade', emblem], { reserved: 2, temporary: ['belt'] }))
      .toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    expect(display.gear(initial.combatId, '0:0', [emblem], empty).confiscated).toBe(true);
    expect(display.gear(initial.combatId, '0:1', ['deathblade'], empty).confiscated).toBe(false); // non-champion
    expect(display.gear(initial.combatId, '1:0', ['deathblade'], empty).confiscated).toBe(false); // unaffected side
    expect(JSON.stringify({ initial, view })).toBe(before);
  });
  it('does not label lower tiers or missing/legacy public data as confiscation', () => {
    const { display, initial } = fixture(victim, army(false));
    expect(display.gear(initial.combatId, '0:0', ['deathblade'], empty).confiscated).toBe(false);
    const unknown = new ConfiscationDisplay(...dependencies); unknown.capture(initial);
    expect(unknown.gear(initial.combatId, '0:0', ['deathblade'], empty).equipped).toEqual(['deathblade']);
  });
  it('supports mutual confiscation and latches the stamp when gear arrives during combat', () => {
    const { display, initial } = fixture(army(), army());
    for (const side of [0, 1]) {
      expect(display.gear(initial.combatId, `${side}:0`, [], empty).confiscated).toBe(false);
      expect(display.gear(initial.combatId, `${side}:0`, ['belt'], empty).equipped).toEqual([]);
      expect(display.gear(initial.combatId, `${side}:0`, [], empty).confiscated).toBe(true);
      expect(display.gear(initial.combatId, `${side}:7`, [emblem], empty)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    }
  });
  it('freezes combat formations and clears the notice at a new round', () => {
    const { display, initial, view } = fixture();
    display.observe({ ...view, seats: [] });
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
    display.observe({ ...view, phase: { ...view.phase, round: 6, kind: 'preparation' } });
    expect(display.gear(initial.combatId, '0:0', ['deathblade'], empty).confiscated).toBe(false);
  });
  it('identifies a watched opponent from its unique opening formation', () => {
    const { initial, view } = fixture();
    const display = new ConfiscationDisplay(...dependencies);
    display.observe({ ...view, mySeatId: 'spectator', opponentSeatId: null }); display.capture(initial, 'me');
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
  });
  it('keeps the first combat view when settlement arrives before the replay or the first gear read', () => {
    const { initial, view } = fixture();
    const display = new ConfiscationDisplay(...dependencies);
    display.observe(view);
    display.observe({ ...view, seats: [], phase: { ...view.phase, kind: 'settlement' } });
    display.capture(initial);
    expect(display.gear(initial.combatId, '0:0', [emblem], empty)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    display.observe({ ...view, seats: [], phase: { ...view.phase, kind: 'ended' } });
    expect(display.gear(initial.combatId, '0:0', [], empty).confiscated).toBe(true);
    display.observe({ ...view, phase: { ...view.phase, round: 6, kind: 'preparation' } });
    display.capture({ ...initial, combatId: 'next-round' });
    expect(display.gear('next-round', '0:0', ['deathblade'], empty)).toEqual({ equipped: ['deathblade'], extras: empty, confiscated: false });
  });
  it('treats public trait selector failures as unknown and does not retry them every frame', () => {
    const { initial, view } = fixture();
    for (const failAt of [1, 2]) {
      const selector = vi.fn<typeof deriveTraits>((...args) => {
        if (selector.mock.calls.length === failAt) throw new RangeError('invalid public formation');
        return deriveTraits(...args);
      });
      const display = new ConfiscationDisplay(enforcerConfiscates, UNIT_DEFINITIONS, ITEM_DEFINITIONS, selector, combatEquipmentDisplay);
      display.observe(view); display.capture(initial);
      const equipped = ['deathblade', emblem], extras = { reserved: 2, temporary: ['belt'] };
      for (let frame = 0; frame < 3; frame++) {
        const gear = display.gear(initial.combatId, '0:0', equipped, extras);
        expect(gear).toEqual({ equipped, extras, confiscated: false });
        expect(gear.equipped).toBe(equipped); expect(gear.extras).toBe(extras);
      }
      expect(selector).toHaveBeenCalledTimes(failAt);
    }
  });
  it('ignores missing and empty combat ids without reading public traits', () => {
    const { initial, view } = fixture();
    const selector = vi.fn(deriveTraits), display = new ConfiscationDisplay(enforcerConfiscates, UNIT_DEFINITIONS, ITEM_DEFINITIONS, selector, combatEquipmentDisplay);
    display.observe(view);
    for (const combatId of [undefined, '']) {
      display.capture({ ...initial, combatId });
      expect(display.gear(combatId, '0:0', ['deathblade'], empty)).toEqual({ equipped: ['deathblade'], extras: empty, confiscated: false });
    }
    expect(selector).not.toHaveBeenCalled();
  });
  it.each(['board', 'enemyChampions', 'matches', 'candidates'] as const)('caches an empty victim table when %s lookup fails, without retrying each frame', stage => {
    const { initial, view } = fixture();
    const display = new ConfiscationDisplay(...dependencies);
    display.observe(view); display.capture(initial);
    const failure = stage === 'board' ? vi.spyOn(view.seats, 'find')
      : stage === 'enemyChampions' ? vi.spyOn(initial.units, 'filter')
      : stage === 'matches' ? vi.spyOn(view.seats[1].publicBoard!.units, 'filter')
      : vi.spyOn(view.seats, 'filter');
    failure.mockImplementation(() => { throw new TypeError('invalid public formation'); });
    const equipped = ['deathblade', emblem], extras = { reserved: 2, temporary: ['belt'] };
    for (let frame = 0; frame < 3; frame++) {
      const gear = display.gear(initial.combatId, '0:0', equipped, extras);
      expect(gear).toEqual({ equipped, extras, confiscated: false });
      expect(gear.equipped).toBe(equipped); expect(gear.extras).toBe(extras);
    }
    expect(failure).toHaveBeenCalledTimes(1);
    failure.mockRestore();
    display.capture({ ...initial, combatId: 'recovered' });
    expect(display.gear('recovered', '0:0', equipped, extras)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
  });
  it('confiscates unknown item definitions just like the authoritative snapshot, while retaining known emblems', () => {
    const left: PublicBoard = { units: [{ ...victim.units[0], items: ['future-item', emblem] }] };
    const { display, initial } = fixture(left);
    expect(ITEM_DEFINITIONS['future-item']).toBeUndefined();
    expect(display.gear(initial.combatId, '0:0', [emblem], empty)).toEqual({ equipped: [emblem], extras: empty, confiscated: true });
    expect(display.gear(initial.combatId, '0:0', ['future-item', emblem], { reserved: 2, temporary: ['future-temporary', emblem] }))
      .toEqual({ equipped: [emblem], extras: { reserved: 0, temporary: [emblem] }, confiscated: true });
  });
  it('skips pushes before the lazy display loads, then creates and clears the moving-body stamp from later pushes', async () => {
    const { initial, view } = fixture();
    const tag = { visible: true, setVisible: vi.fn(function (this: { visible: boolean }, on: boolean) { this.visible = on; }), setOrigin: vi.fn() };
    tag.setOrigin.mockReturnValue(tag);
    const drawn = { equipped: ['deathblade', emblem], extras: empty, body: { add: vi.fn() }, update: vi.fn(),
      token: { scene: { add: { text: vi.fn(() => tag) } } }, confiscationTag: undefined };
    const views = new Map([['0:0', drawn as unknown as UnitView]]);
    const { app, listeners, session } = mountApplication();
    const replay = { initial } as CombatReplay;
    const settlement = { ...view, seats: [], phase: { ...view.phase, kind: 'settlement' as const } };
    listeners.view?.(view); listeners.view?.(settlement); listeners.replay?.(replay);
    expect(session.receiveReplay).toHaveBeenCalledWith(replay, []);
    expect(app.confiscation?.sync(initial, views) ?? false).toBe(false); // The normal authoritative gear path remains active.
    expect(drawn.update).not.toHaveBeenCalled(); expect(drawn.token.scene.add.text).not.toHaveBeenCalled();
    await vi.dynamicImportSettled();
    const display = app.confiscation;
    expect(display).toBeInstanceOf(ConfiscationDisplay);
    expect(display!.gear(initial.combatId, '0:0', ['deathblade'], empty)).toEqual({ equipped: ['deathblade'], extras: empty, confiscated: false });
    listeners.view?.(view); listeners.view?.(settlement); listeners.replay?.(replay);
    expect(display!.sync(initial, views)).toBe(true);
    expect(drawn.update).toHaveBeenCalledWith(expect.objectContaining({ id: '0:0' }), [emblem], [], empty, 1, initial.units[0].itemStacks);
    expect(drawn.body.add).toHaveBeenCalledWith(tag); expect(tag.visible).toBe(true);
    display!.sync({ ...initial, units: initial.units.map(unit => ({ ...unit, alive: false })) }, views);
    expect(tag.visible).toBe(false); expect(drawn.token.scene.add.text).toHaveBeenCalledTimes(1);
  });

  it('keeps the normal loadout synchronizer free of confiscation inference and leaves legacy opening gear untouched', () => {
    const { initial } = fixture();
    const drawn = { equipped: ['deathblade', emblem], extras: { reserved: 2, temporary: ['belt'] }, update: vi.fn() };
    const views = new Map([['0:0', drawn as unknown as UnitView]]);
    syncCombatEquipment({ ...initial, units: [{ ...initial.units[0], equipment: undefined }] }, views, combatEquipmentDisplay);
    expect(drawn.update).not.toHaveBeenCalled();
    syncCombatEquipment({ ...initial, units: [{ ...initial.units[0], equipment: [] }] }, views, combatEquipmentDisplay);
    expect(drawn.update).toHaveBeenLastCalledWith(expect.objectContaining({ id: '0:0' }), [], [], empty, 1, initial.units[0].itemStacks);
    expect(drawn.equipped).toEqual(['deathblade', emblem]); // No mutation of the supplied opening array.
  });

  it('leaves the optional display unavailable when its chunk fails, so the normal gear path stays active', async () => {
    vi.doMock('../src/presentation/confiscation-display', () => { throw new Error('UI chunk unavailable'); });
    try {
      const { app } = mountApplication();
      await expect(vi.dynamicImportSettled().then(() => app.confiscation)).resolves.toBeUndefined();
    }
    finally { vi.doUnmock('../src/presentation/confiscation-display'); }
  });

});
