import Phaser from 'phaser';
import { getDefinition, getPlayerDeploymentCount } from '../simulation/game';
import { isDeploymentCell } from '../simulation/board';
import { UNIT_DEFINITIONS, type Unit, type UnitLocation } from '../simulation/units';
import { displayUnitName } from './display-names';
import { MATCH_RULES, getUnitSellPrice, getUnitStats, getDeploymentCap, getXpToNextLevel, getShopOdds, readLootView, validateMatchDeployment, type MatchCommandResult, type MatchFailure } from '../simulation/match';
import type { MatchEvent, MatchState } from '../simulation/match-types';
import { COMBAT_TICK_MS } from '../simulation/combat';
import type { LedgerCombatEvent } from '../simulation/combat-types';
import { asDisplayEvents, type DisplayCombat, type SceneCombatEvent } from '../presentation/combat-display';
import { boardFeedActive, boardFeedScreenBox, boardFeedUnitAt, provideBoardControls, publishBoardFrame, publishCombatEvents, type BoardControls, type BoardDropHint, type BoardFrame, type BoardMechanics } from './board-feed';
import { HexLayout, type Point } from './hex-layout';
import { BOARD_LAYOUT } from './layout-config';
import { MatchSession } from './match-session';
import { InputRouter, type Gesture } from './input-router';
import { readRoundInfo } from '../simulation/round-selectors';
import { StrategyPanel } from './strategy-panel';
import { MatchApplication } from '../m6/application';
import { createGameClient, isOnlineMode } from './online/mode';
import { d14UnitNotes, displayStarLevel, fourStarBaseStats, starText } from '../presentation/d14-display';
import { mountOnlineBoardFrame, type OnlineBoardMounts } from './app-shell';
import { OnlineApplication, mergeNotice } from './online/online-application';
import { REPLAY_OPENING_MS, RemoteSession } from './online/remote-session';
import type { SceneApplication } from './online/scene-application';
import { aggregateStats, appendStats, emptyStats, type BattleStats } from '../stats/aggregate';
import { createStatsPanel, type StatsPanel } from '../stats/stats-panel';
import { createCombatFeedbackRenderer, type CombatFeedbackRenderer } from '../stats/combat-feedback-renderer';
import type { SessionChange } from '../m6/contracts';
import { PIECE_RADIUS, UnitView, type RingState } from '../presentation/unit-view';
import { getHeroIdentity } from '../presentation/hero-identity';
import { familyReunionDancers, g23BoardMechanics } from './trait-column';
import { unitHoverCard, type HoverBox } from '../presentation/hover-card';
import { unitBattleStatsKey, unitCardBody } from '../presentation/unit-card';
import { unitBattleStats } from '../presentation/battle-ranking';
import { THEME, toNumber } from '../presentation/theme';
import { CombatFx } from '../presentation/combat-fx';
import { canvasLabelRects } from '../presentation/label-layout';
import { buildPortraitTextures, loadS13Portraits, s13AssetUrl } from '../presentation/s13-assets';
import { HelpPanel } from '../presentation/help-panel';
import { reducedMotion } from '../presentation/preferences';
import { playMerge } from '../presentation/merge-fx';
import { battleLoadout, battleLoadoutText, EQUIPMENT_COMMAND_FAILURES, EQUIPMENT_FAILURE_TEXT, equipSuccessText, equipmentFailureText, gearExtras, gearText, NO_GEAR_EXTRAS, wornDefinitions } from '../presentation/equipment-feedback';
import { isEmptyShopSlot, POOL_REFUSAL_TEXT } from './online/pool-feedback';
import { CONSUMABLE_FAILURE_TEXT } from '../presentation/orb-loot';
import type { ConsumableTarget } from '../simulation/consumable-types';
import { itemDisplayName } from '../presentation/g23-display';
import { readUnitEquipment } from '../simulation/item-selectors';
import type { HexCell } from '../simulation/board';
import type { ItemSummonView } from '../server/protocol';
import { OrbDock, grantedOrbIds, orbVariant, readOrbClaimReceipts, readUnclaimedOrbs } from './online/orb-dock';
import { readOrbLoot } from './online/loot-fields';

/** One marked board cell; `kind` picks the outline colour, unknown kinds use the focus colour. */
export interface SpecialCell { readonly kind: string; readonly cell: HexCell }
/** G2-4b: a summon has no bench slot; the only legal drop is a free cell of my rows. */
/** Gesture owner id for the 3D layer's pointer; Phaser pointer ids are never negative. */
const POINTER_3D = -3;
const SUMMON_BOARD_ONLY = '虚空生物只能在我方棋盘区域移动，不能放入备战席';
/** v15: success line of a per-card augment reroll; stays shown during the choice window. */
const AUGMENT_REROLL_SUCCESS = '这张强化已刷新 · 等级不变，刷掉的强化本局不再出现';
/** v15 claimOrb refusals (MULTIPLAYER_CONTRACT: already-claimed covers a second click on a queued orb). */
const ORB_FAILURE_TEXT: Readonly<Partial<Record<string, string>>> = {
  'already-claimed': '这个法球已领取或已排队', 'unknown-orb': '这个法球已不存在', 'seat-eliminated': '已淘汰，不能领取法球',
};
const SPECIAL_CELL_COLORS: Readonly<Record<string, string>> = { trial: THEME.color.gold };

declare global {
  interface Window { __CAT_DEBUG__?: Readonly<{ read: () => ReturnType<BoardScene['debugSnapshot']> }> }
}

/** Page coordinates of a pointer's release; the window-level mouseup Phaser forwards carries them when it lands off the canvas. */
function releaseClient(pointer: Phaser.Input.Pointer): { x: number; y: number } | null {
  const event = pointer.event as MouseEvent | TouchEvent | undefined;
  if (!event) return null;
  const touch = 'changedTouches' in event ? event.changedTouches[0] : undefined;
  if (touch) return { x: touch.clientX, y: touch.clientY };
  return 'clientX' in event ? { x: event.clientX, y: event.clientY } : null;
}

/** True when a page element other than the board (canvas or 3D layer) is topmost at a client point. */
function coveredBoardPoint(x: number, y: number): boolean {
  const hit = typeof document === 'undefined' ? null : document.elementFromPoint?.(x, y);
  return !!hit && !hit.closest('#board-root, .render3d-layer');
}
export class BoardScene extends Phaser.Scene {
  private session: MatchSession = new MatchSession();
  private application: SceneApplication | null = null;
  private online = isOnlineMode();
  private statsPanel: StatsPanel | null = null;
  private feedback: CombatFeedbackRenderer | null = null;
  private activeStats: BattleStats | null = null;
  /** C17: item icons of the battle on the board, as they stood when it was first shown (null when none is shown). */
  private battleItems: { readonly combatId: string | undefined; readonly items: MatchState['items'] } | null = null;
  private lastStatsRender = -1;
  private lastReplaySeq = -1;
  private replayBattle = '';
  private replayCombat: import('../simulation/combat-types').CombatState | null = null;
  private replayRenderKey = '';
  private inputRouter = new InputRouter();
  /** ?render=3d gestures (boardControls): the unit the 3D pointer is over, and the drag it owns. */
  private hover3d: string | null = null;
  private gesture3d: Gesture | null = null;
  private strategyPanel: StrategyPanel | null = null;
  private help: HelpPanel | null = null;
  /** v15 (online): my unclaimed orbs in the board's right gutter. */
  private orbDock: OrbDock | null = null;
  private get state() { return this.session.preparation; }
  private layout = new HexLayout(this.state.board, BOARD_LAYOUT.hexRadius, BOARD_LAYOUT.origin);
  private views = new Map<string, UnitView>();
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private renderedCells = new Map<string, string>();
  private effects = new Set<Phaser.GameObjects.GameObject>();
  private namedObjects = new Map<string, Phaser.GameObjects.Text | Phaser.GameObjects.Container>();
  private draggingId: string | null = null;
  private stopSellZone: () => void = () => undefined;
  private selectedId: string | null = null;
  /** Enemy hovered in the encounter preview; presentation-only ring highlight. */
  private previewHighlight: ReadonlySet<string> = new Set();
  private mouseClient: Point | null = null;
  private shopButtons: Phaser.GameObjects.Text[] = [];
  private shopFrames: Phaser.GameObjects.Graphics[] = [];
  private startButton!: Phaser.GameObjects.Text;
  private continueButton!: Phaser.GameObjects.Text;
  private rerollButton!: Phaser.GameObjects.Text;
  private xpButton!: Phaser.GameObjects.Text;
  private sellButton!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private roundLabel!: Phaser.GameObjects.Text;
  private goldLabel!: Phaser.GameObjects.Text;
  private hpLabel!: Phaser.GameObjects.Text;
  private levelLabel!: Phaser.GameObjects.Text;
  private xpLabel!: Phaser.GameObjects.Text;
  private oddsLabel!: Phaser.GameObjects.Text;
  private resultLabel!: Phaser.GameObjects.Text;
  private incomeLabel!: Phaser.GameObjects.Text;
  private selectionLabel!: Phaser.GameObjects.Text;
  private startHint!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Graphics;
  /** While a unit is dragged: every board cell and bench slot the rules accept for it, tinted under the pointer outline. */
  private dropZones!: Phaser.GameObjects.Graphics;
  /** G2-3 prep: special-cell layer (trial cells) drawn above the board fill, below units; empty until the rules supply cells. */
  private specialCellLayer!: Phaser.GameObjects.Graphics;
  private specialCells: readonly SpecialCell[] = [];
  private status!: Phaser.GameObjects.Text;
  /** C18: "本场：X / 下场：Y" above a hovered fighting unit whose equipment changed during the battle. */
  private loadoutTip!: Phaser.GameObjects.Text;
  private count!: Phaser.GameObjects.Text;
  private recentCombatEvents: SceneCombatEvent[] = [];
  private fx = new CombatFx({ scene: this, center: cell => this.layout.center(cell), view: id => this.views.get(id), fade: (effect, duration) => this.fadeEffect(effect, duration) });
  private renderedCastCount = 0;
  private renderedUpgradeCount = 0;
  /** Where tokens removed by the last reconcile were drawn: merges fly the consumed copies from there (I6). */
  private readonly departed = new Map<string, Point>();

  constructor() { super('Board'); }
  create() {
    const client = this.online ? createGameClient() : null;
    // Online keeps the TFT layout: countdown above the board, shop dock below it. Offline leaves the shell untouched.
    const mounts: OnlineBoardMounts | null = client ? mountOnlineBoardFrame() : null;
    if (client && !(this.session instanceof RemoteSession)) { this.session.dispose(); this.session = new RemoteSession(client); }
    buildPortraitTextures(this);
    // Phaser reuses the Scene instance on restart but destroys its display list.
    // Keep the authoritative MatchSession; all cached display references must be new.
    this.resetViewReferences();
    const oldHudStart = this.children.length;
    this.add.text(48, 28, 'HEX / 自动战棋', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' });
    this.phaseLabel = this.add.text(48, 67, '', { fontSize: '14px', color: '#9aaeb9' });
    this.roundLabel = this.add.text(455, 32, '', { fontSize: '21px', color: '#edf4f3' }).setName('round');
    this.goldLabel = this.add.text(600, 32, '', { fontSize: '21px', color: '#e6bc76' }).setName('gold');
    this.hpLabel = this.add.text(756, 32, '', { fontSize: '21px', color: '#f08080' }).setName('player-hp');
    this.levelLabel = this.add.text(756, 70, '', { fontSize: '17px', color: '#edf4f3' }).setName('level');
    this.xpLabel = this.add.text(756, 95, '', { fontSize: '14px', color: '#b4a1f5' }).setName('xp');
    this.oddsLabel = this.add.text(48, 89, '', { fontSize: '12px', color: '#9aaeb9' }).setName('shop-odds');
    this.count = this.add.text(756, 119, '', { fontSize: '14px', color: '#68ddd0' }).setName('population');
    this.startButton = this.button('start-combat', 756, 148, 164, 48, '开始战斗', () => this.command(this.session.start(), '战斗开始 · 阵容已锁定'));
    this.continueButton = this.button('continue', 756, 207, 164, 48, '继续', () => {
      this.command(this.session.continue(this.continueButton.getData('round')), '进入下一回合 · 商店已更新，可继续调整阵容');
    });
    this.resultLabel = this.add.text(756, 269, '', { fontSize: '25px', color: '#edf4f3', fontStyle: 'bold' }).setName('result');
    this.incomeLabel = this.add.text(756, 306, '', { fontSize: '13px', color: '#e6bc76', lineSpacing: 4 });
    this.timer = this.add.text(756, 426, '', { fontSize: '13px', color: '#9aaeb9' });
    this.startHint = this.add.text(756, 308, '', { fontSize: '14px', color: '#9aaeb9', wordWrap: { width: 164 }, lineSpacing: 5 });
    this.selectionLabel = this.add.text(756, 462, '', { fontSize: '13px', color: '#edf4f3', wordWrap: { width: 164 }, lineSpacing: 3 });
    this.sellButton = this.button('sell', 756, 526, 164, 40, 'E · 出售', () => {
      if (this.selectedId === null) {
        this.setStatus(this.session.phase === 'preparation' ? '请先点击一个我方单位，再点击出售' : this.failureMessage('wrong-phase'));
        return;
      }
      this.sell(this.selectedId);
    });
    this.rerollButton = this.button('reroll', 756, 577, 164, 40, `D · 刷新 · ${MATCH_RULES.rerollCost} 金币`, () => this.command(this.session.reroll(), '商店已刷新'));
    this.xpButton = this.button('buy-xp', 756, 629, 164, 44, `F · ${MATCH_RULES.xpPurchaseCost} 金币 → ${MATCH_RULES.xpPurchaseAmount} 经验`, () => this.command(this.session.buyXp(), '经验已购买 · 升级增加人口，下一次刷新使用新概率'), 15);
    this.button('debug-new-match', 756, 710, 164, 30, '新局', () => this.newMatch(), 12);
    for (const child of this.children.list.slice(oldHudStart)) (child as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    const graphics = this.add.graphics();
    for (let row = 0; row < this.state.board.rows; row++) for (let col = 0; col < this.state.board.columns; col++) {
      graphics.fillStyle(toNumber(isDeploymentCell(this.state.board, 'player', { col, row }) ? THEME.color.boardAlly : THEME.color.boardEnemy)).lineStyle(1, toNumber(THEME.color.boardLine));
      graphics.fillPoints(this.layout.corners({ col, row }), true).strokePoints(this.layout.corners({ col, row }), true);
    }
    this.specialCellLayer = this.add.graphics();
    this.drawSpecialCells();
    this.add.text(-2000, 140, `${this.state.board.columns} 列 × ${this.state.board.rows} 行`, { fontSize: '14px', color: '#7e95a4' });
    for (const team of ['enemy', 'player'] as const) {
      const zone = this.state.board.deploymentZones[team];
      const y = (this.layout.center({ col: 0, row: zone.firstRow }).y + this.layout.center({ col: 0, row: zone.lastRow }).y) / 2;
      this.add.text(-2000, y, `${team === 'player' ? '我方部署区' : '敌方部署区'}\nrow ${zone.firstRow}–${zone.lastRow}`, { fontSize: '14px', color: team === 'player' ? '#68ddd0' : '#f08080', lineSpacing: 10 });
    }
    this.add.text(-2000, 575, '商店', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(-2000, 600, '买入备战席', { fontSize: '12px', color: '#7e95a4' });
    for (let slot = 0; slot < MATCH_RULES.shopSize; slot++) {
      this.shopFrames.push(this.add.graphics());
      const button = this.button(`buy-${slot}`, 205 + slot * 106, 568, 102, 52, '', () => {
        this.command(this.session.buy(slot, button.getData('generation')), '购买成功 · 集齐三张同星同名单位自动升星');
      }, 14);
      button.setData('slot', slot);
      button.setVisible(false);
      this.shopButtons.push(button);
    }
    this.add.text(-2000, 641, '备战席', { fontSize: '19px', color: '#edf4f3' });
    this.add.text(-2000, 672, '拖拽部署 · 点击选择', { fontSize: '12px', color: '#7e95a4' });
    for (let slot = 0; slot < this.state.benchSize; slot++) {
      const p = this.benchCenter(slot);
      graphics.fillStyle(toNumber(THEME.color.bench)).lineStyle(1, toNumber(THEME.color.boardLine)).fillRoundedRect(p.x - 26, p.y - 30, 52, 60, 10).strokeRoundedRect(p.x - 26, p.y - 30, 52, 60, 10);
    }
    this.overlay = this.add.graphics().setDepth(5);
    this.dropZones = this.add.graphics().setDepth(4);
    this.status = this.add.text(-2000, 754, '准备就绪 · 购买或部署棋子，再点击 开始战斗', { fontSize: '14px', color: '#9aaeb9', wordWrap: { width: 865 } }).setName('status');
    this.loadoutTip = this.add.text(0, 0, '', { fontSize: '12px', color: '#9ff0e4', backgroundColor: '#0b151fe6', padding: { x: 5, y: 3 }, resolution: 2 })
      .setOrigin(0.5, 1).setDepth(30).setVisible(false).setName('loadout-tip');
    this.help = new HelpPanel();
    this.strategyPanel = new StrategyPanel({
      help: () => this.help?.show(),
      // Stored only: the next frame's ring sync applies it. Never force layout during a panel rebuild.
      highlight: ids => { this.previewHighlight = new Set(ids); },
      state: () => this.session.state, combat: () => ({ view: this.session.combatView, runtime: this.session.combatRuntime }), battleItems: () => this.frozenItems(), shopLock: (locked, generation) => this.command(this.session.shopLock(locked, generation), locked ? '商店已锁定，跨轮保留' : '商店已解锁'), selectedUnit: () => this.selectedId,
      selectUnit: id => { this.selectedId = id; this.syncSelection(); },
      combine: (a, b) => this.command(this.session.combine(a, b), '组件已合成', true),
      // C17: the success text is fixed when the command is sent; outside preparation it names the next battle.
      // C18-B (§18.3): online the room forwards it to the rules' shared transaction; offline the session runs useConsumable.
      useConsumable: (id: string, target: ConsumableTarget, success: string) => this.command(this.session.useConsumable(id, target), success),
      equip: (item, unit, slot, combinedName) => this.command(this.session.equip(item, unit, slot), equipSuccessText(this.session.state.phase, combinedName ?? null), true),
      choose: (choice, generation, definition) => this.command(this.session.choose(choice, generation, definition), '永久构筑已选择'),
      target: (choice, generation, unit) => this.command(this.session.anomalyTarget(choice, generation, unit), '异常目标已锁定'),
      rerollAnomaly: (choice, generation) => this.command(this.session.anomalyReroll(choice, generation), '异常选项已刷新 · 扣除 1 金币'),
      rerollAugment: (choice, generation, slot) => this.command(this.session.augmentReroll(choice, generation, slot), AUGMENT_REROLL_SUCCESS),
      buy: (slot, generation) => this.command(this.session.buy(slot, generation), '购买成功'),
      deploy: (id, location) => { const swap = this.swapsWith(id, location); this.command(this.session.deploy(id, location), swap ? '互换成功' : '部署成功'); },
      control: name => this.panelControl(name),
      unitAt: (x, y) => this.boardUnitAt(x, y), cancelGesture: () => this.clearDrag(),
      status: message => this.setStatus(message),
    }, this.inputRouter, mounts?.shopDock ?? null, mounts?.itemDock ?? null);
    this.orbDock = mounts ? new OrbDock(mounts.orbDock, { claim: id => this.claimOrb(id), status: message => this.setStatus(message) }) : null;
    this.input.dragDistanceThreshold = 6;
    this.installDragHandlers();
    this.installKeyboardHandlers();
    const withdrawControls = provideBoardControls(this.boardControls());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { withdrawControls(); this.hover3d = null; this.gesture3d = null; this.loadoutTip3d?.remove(); this.loadoutTip3d = null; });
    this.sync();
    this.statsPanel = createStatsPanel(document.getElementById('stats-root')!, id => {
      if (this.application?.debug().mode === 'replay') { this.application.selectReplayUnit(id); return; }
      this.selectedId = id; this.syncSelection(); this.renderActiveStats();
    });
    this.feedback = createCombatFeedbackRenderer(document.getElementById('feedback-root')!);
    const refresh = () => {
      this.clearCombatEffects(); this.selectedId = null; this.strategyPanel?.reset(); this.recentCombatEvents = []; this.renderedCastCount = 0; this.renderedUpgradeCount = 0;
      // Online stats come from the replay's own events at render time (renderActiveStats); no ledger aggregate.
      this.activeStats = null;
      this.feedback?.reset(); this.sync(); this.renderActiveStats();
    };
    this.application = client ? new OnlineApplication(this.session as RemoteSession, client, {
      refresh, clearInput: () => this.clearCombatEffects(), status: message => this.setStatus(message), changed: change => this.observeStats(change),
      confirmed: commands => this.confirmed(commands.map(command => command.commandId), commands.flatMap(command => command.events)),
      serverEvents: events => this.serverEvents(events),
      refused: (commandId, reason, text) => {
        this.pendingSuccess.delete(commandId);
        const equipment = this.pendingEquipment.delete(commandId);
        const orbId = this.pendingOrbClaims.get(commandId);
        if (orbId !== undefined) { this.pendingOrbClaims.delete(commandId); this.releaseOrb(orbId); }
        this.setStatus(text ?? (equipment ? this.equipmentFailure(reason ?? 'wrong-phase') : this.failureMessage(reason ?? 'wrong-phase')));
      },
      orbClaimRefused: (orbId, reason) => {
        this.releaseOrb(orbId);
        this.setStatus(`法球未能排队 · ${ORB_FAILURE_TEXT[reason] ?? '已放回，可再次点击领取'}`);
      },
    }, mounts) : new MatchApplication(this.session, {
      replace: session => {
        this.clearCombatEffects(); this.session = session; this.selectedId = null;
        this.strategyPanel?.reset(); this.recentCombatEvents = []; this.renderedCastCount = 0; this.renderedUpgradeCount = 0;
        this.activeStats = session.combat ? aggregateStats(this.application?.debug().runId ?? '', session.combat.combatId!, session.combatEvents) : null;
        this.feedback?.reset(); this.sync(); this.renderActiveStats();
      }, changed: change => this.observeStats(change),
      playback: (snapshot, record) => {
        if (!snapshot || !record) { this.lastReplaySeq = -1; this.replayRenderKey = ''; this.replayCombat = null; this.feedback?.reset(); this.renderActiveStats(); return; }
        const key = `${record.runId}/${record.combatId}/${snapshot.tick}/${this.application?.replaySelectedUnit}`;
        if (key === this.replayRenderKey) return; this.replayRenderKey = key;
        document.getElementById('stats-root')!.hidden = false;
        // Same numeric floats as live combat: feed only newly played events; seek/switch resets.
        const battle = `${record.runId}/${record.combatId}`, forward = battle === this.replayBattle && this.lastReplaySeq >= 0
          && snapshot.nextEventSeq >= this.lastReplaySeq && snapshot.nextEventSeq - this.lastReplaySeq <= 400;
        if (forward) { if (snapshot.nextEventSeq > this.lastReplaySeq) this.feedback?.push(snapshot.events.slice(this.lastReplaySeq), performance.now()); }
        else this.feedback?.reset();
        this.replayBattle = battle; this.replayCombat = snapshot.combat;
        this.lastReplaySeq = snapshot.nextEventSeq;
        this.statsPanel?.render({ stats: aggregateStats(record.runId, record.combatId, snapshot.events), combat: snapshot.combat,
          events: snapshot.events, selectedUnitId: this.application?.replaySelectedUnit ?? null });
      }, clearInput: () => this.clearCombatEffects(), status: message => this.setStatus(message),
    });
    // Portraits load once the page is idle so they never delay the first usable controls.
    const loadPortraits = () => { if (this.sys.isActive()) loadS13Portraits(this, () => { buildPortraitTextures(this); for (const view of this.views.values()) view.invalidate(); this.reconcileTokens(); }); };
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(loadPortraits, { timeout: 1500 }); else window.setTimeout(loadPortraits, 300);
    const debug = Object.freeze({ read: () => this.debugSnapshot() });
    window.__CAT_DEBUG__ = debug;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__CAT_DEBUG__ === debug) delete window.__CAT_DEBUG__;
      this.statsPanel?.dispose(); this.statsPanel = null; this.feedback?.dispose(); this.feedback = null;
      this.application?.dispose(); this.application = null;
      this.strategyPanel?.destroy(); this.strategyPanel = null; this.help?.destroy(); this.help = null;
      this.orbDock?.reset(); this.orbDock = null;
      this.resetViewReferences();
    });
  }

  private resetViewReferences() {
    this.views.clear(); this.tokens.clear(); this.renderedCells.clear(); this.effects.clear(); this.namedObjects.clear();
    this.shopButtons.length = 0; this.shopFrames.length = 0;
    this.draggingId = null; this.selectedId = null; this.previewHighlight = new Set(); this.recentCombatEvents = [];
    this.inputRouter.cancel();
  }

  private installKeyboardHandlers() {
    const mousemove = (event: MouseEvent) => {
      const capabilities = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
      if (!capabilities?.firesTouchEvents) this.mouseClient = { x: event.clientX, y: event.clientY };
    };
    const touch = (event: PointerEvent) => { if (event.pointerType === 'touch') this.mouseClient = null; };
    const clearHover = () => { this.mouseClient = null; };
    const mouseout = (event: MouseEvent) => { if (event.relatedTarget === null) clearHover(); };
    window.addEventListener('mousemove', mousemove, true);
    window.addEventListener('pointerdown', touch, true);
    window.addEventListener('mouseout', mouseout, true);
    window.addEventListener('blur', clearHover);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('mousemove', mousemove, true); window.removeEventListener('pointerdown', touch, true);
      window.removeEventListener('mouseout', mouseout, true); window.removeEventListener('blur', clearHover);
      this.mouseClient = null;
    });
    // Native keydown preserves each OS repeat and commits in DOM event order,
    // alongside pointer input, without Phaser's per-frame keyboard queue.
    const keydown = (event: KeyboardEvent) => {
      if (!this.scene.isActive() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      // Reading help never issues a game command.
      if (this.help?.open) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      // Online, an inert shop dock (not playing, or another seat's board shown in 3D) closes the shop and its shortcuts.
      if (document.getElementById('shop-dock')?.inert && ['KeyD', 'KeyF', 'KeyW', 'KeyE'].includes(event.code)) return;
      if (event.code === 'KeyD') {
        event.preventDefault();
        this.command(this.session.reroll(), '商店已刷新');
      } else if (event.code === 'KeyF') {
        event.preventDefault();
        this.command(this.session.buyXp(), '经验已购买 · 升级增加人口，下一次刷新使用新概率');
      } else if (event.code === 'KeyW') {
        event.preventDefault();
        if (!this.draggingId && !event.repeat) this.benchBoardSwap(this.hoveredId() ?? this.selectedId);
      } else if (event.code === 'KeyE') {
        event.preventDefault();
        if (this.strategyPanel?.blocksSell) { this.setStatus('无出售单位目标 · 物品操作不会出售背景单位'); return; }
        const id = this.draggingId ?? this.hoveredId() ?? this.selectedId;
        if (id) this.sell(id);
        else this.setStatus(this.session.phase === 'preparation' ? '请悬停或选择一个我方单位，再按 E' : this.failureMessage('wrong-phase'));
      }
    };
    window.addEventListener('keydown', keydown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', keydown));
  }

  private hoveredId(): string | undefined {
    // D/F can change page layout without another mousemove. Resolve native client
    // coordinates against the current canvas bounds instead of a cached pointer transform.
    // ?render=3d covers the canvas; its layer reports the unit under its own pointer instead.
    if (boardFeedActive()) return this.hover3d && this.tokens.get(this.hover3d)?.visible ? this.hover3d : undefined;
    const client = this.mouseClient;
    if (!client || document.elementFromPoint(client.x, client.y) !== this.game.canvas) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const point = { x: (client.x - rect.left) * this.scale.gameSize.width / rect.width,
      y: (client.y - rect.top) * this.scale.gameSize.height / rect.height };
    const candidates = [...this.tokens.values()].filter(token => token.visible
      && Math.abs(point.x - token.x) <= 29 * token.scaleX && Math.abs(point.y - token.y) <= 29 * token.scaleY);
    return this.input.sortGameObjects(candidates, this.input.activePointer)[0]?.getData('unitId');
  }

  /** Every location of mine, board cells of my rows then bench slots, in reading order. */
  private ownLocations(): UnitLocation[] {
    const cells: UnitLocation[] = [];
    for (let row = 0; row < this.state.board.rows; row++) for (let col = 0; col < this.state.board.columns; col++)
      if (isDeploymentCell(this.state.board, 'player', { col, row })) cells.push({ kind: 'board', cell: { col, row } });
    for (let slot = 0; slot < this.state.benchSize; slot++) cells.push({ kind: 'bench', slot });
    return cells;
  }
  private occupied(target: UnitLocation, except: string): boolean {
    return [...this.state.units.filter(unit => unit.team === 'player'), ...this.shownSummons().map(summon => summon.unit as Unit)].some(unit => unit.id !== except
      && (unit.location.kind === 'board' && target.kind === 'board' ? unit.location.cell.col === target.cell.col && unit.location.cell.row === target.cell.row
        : unit.location.kind === 'bench' && target.kind === 'bench' && unit.location.slot === target.slot));
  }
  /**
   * Drag hint (U4): tint each place the rules' validateMatchDeployment accepts for this unit; when the board is at the
   * population cap a bench unit can only trade places, which the status says. Display only.
   */
  private showDropZones(unit: Unit) {
    this.dropZones.clear();
    const state = this.session.state;
    for (const target of this.ownLocations()) {
      if ((target.kind === 'board' ? unit.location.kind === 'board' && unit.location.cell.col === target.cell.col && unit.location.cell.row === target.cell.row
        : unit.location.kind === 'bench' && unit.location.slot === target.slot) || validateMatchDeployment(state, unit.id, target)) continue;
      this.dropZones.fillStyle(0x68ddd0, 0.16);
      if (target.kind === 'board') this.dropZones.fillPoints(this.layout.corners(target.cell), true);
      else { const p = this.benchCenter(target.slot); this.dropZones.fillRoundedRect(p.x - 26, p.y - 30, 52, 60, 10); }
    }
    if (unit.location.kind === 'bench' && this.session.phase === 'preparation' && getPlayerDeploymentCount(this.state) >= getDeploymentCap(state)) this.setStatus(this.populationCapText());
  }
  /** Population-cap hint with the x/y count, shared by the drag start and every drag frame over a refused cell. */
  private populationCapText(): string {
    return `人口已满 ${getPlayerDeploymentCount(this.state)}/${getDeploymentCap(this.session.state)} · 只能与场上单位互换，或升级提高人口`;
  }
  /**
   * W (TFT): the hovered piece of mine moves board → first open bench slot, or bench → first open cell of my rows,
   * whichever the rules' validateMatchDeployment accepts first; the deploy command itself decides.
   */
  private benchBoardSwap(id: string | null | undefined) {
    const unit = id ? this.state.units.find(entry => entry.id === id && entry.team === 'player') : undefined;
    if (!unit || this.summonOf(unit.id)) { this.setStatus('请悬停一个我方单位，再按 W 上下场'); return; }
    const want = unit.location.kind === 'board' ? 'bench' : 'board', state = this.session.state;
    const open = this.ownLocations().filter(target => target.kind === want && !this.occupied(target, unit.id));
    const target = open.find(candidate => !validateMatchDeployment(state, unit.id, candidate));
    if (target) { this.command(this.session.deploy(unit.id, target), want === 'bench' ? '已下场到备战席' : '已上场'); this.sync(); return; }
    const reason = open.length ? validateMatchDeployment(state, unit.id, open[0]) : undefined;
    this.setStatus(reason ? this.failureMessage(reason) : want === 'bench' ? '备战席已满' : '棋盘上没有空位');
  }
  /** The shop under a page point: the online dock, else the offline shop panel. Display only. */
  private sellZoneAt(point: { x: number; y: number } | null): HTMLElement | null {
    const hit = point ? document.elementFromPoint(point.x, point.y) : null;
    return hit?.closest<HTMLElement>('.shop-dock') ?? hit?.closest<HTMLElement>('.shop-panel') ?? null;
  }
  /**
   * While a unit is dragged, highlight the shop under the pointer with the sale price. Phaser only sees moves over the
   * canvas and the shop sits outside it, so this listens on the window; clearDrag removes it.
   */
  private watchSellZone(unit: Unit) {
    this.stopSellZone();
    const hint = `松手出售 · +${getUnitSellPrice(unit)} 金币`;
    let marked: HTMLElement | null = null;
    const mark = (zone: HTMLElement | null) => {
      if (zone === marked) return;
      if (marked) delete marked.dataset.sellHint;
      marked = zone;
      if (zone) { zone.dataset.sellHint = hint; this.setStatus(hint); this.overlay.clear(); }
    };
    const move = (event: PointerEvent) => mark(this.sellZoneAt({ x: event.clientX, y: event.clientY }));
    window.addEventListener('pointermove', move); document.body.dataset.sellDrag = '';
    this.stopSellZone = () => { window.removeEventListener('pointermove', move); mark(null); delete document.body.dataset.sellDrag; };
  }

  private sell(id: string) {
    if (this.summonOf(id)) { this.setStatus('虚空生物由兹若特传送门召唤 · 不能出售'); return; }
    const result = this.session.sell(id);
    // A hover sale must also clear a different old selection: holding E must
    // never unexpectedly sell that unit once the hovered token disappears.
    if (result.ok) this.selectedId = null;
    this.command(result, '出售成功 · 金币已到账');
  }

  private setStatus(message: string) { this.status.setText(message); this.strategyPanel?.status(message); }
  private newMatch() { this.application?.requestNew(); }
  private panelControl(name: 'reroll' | 'buy-xp' | 'sell' | 'start-combat' | 'continue' | 'new-match') {
    if (name === 'new-match') { this.newMatch(); return; }
    if (name === 'reroll') this.command(this.session.reroll(), '商店已刷新');
    if (name === 'buy-xp') this.command(this.session.buyXp(), '经验已购买');
    if (name === 'start-combat') this.command(this.session.start(), '战斗开始');
    if (name === 'continue') this.command(this.session.continue(this.session.state.round), '进入下一回合');
    if (name === 'sell') {
      if (this.selectedId) this.sell(this.selectedId);
      else this.setStatus('请先在单位面板选择一个我方单位');
    }
  }
  /**
   * Item drop target: any visible piece under the pointer, either team. Ownership is not
   * filtered here, so an enemy drop reaches previewEquip and shows its 'unknown-unit' reason.
   * C17: a battle on the board may name my pieces by battle id (PvP replay, C15); the drop targets the unit it stands for.
   */
  private boardUnitAt(x: number, y: number): string | undefined {
    // A panel floating over the board (3D HUD, an open drawer) takes the point: nothing behind it is hit.
    if (coveredBoardPoint(x, y)) return undefined;
    const session = this.session, ownerOf = session instanceof RemoteSession ? (id: string) => session.equipmentOwnerId(id) : (id: string) => id;
    // ?render=3d covers this canvas: the 3D layer picks the model under the pointer (perspective, not 2D boxes).
    const picked = boardFeedUnitAt({ x, y });
    if (picked !== null) return picked === undefined || !this.tokens.get(picked)?.visible ? undefined : ownerOf(picked);
    const rect = this.game.canvas.getBoundingClientRect();
    const px = (x - rect.left) * this.scale.gameSize.width / rect.width;
    const py = (y - rect.top) * this.scale.gameSize.height / rect.height;
    // P8: in a battle tokens walk into each other's box (melee neighbours, a unit stepping between cells); the token
    // nearest the pointer wins, not the first one in insertion order, so a drop on my unit never lands on the enemy beside it.
    let best: string | undefined, bestDistance = Number.POSITIVE_INFINITY;
    for (const [id, token] of this.tokens) {
      if (!token.visible || Math.abs(px - token.x) > 29 || Math.abs(py - token.y) > 29) continue;
      const distance = (px - token.x) ** 2 + (py - token.y) ** 2;
      if (distance < bestDistance) { best = id; bestDistance = distance; }
    }
    return best === undefined ? undefined : ownerOf(best);
  }

  private button(name: string, x: number, y: number, width: number, height: number, text: string, onClick: () => void, size = 17) {
    const button = this.add.text(x, y, text, { fontSize: `${size}px`, color: '#edf4f3', backgroundColor: '#304653',
      fixedWidth: width, fixedHeight: height, align: 'center', padding: { top: 8 }, lineSpacing: 2 })
      .setName(name).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.namedObjects.set(name, button);
    return button;
  }

  private installDragHandlers() {
    this.input.on('dragstart', (pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      const unit = this.displayedUnit(token.getData('unitId'));
      if (!unit || !this.canDrag(unit) || !this.tokens.has(unit.id)) return;
      const gesture = this.inputRouter.begin('unit', token.getData('unitId'), pointer.id);
      if (!gesture) return;
      token.setData('gesture', gesture);
      this.draggingId = token.getData('unitId'); this.selectedId = this.draggingId;
      // A merge pop still running on this token would fight the lift scale (I6).
      this.tweens.killTweensOf(token); token.setDepth(10).setScale(1.08); this.syncSelection();
      if (!this.summonOf(this.draggingId)) { this.watchSellZone(unit); this.showDropZones(unit); }
    });
    this.input.on('drag', (pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (!this.dragPhase() || this.draggingId !== token.getData('unitId')) return;
      if (!token.getData('gesture') || !this.inputRouter.owns(token.getData('gesture')) || pointer.id !== token.getData('gesture').pointerId) return;
      // Center the token on the pointer: Phaser's threshold-delayed drag offset
      // otherwise incorporates the first mouse move and can shift a whole hex.
      const { x, y } = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      this.dragTo(token, { x, y });
    });
    this.input.on('dragend', (pointer: Phaser.Input.Pointer, token: Phaser.GameObjects.Container) => {
      if (!this.dragPhase() || this.draggingId !== token.getData('unitId')) return;
      const gesture = token.getData('gesture');
      if (!gesture || pointer.id !== gesture.pointerId) return;
      if (pointer.wasCanceled) { this.clearDrag(); return; }
      if (!this.inputRouter.release(gesture)) return;
      // Released over the shop (TFT drag-down sale): the same sell command as E, the rules and the server decide it.
      const unitId: string = token.getData('unitId');
      if (!this.summonOf(unitId) && this.sellZoneAt(releaseClient(pointer))) { this.clearDrag(); this.sell(unitId); this.sync(); return; }
      // Read release coordinates directly, even if no final drag frame rendered.
      this.dropAt(token, pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2);
      this.clearDrag(); this.sync();
    });
  }
  /** Shared by the 2D drag and the 3D layer's: token follows the point, the status line and outline say what a drop does. */
  private dragTo(token: Phaser.GameObjects.Container, point: Point): BoardDropHint {
    const { x, y } = point;
    token.setPosition(x, y); this.overlay.clear();
    const target = this.target({ x, y });
    const summon = this.summonOf(token.getData('unitId'));
    const centre = target && { kind: target.kind, ...this.position(target) };
    if (summon) {
      const reason = this.summonHint(summon, target);
      this.setStatus(reason ?? '可放置 · 释放后虚空生物移到此格，之后每回合保持');
      this.overlay.lineStyle(3, reason ? 0xf08080 : 0x68ddd0);
      if (target?.kind === 'board') this.overlay.strokePoints(this.layout.corners(target.cell), true);
      return { target: centre, allowed: !reason };
    }
    if (!target) { this.setStatus(this.failureMessage('invalid-location')); return { allowed: false }; }
    // Outside preparation (online T10) only the bench is open; the server and the rules decide the move itself.
    const reason = this.session.phase === 'preparation' ? validateMatchDeployment(this.session.state, token.getData('unitId'), target) : target.kind === 'board' ? 'wrong-phase' : undefined;
    this.setStatus(reason ? (reason === 'population-cap' ? this.populationCapText() : this.failureMessage(reason)) : this.swapsWith(token.getData('unitId'), target) ? '可互换 · 释放以交换两个单位的位置' : '可放置 · 释放以确认部署');
    this.overlay.lineStyle(3, reason ? 0xf08080 : 0x68ddd0);
    if (target.kind === 'board') this.overlay.strokePoints(this.layout.corners(target.cell), true);
    else { const p = this.benchCenter(target.slot); this.overlay.strokeRoundedRect(p.x - 26, p.y - 30, 52, 60, 10); }
    return { target: centre, allowed: !reason };
  }
  /** Shared release: the same deploy / summon move commands as the 2D drag; the caller has already released the gesture. */
  private dropAt(token: Phaser.GameObjects.Container, point: Point | null) {
    const target = point ? this.target(point) : undefined;
    // Read the occupant before deploying: a local swap has already moved it by the time the text is chosen.
    const swap = !!target && this.swapsWith(token.getData('unitId'), target);
    const summon = this.summonOf(token.getData('unitId'));
    if (summon) {
      if (target?.kind === 'board') this.command(this.session.moveItemSummon(summon.itemInstanceId, target.cell), '虚空生物已移动 · 之后每回合保持此位置');
      else this.setStatus(SUMMON_BOARD_ONLY);
    } else if (target && this.session.phase !== 'preparation' && target.kind === 'board') this.setStatus(this.failureMessage('wrong-phase'));
    else if (target) this.command(this.session.deploy(token.getData('unitId'), target), swap ? '互换成功 · 两个单位已交换位置' : '放置成功 · 可点击选中单位出售');
    else this.setStatus(this.failureMessage('invalid-location'));
  }
  /**
   * ?render=3d: the 3D layer covers this canvas and replays its pointer here as the same gestures (one gesture owner,
   * same drag rules, same commands). Releasing over the shop sells, like E on the dragged unit.
   */
  private boardControls(): BoardControls {
    const token = (id: string) => this.draggingId === id && this.gesture3d && this.inputRouter.owns(this.gesture3d) ? this.tokens.get(id) : undefined;
    return {
      hover: id => { this.hover3d = id; },
      claimOrb: id => this.orbDock?.click(id),
      select: id => {
        const unit = this.displayedUnit(id);
        if (!unit || unit.team !== 'player' || !this.tokens.has(id) || this.inputRouter.current) return;
        this.selectedId = id; this.syncSelection(); this.strategyPanel?.render();
      },
      dragStart: id => {
        const unit = this.displayedUnit(id);
        if (!this.dragPhase() || !unit || !this.canDrag(unit) || !this.tokens.has(id)) return false;
        const gesture = this.inputRouter.begin('unit', id, POINTER_3D);
        if (!gesture) return false;
        this.gesture3d = gesture; this.draggingId = id; this.selectedId = id;
        this.tokens.get(id)!.setDepth(10).setScale(1.08); this.syncSelection();
        if (!this.summonOf(id)) { this.watchSellZone(unit); this.showDropZones(unit); }
        return true;
      },
      dragMove: point => {
        const dragged = this.draggingId ? token(this.draggingId) : undefined;
        return dragged && this.dragPhase() ? this.dragTo(dragged, point) : { allowed: false };
      },
      dragEnd: (point, client) => {
        const id = this.draggingId, dragged = id ? token(id) : undefined, gesture = this.gesture3d;
        this.gesture3d = null;
        if (!id || !dragged || !gesture || !this.dragPhase() || !this.inputRouter.release(gesture)) { this.clearDrag(); this.sync(); return; }
        if (!this.summonOf(id) && this.sellZoneAt(client)) { this.clearDrag(); this.sell(id); this.sync(); return; }
        // Released over a floating panel rather than the board: cancel, never drop on the cell behind it.
        if (coveredBoardPoint(client.x, client.y)) { this.clearDrag(); this.sync(); return; }
        this.dropAt(dragged, point);
        this.clearDrag(); this.sync();
      },
      dragCancel: () => { if (this.gesture3d) { this.gesture3d = null; this.clearDrag(); this.sync(); } },
    };
  }
  /**
   * Online (T10, contract §15.1): during my battle, the choice window and the settlement the shop, XP and my bench stay
   * operable; board units stay where the battle froze them until the next preparation.
   */
  private benchOps(): boolean {
    const session = this.session;
    return this.online && session instanceof RemoteSession && !session.spectating && session.offline === null
      && (session.phase === 'combat' || session.phase === 'choice' || session.phase === 'settlement');
  }
  private dragPhase(): boolean { return this.session.phase === 'preparation' || this.benchOps(); }
  /**
   * G2-4b: my movable preparation summons (兹若特传送门's 虚空生物) as the rules place them, shown on the board only while I
   * prepare and no battle is on it. They are not assets: no bench, sale, equipment or population.
   */
  private shownSummons() { return this.session.phase === 'preparation' && !this.session.combatView ? this.session.itemSummons : []; }
  private summonOf(id: string | null | undefined) { return id ? this.shownSummons().find(summon => summon.unit.id === id) : undefined; }
  private displayedUnit(id: string): Unit | undefined { return this.state.units.find(unit => unit.id === id) ?? this.summonOf(id)?.unit as Unit | undefined; }
  /** Display-only drag hint for a summon (board cell, my rows, free); the rules' moveItemSummon decides the move itself. */
  private summonHint(summon: ItemSummonView, target: UnitLocation | undefined): string | undefined {
    if (target?.kind !== 'board') return SUMMON_BOARD_ONLY;
    if (!isDeploymentCell(this.state.board, 'player', target.cell)) return this.failureMessage('outside-deployment-zone');
    const taken = [...this.state.units.filter(unit => unit.team === 'player'), ...this.shownSummons().map(other => other.unit as Unit)]
      .some(unit => unit.id !== summon.unit.id && unit.location.kind === 'board' && unit.location.cell.col === target.cell.col && unit.location.cell.row === target.cell.row);
    return taken ? '该位置已有单位 · 虚空生物只能移到空格' : undefined;
  }
  private canDrag(unit: Unit): boolean { return unit.team === 'player' && (this.session.phase === 'preparation' || (this.benchOps() && unit.location.kind === 'bench')); }
  /** Display-only: an allied unit already at the target trades places with the dragged one (SR-C7-01); the rule itself is validateMatchDeployment. */
  private swapsWith(unitId: string, target: UnitLocation): boolean {
    return this.state.units.some(unit => unit.id !== unitId && unit.team === 'player' && (unit.location.kind === 'board' && target.kind === 'board'
      ? unit.location.cell.col === target.cell.col && unit.location.cell.row === target.cell.row
      : unit.location.kind === 'bench' && target.kind === 'bench' && unit.location.slot === target.slot));
  }
  private benchCenter(slot: number): Point { return { x: 27 + slot * 53.25, y: 480 }; }
  /** G2-3 prep: replace the special cells shown on the board; an empty list clears the layer. Display only. */
  setSpecialCells(cells: readonly SpecialCell[]): void {
    this.specialCells = cells.map(entry => ({ kind: entry.kind, cell: { col: entry.cell.col, row: entry.cell.row } }));
    this.drawSpecialCells();
  }
  private drawSpecialCells(): void {
    const layer = this.specialCellLayer;
    if (!layer?.active) return;
    layer.clear();
    for (const { kind, cell } of this.specialCells) {
      if (cell.col < 0 || cell.row < 0 || cell.col >= this.state.board.columns || cell.row >= this.state.board.rows) continue;
      const color = toNumber(SPECIAL_CELL_COLORS[kind] ?? THEME.color.focus), corners = this.layout.corners(cell);
      layer.fillStyle(color, 0.18).lineStyle(2, color, 0.9).fillPoints(corners, true).strokePoints(corners, true);
    }
  }
  private position(location: UnitLocation): Point { return location.kind === 'board' ? this.layout.center(location.cell) : this.benchCenter(location.slot); }
  private target(point: Point): UnitLocation | undefined {
    const cell = this.layout.hitTest(point);
    if (cell) return { kind: 'board', cell };
    for (let slot = 0; slot < this.state.benchSize; slot++) { const p = this.benchCenter(slot); if (Math.abs(point.x - p.x) <= 26 && Math.abs(point.y - p.y) <= 30) return { kind: 'bench', slot }; }
    return undefined;
  }

  /** Online rooms can end while my own MatchState is still mid-round (every other seat eliminated). */
  private onlineEnded(): boolean { return this.online && document.body.dataset.onlineMode === 'online-ended'; }
  /** Settled round: single player waits for Continue; online the server moves on by itself. */
  private settledText(): string { return this.online ? '本轮结果已结算 · 稍后自动进入下一回合' : '本轮结果已结算 · 点击 继续保留阵容并进入下一回合'; }
  /** Game-over status: single player restarts locally; online the server publishes the ranking instead. */
  private endText(): string {
    return this.online ? '对局结束 · 查看排名' : `${this.session.state.outcome === 'victory' ? '胜利 · 最终挑战完成' : '失败 · 对局结束'}，点击 新局 重开`;
  }
  private failureMessage(reason: MatchFailure): string { return this.knownFailure(reason) ?? `操作被拒绝（${reason}）`; }
  private knownFailure(reason: string): string | undefined {
    const messages: Partial<Record<MatchFailure, string>> = {
      'wrong-phase': this.benchOps() ? '战斗与结算期间只能操作商店和备战席 · 棋盘单位请在下个准备阶段调整'
        : this.session.phase === 'preparation' ? (this.online ? '当前不能执行该操作 · 倒计时结束自动开战' : '当前为准备阶段 · 请布阵或开始战斗')
        : this.session.phase === 'choice' ? '请先完成当前强化 / 异常选择'
        : this.session.phase === 'combat' ? '正在战斗 · 请等待本轮结算'
        : this.session.phase === 'settlement' ? (this.online ? '本轮已结算 · 稍后自动进入下一回合' : '本轮已结算 · 点击 继续进入下一回合')
        : this.online ? '对局结束 · 查看排名' : 'Game Over · 点击 新局 开始新的一局',
      'unknown-unit': '未找到该单位', 'enemy-unit': '敌方单位不可操作或出售',
      'invalid-location': '请放置到棋盘或备战席内', 'outside-deployment-zone': '只能部署在我方区域，不能放入敌方区域',
      // Allied occupants swap since SR-C7-01; the code now only means a non-allied or stacked occupant.
      'occupied': '该位置被其他单位占用，无法交换',
      'missing-player': '无法开始：请先将至少 1 个我方单位部署到棋盘',
      'missing-enemy': '无法开始：棋盘上至少需要 1 个敌方单位',
      'missing-both': '无法开始：棋盘上双方都至少需要 1 个单位',
      'invalid-slot': this.session.phase === 'choice' ? '这张强化不能刷新 · 请重新选择' : '商店槽位无效', 'stale-shop': '商店已更新，请选择当前商品', 'purchased-slot': '该商店槽位已经购买',
      'insufficient-gold': '金币不足', 'bench-full': '备战席已满 · 请先部署或出售单位',
      'stale-round': this.online ? '此回合已结束 · 请在当前回合重新操作' : '此回合已结束，请使用当前 Continue', 'unsettled-round': '当前回合尚未结算',
      'max-level': '已达最高等级 · 无需继续购买经验', 'population-cap': '人口已满 · 按 F 升级或先移回一个单位',
      // Equipment-only codes share the preview wording (U3 dynamic; replaces the B5 interim copy).
      ...Object.fromEntries(EQUIPMENT_COMMAND_FAILURES.map(code => [code, EQUIPMENT_FAILURE_TEXT[code]])) as Record<typeof EQUIPMENT_COMMAND_FAILURES[number], string>,
      'stale-choice': '选项已更新，请使用当前卡片', 'invalid-choice': '当前选择无效', 'invalid-target': '请选择一个我方单位',
      'augment-rerolls-exhausted': '这张强化已经刷新过', 'augment-pool-too-small': '同等级已没有可替换的强化',
    };
    // Online shared-pool refusals (pool-empty, empty-slot, ...) arrive through the same path but are not MatchFailures.
    return (messages as Partial<Record<string, string>>)[reason] ?? ORB_FAILURE_TEXT[reason] ?? POOL_REFUSAL_TEXT[reason] ?? (CONSUMABLE_FAILURE_TEXT as Partial<Record<string, string>>)[reason];
  }
  /** Success text of each command still waiting for its server receipt (online WebSocket only). */
  private pendingSuccess = new Map<number, string>();
  /** Pending combine/equip commands: a refusal is named by the equipment wording table, like the previews. */
  private pendingEquipment = new Set<number>();
  /** v15: pending claimOrb commands (socket) by command id, so a refusal releases the orb shown as queued. */
  private pendingOrbClaims = new Map<number, string>();
  /** Command id of the last command() that went pending; read right after by claimOrb. */
  private pendingOrbNotice: number | null = null;
  /** Equipment refusal: the shared preview wording for every equipment code (unknown codes get its generic text). */
  private equipmentFailure(reason: string): string {
    return reason in EQUIPMENT_FAILURE_TEXT ? equipmentFailureText(reason) : this.knownFailure(reason) ?? equipmentFailureText(reason);
  }
  private confirmed(commandIds: readonly number[], events: readonly MatchEvent[]) {
    const success = commandIds.map(id => this.pendingSuccess.get(id)).filter((text): text is string => !!text).at(-1) ?? '操作已确认';
    for (const id of commandIds) { this.pendingSuccess.delete(id); this.pendingEquipment.delete(id); this.pendingOrbClaims.delete(id); }
    if (this.selectedId !== null && !this.state.units.some(unit => unit.id === this.selectedId)) this.selectedId = null;
    this.command({ ok: true, state: this.session.state, events }, success);
  }
  private command(result: MatchCommandResult, success: string, equipment = false) {
    if (!result.ok) {
      // Online over a socket the command is pending (or the connection is down): no local change, no rule failure.
      const notice = this.session instanceof RemoteSession ? this.session.takeNotice() : null;
      if (notice?.kind === 'pending') { this.pendingOrbNotice = notice.commandId; this.pendingSuccess.set(notice.commandId, success); if (equipment) this.pendingEquipment.add(notice.commandId); this.setStatus('待确认…'); return; }
      this.setStatus(notice?.kind === 'offline' ? notice.text : equipment ? this.equipmentFailure(result.reason) : this.failureMessage(result.reason)); return;
    }
    this.clearCombatEffects();
    if (this.session.phase !== 'preparation' && !this.benchOps()) this.selectedId = null;
    if (!this.session.combatView) this.recentCombatEvents = [];
    this.sync();
    this.showEvents(result.events.filter((event): event is LedgerCombatEvent => 'tick' in event));
    this.strategyPanel?.recordOperations(result.events);
    const upgrades = this.showUpgrades(result.events);
    this.setStatus(upgrades.length ? upgrades.map(event => `${UNIT_DEFINITIONS[event.definitionId].name} → ${event.toStar}★`).join(' · ') + ' · 自动升星成功' : success);
    if (this.session.phase === 'gameOver') this.setStatus(this.endText());
    // A confirmed per-card reroll (offline at once, online on its receipt) names itself; anything else points back at the choice.
    else if (this.session.phase === 'choice' && success !== AUGMENT_REROLL_SUCCESS) this.setStatus('完成当前三选一后继续运营');
    // P1: online, an operation confirmed during the settlement (shop, bench, items, tools) keeps its own success text;
    // offline the settlement line still says how to continue.
    else if (this.session.phase === 'settlement' && !this.online) this.setStatus(this.settledText());
  }
  /** v15: a battle of mine is on the board or running; a claim then waits for the rules' post-battle settlement. */
  private orbsInBattle(): boolean {
    return this.session.phase === 'combat' || (this.session instanceof RemoteSession && this.session.inBattle)
      || (this.application instanceof OnlineApplication && this.application.roomInCombat);
  }
  private syncOrbs() {
    if (!this.orbDock) return;
    const spectating = document.body.dataset.onlineSpectating === 'true';
    this.orbDock.render(this.session.state, { inBattle: this.orbsInBattle(), locked: spectating || this.onlineEnded() });
  }
  /** Refused claims per orb (the 3D layer may walk into that orb again only after one); forgotten with the orb. */
  private orbRefusals = new Map<string, number>();
  /** A claim was refused: the dock shows the orb as claimable again and the 3D layer may retry it. */
  private releaseOrb(orbId: string) { this.orbRefusals.set(orbId, (this.orbRefusals.get(orbId) ?? 0) + 1); this.orbDock?.release(orbId); }
  /** v15: the rules grant the orb now or queue it until the battle ends; the dock announces the receipts when they arrive. */
  private claimOrb(orbId: string) {
    this.pendingOrbNotice = null;
    const result = this.session.claimOrb(orbId);
    const queued = result.ok && readUnclaimedOrbs(result.state).some(orb => orb.orbId === orbId && orb.queued);
    this.command(result, queued || this.orbsInBattle() ? '法球已排队 · 战后结算' : '法球已打开');
    // A refusal (now, or later for a pending socket command) puts the orb back to claimable.
    const notice = !result.ok ? this.pendingOrbNotice : null; this.pendingOrbNotice = null;
    if (notice !== null) this.pendingOrbClaims.set(notice, orbId);
    else if (!result.ok) this.releaseOrb(orbId);
  }
  /** I6: each upgrade among `events` plays its merge (copies fly in, then a ring); returns the upgrades. */
  private showUpgrades(events: readonly MatchEvent[]) {
    const upgrades = events.filter(event => event.type === 'unitUpgraded');
    if (!upgrades.length) return upgrades;
    const host = { scene: this, reduced: reducedMotion(), fade: (effect: Phaser.GameObjects.Arc | Phaser.GameObjects.Container, duration: number) => this.fadeEffect(effect, duration) };
    const shop = { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height + PIECE_RADIUS };
    let delay = 0;
    for (const event of upgrades) {
      const token = this.tokens.get(event.survivorId);
      // A cascade can consume an intermediate survivor in the same transaction.
      // Its immutable event still identifies where to show that upgrade.
      const to = token ?? this.departed.get(event.survivorId) ?? this.position(event.location);
      // A copy that was never drawn (the card just bought) comes up from the shop.
      const from = event.consumedIds.map(id => this.departed.get(id) ?? this.tokens.get(id) ?? shop);
      // A cascade's second merge waits for the first ring.
      delay = playMerge(host, { definitionId: event.definitionId, toStar: event.toStar, from, to: { x: to.x, y: to.y }, survivor: token }, delay);
      this.renderedUpgradeCount++;
    }
    return upgrades;
  }
  /** Online (T10): the server's own deadline deployment and post-battle merges arrive with its state push. */
  private serverEvents(events: readonly MatchEvent[]) {
    const deployed = events.filter(event => event.type === 'unitDeployed').length;
    const merged = this.showUpgrades(events).length ? mergeNotice(events) : null;
    if (merged) this.setStatus(merged);
    else if (deployed) this.setStatus(`准备时间结束 · 已自动上场 ${deployed} 个单位`);
  }

  private reconcileTokens() {
    const view = this.session.combatView, fighting = new Set(view?.units.map(unit => unit.id));
    // While a battle is shown it stands in for the board. A two-sided (PvP) replay names my units by their
    // battle ids (contract §10.2; only my own unit mapping reaches the client, C15), so a board unit it does not name is shown
    // by its combat unit only, never as a second token at its preparation cell (C10).
    // Another seat's battle on the board (online, visiting its board): none of my units, its ids are not mine.
    const watching = this.session instanceof RemoteSession && this.session.watchedSeat !== null;
    const units = watching ? [] : this.state.units.filter(unit => !view || unit.location.kind !== 'board' || fighting.has(unit.id));
    for (const summon of this.shownSummons()) units.push(summon.unit as Unit);
    const ids = new Set(units.map(unit => unit.id));
    this.departed.clear();
    // Rewards can consume an old unit while its finished combat is still displayed.
    // Keep that combat view until Continue clears it, including restored settlements.
    for (const unit of view?.units ?? []) if (!ids.has(unit.id)) {
      units.push({ id: unit.id, definitionId: unit.definitionId, team: unit.team,
        starLevel: unit.starLevel, location: { kind: 'board', cell: unit.cell }, ...(unit.effectiveStarLevel === 4 ? { effectiveStarLevel: 4 } : {}) } as Unit);
      ids.add(unit.id);
    }
    for (const [id, token] of this.tokens) {
      if (ids.has(id)) continue;
      this.departed.set(id, { x: token.x, y: token.y });
      this.views.get(id)?.destroy(); if (token.active) token.destroy();
      this.tokens.delete(id); this.views.delete(id); this.renderedCells.delete(id);
      this.namedObjects.delete(`unit:${id}`);
      if (this.selectedId === id) this.selectedId = null;
    }
    const items = this.session.state.items, frozen = this.frozenItems();
    for (const unit of units) {
      if (!this.tokens.has(unit.id)) this.createToken(unit);
      const owner = this.equipmentOwner(unit.id);
      // C18: a fighting unit keeps its battle icons; what it wears now beyond them is tagged for the next battle.
      const loadout = fighting.has(unit.id) ? battleLoadout(items, frozen, owner) : null;
      const equipped = loadout ? loadout.thisBattle : wornDefinitions(items, owner);
      this.views.get(unit.id)!.update(unit, equipped, loadout?.pending ?? [], unit.team === 'player' ? gearExtras(readUnitEquipment(this.session.state, owner)) : NO_GEAR_EXTRAS, displayStarLevel(this.session.state, unit));
    }
  }
  /**
   * C17 (contract §17.2): a battle on the board shows the equipment it was fought with. Items equipped or combined
   * while it is shown are for the next battle, so the item list is frozen when a battle first appears (null when none).
   */
  private frozenItems(): MatchState['items'] | null {
    const view = this.session.combatView;
    if (!view) this.battleItems = null;
    else if (!this.battleItems || this.battleItems.combatId !== view.combatId) this.battleItems = { combatId: view.combatId, items: this.session.state.items };
    return this.battleItems?.items ?? null;
  }
  /** C15: a PvP replay names my units by battle id; the server's own-unit mapping says whose items each one carries. */
  private equipmentOwner(id: string): string {
    const session = this.session;
    return session instanceof RemoteSession ? session.equipmentOwnerId(id) : id;
  }
  private createToken(unit: Unit) {
    const p = this.position(unit.location);
    const view = new UnitView(this, unit, p.x, p.y), token = view.token;
    this.views.set(unit.id, view); this.tokens.set(unit.id, token); this.namedObjects.set(token.name, token);
    if (unit.team === 'player') {
      token.setInteractive({ useHandCursor: true }); this.input.setDraggable(token);
      token.on('pointerdown', () => {
        if (!this.tokens.has(unit.id)) return;
        if (this.inputRouter.current) return;
        this.selectedId = unit.id; this.syncSelection(); this.strategyPanel?.render();
      });
    }
  }

  private sync() {
    this.reconcileTokens(); this.syncHud();
    this.strategyPanel?.render();
    this.syncOrbs();
    if (this.session.phase !== 'preparation') {
      for (const token of this.tokens.values()) if (token.input) { this.input.setDraggable(token, false); token.disableInteractive(); }
      if (this.benchOps()) this.syncOperable();
      this.syncCombat(); return;
    }
    for (const unit of [...this.state.units, ...this.shownSummons().map(summon => summon.unit as Unit)]) {
      const p = this.position(unit.location), token = this.tokens.get(unit.id)!;
      token.setPosition(p.x, p.y).setVisible(true).setAlpha(1).setScale(1).setDepth(0);
      this.views.get(unit.id)!.resetMeters();
      if (token.input) { token.input.enabled = true; this.input.setDraggable(token, true); }
    }
  }
  /**
   * Online outside preparation: bench tokens sit on their slots, selectable and draggable (bench only). Without a battle
   * on the board (choice, settlement) the whole lineup is laid out as the latest state has it, so post-battle merges show.
   */
  private syncOperable() {
    const laidOut = !this.session.combatView;
    for (const unit of this.state.units) {
      const token = this.tokens.get(unit.id);
      if (!token || unit.team !== 'player' || (!laidOut && unit.location.kind !== 'bench')) continue;
      if (this.draggingId !== unit.id) { const p = this.position(unit.location); token.setPosition(p.x, p.y); }
      token.setVisible(true).setAlpha(1).setScale(1).setDepth(0);
      if (laidOut) { this.views.get(unit.id)?.resetMeters(); this.renderedCells.delete(unit.id); }
      if (token.input) { token.input.enabled = true; this.input.setDraggable(token, unit.location.kind === 'bench'); }
    }
  }
  private syncHud() {
    const match = this.session.state, ready = match.phase === 'preparation', operable = ready || this.benchOps();
    const round = readRoundInfo(match);
    this.roundLabel.setText(round.displayName); this.goldLabel.setText(`金币 ${match.gold}`);
    this.hpLabel.setText(`生命 ${match.playerHp}`);
    this.levelLabel.setText(`等级 ${match.level}`);
    const threshold = getXpToNextLevel(match.level);
    this.xpLabel.setText(threshold === null ? '经验 已满' : `经验 ${match.xp} / ${threshold}`);
    this.oddsLabel.setText(`${match.level} 级搜牌概率 · ${getShopOdds(match.level).map((chance, index) => `${index + 1}费 ${chance}%`).join(' / ')}`);
    this.count.setText(`我方人口 ${getPlayerDeploymentCount(this.state)} / ${getDeploymentCap(match)}`);
    this.startButton.setText(round.kind === 'supply' ? '领取补给' : '开始战斗');
    this.startButton.setAlpha(this.session.startFailure ? 0.4 : 1).setBackgroundColor('#38695f');
    // Same authoritative verdict as the panel button: interactive only when LootView allows Continue.
    const canContinue = readLootView(match).canContinue;
    this.continueButton.setData('round', match.round).setAlpha(canContinue ? 1 : 0.4);
    if (canContinue) this.continueButton.setInteractive({ useHandCursor: true }); else this.continueButton.disableInteractive();
    this.rerollButton.setAlpha(operable ? 1 : 0.4);
    this.xpButton.setText(threshold === null ? 'F · 已满级' : `F · ${MATCH_RULES.xpPurchaseCost} 金币 → ${MATCH_RULES.xpPurchaseAmount} 经验`).setAlpha(operable && threshold !== null ? 1 : 0.4);
    for (let slot = 0; slot < this.shopButtons.length; slot++) {
      const offer = match.shop.slots[slot], button = this.shopButtons[slot];
      const frame = this.shopFrames[slot].clear().setVisible(false);
      button.setData('generation', match.shop.generation);
      if (offer.status === 'purchased') button.setText(isEmptyShopSlot(offer) ? '缺货' : '已购买').setBackgroundColor('#1c2934').setAlpha(0.45);
      else {
        const definition = UNIT_DEFINITIONS[offer.definitionId];
        const colors = ['#304653', '#245841', '#28517d', '#634786', '#846230'];
        const borders = [0x7b94a3, 0x68c087, 0x72b6ff, 0xba8bff, 0xffd675];
        button.setText(`${definition.symbol} ${displayUnitName(offer.definitionId)}\n购买 · ${definition.cost} 金币`).setBackgroundColor(colors[definition.cost - 1]).setAlpha(operable ? 1 : 0.4);
        frame.lineStyle(2, borders[definition.cost - 1], operable ? 1 : 0.4).strokeRect(204 + slot * 106, 567, 104, 54);
      }
    }
    const failure = this.session.startFailure;
    this.startHint.setText(ready ? (failure ? this.failureMessage(failure) : getPlayerDeploymentCount(this.state) === 0 ? '空阵容出战：立即战败\n仍获收入与经验，但会扣 HP' : '阵容就绪，可以开始\n蓝条满后自动施法\n白色盾环吸收伤害') : '');
    this.phaseLabel.setText(this.onlineEnded() ? this.endText() : ready ? '准备阶段 · 购买 / 出售 / 布阵，再开始战斗。'
      : match.phase === 'choice' ? '构筑选择 · 完成组件 / 强化 / 异常 后继续'
      : match.phase === 'combat' ? (this.online ? '自动战斗 · 可购买 / 刷新 / 买经验，备战席可整理；装备以单位提示为准' : '自动战斗 · 积累法力 并施法，商店与部署已锁定')
      : match.phase === 'gameOver' ? this.endText() : '回合结算 · 收入与经验 已到账，继续进入下一回合');
    const result = match.roundResults.at(-1);
    if ((match.phase === 'settlement' || match.phase === 'gameOver') && result) {
      const labels = { playerWin: '胜利', enemyWin: '失败', draw: '平局', supply: '补给' };
      this.resultLabel.setText(match.phase === 'gameOver' ? (match.outcome === 'victory' ? '胜利' : '失败') : labels[result.result]);
      const reason = result.result === 'supply' ? '补给 · 无战斗' : result.result === 'playerWin' ? '胜利 · 不扣 HP' : result.result === 'draw' ? `平局 · 基础伤害 ${result.baseDamage}` : `败局 · 基础 ${result.baseDamage} + 存活 ${result.survivingEnemyCount}`;
      this.incomeLabel.setText(`第 ${result.round} 回合 · ${labels[result.result]}\n收入 +${result.income} 金币 / 经验 +${result.xpAwarded}\n等级 ${result.levelBefore} → ${result.levelAfter}\n生命 ${result.hpBefore} → ${result.hpAfter} (-${result.hpLost})\n${reason}`);
    } else { this.resultLabel.setText(''); this.incomeLabel.setText(''); }
    if (!this.session.combatView) this.timer.setText('');
    this.syncSelection();
  }
  private syncSelection() {
    const selected = this.state.units.find(unit => unit.id === this.selectedId);
    if (!selected) this.selectedId = null;
    const displayId = this.draggingId ?? this.hoveredId() ?? this.selectedId;
    const displayed = this.session.phase === 'preparation' || this.benchOps() ? this.state.units.find(unit => unit.id === displayId) : undefined;
    if (displayed) {
      const definition = getDefinition(displayed), star = displayStarLevel(this.session.state, displayed);
      // v16 Ultimate Hero: the rules' certified 4★ base (physically 3★, so the sell price stays the rules' 3★ price).
      const stats = (star === 4 ? fourStarBaseStats(displayed.definitionId) : null) ?? getUnitStats(displayed.definitionId, displayed.starLevel);
      this.selectionLabel.setText(`${displayUnitName(displayed.definitionId)} ${starText(star)} · ${getHeroIdentity(displayed.definitionId).neutral ? '野怪' : `${definition.cost}费`}${star === 4 ? ' · 终极英雄' : ''}\n生命 ${stats.health} / 攻击力 ${stats.attack}\n${displayed.team === 'enemy' ? '敌方 · 不可出售' : `E 售出 +${getUnitSellPrice(displayed)} 金币${star === 4 ? '（按物理 3 星）' : ''}`}`);
    } else this.selectionLabel.setText('悬停按 E / 点击选择\n集齐三张同星棋子升星');
    this.sellButton.setText(this.selectedId && selected ? `E · 出售 · +${getUnitSellPrice(selected)} 金币` : 'E · 出售');
    this.sellButton.setAlpha(this.selectedId ? 1 : 0.4);
    for (const unit of this.state.units) this.views.get(unit.id)?.setRing(unit.id === this.selectedId ? 'selected' : this.previewHighlight.has(unit.id) ? 'target' : 'normal', unit.team);
  }
  /** Offline ledger aggregate per session change; floats are fed by showEvents for both paths. */
  private observeStats(change: SessionChange) {
    if (this.session instanceof RemoteSession) { if (!this.session.combatView) this.feedback?.reset(); return; }
    const combat = change.after.combat;
    if (!combat) { this.activeStats = null; this.feedback?.reset(); return; }
    if (!this.activeStats || this.activeStats.combatId !== combat.combatId) {
      this.activeStats = emptyStats(this.application?.debug().runId ?? '', combat.combatId!); this.feedback?.reset();
    }
    this.activeStats = appendStats(this.activeStats, change.events);
    if (combat.status === 'finished') this.renderActiveStats();
  }
  private renderActiveStats() {
    const root = document.getElementById('stats-root')!, view = this.session.combatView, runtime = this.session.combatRuntime;
    if (this.session instanceof RemoteSession) {
      // Online (C6): the replay's view and its own events; the panel hides what the whitelist does not carry.
      root.hidden = !view;
      if (view) this.statsPanel?.render({ stats: null, runId: 'online', combat: view, events: this.session.displayLog, selectedUnitId: this.selectedId });
    } else {
      root.hidden = !this.activeStats || !runtime;
      if (this.activeStats && runtime) this.statsPanel?.render({ stats: this.activeStats, combat: runtime, events: this.session.combatEvents, selectedUnitId: this.selectedId });
    }
    this.lastStatsRender = performance.now();
  }
  /** Replay floats anchor to the replay canvas, which shares the board's 480×520 geometry. */
  private renderReplayFeedback() {
    const combat = this.replayCombat, overlay = document.querySelector<HTMLCanvasElement>('#board-root .replay-canvas');
    if (!combat || !overlay) return;
    const canvas = overlay.getBoundingClientRect(), host = document.getElementById('feedback-root')!.getBoundingClientRect();
    const scale = canvas.width / BOARD_LAYOUT.width;
    this.feedback?.render(performance.now(), new Map(combat.units.filter(unit => unit.alive).map(unit => {
      const p = this.layout.center(unit.cell);
      return [unit.id, { x: canvas.left - host.left + p.x * scale, y: canvas.top - host.top + p.y * scale, radius: BOARD_LAYOUT.tokenRadius * scale }];
    })), (canvasLabelRects.get(overlay) ?? []).map(rect => ({ x: canvas.left - host.left + rect.x * scale, y: canvas.top - host.top + rect.y * scale, w: rect.w * scale, h: rect.h * scale })));
  }
  private renderFeedback() {
    const canvas = this.game.canvas.getBoundingClientRect(), host = document.getElementById('feedback-root')!.getBoundingClientRect();
    const scale = canvas.width / this.scale.gameSize.width;
    if (boardFeedActive()) {
      // ?render=3d: anchor floats to each model as the 3D layer projects it; the 2D canvas and its fx labels are covered.
      const anchors = new Map<string, { x: number; y: number; radius: number }>();
      for (const [id, token] of this.tokens) {
        const box = token.visible ? boardFeedScreenBox(id) : undefined;
        if (!box) continue;
        // Radius is the model's half width (overlap test); y sits one radius below its top, so floats rise from the head.
        const radius = (box.right - box.left) / 2;
        anchors.set(id, { x: box.left + radius - host.left, y: box.top + radius - host.top, radius });
      }
      this.feedback?.render(performance.now(), anchors);
      return;
    }
    this.feedback?.render(performance.now(), new Map([...this.tokens].filter(([, token]) => token.visible).map(([id,token]) => [id,
      { x: canvas.left - host.left + token.x * scale, y: canvas.top - host.top + token.y * scale, radius: 27 * scale }])),
      this.fx.labelRects().map(rect => ({ x: canvas.left - host.left + rect.x * scale, y: canvas.top - host.top + rect.y * scale, w: rect.w * scale, h: rect.h * scale })));
  }
  update(_time: number, delta: number) {
    // Cheap motion (idle bob, lunge, hit flash) offsets each piece's drawing only; tokens keep their positions.
    const now = performance.now();
    for (const view of this.views.values()) view.animate?.(now);
    // With a 3D layer drawing the board, the 2D one is covered or hidden: Phaser keeps updating it (tweens feed the
    // frame) but no longer draws it, which was about a fifth of the main thread during a 3D match (2026-10-21).
    const feeding = boardFeedActive();
    // No camera (a scene that never booted its camera manager) leaves nothing to stop.
    const camera = this.cameras?.main;
    if (camera && camera.visible === feeding) camera.setVisible(!feeding);
    if (feeding) publishBoardFrame(() => this.boardFrame());
    if (this.application && !this.application.frame(delta)) { if (document.body.dataset.m6Mode === 'replay') this.renderReplayFeedback(); return; }
    this.renderFeedback(); this.syncLoadoutTip(); this.syncUnitCard();
    if (performance.now() - this.lastStatsRender > 250) this.renderActiveStats();
    if (this.session.phase !== 'combat') { this.syncSelection(); return; }
    if (this.session instanceof RemoteSession && this.session.takeOpening()) this.showOpening();
    const events = this.session.advanceDisplay(delta);
    // A settlement can grant new units before the frame renders its final combat.
    if (this.session.phase !== 'combat') this.reconcileTokens();
    this.syncCombat(); this.showEvents(events); this.strategyPanel?.updateCombat();
    // Rewards may leave combat directly for a component choice (for example 2-7).
    // Render every phase exit, including choices, before waiting for more input.
    if (this.session.state.phase !== 'combat') {
      this.syncHud(); this.strategyPanel?.render(); this.setStatus(this.session.state.phase === 'choice' ? '战斗已结算 · 请选择本轮组件奖励' : this.session.state.phase === 'gameOver' ? this.endText() : this.settledText());
    }
  }
  /**
   * G2: hovering a unit on the board or bench opens its description card (cost, traits, ability, base stats) beside the
   * token; never while dragging. The card is shared with the DOM anchors and closed here only when this scene opened it.
   */
  private syncUnitCard() {
    const id = this.draggingId ? undefined : this.hoveredId();
    const token = id ? this.tokens.get(id) : undefined;
    const unit = id ? this.state.units.find(candidate => candidate.id === id) ?? this.session.combatView?.units.find(candidate => candidate.id === id) : undefined;
    if (!token || !unit || !UNIT_DEFINITIONS[unit.definitionId]) {
      if (this.unitCardOpen) { this.unitCardOpen = false; unitHoverCard().hide(); }
      return;
    }
    const box = this.tokenScreenBox(id!, token);
    if (!box) { if (this.unitCardOpen) { this.unitCardOpen = false; unitHoverCard().hide(); } return; }
    // G5 (online): the ranking's numbers of this unit; a battle still being played back is left out until it ends.
    const remote = this.session instanceof RemoteSession ? this.session : null, history = remote?.battleHistory ?? [];
    const battle = history.length ? unitBattleStats(history, unit, history.length - (remote!.playingBack ? 1 : 0)) : null;
    const view = this.views.get(id!), gear = view ? gearText(view.equipped, view.extras, itemDisplayName) : '';
    // v16: a promoted Ultimate Hero shows 4★ and the rules' D14 lines of my own unit (none in a battle replay).
    const star = displayStarLevel(this.session.state, unit), notes = unit.team === 'player' ? d14UnitNotes(this.session.state, unit.id) : [];
    unitHoverCard().showAt(box, `unit:${unit.definitionId}:${star}:${unitBattleStatsKey(battle)}:${gear}:${notes.join('|')}`,
      () => unitCardBody(unit.definitionId, star, battle, gear, notes)!);
    this.unitCardOpen = true;
  }
  private unitCardOpen = false;
  /**
   * Where the hovered piece is on screen (CSS pixels): the 2D token's box, or under ?render=3d the box the 3D layer
   * projects for its model (undefined when that piece is not drawn), since the 3D canvas covers this one.
   */
  private tokenScreenBox(id: string, token: Phaser.GameObjects.Container): HoverBox | undefined {
    const projected = boardFeedScreenBox(id);
    if (projected !== null) return projected;
    const canvas = this.game.canvas.getBoundingClientRect(), scale = canvas.width / this.scale.gameSize.width, half = 29 * scale;
    const x = canvas.left + token.x * scale, y = canvas.top + token.y * scale;
    return { left: x - half, top: y - half, right: x + half, bottom: y + half };
  }
  /** ?render=3d only: the loadout tip as a DOM label above the projected model; the Phaser tip sits under the 3D layer. */
  private loadoutTip3d: HTMLElement | null = null;
  private placeLoadoutTip3d(text: string | null, box: HoverBox | undefined) {
    if (!text || !box) { if (this.loadoutTip3d) this.loadoutTip3d.hidden = true; return; }
    const tip = this.loadoutTip3d ??= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'loadout-tip-3d' });
    if (tip.textContent !== text) tip.textContent = text;
    tip.hidden = false;
    const width = tip.offsetWidth, height = tip.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, (box.left + box.right) / 2 - width / 2));
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, box.top - height - 6));
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  }
  /** C18: hovering a fighting unit names the battle's loadout and the next one, when an equip changed it mid-battle. */
  private syncLoadoutTip() {
    const view = this.session.combatView, id = view ? this.hoveredId() : undefined;
    const token = id && view?.units.some(unit => unit.id === id) ? this.tokens.get(id) : undefined;
    const loadout = token ? battleLoadout(this.session.state.items, this.frozenItems(), this.equipmentOwner(id!)) : null;
    if (!token || !loadout?.changed) { if (this.loadoutTip?.visible) this.loadoutTip.setVisible(false); this.placeLoadoutTip3d(null, undefined); return; }
    const text = battleLoadoutText(loadout, definitionId => itemDisplayName(definitionId));
    this.loadoutTip?.setText(text).setPosition(token.x, token.y - 50).setVisible(true);
    this.placeLoadoutTip3d(boardFeedActive() ? text : null, boardFeedActive() ? this.tokenScreenBox(id!, token) : undefined);
  }
  private clearDrag() {
    this.stopSellZone(); this.stopSellZone = () => undefined;
    this.inputRouter.cancel(); this.strategyPanel?.cancel();
    const dragged = this.draggingId ? this.displayedUnit(this.draggingId) : undefined;
    if (dragged) {
      const point = this.position(dragged.location);
      this.tokens.get(dragged.id)?.setPosition(point.x, point.y);
    }
    this.draggingId = null; this.gesture3d = null;
    for (const pointer of this.input.manager.pointers) this.input.setDragState(pointer, 0);
    for (const token of this.tokens.values()) token.setScale(1).setDepth(0);
    this.overlay.clear(); this.dropZones.clear();
  }
  private clearCombatEffects() {
    this.tweens.killAll();
    for (const effect of this.effects) effect.destroy();
    this.effects.clear(); this.renderedCells.clear(); this.clearDrag();
  }
  /** The "开战" transition (C6 item 4): shown while an online replay holds its initial view. */
  private showOpening() {
    const center = this.layout.center({ col: Math.floor(this.state.board.columns / 2), row: Math.floor(this.state.board.rows / 2) });
    const banner = this.add.text(center.x, center.y, '开战', { fontSize: '44px', fontStyle: 'bold', color: '#ffe39b', backgroundColor: '#0b151fcc', padding: { x: 18, y: 6 }, resolution: 2 })
      .setOrigin(0.5).setDepth(30).setName('combat-opening');
    // An effect like any other: clearCombatEffects() removes it if the battle is cut short.
    this.effects.add(banner);
    this.tweens.add({ targets: banner, alpha: 0, delay: REPLAY_OPENING_MS * 0.6, duration: REPLAY_OPENING_MS * 0.6,
      onComplete: () => { this.effects.delete(banner); banner.destroy(); } });
  }
  /**
   * One drawing path for both modes. Online it draws the replay's CombatViewState; offline the engine units behind
   * the same view (identical display fields, and the status strip needs the engine state).
   */
  private syncCombat() {
    const view = this.session.combatView, runtime = this.session.combatRuntime;
    if (!view) return;
    const combat: DisplayCombat & { readonly tick: number; readonly maxTicks: number } = runtime ?? view;
    for (const unit of this.state.units) {
      const token = this.tokens.get(unit.id);
      if (!token) continue; // a board unit the battle shows under its battle id
      const bench = unit.location.kind === 'bench', operable = bench && unit.team === 'player' && this.benchOps();
      if (token.input) { this.input.setDraggable(token, operable); token.input.enabled = true; }
      if (bench) token.setAlpha(operable ? 1 : 0.35);
    }
    const selectedTarget = combat.units.find(unit => unit.id === this.selectedId)?.targetId;
    for (const unit of combat.units) {
      const ring: RingState = unit.id === selectedTarget || this.previewHighlight.has(unit.id) ? 'target' : unit.id === this.selectedId ? 'selected' : 'normal';
      this.views.get(unit.id)?.setRing(ring, unit.team);
      const token = this.tokens.get(unit.id)!;
      token.setVisible(unit.alive);
      const key = `${unit.cell.col},${unit.cell.row}`;
      if (this.renderedCells.get(unit.id) !== key) {
        this.tweens.killTweensOf(token);
        const p = this.layout.center(unit.cell);
        if (this.renderedCells.has(unit.id) && unit.alive && !reducedMotion()) this.tweens.add({ targets: token, x: p.x, y: p.y, duration: 220, ease: 'Sine.easeInOut' });
        else token.setPosition(p.x, p.y);
        this.renderedCells.set(unit.id, key);
      }
      this.views.get(unit.id)?.drawCombat(unit, runtime);
    }
    this.timer.setText(`${(combat.tick * COMBAT_TICK_MS / 1000).toFixed(1)}s / ${(combat.maxTicks * COMBAT_TICK_MS / 1000).toFixed(0)}s`);
  }
  /** Offline: the local ledger of the ticks just run. Online: the replay events just played. Same consumers. */
  private showEvents(events: readonly SceneCombatEvent[]) {
    const combat = this.session.combatView;
    if (!combat || !events.length) return;
    this.strategyPanel?.observeEvents(events);
    this.recentCombatEvents.push(...structuredClone(events));
    publishCombatEvents(() => asDisplayEvents(events));
    if (this.recentCombatEvents.length > 200) this.recentCombatEvents.splice(0, this.recentCombatEvents.length - 200);
    const casts = this.fx.casts;
    // The engine state, when there is one, adds ability colors; positions and teams are the same as the view's.
    this.fx.show(events, this.session.combatRuntime ?? combat);
    this.renderedCastCount += this.fx.casts - casts;
    this.feedback?.push(events, performance.now());
  }
  private fadeEffect(effect: Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Arc | Phaser.GameObjects.Container, duration: number) {
    this.effects.add(effect);
    this.tweens.add({ targets: effect, alpha: 0, duration, onComplete: () => { this.effects.delete(effect); effect.destroy(); } });
  }

  /** Optional 3D layer (?render=3d): the tokens as drawn, in logical board coordinates. Built only while it listens. */
  private boardFrame(): BoardFrame {
    const board = this.state.board, fallen = new Set(this.session.combatView?.units.filter(unit => !unit.alive).map(unit => unit.id));
    const result = this.session.state.roundResults?.at(-1);
    return { rows: board.rows, columns: board.columns, hexRadius: BOARD_LAYOUT.hexRadius, origin: BOARD_LAYOUT.origin,
      bench: Array.from({ length: this.state.benchSize }, (_, slot) => this.benchCenter(slot)),
      pieces: [...this.tokens].map(([id, token]) => ({ id, definitionId: token.getData('definitionId'), team: token.getData('team'),
        starLevel: token.getData('starLevel'), ...(token.getData('effectiveStarLevel') === 4 ? { effectiveStarLevel: 4 as const } : {}),
        ...(token.getData('neutral') === true ? { neutral: true as const } : {}),
        x: token.x, y: token.y, alive: !fallen.has(id),
        // The 2D token hides at death (syncCombat); the 3D piece stays up for its death action.
        visible: (token.visible || fallen.has(id)) && token.alpha > 0, ...this.feedGear(id) })),
      fighting: this.session.combatView !== null, dragging: this.draggingId,
      orbs: this.feedOrbs(),
      openedOrbs: grantedOrbIds(readOrbClaimReceipts(this.session.state)),
      orbRefusals: this.orbRefusalsOf(),
      hit: result && result.hpLost > 0 ? { key: `round:${result.round}:${result.roundId}`, damage: result.hpLost } : null,
      ...this.feedMechanics() };
  }
  /** ?render=3d: my unclaimed orbs, each with the monster that dropped it while this round's loot names one (3D drops it there). */
  private feedOrbs(): BoardFrame['orbs'] {
    const state = this.session.state, drops = readOrbLoot(state)?.revealedDrops ?? [];
    return readUnclaimedOrbs(state).map(orb => {
      const variant = orbVariant(state, orb.orbId), source = drops.find(drop => drop.orbId === orb.orbId)?.sourceUnitId;
      return { orbId: orb.orbId, tier: orb.tier, queued: orb.queued, ...(variant ? { variant } : {}), ...(source ? { source } : {}) };
    });
  }
  private mechanicsOf: unknown = null; private mechanics: { mechanics?: BoardMechanics } = {};
  /** ?render=3d: my 征服层数, 微光 and 家人团聚 dancers, recomputed only when the session state object changes (frames publish every tick). */
  private feedMechanics(): { mechanics?: BoardMechanics } {
    const state = this.session.state;
    if (state !== this.mechanicsOf) {
      this.mechanicsOf = state;
      const reunion = familyReunionDancers(state), mechanics = { ...g23BoardMechanics(state), ...(reunion.length ? { reunion } : {}) };
      this.mechanics = Object.keys(mechanics).length ? { mechanics } : {};
    }
    return this.mechanics;
  }
  private orbRefusalsOf(): Readonly<Record<string, number>> {
    const present = new Set(readUnclaimedOrbs(this.session.state).map(orb => orb.orbId));
    for (const id of [...this.orbRefusals.keys()]) if (!present.has(id)) this.orbRefusals.delete(id);
    return Object.fromEntries(this.orbRefusals);
  }
  /** ?render=3d: the piece's combat meters and worn items as its 2D view draws them (the 3D layer covers that view). */
  private feedGear(id: string): Pick<BoardFrame['pieces'][number], 'meters' | 'items'> {
    const view = this.views.get(id);
    if (!view) return {};
    const hp = view.meter('hp'), mana = view.meter('mana');
    return { ...(view.hp.visible ? { meters: { hp: hp.value, maxHp: hp.maxValue, mana: mana.value, maxMana: mana.maxValue, shield: view.shield.visible ? view.meter('shield').value : 0 } } : {}),
      // 窃贼手套: the round's stolen items follow the worn ones, as the original shows them over the unit.
      ...(view.equipped.length || view.extras.temporary.length
        ? { items: [...view.equipped, ...view.extras.temporary].map(item => ({ id: item, icon: s13AssetUrl('item', item) })) } : {}) };
  }
  /** Plain copies and client-space coordinates only; no commands or mutable objects. */
  debugSnapshot() {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.scale.gameSize.width, scaleY = rect.height / this.scale.gameSize.height;
    const client = (p: Point): Point => ({ x: rect.left + p.x * scaleX, y: rect.top + p.y * scaleY });
    const bounds = Object.fromEntries([...this.namedObjects].map(([name, object]) => {
      const box = object.getBounds(), p = client(box), center = client({ x: box.centerX, y: box.centerY });
      return [name, { x: p.x, y: p.y, width: box.width * scaleX, height: box.height * scaleY, centerX: center.x, centerY: center.y }];
    }));
    const hexes: Record<string, Point> = {};
    for (let row = 0; row < this.state.board.rows; row++) for (let col = 0; col < this.state.board.columns; col++) hexes[`${col},${row}`] = client(this.layout.center({ col, row }));
    const meters = (kind: 'hp' | 'mana' | 'shield') => [...this.views].map(([id, view]) => ({ id,
      visible: (kind === 'hp' ? view.hp : kind === 'mana' ? view.mana : view.shield).visible, ...view.meter(kind) }));
    const strategy = this.strategyPanel?.snapshot();
    Object.assign(bounds, strategy?.bounds ?? {});
    return structuredClone({ state: this.session.state, strategy, m6: this.application?.debug(), stats: this.activeStats,
      tokens: [...this.tokens].map(([id, token]) => ({ id, x: token.x, y: token.y, screenX: client(token).x, screenY: client(token).y,
        visible: token.visible, alpha: token.alpha, draggable: Boolean(token.input?.enabled && token.input.draggable),
        definitionId: token.getData('definitionId'), starLevel: token.getData('starLevel'), cost: token.getData('cost'),
        starLabel: this.views.get(id)!.star.text, name: this.views.get(id)!.name, symbol: this.views.get(id)!.symbol, statusStrip: this.views.get(id)!.statusStrip,
        equipped: this.views.get(id)!.equipped, pendingEquipped: this.views.get(id)!.pendingEquipped, owner: this.equipmentOwner(id) })),
      loadoutTip: this.loadoutTip?.visible ? this.loadoutTip.text : '',
      health: meters('hp'), mana: meters('mana'),
      shields: meters('shield').map(meter => ({ ...meter, text: this.views.get(meter.id)!.shieldLabel.text, labelVisible: this.views.get(meter.id)!.shieldLabel.visible })),
      hud: { round: this.roundLabel.text, gold: this.goldLabel.text, playerHp: this.hpLabel.text, level: this.levelLabel.text,
        xp: this.xpLabel.text, population: this.count.text, odds: this.oddsLabel.text, result: this.resultLabel.text,
        settlement: this.incomeLabel.text, selection: this.selectionLabel.text, startHint: this.startHint.text },
      recentCombatEvents: this.recentCombatEvents, combatEvents: this.session.combatEvents, combatView: this.session.combatView,
      replay: this.session instanceof RemoteSession ? this.session.playbackDebug() : null,
      gesture: this.inputRouter.current, gestureEpoch: this.inputRouter.gestureEpoch,
      renderedCastCount: this.renderedCastCount, renderedUpgradeCount: this.renderedUpgradeCount,
      effects: this.effects.size, tweens: this.tweens.getTweens().length, selectedId: this.selectedId, draggingId: this.draggingId,
      texts: this.children.list.filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text).map(child => child.text),
      bounds, layout: { hexes, bench: Array.from({ length: this.state.benchSize }, (_, slot) => client(this.benchCenter(slot))) },
    });
  }
}
