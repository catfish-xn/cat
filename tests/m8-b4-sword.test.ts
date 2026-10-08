import { describe,it,expect } from 'vitest';
import { wearing,enemy,run,packets,heals } from './fixtures/m8-b4-items';
import { readCombatStats } from '../src/simulation/combat-s13';
describe('B4 sword recipes: independent hand arithmetic and actual combat',()=>{
 it('deathblade:100×1.55=155;155×1.08→167 on a real attack',()=>{const r=run(wearing('deathblade'));expect(r.p.attackDamage).toBe(155);expect(packets(r.events)[0].hpDamage).toBe(167);});
 it('giant slayer:125×1.05→131 at1750;125×1.25→156 at1751',()=>{for(const [hp,n] of [[1750,131],[1751,156]])expect(packets(run(wearing('giant-slayer'),1,[enemy('e',1,3,{hp,maxHp:hp})]).events)[0].hpDamage).toBe(n);});
 it('gunblade:120 attack→18 self +30 ally healing',()=>{const r=run(wearing('gunblade',{hp:500}),1,[enemy(),{...enemy('a',2,4),team:'player',hp:500,maxHp:1000}]);expect(heals(r.events).map(e=>[e.unitId,e.actual])).toEqual([['a',30],['p',18]]);});
 it('shojin:ordinary10+extra5=15 mana on one completed attack',()=>{const r=run(wearing('shojin'));expect(r.p.mana).toBe(30);expect(r.events.filter(e=>e.type==='attack')).toHaveLength(1);});
 it('edge:HP500/1000≤60%;after hit gains prevention and untargetable for20ticks, then15% AS',()=>{const r=run(wearing('edge-of-night',{hp:500,cooldownTicks:1000}),21,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100})]);expect(r.events.filter(e=>e.type==='statusChanged'&&e.reason==='applied'&&e.status.source.definitionId==='edge-of-night')).toHaveLength(3);expect(readCombatStats(r.p,r.state).attackIntervalTicks).toBe(18);});
 it('bloodthirster:115×20%→23 vamp;HP390 receives25%×1000=250 shield after surviving damage',()=>{const v=run(wearing('bloodthirster',{hp:500}));expect(heals(v.events)[0].actual).toBe(23);const r=run(wearing('bloodthirster',{hp:390,cooldownTicks:1000}),1,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100})]);expect(r.p.shield).toBe(250);});
 it('sterak: (1000+150)×1.25→1437, add287 HP; AD100×(1+.15+.35)=150',()=>{const r=run(wearing('steraks-gage',{hp:600,cooldownTicks:1000}));expect(r.p.maxHp).toBe(1437);expect(r.p.hp).toBe(887);expect(readCombatStats(r.p,r.state).attackDamage).toBe(150);});
 it('infinity:100×1.35=135;25%+35%=60%, seed42 crit135×1.4=189',()=>{const r=run(wearing('infinity-edge'));expect(r.p.spellCrit?.enabled).toBe(true);expect(r.p.spellCrit?.chanceBps).toBe(6000);expect(packets(r.events)[0].hpDamage).toBe(189);});
});
