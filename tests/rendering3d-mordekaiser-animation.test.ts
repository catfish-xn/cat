import { describe, expect, it } from 'vitest';
import { AnimationClip, Group, LoopOnce, NumberKeyframeTrack } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { UnitActionState, type AnimationEvent } from '../src/rendering3d/animation-state';
import type { CastMetadata } from '../src/rendering3d/contracts';
import { AttackCadence } from '../src/rendering/three-mode/attack-cadence';
import { mordekaiserAnimationReplay } from './fixtures/mordekaiser-animation-replay';

// Generated curves only. Deliberately long attack/cast clips reproduce the deployed model's timing problem.
function fixture() {
  const root = new Group();
  const clips = [['rest', 4], ['swing', 3], ['spell', 2.6], ['fall', 1]].map(([name, duration], i) =>
    new AnimationClip(String(name), Number(duration), [new NumberKeyframeTrack('.position[x]', [0, Number(duration)], [i, i + 1])]));
  const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', attack: 'swing', cast: 'spell', death: 'fall' },
    { castSequence: { main: 'spell' } });
  return { root, clips, mixer };
}

describe('Mordekaiser post-cast attack playback', () => {
  it('finishes every full swing before the next seed-42 attack instead of restarting its first half forever', () => {
    const ticks = mordekaiserAnimationReplay();
    const attacks = ticks.flatMap(frame => frame.events.filter(e => e.type === 'attack' && e.attackerId === 'a'));
    expect(attacks.map(e => e.tick)).toEqual([38, 75, 112, 149, 186, 223]);
    expect(ticks.flatMap(frame => frame.events).filter(e => e.type === 'cast' && e.sourceId === 'a')).toHaveLength(1);
    const interval = (attacks[1].tick - attacks[0].tick) * 0.05;
    const f = fixture(), state = new UnitActionState('a', {
      resolvePlayback: (action, index) => f.mixer.resolvePlayback(action, index, { attackIntervalSeconds: interval }),
    });
    f.mixer.apply(state.output);
    let completed = 0;
    try {
      for (const frame of ticks) {
        const before = state.output;
        for (const event of frame.events) if (['attack', 'cast', 'packetDamage', 'death', 'movement', 'heal'].includes(event.type)) {
          state.consume(event as AnimationEvent);
        }
        f.mixer.apply(state.output);
        if (state.output.state === 'attack') {
          expect(state.output.playback?.clips).toEqual(['swing']);
          expect(state.output.playback!.durationSeconds).toBeLessThan(interval);
        }
        // The production renderer advances state, then mixer, then applies a changed output.
        for (let i = 0; i < 3; i++) {
          const output = state.update(1 / 60); f.mixer.update(1 / 60); f.mixer.apply(output);
        }
        if (before.state === 'attack' && state.output.state === 'idle') {
          const swing = f.mixer.mixer.clipAction(f.clips[1]);
          expect(swing.loop).toBe(LoopOnce); expect(swing.paused).toBe(true);
          expect(swing.time).toBeCloseTo(f.clips[1].duration);
          completed++;
        }
        if (frame.tick > 55) expect(f.mixer.mixer.clipAction(f.clips[2]).getEffectiveWeight()).toBe(0);
      }
      expect(completed).toBeGreaterThanOrEqual(4);
    } finally { f.mixer.dispose(); }
  });

  it('measures replay ticks across batches, ignores duplicate/old ticks, and separates pauses, rounds and units', () => {
    const cadence = new AttackCadence(), other = new AttackCadence();
    cadence.observe(38); expect(cadence.intervalSeconds).toBeUndefined();
    cadence.observe(75); expect(cadence.intervalSeconds).toBe(1.85);
    for (const tick of [75, 74, -1, NaN, Infinity, 75.5]) cadence.observe(tick);
    expect(cadence.intervalSeconds).toBe(1.85);
    cadence.pause(); cadence.observe(300); expect(cadence.intervalSeconds).toBe(1.85);
    cadence.observe(310); expect(cadence.intervalSeconds).toBe(0.5);
    other.observe(100); other.observe(120); expect(other.intervalSeconds).toBe(1);
    expect(cadence.intervalSeconds).toBe(0.5);
    cadence.reset(); expect(cadence.intervalSeconds).toBeUndefined();
    cadence.observe(1); cadence.observe(6); expect(cadence.intervalSeconds).toBe(0.25);
  });

  it('keeps a shorter authored attack and ignores absent or invalid interval hints', () => {
    const f = fixture();
    try {
      expect(f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds: 10 })?.durationSeconds).toBe(3);
      for (const attackIntervalSeconds of [undefined, 0, -1, NaN, Infinity]) {
        expect(f.mixer.resolvePlayback('attack', 0, { attackIntervalSeconds })?.durationSeconds).toBe(3);
      }
    } finally { f.mixer.dispose(); }
  });
});

const castCases: { champion: string; metadata: CastMetadata; context?: { starLevel?: number; form?: 'front' | 'back'; branch?: string }; expected: string[] }[] = [
  { champion: 'Mordekaiser', metadata: { castSequence: { main: 'main' }, castVariants: { star3: { main: 'enhanced' } } }, expected: ['main'] },
  { champion: 'Mordekaiser star 3', metadata: { castVariants: { star3: { main: 'enhanced' } } }, context: { starLevel: 3 }, expected: ['enhanced'] },
  { champion: 'Vi', metadata: {}, expected: ['main'] },
  { champion: 'Sevika one', metadata: { castVariants: { branch: { one: { in: 'entry', main: 'hold' } } } }, context: { branch: 'one' }, expected: ['entry', 'hold'] },
  { champion: 'Sevika two', metadata: { castVariants: { branch: { two: { in: 'entry', main: 'main', out: 'exit' } } } }, context: { branch: 'two' }, expected: ['entry', 'main', 'exit'] },
  { champion: 'Sevika three', metadata: { castVariants: { branch: { three: { main: 'main' } } } }, context: { branch: 'three' }, expected: ['main'] },
  { champion: 'Sevika four', metadata: { castVariants: { branch: { four: { in: 'entry', main: 'hold' } } } }, context: { branch: 'four' }, expected: ['entry', 'hold'] },
  { champion: 'Jayce front', metadata: { castVariants: { front: { main: 'main', out: 'exit' } } }, context: { form: 'front' }, expected: ['main', 'exit'] },
  { champion: 'Jayce back', metadata: { castVariants: { back: { in: 'entry', main: 'main' } } }, context: { form: 'back' }, expected: ['entry', 'main'] },
];

describe('other multi-stage cast endings', () => {
  it.each(castCases)('$champion finishes every stage once, then plays only its basic attack', ({ metadata, context, expected }) => {
    const clips = ['idle', 'attack', 'entry', 'hold', 'main', 'exit', 'enhanced'].map((name, i) =>
      new AnimationClip(name, name === 'entry' || name === 'exit' ? 9 : 1,
        [new NumberKeyframeTrack('.position[x]', [0, 1], [i, i + 1])]));
    const mixer = new UnitAnimationMixer(new Group(), clips, { idle: 'idle', attack: 'attack', cast: 'main' }, metadata);
    const state = new UnitActionState('hero', { resolvePlayback: (action, index) => mixer.resolvePlayback(action, index, context) });
    try {
      const cast = state.consume({ type: 'cast', sourceId: 'hero' });
      expect(cast.playback?.clips).toEqual(expected); expect(cast.loop).toBe(false);
      expect(cast.playback!.durationSeconds).toBeLessThanOrEqual(2.5);
      mixer.apply(cast); mixer.update(cast.playback!.durationSeconds + 0.001);
      mixer.apply(state.update(cast.playback!.durationSeconds + 0.001));
      mixer.update(0.2);
      expect(state.output.state).toBe('idle');
      for (const name of expected) {
        const clip = clips.find(c => c.name === name)!, action = mixer.mixer.clipAction(clip);
        expect(action.loop).toBe(LoopOnce); expect(action.time).toBeCloseTo(clip.duration);
        expect(action.getEffectiveWeight()).toBe(0);
      }
      const attack = state.consume({ type: 'attack', attackerId: 'hero' });
      expect(attack.playback?.clips).toEqual(['attack']); expect(attack.loop).toBe(false);
      mixer.apply(attack); mixer.update(1.01); mixer.apply(state.update(1.01)); mixer.update(0.2);
      expect(state.output.state).toBe('idle');
      for (const name of expected) expect(mixer.mixer.clipAction(clips.find(c => c.name === name)!).getEffectiveWeight()).toBe(0);
    } finally { mixer.dispose(); }
  });
});
