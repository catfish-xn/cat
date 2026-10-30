import type { AugmentHistoryFact } from './augment-history-types';

type DeathFact = Extract<AugmentHistoryFact, { kind: 'deaths' }>;
type FactBlock = AugmentHistoryFact | { readonly kind: 'empty-death-run'; readonly first: DeathFact; readonly count: number };
const deathKeys = new Set(['kind', 'battleId', 'completeThroughTick', 'deaths', 'sequence', 'seatId', 'round', 'roundId', 'resourcePrefix']);

// Private replay storage only: every expanded boundary is still compared with
// the candidate. Do not change the public journal, its format or its bounds.
function emptyDeath(fact: AugmentHistoryFact): fact is DeathFact {
  if (fact.kind !== 'deaths' || fact.deaths.length !== 0) return false;
  const keys = Object.keys(fact);
  return keys.length === deathKeys.size && keys.every(key => deathKeys.has(key));
}
export function packReplayFacts(facts: readonly AugmentHistoryFact[]): readonly FactBlock[] {
  const blocks: FactBlock[] = [];
  for (const fact of facts) {
    const tail = blocks.at(-1);
    if (emptyDeath(fact)) {
      if (tail?.kind === 'empty-death-run') {
        const first = tail.first;
        if (fact.sequence === first.sequence + tail.count && fact.completeThroughTick === first.completeThroughTick + tail.count
          && fact.battleId === first.battleId && fact.seatId === first.seatId && fact.round === first.round
          && fact.roundId === first.roundId && fact.resourcePrefix === first.resourcePrefix) {
          blocks[blocks.length - 1] = { ...tail, count: tail.count + 1 };
          continue;
        }
      }
      blocks.push({ kind: 'empty-death-run', first: fact, count: 1 });
    } else blocks.push(fact);
  }
  return blocks;
}
export function unpackReplayFacts(blocks: readonly FactBlock[]): readonly AugmentHistoryFact[] {
  const facts: AugmentHistoryFact[] = [];
  for (const block of blocks) {
    if (block.kind !== 'empty-death-run') { facts.push(block); continue; }
    for (let i = 0; i < block.count; i++) facts.push(i === 0 ? block.first : {
      ...block.first, sequence: block.first.sequence + i, completeThroughTick: block.first.completeThroughTick + i,
    });
  }
  return facts;
}
