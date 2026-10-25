import { expect, it } from 'vitest';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import { readG23Progress, validateG23RewardSources } from '../src/simulation/g2-3-state';
import { replayG23Economy, validateG23Progress } from '../src/simulation/g2-3-match-progress';
import { restoreMatch } from '../src/simulation/serialization';
import { withG23RestoreReuse, registerG23RestoreOwner, reusedG23Sources, reusedG23Validation, readRestoreG23Replay } from '../src/simulation/g23-restore-reuse';

function fixture() {
  const started = startMatchCombat(createMatch(42));
  if (!started.ok) throw Error(started.reason);
  const raw = JSON.parse(JSON.stringify(started.state));
  raw.combatInputBasis.inputs.g23 = JSON.parse(JSON.stringify(readG23Progress(raw)));
  return raw;
}
it('reuses only this parsed owner, full equal DTO and exact receipt reference/seed within one scope', () => {
  const raw = fixture(), basis = raw.combatInputBasis.inputs.g23;
  withG23RestoreReuse(true, () => {
    registerG23RestoreOwner(raw);
    const progress = readG23Progress(raw)!;
    expect(readG23Progress(raw)).toBe(progress);
    validateG23RewardSources(raw);
    expect(reusedG23Sources(raw)).toBe(true);
    validateG23Progress(progress, raw.seed, raw.round);
    expect(reusedG23Validation(basis, raw.seed, raw.round)).toBe(true);
    expect(reusedG23Validation(basis, raw.seed + 1, raw.round)).toBe(false);
    expect(reusedG23Validation(basis, raw.seed, raw.round + 1)).toBe(false);
    basis.rngDraws++;
    expect(reusedG23Validation(basis, raw.seed, raw.round)).toBe(false);
    expect(() => validateG23Progress(basis, raw.seed, raw.round)).toThrow('Invalid G2-3 match progression');
    const receipts = raw.seatMechanics.hidden.progress.economyReceipts;
    expect(readRestoreG23Replay(receipts, raw.seed)).toBe(replayG23Economy(raw.seed, receipts));
    expect(readRestoreG23Replay(receipts, raw.seed + 1)).toBeUndefined();
    expect(readRestoreG23Replay([...receipts], raw.seed)).toBeUndefined();
  });
  expect(reusedG23Sources(raw)).toBe(false);
  expect(reusedG23Validation(basis, raw.seed, raw.round)).toBe(false);
});
it('disables object/nested scopes, restores outer scope on failure and retains no cross-call admission', () => {
  const raw = fixture();
  withG23RestoreReuse(true, () => {
    registerG23RestoreOwner(raw);
    const progress = readG23Progress(raw);
    expect(() => withG23RestoreReuse(false, () => {
      registerG23RestoreOwner(raw);
      expect(readG23Progress(raw)).not.toBe(progress);
      validateG23RewardSources(raw);
      expect(reusedG23Sources(raw)).toBe(false);
      throw Error('nested');
    })).toThrow('nested');
    expect(readG23Progress(raw)).toBe(progress);
  });
  expect(readG23Progress(raw)).not.toBe(readG23Progress(raw));
  expect(restoreMatch(JSON.stringify(raw))).toEqual(raw);
  raw.seatMechanics.hidden.progress.rngDraws++;
  for (const input of [raw, JSON.stringify(raw)]) expect(() => restoreMatch(input)).toThrow('Invalid G2-3 match progression');
});
