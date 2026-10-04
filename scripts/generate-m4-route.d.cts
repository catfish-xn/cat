import type { MatchState, MatchEvent } from '../src/simulation/match';
import type { UnitLocation } from '../src/simulation/units';
import type { TraitSnapshot } from '../src/simulation/strategy-types';
export type Command = {type:'buy';slot:number;generation:number}|{type:'sell';id:string}|{type:'deploy';id:string;target:UnitLocation}
 |{type:'reroll'|'buyXp'|'start'}|{type:'combine';ids:readonly [string,string]}|{type:'equip';itemId:string;unitId:string;slot:number}
 |{type:'select';choiceId:string;generation:number;definitionId:string}|{type:'target';choiceId:string;generation:number;unitId:string}
 |{type:'anomalyReroll';choiceId:string;generation:number}|{type:'continue';round:number};
export interface Action {command:Command;annotation?:string;before:MatchState;after:MatchState;events:readonly MatchEvent[]}
export interface Round {round:number;preparationActions:Action[];before:MatchState;started:MatchState;atTick:Map<number,MatchState>;events:MatchEvent[];settled:MatchState;continued:MatchState;continuation?:Action;traits:TraitSnapshot[]}
export interface Route {initial:MatchState;rounds:Round[];actions:Action[];allEvents:MatchEvent[];final:MatchState}
export default function generateRoute():Promise<Route>;
