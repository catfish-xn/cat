import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, Group, NumberKeyframeTrack } from 'three';
import { createGoldMines, goldMineActions, goldMinePlacement, GOLD_MINE_HOME, type GoldMineAlignment } from '../src/rendering/three-mode/gold-mines';
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
describe('owner-only default arena gold mines', () => {
  it('seeds without spawn, raises lowest first, sinks highest first, and gives count changes priority over income', () => {
    expect(goldMineActions(null, 3, true)).toEqual(['idle', 'idle', 'idle', 'hidden', 'hidden']);
    expect(goldMineActions(2, 4, true)).toEqual(['gain', 'gain', 'spawn', 'spawn', null]);
    expect(goldMineActions(5, 2, false)).toEqual([null, null, 'death', 'death', 'death']);
    expect(goldMineActions(3, 3, false)).toEqual([null, null, null, null, null]);
  });
  it.each([true, false])('maps original locators through reflection=%s and live-grid scaling once', reflectX => {
    const board = { ...frame(), hexRadius: 68, origin: { x: 100, y: 200 } };
    const placed = goldMinePlacement({ ...alignment, reflectX }, board);
    expect(placed.scale.toArray()).toEqual([reflectX ? -4 : 4, 6, -8]);
    GOLD_MINE_HOME.forEach(([x, y, z], i) => {
      expect(placed.points[i]!.toArray()).toEqual([50 + (reflectX ? -4 : 4) * x, 40 + 6 * y, 160 - 8 * z]);
    });
    expect(placed.points[0]!.z).toBeGreaterThan(placed.points[4]!.z);
  });
  it('uses independent leases/mixers, interrupts death with spawn, deduplicates income and returns to idle/hide', async () => {
    const { mines, scenes, releases } = setup();
    mines.frame(frame(3, 'paid-1'), true, false); await flush();
    expect(mines.debug().map(m => m.action)).toEqual(['idle', 'idle', 'idle', 'hidden', 'hidden']);
    mines.frame(frame(2, 'paid-1'), true, false); mines.update(0.4);
    expect(mines.debug()[2]!.action).toBe('death');
    mines.frame(frame(3, 'paid-1'), true, false); mines.update(0.2);
    expect(mines.debug()[2]!.action).toBe('spawn');
    expect(scenes[2]!.position.y).toBeCloseTo(2);
    expect(scenes[0]!.position.y).toBeCloseTo(6);
    mines.update(1); mines.frame(frame(3, 'paid-2'), true, false);
    expect(mines.debug().slice(0, 3).every(m => m.action === 'gain')).toBe(true);
    mines.update(0.4); mines.frame(frame(3, 'paid-2'), true, false); mines.update(0.7);
    expect(mines.debug().slice(0, 3).every(m => m.action === 'idle')).toBe(true);
    mines.frame(frame(0, 'paid-2'), true, false); mines.update(1.1);
    expect(mines.debug().every(m => !m.shown)).toBe(true);
    mines.dispose(); releases.forEach(release => expect(release).toHaveBeenCalledOnce());
  });
  it('draws nothing offline, before arena readiness, while scouting, or with missing/placeholder models', async () => {
    const { mines, load } = setup();
    mines.frame(frame(), true, false); mines.frame(frame(5), false, false); expect(load).not.toHaveBeenCalled();
    mines.frame(frame(5), true, true); await flush(); expect(mines.debug().every(m => !m.shown)).toBe(true);
    mines.away(false); expect(mines.debug().every(m => m.shown)).toBe(true);
    mines.frame(frame(5), false, false); mines.away(false); expect(mines.debug().every(m => !m.shown)).toBe(true);
    mines.dispose();
    const empty = setup(true); empty.mines.frame(frame(5), true, false); await flush();
    expect(empty.mines.debug().every(m => !m.shown)).toBe(true); empty.releases.forEach(release => expect(release).toHaveBeenCalledOnce()); empty.mines.dispose();
    const missing = createGoldMines(new Group(), alignment, () => Promise.reject(Error('missing')));
    missing.frame(frame(5), true, false); await flush(); expect(missing.debug().every(m => !m.shown)).toBe(true); missing.dispose();
  });
  it('releases late loads after disposal and seeds a remount without replaying old income', async () => {
    const { mines, releases } = setup(); mines.frame(frame(5, 'old'), true, false); mines.dispose(); await flush();
    releases.forEach(release => expect(release).toHaveBeenCalledOnce());
    const next = setup(); next.mines.frame(frame(3, 'old'), true, false); await flush();
    expect(next.mines.debug().slice(0, 3).every(m => m.action === 'idle')).toBe(true); next.mines.dispose();
  });
});
