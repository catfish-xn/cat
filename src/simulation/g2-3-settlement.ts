import {applyG23Radiant} from './g2-3-radiant';
import type { MatchState } from './match-types';
import type { CombatState } from './combat-types';
import { advanceG23Economy,type G23BattleFacts } from './g2-3-economy';
import type { Team } from './board';
export function g23BattleFacts(combat:CombatState,team:Team,round:number,roundKind:'pve'|'pvp'):G23BattleFacts{
 const tier=(id:string)=>combat.strategy?.traits.find(t=>t.traitId===id&&t.team===team)?.tier??0;
 const allies=combat.units.filter(u=>u.team===team&&!u.definitionId.startsWith('g23-'));
 return {battleId:combat.combatId!,round,roundKind,result:combat.result==='draw'?'draw':combat.result===(team==='player'?'playerWin':'enemyWin')?'win':'loss',conquerorTier:tier('conqueror'),
 conquestTakedowns:[...new Set(allies.flatMap(u=>u.g23?.conquestTakedowns??[]))].sort(),chemBaronTier:tier('chem-baron'),alliedDeaths:allies.filter(u=>!u.alive).length,
 rumbleStar:allies.filter(u=>u.definitionId==='rumble').reduce<0|1|2|3>((n,u)=>Math.max(n,u.starLevel) as 0|1|2|3,0),highRollerGold:allies.reduce((n,u)=>n+(u.g23?.highRoller??[]).reduce((m,r)=>m+r.gold,0),0)};
}
export function g23SoloFacts(state:MatchState,combat:CombatState):G23BattleFacts{return g23BattleFacts(combat,'player',state.round,state.m8.round.kind==='pvp'?'pvp':'pve');}
export function commitG23Settlement(state:MatchState,facts:G23BattleFacts):MatchState{
 if(!state.g23)return state;
 const planned=advanceG23Economy(state.g23,facts);
 if(planned.progress===state.g23)return state;
 const committed={...state,g23:planned.progress,gold:state.gold+planned.gold};
 return !state.g23.conquest.radiantConversion&&planned.progress.conquest.radiantConversion?applyG23Radiant(committed):committed;
}
export function g23RoundGold(state:MatchState,round:number):number{return state.g23?.economyReceipts.reduce((n,r)=>n+(r.kind==='battle'&&r.facts.round===round?r.gold:0),0)??0;}

export function g23RoundCosts(state:MatchState,round:number):number{return state.g23?.junkerPurchases.filter(r=>r.round===round).reduce((n,r)=>n+r.cost,0)??0;}

export function g23RadiantRound(state:MatchState):number|undefined{
 const id=state.g23?.conquest.receipts.find(r=>r.chestTiers.includes(15))?.battleId;
 return state.g23?.economyReceipts.find(r=>r.kind==='battle'&&r.facts.battleId===id)?.kind==='battle'?state.g23.economyReceipts.filter(r=>r.kind==='battle').find(r=>r.facts.battleId===id)?.facts.round:undefined;
}
