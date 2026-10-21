import { describe, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createTabletop, LEGEND_MODEL, type TabletopContext } from '../src/rendering/three-mode/tabletop';
import type { BoardFrame, BoardLegendWalk, BoardOrb, BoardPiece } from '../src/rendering/board-feed';
import type { ModelLease, ParticleEffect } from '../src/rendering3d';

/** Synthetic data only: no asset files. Effects and models are stand-in objects; the tabletop logic is production code. */
const piece = (changes: Partial<BoardPiece> = {}): BoardPiece => ({
  id: 'u', definitionId: 'jinx', team: 'enemy', starLevel: 1, x: 150, y: 80, alive: true, visible: true, ...changes,
});
const frame = (changes: Partial<BoardFrame> = {}): BoardFrame => ({
  rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces: [], fighting: false, dragging: null,
  orbs: [], openedOrbs: [], hit: null, ...changes,
});
const orb = (orbId: string, tier: BoardOrb['tier'] = 'blue', queued = false): BoardOrb => ({ orbId, tier, queued });

function fakeEffect(): ParticleEffect & { updates: number; disposed: boolean } {
  const effect = { object: new Group(), finished: false, updates: 0, disposed: false,
    update() { effect.updates++; }, dispose() { effect.disposed = true; effect.object.removeFromParent(); } };
  return effect as unknown as ParticleEffect & { updates: number; disposed: boolean };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(overrides: Partial<TabletopContext> = {}) {
  const scene = new Scene(), camera = new PerspectiveCamera(36, 800 / 600, 1, 5000);
  camera.position.set(240, 900, 900); camera.lookAt(240, 0, 260); camera.updateMatrixWorld(true);
  const owned: { dispose(): void }[] = [];
  const tabletop = createTabletop({ scene, camera, championHeight: 92, effectScale: 0.44, loadModel: null, loadEffect: null,
    own: resource => { owned.push(resource); return resource; }, ...overrides });
  const step = (seconds: number, slices = 10) => { for (let i = 0; i < slices; i++) tabletop.update(seconds / slices); };
  return { scene, camera, tabletop, step };
}

describe('3D tabletop: legend, orbs and the settled HP bolt', () => {
  it('stands my legend beside the board, outside every deployable cell, and keeps it in the camera box', () => {
    const { tabletop } = setup();
    const points = tabletop.layout(frame());
    tabletop.frame(frame());
    expect(tabletop.debug().legends).toEqual(['legend:me:standin']);
    const width = Math.sqrt(3) * 34, rightmost = 35 + width * 6.5;
    expect(points[0]!.x).toBeGreaterThan(rightmost + width);
  });

  it('shows an opponent legend only while a battle against another board is shown', () => {
    const { tabletop, step } = setup();
    tabletop.frame(frame({ fighting: true, pieces: [piece({ definitionId: 'pve-krug', neutral: true })] }));
    expect(tabletop.debug().legends).toEqual(['legend:me:standin']);
    tabletop.frame(frame({ fighting: true, pieces: [piece()] }));
    expect(tabletop.debug().legends).toContain('legend:opponent:standin');
    tabletop.frame(frame({ fighting: false }));
    step(5);
    expect(tabletop.debug().legends).toEqual(['legend:me:standin']);
  });

  it('draws orbs by id, opens only an orb a granted receipt names, and never replays on mount', async () => {
    const { tabletop } = setup();
    // Mounted with orbs already there: nothing opens.
    tabletop.frame(frame({ orbs: [orb('a', 'gray'), orb('b', 'gold'), orb('c', 'blue')], openedOrbs: ['old'] }));
    expect(tabletop.debug().orbs.map(entry => entry.orbId)).toEqual(['a', 'b', 'c']);
    expect(tabletop.debug().opening).toBe(0);
    // Queued in battle: still drawn, not opened.
    tabletop.frame(frame({ orbs: [orb('a', 'gray', true), orb('b', 'gold'), orb('c', 'blue')], openedOrbs: ['old'] }));
    expect(tabletop.debug().opening).toBe(0);
    // Same frame: 'a' granted, 'b' forfeited (no granted receipt names it) -> only 'a' opens.
    tabletop.frame(frame({ orbs: [orb('c', 'blue')], openedOrbs: ['old', 'a'] }));
    await flush();
    expect(tabletop.debug().orbs.map(entry => entry.orbId)).toEqual(['c']);
    expect(tabletop.debug().opening).toBe(1);
    // Removed without any grant: just gone.
    tabletop.frame(frame({ orbs: [], openedOrbs: ['old', 'a'] }));
    await flush();
    expect(tabletop.debug().opening).toBe(1);
  });

  it('names an orb as opened from its entry receipts, skipping forfeited ones', async () => {
    const { grantedOrbIds } = await import('../src/rendering/online/orb-dock');
    const receipt = (dropId: string, resolution?: 'held' | 'forfeited') => ({ receiptId: `${dropId}:r`, dropId, resolution,
      payload: { kind: 'gold' as const, quantity: 1 }, grantedItemIds: [], grantedUnitIds: [] });
    expect(grantedOrbIds([receipt(JSON.stringify(['orb-a', 0])), receipt(JSON.stringify(['orb-a', 1])),
      receipt(JSON.stringify(['orb-b', 0]), 'forfeited'), receipt('not-json'), receipt(JSON.stringify([3, 0]))])).toEqual(['orb-a']);
  });

  it('plays a settled HP loss once: cast lead, travel, then impact on my legend', async () => {
    const { tabletop, step } = setup();
    tabletop.frame(frame({ hit: { key: 'round:3:2-1', damage: 5 } }));
    expect(tabletop.debug().hits).toEqual([]); // already settled when the layer mounted
    tabletop.frame(frame({ fighting: true, pieces: [piece()] }));
    tabletop.frame(frame({ fighting: false, hit: { key: 'round:4:2-2', damage: 7 } }));
    expect(tabletop.debug().hits).toEqual(['round:4:2-2']);
    step(0.3); await flush();
    expect(tabletop.debug().bolt).toBe(true);
    step(1.1); await flush();
    expect(tabletop.debug().bolt).toBe(false);
    expect(tabletop.debug().opening).toBe(1); // the impact
    tabletop.frame(frame({ hit: { key: 'round:4:2-2', damage: 7 } }));
    expect(tabletop.debug().hits).toEqual(['round:4:2-2']);
  });

  it('uses the manifest legend model and the extracted orb and bolt effects when they exist', async () => {
    const effects: Record<string, ReturnType<typeof fakeEffect>[]> = {};
    const loadEffect = vi.fn(async (id: string) => { const fx = fakeEffect(); (effects[id] ??= []).push(fx); return fx; });
    const release = vi.fn();
    const loadModel = vi.fn(async (): Promise<ModelLease> => {
      const scene = new Group(); scene.add(new Group());
      return { scene, animations: [], placeholder: false, animationNames: { idle: 'idle' }, release } as unknown as ModelLease;
    });
    const { tabletop, step } = setup({ loadEffect, loadModel });
    tabletop.frame(frame({ orbs: [orb('p', 'prismatic')] }));
    await flush();
    expect(loadModel).toHaveBeenCalledWith(LEGEND_MODEL);
    expect(tabletop.debug().legends).toEqual(['legend:me:model']);
    expect(loadEffect).toHaveBeenCalledWith('orb-prismatic-idle', 3600);
    expect(tabletop.debug().orbs[0]!.effect).toBe(true);
    tabletop.frame(frame({ orbs: [], openedOrbs: ['p'] }));
    tabletop.frame(frame({ hit: { key: 'round:5:2-3', damage: 4 } }));
    step(0.3); await flush(); step(1.1); await flush();
    expect(Object.keys(effects).sort()).toEqual(['orb-gold-open', 'orb-prismatic-idle', 'player-damage-mis', 'player-damage-tar']);
    expect(effects['orb-prismatic-idle']![0]!.disposed).toBe(true);
    expect(effects['player-damage-mis']![0]!.disposed).toBe(true);
    tabletop.dispose();
    expect(release).toHaveBeenCalled();
  });

  it('maps receipts built from the rules\' own orb and entry ids back to their orb (fails if that id format changes)', async () => {
    const { grantedOrbIds } = await import('../src/rendering/online/orb-dock');
    const { lootEntryId, lootOrbId, lootReceiptId } = await import('../src/simulation/loot-identity');
    const orbA = lootOrbId('1-3', 'minions-b-v1', 'm01', 0), orbB = lootOrbId('1-3', 'minions-b-v1', 'r01', 0);
    const receipt = (dropId: string, resolution?: 'held' | 'forfeited') => ({ receiptId: lootReceiptId(dropId), dropId, resolution,
      payload: { kind: 'gold' as const, quantity: 1 }, grantedItemIds: [], grantedUnitIds: [] });
    expect(grantedOrbIds([receipt(lootEntryId(orbA, 0)), receipt(lootEntryId(orbA, 1)), receipt(lootEntryId(orbB, 0), 'forfeited')])).toEqual([orbA]);
  });

  it('gives a trait orb its own idle and open effects, and falls back to the generic tier when they are missing', async () => {
    const loaded: string[] = [];
    const loadEffect = vi.fn(async (id: string) => {
      loaded.push(id);
      if (id === 'orb-crime' || id === 'orb-crime-open') throw new Error('synthetic-missing');
      return fakeEffect();
    });
    const { tabletop } = setup({ loadEffect });
    tabletop.frame(frame({ orbs: [{ ...orb('w', 'gold'), variant: 'warband' }, { ...orb('c', 'blue'), variant: 'crime' }, orb('g', 'gray')] }));
    await flush(); await flush();
    expect(loaded).toEqual(expect.arrayContaining(['orb-warband', 'orb-crime', 'orb-blue', 'orb-gray']));
    expect(loaded).not.toContain('orb-gold');
    expect(tabletop.debug().orbs.every(view => view.effect)).toBe(true);
    loaded.length = 0;
    tabletop.frame(frame({ orbs: [], openedOrbs: ['w', 'c', 'g'] }));
    await flush(); await flush();
    expect(loaded).toEqual(expect.arrayContaining(['orb-warband-open', 'orb-crime-open', 'orb-blue-open', 'orb-gray-open']));
    expect(loaded).not.toContain('orb-gold-open');
    tabletop.dispose();
  });
  it('rebuilds a bounded orb idle when it reaches its bound', async () => {
    const loadEffect = vi.fn(async (_id: string, _seconds: number) => fakeEffect());
    const { tabletop, step } = setup({ loadEffect });
    tabletop.frame(frame({ orbs: [orb('g', 'gray')] }));
    await flush();
    step(31, 31); await flush();
    expect(loadEffect.mock.calls.filter(call => call[0] === 'orb-gray').length).toBe(2);
  });

  it('picks my orb by its projected center', () => {
    const { tabletop } = setup();
    tabletop.frame(frame({ orbs: [orb('x')] }));
    const area = { left: 0, top: 0, width: 800, height: 600 };
    let found: { x: number; y: number } | null = null;
    for (let x = 0; x < 800 && !found; x += 4) for (let y = 0; y < 600 && !found; y += 4) if (tabletop.orbAt({ x, y }, area) === 'x') found = { x, y };
    expect(found).not.toBeNull();
    expect(tabletop.orbAt({ x: 5, y: 5 }, area)).toBeNull();
  });

  it('walks my legend to a right-clicked point at the room pace, inside the roaming area, and reports it in board cells', () => {
    let clock = 0;
    const { scene, tabletop } = setup({ now: () => clock });
    tabletop.frame(frame());
    const width = Math.sqrt(3) * 34, legend = scene.getObjectByName('render3d-legend-me')!;
    const walk = tabletop.walkTo({ x: 35 + width * 3, y: 50 + width * 2 })!;
    expect(walk.to.x).toBeCloseTo(3, 5); expect(walk.to.y).toBeCloseTo(2, 5);
    expect(tabletop.debug().legends).toEqual(['legend:me:standin:walk']);
    const cells = Math.hypot(walk.to.x - walk.from.x, walk.to.y - walk.from.y);
    clock = cells / 2.5 * 1000 / 2; tabletop.update(0.016);
    expect(legend.position.x).toBeCloseTo(35 + width * (walk.from.x + walk.to.x) / 2, 3);
    clock = cells / 2.5 * 1000 + 1; tabletop.update(0.016);
    expect(legend.position.x).toBeCloseTo(35 + width * 3, 3); expect(legend.position.z).toBeCloseTo(50 + width * 2, 3);
    expect(tabletop.debug().legends).toEqual(['legend:me:standin']);
    // A new frame of the same board keeps it where it walked; a far click stops at the roaming edge.
    tabletop.frame(frame());
    expect(legend.position.x).toBeCloseTo(35 + width * 3, 3);
    const far = tabletop.walkTo({ x: -5000, y: 99999 })!;
    expect(far.to.x).toBeGreaterThan(-3); expect(far.to.y).toBeLessThan(20);
  });

  it('drops each orb where its monster fell and keeps it there after the battle; one without a source takes the column', () => {
    const { scene, tabletop } = setup();
    const monster = (id: string, x: number, y: number, alive = true) => ({ id, definitionId: 'pve-krug', team: 'enemy' as const, starLevel: 1,
      neutral: true as const, x, y, alive, visible: true });
    tabletop.frame(frame());
    const column = (() => { tabletop.frame(frame({ orbs: [orb('probe', 'gray')] })); return scene.getObjectByName('render3d-orb-gray')!.position.clone(); })();
    tabletop.frame(frame({ fighting: true, pieces: [monster('m1', 200, 120), monster('m2', 120, 90)] }));
    tabletop.frame(frame({ fighting: true, pieces: [monster('m1', 210, 125, false), monster('m2', 120, 90)],
      orbs: [{ ...orb('a', 'blue'), source: 'm1' }, { ...orb('b', 'gold'), source: 'm1' }, orb('c', 'gray')] }));
    const at = (tier: string) => scene.getObjectByName(`render3d-orb-${tier}`)!.position;
    expect(at('blue').x).toBeCloseTo(210); expect(at('blue').z).toBeCloseTo(125);
    const width = Math.sqrt(3) * 34;
    expect(at('gold').distanceTo(new Vector3(210, 0, 125)) / width).toBeCloseTo(0.4, 5); // a second orb of m1, beside the first
    expect(at('gray').distanceTo(column)).toBeLessThan(1e-6); // no source: the column beside my legend
    // The battle ends and the monsters leave the board: the orbs stay where they fell.
    tabletop.frame(frame({ orbs: [{ ...orb('a', 'blue'), source: 'm1' }, { ...orb('b', 'gold'), source: 'm1' }, orb('c', 'gray')] }));
    expect(at('blue').x).toBeCloseTo(210); expect(at('blue').z).toBeCloseTo(125);
    tabletop.dispose();
  });

  it('claims an orb my walking legend reaches, once, through the dock click', () => {
    let clock = 0;
    const claimOrb = vi.fn();
    const { tabletop } = setup({ now: () => clock, claimOrb });
    tabletop.frame(frame({ orbs: [orb('a'), orb('b')] }));
    tabletop.update(0.016);
    expect(claimOrb).not.toHaveBeenCalled(); // standing at home touches nothing
    tabletop.walkTo({ x: 0, y: 0 }, 'a');
    clock = 60_000; tabletop.update(0.016); tabletop.update(0.016);
    expect(claimOrb).toHaveBeenCalledWith('a');
    expect(claimOrb.mock.calls.filter(([id]) => id === 'a')).toHaveLength(1);
  });

  it('draws an opponent walk from the room mirrored onto the far side of my board', () => {
    let clock = 0;
    const { scene, tabletop } = setup({ now: () => clock });
    tabletop.frame(frame({ fighting: true, pieces: [piece()] }));
    const width = Math.sqrt(3) * 34, step = 34 * 1.5;
    const walk: BoardLegendWalk = { seatId: 's4', scene: 'board', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, startedAt: 0, arriveAt: 500, slot: null, who: 'opponent' };
    tabletop.walk(walk);
    tabletop.walk({ ...walk, who: 'other', to: { x: 9, y: 9 } }); // not my opponent: not drawn
    clock = 600; tabletop.update(0.016);
    const centerX = 35 + width * 6.5 / 2, centerZ = 50 + step * 7 / 2;
    const legend = scene.getObjectByName('render3d-legend-opponent')!;
    expect(legend.position.x).toBeCloseTo(2 * centerX - (35 + width), 3);
    expect(legend.position.z).toBeCloseTo(2 * centerZ - (50 + width), 3);
  });

  it('sends one claim per orb while it is out, and another only after the session refused it', () => {
    let clock = 0;
    const claimOrb = vi.fn();
    const { tabletop } = setup({ now: () => clock, claimOrb });
    tabletop.frame(frame({ orbs: [orb('a')] }));
    const width = Math.sqrt(3) * 34;
    tabletop.walkTo({ x: 0, y: 0 }, 'a');
    clock += 60_000; tabletop.update(0.016);
    expect(claimOrb).toHaveBeenCalledTimes(1);
    // Still out (no queued flag yet, no answer): walking onto it again sends nothing.
    tabletop.walkTo({ x: 35 + width * 3, y: 50 }); clock += 60_000; tabletop.update(0.016);
    tabletop.walkTo({ x: 0, y: 0 }, 'a'); clock += 60_000; tabletop.update(0.016);
    expect(claimOrb).toHaveBeenCalledTimes(1);
    // Refused: the next touch may send it again, once.
    tabletop.frame(frame({ orbs: [orb('a')], orbRefusals: { a: 1 } }));
    tabletop.walkTo({ x: 35 + width * 3, y: 50 }); clock += 60_000; tabletop.update(0.016);
    tabletop.walkTo({ x: 0, y: 0 }, 'a'); clock += 60_000; tabletop.update(0.016); tabletop.update(0.016);
    expect(claimOrb).toHaveBeenCalledTimes(2);
  });

  it('claims an orb it crossed during one long frame (a dropped frame or a background tab)', () => {
    let clock = 0;
    const claimOrb = vi.fn();
    const { scene, tabletop } = setup({ now: () => clock, claimOrb });
    tabletop.frame(frame({ orbs: [orb('a')] }));
    const legend = scene.getObjectByName('render3d-legend-me')!.position.clone(), at = scene.getObjectByName('render3d-orb-blue')!.position.clone();
    // A walk straight through the orb to well beyond it, finished within a single update.
    const beyond = at.clone().add(at.clone().sub(legend));
    tabletop.walkTo({ x: beyond.x, y: beyond.z });
    clock += 60_000; tabletop.update(0.25);
    expect(claimOrb).toHaveBeenCalledExactlyOnceWith('a');
  });
});
