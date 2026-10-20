import {snapshotForBattle,restorePlayerBattleSnapshot,compileBattle,startTwoSidedCombat,enableMultiplayerSettlement,lockMatchCombatRoster} from '../src/server-entry';
import {expect,it} from 'vitest';
import {createMatch,equipItem,startMatchCombat,stepMatch,readItemSummons,moveItemSummon} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {voidspawnStage} from '../src/simulation/g2-4b-voidspawn';
import {ROUND_CATALOG} from '../src/simulation/content/round-catalog';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import type {MatchState} from '../src/simulation/match-types';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

function equipped(base=createMatch(42)){
 const grant=grantMechanicItem(base,{receiptId:'portal',source:'test',definitionId:'TFT5_Item_ZzRotPortalRadiant'});if(!grant.ok)throw Error(grant.reason);
 const owner=grant.state.preparation.units.find(u=>u.team==='player')!;
 const result=equipItem(grant.state,grant.state.items.at(-1)!.id,owner.id,0);if(!result.ok)throw Error(result.reason);
 return result.state;
}

it('projects a movable preparation summon without inventory/population mint, freezes its position and rejects forged positions',()=>{
 const state=equipped(),summon=readItemSummons(state)[0];
 expect(summon.kind).toBe('voidspawn');expect(state.preparation.units.some(u=>u.id===summon.unit.id)).toBe(false);
 const moved=moveItemSummon(state,summon.itemInstanceId,{col:0,row:7});if(!moved.ok)throw Error(moved.reason);
 expect(readItemSummons(moved.state)[0].unit.location).toEqual({kind:'board',cell:{col:0,row:7}});
 expect(moved.state.items).toEqual(state.items);expect(moved.state.preparation).toEqual(state.preparation);
 expect(restoreMatch(serializeMatch(moved.state))).toEqual(moved.state);
 expect(moveItemSummon(state,summon.itemInstanceId,{col:0,row:0})).toEqual({ok:false,state,reason:'outside-deployment-zone'});
 const started=startMatchCombat(moved.state);if(!started.ok)throw Error(started.reason);
 let current=started.state;
 expect(current.combat!.units.find(u=>u.itemSummon?.kind==='voidspawn')!.cell).toEqual({col:0,row:7});
 for(let n=0;n<75&&current.phase==='combat';n++){
  if(n%15===0)expect(restoreMatch(serializeMatch(current))).toEqual(current);
  current=stepMatch(current).state;
 }
 const forged=structuredClone(current);Object.assign(forged.combatInputBasis!.inputs,{itemSummonPositions:{[summon.itemInstanceId]:{col:1,row:7}}});
 expect(()=>restoreMatch(forged)).toThrow('combat input basis');
 const invalid=structuredClone(moved.state);Object.assign(invalid.seatMechanics!.seat,{g24ItemPositions:{'item-999':{col:0,row:7}}});
 expect(()=>restoreMatch(invalid)).toThrow('summon');
 while(current.phase==='combat')current=stepMatch(current).state;
 expect(restoreMatch(serializeMatch(current))).toEqual(current);
});

it.each([
 ['1-2',1000,80,1],['2-1',1000,80,1],['3-1',1500,80,1],['4-1',2000,120,2],['5-1',2500,180,3],['6-1',3000,180,3],
] as const)('uses historical total HP/AD at %s without multiplying the star totals twice',(roundId,hp,ad,stars)=>{
 const base=createMatch(42),round=getCatalogRoundById(roundId);
 const state=equipped({...base,round:round.ordinal,roundDefinitionId:roundId,m8:{...base.m8,round}} as MatchState);
 const strategy=buildStrategySnapshot(state),summon=strategy.units.find(u=>u.itemSummon?.kind==='voidspawn')!;
 expect(summon.itemSummon!.unit.starLevel).toBe(stars);expect(summon.stats.health).toBe(hp);
 expect(summon.stats.attack).toBe(ad);expect(summon.stats.baseAttackSpeedBps).toBe(7500);
 expect(summon.stats.maxMana).toBe(0);expect(summon.mechanics?.some(m=>m.mechanic==='taunt')).toBeFalsy();
});

it('receives active team trait auras and augments without contributing a trait count',()=>{
 const base=createMatch(42),army:MatchState={...base,preparation:{...base.preparation,units:[
  {id:'s',definitionId:'singed',starLevel:1,team:'player',location:{kind:'board',cell:{col:2,row:4}}},
  {id:'i',definitionId:'irelia',starLevel:1,team:'player',location:{kind:'board',cell:{col:4,row:4}}},
  ...base.preparation.units.filter(u=>u.team==='enemy')]},
  augments:[{definitionId:'pumping-up-i',choiceId:'test-pump',acquiredRound:1}]};
 const plain=buildStrategySnapshot(army),withPortal=buildStrategySnapshot(equipped(army));
 const summon=withPortal.units.find(u=>u.itemSummon?.kind==='voidspawn')!;
 expect(summon.stats.attackSpeedBonusBps).toBe(600);
 expect(summon.stats.armor).toBeGreaterThan(30);
 expect(summon.sources.some(s=>s.source.sourceKind==='trait'&&s.source.sourceDefinitionId==='sentinel')).toBe(true);
 expect(withPortal.traits.map(t=>[t.team,t.traitId,t.count,t.tier])).toEqual(plain.traits.map(t=>[t.team,t.traitId,t.count,t.tier]));
});

it('freezes both seats placement and mirrors only the opposing coordinates',()=>{
 const base=createMatch(42),round=getCatalogRoundById('2-1');
 const state=equipped({...base,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round}});
 const origin=readItemSummons(state)[0],moved=moveItemSummon(state,origin.itemInstanceId,{col:0,row:7});if(!moved.ok)throw Error(moved.reason);
 const enabled=enableMultiplayerSettlement(moved.state,'A');if(!enabled.ok)throw Error(enabled.reason);
 const locked=lockMatchCombatRoster(enabled.state);if(!locked.ok)throw Error(locked.reason);
 expect(moveItemSummon(locked.state,origin.itemInstanceId,{col:1,row:7})).toEqual({ok:false,state:locked.state,reason:'wrong-phase'});
 expect(()=>snapshotForBattle(locked.state,'A')).toThrow('wrong-phase');
 const a=snapshotForBattle(enabled.state,'A'),b=snapshotForBattle(moved.state,'B');
 expect(restorePlayerBattleSnapshot(JSON.parse(JSON.stringify(a)))).toEqual(a);
 const combat=startTwoSidedCombat(compileBattle(a,b,42));
 expect(combat.units.find(u=>u.team==='player'&&u.itemSummon?.kind==='voidspawn')!.cell).toEqual({col:0,row:7});
 expect(combat.units.find(u=>u.team==='enemy'&&u.itemSummon?.kind==='voidspawn')!.cell).toEqual({col:0,row:0});
 const forged=structuredClone(a);Object.assign(forged,{itemSummonPositions:{'item-999':{col:0,row:7}}});
 expect(()=>restorePlayerBattleSnapshot(forged)).toThrow();
});

it('uses the final stage row on multiplayer overtime ordinals instead of throwing',()=>{
 const last=ROUND_CATALOG.at(-1)!,state=equipped();
 expect(voidspawnStage(ROUND_CATALOG[0].ordinal)).toEqual(voidspawnStage(getCatalogRoundById('2-1').ordinal));
 expect(voidspawnStage(last.ordinal+1)).toEqual({health:3000,attack:180,stars:3});
 // Overtime is PvP-only: no catalog PvE enemies stand on the preparation board.
 const pvp={...state,round:last.ordinal+1,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team==='player')}};
 const summon=buildStrategySnapshot(pvp).units.find(u=>u.itemSummon?.kind==='voidspawn')!;
 expect(summon.itemSummon!.unit.starLevel).toBe(3);expect(summon.stats.health).toBe(3000);expect(summon.stats.attack).toBe(180);
});
