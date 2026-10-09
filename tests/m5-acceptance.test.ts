import {describe,expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {planRoundEconomy} from '../src/simulation/economy';
import {getUnitSellPrice} from '../src/simulation/unit-stats';
import {generateShop} from '../src/simulation/shop';
import {shop,SELL} from './fixtures/m5/oracle.cjs';

describe('M5 independent frozen numerical acceptance answers',()=>{
 it.each([
  {gold:49,result:'playerWin' as const,kind:null,count:0,expectedGold:60,breakdown:{base:5,win:1,interest:5,streak:0}},
  {gold:49,result:'enemyWin' as const,kind:null,count:0,expectedGold:58,breakdown:{base:5,win:0,interest:4,streak:0}},
  {gold:9,result:'playerWin' as const,kind:'win' as const,count:1,expectedGold:17,breakdown:{base:5,win:1,interest:1,streak:1}},
  {gold:50,result:'enemyWin' as const,kind:'loss' as const,count:5,expectedGold:63,breakdown:{base:5,win:0,interest:5,streak:3}},
 ])('hand ledger $gold $result count=$count',c=>{
  const value=planRoundEconomy({stage:2,roundKind:'pvp',result:c.result,gold:c.gold,streak:{kind:c.kind,count:c.count},level:3,xp:0,hp:100,enemySurvivors:0});
  expect(value.goldAfter).toBe(c.expectedGold);expect(value.incomeBreakdown).toEqual(c.breakdown);
 });
 it('three-win streak survives PvE but awards no streak or victory gold',()=>{
  const value=planRoundEconomy({stage:2,roundKind:'pve',result:'playerWin',gold:50,streak:{kind:'win',count:3},level:3,xp:0,hp:100,enemySurvivors:0});
  expect(value.goldAfter).toBe(60);expect(value.streakAfter).toEqual({kind:'win',count:3});expect(value.incomeBreakdown).toEqual({base:5,win:0,interest:5,streak:0});
 });
 it('all levels and boundary seeds agree with separately implemented BigInt shop arithmetic',()=>{
  for(const seed of [0,1,42,0xffffffff])for(let level=1;level<=9;level++)expect(generateShop(seed,7,level)).toEqual(shop(seed,7,level));
  expect(createMatch(42).shop).toEqual(shop(42,1,1).shop);
 });
 it('two-star three-cost sale is 8G and loses exactly 1G from the nine-G input',()=>{
  expect(getUnitSellPrice({id:'sale-case',definitionId:'kogmaw',starLevel:2,team:'player',location:{kind:'bench',slot:0}})).toBe(8);expect(3*3-SELL[3][1]).toBe(1);
 });
});
