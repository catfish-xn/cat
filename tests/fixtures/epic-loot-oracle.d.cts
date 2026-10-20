import type { FrozenLootRound } from '../../src/simulation/loot-types';
import type { RngStream } from '../../src/simulation/m8/contracts';
export const COMPLETED: readonly string[], COMPONENTS: readonly string[], LIVE:readonly (readonly string[])[], LESSER:string,DUPLICATOR:string;
export function lootPlan(seed:number,ordinal?:number,roomSeed?:number):{rng:RngStream;layoutRng:RngStream;rounds:readonly FrozenLootRound[];rolls:readonly {roundId:string;variant:string;copper:string|null;silver:readonly string[]}[]};
export function stream(seed:number):{draw(n:number):number;value():RngStream};
export function bonus(tier:string,stage:number,index:number):string[];
export function copper(index:number):string;
export function silver(index:number):string;
export function variant(index:number):string;

export function bonusIndex(seed:number,orbId:string):number;
