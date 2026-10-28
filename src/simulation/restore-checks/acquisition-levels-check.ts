// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { type AcquisitionLevels, AUGMENT_ACQUISITION_LEVEL_KEY, countsLevels } from '../augment-xp';
import type { MatchState } from '../match-types';

/** Shape and bounds; the offline chain additionally checks each value against its acquisition round entry. */
export function validateAcquisitionLevels(state:MatchState):void {
 const raw=state.seatMechanics?.seat[AUGMENT_ACQUISITION_LEVEL_KEY],owners=state.augments.filter(countsLevels);
 if(raw===undefined&&!owners.length)return;
 const fail=()=>{throw new RangeError('Invalid augment acquisition levels');};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail();
 const levels=raw as AcquisitionLevels;
 if(Object.keys(levels).sort().join('\n')!==owners.map(a=>a.choiceId).sort().join('\n'))fail();
 for(const a of owners){const level=levels[a.choiceId];if(!Number.isSafeInteger(level)||level<1||level>state.level)fail();}
}
