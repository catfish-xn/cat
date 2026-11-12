// Dev-only cast capture harness (dev/castcmp): a fake board feed, a virtual clock, one cast event.
const params = new URLSearchParams(location.search);
let clock = 0;
let seq = 100;
const rafs = new Map<number, FrameRequestCallback>(); let rafId = 0;
performance.now = () => clock;
window.requestAnimationFrame = cb => { rafs.set(++rafId, cb); return rafId; };
window.cancelAnimationFrame = id => { rafs.delete(id); };
function step(ms: number) {
  while (ms > 0) { const d = Math.min(ms, 16); clock += d; ms -= d; const p = [...rafs.values()]; rafs.clear(); for (const cb of p) cb(clock); }
}
const hex = (row: number, col: number) => ({ x: 35 + 34 * Math.sqrt(3) * (col + (row % 2) / 2), y: 50 + 34 * 1.5 * row });
(async () => {
  const unit = params.get('unit')!, dist = Number(params.get('dist') ?? 3), targetModel = params.get('target') ?? 'training-dummy';
  const w = Number(params.get('w') ?? 1920), h = Number(params.get('h') ?? 1080);
  const mod = await import('../../src/rendering/three-mode/placeholder-renderer');
  let listener: any;
  const controls = { hover() {}, select() {}, dragStart: () => false, dragMove: () => ({ allowed: false }), dragEnd() {}, dragCancel() {} };
  mod.useBoardFeed({ subscribe(next: any) { listener = next; return () => {}; }, controls: () => controls } as any);
  const host = document.getElementById('host')!;
  host.style.width = `${w}px`;
  host.style.height = `${h}px`;
  const r = await mod.mountRenderer3d(host, { assetBase: params.get('assets')! });
  r.resize(w, h);
  const me = { id: 'me', definitionId: unit, team: 'player', starLevel: Number(params.get('star') ?? 3), ...hex(4 + 1, 3), alive: true, visible: true,
    meters: { hp: 800, maxHp: 800, mana: 0, maxMana: 60, shield: 0 }, ...(params.get('form') ? { form: params.get('form') } : {}) };
  const foe = (id: string, row: number, col: number) => ({ id, definitionId: targetModel, team: 'enemy', starLevel: 1, ...hex(row, col), alive: true, visible: true,
    meters: { hp: 800, maxHp: 800, mana: 0, maxMana: 60, shield: 0 } });
  const tRow = Math.max(0, 5 - dist);
  const pieces = [me, foe('foe', tRow, 3), foe('foe2', tRow, 2), foe('foe3', tRow, 4), foe('foe4', Math.max(0, tRow - 1), 3)];
  const frame = (fighting: boolean) => ({ rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces, fighting, dragging: null });
  listener.frame(frame(false)); step(50); listener.frame(frame(true));
  // ?real=1: the same five pieces fight a real combat (src/simulation): positions, HP, mana, control, damage and the
  // enemies' own attacks all come from the rules' event stream, replayed tick by tick on the virtual clock.
  const real = params.get('real') ? await createRealReplay(unit, Number(params.get('star') ?? 3), params.get('form'), targetModel, dist, Number(params.get('after') ?? 3000), params.get('solo') === '1', params.get('flip') === '1') : null;
  const numbers = params.get('numbers') !== '0' && real ? createDamageNumbers(host, id => listener.screenBox?.(id)) : null;
  if (real) {
    const show = (i: number) => { listener.frame({ ...frame(true), pieces: real.frames[i]! }); };
    let at = 0, carry = 0;
    const playFrom = (i: number) => { at = i; carry = 0; show(i); };
    const advance = (ms: number) => {
      carry += ms;
      while (carry >= 50 && at < real.frames.length - 1) {
        carry -= 50; at++; show(at);
        const events = real.events[at]!;
        if (events.length) { listener.events(events); numbers?.add(events); }
      }
    };
    const realStep = (ms: number) => { while (ms > 0) { const d = Math.min(ms, 16); advance(d); step(d); numbers?.update(d); ms -= d; } };
    playFrom(0);
    (window as any).__h = {
      step: realStep, frame: () => show(at), reset: () => playFrom(0),
      box: (id: string) => listener.screenBox?.(id),
      // A cast replays from half a second before the first cast of `me` in the real combat.
      cast() { numbers?.clear(); playFrom(Math.max(0, real.castIndex - 10)); },
      events: (evts: any[]) => listener.events(evts), ctl() {}, hit() {},
      clock: () => clock, status: r.status, detail: r.detail, real: { castTick: real.castIndex, ticks: real.frames.length },
    };
    return;
  }
  (window as any).__h = {
    step,
    frame: () => listener.frame(frame(true)),
    reset() {
      listener.frame(frame(false));
      step(50);
      listener.frame(frame(true));
      step(1000);
    },
    box: (id: string) => listener.screenBox?.(id),
    cast() {
      const s = ++seq;
      const targetIds = params.get('one') ? ['foe'] : ['foe', 'foe2', 'foe3'];
      const move = params.get('move');
      // LOCAL: Sevika needs her castOutcome receipt (move + outcome) in the same batch as the cast.
      const pre = move ? [{ type: 'castOutcome', tick: s, eventSeq: s, unitId: 'me', abilityKey: 'sevika-ability', outcome: params.get('outcome') ?? 'none', subOutcomes: [], castVariant: { actionSeq: s, move, channelTicks: 0 } }] : [];
      listener.events([...pre, { type: 'cast', tick: s, eventSeq: s, actionSeq: s, sourceId: 'me', targetIds }]);
    },
    events(evts: any[]) {
      listener.events(evts);
    },
    ctl(ids: string[], kind: string | null) {
      for (const id of ids) { const p: any = pieces.find(x => x.id === id); if (!p) continue; if (kind) p.control = kind; else delete p.control; }
      listener.frame(frame(true));
    },
    hit(ids: string[]) {
      const evts = ids.map(id => { const s = ++seq; return { type: 'packetDamage', tick: s, eventSeq: s, sourceId: 'me', targetId: id, damageType: 'magic', sourceKind: 'ability', delivery: 'ability-direct', hit: true, amount: 60, mitigated: 60, hpDamage: 60, absorbed: 0 }; });
      listener.events(evts);
    },
    clock: () => clock,
    status: r.status,
    detail: r.detail,
  };
})().catch(e => { (window as any).__err = String(e?.stack ?? e); });


// ---- ?real=1 helpers (dev only) ----
type Piece = Record<string, unknown>;
async function createRealReplay(unit: string, star: number, form: string | null, foeModel: string, dist: number, afterMs = 3000, solo = false, flip = false) {
  const [{ createCombat, stepCombat }, { DEFAULT_BOARD }, display, control] = await Promise.all([
    import('../../src/simulation/combat'), import('../../src/simulation/board'),
    import('../../src/presentation/combat-display'), import('../../src/presentation/control-display')]);
  const foe = foeModel === 'training-dummy' ? 'garen' : foeModel;
  // Combat cells (player rows 4-7, enemy rows 0-3); the harness draws a cell at hex(row, col).
  const meRow = 5, foeRow = Math.max(0, Math.min(3, meRow - Math.max(2, dist)));
  // LOCAL ?flip=1: `me` fights from the enemy half (row 3) so its foe stands on the camera side.
  const units: any[] = flip ? [
    { id: 'me', definitionId: unit, team: 'enemy', starLevel: star, location: { kind: 'board', cell: { col: 3, row: 3 } }, ...(form ? { form } : {}) },
    { id: 'foe', definitionId: foe, team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 4, row: Math.min(7, 3 + Math.max(1, dist)) } } },
  ] : [
    { id: 'me', definitionId: unit, team: 'player', starLevel: star, location: { kind: 'board', cell: { col: 3, row: meRow } }, ...(form ? { form } : {}) },
    // LOCAL ?solo=1: one enemy only.
    ...(solo ? [['foe', 3, foeRow]] : [['foe', 3, foeRow], ['foe2', 2, foeRow], ['foe3', 4, foeRow], ['foe4', 3, Math.max(0, foeRow - 1)]]).map(([id, col, row]) =>
      ({ id, definitionId: foe, team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col, row } } })),
  ];
  let state: any = createCombat({ board: DEFAULT_BOARD, benchSize: 7, units } as any);
  const frames: Piece[][] = [], events: any[][] = [];
  let castIndex = -1;
  const snapshot = () => display.toCombatViewState(state).units.map((u: any) => ({
    id: u.id, definitionId: u.definitionId, team: u.team, starLevel: u.starLevel, ...hexOf(u.cell.row, u.cell.col),
    alive: u.alive, visible: u.alive, meters: { hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, shield: u.shield ?? 0 },
    ...(u.id === 'me' && form ? { form } : {}),
    ...(control.unitControl(state, u) ? { control: control.unitControl(state, u) } : {}),
  }));
  frames.push(snapshot()); events.push([]);
  // Up to 30 s, or 3 s past the first cast of `me`.
  while (state.status !== 'finished' && frames.length < 600 && (castIndex < 0 || frames.length < castIndex + Math.round(afterMs / 50))) {
    const stepped = stepCombat(state); state = stepped.state;
    const shown = display.toDisplayEvents(stepped.events as any);
    if (castIndex < 0 && shown.some((e: any) => e.type === 'cast' && e.sourceId === 'me')) castIndex = frames.length;
    frames.push(snapshot()); events.push(shown);
  }
  if (castIndex < 0) throw new Error(`real combat: ${unit} never cast in ${frames.length} ticks`);
  return { frames, events, castIndex };
}
const hexOf = (row: number, col: number) => ({ x: 35 + 34 * Math.sqrt(3) * (col + (row % 2) / 2), y: 50 + 34 * 1.5 * row });

/** Recording-only damage numbers (the online 3D board shows none): one per packetDamage, rising and fading. */
function createDamageNumbers(host: HTMLElement, box: (id: string) => { left: number; top: number; right: number; bottom: number } | null | undefined) {
  const live: { el: HTMLElement; age: number }[] = [];
  host.style.position = 'relative';
  const color = (type: string) => type === 'magic' ? '#4fb6ff' : type === 'true' ? '#ffffff' : '#ff8a3d';
  return {
    add(events: any[]) {
      for (const e of events) {
        if (e.type !== 'packetDamage' || !e.hit) continue;
        const amount = (e.hpDamage ?? 0) + (e.absorbed ?? 0); const b = box(e.targetId);
        if (!(amount > 0) || !b) continue;
        const el = document.createElement('div');
        el.textContent = String(Math.round(amount));
        Object.assign(el.style, { position: 'absolute', left: `${(b.left + b.right) / 2}px`, top: `${b.top + 10}px`, transform: 'translate(-50%,0)',
          font: `bold ${e.critical ? 34 : 26}px "Noto Sans CJK SC",sans-serif`, color: color(e.damageType), textShadow: '0 0 3px #000,0 0 3px #000',
          pointerEvents: 'none', zIndex: '50' });
        host.append(el); live.push({ el, age: 0 });
      }
    },
    update(ms: number) {
      for (let i = live.length - 1; i >= 0; i--) {
        const n = live[i]!; n.age += ms;
        n.el.style.marginTop = `${-n.age * 0.05}px`; n.el.style.opacity = String(Math.max(0, 1 - Math.max(0, n.age - 500) / 400));
        if (n.age > 900) { n.el.remove(); live.splice(i, 1); }
      }
    },
    clear() { for (const n of live) n.el.remove(); live.length = 0; },
  };
}
