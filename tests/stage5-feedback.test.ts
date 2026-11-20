import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCombatFeedbackRenderer, type FeedbackAnchor } from '../src/stats/combat-feedback-renderer';
import type { SceneCombatEvent } from '../src/presentation/combat-display';
import { subscribeBoardFeed, type BoardFeedListener } from '../src/rendering/board-feed';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { BoardScene } from '../src/rendering/BoardScene';
const sequence: { units: { id: string; cell: { col: number; row: number } }[]; ticks: { tick: number; events: SceneCombatEvent[] }[] } =
  JSON.parse(readFileSync(new URL('./fixtures/stage5-feedback-sequence.json', import.meta.url), 'utf8'));

/** DOM instrumentation: deliberately returns zero for display:none, as Chromium does. */
class Element {
  children: Element[] = []; parent: Element | null = null; className = '';
  private isHidden = false;
  private text = '';
  style: Record<string, string> = new Proxy({}, { set: (o: Record<string, string>, key: string, value: string) => {
    operations.push(`style:${key}`); o[key] = value; return true;
  } });
  constructor(readonly tag = 'div') { if (tag === 'span') created++; }
  get hidden() { return this.isHidden; }
  set hidden(value: boolean) { operations.push('hidden'); this.isHidden = value; }
  get textContent() { return this.text; }
  set textContent(value: string) { operations.push('text'); this.text = value; }
  get offsetWidth() { operations.push('read:label'); return this.hidden ? 0 : this.text.length * 9; }
  get clientWidth() { operations.push('read:width'); return size.width; }
  get clientHeight() { operations.push('read:height'); return size.height; }
  setAttribute() {}
  append(child: Element) { child.remove(); child.parent = this; this.children.push(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}
let operations: string[] = [], created = 0, size = { width: 480, height: 520 };
const host = () => new Element() as unknown as HTMLElement;
const snapshot = (h: HTMLElement) => (h as unknown as Element).children.map(root => ({
  className: root.className, children: root.children.map(e => ({ text: e.textContent, hidden: e.hidden,
    style: Object.fromEntries(Object.entries(e.style).filter(([, v]) => v !== '')) })),
}));
const damage = (tick: number, targetId = 'a', hpDamage = 10) => ({ type: 'packetDamage', tick, eventSeq: tick,
  sourceId: 'b', targetId, damageType: 'physical', hpDamage, absorbed: 0, critical: false, hit: true, killingPacket: false }) as const;
afterEach(() => vi.unstubAllGlobals());
function setup() {
  operations = []; created = 0; size = { width: 480, height: 520 };
  vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag) });
}

describe('stage5 floating text equivalence and DOM work', () => {
  // FROZEN BASELINE TO BE RE-PINNED (Fable 11-17): the user asked for the damage floats to be redone (the damage-float
  // table), so they no longer match the frozen renderer (fixtures/stage5-feedback-before.ts, kept). Once the user has
  // accepted the new look, a new frozen baseline is generated from it and the per-frame equality comes back for 2d and 3d.
  // Until then the recorded sequence only checks the bounds every frame, and 'damage-float table' below checks each row.
  it.each(['2d', '3d'] as const)('runs the recorded sequence with %s anchors, resize and missing units inside the bounds', mode => {
    setup(); const newHost = host(), next = createCombatFeedbackRenderer(newHost);
    const input = JSON.stringify(sequence);
    for (const frame of sequence.ticks) {
      const at = frame.tick * 50, events = frame.events as SceneCombatEvent[];
      next.push(events, at);
      if (frame.tick === 45) size = { width: 380, height: 400 };
      const anchors = new Map<string, FeedbackAnchor>(sequence.units.filter((_, i) => (frame.tick + i) % 11 !== 0).map((u, i) =>
        [u.id, { x: 40 + u.cell.col * (mode === '3d' ? 45.3 : 58), y: 70 + u.cell.row * 49 + (mode === '3d' ? i / 3 : 0), radius: mode === '3d' ? 18 + i % 4 : 27 }]));
      for (const dt of [0, 16.7, 49.9]) {
        next.render(at + dt, anchors, [{ x: 220, y: 80, w: 90, h: 20 }]);
        const shown = snapshot(newHost)[0].children;
        expect(shown.length, `tick ${frame.tick} + ${dt}`).toBeLessThanOrEqual(40);
        expect(shown.every(e => /^\+?\d+$/.test(e.text) || !/^[−-]/.test(e.text)), `tick ${frame.tick}`).toBe(true);
      }
    }
    next.render(5000 + 1101, new Map());
    expect(snapshot(newHost)[0].children).toHaveLength(0);
    expect(JSON.stringify(sequence)).toBe(input);
    next.reset(); expect(snapshot(newHost)[0].children).toHaveLength(0);
    next.dispose(); expect(snapshot(newHost)).toEqual([]);
  });

  it('runs the recorded sequence with every unit far apart: a unit\'s numbers stack up and never cover each other', () => {
    // Review (11-18): the bounds above are nearly always true; here every unit stands alone (300 px apart on a wide board),
    // so numbers at one x are one unit's, and they must stand one above another (drawn size = font size × transform scale).
    setup(); size = { width: 7000, height: 520 }; const newHost = host(), next = createCombatFeedbackRenderer(newHost);
    const anchors = new Map<string, FeedbackAnchor>(sequence.units.map((u, i) => [u.id, { x: 150 + i * 300, y: 200 + u.cell.row * 30, radius: 20 }]));
    const drawn = (e: { style: Record<string, string> }) => parseFloat(e.style.fontSize) * Number(/scale\(([\d.]+)\)/.exec(e.style.transform ?? '')?.[1] ?? 1);
    let stacks = 0;
    for (const frame of sequence.ticks) {
      next.push(frame.events as SceneCombatEvent[], frame.tick * 50);
      for (const dt of [16.7, 120]) {
        next.render(frame.tick * 50 + dt, anchors);
        const placed = snapshot(newHost)[0].children.filter(e => !e.hidden && e.style.left).map(e => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top), size: drawn(e) }));
        for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i], b = placed[j];
          if (Math.abs(a.x - b.x) < 1) { stacks++; expect(Math.abs(a.y - b.y), `tick ${frame.tick} + ${dt}`).toBeGreaterThanOrEqual((a.size + b.size) / 2 - 1e-6); }
        }
      }
    }
    // The sequence does put several numbers on one unit at once, so the check above ran.
    expect(stacks).toBeGreaterThan(0);
    next.dispose();
  });

  it('merges one source\'s same-tick packets, preserves status/heal text, shows no shield number and keeps the exact expiry boundary', () => {
    setup(); const newHost = host(), next = createCombatFeedbackRenderer(newHost);
    const events: SceneCombatEvent[] = [damage(1), damage(1, 'a', 5), { ...damage(1, 'b'), damageType: 'magic', absorbed: 12 },
      { type: 'heal', tick: 1, eventSeq: 5, targetId: 'c', actual: 24, shares: [] },
      { type: 'statusChanged', tick: 1, eventSeq: 6, targetId: 'd', kind: 'stun', reason: 'applied', effectiveMagnitudeBps: 0 },
      { ...damage(1, 'e'), damageType: 'true' }];
    const anchors = new Map(['a', 'b', 'c', 'd', 'e'].map((id, i) => [id, { x: 50 + i * 90, y: 250, radius: 20 }]));
    next.push(events, 0);
    for (const now of [-10, 0, 600, 899.999, 900]) {
      next.render(now, anchors);
      if (now === 0) expect(snapshot(newHost)[0].children.map(e => e.text)).toEqual(['15', '10', '+24', '眩晕', '10']);
      if (now === 899.999) expect(snapshot(newHost)[0].children).toHaveLength(5);
    }
    expect(snapshot(newHost)[0].children).toHaveLength(0);
  });

  it('batches all geometry reads, avoids identical text/style assignments and bounds the detached pool at 40', () => {
    setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
    const anchors = new Map(Array.from({ length: 50 }, (_, i) => [`u${i}`, { x: 30 + i * 9, y: 300, radius: 10 }]));
    for (let round = 0; round < 10; round++) {
      renderer.push(Array.from({ length: 50 }, (_, i) => damage(round, `u${i}`)), round * 1000);
      expect(snapshot(h)[0].children).toHaveLength(40);
      operations = []; renderer.render(round * 1000, anchors);
      const first = operations.findIndex(op => op.startsWith('read:')), last = operations.length - 1 - [...operations].reverse().findIndex(op => op.startsWith('read:'));
      expect(operations.slice(first, last + 1).every(op => op.startsWith('read:'))).toBe(true);
      expect(operations.filter(op => op === 'read:width')).toHaveLength(1);
      expect(operations.filter(op => op === 'read:height')).toHaveLength(1);
      operations = []; renderer.render(round * 1000, anchors);
      expect(operations.filter(op => op === 'text' || op.startsWith('style:'))).toEqual([]);
      // The text did not change, so the steady frame must not measure labels again.
      expect(operations.filter(op => op === 'read:label')).toEqual([]);
      renderer.reset(); expect(snapshot(h)[0].children).toHaveLength(0);
    }
    expect(created).toBe(40);
    renderer.dispose(); renderer.push([damage(100)], 0); renderer.render(0, anchors);
    expect(snapshot(h)).toEqual([]); expect(created).toBe(40);
  });

  it('keeps the last 40 floats and evicts the oldest of seven for one unit', () => {
    setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
    const anchors = new Map(Array.from({ length: 50 }, (_, i) => [`u${i}`, { x: 40 + i * 8, y: 300, radius: 10 }]));
    renderer.push(Array.from({ length: 50 }, (_, i) => damage(i, `u${i}`, i + 1)), 0);
    renderer.render(0, anchors);
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(Array.from({ length: 40 }, (_, i) => `${i + 11}`));
    renderer.reset();
    renderer.push(Array.from({ length: 7 }, (_, i) => damage(i, 'u0', i + 1)), 1);
    renderer.render(1, anchors);
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(['2', '3', '4', '5', '6', '7']);
    renderer.dispose();
  });

  it('clears online floats on 2D → 3D → 2D during combat and displays new events after return', () => {
    setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
    vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag), getElementById: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) });
    type SceneBridge = {
      online: boolean; feedback: typeof renderer; session: { combatView: unknown; combatRuntime: null; dispose(): void };
      tokens: Map<string, { visible: boolean; x: number; y: number }>;
      game: { canvas: { getBoundingClientRect(): { left: number; top: number; width: number } } };
      scale: { gameSize: { width: number } }; fx: { casts: number; drawn: boolean; show(): void; labelRects(): never[] };
      renderFeedback(): void; showEvents(events: readonly SceneCombatEvent[]): void;
    };
    const scene = new BoardScene() as unknown as SceneBridge;
    scene.session.dispose(); scene.session = { combatView: { combatId: 'online-battle' }, combatRuntime: null, dispose() {} };
    scene.online = true; scene.feedback = renderer;
    scene.tokens = new Map([['a', { visible: true, x: 200, y: 300 }]]);
    scene.game = { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 480 }) } };
    scene.scale = { gameSize: { width: 480 } };
    scene.fx = { casts: 0, drawn: true, show() {}, labelRects: () => [] };
    const resets = vi.spyOn(renderer, 'reset');
    scene.showEvents([damage(1, 'a', 10)]); scene.renderFeedback();
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(['10']);
    const stop = subscribeBoardFeed({ events() {} } as unknown as BoardFeedListener);
    try {
      scene.renderFeedback();
      expect(snapshot(h)[0].children).toEqual([]);
      scene.showEvents([damage(2, 'a', 20)]); scene.renderFeedback();
      expect(snapshot(h)[0].children).toEqual([]);
    } finally { stop(); }
    // A new event can arrive before the first 2D render; it must survive the transition reset.
    scene.showEvents([damage(3, 'a', 30)]); scene.renderFeedback();
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(['30']);
    expect(resets).toHaveBeenCalledTimes(2);
    renderer.dispose();
  });

  describe('damage floats (the user\'s 8 points, 11-19)', () => {
    const crit = (tick: number, targetId = 'a', hpDamage = 10) => ({ ...damage(tick, targetId, hpDamage), critical: true }) as const;
    const heal = (tick: number, targetId = 'a', actual = 7) => ({ type: 'heal', tick, eventSeq: tick, targetId, actual, shares: [] }) as unknown as SceneCombatEvent;
    const labels = (events: readonly SceneCombatEvent[], now = 0) => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
      renderer.push(events, 0); renderer.render(now, new Map(['a', 'b'].map((id, i) => [id, { x: 120 + i * 160, y: 300, radius: 20 }])));
      const out = snapshot(h)[0].children; renderer.dispose(); return out;
    };
    const px = (e: { style: Record<string, string> }) => parseFloat(e.style.fontSize);
    it('numbers only, coloured by damage type (a basic attack too): physical orange, magic cyan-blue, true white, heals green with +', () => {
      const [phys] = labels([damage(1)]), [magic] = labels([{ ...damage(1), damageType: 'magic' }]), [real] = labels([{ ...damage(1), damageType: 'true' }]), [healed] = labels([heal(1)]);
      expect([phys.text, magic.text, real.text, healed.text]).toEqual(['10', '10', '10', '+7']);
      expect([phys.style.color, magic.style.color, real.style.color, healed.style.color]).toEqual(['#ff8a24', '#36c4ff', '#ffffff', '#4fdc84']);
      // A bold rounded sans-serif from the system, never a serif face; a thin dark edge and a hard black shadow down-right, no blur.
      expect(phys.style.fontFamily).toMatch(/sans-serif$/); expect(phys.style.fontFamily).not.toMatch(/(^|[ ,"])serif/);
      expect(Number(phys.style.fontWeight)).toBe(900);
      expect(phys.style.textShadow).toContain('rgba(0,0,0,.9)'); expect(phys.style.textShadow).toContain('0.065em 0.065em 0 #000');
      expect(phys.style.textShadow).not.toMatch(/ \d+(\.\d+)?px rgba\(0,0,0,\.6\)/);
    });
    it('absorbed damage shows no number (the bar shows the shield)', () => {
      expect(labels([{ ...damage(1), hpDamage: 0, absorbed: 6 }])).toEqual([]);
      expect(labels([{ ...damage(1), absorbed: 6 }]).map(e => e.text)).toEqual(['10']);
    });
    it('every hit shows on its own; one source\'s packets of one tick add up', () => {
      expect(labels([damage(1), { ...damage(1), sourceId: 'c' }]).map(e => e.text)).toEqual(['10', '10']);
      expect(labels([damage(1), damage(1, 'a', 5)]).map(e => e.text)).toEqual(['15']);
    });
    it('a crit is the same colour about 1.9 times as large (42 px), with the wedge mark (E5) in two hard tones and a dark edge, in its own label', () => {
      const [plain] = labels([damage(1)], 400), [big] = labels([crit(1)], 400), [blue] = labels([{ ...crit(1), damageType: 'magic' }], 400);
      expect(big.text).toBe(plain.text);
      expect(px(big) / px(plain)).toBeCloseTo(1.9, 1); expect(px(big)).toBe(42);
      expect(big.style.color).toBe(plain.style.color); expect(blue.style.color).toBe('#36c4ff');
      // The mark (the user's pick E5): two hard tones of the number's colour, lighter upper left and darker lower right (it reads
      // top-left to bottom-right, the user's pick 11-20), its dark edge and a black hard shadow.
      const mark = decodeURIComponent(big.style.backgroundImage), blueMark = decodeURIComponent(blue.style.backgroundImage);
      expect(mark).toContain("fill='#f9611c'"); expect(mark).toContain("fill='#b03f15' clip-path='url(#lo)'");
      expect(blueMark).toContain("fill='#4c89c7'"); expect(blueMark).toContain("fill='#335a94' clip-path='url(#lo)'");
      expect(mark).toContain("<polygon points='40,-10 40,42 -12,42'/>"); expect(mark).toContain("fill='#000' transform='translate(");
      expect(mark).toContain("stroke='rgba(0,0,0,.9)'");
      // Its wedge's bottom on the digits' bottom: as much room above the line as below, the mark box placed from there.
      expect(big.style.paddingTop).toBe(big.style.paddingBottom); expect(big.style.paddingTop).not.toBe('');
      expect(plain.style.backgroundImage ?? '').toBe('');
      expect(labels([crit(1, 'a', 10), damage(1, 'a', 4), crit(1, 'a', 5)]).map(e => e.text).sort()).toEqual(['15', '4']);
    });
    it('a plain number next to a crit keeps its own colour, size and font', () => {
      const [alone] = labels([damage(1, 'a', 4)]), mixed = labels([damage(1, 'a', 4), crit(1, 'a', 10)]).find(e => e.text === '4')!;
      for (const key of ['color', 'fontSize', 'fontWeight', 'fontFamily', 'textShadow'] as const) expect(mixed.style[key]).toBe(alone.style[key]);
    });
    it('a basic attack is no longer a small white number: it takes its damage type\'s colour at full size', () => {
      const [plain] = labels([damage(1)], 400);
      expect(plain.style.color).not.toBe('#ffffff'); expect(px(plain)).toBe(22);
    });
    it('every number has a dark edge all round and a drop shadow, so it holds on a bright floor', () => {
      const shadow = labels([{ ...damage(1), delivery: 'item-burn' } as SceneCombatEvent])[0].style.textShadow;
      for (const edge of ['1px 0 0', '-1px 0 0', '0 1px 0', '0 -1px 0', '1px 1px 0', '-1px -1px 0']) expect(shadow).toContain(edge);
    });
    it('a number stays fully opaque until its last 300 ms (the newest of a stack too)', () => {
      for (const now of [0, 300, 600]) expect(Number(labels([crit(1)], now)[0].style.opacity), `at ${now}`).toBe(1);
      expect(Number(labels([damage(1)], 750)[0].style.opacity)).toBeCloseTo(0.5, 3);
    });
    it('a number appears on its unit\'s body (chest to waist), not above its bar, and rises a little as it fades', () => {
      const top = (e: { style: Record<string, string> }) => parseFloat(e.style.top);
      // Anchor: y 300, radius 20 (one radius below the body box's top): the number starts BODY_DROP radii lower.
      const [first] = labels([damage(1)], 0);
      expect(top(first)).toBeCloseTo(300 + 20 * 0.35, 5); expect(top(first)).toBeGreaterThan(300 - 20);
      const late = labels([damage(1)], 880)[0];
      expect(top(first) - top(late)).toBeGreaterThan(0); expect(top(first) - top(late)).toBeLessThanOrEqual(28);
    });
    it('a unit\'s numbers stack up: the newest on the body, older ones above, smaller and fainter, never covering each other', () => {
      const top = (e: { style: Record<string, string> }) => parseFloat(e.style.top), scale = (e: { style: Record<string, string> }) => Number(/scale\(([\d.]+)\)/.exec(e.style.transform)?.[1] ?? 1);
      const three = labels([damage(1, 'a', 10), damage(2, 'a', 20), damage(3, 'a', 30)].map((e, i) => ({ ...e, eventSeq: 1 + i })), 400);
      const [oldest, middle, newest] = three;
      expect([oldest.text, middle.text, newest.text]).toEqual(['10', '20', '30']);
      expect(top(newest)).toBeGreaterThan(top(middle)); expect(top(middle)).toBeGreaterThan(top(oldest));
      expect(scale(newest)).toBeGreaterThan(scale(middle)); expect(scale(middle)).toBeGreaterThan(scale(oldest));
      expect(Number(newest.style.opacity)).toBeGreaterThan(Number(middle.style.opacity)); expect(Number(middle.style.opacity)).toBeGreaterThan(Number(oldest.style.opacity));
      for (const [a, b] of [[newest, middle], [middle, oldest]]) expect(top(a) - top(b)).toBeGreaterThanOrEqual((px(a) * scale(a) + px(b) * scale(b)) / 2 - 1e-6);
      // All on one column: nobody is pushed sideways.
      expect(new Set(three.map(e => e.style.left)).size).toBe(1);
    });
    it('a newly popped number pushes the older one up by its popped size', () => {
      const top = (e: { style: Record<string, string> }) => parseFloat(e.style.top), scale = (e: { style: Record<string, string> }) => Number(/scale\(([\d.]+)\)/.exec(e.style.transform)?.[1] ?? 1);
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), anchors = new Map([['a', { x: 120, y: 300, radius: 20 }]]);
      // A crit peaks 30 ms after it comes (see the crit pop test below).
      renderer.push([damage(1, 'a', 10)], 0); renderer.push([{ ...crit(2, 'a', 20), eventSeq: 2 }], 400); renderer.render(430, anchors);
      const [older, popped] = snapshot(h)[0].children;
      expect(scale(popped)).toBeCloseTo(1.6, 3);
      expect(top(popped) - top(older)).toBeGreaterThanOrEqual((px(popped) * scale(popped) + px(older) * scale(older)) / 2 - 1e-6);
      renderer.dispose();
    });
    it('a number never covers a unit\'s bar, by where it stands: below its own bar, sideways past another\'s, never faded', () => {
      const top = (e: { style: Record<string, string> }) => parseFloat(e.style.top), left = (e: { style: Record<string, string> }) => parseFloat(e.style.left);
      const scale = (e: { style: Record<string, string> }) => Number(/scale\(([\d.]+)\)/.exec(e.style.transform)?.[1] ?? 1);
      // A short unit: its body point (300 + 0.35 × 10) is just under its bar (centre 290, 16 tall, so its bottom is 298).
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), anchors = new Map([['a', { x: 120, y: 300, radius: 10 }]]);
      const bars = new Map([['a', { x: 120, y: 290, w: 60, h: 16 }]]);
      renderer.push([damage(1, 'a', 10)], 0);
      for (const now of [0, 200, 600]) {
        renderer.render(now, anchors, [], bars);
        const [label] = snapshot(h)[0].children, size = px(label) * scale(label);
        // Its top is at least half its height under its own bar's bottom (298), and it is not faded to get there.
        expect(top(label) - size / 2, `at ${now}`).toBeGreaterThanOrEqual(298 + size / 2 - 1e-6);
        expect(Number(label.style.opacity), `at ${now}`).toBe(1);
      }
      renderer.dispose();
      // Another unit's bar where the number would stand: it steps sideways past the bar's end, at full opacity.
      setup(); const h2 = host(), r2 = createCombatFeedbackRenderer(h2), other = { x: 160, y: 307, w: 80, h: 16 };
      r2.push([damage(1, 'a', 10)], 0); r2.render(200, new Map([['a', { x: 160, y: 300, radius: 20 }]]), [], new Map([['b', other]]));
      const [moved] = snapshot(h2)[0].children, w = Math.max(20, 9 * moved.text.length / 2) * scale(moved);
      expect(Math.abs(left(moved) - other.x)).toBeGreaterThanOrEqual(other.w / 2 + w - 1e-6);
      expect(Number(moved.style.opacity)).toBe(1);
      r2.dispose();
      // Two bars side by side across the number's spot: it clears both together (not back and forth between them), on the nearer end.
      setup(); const h3 = host(), r3 = createCombatFeedbackRenderer(h3), barA = { x: 100, y: 307, w: 120, h: 16 }, barB = { x: 210, y: 307, w: 120, h: 16 };
      r3.push([damage(1, 'a', 10)], 0); r3.render(200, new Map([['a', { x: 165, y: 300, radius: 20 }]]), [], new Map([['b', barA], ['c', barB]]));
      const [cleared] = snapshot(h3)[0].children, w3 = Math.max(20, 9 * cleared.text.length / 2) * scale(cleared);
      for (const bar of [barA, barB]) expect(Math.abs(left(cleared) - bar.x)).toBeGreaterThanOrEqual(bar.w / 2 + w3 - 1e-6);
      expect(left(cleared)).toBeGreaterThan(barB.x);
      r3.dispose();
    });
    it('a number keeps clear of another unit\'s number already placed; packed in, it may overlap a number a little but never a bar', () => {
      const left = (e: { style: Record<string, string> }) => parseFloat(e.style.left);
      // Two units 10 px apart: the later unit's number steps sideways past the earlier one's.
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
      renderer.push([damage(1, 'a', 10)], 0); renderer.push([{ ...damage(2, 'b', 20), eventSeq: 2 }], 0);
      renderer.render(300, new Map([['a', { x: 200, y: 300, radius: 20 }], ['b', { x: 210, y: 300, radius: 20 }]]));
      const [first, second] = snapshot(h)[0].children;
      expect(Math.abs(left(first) - left(second))).toBeGreaterThanOrEqual(40 - 1e-6);
      renderer.dispose();
      // Bars close in on both sides and the only bar-free spot is taken by another number: it overlaps that number, not a bar.
      setup(); const h2 = host(), r2 = createCombatFeedbackRenderer(h2), barL = { x: 100, y: 307, w: 160, h: 16 }, barR = { x: 300, y: 307, w: 160, h: 16 };
      r2.push([damage(1, 'a', 10)], 0); r2.push([{ ...damage(2, 'b', 20), eventSeq: 2 }], 0);
      r2.render(300, new Map([['a', { x: 200, y: 300, radius: 20 }], ['b', { x: 200, y: 300, radius: 20 }]]), [], new Map([['l', barL], ['r', barR]]));
      for (const label of snapshot(h2)[0].children) {
        for (const bar of [barL, barR]) expect(Math.abs(left(label) - bar.x)).toBeGreaterThanOrEqual(bar.w / 2 + 20 - 1e-6);
      }
      r2.dispose();
      // Moved aside past a pair of bars, then crowded there by another unit's number: it steps a little further on, not across the bars.
      setup(); const h3 = host(), r3 = createCombatFeedbackRenderer(h3), pair = new Map([['l', { x: 100, y: 307, w: 120, h: 16 }], ['r', { x: 220, y: 307, w: 120, h: 16 }]]);
      r3.push([damage(1, 'a', 10)], 0); r3.push([{ ...damage(2, 'b', 20), eventSeq: 2 }], 0);
      r3.render(200, new Map([['b', { x: 162, y: 300, radius: 20 }]]), [], pair);
      expect(left(snapshot(h3)[0].children.find(e => e.text === '20')!)).toBeGreaterThan(280);
      r3.render(220, new Map([['a', { x: 320, y: 300, radius: 20 }], ['b', { x: 162, y: 300, radius: 20 }]]), [], pair);
      const [ofA, ofB] = ['10', '20'].map(text => snapshot(h3)[0].children.find(e => e.text === text)!);
      expect(left(ofB)).toBeGreaterThan(280); expect(Math.abs(left(ofB) - left(ofA))).toBeGreaterThanOrEqual(40 - 1e-6);
      r3.dispose();
      // Hemmed in by numbers on both sides: it steps aside at most 1.5 of its widths, else stays by its unit and overlaps a little.
      setup(); const h4 = host(), r4 = createCombatFeedbackRenderer(h4);
      r4.push([damage(1, 'a', 10)], 0); r4.push([{ ...damage(2, 'c', 30), eventSeq: 2 }], 0); r4.push([{ ...damage(3, 'd', 40), eventSeq: 3 }], 0);
      r4.push([{ ...damage(4, 'b', 20), eventSeq: 4 }], 0);
      r4.render(300, new Map([['a', { x: 200, y: 300, radius: 20 }], ['c', { x: 243, y: 300, radius: 20 }], ['d', { x: 157, y: 300, radius: 20 }], ['b', { x: 205, y: 300, radius: 20 }]]));
      const hemmed = snapshot(h4)[0].children.find(e => e.text === '20')!;
      expect(Math.abs(left(hemmed) - 205)).toBeLessThanOrEqual(1.5 * 40 + 1e-6);
      r4.dispose();
    });
    it('past four numbers on a unit, the earliest fades out early', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), anchors = new Map([['a', { x: 120, y: 300, radius: 20 }]]);
      for (let i = 0; i < 4; i++) renderer.push([{ ...damage(1 + i), eventSeq: 1 + i }], i * 50);
      renderer.render(150, anchors); expect(snapshot(h)[0].children).toHaveLength(4);
      renderer.push([{ ...damage(9), eventSeq: 9 }], 160);
      // The earliest (shown at 0, normally 900 ms) is gone 200 ms after the fifth came; the other four remain.
      renderer.render(400, anchors);
      expect(snapshot(h)[0].children).toHaveLength(4);
      renderer.dispose();
    });
    it('a damage-over-time tick is small (a burn white), shorter-lived; heals are not changed by crits', () => {
      const [plain] = labels([damage(1)], 400), [tick] = labels([{ ...damage(1), delivery: 'ability-periodic' } as SceneCombatEvent], 400);
      expect(px(tick) / px(plain)).toBeCloseTo(0.8, 1);
      expect(labels([{ ...damage(1), delivery: 'item-burn' } as SceneCombatEvent])[0].style.color).toBe('#ffffff');
      expect(labels([{ ...damage(1), delivery: 'ability-periodic' } as SceneCombatEvent], 700)).toEqual([]);
      expect(labels([heal(1), crit(2, 'b')]).filter(e => e.text === '+7')).toEqual(labels([heal(1)]));
    });
    it('a crit slams in from up-left, pops past its size and settles within 100 ms, then holds still until it fades', () => {
      const scale = (e: { style: Record<string, string> }) => Number(/scale\(([\d.]+)\)/.exec(e.style.transform)?.[1] ?? 1);
      const slam = (e: { style: Record<string, string> }) => /translate\((-[\d.]+)px, (-[\d.]+)px\)/.exec(e.style.transform);
      const at = (now: number) => labels([crit(1)], now)[0];
      expect(scale(at(0))).toBeCloseTo(1.3, 3); expect(scale(at(30))).toBeCloseTo(1.6, 3); expect(scale(at(70))).toBeCloseTo(0.92, 3);
      expect(at(100).style.transform).toBe('translate(-50%, -50%)');
      // Up-left of its spot at first (a quarter of its size each way), on its spot from 100 ms.
      const first = slam(at(0))!; expect(Number(first[1])).toBeCloseTo(-0.25 * px(at(0)), 1); expect(first[1]).toBe(first[2]);
      expect(slam(at(100))).toBeNull();
      // It does not rise: the same height from 100 ms until it fades.
      expect(parseFloat(at(100).style.top)).toBe(parseFloat(at(800).style.top));
    });
    it('a new number pops in larger and drops back to its size within 160 ms, then rises', () => {
      expect(labels([damage(1)], 0)[0].style.transform).toBe('translate(-50%, -50%) scale(1.600)');
      expect(labels([damage(1)], 80)[0].style.transform).toBe('translate(-50%, -50%) scale(1.300)');
      expect(labels([damage(1)], 160)[0].style.transform).toBe('translate(-50%, -50%)');
    });
    it('a pooled label taken by a crit, then by a plain hit, looks plain again', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), anchors = new Map([['a', { x: 120, y: 300, radius: 20 }]]);
      renderer.push([crit(1)], 0); renderer.render(0, anchors);
      renderer.reset(); renderer.push([damage(2)], 0); renderer.render(0, anchors); const reused = snapshot(h)[0].children[0];
      expect(created).toBe(1);
      expect(reused).toEqual(labels([damage(2)])[0]);
      renderer.dispose();
    });
  });
});
