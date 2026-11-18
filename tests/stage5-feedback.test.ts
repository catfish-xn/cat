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
    next.render(5000 + 1001, new Map());
    expect(snapshot(newHost)[0].children).toHaveLength(0);
    expect(JSON.stringify(sequence)).toBe(input);
    next.reset(); expect(snapshot(newHost)[0].children).toHaveLength(0);
    next.dispose(); expect(snapshot(newHost)).toEqual([]);
  });

  it('merges one source\'s same-tick packets, preserves status/heal text, shows no shield number and keeps the exact expiry boundary', () => {
    setup(); const newHost = host(), next = createCombatFeedbackRenderer(newHost);
    const events: SceneCombatEvent[] = [damage(1), damage(1, 'a', 5), { ...damage(1, 'b'), damageType: 'magic', absorbed: 12 },
      { type: 'heal', tick: 1, eventSeq: 5, targetId: 'c', actual: 24, shares: [] },
      { type: 'statusChanged', tick: 1, eventSeq: 6, targetId: 'd', kind: 'stun', reason: 'applied', effectiveMagnitudeBps: 0 },
      { ...damage(1, 'e'), damageType: 'true' }];
    const anchors = new Map(['a', 'b', 'c', 'd', 'e'].map((id, i) => [id, { x: 50 + i * 90, y: 250, radius: 20 }]));
    next.push(events, 0);
    for (const now of [-10, 0, 600, 849.999, 850]) {
      next.render(now, anchors);
      if (now === 0) expect(snapshot(newHost)[0].children.map(e => e.text)).toEqual(['15', '10', '+24', '眩晕', '10']);
      if (now === 849.999) expect(snapshot(newHost)[0].children).toHaveLength(5);
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

  it('keeps the last 40 floats and evicts the oldest of six for one unit', () => {
    setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
    const anchors = new Map(Array.from({ length: 50 }, (_, i) => [`u${i}`, { x: 40 + i * 8, y: 300, radius: 10 }]));
    renderer.push(Array.from({ length: 50 }, (_, i) => damage(i, `u${i}`, i + 1)), 0);
    renderer.render(0, anchors);
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(Array.from({ length: 40 }, (_, i) => `${i + 11}`));
    renderer.reset();
    renderer.push(Array.from({ length: 6 }, (_, i) => damage(i, 'u0', i + 1)), 1);
    renderer.render(1, anchors);
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(['2', '3', '4', '5', '6']);
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

  describe('damage-float table (Library 伤害飘字分类表, Fable 11-17)', () => {
    const crit = (tick: number, targetId = 'a', hpDamage = 10) => ({ ...damage(tick, targetId, hpDamage), critical: true }) as const;
    const heal = (tick: number, targetId = 'a', actual = 7) => ({ type: 'heal', tick, eventSeq: tick, targetId, actual, shares: [] }) as unknown as SceneCombatEvent;
    const labels = (events: readonly SceneCombatEvent[], now = 0) => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
      renderer.push(events, 0); renderer.render(now, new Map(['a', 'b'].map((id, i) => [id, { x: 120 + i * 160, y: 300, radius: 20 }])));
      const out = snapshot(h)[0].children; renderer.dispose(); return out;
    };
    const px = (e: { style: Record<string, string> }) => parseFloat(e.style.fontSize);
    it('numbers only, told apart by colour: physical orange, magic cyan-blue, true white and bolder, heals green with +', () => {
      const [phys] = labels([damage(1)]), [magic] = labels([{ ...damage(1), damageType: 'magic' }]), [real] = labels([{ ...damage(1), damageType: 'true' }]), [healed] = labels([heal(1)]);
      expect([phys.text, magic.text, real.text, healed.text]).toEqual(['10', '10', '10', '+7']);
      expect(new Set([phys.style.color, magic.style.color, real.style.color, healed.style.color]).size).toBe(4);
      expect(magic.style.color).toBe('#5fd3ff'); expect(real.style.color).toBe('#ffffff');
      expect(Number(real.style.fontWeight)).toBeGreaterThan(Number(phys.style.fontWeight));
      expect(phys.style.textShadow).toContain('#000');
    });
    it('absorbed damage shows no number (the bar shows the shield)', () => {
      expect(labels([{ ...damage(1), hpDamage: 0, absorbed: 6 }])).toEqual([]);
      expect(labels([{ ...damage(1), absorbed: 6 }]).map(e => e.text)).toEqual(['10']);
    });
    it('every hit shows on its own; one source\'s packets of one tick add up', () => {
      expect(labels([damage(1), { ...damage(1), sourceId: 'c' }]).map(e => e.text)).toEqual(['10', '10']);
      expect(labels([damage(1), damage(1, 'a', 5)]).map(e => e.text)).toEqual(['15']);
    });
    it('a crit is about 2.9 times a plain number (one size up, Fable 11-18), more saturated, with a drawn badge, in its own label', () => {
      const [plain] = labels([damage(1)], 400), [big] = labels([crit(1)], 400);
      expect(big.text).toBe(plain.text);
      expect(px(big) / px(plain)).toBeCloseTo(2.9, 1);
      expect(big.style.color).not.toBe(plain.style.color);
      expect(big.style.backgroundImage).toContain('data:image/svg+xml'); expect(plain.style.backgroundImage ?? '').toBe('');
      expect(labels([crit(1, 'a', 10), damage(1, 'a', 4), crit(1, 'a', 5)]).map(e => e.text).sort()).toEqual(['15', '4']);
    });
    it('the plain label of a tick that also has a crit is exactly the label of the plain hit alone', () => {
      const alone = labels([damage(1, 'a', 4)]);
      expect(labels([damage(1, 'a', 4), crit(1, 'a', 10)]).filter(e => e.text === '4')).toEqual(alone);
    });
    it('a physical crit is gold with an inner highlight (Fable 11-18); magic crits are bright blue', () => {
      const [gold] = labels([crit(1)]), [magic] = labels([{ ...crit(1), damageType: 'magic' }]), [plain] = labels([damage(1)]);
      expect(gold.style.color).toBe('#ffd23f'); expect(magic.style.color).toBe('#2fa8ff');
      expect(gold.style.textShadow).not.toBe(plain.style.textShadow);
    });
    it('every number has a dark ring all round, so a small light number reads on the bright board', () => {
      const shadow = labels([{ ...damage(1), delivery: 'item-burn' } as SceneCombatEvent])[0].style.textShadow;
      for (const ring of ['1px 1px 0 #000', '-1px -1px 0 #000', '1px -1px 0 #000', '-1px 1px 0 #000']) expect(shadow).toContain(ring);
    });
    it('a number sits above the overhead bar, near its unit, and rises only a little', () => {
      const top = (e: { style: Record<string, string> }) => parseFloat(e.style.top);
      // Anchor: y 300, radius 20, so the body box top is 280; the bar takes 44 px above it.
      const [plain] = labels([damage(1)], 400), [big] = labels([crit(1)], 400);
      expect(top(plain) + px(plain) / 2).toBeLessThanOrEqual(280 - 44 + 1e-6);
      expect(top(big) + px(big) / 2).toBeLessThanOrEqual(280 - 44 + 1e-6);
      expect(top(labels([damage(1)], 0)[0]) - top(labels([damage(1)], 800)[0])).toBeLessThanOrEqual(12);
    });
    it('a unit\'s numbers stand side by side, right then left, never covering each other or pushed up (Fable 11-18)', () => {
      const top = (e: { style: Record<string, string> }) => parseFloat(e.style.top), left = (e: { style: Record<string, string> }) => parseFloat(e.style.left);
      const three = labels([crit(1, 'a', 10), crit(1, 'a', 20, ), crit(1, 'a', 30)].map((e, i) => ({ ...e, tick: 1 + i, eventSeq: 1 + i })), 400);
      expect(three).toHaveLength(3);
      // Same height (same age here), the first in the middle, then to the right, then to the left.
      expect(new Set(three.map(top)).size).toBe(1);
      expect(left(three[1])).toBeGreaterThan(left(three[0])); expect(left(three[2])).toBeLessThan(left(three[0]));
      // Neighbours are at least a number's width apart (jsdom measures no text: the 20 px minimum half-width stands in).
      expect(left(three[1]) - left(three[0])).toBeGreaterThanOrEqual(40); expect(left(three[0]) - left(three[2])).toBeGreaterThanOrEqual(40);
      // Never higher than 1.5 crit heights above the bar.
      for (const e of three) expect(280 - 44 - top(e)).toBeLessThanOrEqual(1.5 * px(e) + 1e-6);
    });
    it('past three numbers on a unit, the earliest fades out early instead of stacking', () => {
      setup(); const h = host(), renderer = createCombatFeedbackRenderer(h), anchors = new Map([['a', { x: 120, y: 300, radius: 20 }]]);
      for (let i = 0; i < 3; i++) renderer.push([{ ...damage(1 + i), eventSeq: 1 + i }], i * 50);
      renderer.render(150, anchors); expect(snapshot(h)[0].children).toHaveLength(3);
      renderer.push([{ ...damage(9), eventSeq: 9 }], 160);
      // The earliest (shown at 0, normally 850 ms) is gone 200 ms after the fourth came; the other three remain.
      renderer.render(400, anchors);
      expect(snapshot(h)[0].children.map(e => e.text)).toHaveLength(3);
      renderer.dispose();
    });
    it('a damage-over-time tick is small (a burn white), shorter-lived; heals are not changed by crits', () => {
      const [plain] = labels([damage(1)], 400), [tick] = labels([{ ...damage(1), delivery: 'ability-periodic' } as SceneCombatEvent], 400);
      expect(px(tick) / px(plain)).toBeCloseTo(0.8, 1);
      expect(labels([{ ...damage(1), delivery: 'item-burn' } as SceneCombatEvent])[0].style.color).toBe('#ffffff');
      expect(labels([{ ...damage(1), delivery: 'ability-periodic' } as SceneCombatEvent], 700)).toEqual([]);
      expect(labels([heal(1), crit(2, 'b')]).filter(e => e.text === '+7')).toEqual(labels([heal(1)]));
    });
    it('a new number pops where it lands and settles within 300 ms', () => {
      expect(labels([damage(1)], 0)[0].style.transform).toBe('translate(-50%, -50%) scale(1.500)');
      expect(labels([damage(1)], 150)[0].style.transform).toBe('translate(-50%, -50%) scale(1.250)');
      expect(labels([damage(1)], 300)[0].style.transform).toBe('translate(-50%, -50%)');
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
