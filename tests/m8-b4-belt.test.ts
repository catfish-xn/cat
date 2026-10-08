import { describe,it,expect } from 'vitest';
import { wearing,enemy,run,packets } from './fixtures/m8-b4-items';
describe('B4 belt: independent numbers in actual combat',()=>{
 it('warmog:(1000+600)×1.12=1792;real100 hit leaves1692',()=>{const r=run(wearing('warmog',{cooldownTicks:1000}),1,[enemy('e',1,3,{cooldownTicks:0,attackDamage:100})]);expect(r.p.maxHp).toBe(1792);expect(r.p.hp).toBe(1692);});
 it('guardbreaker:crit140×1.10=154 hits50 shield;later140×1.25=175 while bonus active',()=>{const e=enemy('e',1,3,{shield:50,shieldExpiresAtTick:100,shieldLayers:[{key:'shield',source:{ownerId:'e',sourceKind:'ability',definitionId:'shield',instanceId:'e',effectIndex:0},granted:50,remaining:50,absorbed:0,expiresAtTick:100}]});const r=run(wearing('guardbreaker'),18,[e]);expect(packets(r.events).map(e=>[e.absorbed,e.hpDamage])).toEqual([[50,104],[0,175]]);});
});
