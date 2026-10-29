import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { BATCH1_DIRECTORIES, BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { createVfxLibrary, parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline, type TimelineAction, type TimelineVariant } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { syntheticSystem } from './vfx-ltk-synthetic';

const attack = (attackerId: string, eventSeq: number, tick = eventSeq): DisplayCombatEvent => ({ type: 'attack', attackerId, targetId: 'enemy', eventSeq, tick });
const cast = (sourceId: string, eventSeq: number, targetIds = [sourceId], tick = eventSeq): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq, tick,
  actionSeq: eventSeq, completed: true, actualManaSpent: 50, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } });
const damage = (sourceId: string, targetId: string, eventSeq: number, tick: number, damageType: 'magic' | 'physical' = 'magic'): DisplayCombatEvent => ({
  type: 'packetDamage', sourceId, targetId, eventSeq, tick, damageType, hit: true, hpDamage: 1, absorbed: 0, critical: false, killingPacket: false });
const expired = (eventSeq: number, tick: number): DisplayCombatEvent => ({ type: 'statusChanged', eventSeq, tick, targetId: 'leona', kind: 'damage-reduction', reason: 'expired', effectiveMagnitudeBps: 0 });
const select = (champion: keyof typeof BATCH1_TIMELINES, action: TimelineAction, variant?: TimelineVariant) => BATCH1_TIMELINES[champion].filter(c => c.action === action && c.variant === variant);

describe('batch 1 observed forms and passive/end triggers', () => {
  it('limits interrupted-cast filtering to batch 1, including stale deliveries', () => {
    const events = createBatch1VfxEvents(id => id);
    for (const champion of Object.keys(BATCH1_TIMELINES)) {
      const interrupted = { ...cast(champion, 1), completed: false } as DisplayCombatEvent;
      expect(events.batch([interrupted])[0].skipCast).toBe(true);
    }
    for (const champion of ['jinx', 'vi', 'jayce', 'ambessa', 'vander']) {
      const plan = events.batch([{ ...cast(champion, 1), completed: false } as DisplayCombatEvent])[0];
      expect(plan.skipCast).toBeUndefined(); expect(plan.fresh).toBe(true);
    }
  });
  it('suppresses only VFX selection on sequence rollback and leaves event facts intact', () => {
    const events = createBatch1VfxEvents(id => id);
    events.batch([cast('leona', 100), attack('zeri', 101), attack('zeri', 102)]);
    const replay = [attack('zeri', 1), cast('leona', 2), expired(3, 62),
      { type: 'death', eventSeq: 4, tick: 63, unitId: 'leona' }] as DisplayCombatEvent[];
    const before = structuredClone(replay), plans = events.batch(replay);
    expect(plans.map(p => p.event)).toEqual(before);
    expect(plans.every(p => !p.fresh && !p.skipCast && !p.stopCast && p.extra.length === 0)).toBe(true);
    expect(events.batch([attack('zeri', 103)])[0].variant).toBe('empowered');
    events.clear();
    expect(events.batch([attack('zeri', 1)])[0].fresh).toBe(true);
    expect(replay).toEqual(before);
  });
  it('keeps Zeri third-attack form through catch-up, duplicate delivery and round reset', () => {
    const events = createBatch1VfxEvents(id => id);
    expect(events.batch([attack('zeri', 1), attack('zeri', 2)]).map(p => p.variant)).toEqual([undefined, undefined]);
    expect(events.batch([attack('zeri', 2)])[0].fresh).toBe(false);
    expect(events.batch([attack('zeri', 3)])[0].variant).toBe('empowered');
    expect(events.batch([attack('zeri', 4)])[0].variant).toBeUndefined();
    events.clear(); expect(events.batch([attack('zeri', 1)])[0].variant).toBeUndefined();
  });
  it('moves Draven Q missiles to subsequent attacks and consumes Lux empowerment exactly once', () => {
    const events = createBatch1VfxEvents(id => id);
    const plans = events.batch([attack('draven', 1), cast('draven', 2), attack('draven', 3), attack('draven', 4),
      cast('lux', 5), attack('lux', 6), attack('lux', 7), cast('lux', 8, ['ally']), attack('lux', 9)]);
    expect(plans.map(p => p.variant)).toEqual([undefined, undefined, 'empowered', 'empowered', 'self', 'empowered', undefined, undefined, 'empowered']);
    for (const name of ['draven', 'kogmaw', 'twitch', 'nocturne', 'leona'] as const) {
      const mapped = mapSkillTimeline(select(name, 'cast'), name, name === 'leona' ? [] : [name]);
      expect(mapped.unsupported).toEqual([]); expect(mapped.spawns.length).toBeGreaterThan(0);
      expect(mapped.spawns.every(c => c.event === 'cast-start')).toBe(true);
    }
    const lux = mapSkillTimeline(select('lux', 'cast', 'self'), 'lux', ['lux']);
    expect(lux.unsupported).toEqual([]); expect(lux.spawns.map(c => c.system)).toEqual(['44c9516a']);
    expect(mapSkillTimeline(select('lux', 'cast'), 'lux', ['ally']).spawns.filter(c => c.event === 'hit').map(c => c.targetId)).toEqual(['ally']);
  });
  it('ignores failed casts, limits Twitch to eight observed bolts and uses packet recipients', () => {
    const events = createBatch1VfxEvents(id => id);
    events.batch([{ ...cast('twitch', 1), completed: false } as DisplayCombatEvent]);
    expect(events.batch([attack('twitch', 2)])[0].variant).toBeUndefined();
    events.batch([cast('twitch', 3)]);
    const first = events.batch([attack('twitch', 4, 10), damage('twitch', 'actual', 5, 10, 'physical'), damage('twitch', 'pierced', 6, 10, 'physical')]);
    expect(first[0].variant).toBe('empowered'); expect(first[0].targets).toEqual(['actual', 'pierced']);
    expect(events.batch(Array.from({ length: 8 }, (_, i) => attack('twitch', i + 7))).map(p => p.variant)).toEqual([
      'empowered', 'empowered', 'empowered', 'empowered', 'empowered', 'empowered', 'empowered', undefined,
    ]);
  });
  it('observes the Nocturne six-second window and Leona expiration, without a start-of-cast explosion', () => {
    const events = createBatch1VfxEvents(id => id);
    events.batch([cast('nocturne', 1, ['nocturne'], 10)]);
    expect(events.batch([attack('nocturne', 2, 129)])[0].variant).toBe('empowered');
    expect(events.batch([attack('nocturne', 3, 130)])[0].variant).toBeUndefined();
    expect(events.batch([cast('leona', 4, [], 140)])[0].extra).toEqual([]);
    const end = events.batch([expired(5, 200), damage('leona', 'enemy', 6, 200)])[0];
    expect(end.stopCast).toBe('leona'); expect(end.extra.map(p => [p.action, p.targets])).toEqual([['end', []], ['passive', ['enemy']]]);
    expect(events.batch([expired(7, 201)])[0].extra).toEqual([]);
    events.batch([cast('leona', 8, [], 210)]);
    expect(events.batch([expired(9, 270)])[0].extra.map(p => p.action)).toEqual(['end']); // Explodes even without a victim.
  });
  it('groups Amumu area pulses once, excludes basic-attack ticks and handles catch-up without timers', () => {
    const events = createBatch1VfxEvents(id => id);
    const plans = events.batch([damage('amumu', 'a', 1, 20), damage('amumu', 'b', 2, 20), damage('amumu', 'a', 3, 20)]);
    expect(plans.flatMap(p => p.extra)).toEqual([{ champion: 'amumu', sourceId: 'amumu', action: 'passive', targets: ['a', 'b'] }]);
    expect(events.batch([attack('amumu', 4, 40), damage('amumu', 'a', 5, 40)]).flatMap(p => p.extra)).toEqual([]);
    expect(events.batch([damage('amumu', 'a', 6, 60)])[0].extra).toHaveLength(1);
    expect(events.batch([damage('amumu', 'a', 6, 60)])[0].fresh).toBe(false);
  });
  it('clears pending Leona expiration on death, then supports a new cast after revive', () => {
    const events = createBatch1VfxEvents(id => id);
    events.batch([cast('leona', 1), { type: 'death', unitId: 'leona', eventSeq: 2, tick: 2 }]);
    expect(events.batch([expired(3, 61)])[0].extra).toEqual([]);
    events.batch([cast('leona', 4)]); expect(events.batch([expired(5, 64)])[0].extra).toHaveLength(1);
  });
});

describe('batch 1 catalogue and runtime forms', () => {
  it('validates every hero under existing limits and rejects unknown variant/action values', () => {
    for (const [name, cues] of Object.entries(BATCH1_TIMELINES)) {
      expect(cues.length).toBeLessThanOrEqual(12);
      const raw = { version: 1, systems: Object.fromEntries(cues.map(c => [c.system, 'systems/' + c.system + '.json'])), assets: {}, skills: { [name]: cues } };
      expect(parseIndex(raw).skills[name]).toEqual(cues);
      expect(() => parseIndex({ ...raw, skills: { [name]: [{ ...cues[0], variant: 'untrusted' }] } })).toThrow('timeline-cue');
      expect(() => parseIndex({ ...raw, skills: { [name]: [{ ...cues[0], action: 'untrusted' }] } })).toThrow('timeline-cue');
      for (const bad of [null, 1, ['empowered']])
        expect(() => parseIndex({ ...raw, skills: { [name]: [{ ...cues[0], variant: bad }] } })).toThrow('timeline-cue');
      for (const bad of [null, 1, ['attack']])
        expect(() => parseIndex({ ...raw, skills: { [name]: [{ ...cues[0], action: bad }] } })).toThrow('timeline-cue');
    }
    expect(Object.keys(BATCH1_DIRECTORIES)).toHaveLength(8);
  });
  it('selects one complete form, keeps fallback on failure and cancels a delayed buff before death/reset', async () => {
    const cues = BATCH1_TIMELINES.zeri;
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? {
      version: 1, systems: Object.fromEntries(cues.map(c => [c.system, c.system + '.json'])), assets: { 'synthetic.tex': 'same.png' }, skills: { zeri: cues },
    } : syntheticSystem(), readTexture: async () => new Texture() });
    const source = { root: new Group(), body: null, alive: true }, scene = new Scene(), budget = { live: 0, max: 1500 };
    const runtime = createLtkRuntime(library, scene, () => source, { budget }); await runtime.warm('zeri');
    expect(runtime.play('zeri', 'source', [], 0, 'attack', 'empowered')).toBe(false); expect(runtime.queued).toBe(0);
    expect(runtime.play('zeri', 'source', ['enemy'], 0, 'attack', 'empowered')).toBe(true); expect(runtime.queued).toBe(2);
    runtime.update(8 / 30, new Camera()); expect(scene.children.map(o => o.userData.ltkSystem)).toEqual(['d160dfa9']);
    runtime.stopAction('source', 'attack'); expect(runtime.queued).toBe(0); expect(runtime.active).toBe(0); expect(budget.live).toBe(0);
    runtime.update(1, new Camera()); expect(runtime.active).toBe(0); expect(budget.live).toBe(0);
    expect(runtime.play('zeri', 'source', ['enemy'], 0, 'attack')).toBe(true); runtime.stopUnit('source');
    runtime.update(.3, new Camera()); expect(runtime.active).toBe(0);
    runtime.dispose(); expect(scene.children).toEqual([]); expect(budget.live).toBe(0);
  });
});
