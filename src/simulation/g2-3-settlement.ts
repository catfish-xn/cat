import {itemGoldPayouts} from './g2-4b-item-gold';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from './content/g2-3-policy';
import {grantMechanicGold} from './seat-mechanics';
import {drainG23Rewards} from './g2-3-runtime';
import {readG23Progress,writeG23Progress} from './g2-3-state';
import {applyG23Radiant} from './g2-3-radiant';
import type { MatchState,MatchEvent } from './match-types';
import type { CombatState } from './combat-types';
import { advanceG23Economy,type G23BattleFacts } from './g2-3-economy';
import type { Team } from './board';
export function g23BattleFacts(combat:CombatState,team:Team,round:number,roundKind:'pve'|'pvp'):G23BattleFacts{
 const tier=(id:string)=>combat.strategy?.traits.find(t=>t.traitId===id&&t.team===team)?.tier??0;
 const allies=combat.units.filter(u=>u.team===team&&!u.definitionId.startsWith('g23-'));
 const itemPayouts=combat.itemGoldReceipts&&combat.itemRandomStreams?itemGoldPayouts({receipts:combat.itemGoldReceipts,streams:combat.itemRandomStreams},new Set(allies.map(u=>u.id))):[];
 return {...(itemPayouts.length?{itemGoldPayouts:itemPayouts}:{}),battleId:combat.combatId!,round,roundKind,result:combat.result==='draw'?'draw':combat.result===(team==='player'?'playerWin':'enemyWin')?'win':'loss',conquerorTier:tier('conqueror'),
 conquestTakedowns:[...new Set(allies.flatMap(u=>u.g23?.conquestTakedowns??[]))].sort(),chemBaronTier:tier('chem-baron'),alliedDeaths:allies.filter(u=>!u.alive&&!u.itemSummon).length,
 rumbleStar:allies.filter(u=>u.definitionId==='rumble').reduce<0|1|2|3>((n,u)=>Math.max(n,u.starLevel) as 0|1|2|3,0),highRollerGold:allies.reduce((n,u)=>n+(u.g23?.highRoller??[]).reduce((m,r)=>m+r.gold,0),0)};
}
export function g23SoloFacts(state:MatchState,combat:CombatState):G23BattleFacts{return g23BattleFacts(combat,'player',state.round,state.m8.round.kind==='pvp'?'pvp':'pve');}
export function commitG23Settlement(state:MatchState,facts:G23BattleFacts,policy?:import('./loot-runtime').UnitLootPolicy,events:MatchEvent[]=[]):MatchState{
 const p=readG23Progress(state);if(!p||p.economyReceipts.some(r=>r.kind==='battle'&&r.facts.battleId===facts.battleId))return state;
 const planned=advanceG23Economy(p,facts);let committed=writeG23Progress(state,planned.progress);
 for(const payout of g23BattlePayouts(facts,planned.progress.conquest.chestsOpened,p.conquest.chestsOpened)){const granted=grantMechanicGold(committed,payout);if(!granted.ok)throw Error(granted.reason);committed=granted.state;}
 committed=drainG23Rewards(committed,policy,events);
 return !p.conquest.radiantConversion&&planned.progress.conquest.radiantConversion?applyG23Radiant(committed):committed;
}
/** Only receipts created after economy's entry belong on top of goldAfter; armory prices can be negative. */
export function g23RoundGold(state:MatchState,round:number):number{
 const prefix=state.roundResults.find(r=>r.round===round)?.mechanicReceiptPrefixLength??0;
 return (state.seatMechanics?.receipts??[]).slice(prefix).filter(r=>r.round===round).reduce((n,r)=>n+(r.kind==='gold'?r.amount:r.kind==='unit'?r.gold:r.kind==='choice'?-r.price:0),0);
}

export function g23RadiantRound(state:MatchState):number|undefined{
 const p=readG23Progress(state),id=p?.conquest.receipts.find(r=>r.chestTiers.includes(15))?.battleId;
 const receipt=p?.economyReceipts.find(r=>r.kind==='battle'&&r.facts.battleId===id);
 return receipt?.kind==='battle'?receipt.facts.round:undefined;
}

export function g23BattlePayouts(facts:G23BattleFacts,opened:number,before:number){
 const payouts:{receiptId:string;source:string;amount:number}[]=[];
 payouts.push(...facts.itemGoldPayouts??[]);
 if(facts.highRollerGold)payouts.push({receiptId:`g23:high-roller:${facts.battleId}`,source:'high-roller',amount:facts.highRollerGold});
 for(const chest of G23_CONQUEROR_CHESTS.slice(before,opened)){
  const amount=Number(g23ConquerorReward(chest).Gold??0);if(amount)payouts.push({receiptId:`g23:conqueror:${chest.tier}:gold`,source:'conqueror-chest',amount});
 }
 return payouts;
}
