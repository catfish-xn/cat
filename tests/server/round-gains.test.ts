/**
 * Work order C7 "本轮获得": the online client lists what appeared between my seat's last pre-battle state and the
 * current one (units, inventory items, gold before the income), and nothing when that baseline is unknown.
 */
import { describe, expect, it } from 'vitest';
import { createMatch } from '../../src/simulation/match';
import type { MatchState, RoundResult } from '../../src/simulation/match-types';
import { nextBaseline, readRoundGains, type RoundBaseline } from '../../src/rendering/online/round-gains';

const prep = createMatch(42);
const unit = (id: string, definitionId: string) => ({ id, definitionId, team: 'player' as const, starLevel: 1, location: { kind: 'bench' as const, slot: 3 } });
const record = (state: MatchState, goldBefore: number, income: number) => ({ round: state.round, goldBefore, goldAfter: goldBefore + income, income }) as unknown as RoundResult;
/** Same round after the battle: a loot hero, a picked component, 2 drop gold before the income of 3. */
function settled(base: MatchState, phase: MatchState['phase'] = 'settlement'): MatchState {
  return {
    ...base, phase, gold: base.gold + 2 + 3,
    preparation: { ...base.preparation, units: [...base.preparation.units, unit('loot-unit', 'lux') as never] },
    items: [...base.items, { id: 'item-loot', definitionId: 'sword', location: { kind: 'inventory' } }],
    roundResults: [...base.roundResults, record(base, base.gold + 2, 3)],
  } as MatchState;
}

describe('round gains (C7)', () => {
  it('lists new units, new inventory items and gold that arrived before the income', () => {
    let baseline: RoundBaseline | null = null;
    baseline = nextBaseline(baseline, prep);
    expect(readRoundGains(baseline, prep)).toBeNull(); // still before the battle
    const after = settled(prep);
    baseline = nextBaseline(baseline, after);
    expect(baseline.state).toBe(prep); // the post-battle state never becomes the baseline
    expect(readRoundGains(baseline, after)).toEqual({ round: prep.round, gold: 2,
      units: [{ id: 'loot-unit', definitionId: 'lux', starLevel: 1 }], items: [{ id: 'item-loot', definitionId: 'sword' }] });
  });

  it('takes the last preparation state of the round as baseline, so purchases are not gains', () => {
    const bought = { ...prep, gold: prep.gold - 1, preparation: { ...prep.preparation, units: [...prep.preparation.units, unit('bought', 'irelia') as never] } } as MatchState;
    let baseline = nextBaseline(nextBaseline(null, prep), bought);
    expect(baseline.state).toBe(bought);
    const after = settled(bought);
    baseline = nextBaseline(baseline, after);
    const gains = readRoundGains(baseline, after)!;
    expect(gains.units.map(entry => entry.id)).toEqual(['loot-unit']);
    expect(gains.gold).toBe(2);
  });

  it('knows nothing after a resume past the battle, and nothing across rounds', () => {
    const after = settled(prep, 'choice');
    const resumed = nextBaseline(null, after);
    expect(resumed.state).toBeNull();
    expect(readRoundGains(resumed, after)).toBeNull();
    const next = { ...prep, round: prep.round + 1, phase: 'settlement' } as MatchState;
    expect(readRoundGains(nextBaseline(null, prep), next)).toBeNull();
  });
});
