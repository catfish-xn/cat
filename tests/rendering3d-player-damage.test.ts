import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene, Sprite, Vector3 } from 'three';
import { createPlayerDamage } from '../src/rendering/three-mode/player-damage';
import { createTabletop } from '../src/rendering/three-mode/tabletop';
import type { ParticleEffect } from '../src/rendering3d';
import type { BoardFrame } from '../src/rendering/board-feed';
import type { PvpDamage } from '../src/presentation/pvp-damage';
import { UnitActionState } from '../src/rendering3d/animation-state';
const hit = (target: PvpDamage['target'] = 'opponent'): PvpDamage => ({ key: 'round:4:2-1', target, damage: 3,
  sources: [{ col: 2, row: 3 }, { col: 4, row: 2 }] });
const frame: BoardFrame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces: [], fighting: false, dragging: null };
const effect = () => {
  const object = new Group();
  return { object, finished: false, update: vi.fn(), dispose: vi.fn(() => object.removeFromParent()) } as unknown as ParticleEffect;
};
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function setup(loadEffect: ((id: string, seconds: number) => Promise<ParticleEffect>) | null = null) {
  const scene = new Scene(), camera = new PerspectiveCamera(), impact = vi.fn(), at = new Vector3(500, 30, 600);
  let clock = 0;
  const fx = createPlayerDamage({ scene, camera, effectScale: 0.44, loadEffect, now: () => clock });
  return { fx, scene, impact, at, jump: (ms: number) => { clock = ms; } };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('3D PvP survivor damage volley', () => {
  it('pops the exact -N above the target only on impact, then releases its text texture/material', () => {
    const pen = { strokeText: vi.fn(), fillText: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => pen }) });
    const { fx, scene, at, impact } = setup();
    fx.play(hit(), [new Vector3()], () => at.clone(), impact); fx.update(0.7);
    expect(pen.fillText).not.toHaveBeenCalled(); fx.update(0.11);
    expect(pen.fillText).toHaveBeenCalledExactlyOnceWith('-3', 128, 64);
    const sprite = scene.getObjectByName('render3d-player-damage-number') as Sprite;
    expect(sprite.userData.damage).toBe(3); expect(sprite.position.y).toBeGreaterThan(at.y);
    const texture = vi.spyOn(sprite.material.map!, 'dispose'), material = vi.spyOn(sprite.material, 'dispose');
    fx.dispose(); fx.dispose(); expect(texture).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
  it('launches one bolt per survivor without an eight-bolt cap; the one exact total appears after the last landing', () => {
    const { fx, scene, impact, at } = setup();
    const sources = Array.from({ length: 12 }, (_, index) => new Vector3(index * 30, 60, 90));
    fx.play(hit(), sources, () => at.clone(), impact); fx.update(0.1);
    expect(fx.debug()).toMatchObject({ count: 12, damage: 3, landed: 0, number: false, target: 'opponent' });
    const bolts = scene.children.filter(node => node.name === 'render3d-player-damage-bolt'); expect(bolts).toHaveLength(12);
    expect(bolts[0]!.children[0]!.position.x).toBeGreaterThan(0); expect(impact).not.toHaveBeenCalled();
    fx.update(0.75); expect(fx.debug()!.landed).toBeLessThan(12); expect(impact).not.toHaveBeenCalled();
    fx.update(0.7); expect(fx.debug()).toMatchObject({ landed: 12, number: true }); expect(impact).toHaveBeenCalledOnce();
    fx.update(1.4); expect(fx.debug()).toBeNull(); expect(scene.children).toHaveLength(0); fx.dispose();
  });
  it('uses original travel/impact particles, follows a moving target and releases every loaded effect', async () => {
    const effects: ParticleEffect[] = [], ids: string[] = [];
    const { fx, scene, impact, at } = setup(async id => { ids.push(id); const fx = effect(); effects.push(fx); return fx; });
    fx.play(hit('me'), [new Vector3(0, 50, 0)], () => at.clone(), impact); await flush();
    fx.update(0.4); expect(effects[0]!.object.position.x).toBeCloseTo(250);
    at.x = 700; fx.update(0.4); await flush();
    expect(effects[1]!.object.position.x).toBe(700); expect(impact).toHaveBeenCalledOnce();
    expect(ids).toEqual(['player-damage-mis', 'player-damage-tar']);
    fx.dispose(); effects.forEach(fx => expect(fx.dispose).toHaveBeenCalledOnce()); expect(scene.children).toHaveLength(0);
  });
  it('immediately shows an exact total and hit without sources, follows the target and releases the number on expiry', () => {
    const pen = { strokeText: vi.fn(), fillText: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => pen }) });
    const { fx, scene, at, impact } = setup();
    fx.play({ ...hit('me'), sources: [] }, [], () => at.clone(), impact);
    expect(impact).toHaveBeenCalledOnce(); expect(pen.fillText).toHaveBeenCalledExactlyOnceWith('-3', 128, 64);
    expect(scene.children.filter(node => node.name === 'render3d-player-damage-bolt')).toHaveLength(0);
    const sprite = scene.getObjectByName('render3d-player-damage-number') as Sprite;
    expect(sprite.position.x).toBe(at.x); expect(sprite.position.y).toBeGreaterThan(at.y);
    const texture = vi.spyOn(sprite.material.map!, 'dispose'), material = vi.spyOn(sprite.material, 'dispose');
    at.x += 70; fx.update(0.2); expect(sprite.position.x).toBe(at.x); expect(impact).toHaveBeenCalledOnce();
    fx.update(1.2); expect(fx.debug()).toBeNull(); expect(scene.children).toHaveLength(0);
    expect(texture).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce(); fx.dispose();
  });
  it('retains both targets and expires each volley independently', () => {
    const pen = { strokeText: vi.fn(), fillText: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => pen }) });
    const { fx, scene, at, impact } = setup(), meImpact = vi.fn(), me = new Vector3(-300, 40, 0);
    fx.play(hit(), [new Vector3()], () => at.clone(), impact);
    fx.play({ ...hit('me'), damage: 2, sources: [] }, [], () => me.clone(), meImpact);
    expect(fx.isActive()).toBe(true); expect(meImpact).toHaveBeenCalledOnce(); expect(impact).not.toHaveBeenCalled();
    fx.update(0.81);
    expect(pen.fillText.mock.calls.map(([value]) => value)).toEqual(['-2', '-3']);
    expect(impact).toHaveBeenCalledOnce(); expect(meImpact).toHaveBeenCalledOnce();
    const sprites = scene.children.filter((node): node is Sprite => node instanceof Sprite);
    expect(sprites).toHaveLength(2);
    expect(sprites.find(node => node.userData.damage === 2)!.position.x).toBe(me.x);
    expect(sprites.find(node => node.userData.damage === 3)!.position.x).toBe(at.x);
    fx.update(0.5);
    expect(scene.children.filter(node => node instanceof Sprite)).toHaveLength(1); expect(fx.isActive()).toBe(true);
    fx.update(0.8); expect(fx.isActive()).toBe(false); expect(scene.children).toHaveLength(0); fx.dispose();
  });
  it('releases both targets and their late particles on clear and unmount', async () => {
    const resolves: ((effect: ParticleEffect) => void)[] = [];
    const { fx, scene, at, impact } = setup(() => new Promise(resolve => resolves.push(resolve)));
    fx.play(hit(), [new Vector3()], () => at.clone(), impact);
    fx.play(hit('me'), [new Vector3()], () => at.clone(), impact);
    expect(scene.children.filter(node => node.name === 'render3d-player-damage-bolt')).toHaveLength(2);
    fx.clear(); expect(fx.isActive()).toBe(false); fx.dispose();
    const late = resolves.map(() => effect()); resolves.forEach((resolve, index) => resolve(late[index]!)); await flush();
    late.forEach(effect => expect(effect.dispose).toHaveBeenCalledOnce()); expect(scene.children).toHaveLength(0);
  });
  it('releases late asynchronous travel/impact loads after replacement and unmount', async () => {
    const resolves: ((effect: ParticleEffect) => void)[] = [];
    const { fx, scene, at, impact } = setup(() => new Promise(resolve => resolves.push(resolve)));
    fx.play(hit(), [new Vector3()], () => at.clone(), impact);
    fx.play({ ...hit(), key: 'round:5:2-2' }, [new Vector3()], () => at.clone(), impact);
    fx.update(1); fx.dispose();
    const late = resolves.map(() => effect()); resolves.forEach((resolve, index) => resolve(late[index]!)); await flush();
    late.forEach(fx => expect(fx.dispose).toHaveBeenCalledOnce()); expect(scene.children).toHaveLength(0); expect(fx.debug()).toBeNull();
  });
  it('uses a plain visible trail if assets are missing and expires by wall time after a suspended tab', async () => {
    const { fx, scene, at, impact, jump } = setup(async () => { throw Error('synthetic missing asset'); });
    fx.play(hit(), [new Vector3()], () => at.clone(), impact); await flush(); fx.update(0.1);
    expect(scene.children[0]!.visible).toBe(true); expect(scene.children[0]!.children).toHaveLength(5);
    jump(60_000); fx.update(0.016); await flush(); expect(fx.debug()).toBeNull(); expect(scene.children).toHaveLength(0); fx.dispose();
  });
  it('maps terminal hex cells to board points, targets the proper legend and deduplicates the legacy HP feed', () => {
    const scene = new Scene();
    const table = createTabletop({ scene, camera: new PerspectiveCamera(), championHeight: 92, effectScale: 0.44,
      loadModel: null, loadEffect: null, own: value => value });
    table.frame(frame); table.damage(hit()); table.update(0.001);
    expect(table.debug().volley).toMatchObject({ target: 'opponent', count: 2 });
    const core = scene.children.find(node => node.name === 'render3d-player-damage-bolt')!.children[0]!;
    expect(core.position.x).toBeCloseTo(35 + Math.sqrt(3) * 34 * 2.5, 0);
    table.damage(hit()); expect(table.debug().hits).toEqual(['round:4:2-1']);
    table.frame({ ...frame, hit: { key: hit().key, damage: 3, pvp: true } }); expect(table.debug().bolt).toBe(false);
    table.update(3); table.damage({ ...hit('me'), key: 'round:5:2-2' });
    expect(table.debug().volley).toMatchObject({ target: 'me', damage: 3 });
    table.away(true); expect(table.debug().volley).toBeNull(); table.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it('clears a settlement volley on carousel entry and keeps the walked position on return', () => {
    let clock = 0;
    const scene = new Scene();
    const table = createTabletop({ scene, camera: new PerspectiveCamera(), championHeight: 92, effectScale: 0.44,
      loadModel: null, loadEffect: null, own: value => value, now: () => clock });
    table.frame(frame);
    expect(table.walkTo({ x: 300, y: 300 })).not.toBeNull();
    clock = 60_000; table.update(0.016);
    const me = scene.getObjectByName('render3d-legend-me')!;
    const position = me.position.clone();
    table.damage(hit()); expect(table.debug().volley).not.toBeNull();
    table.away(true, true);
    expect(table.debug().volley).toBeNull();
    expect(scene.children.some(node => node.name === 'render3d-player-damage-bolt')).toBe(false);
    expect(me.visible).toBe(false);
    expect(scene.getObjectByName('render3d-legend-opponent')!.visible).toBe(false);
    table.damage({ ...hit(), key: 'while-away' }); expect(table.debug().volley).toBeNull();
    table.away(false, false);
    expect(me.visible).toBe(true); expect(me.position.equals(position)).toBe(true);
    expect(scene.getObjectByName('render3d-legend-opponent')!.visible).toBe(true);
    table.damage({ ...hit(), key: 'after-carousel' }); expect(table.debug().volley).not.toBeNull();
    table.dispose(); expect(scene.children).toHaveLength(0);
  });
  it('deduplicates per target and shows both exact totals and hit actions on a sourceless draw', () => {
    const pen = { strokeText: vi.fn(), fillText: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => pen }) });
    const actions = vi.spyOn(UnitActionState.prototype, 'consume'), scene = new Scene();
    const table = createTabletop({ scene, camera: new PerspectiveCamera(), championHeight: 92, effectScale: 0.44,
      loadModel: null, loadEffect: null, own: value => value, now: () => 0 });
    table.frame(frame);
    for (const target of ['opponent', 'me'] as const) {
      const event = { ...hit(target), damage: target === 'me' ? 2 : 5, sources: [] };
      table.damage(event); table.damage(event);
    }
    table.frame({ ...frame, hit: { key: hit().key, damage: 2, pvp: true } });
    expect(table.debug().bolt).toBe(false);
    expect(pen.fillText.mock.calls.map(([value]) => value)).toEqual(['-5', '-2']);
    expect(actions.mock.calls.map(([event]) => event.type === 'packetDamage' ? event.targetId : event.type))
      .toEqual(['legend:opponent', 'legend:me']);
    const sprites = scene.children.filter((node): node is Sprite => node instanceof Sprite);
    expect(sprites).toHaveLength(2);
    for (const [damage, target] of [[5, 'opponent'], [2, 'me']] as const) {
      const sprite = sprites.find(node => node.userData.damage === damage)!;
      expect(sprite.position.x).toBe(scene.getObjectByName(`render3d-legend-${target}`)!.position.x);
    }
    table.update(2); expect(scene.children.filter(node => node instanceof Sprite)).toHaveLength(0);
    table.damage({ ...hit('me'), sources: [] }); expect(pen.fillText).toHaveBeenCalledTimes(2);
    table.dispose(); expect(scene.children).toHaveLength(0);
  });
});
