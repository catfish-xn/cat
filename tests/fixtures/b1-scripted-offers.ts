import { vi } from 'vitest';
import * as choices from '../../src/simulation/choices';

/** B1 behavior fixtures control only the three-card draw, never eligibility or commands.
 * The real candidate pool and RNG advancement are kept, so trait-filter tampering still fails.
 * Restore's offer-history validation calls the same spied generateChoices, so a scripted state
 * restores only inside this wrapper; outside it production rejects it (Invalid augment offer history).
 * Any offers.toContain(target) inside the wrapper is a fixture self-check, not a real-RNG claim.
 */
/** Install scripted augment draws for nested hooks; call the returned function to restore. */
export function installB1Offers(priorities: readonly string[]): () => void {
  if (!priorities.length) return () => {};
  const generate = choices.generateChoices;
  const sampler = vi.spyOn(choices, 'generateChoices').mockImplementation((ids, rng) => {
    const drawn = generate(ids, rng);
    const target = priorities.find(id => ids.includes(id));
    if (!target || drawn.offers.includes(target)) return drawn;
    return { ...drawn, offers: [target, ...drawn.offers.slice(1)] };
  });
  return () => sampler.mockRestore();
}

export function withB1Offers<T>(priorities: readonly string[], run: () => T): T {
  const restore = installB1Offers(priorities);
  try { return run(); } finally { restore(); }
}
