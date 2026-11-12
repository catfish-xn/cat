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
import { installProbes } from './probes';
// Installed before the renderer mounts, so the running-system and overhead probes see it from its first frame.
const probes = installProbes(() => clock);
const hex = (row: number, col: number) => ({ x: 35 + 34 * Math.sqrt(3) * (col + (row % 2) / 2), y: 50 + 34 * 1.5 * row });
(async () => {
  const unit = params.get('unit')!, dist = Number(params.get('dist') ?? 3), targetModel = params.get('target') ?? 'training-dummy';
  const w = Number(params.get('w') ?? 1920), h = Number(params.get('h') ?? 1080);
  await probes.ready;
  const mod = await import('../../src/rendering/three-mode/placeholder-renderer');
  let listener: any;
  const controls = { hover() {}, select() {}, dragStart: () => false, dragMove: () => ({ allowed: false }), dragEnd() {}, dragCancel() {} };
  mod.useBoardFeed({ subscribe(next: any) { listener = next; return () => {}; }, controls: () => controls } as any);
  const host = document.getElementById('host')!;
  host.style.width = `${w}px`;
  host.style.height = `${h}px`;
  const r = await mod.mountRenderer3d(host, { assetBase: params.get('assets')! });
  r.resize(w, h);
  // ?board=a,b,...&foes=c,d,...: a whole real combat of up to 8 against 8 (dev/castcmp/board-load.cjs), replayed in full.
  if (params.get('board')) {
    const star = Number(params.get('star') ?? 3);
    const replay = await createBoardReplay(params.get('board')!.split(','), (params.get('foes') ?? params.get('board')!).split(','), star);
    const frameOf = (i: number) => ({ rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces: replay.frames[i]!, fighting: true, dragging: null });
    listener.frame({ ...frameOf(0), fighting: false }); step(50);
    let at = 0, carry = 0;
    const boardStep = (ms: number) => {
      while (ms > 0) {
        const d = Math.min(ms, 16); carry += d;
        while (carry >= 50 && at < replay.frames.length - 1) { carry -= 50; at++; listener.frame(frameOf(at)); if (replay.events[at]!.length) listener.events(replay.events[at]); }
        step(d); ms -= d;
      }
    };
    listener.frame(frameOf(0));
    (window as any).__h = {
      step: boardStep, frame: () => listener.frame(frameOf(at)), reset() { at = 0; carry = 0; listener.frame(frameOf(0)); },
      clock: () => clock, tick: () => at, status: r.status, detail: r.detail,
      board: { ticks: replay.frames.length, casts: replay.casts, result: replay.result, combatStart: replay.combatStart },
    };
    return;
  }
  const me = { id: 'me', definitionId: unit, team: 'player', starLevel: Number(params.get('star') ?? 3), ...hex(4 + 1, 3), alive: true, visible: true,
    meters: { hp: 800, maxHp: 800, mana: 0, maxMana: 60, shield: 0 }, ...(params.get('form') ? { form: params.get('form') } : {}) };
  const foe = (id: string, row: number, col: number) => ({ id, definitionId: targetModel, team: 'enemy', starLevel: Number(params.get('foestar') ?? 1), ...hex(row, col), alive: true, visible: true,
    meters: { hp: 800, maxHp: 800, mana: 0, maxMana: 60, shield: 0 } });
  const tRow = Math.max(0, 5 - dist);
  // ?nfoes=N (1-4): how many dummies stand in front of the caster.
  const pieces = [me, ...[foe('foe', tRow, 3), foe('foe2', tRow, 2), foe('foe3', tRow, 4), foe('foe4', Math.max(0, tRow - 1), 3)].slice(0, Math.max(1, Math.min(4, Number(params.get('nfoes') ?? 4))))];
  const frame = (fighting: boolean) => ({ rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces, fighting, dragging: null });
  listener.frame(frame(false)); step(50); listener.frame(frame(true));
  // ?real=1: the same five pieces fight a real combat (src/simulation): positions, HP, mana, control, damage and the
  // enemies' own attacks all come from the rules' event stream, replayed tick by tick on the virtual clock.
  const real = params.get('real') ? await createRealReplay(unit, Number(params.get('star') ?? 3), params.get('form'), targetModel, dist, Number(params.get('window') ?? 3000)) : null;
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
      // A fresh combat at the replay's start (v-capture calls it before the recorded cast): one frame out of combat and
      // back, so the renderer clears what the warm pass left (running effects, summons) and its per-unit cast count, as a
      // game combat starts. Without it the recorded cast was the unit's second (castIndex 1): a three-phase hero (Jinx)
      // played phase 1's cues, not the first cast's. Loaded effect files stay loaded.
      fresh() { const from = Math.max(0, real.castIndex - 10); listener.frame({ ...frame(false), pieces: real.frames[from]! }); step(50); playFrom(from); },
      events: (evts: any[]) => listener.events(evts), ctl() {}, hit() {},
      clock: () => clock, status: r.status, detail: r.detail, real: { castTick: real.castIndex, ticks: real.frames.length, combatStart: real.combatStart },
      // The recorded window as the rules played it: the cast's targets alive at its end, and anyone else's casts inside it.
      audit: (ms: number) => real.audit(ms),
      systems: probes.systems, resetStarts: probes.resetStarts, attached: probes.attached,
      overhead: (id: string) => { const p: any = real.frames[at]!.find((x: any) => x.id === id); return p ? probes.overhead(p) : null; },
    };
    return;
  }
  (window as any).__h = {
    step,
    frame: () => listener.frame(frame(true)),
    // v-capture --fresh 1 calls this (as fresh()) before the recorded cast: out of combat and back, so the warm pass's
    // effects, summons (Silco's 12 s minions) and cast counts are gone.
    fresh() { (window as any).__h.reset(); },
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
    // ?kill: these dummies drop dead (alive false, still drawn: the death plays and the body stays) before the action.
    kill(ids: string[]) {
      for (const id of ids) { const p: any = pieces.find(x => x.id === id); if (p) { p.alive = false; p.visible = true; p.meters = { ...p.meters, hp: 0 }; } }
      listener.frame(frame(true));
    },
    systems: probes.systems, resetStarts: probes.resetStarts, attached: probes.attached,
    overhead: (id: string) => { const p: any = pieces.find(x => x.id === id); return p ? probes.overhead(p) : null; },
    clock: () => clock,
    status: r.status,
    detail: r.detail,
  };
})().catch(e => { (window as any).__err = String(e?.stack ?? e); });


// ---- ?real=1 helpers (dev only) ----
type Piece = Record<string, unknown>;
async function createRealReplay(unit: string, star: number, form: string | null, foeModel: string, dist: number, windowMs: number) {
  const [rc, display, control] = await Promise.all([import('./real-combat'),
    import('../../src/presentation/combat-display'), import('../../src/presentation/control-display')]);
  const units = rc.realUnits({ unit, star, form, foe: foeModel, dist, nfoes: Number(params.get('nfoes') ?? 4), foestar: Number(params.get('foestar') ?? 1) });
  const frames: Piece[][] = [], events: any[][] = [], alive: Record<string, boolean>[] = [];
  // Ticks kept after the first cast: the recorded window (?window=ms, from LEAD_TICKS before the cast) or 3 s.
  const after = Math.max(rc.DEFAULT_AFTER_TICKS, Math.ceil(windowMs / 50) - rc.LEAD_TICKS + 1);
  const run = rc.runRealCombat(units, after, (state, shown) => {
    frames.push(display.toCombatViewState(state).units.map((u: any) => ({
      id: u.id, definitionId: u.definitionId, team: u.team, starLevel: u.starLevel, ...hexOf(u.cell.row, u.cell.col),
      alive: u.alive, visible: u.alive, meters: { hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, shield: u.shield ?? 0 },
      ...(u.id === 'me' && form ? { form } : {}),
      ...(control.unitControl(state, u) ? { control: control.unitControl(state, u) } : {}),
    })));
    events.push(shown); alive.push(Object.fromEntries(state.units.map((u: any) => [u.id, !!u.alive])));
  });
  if (run.castIndex < 0) throw new Error(`real combat: ${unit} never cast in ${frames.length} ticks`);
  return { frames, events, castIndex: run.castIndex, combatStart: run.combatStart, audit: (ms: number) => rc.auditWindow(events, alive, run.castIndex, ms) };
}
/** ?board=: both teams placed in two rows each (player rows 4 and 6, enemy rows 3 and 1); up to 60 s of real combat. */
async function createBoardReplay(mine: string[], theirs: string[], star: number) {
  const [{ stepCombat }, { startRealCombat }, display, control] = await Promise.all([
    import('../../src/simulation/combat'), import('./real-combat'), import('../../src/presentation/combat-display'), import('../../src/presentation/control-display')]);
  const COLS = [1, 3, 5, 2, 4, 0, 6];
  const place = (ids: string[], team: string, rows: [number, number]) => ids.slice(0, 8).map((definitionId, i) =>
    ({ id: `${team === 'player' ? 'p' : 'e'}${i}-${definitionId}`, definitionId, team, starLevel: star,
      location: { kind: 'board', cell: { col: COLS[i % 4]!, row: rows[i < 4 ? 0 : 1] } } }));
  const started = startRealCombat([...place(mine, 'player', [4, 6]), ...place(theirs, 'enemy', [3, 1])]);
  let state: any = started.state;
  const snapshot = () => display.toCombatViewState(state).units.map((u: any) => ({
    id: u.id, definitionId: u.definitionId, team: u.team, starLevel: u.starLevel, ...hexOf(u.cell.row, u.cell.col),
    alive: u.alive, visible: u.alive, meters: { hp: u.hp, maxHp: u.maxHp, mana: u.mana, maxMana: u.maxMana, shield: u.shield ?? 0 },
    ...(control.unitControl(state, u) ? { control: control.unitControl(state, u) } : {}),
  }));
  const frames: Piece[][] = [snapshot()], events: any[][] = [display.toDisplayEvents(started.events as any)]; let casts = 0;
  while (state.status !== 'finished' && frames.length < 1200) {
    const stepped = stepCombat(state); state = stepped.state;
    const shown = display.toDisplayEvents(stepped.events as any);
    casts += shown.filter((e: any) => e.type === 'cast').length;
    frames.push(snapshot()); events.push(shown);
  }
  return { frames, events, casts, result: state.result ?? null, combatStart: !!state.startEffectsApplied };
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
