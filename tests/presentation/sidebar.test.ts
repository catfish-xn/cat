import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayersSidebar } from '../../src/rendering/online/players-sidebar';
import type { PlayerView, SeatPublic } from '../../src/rendering/online/protocol';
import { rankSidebarSeats } from '../../src/presentation/sidebar-ranking';
import { sidebarWinStreak, type SidebarStreak } from '../../src/presentation/sidebar-streak';
import { resetPreferenceCache, setReducedMotion } from '../../src/presentation/preferences';
import * as textCards from '../../src/presentation/text-card';

type Seat = SeatPublic & { readonly streak?: SidebarStreak };
const seat = (seatId: string, hp: number, extra: Partial<Seat> = {}): Seat => ({ seatId, hp, name: seatId,
  kind: 'human', connected: true, controller: 'human', level: 5, alive: true, rank: null, ...extra });
const view = (seats: readonly Seat[]): PlayerView => ({ seats, mySeatId: 's0', opponentSeatId: null, ranking: null, fault: null,
  phase: { kind: 'preparation', round: 3, roundName: '2-1', serverNow: 0, endsAt: null } });
const ids = (seats: readonly Seat[]) => seats.map(seat => seat.seatId);

describe('sidebar rank, independently of names and viewer identity', () => {
  it('strictly sorts live HP, puts eliminated seats last by authoritative placement, and never mutates input', () => {
    const seats = [seat('s0', 30), seat('s1', 80), seat('s2', 100), seat('s3', 0, { alive: false, rank: 8 }),
      seat('s4', 70), seat('s5', 12), seat('s6', -9, { alive: false, rank: 7 }), seat('s7', 50)];
    const original = JSON.stringify(seats);
    expect(ids(rankSidebarSeats(seats, []))).toEqual(['s2', 's1', 's4', 's7', 's0', 's5', 's6', 's3']);
    expect(JSON.stringify(seats)).toBe(original);
  });
  it('uses initial server seat order for ties, then last displayed order even when wire order and names change', () => {
    const seats = [seat('s0', 100, { name: 'Zulu' }), seat('s1', 100, { name: 'Alpha' }), seat('s2', 100)];
    expect(ids(rankSidebarSeats(seats, []))).toEqual(['s0', 's1', 's2']);
    const last = ids(rankSidebarSeats([seats[0], { ...seats[1], hp: 80 }, seats[2]], ['s0', 's1', 's2']));
    expect(last).toEqual(['s0', 's2', 's1']);
    expect(ids(rankSidebarSeats([seats[1], seats[0], seats[2]], last))).toEqual(['s0', 's2', 's1']);
  });
  it('keeps ranks authoritative at game end and handles absent ranks without reordering equal entries', () => {
    const seats = [seat('s0', 0, { alive: false, rank: null }), seat('s1', -20, { alive: false, rank: 2 }),
      seat('s2', -1, { alive: false, rank: 3 }), seat('s3', 0, { alive: false, rank: null }), seat('s4', 1, { rank: 1 })];
    expect(ids(rankSidebarSeats(seats, ['s3', 's0', 's1', 's2', 's4']))).toEqual(['s4', 's1', 's2', 's3', 's0']);
  });
});

describe('optional public streak adapter', () => {
  it.each([0, 1, 2, 3, -4, 4.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('does not light a win count of %s', count => {
    expect(sidebarWinStreak({ alive: true, streak: { kind: 'win', count } })).toBeNull();
  });
  it('accepts 4+ wins, but never missing fields, loss streaks, no streak or eliminated seats', () => {
    expect(sidebarWinStreak({ alive: true, streak: { kind: 'win', count: 4 } })).toBe(4);
    expect(sidebarWinStreak({ alive: true, streak: { kind: 'win', count: 12 } })).toBe(12);
    expect(sidebarWinStreak({ alive: true })).toBeNull();
    expect(sidebarWinStreak({ alive: true, streak: { kind: 'loss', count: 12 } })).toBeNull();
    expect(sidebarWinStreak({ alive: true, streak: { kind: null, count: 12 } })).toBeNull();
    expect(sidebarWinStreak({ alive: false, streak: { kind: 'win', count: 12 } })).toBeNull();
  });
});

/** Deterministic DOM geometry recorder. The real sidebar builds the nodes and installs the
 * selection callbacks; no Chromium is started without the codex-browser bridge. */
let mode: '2d' | '3d' = '2d';
class Node {
  children: Node[] = []; parent: Node | null = null; className = ''; textContent = ''; innerHTML = ''; id = ''; hidden = false; tabIndex = 0; type = ''; title = '';
  dataset: Record<string, string> = {}; attributes = new Map<string, string>(); style = { setProperty() {}, animationDelay: '' };
  listeners = new Map<string, ((event: unknown) => void)[]>();
  offset = 0;
  animations: { frames: Keyframe[]; options: KeyframeAnimationOptions; animation: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null } }[] = [];
  classList = {
    add: (name: string) => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
    remove: (name: string) => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); },
    contains: (name: string) => this.className.split(' ').includes(name),
    toggle: (name: string, on = !this.classList.contains(name)) => { if (on) this.classList.add(name); else this.classList.remove(name); return on; },
  };
  append(...nodes: Node[]) { for (const node of nodes) { node.remove(); this.children.push(node); node.parent = this; } }
  replaceChildren(...nodes: Node[]) { for (const child of this.children) child.parent = null; this.children = []; this.append(...nodes); }
  insertBefore(node: Node, before: Node) { node.parent = this; this.children.splice(this.children.indexOf(before), 0, node); }
  get lastChild() { return this.children.at(-1); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  hasAttribute(name: string) { return this.attributes.has(name); }
  toggleAttribute(name: string, on: boolean) { if (on) this.setAttribute(name, ''); else this.removeAttribute(name); }
  matches() { return this.tabIndex === 0; }
  querySelectorAll() { return []; }
  addEventListener(type: string, listener: (event: unknown) => void) { this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]); }
  fire(type: string, event: unknown = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
  getBoundingClientRect(): DOMRect {
    const index = this.parent?.children.indexOf(this) ?? 0;
    const top = this.parent?.children.slice(0, index).reduce((y, row) => y + (mode === '3d' && row.classList.contains('me') ? 86 : 60), 0) ?? 0;
    return { top: top + this.offset, left: 0 } as DOMRect;
  }
  animate(frames: Keyframe[], options: KeyframeAnimationOptions): Animation {
    const animation = { cancel: vi.fn(() => { this.offset = 0; }), onfinish: null as (() => void) | null };
    this.animations.push({ frames, options, animation }); return animation as unknown as Animation;
  }
}
const descendants = (node: Node): Node[] => [node, ...node.children.flatMap(descendants)];
const find = (node: Node, debug: string): Node | undefined => descendants(node).find(child => child.dataset.debug === debug);
let sidebar: PlayersSidebar | undefined;
beforeEach(() => {
  resetPreferenceCache(); setReducedMotion(false);
  vi.spyOn(textCards, 'attachTextCards').mockReturnValue(() => {});
  vi.stubGlobal('document', { createElement: () => new Node() });
});
afterEach(() => { sidebar?.dispose(); sidebar = undefined; resetPreferenceCache(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.each(['2d', '3d'] as const)('%s shared sidebar', renderMode => {
  function mount(seats: readonly Seat[]) {
    mode = renderMode; const host = new Node(), select = vi.fn();
    sidebar = new PlayersSidebar(host as unknown as HTMLElement, null, select); sidebar.render(view(seats));
    const list = find(host, 'online:seats')!;
    return { host, select, list, order: () => list.children.map(row => row.dataset.debug) };
  }
  it('updates HP order synchronously and animates retained rows without restarting on unchanged pushes or duplicating input', () => {
    const seats = [seat('s0', 70), seat('s1', 100), seat('s2', 50)];
    const { list, select, order } = mount(seats);
    expect(order()).toEqual(['online:seat:s1', 'online:seat:s0', 'online:seat:s2']);
    const me = find(list, 'online:seat:s0')!, other = find(list, 'online:seat:s1')!;
    expect(me.animations).toHaveLength(0);
    const changed = [seats[0], { ...seats[1], hp: 40 }, seats[2]];
    sidebar!.render(view(changed));
    expect(order()).toEqual(['online:seat:s0', 'online:seat:s2', 'online:seat:s1']);
    expect(find(list, 'online:seat:s0')).toBe(me);
    expect(me.animations[0].frames[0]).toEqual({ transform: 'translate(0px, 60px)' });
    expect(me.animations[0].options.duration).toBe(220);
    sidebar!.render(view(changed));
    expect(me.animations).toHaveLength(1);
    expect(me.animations[0].animation.cancel).not.toHaveBeenCalled();
    me.fire('click'); expect(select.mock.calls).toEqual([['s0']]);
    const preventDefault = vi.fn(); me.fire('keydown', { key: 'Enter', preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce(); expect(select.mock.calls).toEqual([['s0'], ['s0']]);
    sidebar!.setViewing('s0'); expect(me.attributes.get('aria-pressed')).toBe('true');
    // A second HP change during the move starts at the visible (partway) location.
    me.offset = 30;
    sidebar!.render(view([seat('s0', 10), ...changed.slice(1)]));
    expect(order()).toEqual(['online:seat:s2', 'online:seat:s1', 'online:seat:s0']);
    expect(me.animations[0].animation.cancel).toHaveBeenCalledOnce();
    expect(me.animations[1].frames[0]).toEqual({ transform: 'translate(0px, -90px)' });
    expect(other.animations[0].animation.cancel).toHaveBeenCalledOnce();
    sidebar!.dispose(); sidebar = undefined;
    expect(me.animations[1].animation.cancel).toHaveBeenCalledOnce();
  });
  it('lights another player from an injected public streak, retains the effect across pushes, and clears it on loss/missing data/elimination', () => {
    const me = seat('s0', 90), other = seat('s1', 70, { streak: { kind: 'win', count: 4 } });
    const { host, list, order } = mount([me, other]);
    const flame = find(host, 'online:streak:s1')!;
    expect(flame).toBeDefined(); expect(flame.attributes.get('aria-hidden')).toBe('true');
    const portrait = flame.parent!;
    expect(portrait.className).toBe('seat-portrait');
    expect(portrait.children[0].className).toBe('seat-avatar');
    expect(find(host, 'online:seat:s1')!.dataset.textCard).toContain('4 连胜');
    expect(find(host, 'online:streak:s0')).toBeUndefined();
    sidebar!.render(view([me, { ...other, hp: 95, streak: { kind: 'win', count: 5 } }]));
    expect(find(host, 'online:streak:s1')).toBe(flame);
    expect(order()).toEqual(['online:seat:s1', 'online:seat:s0']);
    for (const streak of [{ kind: 'loss', count: 6 }, { kind: 'win', count: 3 }, undefined] as const) {
      sidebar!.render(view([me, { ...other, streak }]));
      expect(find(host, 'online:streak:s1')).toBeUndefined();
      expect(find(host, 'online:seat:s1')!.dataset.textCard).not.toContain('连胜');
    }
    sidebar!.render(view([me, { ...other, alive: false, rank: 8 }]));
    expect(list.children.at(-1)!.classList.contains('eliminated')).toBe(true);
    expect(find(host, 'online:streak:s1')).toBeUndefined();
    // Private-looking/nested data cannot accidentally reveal another player's streak.
    sidebar!.render(view([me, { ...seat('s1', 70), publicBoard: { units: [], streak: { kind: 'win', count: 8 } } } as Seat]));
    expect(find(host, 'online:streak:s1')).toBeUndefined();
  });
  it('respects reduced motion, cleans a stale opponent mark, and removes vanished seats', () => {
    const seats = [seat('s0', 90), seat('s1', 70)];
    const { list, order } = mount(seats);
    sidebar!.render({ ...view(seats), opponentSeatId: 's1' });
    const other = find(list, 'online:seat:s1')!;
    expect(other.dataset.pairing).toBe('opponent');
    setReducedMotion(true); sidebar!.render(view([seats[0], { ...seats[1], hp: 100 }]));
    expect(other.dataset.pairing).toBeUndefined(); expect(other.animations).toHaveLength(0);
    expect(order()).toEqual(['online:seat:s1', 'online:seat:s0']);
    sidebar!.render(view([seats[0]])); expect(order()).toEqual(['online:seat:s0']);
  });
});

it('has no CSS self-pinning in either mode and places the flame outside the clipped portrait', () => {
  const css = readFileSync('src/style.css', 'utf8');
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (rule[1].includes('.online-seat')) expect(rule[2]).not.toMatch(/(?:^|;)\s*order\s*:/);
  }
  expect(css).toContain('#online-sidebar .seat-portrait { grid-area: avatar; }');
  expect(css).toMatch(/\.seat-streak-fire\s*\{[^}]*pointer-events:\s*none/);
  expect(css).toContain('@media (prefers-reduced-motion: reduce) { .seat-streak-fire::before, .seat-streak-fire::after { animation: none; } }');
});
