import type { MatchState, MatchCommandResult, MatchStep } from '../src/simulation/match';
export interface Command { type: string; [key:string]: unknown }
export interface Route { summary: {caitlynBattles:number;caitlynCasts:number;build:string;seed:number;outcome:string|null;round:number;hp:number;gold:number;formedAt:number|null;formedBattles:number;boundBattles:number;transitioned:boolean;ticks:number;commands:number;durationSeconds:number};initial:MatchState;final:MatchState;actions:Array<{command:Command;beforeHash:string;afterHash:string;events:unknown[]}>;rounds:Array<{round:number;events:unknown[];formed:boolean;snapshot:import('../src/simulation/strategy-types').StrategySnapshot;binding:import('../src/simulation/strategy-types').AnomalyBinding|null}>;ledger:{costs:Record<string,number>;rounds:unknown[]} }
export interface Options {build?:string;seed?:number;retainStates?:boolean;onStep?:(before:MatchState,result:MatchCommandResult|MatchStep,command?:Command)=>void}
declare function generateRoute(options?:Options):Promise<Route>;
export function run(api:typeof import('../src/simulation/match'),options?:Options):Promise<Route>;
export function dispatch(api:typeof import('../src/simulation/match'),state:MatchState,command:Command):MatchCommandResult;
export const BUILDS: Record<string,{core:string;tank:string;units:string[];carry:string[];early:string}>;
export default generateRoute;
