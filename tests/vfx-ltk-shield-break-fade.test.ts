import { describe, expect, it } from 'vitest';
import { CUE_RULE_STOPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// 11-25: every self-shield that ends with its ability's shield layer, checked layer by layer on a stop. Blitzcrank's barrier
// and Loris's shield left some layers on screen long after the rest (Blitzcrank's sparkles; Loris's dark shield face and
// lightning), so they ease out like Sevika's; Garen's, Vi's and Loris's retaliation ring go all at once and stay stopped.

const stop = CUE_RULE_STOPS.abilityShieldEnded.systems as Record<string, readonly string[]>;
const fade = CUE_RULE_STOPS.abilityShieldEndedFade.systems as Record<string, readonly string[]>;

describe('which shields ease out and which stop', () => {
  it('Blitzcrank\'s barrier and Loris\'s shield ease out', () => {
    expect(fade['blitzcrank-ability']).toEqual(['fc783cba']);
    expect(fade['loris-ability']).toEqual(['e22b48b0']);
  });
  it('Garen\'s, Vi\'s and Loris\'s retaliation ring stop', () => {
    expect(stop['garen-ability']).toEqual(['ea21ae27']);
    expect(stop['vi-ability']).toEqual(['9614ffb4']);
    expect(stop['loris-ability']).toEqual(['2f1f3b60']);
  });
  it('no system is both stopped and eased out', () => {
    for (const [ability, systems] of Object.entries(fade))
      for (const system of systems) expect(stop[ability] ?? []).not.toContain(system);
    expect(Object.hasOwn(stop, 'blitzcrank-ability')).toBe(false);
  });
});
