import { describe,it,expect } from 'vitest';
import { wearing,enemy,run,packets } from './fixtures/m8-b4-items';
import { readCombatStats } from '../src/simulation/combat-s13';
describe('B4 vest: independent numbers in actual combat',()=>{
 it('bramble:HP1070;armor65 mitigates100→60 then8%→55;retort100,only one within40ticks',()=>{const r=run(wearing('bramble-vest',{cooldownTicks:1000}),39,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100,attackIntervalTicks:5})]);expect(r.p.maxHp).toBe(1070);expect(packets(r.events,'e')[0].hpDamage).toBe(55);expect(packets(r.events).map(e=>e.raw)).toEqual([100]);});
 it('gargoyle:one targeting enemy gives25+10=35 resists;100/1.35→74 damage',()=>{const r=run(wearing('gargoyle',{cooldownTicks:1000}),1,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100})]);expect(packets(r.events,'e')[0].hpDamage).toBe(74);expect(readCombatStats(r.p,r.state)).toMatchObject({armor:35,magicResist:35});});
 it('sunfire:HP(1000+150)×1.08=1242;first application40 and first burn60=100',()=>{const r=run(wearing('sunfire-cape',{cooldownTicks:1000}),60);expect(r.p.maxHp).toBe(1242);expect(packets(r.events).map(e=>[e.tick,e.hpDamage])).toEqual([[60,100]]);});
 it('steadfast:HP1200;armor20 gives83 then15%→70 above50%;8%→76 at50%',()=>{for(const [hp,n] of [[601,70],[600,76]]){const r=run(wearing('steadfast-heart',{hp,cooldownTicks:1000}),1,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100})]);expect(packets(r.events,'e')[0].hpDamage).toBe(n);}});
});
