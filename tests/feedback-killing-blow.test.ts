import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCombatFeedbackRenderer, type FeedbackAnchor } from '../src/stats/combat-feedback-renderer';
import type { SceneCombatEvent } from '../src/presentation/combat-display';

// A unit's piece is hidden the frame it dies (BoardScene syncCombat runs before the frame's events reach the floats), so its
// killing blow's number had no anchor and never showed (11-24, Sevika's punch: 715 at the tick that killed her target).
// A fallen unit now keeps its numbers where it last stood; a unit hidden for any other reason still shows none.
class Element {
  children: Element[] = []; parent: Element | null = null; className = ''; hidden = false; textContent = '';
  style: Record<string, string> = {};
  constructor(readonly tag = 'div') {}
  get offsetWidth() { return this.hidden ? 0 : this.textContent.length * 9; }
  get clientWidth() { return 480; }
  get clientHeight() { return 520; }
  setAttribute() {}
  append(child: Element) { child.remove(); child.parent = this; this.children.push(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}
afterEach(() => vi.unstubAllGlobals());
function setup() {
  vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag) });
  const host = new Element(), floats = createCombatFeedbackRenderer(host as unknown as HTMLElement);
  const shown = () => (host.children[0]?.children ?? []).filter(e => !e.hidden).map(e => e.textContent);
  return { floats, shown };
}
const packet = (tick: number, targetId: string, hpDamage: number, killingPacket = false, delivery = 'ability-direct') => ({ type: 'packetDamage', tick, eventSeq: tick,
  sourceId: 'me', targetId, damageType: 'physical', hpDamage, absorbed: 0, critical: false, hit: true, killingPacket, delivery }) as unknown as SceneCombatEvent;
const death = (tick: number, unitId: string) => ({ type: 'death', tick, eventSeq: tick + 0.5, unitId }) as unknown as SceneCombatEvent;
const at = (x: number): FeedbackAnchor => ({ x, y: 100, radius: 20 });

describe('a killing blow\'s number shows where its target fell', () => {
  it('Sevika\'s punch tick: the killing packets add up to one number that shows, though her target\'s piece is already gone', () => {
    const { floats, shown } = setup();
    floats.render(0, new Map([['foe', at(200)], ['foe2', at(300)]]));
    // Tick 119 as the rules sent it: 691 and the killing 24, nine empty packets of the same punch and an empty attack packet.
    floats.push([packet(119, 'foe', 691), packet(119, 'foe', 24, true), ...Array.from({ length: 9 }, () => packet(119, 'foe', 0)),
      packet(119, 'foe', 0, false, 'basic-attack'), death(119, 'foe')], 1750);
    // Her piece is hidden by now (no anchor this frame).
    floats.render(1760, new Map([['foe2', at(300)]]));
    expect(shown()).toEqual(['715']);
  });
  it('a number already floating over a unit when it dies goes on to the end of its life', () => {
    const { floats, shown } = setup();
    floats.push([packet(10, 'foe', 50, false, 'basic-attack')], 500);
    floats.render(510, new Map([['foe', at(200)]]));
    expect(shown()).toEqual(['50']);
    floats.push([death(12, 'foe')], 600);
    for (const t of [610, 900, 1150]) { floats.render(t, new Map()); expect(shown(), `at ${t}`).toEqual(['50']); }
    floats.render(10_000, new Map());
    expect(shown()).toEqual([]);
  });
  it('a unit hidden for another reason (no death) still shows no number', () => {
    const { floats, shown } = setup();
    floats.render(0, new Map([['benched', at(100)]]));
    floats.push([packet(5, 'benched', 30)], 100);
    floats.render(110, new Map());
    expect(shown()).toEqual([]);
  });
  it('a fallen unit seen again (a revive, a new combat) is no longer fallen: hidden later for another reason, it shows none', () => {
    const { floats, shown } = setup();
    floats.render(0, new Map([['foe', at(200)]]));
    floats.push([death(3, 'foe')], 100);
    floats.render(110, new Map());
    floats.render(200, new Map([['foe', at(220)]]));
    floats.push([packet(9, 'foe', 40)], 300);
    floats.render(310, new Map([['foe', at(220)]]));
    expect(shown()).toEqual(['40']);
    floats.render(320, new Map());
    expect(shown()).toEqual([]);
  });
  it('reset forgets who fell and where: after it, a fallen unit hit with no anchor shows no number', () => {
    const { floats, shown } = setup();
    floats.render(0, new Map([['foe', at(200)]]));
    floats.push([death(3, 'foe')], 100);
    floats.render(110, new Map());
    floats.reset();
    floats.push([packet(20, 'foe', 70)], 1000);
    floats.render(1010, new Map());
    expect(shown()).toEqual([]);
  });
  it('a killing packet shows its full amount (the HP it took plus its overkill), not just the target\'s last HP', () => {
    const { floats, shown } = setup();
    floats.render(0, new Map([['foe', at(200)]]));
    floats.push([{ ...(packet(30, 'foe', 30, true) as object), overkill: 500 } as unknown as SceneCombatEvent, death(30, 'foe')], 400);
    floats.render(410, new Map());
    expect(shown()).toEqual(['530']);
  });
  it('overkill on a packet that is not the killing one changes nothing; a killing packet without it shows the HP it took', () => {
    const { floats, shown } = setup();
    floats.render(0, new Map([['foe', at(200)], ['foe2', at(300)]]));
    floats.push([{ ...(packet(30, 'foe', 40) as object), overkill: 300 } as unknown as SceneCombatEvent, packet(30, 'foe2', 24, true), death(30, 'foe2')], 400);
    floats.render(410, new Map([['foe', at(200)]]));
    expect(shown().sort()).toEqual(['24', '40']);
  });
});
