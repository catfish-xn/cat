/**
 * 3D 看对手 (planning/3d/tft-parity-carousel-scout-ui-2026-10-21.md S1/S2/S4): another seat's public build drawn on the
 * board instead of mine while board-feed carries a BoardScout. Only what `readScout` copies from the seat's public view
 * is drawn: deployed units on their own cells (the owner's orientation, so their deployment rows are at the bottom as
 * mine are), bench units, the items they hold, their stars, the owner's 河灵 in its spot and its unclaimed orbs by tier.
 * Nothing private exists here to draw: the server never sends another seat's gold, XP, streak or shop, and the copy
 * drops anything else a view might carry. Display only, no input: the host hides my pieces and surroundings meanwhile.
 * During combat it still shows the seat's line-up (its battle is not sent to me).
 */
import { Box3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, SphereGeometry, Vector3, type Object3D, type Scene } from 'three';
import { UnitActionState, UnitAnimationMixer, createStarMark, hexCenter, type ModelLease, type StarMark } from '../../rendering3d';
import type { BoardFrame, BoardScout } from '../board-feed';
import { createUnitOverhead, type OverheadContext, type UnitOverhead } from './unit-overhead';
import { legendSpot } from './tabletop';
import { loadLegendLease } from './legend-load';

type OrbTier = 'gray' | 'blue' | 'gold' | 'prismatic';
const TIERS: readonly OrbTier[] = ['gray', 'blue', 'gold', 'prismatic'];
const ORB_COLOR: Record<OrbTier, string> = { gray: '#a8b0ba', blue: '#4fb7ff', gold: '#ffc94a', prismatic: '#e7a8ff' };
const ORB_RADIUS = 9, ORB_FLOAT = 16, MAX_ORBS = 10;
const STAR_SIZE = 12, STAR_GAP = 12;

/** One unit as scouting may show it. */
export interface ScoutUnit {
  readonly definitionId: string; readonly starLevel: number; readonly effectiveStarLevel?: 4;
  readonly items: readonly string[]; readonly anomaly?: string; readonly summon?: true;
}
/** A seat's public build as this layer draws it: every field is one the server publishes to every seat. */
export interface ScoutView {
  readonly seatId: string; readonly name: string;
  readonly units: readonly (ScoutUnit & { readonly cell: { readonly col: number; readonly row: number } })[];
  readonly bench: readonly (ScoutUnit & { readonly slot: number })[];
  readonly looseItems: readonly string[];
  readonly augments: readonly string[];
  /** Unclaimed orbs: how many and which tiers, never ids or contents. */
  readonly orbs: { readonly count: number; readonly tiers: readonly OrbTier[] };
  /** The seat's little legend code name (cosmetic), null for the default. */
  readonly legend: string | null;
}

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const int = (value: unknown): number | null => Number.isInteger(value) ? value as number : null;
function unitOf(raw: unknown): ScoutUnit | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>, starLevel = int(source.starLevel);
  if (typeof source.definitionId !== 'string' || starLevel === null) return null;
  return { definitionId: source.definitionId, starLevel, items: strings(source.items),
    ...(source.effectiveStarLevel === 4 ? { effectiveStarLevel: 4 as const } : {}),
    ...(typeof source.anomaly === 'string' ? { anomaly: source.anomaly } : {}), ...(source.summon === true ? { summon: true as const } : {}) };
}
/**
 * The whitelist copy (S2): field by field from the published board and orb summary, whatever else the input holds.
 * Malformed entries are dropped rather than guessed.
 */
export function readScout(scout: BoardScout): ScoutView {
  const board = (scout.board ?? {}) as unknown as Record<string, unknown>;
  const units = (Array.isArray(board.units) ? board.units : []).flatMap(raw => {
    const unit = unitOf(raw), cell = (raw as { cell?: { col?: unknown; row?: unknown } }).cell;
    const col = int(cell?.col), row = int(cell?.row);
    return unit && col !== null && row !== null ? [{ ...unit, cell: { col, row } }] : [];
  });
  const bench = (Array.isArray(board.bench) ? board.bench : []).flatMap(raw => {
    const unit = unitOf(raw), slot = int((raw as { slot?: unknown }).slot);
    return unit && slot !== null && slot >= 0 ? [{ ...unit, slot }] : [];
  });
  const count = int(scout.orbs?.count) ?? 0;
  const tiers = strings(scout.orbs?.tiers).filter((tier): tier is OrbTier => (TIERS as readonly string[]).includes(tier));
  return { seatId: String(scout.seatId), name: String(scout.name), units, bench, looseItems: strings(board.looseItems), augments: strings(board.augments),
    orbs: { count: Math.max(0, count), tiers }, legend: typeof scout.legend === 'string' && LEGEND_ID.test(scout.legend) ? scout.legend : null };
}
/** A little legend's short code name (protocol LittleLegendId); anything else is drawn as the default. */
const LEGEND_ID = /^[a-z0-9-]{1,40}$/;

export interface ScoutStageContext {
  readonly scene: Scene;
  readonly championHeight: number; readonly championWidth: number;
  /** Stand-in pawn size when no model is available. */
  readonly pawnHeight: number; readonly pawnWidth: number;
  readonly loadModel: ((id: string) => Promise<ModelLease>) | null;
  /** Legend model to load for a seat's legend (falls back to the default, see legend-load), null without legend assets. */
  readonly legendModel: (legend: string | null) => string | null;
  /** My own little legend (code name, null for the default): as in TFT it travels with me and stands at the visitor's corner. */
  readonly myLegend: () => string | null;
  readonly starColor: (level: number) => string;
  readonly overhead: OverheadContext;
  /** Item icon URL (the 2D bundle's) for an item definition id; null when there is none. */
  readonly itemIcon: (id: string) => string | null;
  readonly own: <T extends { dispose(): void }>(resource: T) => T;
}
export interface ScoutStage {
  readonly group: Group;
  readonly active: boolean;
  /** The seat to draw on this board layout, or null to stop (everything is released). */
  show(scout: BoardScout | null, frame: BoardFrame | null): void;
  update(seconds: number): void;
  debug(): { seatId: string | null; units: string[]; bench: string[]; orbs: string[]; legend: string; visitor: string };
  dispose(): void;
}

interface Piece { root: Group; lease: ModelLease | null; mixer: UnitAnimationMixer | null; state: UnitActionState; stars: StarMark | null; overhead: UnitOverhead; height: number; disposed: boolean; key: string }

function fit(body: Object3D, height: number, width = Infinity): Object3D {
  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3());
  const scale = Math.min(size.y > 0 ? height / size.y : Infinity, Math.max(size.x, size.z) > 0 ? width / Math.max(size.x, size.z) : Infinity);
  if (!Number.isFinite(scale)) return body;
  body.scale.multiplyScalar(scale); body.position.y -= box.min.y * scale;
  return body;
}

export function createScoutStage(ctx: ScoutStageContext): ScoutStage {
  const { own } = ctx;
  const group = new Group(); group.name = 'render3d-scout'; group.visible = false;
  ctx.scene.add(group);
  const pawnBody = own(new CylinderGeometry(9, 13, 34, 16)), pawnHead = own(new SphereGeometry(10, 16, 12));
  const pawnMaterial = own(new MeshStandardMaterial({ color: '#d1504a', roughness: 0.6 }));
  const legendGeometry = own(new SphereGeometry(14, 20, 14)), legendMaterial = own(new MeshStandardMaterial({ color: '#e3a08f', roughness: 0.55 }));
  const orbGeometry = own(new SphereGeometry(ORB_RADIUS, 20, 14));
  // A unit's anomaly: a violet gem beside its stars (the strip's chip names it on hover).
  const anomalyGeometry = own(new OctahedronGeometry(5)), anomalyMaterial = own(new MeshStandardMaterial({ color: '#b48cff', emissive: '#8f5cff', emissiveIntensity: 0.7 }));
  const orbMaterial = Object.fromEntries(TIERS.map(tier => [tier, own(new MeshStandardMaterial({ color: ORB_COLOR[tier], emissive: ORB_COLOR[tier],
    emissiveIntensity: 0.55, roughness: 0.3 }))])) as Record<OrbTier, MeshStandardMaterial>;

  let current: ScoutView | null = null, layoutKey = '';
  const pieces: Piece[] = [], orbs: Mesh[] = [];
  let legend: Piece | null = null, visitor: Piece | null = null;

  const createPiece = (key: string, model: string | null, height: number, width: number, stand: () => Object3D,
    load: ((id: string) => Promise<ModelLease>) | null = ctx.loadModel): Piece => {
    const root = new Group(); root.name = 'render3d-scout-piece';
    const body = stand(); root.add(body);
    const piece: Piece = { root, lease: null, mixer: null, state: new UnitActionState(`scout:${key}`), stars: null,
      overhead: createUnitOverhead(ctx.overhead), height, disposed: false, key };
    group.add(root, piece.overhead.object);
    if (load && model) void load(model).then(lease => {
      if (piece.disposed || lease.placeholder) { lease.release(); return; }
      body.removeFromParent(); piece.lease = lease;
      root.add(fit(lease.scene, height, width));
      piece.mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames);
      piece.mixer.apply(piece.state.output);
    }).catch(() => { /* keeps the stand-in */ });
    return piece;
  };
  const pawn = () => {
    const body = new Group(); body.name = 'render3d-scout-pawn';
    const trunk = new Mesh(pawnBody, pawnMaterial); trunk.position.y = 17;
    const head = new Mesh(pawnHead, pawnMaterial); head.position.y = 42;
    body.add(trunk, head);
    return fit(body, ctx.pawnHeight, ctx.pawnWidth);
  };
  const unitPiece = (unit: ScoutUnit, key: string, at: Vector3): Piece => {
    const piece = createPiece(key, unit.definitionId, ctx.championHeight, ctx.championWidth, pawn);
    piece.root.position.copy(at); piece.root.rotation.y = Math.PI; // models face +z; the owner's side looks up the board
    if (!unit.summon) {
      piece.stars = createStarMark({ effectiveStarLevel: unit.effectiveStarLevel ?? unit.starLevel, colorFor: ctx.starColor });
      piece.stars.object.scale.setScalar(STAR_SIZE); piece.stars.object.position.copy(at).setY(ctx.championHeight + STAR_GAP);
      group.add(piece.stars.object);
    }
    if (unit.anomaly) {
      const gem = new Mesh(anomalyGeometry, anomalyMaterial); gem.name = 'render3d-scout-anomaly';
      gem.position.set(STAR_SIZE * 2.2, ctx.championHeight + STAR_GAP, 0); piece.root.add(gem);
    }
    piece.overhead.set('player', undefined, unit.items.length ? unit.items.map(id => ({ id, icon: ctx.itemIcon(id) })) : undefined);
    piece.overhead.object.position.copy(at).setY(ctx.championHeight + STAR_GAP + (piece.stars ? STAR_SIZE / 2 + 3 : -STAR_GAP / 2));
    piece.overhead.object.visible = piece.overhead.drawn;
    return piece;
  };
  const dropPiece = (piece: Piece) => {
    piece.disposed = true; piece.mixer?.dispose(); piece.lease?.release(); piece.stars?.dispose(); piece.overhead.dispose(); piece.root.removeFromParent();
  };
  const clear = () => {
    for (const piece of pieces) dropPiece(piece);
    pieces.length = 0;
    if (legend) dropPiece(legend);
    if (visitor) dropPiece(visitor);
    legend = null; visitor = null;
    for (const orb of orbs) orb.removeFromParent();
    orbs.length = 0;
  };

  const build = (view: ScoutView, frame: BoardFrame) => {
    clear();
    const grid = { rows: frame.rows, columns: frame.columns, radius: frame.hexRadius, origin: frame.origin };
    for (const unit of view.units) {
      if (unit.cell.col < 0 || unit.cell.col >= frame.columns || unit.cell.row < 0 || unit.cell.row >= frame.rows) continue;
      pieces.push(unitPiece(unit, `board:${unit.cell.col},${unit.cell.row}`, hexCenter(unit.cell, grid).setY(0)));
    }
    for (const unit of view.bench) {
      const spot = frame.bench[unit.slot];
      if (spot) pieces.push(unitPiece(unit, `bench:${unit.slot}`, new Vector3(spot.x, 0, spot.y)));
    }
    // The owner's 河灵 where mine stands, facing the board; its orbs in two columns beside it, by tier only.
    const spot = legendSpot(frame), legendHeight = ctx.championHeight * 0.5;
    const loadModel = ctx.loadModel;
    const legendPiece = (role: 'legend' | 'visitor', code: string | null, at: Vector3) => {
      const model = ctx.legendModel(code);
      const piece = createPiece(`${role}:${model ?? 'none'}`, model, legendHeight, Infinity, () => {
        const body = new Mesh(legendGeometry, legendMaterial); body.scale.set(1, 0.82, 1); body.position.y = 12;
        const stand = new Group(); stand.name = 'render3d-scout-legend-standin'; stand.add(body);
        return fit(stand, legendHeight);
      }, loadModel ? id => loadLegendLease(loadModel, id) : null);
      piece.root.position.copy(at);
      piece.root.rotation.y = Math.atan2(center.x - at.x, center.z - at.z);
      return piece;
    };
    const width = Math.sqrt(3) * frame.hexRadius, step = frame.hexRadius * 1.5;
    const center = new Vector3(frame.origin.x + width * (frame.columns - 0.5) / 2, 0, frame.origin.y + step * (frame.rows - 1) / 2);
    legend = legendPiece('legend', view.legend, spot);
    // Mine came along: the visitor's corner, across the board from the owner's (where a PvP opponent's legend stands).
    visitor = legendPiece('visitor', ctx.myLegend(), new Vector3(frame.origin.x - width * 1.6, 0, frame.origin.y));
    view.orbs.tiers.slice(0, MAX_ORBS).forEach((tier, index) => {
      const orb = new Mesh(orbGeometry, orbMaterial[tier]); orb.name = `render3d-scout-orb-${tier}`;
      orb.position.set(spot.x + (index % 2 ? 0.42 : -0.42) * width, ORB_FLOAT, spot.z - (1 + Math.floor(index / 2)) * step * 0.9);
      group.add(orb); orbs.push(orb);
    });
  };

  const legendDebug = (piece: Piece | null) => piece ? piece.lease ? `model:${piece.key.slice(piece.key.indexOf(':') + 1)}` : 'standin' : 'none';
  let clock = 0;
  return {
    group,
    get active() { return current !== null; },
    show(scout, frame) {
      if (!scout || !frame) { if (current) { clear(); current = null; layoutKey = ''; group.visible = false; } return; }
      const view = readScout(scout);
      const key = `${frame.rows}x${frame.columns}@${frame.hexRadius},${frame.origin.x},${frame.origin.y}|${frame.bench.length}|${ctx.myLegend()}|${JSON.stringify(view)}`;
      current = view; group.visible = true;
      if (key === layoutKey) return;
      layoutKey = key;
      build(view, frame);
    },
    update(seconds) {
      if (!current) return;
      clock += seconds;
      for (const piece of [...pieces, legend, visitor]) {
        if (!piece) continue;
        const output = piece.state.update(seconds);
        if (piece.mixer) { piece.mixer.apply(output); piece.mixer.update(seconds); }
      }
      orbs.forEach((orb, index) => { orb.position.y = ORB_FLOAT + Math.sin(clock * 2 + index) * 2; });
    },
    debug: () => ({
      seatId: current?.seatId ?? null,
      units: pieces.filter(piece => piece.key.startsWith('board:')).map(piece => `${piece.key}:${piece.lease ? 'model' : 'standin'}`),
      bench: pieces.filter(piece => piece.key.startsWith('bench:')).map(piece => piece.key),
      orbs: orbs.map(orb => orb.name.replace('render3d-scout-orb-', '')),
      legend: legendDebug(legend), visitor: legendDebug(visitor),
    }),
    dispose() { clear(); current = null; group.removeFromParent(); },
  };
}
