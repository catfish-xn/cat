import {expect,it} from 'vitest';
import {M5_UNIT_DEFINITIONS} from '../src/simulation/units';
import {SHOP_CATALOG} from '../src/simulation/match-rules';
import {TRAIT_DEFINITIONS} from '../src/simulation/content/traits';
import {g23FormStats} from '../src/simulation/g2-3-forms';
import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {createCombatWithEvents} from '../src/simulation/combat';
import {validateMechanisms} from '../src/simulation/m8/restore';
it('sixty canonical identities, twenty-five enabled traits and four non-acquirable fixed ranged forms',()=>{
 expect(Object.keys(M5_UNIT_DEFINITIONS)).toHaveLength(60);expect(SHOP_CATALOG).toHaveLength(60);expect(Object.keys(TRAIT_DEFINITIONS)).toHaveLength(25);expect(TRAIT_DEFINITIONS['form-swapper']).toBeUndefined();
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
it('canonical-text restore retains actual public opening and G23 settlement receipts byte-for-byte',()=>{
 const initial=createMatch(42),started=startMatchCombat(initial);expect(started.ok).toBe(true);if(!started.ok)throw Error(started.reason);
 let state=started.state;
 while(state.phase==='combat')state=stepMatch(state).state;
 expect(state.g23?.economyReceipts.some(r=>r.kind==='battle'&&r.facts.battleId==='round-1')).toBe(true);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 expect(restoreMatch(serializeMatch(initial))).toEqual(initial);
});

it('rejects current saves that omit persistent G23 authority or forge settled combat facts',()=>{
 const fresh=createMatch(42),{g23,...missing}=fresh;
 expect(()=>restoreMatch(missing)).toThrow();expect(g23).toBeDefined();
 let state=startMatchCombat(fresh).state;while(state.phase==='combat')state=stepMatch(state).state;
 const bad=structuredClone(state);const r=bad.g23!.economyReceipts[0];
 if(r.kind!=='battle')throw Error('battle receipt');
 const forged={...bad,g23:{...bad.g23!,economyReceipts:[{...r,facts:{...r.facts,alliedDeaths:r.facts.alliedDeaths+1}}]}};
 expect(()=>restoreMatch(forged)).toThrow();
});
