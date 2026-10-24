import { describe, expect, it } from 'vitest';
import { freezeLootThroughRound, restoreFrozenLootLedger } from '../src/simulation/loot-freeze';
import { createOrbLayout, freezeOrbLayoutThroughRound } from '../src/simulation/orb-layout';
import { lootOrbId } from '../src/simulation/loot-identity';
import { sampleOrbBox } from '../src/simulation/orb-box';
import { sampleOrbStagePlan } from '../src/simulation/orb-stage-plan';
import { getCatalogRoundById } from '../src/simulation/round-selectors';

const ordinal = getCatalogRoundById('4-7').ordinal;
describe('4-7 additional fixed component anvil', () => {
  it('preserves every original sampled entry and 2–4 components without any additional RNG draws', () => {
    const counts = new Set<number>();
    for (let seed = 0; seed < 64; seed++) {
      const frozen = freezeLootThroughRound(seed, ordinal);
      const round = frozen.rounds.at(-1)!;
      const layout = freezeOrbLayoutThroughRound(createOrbLayout(seed), ordinal);
      if (!layout.ok) throw Error(layout.reason);
      const template = layout.layout.rounds.at(-1)!;
      expect(round.orbs.map(({ entries, ...orb }) => orb)).toEqual(template.orbs.map(orb => ({
        ...orb, roundId: '4-7', encounterId: template.encounterId,
        orbId: lootOrbId('4-7', template.encounterId, orb.sourceUnitId, orb.slotOrdinal),
      })));
      for (const [index, orb] of round.orbs.entries()) {
        const original = sampleOrbBox(seed, orb.orbId, orb.templateId).payloads;
        expect(orb.entries.map(e => e.payload)).toEqual(index === 0
          ? [...original, { kind: 'forge', definitionId: 'TFT_ArmoryKeyComponent', quantity: 1 }]
          : original);
        expect(orb.entries.map(e => e.entryOrdinal)).toEqual(orb.entries.map((_, i) => i));
      }
      const drops = round.encounterPlan.drops;
      const components = round.orbs.filter(o => o.templateId === 'component').flatMap(o => o.entries.filter(e => e.payload.kind === 'item'));
      counts.add(components.length);
      expect(components).toHaveLength(sampleOrbStagePlan(seed).stages[3].components);
      const originalAnvils = round.orbs.flatMap(o => sampleOrbBox(seed, o.orbId, o.templateId).payloads)
        .filter(p => p.kind === 'forge' && p.definitionId === 'TFT_ArmoryKeyComponent').length;
      expect(drops.filter(d => d.payload.kind === 'forge' && d.payload.definitionId === 'TFT_ArmoryKeyComponent')).toHaveLength(originalAnvils + 1);
      expect(frozen.rng).toEqual(freezeLootThroughRound(seed, ordinal - 1).rng);
      expect(freezeLootThroughRound(seed, ordinal, layout.layout)).toEqual(frozen);
      expect(restoreFrozenLootLedger(JSON.parse(JSON.stringify(frozen)), { seed, throughRoundOrdinal: ordinal })).toEqual(frozen);
      expect(frozen.rounds.slice(0, -1)).toEqual(freezeLootThroughRound(seed, ordinal - 1).rounds);
    }
    expect([...counts].sort()).toEqual([2, 3, 4]);
  });
});
