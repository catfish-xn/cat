import { expect, it, vi } from 'vitest';
import { planRoundEconomy } from '../src/simulation/economy';
import { planOpeningEconomy } from '../src/simulation/opening-economy';
import { getRoundPreparationMs } from '../src/simulation/round-schedule';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { OPENING_ENCOUNTERS } from '../src/simulation/content/opening-encounters';
import { createMatch, nextRound, startMatchCombat, stepMatch, setShopLock } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { previewRoundEconomy } from '../src/simulation/economy-preview';
import { BattleHistory, PlaybackSession, validateBattleRecord } from '../src/replay';
import { accepted, emptyBoard } from './match-helpers';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import * as rng from '../src/simulation/rng';

// Independent answers from approved-1023-batch2 §§10–13,15, with #406 next-entry payment.
it.each([['win','playerWin'],['loss','enemyWin'],['loss','draw']] as const)(
  '%s / %s: PvP and PvE share exact streak boundaries, without granting PvE victory gold', (kind,result) => {
    for (const roundKind of ['pvp','pve'] as const) for (const [count,streakGold] of [[0,0],[1,1],[2,1],[3,1],[4,2],[5,3],[6,3],[20,3]]) {
      const plan=planRoundEconomy({stage:2,roundKind,result,gold:19,level:3,xp:0,hp:100,enemySurvivors:0,
        streak:{kind:count===0?null:kind,count}});
      const win=roundKind==='pvp'&&kind==='win'?1:0;
      expect(plan.streakAfter).toEqual({kind,count:count+1});
      expect(plan.incomeBreakdown).toEqual({base:5,win,interest:win?2:1,streak:streakGold});
      expect(plan.goldAfter).toBe(19+5+win+(win?2:1)+streakGold);
    }
  });

it('opening base entitlements are 2/3/4, with streaks and unchanged XP and survivor-based HP; planners consume zero RNG words', () => {
  const random=vi.spyOn(rng,'nextRandom');
  try {
    for (const [roundId,base] of [['1-2',2],['1-3',3],['1-4',4]] as const) {
      for (const result of ['playerWin','enemyWin','draw'] as const) {
        const plan=planOpeningEconomy({roundId,result,enemySurvivors:2,gold:50,level:3,xp:0,streak:{kind:'loss',count:4}});
        expect(plan.kind).toBe('opening');if(plan.kind!=='opening') throw Error('opening');
        const streak=result==='playerWin'?0:2;
        expect(plan.incomeBreakdown).toEqual({base,win:0,interest:0,streak});
        expect(plan.goldAfter).toBe(50+base+streak);
        expect(plan.streakAfter).toEqual(result==='playerWin'?{kind:'win',count:1}:{kind:'loss',count:5});
        expect(plan.naturalXp).toBe(2);expect(plan.playerDamage).toBe(result==='playerWin'?0:2);
      }
    }
    expect(random).not.toHaveBeenCalled();
  } finally { random.mockRestore(); }
});

it('three real opening losses defer 2/4/5 income, restore strictly, replay identically and pay once before 2-1 choice', () => {
  let state=createMatch(42);
  state=accepted(setShopLock(state,true,state.shop.generation));
  const shopRng=state.rngState;
  for (const [index,[base,streak,payable,bank]] of [[2,0,2,0],[3,1,4,2],[4,1,5,6]].entries()) {
    expect(state.gold).toBe(bank);
    const before=emptyBoard(state),preview=previewRoundEconomy(before)!;
    expect(preview.ifLoss).toMatchObject({base,streakGold:streak,streakAfter:{kind:'loss',count:index+1}});
    const history=new BattleHistory('economy-1023');
    const start=startMatchCombat(before);if(!start.ok) throw Error(start.reason);state=start.state;
    history.observe({before,after:state,events:start.events.filter((e):e is LedgerCombatEvent=>e.domain==='combat'),reason:'command'});
    state=restoreMatch(serializeMatch(state));
    while (state.phase==='combat') {
      const prior=state,step=stepMatch(state);state=step.state;
      history.observe({before:prior,after:state,events:step.events.filter((e):e is LedgerCombatEvent=>e.domain==='combat'),reason:'tick'});
    }
    expect(state.gold).toBe(bank);
    expect(state.roundResults.at(-1)).toMatchObject({income:payable,goldAfter:bank+payable,incomeBreakdown:{base,win:0,interest:0,streak}});
    const record=history.completedRecords[0];
    expect(validateBattleRecord(record).terminal).toEqual(state.combat);
    const playback=new PlaybackSession(record);
    expect(playback.seek(record.endTick).combat).toEqual(state.combat);playback.dispose();
    expect(stepMatch(state)).toEqual({state,events:[]});
    state=restoreMatch(serializeMatch(state));
    const settledRound=state.round;
    state=accepted(nextRound(state,settledRound));
    expect(state.gold).toBe(bank+payable);
    expect(state.rngState).toBe(shopRng);
    const duplicate=nextRound(state,settledRound);expect(duplicate).toMatchObject({ok:false});expect(duplicate.state).toBe(state);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  }
  expect(state).toMatchObject({roundDefinitionId:'2-1',phase:'choice',gold:11,streak:{kind:'loss',count:3},level:3,xp:2,playerHp:91});
});

it('all catalog rounds and overtime follow the approved preparation table; bad identities still reject', () => {
  for (const round of ROUND_CATALOG) {
    const expected=round.roundId==='1-2'?6000:round.roundId==='1-3'?15000:round.roundId==='4-6'?75000:round.kind==='pve'?20000:30000;
    expect(getRoundPreparationMs(round.roundId),round.roundId).toBe(expected);
  }
  expect(getRoundPreparationMs('overtime-1')).toBe(30000);expect(getRoundPreparationMs('overtime-99')).toBe(30000);
  for(const id of ['1-1','1-5','overtime-0']) expect(()=>getRoundPreparationMs(id)).toThrow(RangeError);
});

it('PvE can break a PvP streak, supply preserves it without payment, and overtime keeps the new thresholds and 17 base damage', () => {
  const input={stage:6,gold:19,level:3,xp:0,hp:100,enemySurvivors:2,streak:{kind:'win',count:4}} as const;
  const pve=planRoundEconomy({...input,roundKind:'pve',result:'draw'});
  expect(pve.streakAfter).toEqual({kind:'loss',count:1});expect(pve.incomeBreakdown.streak).toBe(0);expect(pve.playerDamage).toBe(14);
  const supply=planRoundEconomy({...input,roundKind:'supply',result:null,enemySurvivors:0});
  expect(supply.streakAfter).toEqual(input.streak);expect(supply.incomeBreakdown.streak).toBe(0);
  const overtime=planRoundEconomy({...input,roundId:'overtime-1',roundKind:'pvp',result:'playerWin'});
  expect(overtime.streakAfter).toEqual({kind:'win',count:5});
  expect(overtime.incomeBreakdown).toEqual({base:5,win:1,interest:2,streak:2});
  expect(overtime.goldAfter).toBe(29);expect(overtime.baseDamage).toBe(17);expect(overtime.playerDamage).toBe(0);
});

it('three encounter descriptions state player effects without internal research notes', () => {
  expect(OPENING_ENCOUNTERS.find(e=>e.id==='prismatic-prelude')!.descriptionZh).toBe('第一次强化选择为棱彩阶。');
  expect(OPENING_ENCOUNTERS.find(e=>e.id==='prismatic-finale')!.descriptionZh).toBe('最后一次强化选择为棱彩阶。');
  expect(OPENING_ENCOUNTERS.find(e=>e.id==='wind-up-monkey')!.descriptionZh)
    .toBe('在 3-5 随机触发一种效果：失去 10 生命值、获得 25 金币、1 个杰作升级或 4 件基础装备；四种结果机会相同。');
});
