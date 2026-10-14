import {expect,it} from 'vitest';
import {planRoundEconomy} from '../src/simulation/economy';
import {selectPlayerBaseDamage} from '../src/simulation/match-rules';
it('ordinary stages and first/later overtime use the same base selector and count each enemy once',()=>{
 for(const [stage,base] of [[2,2],[3,5],[4,8],[5,10],[6,12]])for(const survivors of [1,3,9]) {
  const plan=planRoundEconomy({stage,roundKind:'pvp',result:'enemyWin',gold:0,streak:{kind:null,count:0},level:9,xp:0,hp:100,enemySurvivors:survivors});
  expect(plan.baseDamage).toBe(base);expect(plan.playerDamage).toBe(base+survivors);
 }
 for(const roundId of ['overtime-1','overtime-5'])for(const result of ['enemyWin','draw','playerWin'] as const)for(const survivors of [0,1,3,9]) {
  const plan=planRoundEconomy({stage:6,roundId,roundKind:'pvp',result,gold:0,streak:{kind:null,count:0},level:9,xp:0,hp:1,enemySurvivors:survivors});
  expect(plan.baseDamage).toBe(17);expect(plan.playerDamage).toBe(result==='playerWin'?0:17+survivors);expect(plan.hpAfter).toBe(result==='playerWin'?1:0);
 }
 expect(()=>selectPlayerBaseDamage(6,'pve','overtime-1')).toThrow();
});
