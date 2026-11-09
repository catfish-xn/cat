/** Effects-quality cull of `importance`, under the 14.24 numbering the authored bins use. Synthetic trees only. */
import { describe, expect, it } from 'vitest';
import { IMPORTANCE } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { culledAt, EFFECTS_QUALITY } from '../src/rendering/three-mode/vfx-ltk/engine/model/quality';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { num, syntheticSystem } from './vfx-ltk-synthetic';

const emitterAt = (importance: number, quality?: (typeof EFFECTS_QUALITY)[keyof typeof EFFECTS_QUALITY]) =>
  readVfxSystem(syntheticSystem({ importance: num(importance) }), quality).emitters[0];

describe('vfx importance cull', () => {
  it('keeps importance 4 at Very High, as Viktor\'s MAP_DISC_HIGH_WRITE board disc draws in the original', () => {
    expect(IMPORTANCE.highSpecOnly).toBe(4);
    const kept = emitterAt(4);
    expect(kept.disabled).toBe(false);
    expect(kept.culled).toBeNull();
    expect(culledAt(EFFECTS_QUALITY.high, 4)).toBe(false);
  });

  it('culls importance 4 on the low-spec qualities, and 5 on the high ones', () => {
    expect(culledAt(EFFECTS_QUALITY.veryLow, IMPORTANCE.highSpecOnly)).toBe(true);
    expect(culledAt(EFFECTS_QUALITY.low, IMPORTANCE.highSpecOnly)).toBe(true);
    expect(culledAt(EFFECTS_QUALITY.medium, IMPORTANCE.highSpecOnly)).toBe(false);
    expect(emitterAt(4, EFFECTS_QUALITY.low).culled).toBe('importance');
    expect(IMPORTANCE.lowSpecOnly).toBe(5);
    expect(emitterAt(5).culled).toBe('importance');
    expect(emitterAt(5).disabled).toBe(true);
    expect(culledAt(EFFECTS_QUALITY.veryLow, IMPORTANCE.lowSpecOnly)).toBe(false);
  });

  it('leaves the reflected tiers as they were', () => {
    for (const importance of [IMPORTANCE.low, IMPORTANCE.medium, IMPORTANCE.high, IMPORTANCE.always]) {
      expect(culledAt(EFFECTS_QUALITY.veryHigh, importance)).toBe(false);
    }
    expect(culledAt(EFFECTS_QUALITY.veryLow, IMPORTANCE.low)).toBe(true);
    expect(culledAt(EFFECTS_QUALITY.high, IMPORTANCE.low)).toBe(true);
    expect(culledAt(EFFECTS_QUALITY.high, IMPORTANCE.medium)).toBe(false);
  });
});
