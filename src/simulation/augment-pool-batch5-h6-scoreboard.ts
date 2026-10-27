import type { MatchState } from './match-types';
import type { AugmentGrowth } from './augment-history-types';
import { readAugmentGrowth, recordAugmentGrowth, requireAugmentFacts } from './augment-history';
import { UNIT_DEFINITIONS } from './units';

export function grantScoreboardEntry(state:MatchState):MatchState {
 const owner=state.augments.find(a=>a.definitionId==='scoreboard-scrapper');
 if(!owner||state.round<=owner.acquiredRound)return state;
 const table=requireAugmentFacts(state,'table',state.round).find(f=>f.stage==='entry');
 if(!table)throw new RangeError('Invalid scoreboard entry table');
 const self=table.seats.find(s=>s.seatId===table.seatId);
 if(!self || self.rank<1 || self.rank>8)throw new RangeError('Invalid scoreboard rank');
 if(self.rank<=4)return state;
 const entry=requireAugmentFacts(state,'round-entry',state.round);
 if(entry.length!==1)throw new RangeError('Invalid scoreboard entry roster');
 const deltas=entry[0].roster.units.filter(u=>u.team==='player' && UNIT_DEFINITIONS[u.definitionId] && !UNIT_DEFINITIONS[u.definitionId].summon && UNIT_DEFINITIONS[u.definitionId].unitKind!=='neutral')
  .map(u=>({unitId:u.id,healthFlat:0,healthBps:0,attackDamageBps:150,abilityPowerCenti:150}));
 return recordAugmentGrowth(state,owner.choiceId,JSON.stringify(['scoreboard-scrapper',owner.choiceId,state.round]),deltas);
}
export function scoreboardCombatGrowth(state:MatchState,unitIds:readonly string[], options?:{readonly provenancePrefixLength?:number;readonly definitions?:Readonly<Record<string,string>>}):readonly AugmentGrowth[] | undefined {
 const owner=state.augments.find(a=>a.definitionId==='scoreboard-scrapper');
 if(!owner)return undefined;
 let hp=0;
 if(state.round>owner.acquiredRound){
  const table=requireAugmentFacts(state,'table',state.round).find(f=>f.stage==='entry');
  const self=table?.seats.find(s=>s.seatId===table.seatId);
  if(!self)throw new RangeError('Invalid scoreboard entry table');
  hp=self.rank<=4?1000:0;
 }
 return unitIds.map(unitId=>{const growth=readAugmentGrowth(state,unitId,options?.provenancePrefixLength);const unit=state.preparation.units.find(u=>u.id===unitId);
  const definitionId=options?.definitions?.[unitId]??unit?.definitionId;const definition=definitionId?UNIT_DEFINITIONS[definitionId]:undefined;
  return {...growth,healthBps:growth.healthBps+(definition&&!definition.summon&&definition.unitKind!=='neutral'?hp:0)};});
}
