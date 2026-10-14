import { describe,it,expect } from 'vitest';
import { wearing,enemy,run,packets,heals } from './fixtures/m8-b4-items';
import { readCombatStats } from '../src/simulation/combat-s13';
describe('B4 cloak: independent numbers in actual combat',()=>{
 it('dragon:HP1090;missing590,1090×2.5%=27 withremainder at40',()=>{const r=run(wearing('dragons-claw',{hp:500,cooldownTicks:1000}),40);expect(r.p.maxHp).toBe(1090);expect(heals(r.events)[0].actual).toBe(27);expect(r.p.hp).toBe(527);});
 it('evenshroud:aura armor100→70;first AD100 gives58;25 bonusresists expire200',()=>{const r=run(wearing('evenshroud'),1,[enemy('e',1,3,{armor:100})]);expect(packets(r.events)[0].hpDamage).toBe(58);const expired=run(wearing('evenshroud',{cooldownTicks:1000}),200);expect(readCombatStats(expired.p,expired.state)).toMatchObject({armor:0,magicResist:20});});
 it('quicksilver:9×3%=27%,base30%=57%;ceil20/1.57=13;immunity expires360 after final growth',()=>{const r=run(wearing('quicksilver',{cooldownTicks:1000}),360);expect(r.p.runtime?.attackSpeedBps).toBe(2700);expect(readCombatStats(r.p,r.state).attackIntervalTicks).toBe(13);expect(r.p.mechanismState?.statuses.some(g=>g.kind==='control-immunity')).toBe(false);});
});
