import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createCombatFeedbackRenderer, type FeedbackAnchor } from '../src/stats/combat-feedback-renderer';
import { createCombatFeedbackRenderer as before } from './fixtures/stage5-feedback-before';
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
  it.each(['2d', '3d'] as const)('matches the frozen renderer after every recorded frame, including %s anchors, resize and missing units', mode => {
    setup(); const oldHost = host(), newHost = host(), old = before(oldHost), next = createCombatFeedbackRenderer(newHost);
    const input = JSON.stringify(sequence);
    for (const frame of sequence.ticks) {
      const at = frame.tick * 50, events = frame.events as SceneCombatEvent[];
      old.push(events, at); next.push(events, at);
      if (frame.tick === 45) size = { width: 380, height: 400 };
      const anchors = new Map<string, FeedbackAnchor>(sequence.units.filter((_, i) => (frame.tick + i) % 11 !== 0).map((u, i) =>
        [u.id, { x: 40 + u.cell.col * (mode === '3d' ? 45.3 : 58), y: 70 + u.cell.row * 49 + (mode === '3d' ? i / 3 : 0), radius: mode === '3d' ? 18 + i % 4 : 27 }]));
      const obstacles = [{ x: 220, y: 80, w: 90, h: 20 }];
      for (const dt of [0, 16.7, 49.9]) {
        old.render(at + dt, anchors, obstacles); next.render(at + dt, anchors, obstacles);
        expect(snapshot(newHost), `tick ${frame.tick} + ${dt}`).toEqual(snapshot(oldHost));
      }
    }
    for (const age of [849.999, 850, 851]) {
      old.render(5000 + age, new Map()); next.render(5000 + age, new Map());
      expect(snapshot(newHost)).toEqual(snapshot(oldHost));
    }
    expect(JSON.stringify(sequence)).toBe(input);
    old.reset(); next.reset(); expect(snapshot(newHost)).toEqual(snapshot(oldHost));
    old.dispose(); next.dispose(); expect(snapshot(newHost)).toEqual(snapshot(oldHost));
  });

  it('merges same-tick amounts, preserves status/shield/heal text and the exact expiry boundary', () => {
    setup(); const oldHost = host(), newHost = host(), old = before(oldHost), next = createCombatFeedbackRenderer(newHost);
    const events: SceneCombatEvent[] = [damage(1), damage(1, 'a', 5), { ...damage(1, 'b'), damageType: 'magic', absorbed: 12 },
      { type: 'heal', tick: 1, eventSeq: 5, targetId: 'c', actual: 24, shares: [] },
      { type: 'statusChanged', tick: 1, eventSeq: 6, targetId: 'd', kind: 'stun', reason: 'applied', effectiveMagnitudeBps: 0 },
      { ...damage(1, 'e'), damageType: 'true' }];
    const anchors = new Map(['a', 'b', 'c', 'd', 'e'].map((id, i) => [id, { x: 50 + i * 90, y: 250, radius: 20 }]));
    old.push(events, 0); next.push(events, 0);
    for (const now of [-10, 0, 600, 849.999, 850]) {
      old.render(now, anchors); next.render(now, anchors); expect(snapshot(newHost)).toEqual(snapshot(oldHost));
      if (now === 0) expect(snapshot(newHost)[0].children.map(e => e.text)).toEqual(['−15', '−10 魔', '盾 12', '+24', '眩晕', '−10 真']);
    }
    expect(snapshot(newHost)[0].children).toHaveLength(0);
  });

  it('batches all geometry reads, avoids identical text/style assignments and bounds the detached pool at 24', () => {
    setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
    const anchors = new Map(Array.from({ length: 30 }, (_, i) => [`u${i}`, { x: 30 + i * 15, y: 300, radius: 10 }]));
    for (let round = 0; round < 10; round++) {
      renderer.push(Array.from({ length: 30 }, (_, i) => damage(round, `u${i}`)), round * 1000);
      expect(snapshot(h)[0].children).toHaveLength(24);
      operations = []; renderer.render(round * 1000, anchors);
      const first = operations.findIndex(op => op.startsWith('read:')), last = operations.length - 1 - [...operations].reverse().findIndex(op => op.startsWith('read:'));
      expect(operations.slice(first, last + 1).every(op => op.startsWith('read:'))).toBe(true);
      expect(operations.filter(op => op === 'read:width')).toHaveLength(1);
      expect(operations.filter(op => op === 'read:height')).toHaveLength(1);
      operations = []; renderer.render(round * 1000, anchors);
      expect(operations.filter(op => op === 'text' || op.startsWith('style:'))).toEqual([]);
      renderer.reset(); expect(snapshot(h)[0].children).toHaveLength(0);
    }
    expect(created).toBe(24);
    renderer.dispose(); renderer.push([damage(100)], 0); renderer.render(0, anchors);
    expect(snapshot(h)).toEqual([]); expect(created).toBe(24);
  });

  it('keeps the last 24 floats and evicts the oldest of four for one unit', () => {
    setup(); const h = host(), renderer = createCombatFeedbackRenderer(h);
    const anchors = new Map(Array.from({ length: 30 }, (_, i) => [`u${i}`, { x: 40 + i * 12, y: 300, radius: 10 }]));
    renderer.push(Array.from({ length: 30 }, (_, i) => damage(i, `u${i}`, i + 1)), 0);
    renderer.render(0, anchors);
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(Array.from({ length: 24 }, (_, i) => `−${i + 7}`));
    renderer.reset();
    renderer.push(Array.from({ length: 4 }, (_, i) => damage(i, 'u0', i + 1)), 1);
    renderer.render(1, anchors);
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(['−2', '−3', '−4']);
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
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(['−10']);
    const stop = subscribeBoardFeed({ events() {} } as BoardFeedListener);
    try {
      scene.renderFeedback();
      expect(snapshot(h)[0].children).toEqual([]);
      scene.showEvents([damage(2, 'a', 20)]); scene.renderFeedback();
      expect(snapshot(h)[0].children).toEqual([]);
    } finally { stop(); }
    // A new event can arrive before the first 2D render; it must survive the transition reset.
    scene.showEvents([damage(3, 'a', 30)]); scene.renderFeedback();
    expect(snapshot(h)[0].children.map(e => e.text)).toEqual(['−30']);
    expect(resets).toHaveBeenCalledTimes(2);
    renderer.dispose();
  });
});
