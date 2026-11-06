/** The default arena's interest props for the board on show (mine, or a scouted seat's); frames supply counts and paid-income keys, never economy rules. */
import { AnimationMixer, Color, Group, LoopOnce, LoopRepeat, MeshStandardMaterial, Vector3, type Material, type Mesh, type Object3D } from 'three';
import type { BoardAlignment, ModelLease } from '../../rendering3d';
import type { BoardFrame, BoardScout } from '../board-feed';
import { arenaDrawTransform } from './board-arena';

export const GOLD_MINE_MODEL = 'board-default-prop-b9428eae4ae8c07c91ed';
/** The default arena's GoldMine locators in original map space; Home1 is nearest the bench. Only DEFAULT_BOARD uses these. */
export const GOLD_MINE_HOME = Array.from({ length: 5 }, (_, index) => [1103.598, 28.3825, 1615.378 + 160 * index] as const);
export interface GoldMineAlignment extends BoardAlignment { readonly reflectX?: boolean }
export type MineAction = 'hidden' | 'idle' | 'spawn' | 'death' | 'gain';
const CLIPS = { idle: 'GoldMine_Idle', spawn: 'GoldMine_Spawn', death: 'GoldMine_Death', gain: 'GoldMine_Gain_Gold' } as const;

/** TFT: the mines belong to the board on show; a scouted seat's are its public 0–5 step and never replay my paid-income gesture. */
export const minesFrameFor = (frame: BoardFrame, scout: Pick<BoardScout, 'interest'> | null | undefined): BoardFrame =>
  scout ? { ...frame, goldMines: scout.interest, goldMineIncomeKey: null } : frame;

/** Reflect original map X just as the arena converter did, then apply the drawn arena's live-grid transform. */
export function goldMinePlacement(alignment: GoldMineAlignment, frame: BoardFrame) {
  const transform = arenaDrawTransform(alignment, frame);
  const scale = transform.scale.clone();
  if (alignment.reflectX) scale.x *= -1;
  return { scale, points: GOLD_MINE_HOME.map(point => new Vector3(...point).multiply(scale).add(transform.position)) };
}

/** Null previous count seeds standing mines without replay; count changes take precedence over an income gesture. */
export function goldMineActions(previous: number | null, count: number, income: boolean): (MineAction | null)[] {
  return GOLD_MINE_HOME.map((_, index) => {
    if (previous === null) return index < count ? 'idle' : 'hidden';
    if (index >= previous && index < count) return 'spawn';
    if (index < previous && index >= count) return 'death';
    return index < count && income ? 'gain' : null;
  });
}

/** The model ships with its texture but a black emissive, so the gold reads as dull brown on the wall; the texture itself lights it. */
export const GOLD_MINE_GLOW = { color: '#ffd27a', intensity: 0.5 } as const;
/** Swaps the leased scene's materials for glowing clones (one per source, kept in `clones`); the shared template material stays as it was. */
export function lightGoldMine(scene: Object3D, clones: Map<Material, Material>) {
  const lit = (source: Material) => {
    const known = clones.get(source);
    if (known) return known;
    let material = source;
    if (source instanceof MeshStandardMaterial && source.map && !source.emissiveMap && source.emissive.getHex() === 0) {
      const glowing = material = source.clone();
      glowing.emissive = new Color(GOLD_MINE_GLOW.color); glowing.emissiveMap = source.map; glowing.emissiveIntensity = GOLD_MINE_GLOW.intensity;
    }
    clones.set(source, material);
    return material;
  };
  scene.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(lit) : lit(mesh.material);
  });
}

/** Each load leases a SkeletonUtils clone; its mixer and skeleton belong to that mine alone. No placeholder bodies. */
export function createGoldMines(parent: Group, alignment: GoldMineAlignment, load: () => Promise<ModelLease>) {
  const root = new Group(); root.name = 'render3d-gold-mines'; root.visible = false; parent.add(root);
  const mines = GOLD_MINE_HOME.map((_, index) => {
    const node = new Group(); node.name = `render3d-gold-mine-Home${index + 1}`; node.visible = false; root.add(node);
    return { node, lease: null as ModelLease | null, mixer: null as AnimationMixer | null, action: 'hidden' as MineAction, left: 0 };
  });
  const glowing = new Map<Material, Material>();
  let disposed = false, started = false, count: number | null = null, incomeKey: string | null = null, owner: string | null = null;
  const play = (mine: typeof mines[number], action: MineAction) => {
    mine.action = action; mine.left = 0; mine.mixer?.stopAllAction();
    mine.node.visible = action !== 'hidden' && !!mine.lease;
    if (action === 'hidden' || !mine.lease || !mine.mixer) return;
    const clip = mine.lease.animations.find(clip => clip.name === CLIPS[action]);
    if (!clip) { if (action !== 'idle') play(mine, action === 'death' ? 'hidden' : 'idle'); return; }
    const animation = mine.mixer.clipAction(clip).reset().setLoop(action === 'idle' ? LoopRepeat : LoopOnce, action === 'idle' ? Infinity : 1);
    animation.clampWhenFinished = true; animation.play(); mine.mixer.update(0);
    mine.left = action === 'idle' ? 0 : clip.duration;
  };
  return {
    /** `seat` is whose board is on show (null: mine); a different seat's mines stand at once, without Spawn/Death replay. */
    frame(frame: BoardFrame, ready: boolean, seat: string | null = null) {
      if (seat !== owner) { owner = seat; count = null; incomeKey = null; }
      root.visible = ready && frame.goldMines !== undefined;
      if (!ready || frame.goldMines === undefined) { count = null; incomeKey = null; return; }
      const placement = goldMinePlacement(alignment, frame);
      mines.forEach((mine, index) => { mine.node.position.copy(placement.points[index]!); mine.node.scale.copy(placement.scale); });
      const key = frame.goldMineIncomeKey ?? null;
      const next = Math.max(0, Math.min(5, Math.floor(frame.goldMines)));
      const actions = goldMineActions(count, next, key !== null && key !== incomeKey);
      actions.forEach((action, index) => { if (action && (action !== 'gain' || ['idle', 'gain'].includes(mines[index]!.action))) play(mines[index]!, action); });
      count = next; incomeKey = key;
      if (started) return;
      started = true;
      mines.forEach(mine => {
        void load().then(lease => {
          if (disposed || lease.placeholder) { lease.release(); return; }
          lightGoldMine(lease.scene, glowing);
          mine.lease = lease; mine.node.add(lease.scene); mine.mixer = new AnimationMixer(lease.scene);
          // Root already carries the converter's [0.8953, -6.8490, 0] correction; never apply it twice.
          play(mine, mines.indexOf(mine) < (count ?? 0) ? 'idle' : 'hidden');
        }).catch(() => { /* missing model draws nothing */ });
      });
    },
    update(seconds: number) {
      for (const mine of mines) {
        mine.mixer?.update(seconds);
        if (mine.left <= 0) continue;
        mine.left -= seconds;
        if (mine.left <= 0) play(mine, mine.action === 'death' ? 'hidden' : 'idle');
      }
    },
    debug: () => mines.map(mine => ({ action: mine.action, model: !!mine.lease, shown: root.visible && mine.node.visible })),
    dispose() {
      disposed = true; root.removeFromParent();
      for (const mine of mines) { mine.mixer?.stopAllAction(); if (mine.lease) mine.mixer?.uncacheRoot(mine.lease.scene); mine.lease?.release(); }
      for (const [source, material] of glowing) if (material !== source) material.dispose();
    },
  };
}
