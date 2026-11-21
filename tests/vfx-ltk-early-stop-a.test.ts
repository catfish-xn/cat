import { describe, expect, it } from 'vitest';
import { CUE_ADDITIONS, CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { elise } from '../src/rendering/three-mode/vfx-ltk/batch3/elise';

// Early-stop group A, first batch (11-15): no rule event ends these cues, so each plays to its system's own end
// (start + emission + particle life of its emitters) with no stopAfter or fade. Mordekaiser's a7c49a29 keeps its commented stop;
// Irelia's 67665513 follows her shield's end event (#677); Mel's shield and save go with the shield-end work.
const cue = (list: readonly { system: string }[] | undefined, system: string) => list!.find(c => c.system === system) as Record<string, unknown>;
describe('early-stop group A plays to each system\'s own end', () => {
  it.each([
    ['mel-third', 'e2f2798d', 2.3], ['mel-third', '4c885a29', 1.2], ['mel-third-blast', '3857e78b', 6.5], ['elise-front', '6d6525e8', 2.1],
  ] as const)('%s %s plays to its own end (%s)', (key, system, duration) => {
    // Mel's third-cast explosion plays when its bolt lands (11-21, batch2-bridge.ts), from its own display branch.
    const entry = cue(CUE_OVERRIDES[key] ?? CUE_EXTRA_SKILLS[key], system);
    expect(entry).toMatchObject({ duration });
    expect(entry.stopAfter).toBeUndefined(); expect(entry.fadeOut).toBeUndefined();
  });
  it('Ambessa c07aa972 plays to its own end with no stop or fade', () => {
    const entry = cue(CUE_ADDITIONS.ambessa, 'c07aa972');
    expect(entry).toMatchObject({ delay: 0.05, duration: 1 });
    expect(entry.stopAfter).toBeUndefined(); expect(entry.fadeOut).toBeUndefined();
  });
  it('Elise\'s override changes only 6d6525e8 of the exported front-row list', () => {
    const exported = elise['elise-front']!, override = CUE_OVERRIDES['elise-front']!;
    expect(override.map(c => c.system)).toEqual(exported.map(c => c.system));
    override.forEach((c, i) => { if (c.system !== '6d6525e8') expect(c).toBe(exported[i]); });
  });
  it('Mordekaiser keeps the commented stop on a7c49a29', () => {
    expect(cue(CUE_OVERRIDES.mordekaiser, 'a7c49a29')).toMatchObject({ stopAfter: 0.08 });
  });
});
