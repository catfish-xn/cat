import { describe, expect, it } from 'vitest';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { traitSummary, traitTierText } from '../src/presentation/trait-text';

describe('trait rule text', () => {
  it.each(Object.keys(TRAIT_DEFINITIONS))('%s has a filled summary and readable tier rows', id => {
    const definition = TRAIT_DEFINITIONS[id];
    for (const tier of definition.tiers) {
      const summary = traitSummary(id, tier.threshold), row = traitTierText(definition, tier);
      expect(summary).toBeTruthy(); expect(summary).not.toMatch(/@|<|%i:/);
      expect(row.startsWith(`${tier.threshold}：`)).toBe(true);
      expect(row).not.toMatch(/@|<|%i:|g23Trait|visionary|[a-z]{4,}/);
    }
  });
  it('fills tier rows from the rules source and drops clauses a tier has no value for', () => {
    const ambusher = TRAIT_DEFINITIONS.ambusher, quick = TRAIT_DEFINITIONS.quickstriker;
    expect(traitTierText(ambusher, ambusher.tiers[0])).toBe('2：暴击几率 +25%，暴击伤害 +10%');
    expect(traitTierText(ambusher, ambusher.tiers.at(-1)!)).toContain('伤害减免 15%');
    expect(traitTierText(quick, quick.tiers[0])).not.toContain('护盾');
    expect(traitTierText(quick, quick.tiers.at(-1)!)).toContain('200 护盾');
  });
  it('keeps the authored-effect wording for traits without a row template', () => {
    expect(traitTierText(TRAIT_DEFINITIONS.sentinel, TRAIT_DEFINITIONS.sentinel.tiers[0])).toContain('职业成员最终合计');
  });
});
