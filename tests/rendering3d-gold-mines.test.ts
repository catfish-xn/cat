import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NumberKeyframeTrack, Texture } from 'three';
import { createGoldMines, goldMineActions, goldMinePlacement, GOLD_MINE_GLOW, GOLD_MINE_HOME, lightGoldMine, minesFrameFor, type GoldMineAlignment } from '../src/rendering/three-mode/gold-mines';
import type { BoardFrame } from '../src/rendering/board-feed';
import type { ModelLease } from '../src/rendering3d';
const alignment: GoldMineAlignment = { reflectX: true, scale: [2, 3, -4], offset: [10, 20, 30], target: { radius: 34, origin: { x: 35, y: 50 } } };
const frame = (goldMines?: number, goldMineIncomeKey: string | null = null): BoardFrame => ({
  rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces: [], fighting: false, dragging: null,
  ...(goldMines === undefined ? {} : { goldMines, goldMineIncomeKey }),
});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function setup(placeholder = false) {
  const parent = new Group(), releases = Array.from({ length: 5 }, () => vi.fn());
  const scenes: Group[] = [];
  const load = vi.fn(async (): Promise<ModelLease> => {
    const scene = new Group(), release = releases[scenes.length]!; scenes.push(scene);
    return { scene, release, placeholder, animationNames: {}, animations: ['Idle', 'Spawn', 'Death', 'Gain_Gold'].map(name =>
      new AnimationClip(`GoldMine_${name}`, 1, [new NumberKeyframeTrack('.position[y]', [0, 1], [0, 10])])) };
  });
  const mines = createGoldMines(parent, alignment, load);
  return { parent, load, mines, releases, scenes };
}
describe('default arena gold mines for the board on show', () => {
  it('seeds without spawn, raises lowest first, sinks highest first, and gives count changes priority over income', () => {
    expect(goldMineActions(null, 3, true)).toEqual(['idle', 'idle', 'idle', 'hidden', 'hidden']);
    expect(goldMineActions(2, 4, true)).toEqual(['gain', 'gain', 'spawn', 'spawn', null]);
    expect(goldMineActions(5, 2, false)).toEqual([null, null, 'death', 'death', 'death']);
    expect(goldMineActions(3, 3, false)).toEqual([null, null, null, null, null]);
  });
  it.each([true, false])('maps original locators through reflection=%s and live-grid scaling once', reflectX => {
    const board = { ...frame(), hexRadius: 68, origin: { x: 100, y: 200 } };
    const placed = goldMinePlacement({ ...alignment, reflectX }, board);
    // The drawn arena is mirrored about the grid's centre line (board-arena.ts arenaDrawTransform).
    const mirrorX = 2 * (100 + Math.sqrt(3) * 68 * 3.25) - 50;
    expect(placed.scale.toArray()).toEqual([reflectX ? 4 : -4, 6, -8]);
    GOLD_MINE_HOME.forEach(([x, y, z], i) => {
      expect(placed.points[i]!.toArray()).toEqual([mirrorX + (reflectX ? 4 : -4) * x, 40 + 6 * y, 160 - 8 * z]);
    });
    expect(placed.points[0]!.z).toBeGreaterThan(placed.points[4]!.z);
  });
  it('uses independent leases/mixers, interrupts death with spawn, deduplicates income and returns to idle/hide', async () => {
    const { mines, scenes, releases } = setup();
    mines.frame(frame(3, 'paid-1'), true, null); await flush();
    expect(mines.debug().map(m => m.action)).toEqual(['idle', 'idle', 'idle', 'hidden', 'hidden']);
    mines.frame(frame(2, 'paid-1'), true, null); mines.update(0.4);
    expect(mines.debug()[2]!.action).toBe('death');
    mines.frame(frame(3, 'paid-1'), true, null); mines.update(0.2);
    expect(mines.debug()[2]!.action).toBe('spawn');
    expect(scenes[2]!.position.y).toBeCloseTo(2);
    expect(scenes[0]!.position.y).toBeCloseTo(6);
    mines.update(1); mines.frame(frame(3, 'paid-2'), true, null);
    expect(mines.debug().slice(0, 3).every(m => m.action === 'gain')).toBe(true);
    mines.update(0.4); mines.frame(frame(3, 'paid-2'), true, null); mines.update(0.7);
    expect(mines.debug().slice(0, 3).every(m => m.action === 'idle')).toBe(true);
    mines.frame(frame(0, 'paid-2'), true, null); mines.update(1.1);
    expect(mines.debug().every(m => !m.shown)).toBe(true);
    mines.dispose(); releases.forEach(release => expect(release).toHaveBeenCalledOnce());
  });
  it('draws nothing offline, before arena readiness, or with missing/placeholder models', async () => {
    const { mines, load } = setup();
    mines.frame(frame(), true, null); mines.frame(frame(5), false, null); expect(load).not.toHaveBeenCalled();
    mines.frame(frame(5), true, null); await flush(); expect(mines.debug().every(m => m.shown)).toBe(true);
    mines.frame(frame(5), false, null); expect(mines.debug().every(m => !m.shown)).toBe(true);
    mines.dispose();
    const empty = setup(true); empty.mines.frame(frame(5), true, null); await flush();
    expect(empty.mines.debug().every(m => !m.shown)).toBe(true); empty.releases.forEach(release => expect(release).toHaveBeenCalledOnce()); empty.mines.dispose();
    const missing = createGoldMines(new Group(), alignment, () => Promise.reject(Error('missing')));
    missing.frame(frame(5), true, null); await flush(); expect(missing.debug().every(m => !m.shown)).toBe(true); missing.dispose();
  });
  it('shows the scouted seat\'s own count, seeded without Spawn/Death, live while scouting, and mine again on return', async () => {
    const { mines } = setup();
    mines.frame(frame(4, 'paid-1'), true, null); await flush();
    expect(mines.debug().map(m => m.action)).toEqual(['idle', 'idle', 'idle', 'idle', 'hidden']);
    // Scouting s3 (interest 1): its board's mines stand at once, no Death on my three extra mines.
    mines.frame(frame(1, null), true, 's3');
    expect(mines.debug().map(m => m.action)).toEqual(['idle', 'hidden', 'hidden', 'hidden', 'hidden']);
    expect(mines.debug().map(m => m.shown)).toEqual([true, false, false, false, false]);
    // Its gold rises while I watch: the next mine spawns.
    mines.frame(frame(2, null), true, 's3');
    expect(mines.debug()[1]!.action).toBe('spawn');
    // Another seat, then back home: each seeds standing, and my old income key replays no Gain_Gold.
    mines.frame(frame(5, null), true, 's5');
    expect(mines.debug().map(m => m.action)).toEqual(['idle', 'idle', 'idle', 'idle', 'idle']);
    mines.frame(frame(4, 'paid-1'), true, null);
    expect(mines.debug().map(m => m.action)).toEqual(['idle', 'idle', 'idle', 'idle', 'hidden']);
    // A seat an older server sent without interest draws none.
    mines.frame(frame(undefined), true, 's2'); expect(mines.debug().every(m => !m.shown)).toBe(true);
    mines.dispose();
  });
  it('takes the frame for the board on show: mine untouched, a scouted seat\'s interest without my income key, none from an older server', () => {
    const mine = frame(3, 'paid-1');
    expect(minesFrameFor(mine, null)).toBe(mine);
    expect(minesFrameFor(mine, undefined)).toBe(mine);
    expect(minesFrameFor(mine, { interest: 5 })).toEqual({ ...mine, goldMines: 5, goldMineIncomeKey: null });
    expect(minesFrameFor(mine, { interest: 0 })).toEqual({ ...mine, goldMines: 0, goldMineIncomeKey: null });
    const older = minesFrameFor(mine, {});
    expect(older.goldMines).toBeUndefined();
    expect(older.goldMineIncomeKey).toBeNull();
    expect(mine).toEqual(frame(3, 'paid-1'));
  });
  it('lights only black-emissive textured materials, through one clone per source, and leaves the template untouched', () => {
    const map = new Texture(), source = new MeshStandardMaterial({ map }), geometry = new BoxGeometry();
    const plain = new MeshStandardMaterial(), already = new MeshStandardMaterial({ map, emissive: '#ff0000' }), basic = new MeshBasicMaterial({ map });
    const scene = (material: Mesh['material']) => { const root = new Group(); root.add(new Mesh(geometry, material)); return root; };
    const clones = new Map(), first = scene(source), second = scene(source), others = scene([plain, already, basic]);
    lightGoldMine(first, clones); lightGoldMine(second, clones); lightGoldMine(others, clones);
    const lit = (first.children[0] as Mesh).material as MeshStandardMaterial;
    expect(lit).not.toBe(source);
    expect((second.children[0] as Mesh).material).toBe(lit);
    expect(lit.emissiveMap).toBe(map);
    expect(lit.emissive.getHexString()).toBe(GOLD_MINE_GLOW.color.slice(1));
    expect(lit.emissiveIntensity).toBe(GOLD_MINE_GLOW.intensity);
    expect(source.emissive.getHex()).toBe(0);
    expect(source.emissiveMap).toBeNull();
    expect((others.children[0] as Mesh).material).toEqual([plain, already, basic]);
  });
  it('disposes its glowing clones with the mines, never the shared template material', async () => {
    const parent = new Group(), source = new MeshStandardMaterial({ map: new Texture() }), sourceDispose = vi.fn();
    source.addEventListener('dispose', sourceDispose);
    const load = async (): Promise<ModelLease> => { const scene = new Group(); scene.add(new Mesh(new BoxGeometry(), source));
      return { scene, release: vi.fn(), placeholder: false, animationNames: {}, animations: [] }; };
    const mines = createGoldMines(parent, alignment, load), cloneDispose = vi.fn();
    mines.frame(frame(1), true, null); await flush();
    const lit = (parent.getObjectByName('render3d-gold-mine-Home1')!.children[0]!.children[0] as Mesh).material as MeshStandardMaterial;
    lit.addEventListener('dispose', cloneDispose);
    mines.dispose();
    expect(cloneDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
  });
  it('releases late loads after disposal and seeds a remount without replaying old income', async () => {
    const { mines, releases } = setup(); mines.frame(frame(5, 'old'), true, null); mines.dispose(); await flush();
    releases.forEach(release => expect(release).toHaveBeenCalledOnce());
    const next = setup(); next.mines.frame(frame(3, 'old'), true, null); await flush();
    expect(next.mines.debug().slice(0, 3).every(m => m.action === 'idle')).toBe(true); next.mines.dispose();
  });
});
