import { describe,it,expect } from 'vitest';
import { wearing,enemy,run,packets } from './fixtures/m8-b4-items';
import { readCombatStats } from '../src/simulation/combat-s13';
import { resolveAbility } from '../src/simulation/combat-abilities';
describe('B4 rod recipes: hand arithmetic and combat',()=>{
 it('deathcap:AP150 makes260×1.5=390 skill;390×1.15→448 damage',()=>{const r=run(wearing('deathcap',{mana:1000}));expect(r.p.abilityPower).toBe(150);expect(packets(r.events)[0].hpDamage).toBe(448);});
 it('archangel:AP120+30 at100=150, first pulse never at0',()=>{const p=wearing('archangel',{cooldownTicks:1000});const early=run(p,99);expect(readCombatStats(early.p,early.state).abilityPower).toBe(120);const r=run(p,100);expect(readCombatStats(r.p,r.state).abilityPower).toBe(150);expect(r.events.filter(e=>e.type==='statChanged'&&e.source.definitionId==='archangel')).toHaveLength(1);});
 it('crownguard:1100×25%=275 shield;expiration160 grants25AP once,120+25=145',()=>{const r=run(wearing('crownguard',{cooldownTicks:1000}),161);expect(r.events.find(e=>e.type==='shieldLayerChanged'&&e.reason==='granted')).toMatchObject({layer:{granted:275}});expect(readCombatStats(r.p,r.state).abilityPower).toBe(145);expect(r.p.shield).toBe(0);});
 it('ionic:enemy spends80,80×1.6=128;MR100×.7=70→75 damage',()=>{const r=run(wearing('ionic-spark',{cooldownTicks:1000}),1,[enemy('e',1,3,{ability:resolveAbility('zyra-ability',1),mana:80,maxMana:80,magicResist:100})]);expect(packets(r.events).filter(e=>e.source.sourceKind==='item').map(e=>[e.raw,e.hpDamage])).toEqual([[128,75]]);});
 it('morello:100 attack attaches1% burn,10000×.01=100 at21;33% wound retained',()=>{const r=run(wearing('morellonomicon'),21);expect(packets(r.events).filter(e=>e.damageType==='true')[0].hpDamage).toBe(100);expect(r.state.units.find(u=>u.id==='e')?.mechanismState?.statuses.find(s=>s.kind==='wound')?.effectiveMagnitudeBps).toBe(3300);});
 it('jeweled:AP135→351 skill;60% crit at seed42 gives491,one skill RNG word',()=>{const r=run(wearing('jeweled-gauntlet',{mana:1000}));expect(r.p.spellCrit?.enabled).toBe(true);expect(packets(r.events)[0].hpDamage).toBe(491);expect(r.state.rngDraws).toBe(1);});
});
