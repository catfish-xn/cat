import { describe, expect, it } from 'vitest';
import { parseIndex, withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// The deployed index lists Singed's seven systems but only his attack hit as a cue: without the override his cast has no
// cue on the new engine, ltk.play('singed', …, 'cast') refuses it and the manifest's old effects play instead.
const W = ['4fb68964', '2639dd7d', '6e34a4e1', '58f996d2', 'db0f8e0d'];
const deployed = () => parseIndex({ version: 1,
  systems: Object.fromEntries(['0f2af66b', '2436e086', ...W].map(id => [id, `systems/${id}.json`])), assets: {},
  skills: { singed: [{ system: '0f2af66b', action: 'attack', event: 'hit', bone: 'C_BUFFBONE_GLB_CHEST_LOC', delay: 0.4881666819254557, duration: 1.5 }] } });

describe('Singed\'s W plays on the new engine, never the old manifest effects', () => {
  it('the exported index alone has no cast cue (what falls back to the old path)', () => {
    expect(deployed().skills.singed!.filter(cue => (cue.action ?? 'cast') === 'cast')).toEqual([]);
  });
  it('with the override every W system is a cast cue, and a cast on himself maps all of them, the flask included', () => {
    const cues = withCueOverrides(deployed()).skills.singed!;
    const cast = cues.filter(cue => (cue.action ?? 'cast') === 'cast');
    expect(cast.map(cue => cue.system).sort()).toEqual([...W].sort());
    const mapped = mapSkillTimeline(cast, 'singed', ['singed']);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.map(s => s.system).sort()).toEqual([...W].sort());
    // The flask flies to his own head; what it brings starts when it lands.
    const flask = mapped.spawns.find(s => s.event === 'projectile')!;
    expect(flask.targetId).toBe('singed');
    const lands = flask.delay + flask.travelSeconds!;
    for (const s of mapped.spawns.filter(s => s.event !== 'projectile')) expect(s.delay).toBeCloseTo(lands, 9);
  });
  it('a cast on an ally maps the same five, the ally taking the flask and its effects', () => {
    const cast = withCueOverrides(deployed()).skills.singed!.filter(cue => (cue.action ?? 'cast') === 'cast');
    const mapped = mapSkillTimeline(cast, 'singed', ['ally']);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.filter(s => s.event !== 'cast-start').every(s => s.targetId === 'ally')).toBe(true);
  });
});
