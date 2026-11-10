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
  const me = { id: 'me', definitionId: unit, team: 'player', starLevel: Number(params.get('star') ?? 2), ...hex(4 + 1, 3), alive: true, visible: true,
    meters: { hp: 800, maxHp: 800, mana: 0, maxMana: 60, shield: 0 }, ...(params.get('form') ? { form: params.get('form') } : {}) };
  const foe = (id: string, row: number, col: number) => ({ id, definitionId: targetModel, team: 'enemy', starLevel: 1, ...hex(row, col), alive: true, visible: true,
    meters: { hp: 800, maxHp: 800, mana: 0, maxMana: 60, shield: 0 } });
  const tRow = Math.max(0, 5 - dist);
  const pieces = [me, foe('foe', tRow, 3), foe('foe2', tRow, 2), foe('foe3', tRow, 4), foe('foe4', Math.max(0, tRow - 1), 3)];
  const frame = (fighting: boolean) => ({ rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 }, bench: [], pieces, fighting, dragging: null });
  listener.frame(frame(false)); step(50); listener.frame(frame(true));
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
