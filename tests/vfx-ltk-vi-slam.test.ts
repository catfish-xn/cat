import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES, VI_HAND_TRAIL, VI_SLAM_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { S13_TIMELINES, VI_ROW_SHOCKWAVE } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Vi's landing group (light column, burst, hit, row shockwave) plays when the rules' slam lands (g22ViSlam), and her right
// hand's trail stops there; not at the export's fixed landing frame (11-21, Fable).
type Played = { skill: string; targets: readonly string[]; snapshot: boolean };
function harness(definition: (id: string) => string = id => (id === 'vi' ? 'vi' : 'amumu')) {
  const played: Played[] = [], stopped: { source: string; systems: readonly string[] }[] = [];
  const bridge = createBatch2VfxBridge({
    unit: id => ({ definitionId: definition(id), form: 'front', starLevel: 2, alive: true }),
    board: () => null,
    play: (_c, _s, targets, _a, context) => { played.push({ skill: context.skill!, targets, snapshot: !!context.snapshotTargets }); return true; },
    stopSystems: (source, systems) => { stopped.push({ source, systems }); },
  });
  return { bridge, played, stopped };
}
const cast = (tick: number, targetIds: string[]) => ({ type: 'cast', sourceId: 'vi', eventSeq: tick, tick, actionSeq: 1, completed: true, actualManaSpent: 100,
  refundedMana: 0, targetIds, completionCell: { col: 3, row: 5 } }) as unknown as DisplayCombatEvent;
const slam = (tick: number, targetId: string, definitionId = 'vi-ability', delivery = 'ability-direct') => ({ type: 'packetDamage', tick, eventSeq: tick * 10 + targetId.length,
  sourceId: 'vi', targetId, damageType: 'physical', sourceKind: 'ability', definitionId, delivery, raw: 100, actual: 100 }) as unknown as DisplayCombatEvent;

describe("Vi's landing group follows her slam", () => {
  it('her cast list keeps the rest, with no fixed stop on her hand\'s trail; the landing group is its own branch', () => {
    const cast = CUE_OVERRIDES.vi!.filter(c => (c.action ?? 'cast') === 'cast');
    expect(cast.some(c => VI_SLAM_SYSTEMS.includes(c.system))).toBe(false);
    expect(cast.find(c => c.system === VI_HAND_TRAIL)).toMatchObject({ stopAfter: undefined, fadeOut: undefined });
    const slamCues = CUE_EXTRA_SKILLS['vi-slam']!;
    expect(slamCues.map(c => c.system)).toEqual(S13_TIMELINES.vi.filter(c => VI_SLAM_SYSTEMS.includes(c.system)).map(c => c.system));
    expect(slamCues.every(c => c.delay >= 0 && c.delay < 0.1)).toBe(true);
    // The row shockwave keeps its own run along the row.
    for (const row of slamCues.filter(c => c.system === '84b969e0')) expect(row).toMatchObject({ rowCells: VI_ROW_SHOCKWAVE.cells, rowSpeed: VI_ROW_SHOCKWAVE.speed, together: 'row' });
  });
  it('once per slam tick, on her grabbed target; her hand\'s trail stops there', () => {
    const { bridge, played, stopped } = harness();
    for (const event of [cast(10, ['f1']), slam(22, 'f1'), slam(22, 'f2'), slam(40, 'f1', 'vi-ability', 'basic-attack')]) bridge.event(event, true);
    expect(played.map(p => [p.skill, ...p.targets])).toEqual([['vi-slam', 'f1']]);
    expect(played[0]!.snapshot).toBe(true);
    expect(stopped).toEqual([{ source: 'vi', systems: [VI_HAND_TRAIL] }]);
  });
  it('a held target that died: still on it (its place); nothing from catch-up', () => {
    const { bridge, played } = harness();
    bridge.event(cast(10, ['f1']), true); bridge.event(slam(22, 'f2'), true);
    expect(played.map(p => [p.skill, ...p.targets])).toEqual([['vi-slam', 'f1']]);
    const late = harness();
    late.bridge.event(cast(10, ['f1']), false); late.bridge.event(slam(22, 'f1'), false);
    expect(late.played).toEqual([]);
  });
});

describe("Vi's slam from the real rules", () => {
  it('plays on the slam tick, after her cast tick', () => {
    const units = realUnits({ unit: 'vi', star: 2, form: null, foe: 'amumu', dist: 1, nfoes: 2, foestar: 3 } as never);
    const shown: DisplayCombatEvent[][] = [];
    const run = runRealCombat(units, 40, (_state, events) => shown.push(events as DisplayCombatEvent[]), 1);
    expect(run.castIndex).toBeGreaterThan(0);
    const played: { skill: string; tick: number }[] = [];
    let tick = 0;
    const bridge = createBatch2VfxBridge({ unit: id => ({ definitionId: units.find((u: any) => u.id === id)?.definitionId ?? 'amumu', form: 'front', starLevel: 2, alive: true }),
      board: () => null, play: (_c, _s, _t, _a, context) => { played.push({ skill: context.skill!, tick }); return true; } });
    shown.forEach((events, at) => { tick = at; for (const event of events) bridge.event(event, true); });
    const slams = played.filter(p => p.skill === 'vi-slam');
    expect(slams).toHaveLength(1);
    expect(slams[0]!.tick).toBeGreaterThan(run.castIndex);
  });
});
