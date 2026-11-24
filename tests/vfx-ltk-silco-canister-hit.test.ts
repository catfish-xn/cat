import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { withOwnLife } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { silco } from '../src/rendering/three-mode/vfx-ltk/batch3/silco';

// Silco's canister burst plays to its system's own end: the default cue time faded it out early and cut its last layers
// (magenta bubbles, ground glow, the purple splash's tail). Every other cue of the exported cast stays as it was.
const BURST = '2276fa35';

describe('Silco canister burst', () => {
  it('plays its own life, with the exported timing otherwise unchanged', () => {
    const exported = silco.silco!, cues = CUE_OVERRIDES.silco!;
    const burst = cues.filter(cue => cue.system === BURST);
    expect(burst).toHaveLength(1);
    expect(burst[0]).toEqual({ ...exported.find(cue => cue.system === BURST)!, ownLife: true });
    expect(burst[0]).toMatchObject({ event: 'hit' });
    expect(burst[0]!.action ?? 'cast').toBe('cast');
    expect(burst[0]!.scale).toBeUndefined();
    expect(cues.filter(cue => cue.system !== BURST)).toEqual(exported.filter(cue => cue.system !== BURST));
    expect(cues.length).toBeLessThanOrEqual(12);
  });
  it('lasts as long as its loaded system when that outlives the default', () => {
    // Synthetic emitter (made-up numbers): one single particle born at 0 that lives longer than the cue's default.
    const curve = { constant: [1.5], keys: [], tables: [] };
    const loaded = { model: { emitters: [{ singleParticle: true, lifetime: null, timeBeforeFirstEmission: 0, particleLifetime: curve }] } };
    const burst = CUE_OVERRIDES.silco!.find(cue => cue.system === BURST)!;
    expect(withOwnLife(burst, loaded as unknown as Parameters<typeof withOwnLife>[1]).duration).toBeCloseTo(1.5);
    expect(silco.silco!.find(cue => cue.system === BURST)!.duration).toBeLessThan(1.5);
  });
  it('leaves the minions\' list alone', () => {
    expect(Object.hasOwn(CUE_OVERRIDES, 'silco-minion')).toBe(false);
  });
});
