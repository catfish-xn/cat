import { COMPILED_NEUTRAL_ENCOUNTERS } from './neutral-encounter-compiler';
import { NEUTRAL_ENCOUNTERS } from './content/neutral-encounters';
import { isCrabEncounter } from './content/opening-batch-b';
import { openingEncounterId } from './opening-encounter';
import type { MatchState } from './match-types';
import { shareGeneratedJson } from './immutable-json';
export function enterOpeningCrabs(state:MatchState):MatchState {
 const id=openingEncounterId(state);
 if(!isCrabEncounter(id)||state.m8.round.kind!=='pve')return state;
 const encounter=COMPILED_NEUTRAL_ENCOUNTERS.find(e=>e.encounterId===`${id}/${state.roundDefinitionId}`);
 if(!encounter)throw new RangeError('Missing crab encounter');
 if(state.m8.preparation.enemies[0]?.id===encounter.deployment[0].id)return state;
 return {...state,m8:shareGeneratedJson({...state.m8,preparation:{...state.m8.preparation,enemies:encounter.deployment}}),preparation:{...state.preparation,units:[...state.preparation.units.filter(u=>u.team==='player'),...encounter.deployment]}};
}
/** Preserve original base loot and its RNG; original slot order maps to crab order.
 * The sixth 4-7 carrier shares the fifth crab's death. No drop is lost or doubled. */
export function openingCrabCarrier(state:Pick<MatchState,'openingEncounter'>,roundId:string,sourceId:string):string {
 const id=openingEncounterId(state);if(!isCrabEncounter(id))return sourceId;
 const original=NEUTRAL_ENCOUNTERS.find(e=>e.roundId===roundId),crab=COMPILED_NEUTRAL_ENCOUNTERS.find(e=>e.encounterId===`${id}/${roundId}`);
 if(!original||!crab)return sourceId;
 const index=original.slots.findIndex(s=>JSON.stringify(['pve',roundId,original.encounterId,s.slotId])===sourceId);
 return index<0?sourceId:JSON.stringify(['pve',roundId,crab.encounterId,`c${Math.min(index,crab.deployment.length-1)}`]);
}
