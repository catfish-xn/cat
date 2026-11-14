import { describe, expect, it } from 'vitest';
import { planPlayerDamage, planRoundEconomy } from '../src/simulation/economy';
import { planOpeningEconomy } from '../src/simulation/opening-economy';
import { countsG23SurvivorDamage } from '../src/simulation/g2-3-summons';
import { selectPlayerBaseDamage } from '../src/simulation/match-rules';

// Handwritten answers from the user's 2026-10-29 decision; no production-table oracle.
describe('approved PvE loss damage', () => {
  it.each([[1,0],[2,2],[3,5],[4,8],[5,10],[6,12],[7,17]])(
    'stage %i uses base %i plus each survivor, with a minimum of one', (stage, base) => {
      for (const enemySurvivors of [0,1,2,3,8]) for (const result of ['playerWin','enemyWin','draw'] as const) {
        const playerDamage = result === 'playerWin' ? 0 : Math.max(1, base + enemySurvivors);
        expect(planPlayerDamage({stage,roundKind:'pve',result,enemySurvivors})).toEqual({baseDamage:base,playerDamage});
        if (stage === 1 || stage === 7) continue; // Separate opening / overtime contexts, not ordinary economy.
        for (const hp of [1,100]) {
          const plan = planRoundEconomy({stage,roundKind:'pve',result,enemySurvivors,hp,
            gold:0,streak:{kind:null,count:0},level:3,xp:0});
          expect([plan.baseDamage,plan.playerDamage,plan.hpLost,plan.hpAfter])
            .toEqual([base,playerDamage,Math.min(hp,playerDamage),Math.max(0,hp-playerDamage)]);
        }
      }
    });

  it('2-7 krugs with one, two or three survivors deal exactly 3, 4 or 5', () => {
    expect([1,2,3].map(enemySurvivors => planRoundEconomy({stage:2,roundId:'2-7',roundKind:'pve',
      result:'enemyWin',enemySurvivors,hp:100,gold:0,streak:{kind:null,count:0},level:3,xp:0}).playerDamage)).toEqual([3,4,5]);
  });

  it.each(['1-2','1-3','1-4'])('%s shares the stage-one formula on win, loss and draw', roundId => {
    for (const enemySurvivors of [0,1,2,3,4]) for (const result of ['playerWin','enemyWin','draw'] as const) {
      const plan = planOpeningEconomy({roundId,result,enemySurvivors,gold:0,level:1,xp:0,streak:{kind:null,count:0}});
      if (plan.kind !== 'opening') throw Error('opening expected');
      expect([plan.baseDamage,plan.playerDamage]).toEqual([0,result==='playerWin'?0:Math.max(1,enemySurvivors)]);
    }
  });

  it('uses the PvP survivor eligibility, ignores stars, and excludes dead, summoned and noncombat units', () => {
    for (const starLevel of [1,2,3]) {
      const units = [
        {definitionId:'pve-krug',alive:true,starLevel},
        {definitionId:'pve-krug',alive:false,starLevel},
        {definitionId:'pve-krug',alive:true,starLevel,itemSummon:{}},
        {definitionId:'pve-krug',alive:true,starLevel,anomalySummon:{}},
        ...['g23-sion','g23-forge','g23-barrel','v20-silco-minion','b5-voidling','trainer-golem','carry-golem'].map(definitionId=>({definitionId,alive:true,starLevel})),
      ];
      expect(units.filter(countsG23SurvivorDamage).map(u=>u.definitionId)).toEqual(['pve-krug']);
    }
  });

  it('keeps supply damage zero and rejects invalid stages and PvE overtime identities', () => {
    expect(planRoundEconomy({stage:2,roundKind:'supply',result:null,enemySurvivors:0,hp:1,gold:0,
      streak:{kind:null,count:0},level:3,xp:0}).playerDamage).toBe(0);
    for (const stage of [0,8,-1,1.5,NaN,Infinity]) expect(()=>selectPlayerBaseDamage(stage,'pve')).toThrow(RangeError);
    expect(()=>selectPlayerBaseDamage(6,'pve','overtime-1')).toThrow(RangeError);
  });
});
