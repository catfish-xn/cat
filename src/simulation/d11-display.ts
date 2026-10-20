import { D14_ANOMALIES } from './content/d14-anomalies';
import { D11_FILL_DEFINITIONS, D11_FILL_TIERS } from './content/d11-fill';
import type { D11ChoiceId } from './content/d11-fill';
import type { CombatUnit } from './combat-types';
import type { MatchState } from './match-types';
import { d11PriorKills } from './d11-fill';
import { readG23Progress } from './g2-3-state';

/** Public content labels only; no bank, RNG, future offer or private receipt. */
export function d11ChoiceDisplay(definitionId:string) {
  if(Object.hasOwn(D14_ANOMALIES,definitionId)){const d=D14_ANOMALIES[definitionId];return {definitionId,name:d.name,description:d.description};}
  if(!Object.hasOwn(D11_FILL_DEFINITIONS,definitionId))return null;
  const id=definitionId as D11ChoiceId,definition=D11_FILL_DEFINITIONS[id];
  return {definitionId:id,name:definition.name,description:definition.description,
    ...(Object.hasOwn(D11_FILL_TIERS,id)?{tier:D11_FILL_TIERS[id as keyof typeof D11_FILL_TIERS]}:{})};
}
export function d11PrivateDisplay(state:MatchState) {
  const ids=[...state.augments.map(a=>a.definitionId),...(state.anomalyBinding?[state.anomalyBinding.definitionId]:[]),
    ...(state.pendingChoice?.offers??[])];
  const definitions=[...new Set(ids)].flatMap(id=>{const d=d11ChoiceDisplay(id);return d?[d]:[];});
  if(!definitions.length)return undefined;
  return {definitions,...(state.anomalyBinding?.definitionId==='headhunter'
    ?{headhunterKills:d11PriorKills(readG23Progress(state),state.anomalyBinding.boundRound)}:{})};
}
export function d11CombatDisplay(unit:CombatUnit) {
  const ids=[...(unit.sources??[]).map(s=>s.source.sourceDefinitionId),...(unit.itemPrograms??[]).map(p=>p.source.definitionId)];
  return [...new Set(ids)].sort().flatMap(id=>{const d=d11ChoiceDisplay(id);return d?[d]:[];});
}
