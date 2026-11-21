import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { MEL_BOLT_TICKS_PER_HEX as RENDER_TICKS_PER_HEX, MEL_EVENT_SKILLS, melSkills } from '../src/rendering/three-mode/vfx-ltk/champions/mel';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createCombatWithEvents, stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { toCombatViewEvents } from '../src/simulation/combat-replay-view';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { MEL_BOLT_TICKS_PER_HEX } from '../src/simulation/cast-windup';

// Mel's barrage (rules 'mel-barrage', 11-20): her dash lands, then her bolts leave and settle where they land, each step a rule
// event. Her dash, bolts and hits play from those events (batch2-bridge.ts), never at fixed times after the cast.
type Played = { skill: string; source: string; targets: readonly string[]; snapshot: boolean };
function harness() {
  const played: Played[] = [];
  const bridge = createBatch2VfxBridge({
    unit: id => (id.startsWith('mel') ? { definitionId: 'mel', form: 'front', starLevel: 2, alive: true } : { definitionId: 'amumu', form: 'front', starLevel: 2, alive: true }),
    board: () => null,
    play: (_champion, source, targets, _action, context) => { played.push({ skill: context.skill!, source, targets, snapshot: !!context.snapshotTargets }); return true; },
  });
  return { bridge, played };
}
const cast = (tick: number, actionSeq: number, third = false) => ({ type: 'cast', sourceId: 'mel', eventSeq: tick, tick, actionSeq, completed: true, actualManaSpent: 80,
  refundedMana: 0, targetIds: ['e0'], completionCell: { col: 3, row: 7 }, ...(third ? { branch: { branch: 'third' } } : {}) }) as unknown as DisplayCombatEvent;
const move = (tick: number) => ({ type: 'movement', eventSeq: tick, tick, unitId: 'mel', from: { col: 3, row: 7 }, to: { col: 3, row: 6 } }) as unknown as DisplayCombatEvent;
const launched = (tick: number, actionSeq: number, targetId: string, ordinal: number) => ({ type: 'abilityProjectileLaunched', eventSeq: tick, tick, sourceId: 'mel', targetId,
  arrivalTick: tick + 4, skill: 'mel-barrage', ordinal, actionSeq, count: 3 }) as unknown as DisplayCombatEvent;
const landed = (tick: number, actionSeq: number, targetId: string, ordinal: number, hit = true) => ({ type: 'abilityProjectileLanded', eventSeq: tick, tick, sourceId: 'mel', targetId,
  skill: 'mel-barrage', ordinal, actionSeq, count: 3, hit }) as unknown as DisplayCombatEvent;

describe('Mel barrage cues follow the rules\' events', () => {
  it('her cast lists hold no bolt, hit, dash or explosion at a fixed time', () => {
    const fixed = (key: string) => CUE_OVERRIDES[key]!.filter(c => (c.action ?? 'cast') === 'cast').map(c => [c.system, c.event]);
    expect(fixed('mel')).toEqual([['e75b9fe8', 'cast-start']]);
    expect(fixed('mel-third')).toEqual([['e2f2798d', 'cast-start'], ['4c885a29', 'cast-start']]);
    for (const skill of MEL_EVENT_SKILLS) {
      expect(CUE_EXTRA_SKILLS[skill]).toBe(melSkills[skill]);
      expect(CUE_EXTRA_SKILLS[skill]!.every(c => c.delay === 0)).toBe(true);
    }
  });
  it('the bolts fly the rules\' flight: MEL_BOLT_TICKS_PER_HEX a cell, mirrored', () => {
    expect(RENDER_TICKS_PER_HEX).toBe(MEL_BOLT_TICKS_PER_HEX);
    for (const skill of ['mel-bolt', 'mel-third-bolt'] as const) expect(CUE_EXTRA_SKILLS[skill]![0]).toMatchObject({ event: 'projectile', flightTicks: { perCell: MEL_BOLT_TICKS_PER_HEX, min: 1 } });
  });
  it('dash on her landing; each bolt as it leaves; each hit as it lands on a target still there', () => {
    const { bridge, played } = harness();
    for (const event of [cast(10, 1), move(20), launched(25, 1, 'e0', 0), launched(25, 1, 'e1', 1), launched(25, 1, 'e2', 2),
      landed(29, 1, 'e0', 0), landed(31, 1, 'e1', 1, false), landed(33, 1, 'e2', 2), move(40)]) bridge.event(event, true);
    expect(played.map(p => [p.skill, ...p.targets])).toEqual([['mel-dash'], ['mel-bolt', 'e0'], ['mel-bolt', 'e1'], ['mel-bolt', 'e2'],
      ['mel-bolt-hit', 'e0'], ['mel-bolt-hit', 'e2']]);
    expect(played.filter(p => p.skill === 'mel-bolt-hit').every(p => p.snapshot)).toBe(true);
  });
  it('her third cast: its own bolts and hits, and its explosion once, on the first bolt\'s target', () => {
    const { bridge, played } = harness();
    for (const event of [cast(10, 7, true), launched(25, 7, 'e0', 0), launched(25, 7, 'e1', 1), landed(29, 7, 'e0', 0), landed(31, 7, 'e1', 1)]) bridge.event(event, true);
    expect(played.map(p => [p.skill, ...p.targets])).toEqual([['mel-third-bolt', 'e0'], ['mel-third-bolt', 'e1'],
      ['mel-third-hit', 'e0'], ['mel-third-blast', 'e0'], ['mel-third-hit', 'e1']]);
  });
  it('catch-up plays nothing but still remembers the cast, so a later landing plays as its cast', () => {
    const { bridge, played } = harness();
    bridge.event(cast(10, 7, true), false); bridge.event(launched(25, 7, 'e0', 0), false);
    expect(played).toEqual([]);
    bridge.event(landed(29, 7, 'e0', 0), true);
    expect(played.map(p => p.skill)).toEqual(['mel-third-hit', 'mel-third-blast']);
  });
});

// The real rules, through the display events the renderer receives: one dash, one bolt and one hit per target, and nothing
// at the cast tick but her cast.
describe('Mel barrage from the real rules', () => {
  it('plays dash, bolts and hits on the rules\' own ticks', () => {
    const units: any[] = [{ id: 'mel', definitionId: 'mel', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 7 } } },
      { id: 'ally', definitionId: 'garen', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 1, row: 4 } } },
      ...['amumu', 'sett', 'vi'].map((definitionId, i) => ({ id: `e${i}`, definitionId, team: 'enemy', starLevel: 3, location: { kind: 'board', cell: { col: 1 + 2 * i, row: 1 } } }))];
    const preparation: any = { board: DEFAULT_BOARD, benchSize: 7, units };
    const created = createCombatWithEvents(preparation, buildStrategySnapshot({ round: 1, preparation, items: [], temporaryEquipment: [], augments: [], persistentGrowth: [],
      augmentProgress: [] } as any), 'mel', 7) as { state: CombatState };
    let state: CombatState = { ...created.state, units: created.state.units.map(u => u.id === 'mel' ? { ...u, mana: u.maxMana } : { ...u, cooldownTicks: 2000, moveCooldownTicks: 2000 }) };
    const ledger: CombatEvent[] = [];
    for (let n = 0; n < 60 && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; ledger.push(...r.events); }
    const display = toCombatViewEvents(ledger as never) as unknown as DisplayCombatEvent[];
    const at = new Map<string, number[]>();
    const played: { skill: string; tick: number }[] = [];
    let tick = 0;
    const bridge = createBatch2VfxBridge({
      unit: id => ({ definitionId: id === 'mel' ? 'mel' : id === 'ally' ? 'garen' : 'amumu', form: 'front', starLevel: 1, alive: true }),
      board: () => null,
      play: (_c, _s, _t, _a, context) => { played.push({ skill: context.skill!, tick }); return true; },
    });
    for (const event of display) { tick = (event as { tick?: number }).tick ?? tick; bridge.event(event, true); }
    for (const p of played) at.set(p.skill, [...(at.get(p.skill) ?? []), p.tick]);
    const castTick = (display.find(e => e.type === 'cast' && (e as { sourceId?: string }).sourceId === 'mel') as { tick: number }).tick;
    const launches = display.filter(e => e.type === 'abilityProjectileLaunched') as unknown as { tick: number; arrivalTick: number }[];
    expect(launches.length).toBeGreaterThan(0);
    expect(at.get('mel-dash')).toHaveLength(1);
    expect(at.get('mel-dash')![0]).toBeGreaterThan(castTick);
    expect(at.get('mel-bolt')).toEqual(launches.map(l => l.tick));
    expect(at.get('mel-bolt-hit')).toEqual(launches.map(l => l.arrivalTick).sort((a, b) => a - b));
    // Her shield and energy may play on the cast tick (their own rule events); none of the barrage's own branches does.
    expect(played.filter(p => p.tick === castTick && (MEL_EVENT_SKILLS as readonly string[]).includes(p.skill))).toEqual([]);
  });
});
