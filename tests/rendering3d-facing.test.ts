import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Group, PerspectiveCamera, Scene } from 'three';
import type { BoardControls, BoardFeedListener, BoardFrame, BoardPiece } from '../src/rendering/board-feed';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { ModelLease } from '../src/rendering3d';
import { desiredHeading, headingToward, restHeading, turnToward } from '../src/rendering/three-mode/unit-facing';

const near = (angle: number, expected: number) => {
  const gap = Math.atan2(Math.sin(angle - expected), Math.cos(angle - expected));
  expect(Math.abs(gap)).toBeLessThan(0.02);
};

describe('unit facing rule', () => {
  const base = { current: 0, team: 'player' as const, alive: true, fighting: true, position: { x: 0, z: 0 }, destination: { x: 0, z: 0 }, target: null };

  it('looks where it moves, then at its target, and keeps its heading with neither', () => {
    near(desiredHeading({ ...base, destination: { x: 10, z: 0 }, target: { x: 0, z: -10 } }), Math.PI / 2);
    near(desiredHeading({ ...base, target: { x: 0, z: -10 } }), Math.PI);
    near(desiredHeading({ ...base, target: { x: -10, z: 0 } }), -Math.PI / 2);
    expect(desiredHeading({ ...base, current: 1.3 })).toBe(1.3);
    expect(desiredHeading({ ...base, current: 1.3, target: { x: 0.1, z: 0 } })).toBe(1.3); // standing on it: no heading
  });

  it('a dead piece never turns; outside combat a standing piece rests facing the other side', () => {
    expect(desiredHeading({ ...base, current: 0.7, alive: false, destination: { x: 10, z: 0 }, target: { x: 0, z: 10 } })).toBe(0.7);
    near(desiredHeading({ ...base, fighting: false, target: { x: 10, z: 0 } }), restHeading('player'));
    near(desiredHeading({ ...base, team: 'enemy', fighting: false, current: 2 }), restHeading('enemy'));
    expect(headingToward({ x: 0, z: 0 }, { x: 0.2, z: 0.2 })).toBeNull();
  });

  it('turns smoothly the short way round and settles on the heading', () => {
    const first = turnToward(0, Math.PI / 2, 1 / 60);
    expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(Math.PI / 4); // no jump in one frame
    // From just under +π to just over -π is a small turn across the seam, not a full sweep back through 0.
    const across = turnToward(Math.PI - 0.1, -Math.PI + 0.1, 1 / 60);
    expect(Math.abs(across)).toBeGreaterThan(Math.PI - 0.1);
    let angle = 0;
    for (let frame = 0; frame < 30; frame++) angle = turnToward(angle, -2, 1 / 60);
    near(angle, -2);
    expect(turnToward(0.5, 2, 0)).toBe(0.5);
  });
});

/** Only the GPU/DOM and asset I/O are substituted, as in rendering3d-death.test.ts. */
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

describe('mounted 3D pieces turn toward their combat target', () => {
  let three: typeof import('three'), core: typeof import('../src/rendering3d');
  let mounted: Renderer3d | undefined, listener: BoardFeedListener, now: number, nextId: number;
  let callbacks: Map<number, FrameRequestCallback>;

  beforeEach(async () => {
    vi.resetModules();
    now = 0; nextId = 0; callbacks = new Map();
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
    vi.spyOn(core.ModelCache.prototype, 'load').mockImplementation(async () => {
      const body = new three.Group(); body.add(new three.Mesh(new three.BoxGeometry(20, 46, 20)));
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
    await Promise.resolve(); await Promise.resolve();
    advance(1);
  }

  it('faces the unit it attacks with a gradual turn, keeps that heading once the target dies, and rests after combat', async () => {
    const me = piece({ id: 'me', x: 150, y: 200 }), foe = piece({ id: 'foe', team: 'enemy', x: 250, y: 200 });
    await publish([me, foe]);
    const loads = vi.mocked(core.ModelCache.prototype.load).mock.results;
    const [mine] = await Promise.all(loads.map(result => result.value as Promise<ModelLease>));
    const root = () => mine.scene.parent as Group;
    near(root().rotation.y, restHeading('player')); // created already resting, no spin-in

    listener.events([{ type: 'attack', tick: 1, eventSeq: 0, attackerId: 'me', targetId: 'foe' } as unknown as DisplayCombatEvent]);
    advance(16);
    const partway = root().rotation.y;
    expect(Math.abs(Math.atan2(Math.sin(partway - Math.PI / 2), Math.cos(partway - Math.PI / 2)))).toBeGreaterThan(0.3); // not a jump
    advance(400);
    near(root().rotation.y, Math.PI / 2); // foe is at +x

    await publish([me, { ...foe, alive: false }]);
    advance(400);
    near(root().rotation.y, Math.PI / 2); // no target left: keep the heading

    await publish([me, { ...foe, alive: false }], false);
    advance(600);
    near(root().rotation.y, restHeading('player'));
  });
});
