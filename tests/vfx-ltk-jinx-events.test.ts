import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { JINX_ROCKET_EPICENTER, createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { JINX_EVENT_SKILLS, JINX_EVENT_SYSTEMS, JINX_ROCKET_DRAWN, JINX_ROCKET_FLOWN, JINX_ROCKET_FLIGHT_TICKS as RENDER_FLIGHT, jinxRocketTimes, jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
import { arrivedShareAt, movementOf } from '../src/rendering/three-mode/vfx-ltk/engine/model/missileSteps';
import { projectileFlight } from '../src/rendering/three-mode/vfx-ltk/particles';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { JINX_ROCKET_FLIGHT_TICKS, JINX_ROCKET_LAUNCH_TICKS } from '../src/simulation/cast-windup';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Jinx's rocket (flash, flight, explosion) plays from the rules' events (11-21, rules 'jinx-rocket'), not at fixed times
// after her cast.
type Played = { skill: string; targets: readonly string[]; at: number };
function harness() {
  const played: Played[] = []; let at = 0;
  const bridge = createBatch2VfxBridge({
    unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel: 2, alive: true }), board: () => null,
    play: (_c, _s, targets, _a, context) => { played.push({ skill: context.skill!, targets, at }); return true; },
  });
  return { played, send: (events: DisplayCombatEvent[], current = true) => { for (const e of events) { at = (e as { tick: number }).tick; bridge.event(e, current); } }, bridge };
}
const cast = (tick: number, branch: string, targetIds = ['f1']) => ({ type: 'cast', sourceId: 'jx', eventSeq: tick, tick, actionSeq: tick, completed: true, actualManaSpent: 60,
  refundedMana: 0, targetIds, completionCell: { col: 3, row: 5 }, branch: { branch } }) as unknown as DisplayCombatEvent;
const rocket = (type: 'abilityProjectileLaunched' | 'abilityProjectileLanded', tick: number) => ({ type, tick, eventSeq: tick, sourceId: 'jx', targetId: 'f1', skill: 'jinx-rocket',
  ordinal: 0, actionSeq: 1, count: 1, arrivalTick: tick + 10, hit: true }) as unknown as DisplayCombatEvent;

describe("Jinx's rocket follows the rules' events", () => {
  it('catch-up draws nothing', () => {
    const { played, send } = harness();
    send([cast(10, 'rocket'), rocket('abilityProjectileLaunched', 37), rocket('abilityProjectileLanded', 47)], false);
    expect(played).toEqual([]);
  });
  it('her chompers stay timed from her cast (their explosion in her cast list, chompers branch)', () => {
    expect(CUE_OVERRIDES.jinx!.find(c => c.system === 'cd05488e')).toMatchObject({ branch: 'chompers', event: 'hit' });
  });
  it('her cast list keeps only what starts with the cast; the rest are their own branches, at no delay', () => {
    expect(CUE_OVERRIDES.jinx!.some(c => JINX_EVENT_SYSTEMS.includes(c.system))).toBe(false);
    for (const skill of JINX_EVENT_SKILLS) {
      expect(CUE_EXTRA_SKILLS[skill]).toBe(jinxSkills[skill]);
      expect(CUE_EXTRA_SKILLS[skill]!.every(c => c.delay === 0 && c.branch === undefined)).toBe(true);
    }
    expect(JINX_EVENT_SKILLS.flatMap(s => CUE_EXTRA_SKILLS[s]!.map(c => c.system)).sort()).toEqual([...JINX_EVENT_SYSTEMS].sort());
  });
  it('the rocket flies the rules\' flight (mirrored) to the board\'s centre', () => {
    expect(RENDER_FLIGHT).toBe(JINX_ROCKET_FLIGHT_TICKS);
    expect(CUE_EXTRA_SKILLS['jinx-rocket-flight']!.find(c => c.event === 'projectile')).toMatchObject({ travelSeconds: JINX_ROCKET_FLIGHT_TICKS * 0.05, location: 'board' });
  });
  it('rocket: flash and flight queued on its launch, explosion on its landing', () => {
    const { played, send } = harness();
    send([cast(10, 'rocket'), rocket('abilityProjectileLaunched', 37), rocket('abilityProjectileLanded', 47)]);
    expect(played.map(p => [p.skill, p.at])).toEqual([['jinx-rocket-flash', 37], ['jinx-rocket-flight', 37], ['jinx-rocket-boom', 47]]);
  });
});

const FRAME = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 } };
const point = (row: number, col: number, y = 0) => [35 + 34 * Math.sqrt(3) * (col + (row % 2) / 2), y, 50 + 34 * 1.5 * row];
describe("Jinx's rocket from the real rules", () => {
  const playedFor = (castIndex: number) => {
    const units = realUnits({ unit: 'jinx', star: 2, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 3, ally: 'amumu', allystar: 2, allyCell: { row: 3, col: 2 } } as never);
    const shown: DisplayCombatEvent[][] = [];
    const run = runRealCombat(units, 60, (_s, events) => shown.push(events as DisplayCombatEvent[]), castIndex);
    const played: { skill: string; tick: number; board: unknown }[] = []; let tick = 0;
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: units.find((u: any) => u.id === id)?.definitionId ?? 'amumu', form: 'front', starLevel: 2, alive: true }),
      board: () => FRAME as never, play: (_c, _s, _t, _a, context) => { played.push({ skill: context.skill!, tick, board: context.board }); return true; } });
    shown.forEach((events, at) => { tick = at; bridge.begin(events); for (const event of events) bridge.event(event, true); });
    return { run, played, shown };
  };
  it('third cast (rocket): flash and flight on launch, explosion on landing', () => {
    const { run, played } = playedFor(3);
    expect(played.filter(p => p.skill.startsWith('jinx-rocket')).map(p => [p.skill, p.tick - run.castIndex]))
      .toEqual([['jinx-rocket-flash', JINX_ROCKET_LAUNCH_TICKS], ['jinx-rocket-flight', JINX_ROCKET_LAUNCH_TICKS], ['jinx-rocket-boom', JINX_ROCKET_LAUNCH_TICKS + JINX_ROCKET_FLIGHT_TICKS]]);
  });
  it('real rules: the rocket explodes on the cell the rules name (their marker once it is there; the board\'s centre before)', () => {
    const { played, shown } = playedFor(3);
    const marker = shown.flat().find(e => e.type === 'abilityMarker' && (e.marker as string) === JINX_ROCKET_EPICENTER) as { cell: { row: number; col: number } } | undefined;
    // Her side's centre cell: where the rules explode it today, and the cell their marker names for her side.
    const cell = marker?.cell ?? { row: 3, col: 3 };
    expect(cell).toEqual({ row: 3, col: 3 });
    expect(played.find(p => p.skill === 'jinx-rocket-boom')!.board).toEqual(point(cell.row, cell.col));
  });
  it('the rocket flies to, and explodes on, the cell the rules\' marker names (either side); without a marker, the board\'s centre', () => {
    const plays: { skill: string; board: unknown }[] = [];
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel: 2, alive: true }), board: () => FRAME as never,
      play: (_c, _s, _t, _a, context) => { plays.push({ skill: context.skill!, board: context.board }); return true; } });
    // A hand-built marker, by the rules change's name and fields (the rules emit it only once that change is in).
    const marker = (tick: number, cell: { row: number; col: number }) => ({ type: 'abilityMarker', tick, eventSeq: tick, unitId: 'jx', marker: JINX_ROCKET_EPICENTER, cell,
      arrivalTick: tick + 10 }) as unknown as DisplayCombatEvent;
    const batch = (events: DisplayCombatEvent[]) => { bridge.begin(events); for (const e of events) bridge.event(e, true); };
    // The marker comes after the launch in its tick, as the rules push them; the launch still aims at its cell.
    batch([rocket('abilityProjectileLaunched', 37), marker(37, { row: 4, col: 3 })]); batch([rocket('abilityProjectileLanded', 47)]);
    batch([rocket('abilityProjectileLaunched', 57)]); batch([rocket('abilityProjectileLanded', 67)]);
    expect(plays.map(p => [p.skill, p.board])).toEqual([
      ['jinx-rocket-flash', point(4, 3)], ['jinx-rocket-flight', point(4, 3, JINX_ROCKET_DRAWN.aimLift)], ['jinx-rocket-boom', point(4, 3)],
      ['jinx-rocket-flash', point(3, 3)], ['jinx-rocket-flight', point(3, 3, JINX_ROCKET_DRAWN.aimLift)], ['jinx-rocket-boom', point(3, 3)]]);
  });
  it('a landed rocket\'s cell and the last combat\'s marks are forgotten: a later rocket without a marker lands at the centre', () => {
    const plays: { skill: string; board: unknown; flight?: number }[] = [];
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel: 2, alive: true }), board: () => FRAME as never,
      play: (_c, _s, _t, _a, context) => { plays.push({ skill: context.skill!, board: context.board, flight: context.flightSeconds }); return true; } });
    const marker = (tick: number, cell: { row: number; col: number }) => ({ type: 'abilityMarker', tick, eventSeq: tick, unitId: 'jx', marker: JINX_ROCKET_EPICENTER, cell,
      arrivalTick: tick + 10 }) as unknown as DisplayCombatEvent;
    const batch = (events: DisplayCombatEvent[]) => { bridge.begin(events); for (const e of events) bridge.event(e, true); };
    const booms = () => plays.filter(p => p.skill === 'jinx-rocket-boom').map(p => p.board);
    // Landed: its cell is dropped, so the same caster and landing tick again (a replay drawn over) without a marker lands at the centre.
    batch([rocket('abilityProjectileLaunched', 37), marker(37, { row: 4, col: 3 })]); batch([rocket('abilityProjectileLanded', 47)]);
    batch([rocket('abilityProjectileLaunched', 37)]); batch([rocket('abilityProjectileLanded', 47)]);
    expect(booms()).toEqual([point(4, 3), point(3, 3)]);
    // clear() (a new combat): a marked rocket that never landed, and her last cast cell, are both forgotten.
    plays.length = 0;
    batch([cast(10, 'rocket'), rocket('abilityProjectileLaunched', 37), marker(37, { row: 4, col: 3 })]);
    bridge.clear();
    batch([rocket('abilityProjectileLaunched', 37)]); batch([rocket('abilityProjectileLanded', 47)]);
    const flights = plays.filter(p => p.skill === 'jinx-rocket-flight');
    // Before clear(): from her cast cell (5, 3) to (4, 3), one cell. After: no cast cell known, drawn as a zero-cell flight.
    expect(flights.map(p => p.flight)).toEqual([jinxRocketTimes(2, 1, 0.5).flight, jinxRocketTimes(2, 0, 0.5).flight]);
    expect(booms()).toEqual([point(3, 3)]);
  });
  it('fired, the rocket flies even if she dies before it is drawn leaving; only its muzzle flash goes with her', () => {
    const plays: { skill: string; context: { outlivesSource?: boolean; cancelWithSource?: boolean } }[] = [];
    // Three stars with no cast cell known (a zero-cell flight): her flash still waits after the launch.
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel: 3, alive: true }), board: () => FRAME as never,
      play: (_c, _s, _t, _a, context) => { plays.push({ skill: context.skill!, context }); return true; } });
    expect(jinxRocketTimes(3, 0, 0.5).flashAt).toBeGreaterThan(0);
    for (const e of [rocket('abilityProjectileLaunched', 37)]) bridge.event(e, true);
    const flash = plays.find(p => p.skill === 'jinx-rocket-flash')!.context, flight = plays.find(p => p.skill === 'jinx-rocket-flight')!.context;
    expect(flash.cancelWithSource).toBe(true);
    expect(flight).toMatchObject({ outlivesSource: true });
    expect(flight.cancelWithSource).toBeUndefined();
  });
  it('the rocket leaves the barrel after its flash, flies in and waits, reaching the landing point on the rules\' landing tick', () => {
    const plays: { skill: string; delay?: number; flight?: number; arrive?: number; at: number }[] = []; let tick = 0;
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel: 2, alive: true }), board: () => FRAME as never,
      play: (_c, _s, _t, _a, context) => { plays.push({ skill: context.skill!, delay: context.delay, flight: context.flightSeconds, arrive: context.arriveShare, at: tick }); return true; } });
    // She casts from (5, 3); the rocket lands at the board's centre (3, 3), two cells ahead.
    for (const e of [cast(10, 'rocket'), rocket('abilityProjectileLaunched', 37), rocket('abilityProjectileLanded', 47)]) { tick = (e as { tick: number }).tick; bridge.event(e, true); }
    const total = 10 * 0.05, times = jinxRocketTimes(2, 2, total);
    const [flash, body, boom] = plays;
    expect(body).toMatchObject({ skill: 'jinx-rocket-flight', at: 37 });
    expect(body!.flight).toBeCloseTo(times.flight, 9);
    expect(body!.delay ?? 0).toBeCloseTo(times.leaves, 9);
    expect(body!.arrive).toBeCloseTo(times.arriveShare, 9);
    expect(flash!.delay ?? 0).toBeCloseTo(times.flashAt, 9);
    // Its body reaches the landing point on the rules' landing tick, where the explosion plays with no delay.
    expect((body!.delay ?? 0) + body!.flight!).toBeCloseTo(total, 9);
    expect(boom).toMatchObject({ skill: 'jinx-rocket-boom', at: 47, delay: undefined });
  });

  it('leaves the barrel later after its flash below three stars, flies cells at a steady pace and waits, timed back from the landing', () => {
    const { leaveAfterFlash, cellsPerSecond, wait } = JINX_ROCKET_FLOWN, total = 10 * 0.05;
    // Three stars, a cell away: flash, leave, fly the cell, wait, land on the rules' tick.
    const near = jinxRocketTimes(3, 1, total), flying = 1 / cellsPerSecond;
    expect(near.flashAt).toBeCloseTo(total - wait - flying - leaveAfterFlash.threeStar, 9);
    expect(near.leaves - near.flashAt).toBeCloseTo(leaveAfterFlash.threeStar, 9);
    expect(near.leaves + near.flight).toBeCloseTo(total, 9);
    expect(near.flight * near.arriveShare).toBeCloseTo(flying, 9);
    // Below three stars it leaves later after the flash; a cell away the flash comes on the launch and the wait gives.
    for (const star of [1, 2]) {
      const two = jinxRocketTimes(star, 1, total);
      expect(two.flashAt).toBe(0);
      expect(two.leaves).toBeCloseTo(leaveAfterFlash.belowThree, 9);
      expect(two.flight * two.arriveShare).toBeCloseTo(flying, 9);
      expect(two.leaves + two.flight).toBeCloseTo(total, 9);
    }
    // Far away it has no time to wait: it flies faster, reaching the landing point on the landing tick.
    const far = jinxRocketTimes(2, 6, total);
    expect(far.flashAt).toBe(0); expect(far.arriveShare).toBe(1); expect(far.leaves + far.flight).toBeCloseTo(total, 9);
    // A landing at the launch: nothing before it, nothing to fly.
    const none = jinxRocketTimes(3, 2, 0);
    expect(none).toEqual({ flashAt: 0, leaves: 0, flight: 0, arriveShare: 1 });
  });

  it('the rocket flies in at a steady pace and waits at the landing point, landing as its flight runs out', () => {
    expect(arrivedShareAt(0, 1, 0.5)).toBe(0);
    expect(arrivedShareAt(0.25, 1, 0.5)).toBeCloseTo(0.5, 9);
    expect(arrivedShareAt(0.5, 1, 0.5)).toBe(1);
    expect(arrivedShareAt(0.9, 1, 0.5)).toBe(1);
    // The engine's movement walks that path (made-up distance), stays at the target and only then counts as arrived.
    const move = movementOf({ kind: 'fixedTimeThenHold', travelTime: 0.5, arriveShare: 0.6 }, [0, 0, 0], [0, 0, 1000]);
    let position: [number, number, number] = [0, 0, 0];
    const at: number[] = [], arrived: boolean[] = [];
    for (let step = 1; step <= 10; step++) {
      const tick = move.step(position, step * 0.05, 0.05);
      position = [position[0] + tick.displacement[0], position[1] + tick.displacement[1], position[2] + tick.displacement[2]];
      at.push(position[2]); arrived.push(tick.arrived);
    }
    expect(at[2]).toBeCloseTo(500, 6); // 0.15 s, half its 0.3 s way in
    expect(at[5]).toBeCloseTo(1000, 6); // 0.3 s: there
    expect(at[8]).toBeCloseTo(1000, 6); // waiting
    expect(arrived.slice(0, 9).some(Boolean)).toBe(false);
    expect(arrived[9]).toBe(true);
    // A cue projectile played this way flies that movement (TimelineCue.arriveShare); one played without stays a plain fixed time.
    expect(projectileFlight(0.5, undefined, undefined, 0.6).movement).toEqual({ kind: 'fixedTimeThenHold', travelTime: 0.5, arriveShare: 0.6 });
    expect(projectileFlight(0.5).movement).toEqual({ kind: 'fixedTime', travelTime: 0.5 });
  });

  it('every rocket flight is played flying in and waiting, by star', () => {
    for (const starLevel of [1, 3]) {
      const plays: { skill: string; arrive?: number; delay?: number; flight?: number }[] = [];
      const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel, alive: true }), board: () => FRAME as never,
        play: (_c, _s, _t, _a, context) => { plays.push({ skill: context.skill!, arrive: context.arriveShare, delay: context.delay, flight: context.flightSeconds }); return true; } });
      for (const e of [cast(10, 'rocket'), rocket('abilityProjectileLaunched', 37)]) bridge.event(e, true);
      const body = plays.find(play => play.skill === 'jinx-rocket-flight')!, flash = plays.find(play => play.skill === 'jinx-rocket-flash')!;
      const times = jinxRocketTimes(starLevel, 2, 0.5);
      expect(body.arrive).toBeCloseTo(times.arriveShare, 9);
      expect(body.flight).toBeCloseTo(times.flight, 9);
      expect(body.delay ?? 0).toBeCloseTo(times.leaves, 9);
      expect(flash.delay ?? 0).toBeCloseTo(times.flashAt, 9);
    }
  });
});
