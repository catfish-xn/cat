import { describe, expect, it } from 'vitest';
import { elise } from '../src/rendering/three-mode/vfx-ltk/batch3/elise';
import { swain } from '../src/rendering/three-mode/vfx-ltk/batch3/swain';
import { jayceSkills } from '../src/rendering/three-mode/vfx-ltk/champions/jayce';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { viktorSkills } from '../src/rendering/three-mode/vfx-ltk/champions/viktor';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

const cue = (list: readonly TimelineCue[] | undefined, system: string) => {
  const found = list?.filter(entry => entry.system === system) ?? [];
  expect(found).toHaveLength(1);
  return found[0]!;
};

// 11-08 class-2 pass: emitters without linger were cleared in one frame at a hand-set stopAfter.
describe('class-2 stop timings checked against the original (3b-1)', () => {
  it("holds Viktor's board darkening 2.1 s and cuts it there, at one and three stars", () => {
    for (const [skill, system] of [['viktor-slam', 'c4ef93f3'], ['viktor-slam-3star', 'efdd9461']] as const) {
      const board = cue(viktorSkills[skill], system);
      expect(board).toMatchObject({ location: 'board', delay: 0, duration: 2.2, stopAfter: 2.1 });
      expect(board.fadeOut).toBeUndefined();
    }
  });

  it("starts Darius's blade ring with the cast, since its emitters carry their own 0.75 s lead", () => {
    expect(cue(CUE_OVERRIDES.darius, '97f3e391')).toMatchObject({ action: 'cast', event: 'cast-start', delay: 0, duration: 1.2 });
    expect(cue(CUE_OVERRIDES.darius, '97f3e391').stopAfter).toBeUndefined();
  });

  it('fades the soft-stopped casts instead of clearing them at stopAfter', () => {
    expect(cue(jayceSkills['jayce-back'], '508e8c05')).toMatchObject({ duration: .6, stopAfter: .3, fadeOut: true });
    expect(cue(sevikaSkills['sevika-punch'], '0badab98')).toMatchObject({ duration: .6, stopAfter: .5, fadeOut: true });
    expect(cue(viktorSkills.viktor, '37d3ac23')).toMatchObject({ duration: 1.5, stopAfter: 1, fadeOut: true });
  });

  it('lets the Elise and Swain back-form casts run to their natural end instead of cutting them while rising', () => {
    expect(cue(elise['elise-back'], '9e530234')).toMatchObject({ delay: 0, duration: 1.8 });
    expect(cue(swain['swain-back'], '2a51ddb9')).toMatchObject({ delay: 0, duration: 1.8 });
  });
});
