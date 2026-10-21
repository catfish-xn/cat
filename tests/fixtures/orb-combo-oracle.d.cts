import type { FrozenLootRound } from '../../src/simulation/loot-types';
import type { RngStream } from '../../src/simulation/m8/contracts';
export function lootPlan(seed:number,ordinal?:number,roomSeed?:number):{
 readonly rounds:readonly FrozenLootRound[];readonly rng:RngStream;readonly layoutRng:RngStream;
 readonly rolls:readonly {roundId:string;variant:string;copper:string|null;silver:readonly string[]}[];
};
