import {expect,it} from 'vitest';
import {autoDeployToCap,deployMatchUnit,equipItem,getDeploymentCap,matchStartFailure,sellUnit,startMatchCombat,type MatchState} from '../src/simulation/match';
import {getPlayerDeploymentCount} from '../src/simulation/game';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {REFORGE_POOLS} from '../src/simulation/content/consumables';
import {TEMPORARY_EQUIPMENT_POOL} from '../src/simulation/temporary-equipment';
import {TACTICIANS_CROWN_ID,crownTeamSizeBonus} from '../src/simulation/deployment-cap';
import {createInputValidation,validateInputAssets} from '../src/simulation/input-assets';
import {restorePlayerBattleSnapshot,snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {catalogPreparation} from './t5r-helpers';
import {accepted,bench,board,hero,prepared} from './t10-helpers';

const crown=(id:string,location:MatchState['items'][number]['location']={kind:'inventory'})=>({id,definitionId:TACTICIANS_CROWN_ID,location});
const withCrown=(location:MatchState['items'][number]['location']):MatchState=>{
 const base=prepared();
 return {...base,nextItemSerial:4,items:[...base.items,crown('item-3',location)],
  preparation:{...base.preparation,units:[...base.preparation.units,hero('unit-4',bench(3)),hero('unit-5',bench(4))]}};
};
const own=(state:MatchState)=>state.preparation.units.filter(u=>u.team==='player');

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

it('each crown on a player unit, board or bench, adds one team slot; inventory crowns do not',()=>{
 expect(getDeploymentCap(withCrown({kind:'inventory'}))).toBe(3);
 expect(getDeploymentCap(withCrown({kind:'unit',unitId:'unit-2',slot:0}))).toBe(4);
 expect(getDeploymentCap(withCrown({kind:'unit',unitId:'unit-1',slot:0}))).toBe(4);
 const two=withCrown({kind:'unit',unitId:'unit-2',slot:0});
 const stacked={...two,nextItemSerial:5,items:[...two.items,crown('item-4',{kind:'unit',unitId:'unit-2',slot:1})]};
 expect(getDeploymentCap(stacked)).toBe(5);
 expect(crownTeamSizeBonus([hero('enemy-x',board(0))].map(u=>({...u,team:'enemy' as const})),[crown('item-9',{kind:'unit',unitId:'enemy-x',slot:0})])).toBe(0);
});

it('a bench crown lets the player deploy and start with level + 1 units, and the frozen input validates',()=>{
 const inventory=withCrown({kind:'inventory'});
 let state=accepted(equipItem(inventory,'item-3','unit-2',0));
 expect(getDeploymentCap(state)).toBe(4);
 for(const [id,col] of [['unit-3',2],['unit-4',3],['unit-5',4]] as const)state=accepted(deployMatchUnit(state,id,board(col)));
 expect(getPlayerDeploymentCount(state.preparation)).toBe(3+1);
 expect(own(state).find(u=>u.id==='unit-2')!.location).toEqual(bench(0));
 // Without the crown the fourth unit is refused at the old cap.
 expect(deployMatchUnit(inventory,'unit-3',board(2)).ok).toBe(true);
 const atLevel=[['unit-3',2],['unit-4',3]].reduce((s,[id,col])=>accepted(deployMatchUnit(s,id as string,board(col as number))),inventory);
 expect(deployMatchUnit(atLevel,'unit-5',board(4))).toMatchObject({ok:false,reason:'population-cap'});
 const combat=accepted(startMatchCombat(state));
 const input=combat.combatInputBasis!.inputs;
 expect(input.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')).toHaveLength(4);
 const validation=createInputValidation(ok=>{if(!ok)throw new Error('population cap');}),enemies=input.preparation.units.filter(u=>u.team==='enemy');
 const boundary={playerLevel:3,nextUnitSerial:state.nextUnitSerial,nextItemSerial:state.nextItemSerial};
 expect(()=>validateInputAssets(input,boundary,enemies,validation)).not.toThrow();
 const stripped={...input,items:input.items.filter(i=>i.definitionId!==TACTICIANS_CROWN_ID)};
 expect(()=>validateInputAssets(stripped,boundary,enemies,validation)).toThrow();
});

it('losing the crown holder leaves the board over cap: offline start refuses, the online deadline benches the newest unit',()=>{
 let state=withCrown({kind:'unit',unitId:'unit-2',slot:0});
 for(const [id,col] of [['unit-3',2],['unit-4',3],['unit-5',4]] as const)state=accepted(deployMatchUnit(state,id,board(col)));
 const sold=accepted(sellUnit(state,'unit-2'));
 expect(sold.items.find(i=>i.id==='item-3')!.location).toEqual({kind:'inventory'});
 expect(getDeploymentCap(sold)).toBe(3);expect(getPlayerDeploymentCount(sold.preparation)).toBe(4);
 expect(matchStartFailure(sold)).toBe('population-cap');
 const result=autoDeployToCap(sold),deployed=accepted(result);
 expect(own(deployed).find(u=>u.id==='unit-5')!.location).toEqual(bench(0));
 expect(getPlayerDeploymentCount(deployed.preparation)).toBe(3);
 expect(result.ok&&result.events.map(e=>e.type==='unitDeployed'?[e.unitId,e.to]:null)).toEqual([['unit-5',bench(0)]]);
 expect(autoDeployToCap(deployed)).toEqual({ok:true,state:deployed,events:[]});
 expect(accepted(startMatchCombat(deployed)).combatInputBasis).toBeTruthy();
});

it('a PvP snapshot carries the bench crown team size so the frozen board-only input still validates',()=>{
 const catalog=catalogPreparation('2-1');
 const pvp=(state:MatchState):MatchState=>({...state,round:catalog.round,roundDefinitionId:catalog.roundDefinitionId,m8:catalog.m8});
 let state=withCrown({kind:'unit',unitId:'unit-2',slot:0});
 for(const [id,col] of [['unit-3',2],['unit-4',3],['unit-5',4]] as const)state=accepted(deployMatchUnit(state,id,board(col)));
 const snapshot=snapshotForBattle(pvp(state),'A');
 expect(snapshot.units).toHaveLength(4);expect(snapshot.items.map(i=>i.definitionId)).not.toContain(TACTICIANS_CROWN_ID);
 expect(snapshot.benchTeamSizeBonus).toBe(1);
 const {benchTeamSizeBonus:_b,...without}=snapshot;
 expect(()=>restorePlayerBattleSnapshot(without)).toThrow();
 expect(()=>restorePlayerBattleSnapshot({...snapshot,benchTeamSizeBonus:0})).toThrow();
 // A board holder's crown travels in items; no bench field, identical shape to a crownless snapshot.
 const boardHolder=withCrown({kind:'unit',unitId:'unit-1',slot:0});
 let onBoard=boardHolder;
 for(const [id,col] of [['unit-3',2],['unit-4',3],['unit-5',4]] as const)onBoard=accepted(deployMatchUnit(onBoard,id,board(col)));
 const boardSnapshot=snapshotForBattle(pvp(onBoard),'A');
 expect(boardSnapshot).not.toHaveProperty('benchTeamSizeBonus');expect(boardSnapshot.items.map(i=>i.definitionId)).toContain(TACTICIANS_CROWN_ID);
 expect(snapshotForBattle(pvp(prepared()),'A')).not.toHaveProperty('benchTeamSizeBonus');
});
