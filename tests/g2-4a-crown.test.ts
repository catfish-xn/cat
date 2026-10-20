import {expect,it} from 'vitest';
import {deployMatchUnit,equipItem,getDeploymentCap,selectChoice,sellUnit,startMatchCombat,useConsumable,type MatchEvent,type MatchState} from '../src/simulation/match';
import {getPlayerDeploymentCount} from '../src/simulation/game';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {REFORGE_POOLS} from '../src/simulation/content/consumables';
import {TEMPORARY_EQUIPMENT_POOL} from '../src/simulation/temporary-equipment';
import {TACTICIANS_CROWN_ID,crownTeamSizeBonus} from '../src/simulation/deployment-cap';
import {readG23Progress} from '../src/simulation/g2-3-state';
import {commitG23Settlement} from '../src/simulation/g2-3-settlement';
import {drainG23Rewards,openG23Choice} from '../src/simulation/g2-3-runtime';
import {createInputValidation,validateInputAssets} from '../src/simulation/input-assets';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {restoreCombatInput,type CombatInputAuthority} from '../src/simulation/combat-input';
import {ROUND_CATALOG} from '../src/simulation/content/round-catalog';
import {nextRandom} from '../src/simulation/rng';
import type {G23BattleFacts} from '../src/simulation/g2-3-economy';
import {accepted,board} from './t10-helpers';
import {catalogPreparation} from './t5r-helpers';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const facts=(round:number):G23BattleFacts=>({battleId:'crown-battle-'+round,round,roundKind:'pve',result:'win',conquerorTier:9,
 conquestTakedowns:Array.from({length:30},(_,i)=>'enemy-'+i),chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0});
/** 20 conquest stacks per takedown at tier 9: two 30-takedown battles cross tier 12 (850), three cross tier 15 (1500). */
function crowned(battles:number):MatchState{
 let state:MatchState={...catalogPreparation('2-1'),level:3,gold:100};
 for(let round=1;round<=battles;round++)state=commitG23Settlement(state,facts(round));
 state=openG23Choice(state).state;
 while(state.pendingChoice){const c=state.pendingChoice;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[0]));}
 return state;
}
const own=(state:MatchState)=>state.preparation.units.filter(u=>u.team==='player');
const crowns=(state:MatchState)=>state.items.filter(i=>i.definitionId===TACTICIANS_CROWN_ID);
function fillBoard(state:MatchState):MatchState{
 const free=[0,2,3,4,5,6].map(col=>board(col));
 for(const unit of own(state).filter(u=>u.location.kind==='bench')){
  if(getPlayerDeploymentCount(state.preparation)>=getDeploymentCap(state))break;
  state=accepted(deployMatchUnit(state,unit.id,free.shift()!));
 }
 return state;
}

it('tiers 12 and 15 grant the sourced crowns and source gold; the crown is reward-only',()=>{
 const atoms=(tier:number)=>{const {Gold:_g,...reward}=g23ConquerorReward(G23_CONQUEROR_CHESTS[tier-1]);return g23RewardAtoms({id:`g23:conqueror:${tier}`,round:4,source:'conqueror',tier,reward},42);};
 expect(g23ConquerorReward(G23_CONQUEROR_CHESTS[11])).toEqual({Item:[TACTICIANS_CROWN_ID],Gold:20});
 expect(atoms(12)).toEqual([{id:'g23:conqueror:12:atom:0',kind:'item',options:[TACTICIANS_CROWN_ID],quantity:1,gold:0}]);
 expect(atoms(15).filter(a=>a.kind==='item').map(a=>a.options)).toEqual([[TACTICIANS_CROWN_ID],[TACTICIANS_CROWN_ID]]);
 expect(ITEM_DEFINITIONS[TACTICIANS_CROWN_ID]).toMatchObject({kind:'completed',unique:false,slotCost:1,effects:[]});
 expect(ITEM_DEFINITIONS[TACTICIANS_CROWN_ID].recipe).toBeUndefined();
 expect(REFORGE_POOLS.completed.map(d=>d.definitionId)).not.toContain(TACTICIANS_CROWN_ID);
 expect(TEMPORARY_EQUIPMENT_POOL.completed.map(d=>d.definitionId)).not.toContain(TACTICIANS_CROWN_ID);
 expect(atoms(9)[0].options).not.toContain(TACTICIANS_CROWN_ID);
});

it('each granted crown permanently adds one team slot, in the inventory or after its holder is sold',()=>{
 expect(getDeploymentCap({...catalogPreparation('2-1'),level:3})).toBe(3);expect(crownTeamSizeBonus(undefined)).toBe(0);
 const one=crowned(2),three=crowned(3);
 expect(crowns(one)).toHaveLength(1);expect(crowns(one)[0].location).toEqual({kind:'inventory'});
 expect(getDeploymentCap(one)).toBe(4);
 expect(crowns(three)).toHaveLength(3);expect(getDeploymentCap(three)).toBe(6);
 // Equipping, then selling the holder, returns the crown to the inventory; the slot stays.
 const holder=own(one).find(u=>u.location.kind==='bench')!;
 const equipped=accepted(equipItem(one,crowns(one)[0].id,holder.id,0));
 expect(getDeploymentCap(equipped)).toBe(4);
 const sold=accepted(sellUnit(equipped,holder.id));
 expect(crowns(sold)[0].location).toEqual({kind:'inventory'});expect(getDeploymentCap(sold)).toBe(4);
 // Even with every crown instance gone the granted slot is not taken back.
 expect(getDeploymentCap({...sold,items:sold.items.filter(i=>i.definitionId!==TACTICIANS_CROWN_ID)})).toBe(4);
 // Re-reading the same receipts never double counts.
 expect(crownTeamSizeBonus(readG23Progress(sold))).toBe(1);
});

it('a crown lets the player deploy and start with level + 1 units, and the frozen input and PvP snapshot validate',()=>{
 const state=fillBoard(crowned(2));
 expect(getPlayerDeploymentCount(state.preparation)).toBe(4);
 const spare=own(state).find(u=>u.location.kind==='bench');
 expect(deployMatchUnit(state,spare!.id,board(6))).toMatchObject({ok:false,reason:'population-cap'});
 const combat=accepted(startMatchCombat(state)),basis=combat.combatInputBasis!,input=basis.inputs;
 expect(input.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')).toHaveLength(4);
 const validation=createInputValidation(ok=>{if(!ok)throw new Error('population cap');}),enemies=input.preparation.units.filter(u=>u.team==='enemy');
 const boundary={playerLevel:3,nextUnitSerial:basis.nextUnitSerial,nextItemSerial:basis.nextItemSerial};
 expect(()=>validateInputAssets(input,{...boundary,teamSizeBonus:crownTeamSizeBonus(input.g23)},enemies,validation)).not.toThrow();
 expect(()=>validateInputAssets(input,boundary,enemies,validation)).toThrow();
 const snapshot=snapshotForBattle(state,'A');
 expect(snapshot.units).toHaveLength(4);expect(crownTeamSizeBonus(snapshot.g23)).toBe(1);
});

it('reforging or removing the crown keeps the granted team slot (user rule)',()=>{
 const state=crowned(2),holder=own(state).find(u=>u.location.kind==='bench')!;
 const equipped=accepted(equipItem(state,crowns(state)[0].id,holder.id,0));
 const remover=equipped.consumables.find(c=>c.definitionId==='magnetic-remover');
 const removed=accepted(useConsumable(equipped,remover!.consumableId,{kind:'unit',unitId:holder.id}));
 expect(crowns(removed)[0].location).toEqual({kind:'inventory'});expect(getDeploymentCap(removed)).toBe(4);
 expect(remover).toBeTruthy();
 const reforger=equipped.consumables.find(c=>c.definitionId==='completed-reforger');
 expect(useConsumable(equipped,reforger!.consumableId,{kind:'item',itemId:crowns(equipped)[0].id})).toMatchObject({ok:false,reason:'invalid-consumable-target'});
 expect(getDeploymentCap(equipped)).toBe(4);
});

it('a crown grant that fails records no claim and adds no slot; the next drain retries it',()=>{
 // One battle claims every chest below tier 12; the second crosses tier 12 (the crown) only.
 const before=crowned(1);expect(crowns(before)).toHaveLength(0);
 // An instance already holding the next serial makes every permanent item grant refuse (invalid-mechanic-state).
 const collider={id:`item-${before.nextItemSerial}`,definitionId:'bf-sword',location:{kind:'inventory' as const}};
 const events:MatchEvent[]=[];
 const failed=commitG23Settlement({...before,items:[...before.items,collider]},facts(2),undefined,events);
 expect(events).toContainEqual(expect.objectContaining({type:'mechanicFailed',hook:'rewards'}));
 expect(crowns(failed)).toHaveLength(0);expect(crownTeamSizeBonus(readG23Progress(failed))).toBe(0);
 expect(getDeploymentCap(failed)).toBe(3);
 const retried=drainG23Rewards({...failed,items:failed.items.filter(i=>i.id!==collider.id)});
 expect(crowns(retried)).toHaveLength(1);expect(getDeploymentCap(retried)).toBe(4);
 expect(drainG23Rewards(retried)).toEqual(retried);
});

it('a frozen combat input must carry a prefix of the authoritative reward claims',()=>{
 const combat=accepted(startMatchCombat(fillBoard(crowned(2))));
 const frozen=combat.combatInputBasis!,input=frozen.inputs;
 // The synthetic catalog state skips the real start's battle-seed cursor; re-derive it as restoreCombatInput does.
 let battleSeed=(combat.seed^0x9e3779b9)>>>0;
 for(const entry of ROUND_CATALOG){if(entry.ordinal>combat.round)break;if(entry.kind!=='supply')battleSeed=nextRandom(battleSeed).word;}
 const basis={...frozen,battleSeed};
 // The authority restoreMatch would fold from this state, taken from the frozen basis where it is a prefix.
 const authority:CombatInputAuthority={g23:readG23Progress(combat),playerHp:combat.playerHp,seed:combat.seed,round:combat.round,
  contentDigest:combat.contentDigest,playerLevel:basis.playerLevel,provenancePrefixLength:basis.provenancePrefixLength,
  resources:{units:input.preparation.units.filter(u=>u.team==='player'),items:input.items,persistentGrowth:input.persistentGrowth,
   nextUnitSerial:basis.nextUnitSerial,nextItemSerial:basis.nextItemSerial},
  equipmentRolls:combat.equipmentState.rolls,equipmentRollPrefixLength:basis.equipmentRollPrefixLength,
  scheduleReceipts:combat.scheduleReceipts,roundResults:combat.roundResults};
 expect(()=>restoreCombatInput(basis,authority)).not.toThrow();
 // Authority without the crown claim: the frozen input's extra claim (and its slot) is refused.
 const crownless={...authority,g23:{...authority.g23!,rewardClaims:authority.g23!.rewardClaims.filter(c=>c.definitionId!==TACTICIANS_CROWN_ID)}};
 expect(()=>restoreCombatInput(basis,crownless)).toThrow('Invalid combat input basis');
});
