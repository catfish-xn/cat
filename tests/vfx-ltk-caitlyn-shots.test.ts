import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { caitlynShotCentre, createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CAITLYN_COMET, CUE_EXTRA_SKILLS as ALL_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// Caitlyn's shot branches only (the table also holds other champions' display branches).
const CUE_EXTRA_SKILLS = Object.fromEntries(Object.entries(ALL_EXTRA_SKILLS).filter(([key]) => key.startsWith('caitlyn-')));
import { parseIndex, withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { effectImportance } from '../src/rendering/three-mode/effect-budget';
import { createCombatReplayRecorder } from '../src/simulation/combat-replay-view';
import { stepCombat } from '../src/simulation/combat';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import type { CombatState } from '../src/simulation/combat-types';

// Event shapes as the combat view sends them (combat-replay-view.ts packetDamage: sourceKind and delivery tags).
const cast = (sourceId: string, eventSeq: number, tick = eventSeq): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq, tick,
  actionSeq: eventSeq, completed: true, actualManaSpent: 50, refundedMana: 0, targetIds: ['a'], completionCell: { col: 0, row: 0 } });
const packet = (sourceId: string, targetId: string, eventSeq: number, tick: number,
  delivery = 'ability-direct', sourceKind = 'ability'): DisplayCombatEvent => ({ type: 'packetDamage', sourceId, targetId, eventSeq, tick,
  damageType: 'physical', hit: true, hpDamage: 1, absorbed: 0, critical: false, killingPacket: false, sourceKind, definitionId: 'caitlyn', delivery } as DisplayCombatEvent);
/** One Air Raid shot as executeTask 'caitlyn' sends it: an area packet to each enemy within a cell, then the headshot to the centre. */
const shot = (seq: number, tick: number, centre: string, around: string[] = []) =>
  [...[centre, ...around].map((id, i) => packet('cait', id, seq + i, tick)), packet('cait', centre, seq + around.length + 1, tick)];
const definitions: Record<string, string> = { cait: 'caitlyn', jinx: 'jinx' };

describe('Caitlyn Air Raid: one comet and burst per shot, where its damage lands', () => {
  it('a shot\'s centre is the enemy its headshot struck again, else the last one struck', () => {
    expect(caitlynShotCentre(shot(1, 10, 'b', ['a', 'c']), 10, 'cait')).toBe('b');
    expect(caitlynShotCentre([packet('cait', 'x', 1, 10)], 10, 'cait')).toBe('x');
    expect(caitlynShotCentre(shot(1, 10, 'b'), 11, 'cait')).toBeUndefined();
  });

  it('plans one shot per tick of her ability-direct packets, on that shot\'s centre, from the real event stream only', () => {
    const events = createBatch1VfxEvents(id => definitions[id], () => 1);
    const batch = [cast('cait', 1, 5), ...shot(2, 5, 'b', ['a']), ...shot(10, 30, 'c'),
      packet('cait', 'a', 20, 31, 'basic-attack', 'attack'), packet('cait', 'a', 21, 32, 'equipment-proc', 'item'), packet('jinx', 'a', 22, 33)];
    const extras = events.batch(batch).flatMap(plan => plan.extra);
    expect(extras).toEqual([
      { champion: 'caitlyn', sourceId: 'cait', targets: ['b'], action: 'passive', skill: 'caitlyn-shot', snapshotTargets: true },
      { champion: 'caitlyn', sourceId: 'cait', targets: ['c'], action: 'passive', skill: 'caitlyn-shot', snapshotTargets: true },
    ]);
  });

  it('3 stars: every shot bursts, shorter, and every other shot (from her cast) also shows its comet', () => {
    const events = createBatch1VfxEvents(id => definitions[id], () => 3);
    const skills = (batch: DisplayCombatEvent[]) => events.batch(batch).flatMap(plan => plan.extra.map(fx => fx.skill));
    expect(skills([cast('cait', 1, 1), ...shot(2, 2, 'a'), ...shot(5, 3, 'b'), ...shot(8, 4, 'a')]))
      .toEqual(['caitlyn-shot-3-comet', 'caitlyn-shot-3', 'caitlyn-shot-3-comet']);
    // A new cast starts the alternation over.
    expect(skills([cast('cait', 20, 50), ...shot(21, 51, 'b')])).toEqual(['caitlyn-shot-3-comet']);
  });

  it('a replayed (catch-up) batch plans no shot', () => {
    const events = createBatch1VfxEvents(id => definitions[id], () => 1);
    events.batch([cast('cait', 50, 50), ...shot(51, 51, 'a')]);
    expect(events.batch(shot(3, 3, 'a')).flatMap(plan => plan.extra)).toEqual([]);
  });

  it('the comet lands as its burst starts, its trail fades, and neither outranks an ordinary skill hit', () => {
    for (const [key, cues] of Object.entries(CUE_EXTRA_SKILLS)) {
      const comet = cues.find(cue => cue.system === '92bbeaf7'), burst = cues.find(cue => cue.system === '8d6e1c2e')!;
      expect(burst.delay, key).toBeCloseTo(CAITLYN_COMET.fall, 9);
      if (comet) {
        expect(comet, key).toMatchObject({ event: 'projectile', fromAbove: CAITLYN_COMET.from, travelSeconds: CAITLYN_COMET.fall, stopAfter: CAITLYN_COMET.fall, fadeOut: true });
        expect(comet.delay + comet.travelSeconds!, key).toBeCloseTo(burst.delay, 9);
      }
      for (const cue of cues) expect(effectImportance(cue), `${key} ${cue.system}`).toBe(effectImportance({ event: cue.event, action: 'cast' }));
    }
    expect(CUE_EXTRA_SKILLS['caitlyn-shot-3'].map(cue => cue.system)).toEqual(['8d6e1c2e']);
    // The cast itself no longer plays a comet or a burst of its own: every one comes from a shot.
    expect(CUE_OVERRIDES.caitlyn.filter(cue => ['92bbeaf7', '8d6e1c2e'].includes(cue.system))).toEqual([]);
  });

  it('a shot lands when it did: the comet starts at the shot\'s event and lands as its burst starts, the fall unchanged', () => {
    // Its start may move (CAITLYN_COMET.from); the landing, relative to the shot's damage, may not.
    expect(CAITLYN_COMET.fall).toBe(0.15);
    for (const [key, cues] of Object.entries(CUE_EXTRA_SKILLS)) {
      const burst = cues.find(cue => cue.system === '8d6e1c2e')!, comet = cues.find(cue => cue.system === '92bbeaf7');
      expect(burst.delay, key).toBe(0.15);
      if (comet) { expect(comet.delay, key).toBe(0); expect(comet.travelSeconds, key).toBe(0.15); }
    }
  });

  it('the shot branches join a loaded index that has Caitlyn and their systems, and only then', () => {
    const cues = [...CUE_OVERRIDES.caitlyn, ...Object.values(CUE_EXTRA_SKILLS).flat()];
    const systems = Object.fromEntries(cues.map(cue => [cue.system, `systems/${cue.system}.json`]));
    const loaded = withCueOverrides(parseIndex({ version: 1, systems, assets: {}, skills: { caitlyn: CUE_OVERRIDES.caitlyn } }));
    for (const [key, branch] of Object.entries(CUE_EXTRA_SKILLS)) expect(loaded.skills[key], key).toEqual(branch);
    expect(() => parseIndex({ version: 1, systems, assets: {}, skills: loaded.skills })).not.toThrow();
    // No Caitlyn list, or a system missing: no branch.
    expect(withCueOverrides(parseIndex({ version: 1, systems, assets: {}, skills: { vex: [{ system: '92bbeaf7', event: 'hit', delay: 0, duration: 1 }] } })).skills['caitlyn-shot']).toBeUndefined();
    const { ['92bbeaf7']: _, ...without } = systems;
    expect(withCueOverrides(parseIndex({ version: 1, systems: without, assets: {}, skills: { caitlyn: CUE_OVERRIDES.caitlyn } })).skills['caitlyn-shot']).toBeUndefined();
  });
});

describe('a shot\'s packets reach the planner in one batch (the premise of caitlynShotCentre)', () => {
  it('the replay holds one record per tick with all of that tick\'s events, so a whole tick is always in one batch', () => {
    const base = createMatch(42);
    const started = startMatchCombat({ ...base, preparation: { ...base.preparation, units: [{ id: 'cait', definitionId: 'caitlyn', team: 'player', starLevel: 1,
      location: { kind: 'board', cell: { col: 3, row: 6 } } }, ...base.preparation.units.filter(u => u.team === 'enemy')] } });
    if (!started.ok || !started.state.combat) throw Error('no combat');
    let state: CombatState = { ...started.state.combat, units: started.state.combat.units.map(u => u.team === 'player' ? { ...u, mana: u.maxMana }
      : { ...u, hp: 100000, maxHp: 100000, attackDamage: 1 }) };
    const recorder = createCombatReplayRecorder(state, []), records = [recorder.initialFrame];
    const isShot = (event: { type: string; sourceId?: string; delivery?: string }) => event.type === 'packetDamage' && event.sourceId === 'cait' && event.delivery === 'ability-direct';
    let seen = 0;
    for (let i = 0; i < 120 && state.status === 'running' && seen < 2; i++) {
      const next = stepCombat(state), record = recorder.record(state, next);
      records.push(record); state = next.state; if (record.events.some(e => isShot(e as never))) seen++;
    }
    const shotTicks = new Set<number>();
    for (const record of records) for (const event of record.events) {
      // Every event of a record is of that record's tick, and no tick has two records.
      if ('tick' in event) expect(event.tick, event.type).toBe(record.tick);
      if (isShot(event as never) && 'tick' in event) shotTicks.add(event.tick);
    }
    expect(new Set(records.map(r => r.tick)).size).toBe(records.length);
    expect(shotTicks.size).toBeGreaterThanOrEqual(2);
    // Batched one record at a time, as the online session plays them back (remote-session.ts advanceDisplay): one shot per tick.
    const events = createBatch1VfxEvents(id => id === 'cait' ? 'caitlyn' : 'enemy', () => 1);
    const shots = records.flatMap(record => events.batch(record.events as DisplayCombatEvent[]).flatMap(plan => plan.extra));
    expect(shots).toHaveLength(shotTicks.size);
  });
});
