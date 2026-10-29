import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { BoardFeedListener, BoardFrame } from '../src/rendering/board-feed';
import type { Renderer3d } from '../src/rendering/three-mode/contract';
import type { EffectLibrary } from '../src/rendering/three-mode/effect-library';
import type { CombatReplay, CombatReplayTick, CombatViewEvent, CombatViewState, DisplayCombatEvent } from '../src/presentation/combat-display';
import type { ModelLease, UnitActionState, UnitAnimationMixer } from '../src/rendering3d';
import type { GameClient } from '../src/rendering/online/protocol';
import { RemoteSession, REPLAY_OPENING_MS } from '../src/rendering/online/remote-session';
import { createMatch, startMatchCombat, stepMatch } from '../src/simulation/match';
import { BattleHistory, PlaybackSession } from '../src/replay';
import { toDisplayEvents } from '../src/presentation/combat-display';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import { readyMatch } from './match-helpers';
import { syntheticSystem } from './vfx-ltk-synthetic';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import type { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';

describe('real 3D renderer catch-up and effect cleanup', () => {
  let core: typeof import('../src/rendering3d'), three: typeof import('three');
  let mounted: Renderer3d | undefined, listener: BoardFeedListener, library: EffectLibrary;
  let callbacks: Map<number, FrameRequestCallback>, now: number, nextId: number;
  let loads: MockInstance<EffectLibrary['load']>, consumes: MockInstance<UnitActionState['consume']>;
  let textureDisposed: ReturnType<typeof vi.fn<() => void>>;
  type DebugPiece = { root: import('three').Object3D; state: UnitActionState; mixer: UnitAnimationMixer; lease: ModelLease; disposed: boolean; form: 'front' | 'back' };
  const debug = () => (window as unknown as { __render3d: { pieces: Map<string, DebugPiece>; scene: import('three').Scene;
    ltk: ReturnType<typeof createLtkRuntime> } }).__render3d;
  const frame: BoardFrame = { rows: 4, columns: 4, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], dragging: null, fighting: true,
    pieces: [{ id: 'a', definitionId: 'toy', team: 'player', starLevel: 1, x: 150, y: 130, alive: true, visible: true }] };
  const attack = (tick: number): CombatViewEvent => ({ type: 'attack', tick, eventSeq: tick, attackerId: 'a', targetId: 'a' });
  const cast = (tick: number): CombatViewEvent => ({ type: 'cast', tick, eventSeq: tick, sourceId: 'a', targetIds: ['a'], actionSeq: tick,
    completed: true, actualManaSpent: 0, refundedMana: 0, completionCell: { col: 0, row: 0 } });
  async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
  async function advance(ms = 16) {
    now += ms; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(now)); await flush();
  }
  beforeEach(async () => {
    vi.resetModules(); now = 0; nextId = 0; callbacks = new Map(); textureDisposed = vi.fn();
    vi.stubGlobal('window', { devicePixelRatio: 1 }); vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('location', { search: '?debug3d' });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++nextId, callback); return nextId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    const manifest = { schemaVersion: 1, models: Object.fromEntries(['toy', 'vander', 'kogmaw'].map(id => [id, { path: `${id}.glb` }])),
      effects: { flash: { path: 'flash.json' } },
      actionEffects: Object.fromEntries(['toy', 'vander', 'kogmaw'].map(id => [id, { attack: ['flash'], cast: ['flash'] }])) };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return Response.json(manifest);
      if (url.endsWith('precache.json')) return Response.json({ schemaVersion: 1, files: [] });
      if (url.endsWith('action-bindings.json')) return Response.json({ playback: { flash: { anchor: 'source', delay: 0, maxDuration: 1 } } });
      return new Response('', { status: 404 });
    }));
    vi.doMock('three', async original => ({ ...await original<typeof import('three')>(), WebGLRenderer: class {
      domElement = { className: '', style: {}, addEventListener() {}, removeEventListener() {}, remove() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
      setPixelRatio() {} setSize() {} render() {} dispose() {} forceContextLoss() {} initTexture() {} async compileAsync() {}
      getRenderTarget() { return null; } setRenderTarget() {}
    } }));
    three = await import('three'); core = await import('../src/rendering3d');
    const start: TimelineCue = { system: 'start', event: 'cast-start', delay: 0, duration: 1 };
    const hit: TimelineCue = { system: 'hit', event: 'hit', delay: .1, duration: 1 };
    const flight: TimelineCue = { system: 'flight', event: 'projectile', delay: .05, duration: .3, travelSeconds: .3 };
    const ltkIndex = { version: 1, systems: { start: 'start.json', hit: 'hit.json', flight: 'flight.json' },
      assets: { 'synthetic.tex': 'texture.png' }, skills: { vander: [start, hit], kogmaw: [start, flight, hit] } };
    vi.doMock('../src/rendering/three-mode/asset-reader', () => ({ createAssetReader: () => ({
      readJson: async (url: string) => url.includes('/vfx-ltk/') ? url.endsWith('/index.json') ? ltkIndex : syntheticSystem()
        : ({ schemaVersion: 2, limits: { maxParticles: 5, maxDuration: 1 }, emitters: [{ kind: 'quad', texture: 'shared.png', emission: { mode: 'burst', count: 1 }, lifetime: 1 }] }),
      readTexture: async () => { const texture = new three.Texture(); texture.addEventListener('dispose', textureDisposed); return texture; },
      readModel: async () => { const scene = new three.Group(); scene.add(new three.Mesh(new three.BoxGeometry(20, 40, 20), new three.MeshBasicMaterial())); return { scene, animations: ['idle', 'attack', 'cast', 'death'].map(name => new three.AnimationClip(name, 1, [])) }; },
      dispose() {},
    }) }));
    const libraries = await import('../src/rendering/three-mode/effect-library'), create = libraries.createEffectLibrary;
    vi.spyOn(libraries, 'createEffectLibrary').mockImplementation((...args) => { library = create(...args); loads = vi.spyOn(library, 'load'); return library; });
    consumes = vi.spyOn(core.UnitActionState.prototype, 'consume');
    const renderer = await import('../src/rendering/three-mode/placeholder-renderer');
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null as never });
    mounted = await renderer.mountRenderer3d({ clientWidth: 800, clientHeight: 600, append() {} } as unknown as HTMLElement, { assetBase: '/synthetic/' });
    listener.frame(frame); await flush(); await advance();
  });
  afterEach(() => {
    mounted?.dispose(); mounted = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals();
    vi.doUnmock('three'); vi.doUnmock('../src/rendering/three-mode/asset-reader'); vi.resetModules();
  });

  it('keeps the authoritative form while movement crosses deployment rows', async () => {
    listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], form: 'melee', y: -1000 }] }); await advance();
    expect(debug().pieces.get('a')!.form).toBe('front');
    listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], form: 'melee', y: 2000 }] }); await advance();
    expect(debug().pieces.get('a')!.form).toBe('front');
    listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], form: 'ranged', y: 130 }] }); await advance();
    expect(debug().pieces.get('a')!.form).toBe('back');
  });

  it.each([
    { champion: 'vander', targets: ['a'], converted: true },
    { champion: 'vander', targets: [], converted: false },
    { champion: 'kogmaw', targets: ['a'], converted: false },
  ])('online replay keeps self targets and uses whole-action fallback: $champion / $targets', async ({ champion, targets, converted }) => {
    // Synthetic legacy IDs have no champion-specific skill-feel trimming entries.
    vi.stubGlobal('location', { search: '?debug3d&skillfx=off' });
    const board = { ...frame, pieces: [{ ...frame.pieces[0], definitionId: champion }] };
    listener.frame({ ...board, fighting: false }); await debug().ltk.warm(champion); await flush();
    listener.frame(board); loads.mockClear();
    const initial = { combatId: 'self-cast', tick: 0, maxTicks: 20, status: 'running', result: null, board: { rows: 4, columns: 4 },
      units: [{ id: 'a', definitionId: champion, team: 'player', starLevel: 1, hp: 100, maxHp: 100, mana: 0, maxMana: 100,
        alive: true, shield: 0, targetId: null, cell: { col: 0, row: 0 }, attackRange: 1 }] } as CombatViewState;
    const event = { ...cast(1), targetIds: targets } as CombatViewEvent;
    const replay: CombatReplay = { initial, ticks: [{ tick: 1, events: [event] }], terminal: { ...initial, tick: 1 } };
    const before = structuredClone(replay), client = { send: vi.fn() } as unknown as GameClient;
    const session = new RemoteSession(client, createMatch(), () => 0); session.receiveReplay(replay);
    const authoritative = session.state;
    const events = session.advanceDisplay(REPLAY_OPENING_MS); // Advance the opening transition using synthetic time.
    expect(events).toContainEqual(event);
    listener.events!(events);
    expect(debug().ltk.queued).toBe(converted ? 2 : 0);
    await advance(16); await advance(100);
    if (converted) {
      expect(loads).not.toHaveBeenCalled();
      expect(debug().scene.children.filter(o => o.name === 'ltk-vfx').map(o => o.userData.ltkSystem)).toEqual(['start', 'hit']);
    } else {
      expect(loads).toHaveBeenCalledExactlyOnceWith('flash', 1, undefined);
      expect(debug().ltk.active).toBe(0); expect(debug().ltk.queued).toBe(0);
      expect(debug().scene.children.filter(o => o.name === 'ltk-vfx')).toEqual([]);
    }
    expect(session.displayLog).toContainEqual(event); expect(session.state).toBe(authoritative);
    expect(client.send).not.toHaveBeenCalled(); expect(replay).toEqual(before);
  });

  it('a cast begun after 1.2 seconds hidden starts at its own time on the first visible frame', async () => {
    const piece = debug().pieces.get('a')!, mixer = piece.mixer;
    const updates = vi.spyOn(mixer, 'update');
    listener.scout!({ seatId: 'other', name: 'other' });
    for (let i = 0; i < 6; i++) await advance(200);
    expect(updates).not.toHaveBeenCalled();
    listener.events!([cast(30)]);
    expect(piece.state.output.state).toBe('cast');
    const clip = piece.lease.animations.find(clip => clip.name === 'cast')!, action = mixer.mixer.clipAction(clip);
    expect(action.time).toBe(0); expect(clip.duration).toBe(1);
    listener.scout!(null); await advance(16);
    expect(updates).toHaveBeenCalledExactlyOnceWith(.016);
    expect(action.time).toBeCloseTo(.016); expect(action.paused).toBe(false);
  });

  it.each([
    { restart: false, hiddenMs: 0 },
    { restart: true, hiddenMs: 0 },
    { restart: false, hiddenMs: 400 },
    { restart: true, hiddenMs: 400 },
  ])('dance uses only its own elapsed time (restart=$restart, hiddenMs=$hiddenMs)', async ({ restart, hiddenMs }) => {
    const planning: BoardFrame = { ...frame, fighting: false };
    const dancing: BoardFrame = { ...planning, mechanics: { reunion: ['a'] } };
    listener.frame(planning);
    const piece = debug().pieces.get('a')!;
    // Synthetic asset through the existing debug hook; drive dance via the public board feed.
    const clip = new three.AnimationClip('dance', 10, []);
    piece.lease.animations.push(clip); piece.lease.animationNames.celebrate = clip.name;
    const action = piece.mixer.mixer.clipAction(clip), updates = vi.spyOn(piece.mixer, 'update');
    listener.scout!({ seatId: 'other', name: 'other' });
    for (let i = 0; i < 6; i++) await advance(200);
    expect(updates).not.toHaveBeenCalled();
    listener.frame(dancing);
    expect(action.isRunning()).toBe(true); expect(action.time).toBe(0);
    if (restart) {
      for (let i = 0; i < 3; i++) await advance(200);
      // Simulate an action stopped on the same mixer: setDance must really restart it.
      action.stop(); listener.frame(dancing);
      expect(action.isRunning()).toBe(true); expect(action.time).toBe(0);
    }
    for (let elapsed = 0; elapsed < hiddenMs; elapsed += 200) {
      await advance(200);
      listener.frame(dancing); // Repeated board snapshots must preserve the running dance's held time.
    }
    expect(updates).not.toHaveBeenCalled();
    listener.scout!(null); await advance(16);
    expect(updates).toHaveBeenCalledTimes(1);
    expect(updates.mock.calls[0][0]).toBeCloseTo(hiddenMs / 1000 + .016);
    expect(action.time).toBeCloseTo(hiddenMs / 1000 + .016);
  });

  it.each([false, true])('discards hidden dance time when dance ends (combatStarts=%s)', async combatStarts => {
    const planning: BoardFrame = { ...frame, fighting: false };
    listener.frame(planning);
    const piece = debug().pieces.get('a')!, original = piece.mixer;
    const clip = new three.AnimationClip('dance', 10, []);
    piece.lease.animations.push(clip); piece.lease.animationNames.celebrate = clip.name;
    listener.frame({ ...planning, mechanics: { reunion: ['a'] } });
    const dance = original.mixer.clipAction(clip);
    expect(dance.isRunning()).toBe(true);
    listener.scout!({ seatId: 'other', name: 'other' });
    for (let i = 0; i < 6; i++) await advance(200);
    listener.frame(combatStarts ? frame : planning);
    expect(dance.isRunning()).toBe(false); expect(piece.mixer).not.toBe(original);
    const updates = vi.spyOn(piece.mixer, 'update');
    listener.scout!(null); await advance(16);
    expect(updates).toHaveBeenCalledExactlyOnceWith(.016);
    expect(piece.state.output.state).toBe('idle');
  });

  it('catches up the same hidden action, but discards held time when a phase creates a new mixer', async () => {
    const piece = debug().pieces.get('a')!, original = piece.mixer;
    const updates = vi.spyOn(original, 'update');
    listener.scout!({ seatId: 'other', name: 'other' });
    for (let i = 0; i < 6; i++) await advance(200);
    listener.scout!(null); await advance(16);
    expect(updates).toHaveBeenCalledTimes(1); expect(updates.mock.calls[0][0]).toBeCloseTo(1.216);
    listener.scout!({ seatId: 'other', name: 'other' });
    for (let i = 0; i < 6; i++) await advance(200);
    listener.frame({ ...frame, fighting: false });
    expect(piece.mixer).not.toBe(original);
    const replacement = vi.spyOn(piece.mixer, 'update');
    listener.scout!(null); await advance(16);
    expect(replacement).toHaveBeenCalledExactlyOnceWith(.016);
  });

  it.each(['phase', 'visibility', 'revival', 'recreate'] as const)('keeps the movement window after a %s action reset', async reason => {
    let piece = debug().pieces.get('a')!;
    const original = piece.mixer;
    listener.events!([attack(1)]); await advance(80);
    const oldAttack = original.mixer.clipAction(piece.lease.animations.find(clip => clip.name === 'attack')!);
    expect(oldAttack.isRunning()).toBe(true);
    if (reason === 'phase') { listener.frame({ ...frame, fighting: false }); listener.frame(frame); }
    if (reason === 'visibility') {
      listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], visible: false }] }); listener.frame(frame);
    }
    if (reason === 'revival') {
      listener.frame({ ...frame, pieces: [{ ...frame.pieces[0], alive: false }] }); listener.frame(frame);
    }
    if (reason === 'recreate') {
      listener.frame({ ...frame, pieces: [] }); listener.frame(frame); await flush();
      piece = debug().pieces.get('a')!;
    }
    expect(piece.mixer).not.toBe(original); expect(oldAttack.isRunning()).toBe(false);
    expect(piece.state.output.state).toBe('idle'); expect(piece.state.output.revision).toBe(0);
    expect(piece.mixer.mixer.clipAction(piece.lease.animations[0]).isRunning()).toBe(true);
    const step = (tick: number): CombatViewEvent => ({ type: 'movement', tick, eventSeq: tick, unitId: 'a',
      from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });
    listener.events!([step(2)]); const moving = piece.state.output;
    await advance(250); expect(piece.state.output).toEqual(moving);
    listener.events!([step(3)]); expect(piece.state.output).toEqual(moving);
    await advance(250); expect(piece.state.output).toEqual(moving);
    await advance(60); expect(piece.state.output.state).toBe('idle');
    // A reset also reinstalls playback resolution on the new state/mixer.
    listener.events!([cast(4)]); expect(piece.state.output.playback?.durationSeconds).toBe(1);
  });

  it('removing a hidden piece deletes its weak held entry, releases its lease and stops all updates', async () => {
    const piece = debug().pieces.get('a')!, mixer = piece.mixer;
    // Observe the native WeakMap without retaining pieces in a production-facing test hook.
    const sets = vi.spyOn(WeakMap.prototype, 'set'), deletes = vi.spyOn(WeakMap.prototype, 'delete');
    listener.scout!({ seatId: 'other', name: 'other' }); await advance(200); await advance(200);
    const index = sets.mock.calls.findIndex(([key]) => key === piece);
    expect(index).toBeGreaterThanOrEqual(0);
    const held = sets.mock.contexts[index] as WeakMap<object, unknown>; expect(held).toBeInstanceOf(WeakMap); expect(held.has(piece)).toBe(true);
    const update = vi.spyOn(piece.state, 'update'), animation = vi.spyOn(mixer, 'update');
    const dispose = vi.spyOn(mixer, 'dispose'), release = vi.spyOn(piece.lease, 'release');
    listener.frame({ ...frame, pieces: [] });
    expect(deletes).toHaveBeenCalledWith(piece); expect(held.has(piece)).toBe(false);
    expect(debug().pieces.has('a')).toBe(false); expect(piece.disposed).toBe(true); expect(piece.root.parent).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1); expect(release).toHaveBeenCalledTimes(1);
    sets.mockClear(); listener.scout!(null); listener.events!([cast(40)]); await advance(200);
    expect(update).not.toHaveBeenCalled(); expect(animation).not.toHaveBeenCalled();
    expect(sets.mock.calls.some(([key]) => key === piece)).toBe(false);
  });

  it('keeps only the last two ticks of visual starts while every action fact is consumed', async () => {
    const events = [attack(1), cast(2), { type: 'death', unitId: 'a', tick: 3, eventSeq: 3 },
      { type: 'unitRevived', unitId: 'a', sourceId: 'a', hp: 10, tick: 4, eventSeq: 4 }, attack(9), cast(10)] as DisplayCombatEvent[];
    const before = structuredClone(events); consumes.mockClear();
    listener.events!(events); await advance();
    expect(consumes.mock.calls.map(call => call[0])).toEqual(events);
    expect(loads).toHaveBeenCalledTimes(2); // tick 9/10 only; old attack/cast are discarded
    const state = consumes.mock.contexts[0] as InstanceType<typeof core.UnitActionState>;
    const reference = new core.UnitActionState('a'); events.forEach(event => reference.consume(event as Parameters<typeof reference.consume>[0]));
    expect(state.output.state).toBe(reference.output.state); expect(state.output.revision).toBe(reference.output.revision);
    expect(events).toEqual(before);
  });

  it('caps starts per frame, drops stale queued jobs, and accepts later effects', async () => {
    listener.events!(Array.from({ length: 80 }, () => attack(1)));
    await advance(); expect(loads).toHaveBeenCalledTimes(6);
    await advance(); expect(loads).toHaveBeenCalledTimes(12);
    // Renderer caps a single frame at 250ms: after two frames the waiting jobs exceed 300ms.
    await advance(250); expect(loads).toHaveBeenCalledTimes(18);
    await advance(100); expect(loads).toHaveBeenCalledTimes(18);
    listener.events!([attack(2)]); await advance(); expect(loads).toHaveBeenCalledTimes(19);
  });

  it('starts at most 64 queued jobs and cancels pending/live effects when combat switches', async () => {
    // Short effects isolate the queue cap from the separate 48-live-effect cap.
    // Capture the production method rather than recursively invoking the spy.
    loads.mockRestore(); const original = library.load.bind(library);
    loads = vi.spyOn(library, 'load').mockImplementation((id) => original(id, .001));
    listener.events!(Array.from({ length: 80 }, () => attack(1)));
    for (let i = 0; i < 12; i++) await advance(16);
    expect(loads).toHaveBeenCalledTimes(64);
    expect(library.budget.live).toBeLessThanOrEqual(48);
    listener.events!([attack(2)]); listener.frame({ ...frame, fighting: false }); await advance();
    expect(loads).toHaveBeenCalledTimes(64); expect(library.budget.live).toBe(0);
    expect(textureDisposed).not.toHaveBeenCalled(); // renderer lifetime cache survives battle transitions
    listener.frame(frame); listener.events!([attack(3)]); await advance(); expect(loads).toHaveBeenCalledTimes(65);
    mounted!.dispose(); mounted = undefined; await flush();
    expect(library.budget.live).toBe(0); expect(library.pool.idle).toBe(0); expect(textureDisposed).toHaveBeenCalledTimes(1);
  });

  it('catch-up and one-tick playback leave identical authoritative state and complete replay logs', async () => {
    const unit = { id: 'a', definitionId: 'toy', team: 'player', starLevel: 1, hp: 100, maxHp: 100, mana: 0, maxMana: 100,
      alive: true, shield: 0, targetId: null, cell: { col: 0, row: 0 }, attackRange: 1 };
    const initial = { combatId: 'synthetic', tick: 0, maxTicks: 20, status: 'running', result: null, board: { rows: 4, columns: 4 }, units: [unit] } as unknown as CombatViewState;
    const ticks: CombatReplayTick[] = Array.from({ length: 10 }, (_, i) => ({ tick: i + 1, events: [attack(i + 1), cast(i + 1),
      { type: 'unitUpdated', unitId: 'a', changes: { hp: 100 - (i + 1) * 3, mana: i + 1 } }] }));
    const replay: CombatReplay = { initial, ticks, terminal: { ...initial, tick: 10, units: [{ ...initial.units[0], hp: 70, mana: 10 }] } };
    const match = createMatch(), client = { send: vi.fn() } as unknown as GameClient;
    let wall = 0; const slow = new RemoteSession(client, match, () => wall), fast = new RemoteSession(client, match, () => wall);
    slow.receiveReplay(replay); fast.receiveReplay(replay);
    let emitted = 0;
    for (let i = 0; i < 18; i++) { wall += 50; const events = slow.advanceDisplay(50); emitted += events.length; listener.events!(events); await advance(1); }
    const regularStarts = loads.mock.calls.length; expect(regularStarts).toBeGreaterThan(2);
    const before = structuredClone(replay); loads.mockClear(); consumes.mockClear();
    const events = fast.advanceDisplay(16); listener.events!(events); await advance(1);
    expect(loads).toHaveBeenCalledTimes(4); // attack+cast from each of the final two ticks
    expect(events).toHaveLength(30); expect(emitted).toBe(30);
    expect(fast.displayLog).toEqual(slow.displayLog); expect(fast.displayLog).toHaveLength(30);
    expect(fast.combatView).toEqual(slow.combatView); expect(fast.state).toEqual(slow.state);
    expect(fast.combatView!.units[0].hp).toBe(70); expect(fast.combatView!.units[0].mana).toBe(10);
    expect(replay).toEqual(before);
  });

  it('visual catch-up preserves the full domain ledger and final combat state of a real deterministic battle', async () => {
    const initial = readyMatch(42), start = startMatchCombat(initial);
    if (!start.ok) throw new Error(start.reason);
    const history = new BattleHistory('catchup-regression');
    const combatEvents = (events: readonly { domain?: string }[]) => events.filter((e): e is LedgerCombatEvent => e.domain === 'combat');
    history.observe({ before: initial, after: start.state, events: combatEvents(start.events), reason: 'command' });
    let match = start.state;
    while (match.phase === 'combat') {
      const next = stepMatch(match); history.observe({ before: match, after: next.state, events: combatEvents(next.events), reason: 'tick' }); match = next.state;
    }
    const record = history.completedRecords[0]; expect(record).toBeDefined();
    const before = structuredClone(record);
    const board: BoardFrame = { ...frame, pieces: record.initial.units.map((unit, i) => ({ ...frame.pieces[0], id: unit.id, team: unit.team, x: 130 + i * 50 })) };
    listener.frame({ ...board, fighting: false }); listener.frame(board); await flush();
    const regular = new PlaybackSession(record), catchingUp = new PlaybackSession(record);
    try {
      regular.play(); catchingUp.play(); loads.mockClear();
      let consumed = regular.read().events.length;
      while (regular.read().tick < record.endTick) {
        const snapshot = regular.advance(50);
        listener.events!(toDisplayEvents(snapshot.events.slice(consumed))); consumed = snapshot.events.length;
        await advance(1);
      }
      const regularStarts = loads.mock.calls.length; expect(regularStarts).toBeGreaterThan(0);
      listener.frame({ ...board, fighting: false }); listener.frame(board); loads.mockClear();
      const snapshot = catchingUp.advance(record.endTick * 50);
      const fullLedger = structuredClone(snapshot.events), display = toDisplayEvents(snapshot.events);
      listener.events!(display); await advance(1);
      expect(loads.mock.calls.length).toBeLessThan(regularStarts);
      expect(snapshot.combat).toEqual(regular.read().combat); expect(snapshot.combat).toEqual(match.combat);
      expect(snapshot.events).toHaveLength(record.events.length); expect(snapshot.events).toEqual(regular.read().events);
      expect(snapshot.events).toEqual(fullLedger); expect(record).toEqual(before);
    } finally { regular.dispose(); catchingUp.dispose(); }
  });
});
