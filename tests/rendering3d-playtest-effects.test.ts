import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, BoardPiece } from '../src/rendering/board-feed';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { ModelLease } from '../src/rendering3d';
import { CAST_LUNGE, lungeReach } from '../src/rendering/three-mode/cast-lunge';
import { planActionEffects, type EffectPlayback } from '../src/rendering/three-mode/action-effect-plan';

describe('10-22 reviewed action staging', () => {
  const prefix = 'renata_tft13_renataglasc_base_e_';
  it('launches two real child missiles from the canisters and lands them with the target flash', () => {
    const effects = ['cas_r_canister', 'cas_l_canister', 'cas_center', 'mis', 'mis_child_01', 'tar', 'aoe'].map(id => ({ id: prefix + id }));
    const impact: EffectPlayback = { anchor: 'target', delay: 0.9, maxDuration: 1 };
    const plan = planActionEffects('renata', 'cast', effects, { [prefix + 'tar']: impact });
    expect(plan).toHaveLength(7);
    expect(plan.some(e => e.id === prefix + 'mis')).toBe(false);
    const missiles = plan.filter(e => e.playback.anchor === 'projectile');
    expect(missiles.map(e => e.playback.bone)).toEqual(['L_Canister', 'R_Canister']);
    expect(missiles.every(e => Math.abs(e.playback.delay + e.playback.maxDuration - impact.delay) < 1e-9)).toBe(true);
    expect(plan.find(e => e.id === prefix + 'tar')?.playback).toEqual(impact);
  });
  it('preserves unrelated and older asset bindings without guessing new effect ids', () => {
    for (const [unit, action] of [['renata', 'attack'], ['other', 'cast'], ['renata', 'cast']] as const) {
      const spec: EffectPlayback = { anchor: 'target', delay: 0.2, maxDuration: 0.5 };
      expect(planActionEffects(unit, action, [{ id: 'custom' }], { custom: spec })).toEqual([{ id: 'custom', playback: spec }]);
    }
  });
});

describe('10-23 Ambessa cast lunge (presentation only)', () => {
  it('reaches out eased, holds and is back on the cell when the lunge ends', () => {
    const { seconds } = CAST_LUNGE.ambessa!;
    expect(seconds).toBeGreaterThanOrEqual(0.5); expect(seconds).toBeLessThanOrEqual(0.6);
    expect(lungeReach(0, seconds)).toBe(0);
    expect(lungeReach(seconds * 0.15, seconds)).toBeGreaterThan(0.5);
    expect(lungeReach(seconds * 0.45, seconds)).toBe(1);
    expect(lungeReach(seconds * 0.9, seconds)).toBeLessThan(0.2);
    expect(lungeReach(seconds, seconds)).toBe(0);
    expect(CAST_LUNGE.renata).toBeUndefined();
  });

  class Canvas {
    className = ''; style = { cursor: '' };
    addEventListener(): void {} removeEventListener(): void {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
    hasPointerCapture(): boolean { return false; }
    remove(): void {}
  }
  const piece = (changes: Partial<BoardPiece>): BoardPiece => ({
    id: 'unit', definitionId: 'model', team: 'player', starLevel: 1, x: 150, y: 130, alive: true, visible: true, ...changes,
  });
  const frame = (pieces: readonly BoardPiece[], fighting: boolean): BoardFrame => ({
    rows: 4, columns: 4, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], pieces, fighting, dragging: null,
  });
  let three: typeof import('three'), core: typeof import('../src/rendering3d');
  let mounted: Renderer3d | undefined, listener: BoardFeedListener, now: number, nextId: number;
  let callbacks: Map<number, FrameRequestCallback>;
  const bodies = new Map<string, import('three').Group>();

  beforeEach(async () => {
    vi.resetModules();
    now = 0; nextId = 0; callbacks = new Map(); bodies.clear();
    const canvas = new Canvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++nextId, callback); return nextId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ schemaVersion: 1, models: {} })));
    vi.doMock('three', async importOriginal => ({
      ...await importOriginal<typeof import('three')>(),
      WebGLRenderer: class {
        domElement = canvas;
        setPixelRatio(): void {} setSize(): void {}
        render(scene: Scene, camera: PerspectiveCamera): void { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); }
        dispose(): void {} forceContextLoss(): void {}
      },
    }));
    three = await import('three'); core = await import('../src/rendering3d');
    vi.spyOn(core.ModelCache.prototype, 'load').mockImplementation(async (id: string) => {
      const body = new three.Group(); body.add(new three.Mesh(new three.BoxGeometry(20, 46, 20)));
      bodies.set(id, body);
      const lease: ModelLease = { scene: body, placeholder: false, animations: [new three.AnimationClip('idle', 1, [])], animationNames: {}, release: () => body.removeFromParent() };
      return lease;
    });
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    const controls = { hover: vi.fn(), select: vi.fn(), dragStart: vi.fn(() => false), dragMove: vi.fn(() => ({ allowed: false })), dragEnd: vi.fn(), dragCancel: vi.fn() } satisfies BoardControls;
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => controls });
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: '/memory/' });
    advance(1);
  });
  afterEach(() => {
    mounted?.dispose(); mounted = undefined;
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.doUnmock('three'); vi.resetModules();
  });
  function advance(milliseconds: number): void {
    while (milliseconds > 0) {
      const step = Math.min(milliseconds, 16); now += step; milliseconds -= step;
      const pending = [...callbacks.values()]; callbacks.clear();
      for (const callback of pending) callback(now);
    }
  }
  async function publish(pieces: readonly BoardPiece[], fighting = true): Promise<void> {
    listener.frame(frame(pieces, fighting));
    for (let i = 0; i < 4; i++) await Promise.resolve();
    advance(1);
  }
  /** World (x, z) of the drawn body (by definitionId) minus its root: the presentation offset alone. */
  const offsetOf = (id: string) => {
    const body = bodies.get(id)!, root = body.parent!;
    root.updateMatrixWorld(true);
    const at = body.getWorldPosition(new three.Vector3()), base = root.getWorldPosition(new three.Vector3());
    return { x: at.x - base.x, z: at.z - base.z, root: { x: base.x, z: base.z } };
  };
  const cast = (sourceId: string, targetId: string, tick = 1) =>
    listener.events([{ type: 'cast', tick, eventSeq: tick, sourceId, targetIds: [targetId] } as unknown as DisplayCombatEvent]);

  it('dashes Ambessa\'s model 70% toward the target and back, leaving the root on its cell; others stay put', async () => {
    const me = piece({ id: 'me', definitionId: 'ambessa', x: 150, y: 200 });
    const other = piece({ id: 'other', definitionId: 'renata', x: 150, y: 100 });
    const foe = piece({ id: 'foe', definitionId: 'garen', team: 'enemy', x: 250, y: 200 });
    await publish([me, other, foe]);
    expect(Math.abs(offsetOf('ambessa').x)).toBeLessThan(1e-6);
    const rest = offsetOf('ambessa');

    cast('me', 'foe'); cast('other', 'foe', 2);
    advance(250); // inside the hold
    const out = offsetOf('ambessa');
    expect(out.x).toBeCloseTo(100 * CAST_LUNGE.ambessa!.ratio, 0);
    expect(Math.abs(out.z)).toBeLessThan(1);
    expect(out.root.x).toBeCloseTo(rest.root.x, 6); expect(out.root.z).toBeCloseTo(rest.root.z, 6);
    expect(Math.hypot(offsetOf('renata').x, offsetOf('renata').z)).toBeLessThan(1e-6);

    advance(400); // past 0.55 s
    const back = offsetOf('ambessa');
    expect(Math.hypot(back.x, back.z)).toBeLessThan(1e-6);
  });

  it('snaps back at once on a real movement event or a new battle phase', async () => {
    const me = piece({ id: 'me', definitionId: 'ambessa', x: 150, y: 200 });
    const foe = piece({ id: 'foe', definitionId: 'garen', team: 'enemy', x: 250, y: 200 });
    await publish([me, foe]);
    cast('me', 'foe'); advance(200);
    expect(offsetOf('ambessa').x).toBeGreaterThan(30);
    listener.events([{ type: 'movement', tick: 2, eventSeq: 2, unitId: 'me', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } } as unknown as DisplayCombatEvent]);
    expect(Math.hypot(offsetOf('ambessa').x, offsetOf('ambessa').z)).toBeLessThan(1e-6);

    cast('me', 'foe', 3); advance(200);
    expect(offsetOf('ambessa').x).toBeGreaterThan(30);
    await publish([me, foe], false);
    expect(Math.hypot(offsetOf('ambessa').x, offsetOf('ambessa').z)).toBeLessThan(1e-6);
    advance(600);
    expect(Math.hypot(offsetOf('ambessa').x, offsetOf('ambessa').z)).toBeLessThan(1e-6);
  });
});
