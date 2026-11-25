import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { JINX_EVENT_SKILLS, JINX_EVENT_SYSTEMS, JINX_ROCKET_DRAWN, JINX_ROCKET_FLIGHT_TICKS as RENDER_FLIGHT, jinxRocketFlightSeconds, jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
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

describe("Jinx's rocket from the real rules", () => {
  const playedFor = (castIndex: number) => {
    const units = realUnits({ unit: 'jinx', star: 2, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 3, ally: 'amumu', allystar: 2, allyCell: { row: 3, col: 2 } } as never);
    const shown: DisplayCombatEvent[][] = [];
    const run = runRealCombat(units, 60, (_s, events) => shown.push(events as DisplayCombatEvent[]), castIndex);
    const played: { skill: string; tick: number }[] = []; let tick = 0;
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: units.find((u: any) => u.id === id)?.definitionId ?? 'amumu', form: 'front', starLevel: 2, alive: true }),
      board: () => null, play: (_c, _s, _t, _a, context) => { played.push({ skill: context.skill!, tick }); return true; } });
    shown.forEach((events, at) => { tick = at; for (const event of events) bridge.event(event, true); });
    return { run, played };
  };
  it('third cast (rocket): flash and flight on launch, explosion on landing', () => {
    const { run, played } = playedFor(3);
    expect(played.filter(p => p.skill.startsWith('jinx-rocket')).map(p => [p.skill, p.tick - run.castIndex]))
      .toEqual([['jinx-rocket-flash', JINX_ROCKET_LAUNCH_TICKS], ['jinx-rocket-flight', JINX_ROCKET_LAUNCH_TICKS], ['jinx-rocket-boom', JINX_ROCKET_LAUNCH_TICKS + JINX_ROCKET_FLIGHT_TICKS]]);
  });
  it('the rocket flies to, and explodes on, the cell the rules land it on; without that cell, the board\'s centre', () => {
    const frame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 } };
    const plays: { skill: string; board: unknown }[] = [];
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel: 2, alive: true }), board: () => frame as never,
      play: (_c, _s, _t, _a, context) => { plays.push({ skill: context.skill!, board: context.board }); return true; } });
    const at = (e: DisplayCombatEvent, cell?: { row: number; col: number }) => (cell ? { ...(e as object), cell } : e) as DisplayCombatEvent;
    const point = (row: number, col: number, y = 0) => [35 + 34 * Math.sqrt(3) * (col + (row % 2) / 2), y, 50 + 34 * 1.5 * row];
    for (const e of [at(rocket('abilityProjectileLaunched', 37), { row: 1, col: 2 }), at(rocket('abilityProjectileLanded', 47), { row: 1, col: 2 })]) bridge.event(e, true);
    for (const e of [rocket('abilityProjectileLaunched', 57), rocket('abilityProjectileLanded', 67)]) bridge.event(e, true);
    expect(plays.map(p => [p.skill, p.board])).toEqual([
      ['jinx-rocket-flash', point(1, 2)], ['jinx-rocket-flight', point(1, 2, JINX_ROCKET_DRAWN.aimLift)], ['jinx-rocket-boom', point(1, 2)],
      ['jinx-rocket-flash', point(3, 3)], ['jinx-rocket-flight', point(3, 3, JINX_ROCKET_DRAWN.aimLift)], ['jinx-rocket-boom', point(3, 3)]]);
  });
  it('the rocket is drawn flying by distance and leaves the barrel that long before the landing tick, its flash just before; the landing tick is the rules\'', () => {
    expect(jinxRocketFlightSeconds(0)).toBe(JINX_ROCKET_DRAWN.minSeconds);
    expect(jinxRocketFlightSeconds(2)).toBeCloseTo(2 / JINX_ROCKET_DRAWN.cellsPerSecond, 9);
    expect(jinxRocketFlightSeconds(99)).toBe(JINX_ROCKET_DRAWN.maxSeconds);
    const frame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 35, y: 50 } };
    const plays: { skill: string; delay?: number; flight?: number; at: number }[] = []; let tick = 0;
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: id === 'jx' ? 'jinx' : 'amumu', form: 'front', starLevel: 2, alive: true }), board: () => frame as never,
      play: (_c, _s, _t, _a, context) => { plays.push({ skill: context.skill!, delay: context.delay, flight: context.flightSeconds, at: tick }); return true; } });
    // She casts from (5, 3); the rocket lands at the board's centre (3, 3), two cells ahead.
    for (const e of [cast(10, 'rocket'), rocket('abilityProjectileLaunched', 37), rocket('abilityProjectileLanded', 47)]) { tick = (e as { tick: number }).tick; bridge.event(e, true); }
    const total = 10 * 0.05, flight = jinxRocketFlightSeconds(2);
    const [flash, body, boom] = plays;
    expect(body).toMatchObject({ skill: 'jinx-rocket-flight', at: 37 });
    expect(body!.flight).toBeCloseTo(flight, 9);
    expect(body!.delay).toBeCloseTo(total - flight, 9);
    expect(flash!.delay).toBeCloseTo(total - flight - JINX_ROCKET_DRAWN.flashLead, 9);
    // Its body reaches the landing point on the rules' landing tick, where the explosion plays with no delay.
    expect(body!.delay! + body!.flight!).toBeCloseTo(total, 9);
    expect(boom).toMatchObject({ skill: 'jinx-rocket-boom', at: 47, delay: undefined });
  });

});
