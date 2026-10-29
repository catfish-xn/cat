// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { readAugmentFacts } from '../augment-history';
import type { MatchState } from '../match-types';

/** Detect orphaned transform facts even if an uploaded file deletes its owner/history together. */
export function validateBatch5R6Transforms(state: MatchState): void {
  const facts = state.resourceProvenance.entries.filter(e => e.kind === 'unit-transformed' || e.kind === 'augment-transform-completed');
  if (!facts.length) return;
  const fail = () => { throw new RangeError('Invalid batch5 transform authority'); };
  if (!state.augmentHistory || !state.multiplayer) fail();
  const entries = new Map(readAugmentFacts(state, 'round-entry').map(f => [f.roundId, f.round]));
  const acquisitions = new Map(readAugmentFacts(state, 'acquire').map(f => [f.choiceId, f]));
  const completedBatches = new Set<string>(), changedBatches = new Set<string>(), units = new Set<string>();
  for (const e of facts) {
    const owner = state.augments.find(a => a.choiceId === e.choiceId && ['pandoras-bench','recombobulator'].includes(a.definitionId));
    if (!owner) fail();
    const recombobulator = owner!.definitionId === 'recombobulator', acquire = acquisitions.get(e.choiceId);
    const round = recombobulator && acquire?.roundId === e.roundId ? acquire.round : !recombobulator ? entries.get(e.roundId) : undefined;
    if (!round || (recombobulator ? round !== owner!.acquiredRound : round <= owner!.acquiredRound)) fail();
    const batch = JSON.stringify([e.choiceId, e.roundId]);
    if (completedBatches.has(batch)) fail();
    if (e.kind === 'augment-transform-completed') completedBatches.add(batch);
    else {
      const key = JSON.stringify([batch, e.unitId]);
      if (units.has(key)) fail();
      units.add(key); changedBatches.add(batch);
    }
  }
  if ([...changedBatches].some(key => !completedBatches.has(key))) fail();
}
