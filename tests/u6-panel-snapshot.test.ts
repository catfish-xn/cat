import {expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
const {lootPanelSnapshot,hasCombatReveal}=createRequire(import.meta.url)('../scripts/u6-panel-snapshot.cjs');
it('captures loot domain state and DOM synchronously in one browser task',()=>{
 const current={m8:{loot:{direct:[{status:'revealed'}]}}};
 const read=vi.fn(()=>({state:current}));
 const button={disabled:true,dataset:{blockedReason:'combat-running'}};
 vi.stubGlobal('window',{__CAT_DEBUG__:{read}});
 vi.stubGlobal('document',{querySelector:(selector:string)=>selector.includes('mobile:continue')?button:null});
 const snapshot=lootPanelSnapshot();
 expect(read).toHaveBeenCalledTimes(1);expect(snapshot).toEqual({current,dom:{kind:null,continueDisabled:true,continueReason:'combat-running'}});
 // The old two-await path could resume after settlement before its second read.
 expect(snapshot).not.toBeInstanceOf(Promise);
});

it('counts a reveal only while the same atomic snapshot is still in combat',()=>{
 const loot={direct:[{status:'revealed'}]};
 expect(hasCombatReveal({phase:'combat',m8:{loot}})).toBe(true);
 expect(hasCombatReveal({phase:'settlement',m8:{loot}})).toBe(false);
 expect(hasCombatReveal({phase:'combat',m8:{loot:{direct:[{status:'granted'}]}}})).toBe(false);
});
