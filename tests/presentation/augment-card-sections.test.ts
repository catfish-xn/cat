import { describe, expect, it } from 'vitest';
import { augmentCardSections, augmentEffectText, augmentPlayerDescription } from '../../src/presentation/augment-display';
import { AUGMENT_DEFINITIONS } from '../../src/simulation/content/augments';

describe('augment choice card text areas', () => {
  it('puts a team-up\'s 魔改执行 note in the extra block, under the description', () => {
    const id = Object.keys(AUGMENT_DEFINITIONS).find(key => augmentPlayerDescription(key)?.includes(' 魔改执行：'))!;
    expect(id).toBeDefined();
    const { body, extra } = augmentCardSections(id);
    expect(body).not.toContain('魔改执行');
    expect(extra[0]!.startsWith('魔改执行：')).toBe(true);
    expect(`${body} ${extra[0]}`).toBe(augmentPlayerDescription(id));
  });
  it('keeps every augment\'s text: description first, effect lines as extra; effects alone are the description', () => {
    for (const id of Object.keys(AUGMENT_DEFINITIONS)) {
      const { body, extra } = augmentCardSections(id), description = augmentPlayerDescription(id), effects = augmentEffectText(id);
      if (!description) { expect(body).toBe(effects); expect(extra).toEqual([]); continue; }
      expect([body, ...extra].join(' ').replace(/\s+/g, '')).toBe([description, effects].filter(Boolean).join('').replace(/\s+/g, ''));
    }
  });
});
