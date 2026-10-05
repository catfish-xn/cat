import type {MatchState,RoundResult} from '../../../src/simulation/match';
import type {CombatState} from '../../../src/simulation/combat';
export const COST:Record<string,number>;
export const SELL:Record<number,number[]>;
export function settlement(before:MatchState,combat:CombatState|null):RoundResult;
export function shop(rng:number,generation:number,level:number,locked?:boolean):{rngState:number;shop:MatchState['shop']};
export function xp(level:number,value:number,amount:number):{level:number;xp:number;xpApplied:number};
