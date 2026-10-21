import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
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
import { UNIT_DEFINITIONS } from './units';
import { TACTICIANS_CROWN_ID } from './deployment-cap';
export function g23BattleFacts(combat:CombatState,team:Team,round:number,roundKind:'pve'|'pvp',openingUnits:readonly {readonly id:string;readonly team:Team}[]):G23BattleFacts{
 const tier=(id:string)=>combat.strategy?.traits.find(t=>t.traitId===id&&t.team===team)?.tier??0;
 const allies=combat.units.filter(u=>u.team===team&&!u.anomalySummon&&!u.definitionId.startsWith('g23-'));
 // 约定值 G24-CROWN-GOLD-01: only crowns bound to units deployed at combat start roll; the holder need not survive.
 if(!combat.strategy)throw new RangeError('Missing G23 opening strategy');
 const owners=new Set(openingUnits.filter(u=>u.team===team).map(u=>u.id));
 const crowns=combat.strategy.units.reduce((n,u)=>n+(owners.has(u.unitId)?(u.itemPrograms??[]).filter(p=>p.source.ownerId===u.unitId&&p.source.sourceKind==='item'&&p.source.definitionId===TACTICIANS_CROWN_ID).length:0),0);
 const allyIds=new Set(allies.map(u=>u.id));
 const splits=(combat.trenchSplits??[]).filter(split=>split.copyIds.some(id=>allyIds.has(id)));
 for(const split of splits)allyIds.add(split.ownerId);
 const itemPayouts=combat.itemGoldReceipts&&combat.itemRandomStreams?itemGoldPayouts({receipts:combat.itemGoldReceipts,streams:combat.itemRandomStreams},allyIds):[];
 const hunter=combat.units.find(u=>u.team===team&&u.d11Kills!==undefined&&!u.itemSummon);
 const familyTrait=combat.strategy.traits.find(t=>t.team===team&&t.traitId==='family');
 const familyIds=allies.filter(u=>owners.has(u.id)&&!u.itemSummon&&!u.anomalySummon&&!UNIT_DEFINITIONS[u.definitionId]?.summon&&(familyTrait?.memberUnitIds?familyTrait.memberUnitIds.includes(u.id):familyTrait?.memberDefinitionIds.includes(u.definitionId))).map(u=>u.id).sort();
 const melCasts=allies.filter(u=>owners.has(u.id)&&u.definitionId==='mel'&&!u.itemSummon&&!u.anomalySummon).reduce((n,u)=>n+(u.runtime?.castCount??0),0);
 return {...(familyTrait&&familyIds.length?{family:{stage:getMultiplayerRoundByOrdinal(round).stage,eligible:familyTrait.tier>=5,openingIds:familyIds,survivorIds:familyIds.filter(id=>allies.some(u=>u.id===id&&u.alive&&u.hp>0))}}:{}),...(melCasts?{melCasts}:{}),...(hunter?{d11Headhunter:{combatId:combat.combatId!,holderId:hunter.id,kills:hunter.d11Kills!}}:{}),...(itemPayouts.length?{itemGoldPayouts:itemPayouts}:{}),battleId:combat.combatId!,round,roundKind,result:combat.result==='draw'?'draw':combat.result===(team==='player'?'playerWin':'enemyWin')?'win':'loss',conquerorTier:tier('conqueror'),
 conquestTakedowns:[...new Set([...allies.flatMap(u=>u.g23?.conquestTakedowns??[]),...splits.flatMap(s=>s.g23?.conquestTakedowns??[])])].sort(),chemBaronTier:tier('chem-baron'),alliedDeaths:allies.filter(u=>!u.alive&&!u.itemSummon).length,
 rumbleStar:allies.filter(u=>u.definitionId==='rumble').reduce<0|1|2|3>((n,u)=>Math.max(n,u.starLevel) as 0|1|2|3,0),...(crowns?{crowns}:{}),highRollerGold:[...allies.map(u=>u.g23),...splits.map(s=>s.g23)].reduce((n,g)=>n+(g?.highRoller??[]).reduce((m,r)=>m+r.gold,0),0)};

}
export function g23SoloFacts(state:MatchState,combat:CombatState):G23BattleFacts{
 const basis=state.combatInputBasis;if(!basis)throw new RangeError('Missing G23 opening input');
 return g23BattleFacts(combat,'player',state.round,state.m8.round.kind==='pvp'?'pvp':'pve',basis.inputs.preparation.units.filter(u=>u.location.kind==='board'));
}
export function commitG23Settlement(state:MatchState,facts:G23BattleFacts,policy?:import('./loot-runtime').UnitLootPolicy,events:MatchEvent[]=[]):MatchState{
 const p=readG23Progress(state);if(!p||p.economyReceipts.some(r=>r.kind==='battle'&&r.facts.battleId===facts.battleId))return state;
 const planned=advanceG23Economy(p,facts);let committed=writeG23Progress(state,planned.progress);
 const receipt=planned.progress.economyReceipts.at(-1) as import('./g2-3-economy').G23EconomyAction;
 for(const payout of g23BattlePayouts(facts,planned.progress.conquest.chestsOpened,p.conquest.chestsOpened,receipt.crownGold??0)){const granted=grantMechanicGold(committed,payout);if(!granted.ok)throw Error(granted.reason);committed=granted.state;}
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

export function g23BattlePayouts(facts:G23BattleFacts,opened:number,before:number,crownGold=0){
 const payouts:{receiptId:string;source:string;amount:number}[]=[];
 payouts.push(...facts.itemGoldPayouts??[]);
 if(facts.highRollerGold)payouts.push({receiptId:`g23:high-roller:${facts.battleId}`,source:'high-roller',amount:facts.highRollerGold});
 for(const chest of G23_CONQUEROR_CHESTS.slice(before,opened)){
  const amount=Number(g23ConquerorReward(chest).Gold??0);if(amount)payouts.push({receiptId:`g23:conqueror:${chest.tier}:gold`,source:'conqueror-chest',amount});
 }
 if(crownGold)payouts.push({receiptId:`g23:crown:${facts.battleId}`,source:'tacticians-crown',amount:crownGold});
 return payouts;
}
