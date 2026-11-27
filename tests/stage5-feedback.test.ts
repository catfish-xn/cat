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

  it('runs the recorded sequence with every unit far apart: a damage number stays near where it appeared, whatever its unit does', () => {
    // Original look (official-server footage, 11-25): a damage number does not follow its unit; it only drifts a little.
    // Every unit walks on; within one frame a damage number moves only by its own small drift.
    setup(); size = { width: 7000, height: 520 }; const newHost = host(), next = createCombatFeedbackRenderer(newHost);
    const anchorsAt = (now: number) => new Map<string, FeedbackAnchor>(sequence.units.map((u, i) => [u.id, { x: 150 + i * 300 + now * 0.08, y: 200 + u.cell.row * 30, radius: 20 }]));
    const placed = () => new Map((newHost as unknown as Element).children[0].children.filter(e => !e.hidden && e.style.left && !e.textContent.startsWith('+'))
      .map(e => [e, { x: parseFloat(e.style.left), y: parseFloat(e.style.top) }] as const));
    let checked = 0;
    for (const frame of sequence.ticks) {
      const at = frame.tick * 50;
      next.push(frame.events as SceneCombatEvent[], at);
      next.render(at, anchorsAt(at)); const before = placed();
      next.render(at + 49.9, anchorsAt(at + 49.9));
      for (const [e, now] of placed()) {
        const was = before.get(e); if (!was) continue;
        checked++;
        expect(now.x - was.x, `tick ${frame.tick}`).toBeLessThanOrEqual(25 * 49.9 / 700 + 1e-6);
        expect(now.x - was.x, `tick ${frame.tick}`).toBeGreaterThanOrEqual(-1e-6);
        expect(Math.abs(now.y - was.y), `tick ${frame.tick}`).toBeLessThanOrEqual(6.5);
      }
    }
    expect(checked).toBeGreaterThan(0);
    next.dispose();
  });

  it('merges one source\'s same-tick packets, keeps heal text, shows no status word and no shield number, and keeps the exact expiry boundary', () => {
    setup(); const newHost = host(), next = createCombatFeedbackRenderer(newHost);
    const events: SceneCombatEvent[] = [damage(1), damage(1, 'a', 5), { ...damage(1, 'b'), damageType: 'magic', absorbed: 12 },
      { type: 'heal', tick: 1, eventSeq: 5, targetId: 'c', actual: 24, shares: [] },
      { type: 'statusChanged', tick: 1, eventSeq: 6, targetId: 'd', kind: 'stun', reason: 'applied', effectiveMagnitudeBps: 0 },
      { ...damage(1, 'e'), damageType: 'true' }];
    const anchors = new Map(['a', 'b', 'c', 'd', 'e'].map((id, i) => [id, { x: 50 + i * 90, y: 250, radius: 20 }]));
    next.push(events, 0);
    for (const now of [-10, 0, 600, 619.999, 620, 699.999, 700]) {
      next.render(now, anchors);
      // A stun (any status) floats no word: only damage and heals do, as in the original.
      if (now === 0) expect(snapshot(newHost)[0].children.map(e => e.text)).toEqual(['15', '10', '+24', '10']);
      // A heal is shorter-lived than a damage number (fitted to official-server footage).
      if (now === 619.999) expect(snapshot(newHost)[0].children).toHaveLength(4);
      if (now === 620 || now === 699.999) expect(snapshot(newHost)[0].children.map(e => e.text)).toEqual(['15', '10', '10']);
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
    it('a crit is the same colour and larger (CRIT_SCALE), with the wedge mark (E5) in two hard tones and a dark edge, in its own label', () => {
      const [plain] = labels([damage(1)], 400), [big] = labels([crit(1)], 400), [blue] = labels([{ ...crit(1), damageType: 'magic' }], 400);
      expect(big.text).toBe(plain.text);
      expect(px(big) / px(plain)).toBeCloseTo(1.4, 1); expect(px(big)).toBe(31);
      expect(big.style.color).toBe(plain.style.color); expect(blue.style.color).toBe('#36c4ff');
      // The mark (the user's pick E5): two hard tones of the number's colour, split along the slam, its dark edge and a black hard shadow.
      const mark = decodeURIComponent(big.style.backgroundImage), blueMark = decodeURIComponent(blue.style.backgroundImage);
      expect(mark).toContain("fill='#f9611c'"); expect(mark).toContain("fill='#b03f15' clip-path='url(#lo)'");
      expect(blueMark).toContain("fill='#4c89c7'"); expect(blueMark).toContain("fill='#335a94' clip-path='url(#lo)'");
      expect(mark).toContain("<polygon points='-10,-8 40,42 -10,42'/>"); expect(mark).toContain("fill='#000' transform='translate(");
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
    it('a number stays fully opaque until its fade-out; a heal lives and fades shorter than damage', () => {
      for (const now of [0, 300, 400]) expect(Number(labels([crit(1)], now)[0].style.opacity), `at ${now}`).toBe(1);
      expect(Number(labels([damage(1)], 550)[0].style.opacity)).toBeCloseTo(0.5, 3);
      expect(Number(labels([heal(1)], 450)[0].style.opacity)).toBe(1);
      expect(Number(labels([heal(1)], 535)[0].style.opacity)).toBeCloseTo(0.5, 3);
    });
    const top = (e: { style: Record<string, string> }) => parseFloat(e.style.top), left = (e: { style: Record<string, string> }) => parseFloat(e.style.left);
    const scale = (e: { style: Record<string, string> }) => Number(/scale\(([\d.]+)\)/.exec(e.style.transform)?.[1] ?? 1);
    it('a damage number appears on the struck body toward its right, with its own jitter, the same every replay, its top under its bar', () => {
      // Anchor: x 120, y 300, radius 20. Without a bar it lands 0.25 × the body's width right of the midline, ±15 px either way.
      const [first] = labels([damage(1)], 0), [again] = labels([damage(1)], 0);
      expect(left(first)).toBe(left(again)); expect(top(first)).toBe(top(again));
      expect(Math.abs(left(first) - (120 + 10))).toBeLessThanOrEqual(15); expect(Math.abs(top(first) - (300 + 20 * 0.35))).toBeLessThanOrEqual(15);
      // Another hit (another tick, another source) lands on its own spot near it.
      const [other] = labels([{ ...damage(2), sourceId: 'c', eventSeq: 2 }], 0);
      expect(left(other) !== left(first) || top(other) !== top(first)).toBe(true);
      // With a bar, toward its right half (0.25 × its width right of the midline) and never above it.
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
      renderer.push([damage(1)], 0); renderer.render(0, new Map([['a', { x: 120, y: 280, radius: 10 }]]), [], new Map([['a', { x: 120, y: 300, w: 60, h: 10 }]]));
      const [barred] = snapshot(h)[0].children;
      // Its top edge, at its popped first-frame size, is no higher than its bar's bottom (305).
      expect(Math.abs(left(barred) - 135)).toBeLessThanOrEqual(15); expect(top(barred) - px(barred) * scale(barred) / 2).toBeGreaterThanOrEqual(305 - 1e-6);
      renderer.dispose();
    });
    it('a damage number does not follow its unit: it drifts right in a small arc, up a little and then down', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
      renderer.push([damage(1)], 0);
      const at = (now: number, x: number) => { renderer.render(now, new Map([['a', { x, y: 300, radius: 20 }]])); return snapshot(h)[0].children[0]; };
      const start = at(0, 120), x0 = left(start), y0 = top(start);
      const mid = at(245, 300), end = at(690, 20);
      expect(left(mid) - x0).toBeCloseTo(25 * 245 / 700, 5); expect(top(mid) - y0).toBeCloseTo(-8, 1);
      expect(left(end) - x0).toBeCloseTo(25 * 690 / 700, 5); expect(top(end) - y0).toBeGreaterThan(15);
      renderer.dispose();
    });
    it('numbers on one unit do not queue: each lands near the last and may cover it, at full size and opacity', () => {
      const three = labels([damage(1, 'a', 10), damage(2, 'a', 20), damage(3, 'a', 30)].map((e, i) => ({ ...e, eventSeq: 1 + i })), 400);
      expect(three.map(e => e.text)).toEqual(['10', '20', '30']);
      for (const e of three) { expect(scale(e)).toBe(1); expect(Number(e.style.opacity)).toBe(1); expect(Math.abs(left(e) - (120 + 10 + 25 * 400 / 700))).toBeLessThanOrEqual(15 + 1e-6); }
    });
    it('our readability rules (not original): same-tick damage on one unit steps down and right with a gap; damage keeps a gap from a heal on its unit (counted popped); a crit\'s top is its mark\'s', () => {
      // Labels are 9 px a character wide in this DOM stand-in, at least 40 px: a 2-digit number is 40 px wide, 22 px tall.
      const alone = labels([{ ...damage(1, 'a', 20), sourceId: 'c' }], 0)[0];
      const pair = [damage(1, 'a', 10), { ...damage(1, 'a', 20), sourceId: 'c' }] as SceneCombatEvent[];
      for (const now of [0, 400]) {
        const [first, second] = labels(pair, now);
        expect(second.text).toBe('20');
        // At least half a number's width (20 px) between them, popped or settled.
        expect(left(second) - left(first) - 20 * scale(first) - 20 * scale(second), `at ${now}`).toBeGreaterThanOrEqual(20 - 1e-6);
      }
      expect(top(labels(pair, 0)[1]) - top(alone)).toBeCloseTo(0.6 * 22, 5);
      // A heal on the same unit stays on its midline; a damage number that would cover it moves right, by at most its own width.
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), anchors = new Map([['a', { x: 120, y: 300, radius: 20 }]]);
      renderer.push([heal(1), damage(1)], 0); renderer.render(0, anchors);
      const [healed, hit] = ['+7', '10'].map(text => snapshot(h)[0].children.find(e => e.text === text)!);
      expect(left(healed)).toBe(120);
      // The heal counts at its largest popped size (2 × 40 px wide), the damage number keeps half its width (20 px) clear of it.
      expect(left(hit) - 20 * scale(hit) - (120 + 40)).toBeGreaterThanOrEqual(20 - 1e-6);
      renderer.render(400, anchors);
      const [settledHeal, settledHit] = ['+7', '10'].map(text => snapshot(h)[0].children.find(e => e.text === text)!);
      // Pushed damage first, heal second (one push): the damage number still keeps clear of the heal.
      setup(); const h4 = host(), r4 = createCombatFeedbackRenderer(h4);
      r4.push([damage(1), heal(1)], 0); r4.render(0, anchors);
      const [lateHeal, earlyHit] = ['+7', '10'].map(text => snapshot(h4)[0].children.find(e => e.text === text)!);
      expect(left(lateHeal)).toBe(120);
      expect(left(earlyHit) - 20 * scale(earlyHit) - (120 + 40)).toBeGreaterThanOrEqual(20 - 1e-6);
      r4.dispose();
      expect(left(settledHit) - 20 * scale(settledHit) - (left(settledHeal) + 20 * scale(settledHeal))).toBeGreaterThanOrEqual(20 - 1e-6);
      renderer.dispose();
      // Once the heal has risen out of its row, a new damage number lands where it would alone.
      setup(); const h3 = host(), r3 = createCombatFeedbackRenderer(h3);
      r3.push([heal(1)], 0); r3.push([damage(9)], 600); r3.render(600, anchors);
      const late = snapshot(h3)[0].children.find(e => e.text === '10')!;
      expect(left(late)).toBe(left(labels([damage(9)], 0)[0]));
      r3.dispose();
      // A crit's mark reaches above its digits: its mark's top, not its digits', starts under its own bar's bottom (305).
      setup(); const h2 = host(), r2 = createCombatFeedbackRenderer(h2);
      r2.push([crit(1)], 0); r2.render(0, new Map([['a', { x: 120, y: 280, radius: 10 }]]), [], new Map([['a', { x: 120, y: 300, w: 60, h: 10 }]]));
      const [big] = snapshot(h2)[0].children;
      expect(top(big) - (1.27 - 0.35) * px(big) * scale(big)).toBeGreaterThanOrEqual(305 - 1e-6);
      r2.dispose();
    });
    it('bars are not avoided: a number on another unit\'s bar stays put; a 2D canvas label is still stepped past', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), other = { x: 160, y: 307, w: 80, h: 16 };
      renderer.push([damage(1, 'a', 10)], 0); renderer.render(0, new Map([['a', { x: 160, y: 300, radius: 20 }]]), [], new Map([['b', other]]));
      const [stays] = snapshot(h)[0].children;
      expect(Math.abs(left(stays) - 170)).toBeLessThanOrEqual(15);
      renderer.dispose();
      setup(); const h2 = host(), r2 = createCombatFeedbackRenderer(h2), label = { x: 170, y: 307, w: 200, h: 40 };
      r2.push([damage(1, 'a', 10)], 0); r2.render(0, new Map([['a', { x: 160, y: 300, radius: 20 }]]), [label]);
      const [moved] = snapshot(h2)[0].children;
      expect(Math.abs(left(moved) - label.x)).toBeGreaterThanOrEqual(label.w / 2 + 20 - 1e-6);
      r2.dispose();
    });
    it('a heal stays on its unit\'s midline and rises from its first frame, popping larger and back', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
      renderer.push([heal(1)], 0);
      const at = (now: number, x: number) => { renderer.render(now, new Map([['a', { x, y: 300, radius: 20 }]])); return snapshot(h)[0].children[0]; };
      const first = at(0, 120);
      expect(left(first)).toBe(120); expect(top(first)).toBeCloseTo(307, 5); expect(scale(first)).toBeCloseTo(2, 5);
      const later = at(100, 140);
      expect(left(later)).toBe(140); expect(top(later)).toBeCloseTo(307 - 8, 5); expect(scale(later)).toBeCloseTo(1.5, 5);
      expect(at(200, 140).style.transform).toBe('translate(-50%, -50%)');
      expect(top(at(600, 140))).toBeCloseTo(307 - 48, 5);
      renderer.dispose();
    });
    it('a heal never rises past half its height below its own bar', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), bars = new Map([['a', { x: 120, y: 280, w: 60, h: 10 }]]);
      renderer.push([heal(1)], 0); renderer.render(600, new Map([['a', { x: 120, y: 300, radius: 20 }]]), [], bars);
      const [label] = snapshot(h)[0].children;
      expect(top(label)).toBeGreaterThanOrEqual(285 + px(label) / 2 - 1e-6);
      renderer.dispose();
    });
    it('heals one after another stand in one column, the newest lowest, none smaller or fainter', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
      renderer.push([heal(1)], 0); renderer.push([{ ...heal(7), eventSeq: 7, actual: 9 } as SceneCombatEvent], 330);
      renderer.render(400, new Map([['a', { x: 120, y: 300, radius: 20 }]]));
      const [older, newer] = snapshot(h)[0].children;
      expect(left(older)).toBe(left(newer)); expect(top(newer)).toBeGreaterThan(top(older));
      expect(Number(older.style.opacity)).toBe(1); expect(scale(older)).toBe(1);
      renderer.dispose();
    });
    it('a damage-over-time tick is small (a burn white), shorter-lived; heals are not changed by crits', () => {
      const [plain] = labels([damage(1)], 400), [tick] = labels([{ ...damage(1), delivery: 'ability-periodic' } as SceneCombatEvent], 400);
      expect(px(tick) / px(plain)).toBeCloseTo(0.8, 1);
      expect(labels([{ ...damage(1), delivery: 'item-burn' } as SceneCombatEvent])[0].style.color).toBe('#ffffff');
      expect(labels([{ ...damage(1), delivery: 'ability-periodic' } as SceneCombatEvent], 700)).toEqual([]);
      expect(labels([heal(1), crit(2, 'b')]).filter(e => e.text === '+7')).toEqual(labels([heal(1)]));
    });
    it('a crit slams in from up-left popping larger, settles quickly, then holds still until it fades', () => {
      const slam = (e: { style: Record<string, string> }) => /translate\((-[\d.]+)px, (-[\d.]+)px\)/.exec(e.style.transform);
      const at = (now: number) => labels([crit(1)], now)[0];
      expect(scale(at(0))).toBeCloseTo(1.9, 3); expect(scale(at(40))).toBeCloseTo(1.45, 3);
      expect(at(80).style.transform).toBe('translate(-50%, -50%)');
      // Up-left of its spot at first (CRIT_SLAM of its size each way), on its spot once settled (the user's pick, 11-19).
      const first = slam(at(0))!; expect(Number(first[1])).toBeCloseTo(-0.25 * px(at(0)), 1); expect(first[1]).toBe(first[2]);
      expect(slam(at(80))).toBeNull();
      // It does not move: the same place from then until it fades.
      expect(top(at(80))).toBe(top(at(650))); expect(left(at(80))).toBe(left(at(650)));
    });
    it('a new number pops in larger and drops back to its size within 160 ms', () => {
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
