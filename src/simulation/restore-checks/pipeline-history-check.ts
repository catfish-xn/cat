// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import type { MatchState } from '../match-types';

/** Defence in depth beside the history API's independent server authority / solo command replay. */
export function validatePipelineHistory(state: MatchState): void {
  const owner = state.augments.find(a => a.definitionId === 'prismatic-pipeline');
  const facts = state.augmentHistory?.facts.filter(f => f.kind === 'orb-opened') ?? [];
  if (!facts.length) return;
  if (!owner || new Set(facts.map(f => f.kind === 'orb-opened' ? f.orbId : '')).size !== facts.length
    || facts.some(f => f.kind !== 'orb-opened' || f.choiceId !== owner.choiceId || f.tier !== 'prismatic'
      || f.round < owner.acquiredRound || typeof f.orbId !== 'string' || !f.orbId.length))
    throw new RangeError('Invalid prismatic pipeline opening history');
}
