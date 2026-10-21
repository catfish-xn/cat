import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {expect,it} from 'vitest';
import {M5_UNIT_DEFINITIONS} from '../src/simulation/units';
import {SHOP_CATALOG} from '../src/simulation/match-rules';
import {TRAIT_DEFINITIONS} from '../src/simulation/content/traits';
import {g23FormStats} from '../src/simulation/g2-3-forms';
import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {createCombatWithEvents} from '../src/simulation/combat';
import {validateMechanisms} from '../src/simulation/m8/restore';
it('v19: 63 canonical identities, 30 enabled traits and four non-acquirable fixed ranged forms',()=>{
 expect(Object.keys(M5_UNIT_DEFINITIONS)).toHaveLength(63);expect(SHOP_CATALOG).toHaveLength(63);expect(Object.keys(TRAIT_DEFINITIONS)).toHaveLength(30);expect(TRAIT_DEFINITIONS['form-swapper']).toBeDefined();
 for(const id of ['elise','swain','gangplank','jayce']){expect(SHOP_CATALOG).toContain(id);expect(SHOP_CATALOG).not.toContain(id+'-ranged');}
});
it.each([['swain',950,45,650,40],['elise',1100,60,750,45],['gangplank',800,65,700,50],['jayce',1200,90,900,60]] as const)('%s form HP/AD come from the source table and retain canonical identity',(id,hp,ad,rangedHp,rangedAd)=>{
 const front=g23FormStats(id,1,'player',4),back=g23FormStats(id,1,'player',6);
 expect([front.health,front.attack,back.health,back.attack]).toEqual([hp,ad,rangedHp,rangedAd]);
 expect(back.abilityId).toBe(id+'-ranged-ability');expect(back.attackRange).toBe(4);
 expect(g23FormStats(id,1,'enemy',0)).toEqual(back);expect(g23FormStats(id,1,'enemy',3)).toEqual(front);
 const s=createMatch(42),preparation={...s.preparation,units:[{id:'hero',definitionId:id,team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:1,row:6}}}]};
 const state=createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation}),'form').state,u=state.units[0];
 expect(u.definitionId).toBe(id);expect(u.ability.id).toBe(id+'-ranged-ability');expect(u.maxHpBasis?.base).toBe(rangedHp);
 validateMechanisms(u,state.units,state.tick,'form',false,state.nextActionSeq!);
});
import {projectG23Summons} from '../src/simulation/g2-3-summons';
import {stepCombat} from '../src/simulation/combat';
import {g23Laboratories} from '../src/simulation/g2-3-experiment';
import {validateG23State} from '../src/simulation/g2-3-combat';
it('combat-only Sion and Forge project once, never enter the acquisition roster',()=>{
 const base=createMatch(3),names=['morgana','vladimir','cassiopeia','jayce'];
 const preparation={...base.preparation,units:names.map((definitionId,i)=>({id:'p'+i,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:i,row:4}}}))};
 const projected=projectG23Summons(preparation);expect(projected.units).toHaveLength(6);expect(projectG23Summons(projected)).toEqual(projected);expect(preparation.units).toHaveLength(4);
 const withEnemy={...preparation,units:[...preparation.units,{id:'e',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:2,row:3}}}]};
 let combat=createCombatWithEvents(withEnemy,buildStrategySnapshot({...base,preparation:withEnemy}),'summons').state;
 for(let tick=0;tick<25;tick++){
  combat=stepCombat(combat).state;
  for(const u of combat.units){validateMechanisms(u,combat.units,combat.tick,'summons',combat.status==='finished',combat.nextActionSeq!);validateG23State(u,combat.units,combat.tick,combat.nextActionSeq!);}
 }
 const forge=combat.units.find(u=>u.definitionId==='g23-forge')!;expect(forge.runtime?.attackCount).toBe(0);expect(forge.cell).toEqual(forge.startingCell);
});
it('Laboratories share Mundo 120 health and retain unique 60-health kill receipts',()=>{
 const base=createMatch(42),labs=g23Laboratories(42,'player',3);
 const preparation={...base.preparation,units:[{id:'m',definitionId:'drmundo',team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:labs[0]}},{id:'n',definitionId:'nunu',team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:labs[1]}},{id:'z',definitionId:'zyra',team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:6,row:7}}}]};
 const s=createCombatWithEvents(preparation,buildStrategySnapshot({...base,preparation}),'labs').state;
 for(const id of ['m','n']){const u=s.units.find(u=>u.id===id)!;expect(u.mechanics?.find(m=>m.mechanic==='g23Experiment')?.values.mundo).toBe(60);expect(u.maxHpBasis?.flat).toBeGreaterThanOrEqual(220);}
 expect(s.units.find(u=>u.id==='z')!.mechanics?.some(m=>m.mechanic==='g23Experiment')).toBe(false);
});
import {startMatchCombat,stepMatch} from '../src/simulation/match';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {publicPaidArmorySettlement} from './fixtures/g2-3-armory-public';
it('restores a real paid armory purchase after settlement without deducting its preparation cost twice',async()=>{
 const state=await publicPaidArmorySettlement(5); // v15 catalog: real Rumble acquisition still reaches the asserted 5-5 settlement.
 expect(readG23Progress(state)!.junkerPurchases).toHaveLength(1);
 expect(readG23Progress(state)!.junkerPurchases[0].cost).toBe(5);
 expect(state.roundDefinitionId).toBe('5-5');
 expect(state.gold).toBe(state.roundResults.at(-1)!.goldAfter);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 expect(restoreMatch(structuredClone(state))).toEqual(state);
 for(const offset of [-5,5])expect(()=>restoreMatch({...state,gold:state.gold+offset})).toThrow();
 expect(stepMatch(state).state).toEqual(state);
},30000);
it('canonical-text restore retains actual public opening and G23 settlement receipts byte-for-byte',()=>{
 const initial=createMatch(42),started=startMatchCombat(initial);expect(started.ok).toBe(true);if(!started.ok)throw Error(started.reason);
 let state=started.state;
 while(state.phase==='combat')state=stepMatch(state).state;
 expect(readG23Progress(state)?.economyReceipts.some(r=>r.kind==='battle'&&r.facts.battleId==='round-1')).toBe(true);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 expect(restoreMatch(serializeMatch(initial))).toEqual(initial);
});

it('rejects current saves that omit persistent G23 authority or forge settled combat facts',()=>{
 const fresh=createMatch(42),{seatMechanics,...missing}=fresh;
 expect(()=>restoreMatch(missing)).toThrow();expect(seatMechanics).toBeDefined();
 let state=startMatchCombat(fresh).state;while(state.phase==='combat')state=stepMatch(state).state;
 const bad=structuredClone(state);const r=readG23Progress(bad)!.economyReceipts[0];
 if(r.kind!=='battle')throw Error('battle receipt');
 const forged=writeG23Progress(bad,{...readG23Progress(bad)!,economyReceipts:[{...r,facts:{...r.facts,alliedDeaths:r.facts.alliedDeaths+1}}]});
 expect(()=>restoreMatch(forged)).toThrow();
});

import {eliminationResult} from '../src/simulation/combat';
import {countsG23SurvivorDamage} from '../src/simulation/g2-3-summons';
import {unit as combatUnit} from './combat-helpers';
it('forge and reserved barrel bodies cannot sustain either army; Sion remains a fighter',()=>{
 const enemy=combatUnit('enemy','enemy',0,0);
 for(const definitionId of ['g23-forge','g23-barrel']){
  const body=combatUnit('body','player',1,7,{definitionId});
  expect(eliminationResult([body,enemy])).toBe('enemyWin');
  expect(eliminationResult([{...body,team:'enemy'},{...enemy,team:'player'}])).toBe('playerWin');
  expect(eliminationResult([body])).toBe('draw');
  expect(countsG23SurvivorDamage(body)).toBe(false);
 }
 const sion=combatUnit('sion','player',2,4,{definitionId:'g23-sion'});
 expect(eliminationResult([sion,enemy])).toBeNull();
 expect(countsG23SurvivorDamage(sion)).toBe(false);
 expect(countsG23SurvivorDamage(enemy)).toBe(true);
 expect(countsG23SurvivorDamage({...enemy,alive:false})).toBe(false);
});
it('enemy forge placement mirrors the owner coordinates, including collisions and exhausted back rows',()=>{
 const base=createMatch(3);
 for(const row of [4,5,6,7]){
  const units=[{id:'jayce',definitionId:'jayce',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:2,row}}},
   {id:'blocker',definitionId:'lux',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:2,row:row===7?6:row+1}}}];
  const own=projectG23Summons({...base.preparation,units}).units.find(u=>u.definitionId==='g23-forge')!;
  const mirrored=projectG23Summons({...base.preparation,units:units.map(u=>({...u,team:'enemy' as const,location:{...u.location,cell:{col:u.location.cell.col,row:7-u.location.cell.row}}}))}).units.find(u=>u.definitionId==='g23-forge')!;
  expect(own.location.kind).toBe('board');expect(mirrored.location.kind).toBe('board');
  if(own.location.kind!=='board'||mirrored.location.kind!=='board')throw Error('forge board');
  expect(mirrored.location.cell).toEqual({col:own.location.cell.col,row:7-own.location.cell.row});
 }
});

import {enableMultiplayerSettlement,applyRoundSettlement,ROUND_SETTLEMENT_VERSION,type MultiplayerCommandResult} from '../src/simulation/round-settlement';
import {forfeitPendingChoice,claimOrDiscardLoot,nextRound} from '../src/simulation/match';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {compileBattle,resolveTwoSidedBattle,proposeSettlement} from '../src/simulation/two-sided-battle';
it('a public two-sided proposal carrying G23 facts commits once instead of failing the strict receipt whitelist',()=>{
 const accept=(r:MultiplayerCommandResult)=>{if(!r.ok)throw Error(r.reason);return r.state;};
 let state=accept(enableMultiplayerSettlement(createMatch(5),'A'));
 for(let budget=0;state.roundDefinitionId!=='2-1'||state.phase==='choice';budget++){
  if(budget>5000)throw Error('opening budget');
  if(state.phase==='choice')state=accept(forfeitPendingChoice(state,state.round,state.pendingChoice!.choiceId,state.pendingChoice!.generation));
  else if(state.phase==='preparation')state=accept(startMatchCombat(state));
  else if(state.phase==='combat')state=stepMatch(state).state;
  else state=accept(nextRound(accept(claimOrDiscardLoot(state,state.round)),state.round));
 }
 const result=resolveTwoSidedBattle(compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(state,'B'),7,{battleId:'g23-settlement'}),1201);
 const {events:_events,...proposal}=proposeSettlement(result).a;
 expect(proposal.g23Facts).toBeDefined();
 const receipt={...proposal,version:ROUND_SETTLEMENT_VERSION,round:state.round,settlementId:'g23-first-pvp',combatTicks:result.terminal.tick,combatEventCount:result.events.length};
 expect(applyRoundSettlement(state,{...receipt,unknownField:1})).toEqual({ok:false,state,reason:'invalid-receipt'});
 const committed=accept(applyRoundSettlement(state,receipt));
 expect(readG23Progress(committed)!.economyReceipts.at(-1)).toMatchObject({kind:'battle',facts:proposal.g23Facts});
 expect(applyRoundSettlement(committed,receipt)).toEqual({ok:false,state:committed,reason:'duplicate-settlement'});
 expect(committed.roundResults).toHaveLength(state.round);
});
it('two-sided surviving Sion and Forge bodies add no extra player damage',()=>{
 const base=createMatch(42);
 for(const names of [['jayce'],['morgana','vladimir','cassiopeia']]){
  const own={...base,round:4,roundDefinitionId:'2-1',level:3,items:[],preparation:{...base.preparation,units:names.map((definitionId,i)=>({id:'unit-'+(i+1),definitionId,team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:i,row:4}}}))}};
  const empty={...own,preparation:{...own.preparation,units:[]}};
  const resolved=resolveTwoSidedBattle(compileBattle(snapshotForBattle(own,'A'),snapshotForBattle(empty,'B'),42,{battleId:'summon-damage'}),1201);
  expect(resolved.terminal.units.filter(u=>u.team==='player'&&u.alive)).toHaveLength(names.length+1);
  expect(resolved.a.survivors).toHaveLength(names.length);
  expect(proposeSettlement(resolved).b.damage).toBe(2+names.length);
  expect(resolved.terminal.units.filter(u=>u.team==='player'&&countsG23SurvivorDamage(u))).toHaveLength(names.length);
 }
});
