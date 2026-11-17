import { describe, expect, it } from 'vitest';
import * as rc from '../dev/castcmp/real-combat';
import { createBatch1VfxEvents, type Batch1Visual } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { MALZAHAR_EDGE_COUNTS, MALZAHAR_EDGE_TIMING, malzaharEdgeSpots } from '../src/rendering/three-mode/vfx-ltk/malzahar-edges';
import { mapSkillTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { skipOf } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { effectImportance } from '../src/rendering/three-mode/effect-budget';
import { MALZAHAR_3STAR_GATE_TICKS } from '../src/simulation/cast-windup';

// Malzahar at 3 stars (Fable 11-17): walls on both side edges, every other row from the bottom up, swirls in an "M", and
// the gate's hits on each enemy when its damage lands. Presentation only.
const center = ({ row, col }: { row: number; col: number }) => [col * 10 + (row % 2) * 5, 0, row * 10] as const;

describe('Malzahar 3 stars: the board spots', () => {
  const spots = malzaharEdgeSpots({ rows: 8, columns: 7 }, center);
  const walls = spots.filter(s => s.group === 'wall'), rings = spots.filter(s => s.group === 'swirl');
  const sides = (list: typeof spots) => [list.filter(s => s.point[0] < 30), list.filter(s => s.point[0] > 30)];
  it('clusters evenly along both side edges, bottom row to top row, each next one up later', () => {
    expect(walls).toHaveLength(2 * MALZAHAR_EDGE_COUNTS.walls);
    for (const side of sides(walls)) {
      expect(side).toHaveLength(MALZAHAR_EDGE_COUNTS.walls);
      expect(side[0]!.point[2]).toBe(70); expect(side.at(-1)!.point[2]).toBe(0);
      const gaps = side.slice(1).map((s, k) => side[k]!.point[2] - s.point[2]);
      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!);
      expect(side[0]!.delay).toBe(MALZAHAR_EDGE_TIMING.first); expect(side.at(-1)!.delay).toBe(MALZAHAR_EDGE_TIMING.last);
      for (let k = 1; k < side.length; k++) expect(side[k]!.delay).toBeGreaterThan(side[k - 1]!.delay);
    }
    // On the board's outer line: the left side at the leftmost x the edge column reaches, the right at the rightmost.
    expect(new Set(sides(walls)[0]!.map(s => s.point[0]))).toEqual(new Set([0]));
    expect(new Set(sides(walls)[1]!.map(s => s.point[0]))).toEqual(new Set([65]));
  });
  it('a ring with each of the lowest clusters, at its height and moment, nearer the middle the lower it is', () => {
    expect(rings).toHaveLength(2 * MALZAHAR_EDGE_COUNTS.rings);
    for (const ring of rings) expect(walls.some(w => w.point[2] === ring.point[2] && w.delay === ring.delay)).toBe(true);
    const [left, right] = sides(rings);
    for (let k = 1; k < left!.length; k++) expect(left![k]!.point[0]).toBeLessThan(left![k - 1]!.point[0]);
    for (let k = 1; k < right!.length; k++) expect(right![k]!.point[0]).toBeGreaterThan(right![k - 1]!.point[0]);
  });
  it('no spots on a board too small to have edges', () => {
    expect(malzaharEdgeSpots({ rows: 1, columns: 7 }, center)).toEqual([]);
  });
});

describe('cues on board spots (TimelineCue.spots)', () => {
  const wall: TimelineCue = { system: 'w', action: 'cast', event: 'hit', spots: 'wall', delay: 0.1, duration: 1 };
  it('one spawn per spot of its group, at the spot, its delay added', () => {
    const spots = [{ point: [1, 0, 2] as const, delay: 0.3, group: 'wall' }, { point: [5, 0, 6] as const, delay: 0, group: 'swirl' }, { point: [3, 0, 4] as const, delay: 0.5, group: 'wall' }];
    const { spawns, unsupported } = mapSkillTimeline([wall], 'me', [], undefined, spots);
    expect(unsupported).toEqual([]);
    expect(spawns.map(s => [s.point, s.delay, s.spot])).toEqual([[[1, 0, 2], 0.4, 0], [[3, 0, 4], 0.6, 2]]);
  });
  it('without spots (or with broken ones) it does not play', () => {
    expect(mapSkillTimeline([wall], 'me', ['foe']).unsupported.map(u => u.reason)).toEqual(['missing-point']);
    expect(mapSkillTimeline([wall], 'me', [], undefined, [{ point: [NaN, 0, 0], delay: 0, group: 'wall' }]).spawns).toEqual([]);
  });
  it('a decorative rank gives way on a full board', () => {
    expect(effectImportance({ event: 'hit', rank: 'decorative' })).toBe('decorative');
  });
});

describe('a run started into its system (TimelineCue.skip)', () => {
  const prepared = { model: { emitters: [{ name: 'a', timeBeforeFirstEmission: 0 }, { name: 'hit', timeBeforeFirstEmission: 0.4 }, { name: 'late', timeBeforeFirstEmission: 0.9 }] } } as never;
  it('`shown` starts where the first emitter it shows starts', () => {
    expect(skipOf({ skip: 'shown', show: ['hit', 'late'] }, prepared)).toBeCloseTo(0.4);
    expect(skipOf({ skip: 'shown' }, prepared)).toBe(0);
  });
  it('a number as given, held to 0..2; none is 0', () => {
    expect(skipOf({ skip: 0.25 }, prepared)).toBe(0.25);
    expect(skipOf({ skip: 5 }, prepared)).toBe(2);
    expect(skipOf({}, prepared)).toBe(0);
  });
  it("the 3-star hit shows only the gate's hit layers, from where they start", () => {
    const [hit] = CUE_EXTRA_SKILLS['malzahar-3star-hit']!;
    expect(hit!.skip).toBe('shown');
    expect(hit!.show?.length).toBeGreaterThan(0);
    // The 3-star cast list has no gate under its targets: the hits come from the damage.
    expect(CUE_EXTRA_SKILLS['malzahar-3star']!.filter(c => c.system === '10e4e326' && !c.spots)).toEqual([]);
  });
});

// A real Malzahar combat replayed through the event planner one tick per batch.
function malzaharCombat(star: number) {
  const units = rc.realUnits({ unit: 'malzahar', star, form: null, foe: 'amumu', dist: 2, nfoes: 3, foestar: 2 } as never);
  const events: any[][] = [];
  const run = rc.runRealCombat(units, 60, (_s, shown) => { events.push(shown); });
  const ids = new Map(units.map((u: any) => [u.id, u.definitionId]));
  const stars = new Map(units.map((u: any) => [u.id, u.starLevel]));
  const planner = createBatch1VfxEvents(id => ids.get(id), id => stars.get(id));
  const plays: { tick: number; visual: Batch1Visual }[] = [];
  events.forEach((batch, tick) => { for (const plan of planner.batch(batch)) for (const visual of plan.extra) if (visual.skill === 'malzahar-3star-hit') plays.push({ tick, visual }); });
  return { events, castTick: run.castIndex, plays };
}

describe("Malzahar 3 stars: the gate's hits play on the damage", () => {
  it('on each enemy the gate strikes, on the tick its damage lands, once', () => {
    const { events, castTick, plays } = malzaharCombat(3);
    expect(plays.length).toBeGreaterThan(0);
    const tick = castTick + MALZAHAR_3STAR_GATE_TICKS;
    expect(new Set(plays.map(p => p.tick))).toEqual(new Set([tick]));
    const struck = events[tick].filter((e: any) => e.type === 'packetDamage' && e.sourceId === 'me' && e.delivery === 'ability-direct').map((e: any) => e.targetId);
    expect(plays.map(p => p.visual.targets[0]).sort()).toEqual([...new Set(struck)].sort());
  });
  it('not at 1 or 2 stars', () => {
    expect(malzaharCombat(2).plays).toEqual([]);
    expect(malzaharCombat(1).plays).toEqual([]);
  });
});
