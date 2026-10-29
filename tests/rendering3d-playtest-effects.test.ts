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
  it('reuses ignition and tar once, leaving flight and area to the procedural effects', () => {
    const effects = ['cas_r_canister', 'cas_l_canister', 'cas_center', 'mis', 'mis_child_01', 'tar', 'aoe'].map(id => ({ id: prefix + id }));
    const plan = planActionEffects('renata', 'cast', effects, {});
    expect(plan.map(e => e.id)).toEqual(['cas_center', 'tar'].map(id => prefix + id));
    expect(plan.filter(e => e.playback.anchor === 'projectile')).toEqual([]);
    expect(plan.filter(e => e.playback.anchor === 'source').map(e => e.playback.bone)).toEqual(['C_Canister']);
    for (const { playback: spec } of plan.filter(e => e.playback.anchor === 'source'))
      expect(spec.delay + spec.maxDuration).toBeCloseTo(.3);
    expect(plan.find(e => e.id === prefix + 'tar')?.playback).toEqual({ anchor: 'target', delay: .9, maxDuration: .35 });
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
  let saved: ReturnType<typeof vi.fn>, loadFx: ReturnType<typeof vi.fn>;
  const prefix = 'renata_tft13_renataglasc_base_e_';
  const effectIds = ['cas_r_canister', 'cas_l_canister', 'cas_center', 'mis', 'mis_child_01', 'tar', 'aoe'].map(id => prefix + id);
  const bodies = new Map<string, import('three').Group>();

  beforeEach(async () => {
    vi.resetModules();
    now = 0; nextId = 0; callbacks = new Map(); bodies.clear();
    const canvas = new Canvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++nextId, callback); return nextId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ schemaVersion: 1, models: { renata: { path: 'renata.glb' } },
      effects: Object.fromEntries(effectIds.map(id => [id, { path: `effects/${id}.json` }])), actionEffects: { renata: { cast: effectIds } } })));
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
      for (const name of ['R_Canister', 'L_Canister', 'C_Canister']) { const bone = new three.Group(); bone.name = name; body.add(bone); }
      bodies.set(id, body);
      const lease: ModelLease = { scene: body, placeholder: false, animations: [new three.AnimationClip('idle', 1, [])], animationNames: {}, release: () => body.removeFromParent() };
      return lease;
    });
    const tabletop = await import('../src/rendering/three-mode/tabletop');
    const createTabletop = tabletop.createTabletop;
    vi.spyOn(tabletop, 'createTabletop').mockImplementation(ctx => {
      const result = createTabletop(ctx); saved = vi.spyOn(result, 'saved'); return result;
    });
    const library = await import('../src/rendering/three-mode/effect-library');
    const createLibrary = library.createEffectLibrary;
    vi.spyOn(library, 'createEffectLibrary').mockImplementation((...args) => {
      const result = createLibrary(...args);
      loadFx = vi.spyOn(result, 'load').mockImplementation(async id => {
        const fx = new core.ParticleEffect({ schemaVersion: 2, limits: { maxParticles: 1, maxDuration: 1 }, emitters: [] }); fx.object.name = id;
        vi.spyOn(fx, 'finished', 'get').mockReturnValue(false); return fx;
      });
      return result;
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

  it('plays Renata ground impact without assets, shows only receipted shields and clears combat effects at a phase change', async () => {
    loadFx.mockRejectedValue(new Error('missing-test-effect'));
    const me = piece({ id: 'me', definitionId: 'renata' }), ally = piece({ id: 'ally', definitionId: 'sett' });
    const foe = piece({ id: 'foe', definitionId: 'garen', team: 'enemy', x: 250 });
    await publish([me, ally, foe]);
    const scene = bodies.get('renata')!.parent!.parent!;
    cast('me', 'foe');
    expect(bodies.get('sett')!.parent!.getObjectByName('renata-receipt-shield')).toBeUndefined();
    listener.events([{ type: 'shieldLayerChanged', tick: 1, eventSeq: 2, reason: 'granted', remaining: 10, targetId: 'ally',
      key: JSON.stringify(['combat', 'me', 'ability', 'renata-ability', 'me', 0, null, 'ally', 'source']) }]);
    expect(bodies.get('sett')!.parent!.getObjectByName('renata-receipt-shield')).toBeDefined();
    advance(890); expect(scene.getObjectByName('renata-reference-burst')).toBeUndefined();
    advance(30); expect(scene.getObjectByName('renata-reference-burst')).toBeDefined();
    expect(bodies.get('sett')!.parent!.getObjectByName('renata-receipt-shield')).toBeUndefined();
    await publish([me, ally, foe], false);
    expect(scene.getObjectByName('renata-reference-burst')).toBeUndefined();
    advance(1200); expect(scene.getObjectByName('renata-reference-burst')).toBeUndefined();
  });

  it('actually plays central ignition and target assets beside one missile/area and clears them on phase change', async () => {
    await publish([piece({ id: 'me', definitionId: 'renata' }), piece({ id: 'foe', definitionId: 'sett', team: 'enemy', x: 250 })]);
    const scene = bodies.get('renata')!.parent!.parent!;
    // Renata is a skill-feel sample (skill-feel.ts): the ignition waits for the 0.25 s charge.
    cast('me', 'foe'); advance(300); for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(loadFx.mock.calls.map(([id]) => id)).toEqual([prefix + 'cas_center']);
    for (const id of [prefix + 'cas_center']) expect(scene.getObjectByName(id)).toBeDefined();
    advance(300); await Promise.resolve();
    for (const id of [prefix + 'cas_center']) expect(scene.getObjectByName(id)).toBeUndefined();
    expect(scene.children.filter(o => o.name === 'renata-reference-missile')).toHaveLength(1);
    // Moving the target must not split the textured impact from the procedural endpoint.
    await publish([piece({ id: 'me', definitionId: 'renata' }), piece({ id: 'foe', definitionId: 'sett', team: 'enemy', x: 350 })]);
    advance(320); for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(loadFx.mock.calls.map(([id]) => id)).toEqual([prefix + 'cas_center', prefix + 'tar']);
    const tar = scene.getObjectByName(prefix + 'tar')!, area = scene.getObjectByName('renata-reference-burst')!;
    expect(tar).toBeDefined(); expect(area).toBeDefined(); expect(tar.position.equals(area.position)).toBe(true);
    await publish([], false);
    expect(scene.getObjectByName(prefix + 'tar')).toBeUndefined();
    expect(scene.getObjectByName('renata-reference-burst')).toBeUndefined();
    advance(1200); expect(loadFx).toHaveBeenCalledTimes(2);
  });

  it('plays the Mel legend save exactly once at gold, keeping other sources immediate', async () => {
    await publish([piece({ id: 'me', definitionId: 'mel' })]);
    listener.playerSaved!({ type: 'playerSaved', source: 'mel', battleId: 'save' });
    expect(saved).not.toHaveBeenCalled(); advance(640); expect(saved).not.toHaveBeenCalled();
    advance(32); expect(saved).toHaveBeenCalledTimes(1);
    advance(1800); expect(saved).toHaveBeenCalledTimes(1);
    // Exercise forward-compatible non-Mel receipts at the runtime boundary.
    listener.playerSaved!({ type: 'playerSaved', source: 'other', battleId: 'other' } as unknown as Parameters<NonNullable<BoardFeedListener['playerSaved']>>[0]);
    expect(saved).toHaveBeenCalledTimes(2);
    advance(2100); expect(saved).toHaveBeenCalledTimes(2);
  });

  it('starts Mel only from the save feed, survives settlement phase changes, and expires in 2 seconds', async () => {
    const me = piece({ id: 'me', definitionId: 'mel' });
    await publish([me]); const scene = bodies.get('mel')!.parent!.parent!;
    cast('me', 'me'); advance(1000);
    expect(scene.getObjectByName('mel-reference-burst')).toBeUndefined();
    listener.playerSaved!({ type: 'playerSaved', source: 'mel', battleId: 'b' });
    expect(scene.getObjectByName('mel-reference-burst')).toBeDefined();
    await publish([me], false); advance(1700);
    expect(scene.getObjectByName('mel-reference-burst')).toBeDefined();
    advance(310); expect(scene.getObjectByName('mel-reference-burst')).toBeUndefined();
  });

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
  it('routes explicit merges into flying models and changes the real star row at impact across settlement', async () => {
    const a = piece({ id: 'a', definitionId: 'renata', x: 200, y: 200 });
    await publish([a, piece({ id: 'b', definitionId: 'renata', x: 0, y: 200 }), piece({ id: 'c', definitionId: 'renata', x: 100, y: 200 })]);
    const scene = bodies.get('renata')!.parent!.parent!;
    const row = scene.children.find(object => object.position.x === 200 && object.children.length === 1
      && object.children[0] instanceof three.Mesh && object.children[0].geometry instanceof three.ShapeGeometry)!;
    expect(row.children).toHaveLength(1);
    listener.merges!([{ definitionId: 'renata', fromStar: 1, toStar: 2, to: { id: 'a', x: 200, y: 200 },
      from: [{ id: 'b', x: 0, y: 200 }, { id: 'c', x: 100, y: 200 }] }]);
    // The authoritative roster is already merged; the renderer's settlement transition must keep the visual alive.
    await publish([{ ...a, starLevel: 2 }], false);
    expect(scene.getObjectByName('render3d-star-up')).toBeDefined();
    expect(row.children).toHaveLength(1);
    advance(150);
    const copies = scene.getObjectByName('render3d-star-up')!.children.filter(object => object instanceof three.Group);
    expect(copies).toHaveLength(2); expect(copies.every(object => object.visible && object.position.x > 0)).toBe(true);
    advance(160); expect(row.children).toHaveLength(2);
    expect(scene.getObjectByName('merge-flash')?.visible).toBe(true);
    advance(400); expect(scene.getObjectByName('render3d-star-up')).toBeUndefined(); expect(row.children).toHaveLength(2);
    // A state refresh with no event is static: it cannot invent/replay another animation.
    await publish([{ ...a, starLevel: 2 }], false);
    expect(scene.getObjectByName('render3d-star-up')).toBeUndefined();
  });

});
