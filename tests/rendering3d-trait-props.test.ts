import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationClip, BoxGeometry, Group, Mesh, NumberKeyframeTrack, PerspectiveCamera, Scene } from 'three';
import { createTraitProps, CHEST_MODEL, CHEST_OPEN_EFFECT, FLASK_TAKE_EFFECT, type TraitPropsContext } from '../src/rendering/three-mode/trait-props';
import type { BoardFrame, BoardMechanics } from '../src/rendering/board-feed';
afterEach(() => vi.unstubAllGlobals());

import type { ModelLease, ParticleEffect } from '../src/rendering3d';

/** Synthetic counters only (no asset files, no source thresholds): the props read whatever the feed carries. */
const frame = (mechanics?: BoardMechanics): BoardFrame => ({
  rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces: [], fighting: false, dragging: null, ...(mechanics ? { mechanics } : {}),
});
const conquest = (stacks: number, opened: number, from = 0, next: number | null = 10) => ({ stacks, opened, from, next });
const shimmer = (value: number, next: number | null = 100, offer = false) => ({ value, next, offer });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(overrides: Partial<TraitPropsContext> = {}) {
  const scene = new Scene(), camera = new PerspectiveCamera(36, 800 / 600, 1, 5000);
  const props = createTraitProps({ scene, camera, effectScale: 0.44, loadModel: null, loadEffect: null, own: resource => resource, ...overrides });
  const step = (seconds: number, slices = 20) => { for (let i = 0; i < slices; i++) props.update(seconds / slices); };
  return { scene, props, step };
}

describe('3D trait props: Conqueror chest and Shimmer flask', () => {
  it('stays hidden without counters, with the banner right of the board and the flask left, off every cell', () => {
    const { scene, props } = setup();
    const board = frame();
    const [chestPoint, flaskPoint] = props.layout(board);
    props.frame(board);
    expect(props.debug().chest.shown).toBe(false);
    expect(props.debug().flask.shown).toBe(false);
    // Odd rows extend half a hex width beyond even rows; include each cell's half-width at the edges.
    const width = Math.sqrt(3) * board.hexRadius;
    const leftEdge = board.origin.x - width / 2;
    const rightEdge = board.origin.x + width * board.columns;
    expect(chestPoint!.x).toBeGreaterThan(rightEdge);
    expect(scene.getObjectByName('render3d-conqueror-chest')!.position.x).toBeGreaterThan(rightEdge);
    expect(flaskPoint!.x).toBeLessThan(leftEdge);
    expect(scene.getObjectByName('render3d-shimmer-flask')!.position.x).toBeLessThan(leftEdge);
  });

  it('glows toward the next chest and opens only when the opened count grows after mount', () => {
    const { props, step } = setup();
    props.frame(frame({ conquest: conquest(5, 2, 0, 10) }));
    expect(props.debug().chest).toMatchObject({ shown: true, glow: 0.5, opening: false, label: '5/10' });
    expect(props.debug().bursts).toBe(0);
    props.frame(frame({ conquest: conquest(12, 3, 10, 20) }));
    expect(props.debug().chest.opening).toBe(true);
    expect(props.debug().bursts).toBe(1);
    step(0.5);
    expect(props.debug().chest.rise).toBeGreaterThan(0);
    expect(props.debug().chest.label).toBe('12/20');
    step(3);
    props.frame(frame({ conquest: conquest(12, 3, 10, 20) }));
    expect(props.debug().chest.opening).toBe(false);
    step(2);
    expect(props.debug().chest.rise).toBe(0);
    expect(props.debug().bursts).toBe(0);
  });

  it('keeps the total visible with no glow once every chest is open', () => {
    const { props } = setup();
    props.frame(frame({ conquest: conquest(900, 15, 800, null) }));
    expect(props.debug().chest.glow).toBe(0);
    expect(props.debug().chest).toMatchObject({ shown: true, label: '900', opening: false, rise: 0 });
  });

  it('fills to shimmer / next market, bubbles on an offer, and drains only when an accepted offer clears it', async () => {
    const loaded: string[] = [];
    const loadEffect = (id: string) => { loaded.push(id); return Promise.resolve({ object: new Group(), finished: false, update() {}, dispose() {} } as unknown as ParticleEffect); };
    const { props, step } = setup({ loadEffect });
    props.frame(frame({ shimmer: shimmer(150, 200) }));
    expect(props.debug().flask).toMatchObject({ shown: true, fill: 0.75, offer: false });
    props.frame(frame({ shimmer: shimmer(200, 300, true) }));
    expect(props.debug().flask.offer).toBe(true);
    // A skip keeps the shimmer: no take effect.
    props.frame(frame({ shimmer: shimmer(200, 300, false) }));
    props.frame(frame({ shimmer: shimmer(300, 400, true) }));
    props.frame(frame({ shimmer: shimmer(0, 100, false) }));
    await flush();
    expect(loaded.filter(id => id === FLASK_TAKE_EFFECT)).toHaveLength(1);
    step(4);
    expect(props.debug().flask.fill).toBeLessThan(0.05);
    expect(loaded).not.toContain(CHEST_OPEN_EFFECT);
  });

  it('never replays an opening that happened before mount, and releases everything on dispose', () => {
    const { scene, props } = setup();
    props.frame(frame({ conquest: conquest(30, 4), shimmer: shimmer(0, 100, true) }));
    expect(props.debug().bursts).toBe(0);
    props.dispose();
    expect(scene.getObjectByName('render3d-conqueror-chest')).toBeUndefined();
    expect(scene.getObjectByName('render3d-shimmer-flask')).toBeUndefined();
  });
});

describe('3D trait props with extracted models (idle only, no opening clip)', () => {
  const lease = (clips: AnimationClip[]) => {
    const scene = new Group(); scene.add(new Mesh(new BoxGeometry(10, 40, 10)));
    let released = 0;
    return { lease: { scene, animations: clips, placeholder: false, animationNames: {}, release() { released++; } } as unknown as ModelLease, released: () => released };
  };

  it('opens a banner model with the open effect and a rise, never a lid, and settles without errors', async () => {
    const idle = new AnimationClip('Idle', 1, [new NumberKeyframeTrack('.position[y]', [0, 1], [0, 1])]);
    const chest = lease([idle]), flask = lease([]);
    const loaded: string[] = [];
    const loadModel = (id: string) => Promise.resolve(id === CHEST_MODEL ? chest.lease : flask.lease);
    const loadEffect = (id: string) => { loaded.push(id); return Promise.resolve({ object: new Group(), finished: false, update() {}, dispose() {} } as unknown as ParticleEffect); };
    const { props, step } = setup({ loadModel, loadEffect });
    props.frame(frame({ conquest: conquest(5, 1), shimmer: shimmer(40, 100) }));
    await flush();
    expect(props.debug().chest).toMatchObject({ model: true, label: '5/10' });
    expect(props.debug().flask.model).toBe(true);
    step(1);
    props.frame(frame({ conquest: conquest(12, 2, 10, 20), shimmer: shimmer(100, 200, true) }));
    await flush();
    expect(loaded).toContain(CHEST_OPEN_EFFECT);
    step(0.8);
    expect(props.debug().chest.rise).toBeGreaterThan(1);
    step(3);
    expect(props.debug().chest.rise).toBe(0);
    expect(props.debug().chest.opening).toBe(false);
    props.dispose();
    expect(chest.released()).toBe(1);
    expect(flask.released()).toBe(1);
  });

  it('keeps the stand-in when the manifest has no model', async () => {
    const { props } = setup({ loadModel: () => Promise.reject(new Error('unknown-model')) });
    props.frame(frame({ conquest: conquest(5, 1) }));
    await flush();
    expect(props.debug().chest.model).toBe(false);
  });
});

it('billboards the total above either flag, redraws only on change, and releases the label resources', async () => {
  const draw = { clearRect: vi.fn(), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn() };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => draw }) });
  let resolve!: (lease: ModelLease) => void;
  const { scene, props } = setup({ loadModel: () => new Promise(r => { resolve = r; }) });
  props.frame(frame({ conquest: conquest(7, 1) }));
  const sprite = scene.getObjectByName('render3d-conqueror-stacks') as import('three').Sprite;
  expect(sprite.isSprite).toBe(true);
  expect(sprite.material.depthTest).toBe(false); expect(sprite.material.depthWrite).toBe(false);
  expect(sprite.renderOrder).toBeGreaterThan(1000);
  const standHeight = sprite.position.y;
  expect(standHeight).toBeGreaterThan(70);
  const texture = sprite.material.map!, version = texture.version;
  props.frame(frame({ conquest: conquest(7, 1) })); expect(texture.version).toBe(version);
  props.frame(frame({ conquest: conquest(12, 2) })); expect(texture.version).toBeGreaterThan(version);
  expect(draw.fillText).toHaveBeenLastCalledWith('12/10', 96, 42, 174);
  const body = new Group(); body.add(new Mesh(new BoxGeometry(10, 30, 10)));
  resolve({ scene: body, animations: [], placeholder: false, release() {} } as unknown as ModelLease);
  await flush(); expect(sprite.position.y).toBeGreaterThan(standHeight);
  props.update(0.5); expect(props.debug().chest.rise).toBeGreaterThan(0);
  expect(sprite.position.y).toBe(92);
  const dropTexture = vi.spyOn(texture, 'dispose'), dropMaterial = vi.spyOn(sprite.material, 'dispose');
  props.dispose(); expect(dropTexture).toHaveBeenCalledOnce(); expect(dropMaterial).toHaveBeenCalledOnce();
});
