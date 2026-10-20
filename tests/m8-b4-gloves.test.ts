import { describe,it,expect } from 'vitest';
import { wearing,run,packets } from './fixtures/m8-b4-items';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
describe('B4 gloves: independent numbers in actual combat',()=>{
 it('thief base:HP1150;25%+20%=45% crit100×1.4=140;B4 creates no temporary children',()=>{const r=run(wearing('thiefs-gloves'));expect(r.p.maxHp).toBe(1150);expect(r.p.spellCrit?.chanceBps).toBe(4500);expect(packets(r.events)[0].hpDamage).toBe(140);expect(r.p.spellCrit?.enabled).toBe(false);expect(r.p.mechanismDefinitions?.eventTriggers ?? []).toHaveLength(0);});
});
