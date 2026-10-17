import {expect,it} from 'vitest';
import {deployMatchUnit,equipItem,getDeploymentCap,selectChoice,sellUnit,startMatchCombat,useConsumable,type MatchState} from '../src/simulation/match';
import {getPlayerDeploymentCount} from '../src/simulation/game';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {REFORGE_POOLS} from '../src/simulation/content/consumables';
import {TEMPORARY_EQUIPMENT_POOL} from '../src/simulation/temporary-equipment';
import {TACTICIANS_CROWN_ID,crownTeamSizeBonus} from '../src/simulation/deployment-cap';
import {readG23Progress} from '../src/simulation/g2-3-state';
import {commitG23Settlement} from '../src/simulation/g2-3-settlement';
import {openG23Choice} from '../src/simulation/g2-3-runtime';
import {createInputValidation,validateInputAssets} from '../src/simulation/input-assets';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import type {G23BattleFacts} from '../src/simulation/g2-3-economy';
import {accepted,board} from './t10-helpers';
import {catalogPreparation} from './t5r-helpers';

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
