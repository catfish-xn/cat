import {readG23Progress} from '../src/simulation/g2-3-state';
import {expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {deriveTraits} from '../src/simulation/trait-snapshot';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {scrapConversions} from '../src/simulation/strategy-g2-2';
import {ITEM_DEFINITIONS} from '../src/simulation/content/items';
import {G22_UNITS} from '../src/simulation/content/g2-2-units';
import {M5_UNIT_DEFINITIONS} from '../src/simulation/units';
import {readFileSync} from 'node:fs';
function input(names:string[]){const s=createMatch(42);return {...s,preparation:{...s.preparation,units:names.map((definitionId,i)=>({id:definitionId,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};}
it('admits precisely fifteen complete source records without form substitutes',()=>{
 const source=JSON.parse(readFileSync(new URL('../src/simulation/content/source/s13-14.24b/normalized/g2-2-champions.json',import.meta.url),'utf8'));
 expect(Object.keys(G22_UNITS)).toHaveLength(15);expect(Object.keys(M5_UNIT_DEFINITIONS)).toHaveLength(63);
 for(const row of source.champions.filter((r:any)=>r.new)){
  expect(Object.values(row.record.stats)).not.toContain(null);
  expect(G22_UNITS[row.id].baseStats).toEqual({health:row.record.stats.hp,attack:row.record.stats.damage,armor:row.record.stats.armor,magicResist:row.record.stats.magicResist});
 }
 for(const id of ['swain','jayce','gangplank'])expect(M5_UNIT_DEFINITIONS[id]).toBeDefined();
});
it.each([[['nami'],1],[['nami','tristana'],0],[['nami','tristana','garen'],0],[['nami','tristana','garen','ambessa'],4]] as const)('Emissary exact distinct membership %s', (names,tier)=>expect(deriveTraits(input([...names]).preparation,'player').find(t=>t.traitId==='emissary')?.tier).toBe(tier));
it('Conqueror grants source base AD/AP without chest growth',()=>{
 const compiled=buildStrategySnapshot(input(['darius','draven']));
 for(const u of compiled.units){expect(u.abilityPower).toBe(118);expect(u.stats.attack).toBe(Math.floor(M5_UNIT_DEFINITIONS[u.unitId].baseStats.attack*1.18));}
});
it('Academy sponsorship has no bonus without an eligible held item and no inventory grants',()=>{
 const s=input(['lux','leona','ezreal']),before=JSON.stringify(s);
 const plain=buildStrategySnapshot(s);
 const equipped={...s,items:[{id:'sponsored',definitionId:readG23Progress(s)!.sponsored[0],location:{kind:'unit' as const,unitId:'lux',slot:0 as const}}]};
 const rich=buildStrategySnapshot(equipped);
 expect(rich.units.find(u=>u.unitId==='lux')!.mechanics?.find(m=>m.mechanic==='damageAmp')?.values.bps).toBe(900);
 expect(plain.units.find(u=>u.unitId==='lux')!.mechanics?.some(m=>m.mechanic==='damageAmp')).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(equipped.items).toHaveLength(1);
});
it('Scrap conversion is detached and deterministic, with two original components in completed items',()=>{
 const s=input(['powder','trundle']);const traits=deriveTraits(s.preparation,'player');
 const equipment=[{id:'a',unitId:'powder',definitionId:'rod'}];
 const conversions=scrapConversions(s.preparation.units,traits,equipment,ITEM_DEFINITIONS);
 expect(conversions.get('a')).toBe('archangel');expect(equipment[0].definitionId).toBe('rod');
});

import {createCombatWithEvents,stepCombat,type CombatState} from '../src/simulation/combat';
import {validateMechanisms} from '../src/simulation/m8/restore';
it('Rebel trigger changes real HP/stats once and its declared effects survive restore validation',()=>{
 const s=input(['irelia','akali','sett','ezreal','zoe']);
 const preparation={...s.preparation,units:[...s.preparation.units,{id:'enemy',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:3}}}]};
 const started=createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation}),'g22-rebel');
 let state:CombatState={...started.state,units:started.state.units.map(u=>({...u,hp:Math.floor(u.maxHp/2)}))};
 state=stepCombat(state).state;
 const irelia=state.units.find(u=>u.id==='irelia')!;
 expect(irelia.g22?.rebelTriggered).toBe(true);expect(irelia.maxHpBasis?.bonusBps).toBe(1200);
 expect(irelia.maxHp).toBe(Math.floor(M5_UNIT_DEFINITIONS.irelia.baseStats.health*1.24));
 for(const u of state.units)validateMechanisms(u,state.units,state.tick,'g22-rebel',false,state.nextActionSeq!);
 const next=stepCombat(state).state;expect(next.units.find(u=>u.id==='irelia')!.maxHp).toBe(irelia.maxHp);
});
it('Enforcer starts with source shield, then grants one 30% speed bonus per wanted death',()=>{
 const s=input(['maddie','steb']);
 const preparation={...s.preparation,units:[...s.preparation.units,{id:'enemy',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:3}}},{id:'other',definitionId:'lux',starLevel:1 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:6,row:0}}}]};
 const started=createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation}),'g22-wanted').state;
 const maddie=started.units.find(u=>u.id==='maddie')!;expect(maddie.shield).toBe(Math.floor(maddie.maxHp*.12));expect(maddie.g22?.wanted).toEqual(['enemy']);
 const killed={...started,units:started.units.map(u=>u.id==='enemy'?{...u,hp:0,alive:false}:u)};
 const next=stepCombat(killed).state;expect(next.units.find(u=>u.id==='maddie')!.g22?.wantedDeaths).toBe(1);
 for(const u of next.units.filter(u=>u.alive))validateMechanisms(u,next.units,next.tick,'g22-wanted',false,next.nextActionSeq!);
});
