// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById } from '../multiplayer-round';

/** Selection is authenticated by its schedule receipt and the provenance fold;
 * require exactly one marker for the owned augment, none otherwise. */
export function validateFormSwapperSelection(state:MatchState):void {
 const a=state.augments.find(a=>a.definitionId==='why-not-both');
 const markers=state.resourceProvenance.entries.filter(e=>e.kind==='form-swapper-selected');
 if(markers.length!==(a?1:0)||a&&markers.some(e=>e.kind!=='form-swapper-selected'||e.choiceId!==a.choiceId||getMultiplayerRoundById(e.roundId).ordinal!==a.acquiredRound))throw new RangeError('Invalid form swapper selection authority');
}
