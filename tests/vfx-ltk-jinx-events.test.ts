import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { JINX_EVENT_SKILLS, JINX_EVENT_SYSTEMS, JINX_ROCKET_FLIGHT_TICKS as RENDER_FLIGHT, jinxSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jinx';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { JINX_CHOMPERS_TICKS, JINX_ROCKET_FLIGHT_TICKS, JINX_ROCKET_LAUNCH_TICKS } from '../src/simulation/cast-windup';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Jinx's rocket (flash, flight, explosion) and chompers' explosion play from the rules' events (11-21, rules 'jinx-rocket'
// and her chompers' landing), not at fixed times after her cast.
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
const damage = (tick: number, targetId: string, delivery = 'ability-direct') => ({ type: 'packetDamage', tick, eventSeq: tick * 10 + targetId.length, sourceId: 'jx', targetId,
  damageType: 'physical', sourceKind: 'ability', definitionId: 'jinx-ability', delivery, raw: 50, actual: 50 }) as unknown as DisplayCombatEvent;
const rocket = (type: 'abilityProjectileLaunched' | 'abilityProjectileLanded', tick: number) => ({ type, tick, eventSeq: tick, sourceId: 'jx', targetId: 'f1', skill: 'jinx-rocket',
  ordinal: 0, actionSeq: 1, count: 1, arrivalTick: tick + 10, hit: true }) as unknown as DisplayCombatEvent;

describe("Jinx's rocket and chompers follow the rules' events", () => {
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
    expect(CUE_EXTRA_SKILLS['jinx-rocket-fire']!.find(c => c.event === 'projectile')).toMatchObject({ travelSeconds: JINX_ROCKET_FLIGHT_TICKS * 0.05, location: 'board' });
  });
  it('rocket: flash and flight on its launch, explosion on its landing', () => {
    const { played, send } = harness();
    send([cast(10, 'rocket'), rocket('abilityProjectileLaunched', 37), rocket('abilityProjectileLanded', 47)]);
    expect(played.map(p => [p.skill, p.at])).toEqual([['jinx-rocket-fire', 37], ['jinx-rocket-boom', 47]]);
  });
  it('chompers: their explosion once on each enemy struck when they go off, at most three; never from her zap\'s cast-tick damage', () => {
    const { played, send } = harness();
    send([cast(10, 'zap'), damage(10, 'f1'), cast(20, 'chompers'), damage(61, 'f1'), damage(61, 'f2'), damage(61, 'f1'), damage(61, 'f3'), damage(61, 'f4'),
      damage(62, 'f1', 'basic-attack')]);
    expect(played.map(p => [p.skill, ...p.targets])).toEqual([['jinx-chompers-boom', 'f1'], ['jinx-chompers-boom', 'f2'], ['jinx-chompers-boom', 'f3']]);
  });
  it('catch-up draws nothing', () => {
    const { played, send } = harness();
    send([cast(20, 'chompers'), damage(61, 'f1')], false);
    expect(played).toEqual([]);
  });
  it('the next combat (cleared between) starts afresh: a combat that ended before her chompers went off leaves nothing behind', () => {
    const { played, send, bridge } = harness();
    send([cast(20, 'chompers')]); // the combat ends before they go off
    bridge.clear();
    send([damage(70, 'f1')]); // the next combat, no chompers cast of hers in it yet: her damage draws nothing
    expect(played).toEqual([]);
  });
  it('a replay that starts over (castcmp warm pass, a rewind) draws the explosion again on the same tick', () => {
    const { played, send } = harness();
    send([cast(20, 'chompers'), damage(61, 'f1'), cast(20, 'chompers'), damage(61, 'f1')]);
    expect(played.map(p => p.skill)).toEqual(['jinx-chompers-boom', 'jinx-chompers-boom']);
  });
});

describe("Jinx's rocket and chompers from the real rules", () => {
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
  it('second cast (chompers): the explosion when they go off, JINX_CHOMPERS_TICKS after the cast', () => {
    const { run, played } = playedFor(2);
    const booms = played.filter(p => p.skill === 'jinx-chompers-boom');
    expect(booms.length).toBeGreaterThan(0);
    expect(new Set(booms.map(b => b.tick))).toEqual(new Set([run.castIndex + JINX_CHOMPERS_TICKS]));
  });
  it('third cast (rocket): flash and flight on launch, explosion on landing', () => {
    const { run, played } = playedFor(3);
    expect(played.filter(p => p.skill.startsWith('jinx-rocket')).map(p => [p.skill, p.tick - run.castIndex]))
      .toEqual([['jinx-rocket-fire', JINX_ROCKET_LAUNCH_TICKS], ['jinx-rocket-boom', JINX_ROCKET_LAUNCH_TICKS + JINX_ROCKET_FLIGHT_TICKS]]);
  });
});
