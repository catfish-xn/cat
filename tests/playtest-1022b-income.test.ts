import { enableMultiplayerSettlement, applyRoundSettlement } from '../src/simulation/round-settlement';
import { describe, expect, it } from 'vitest';
import { createMatch, nextRound, startMatchCombat, stepMatch, selectChoice, deployMatchUnit,
  lockMatchCombatRoster, buyXp, sellUnit } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import type { MatchState } from '../src/simulation/match';
import { getUnitSellPrice } from '../src/simulation/unit-stats';
import { melCanSave } from '../src/simulation/mel-save';
import { createG23Progress } from '../src/simulation/g2-3-match-progress';
import { writeG23Progress } from '../src/simulation/g2-3-state';
const ok = (r: {ok:true;state:MatchState}|{ok:false;reason:string}): MatchState => { if (!r.ok) throw Error(r.reason); return r.state; };
function opening(resolveAugment=true) {
  let s=createMatch(5);
  while(s.roundDefinitionId!=='2-1') {
    if(s.phase==='settlement')s=ok(nextRound(s,s.round));
    else if(s.phase==='combat')s=stepMatch(s).state;
    else if(s.phase==='choice'){const c=s.pendingChoice!;s=ok(selectChoice(s,c.choiceId,c.generation,c.offers[0]));}
    else {for(const u of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'))s=ok(deployMatchUnit(s,u.id,{kind:'bench',slot:0}));s=ok(startMatchCombat(s));}
  }
  if(resolveAugment && s.pendingChoice){const c=s.pendingChoice;s=ok(selectChoice(s,c.choiceId,c.generation,c.offers[0]));}
  return s;
}
function settle(s:MatchState,result:'win'|'loss'='win') {
  return applyRoundSettlement(s,{version:ROUND_SETTLEMENT_VERSION,settlementId:`income:${s.round}`,battleId:`battle:${s.round}`,seatId:'A',round:s.round,roundId:s.roundDefinitionId,
    settlementEligible:true,result,damage:result==='win'?0:2,baseDamage:2,opposingSurvivors:0,growth:[],combatTicks:1,combatEventCount:1});
}
describe('10-22b income timing',()=>{
  it('opening settlement remains unpaid through restore; next entry pays once before augment choice',()=>{
    let s=createMatch(5);
    s=ok(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;
    expect(s.phase).toBe('settlement');expect(s.gold).toBe(0);
    expect(s.roundResults.at(-1)).toMatchObject({income:2,goldAfter:2});
    const restored=restoreMatch(serializeMatch(s));expect(restored).toEqual(s);
    const next=ok(nextRound(restored,1));expect(next.gold).toBe(2);
    expect(nextRound(next,1)).toMatchObject({ok:false});
    const atAugment=opening(false);expect(atAugment.phase).toBe('choice');expect(atAugment.gold).toBe(10);
    expect(restoreMatch(serializeMatch(atAugment))).toEqual(atAugment);
  });
  it.each([['win',19,20,2,9],['loss',19,19,1,7]] as const)('%s freezes final bank; preparation pays base/interest/streak and Investment once',(result,gold,basis,interest,income)=>{
    let s=ok(enableMultiplayerSettlement(opening(),'A'));
    s={...s,gold,streak:{kind:result,count:1},augments:[{definitionId:'investment-strategy-i',choiceId:'i',acquiredRound:s.round}],augmentProgress:{pumpingRounds:0,investmentHp:0}};
    const settled=ok(settle(s,result));
    expect(settled.gold).toBe(gold+(result==='win'?1:0));
    expect(settled.roundResults.at(-1)).toMatchObject({interestBasis:basis,income,incomeBreakdown:{base:5,win:result==='win'?1:0,interest,streak:1}});
    expect(settled.augmentProgress.investmentHp).toBe(0);
    expect(settle(settled,result)).toMatchObject({ok:false,reason:'duplicate-settlement'});
    expect(stepMatch(settled)).toEqual({state:settled,events:[]});
    const next=ok(nextRound(settled,settled.round));expect(next.gold).toBe(gold+income);
    expect(next.augmentProgress.investmentHp).toBe(interest*8);
    expect(nextRound(next,settled.round)).toMatchObject({ok:false});
  });
  it('combat XP spending and bench sale set the final interest bank; pre-settlement preview cannot pay income',()=>{
    let s=ok(enableMultiplayerSettlement(opening(),'A'));
    s={...s,gold:22,preparation:{...s.preparation,units:[{id:'bench',definitionId:'draven',team:'player',starLevel:1,location:{kind:'bench',slot:0}}]}};
    s=ok(lockMatchCombatRoster(s));s=ok(buyXp(s));s=ok(sellUnit(s,'bench'));expect(s.gold).toBe(19);
    const settled=ok(settle(s));expect(settled.gold).toBe(20);expect(settled.roundResults.at(-1)?.interestBasis).toBe(20);
    const next=ok(nextRound(settled,settled.round));expect(next.gold).toBe(27);
  });
  it('eliminated seat does not receive a future preparation payment',()=>{
    let s=ok(enableMultiplayerSettlement(opening(),'A'));s={...s,playerHp:1,gold:19};
    const settled=ok(settle(s,'loss'));expect(settled.gold).toBe(19);expect(settled.playerHp).toBe(0);
    expect(nextRound(settled,settled.round)).toMatchObject({ok:false});
  });
  it('Draven is a one-cost: star 1/2/3 sells for 1/3/9 (audit only)',()=>{
    expect([1,2,3].map(starLevel=>getUnitSellPrice({definitionId:'draven',starLevel:starLevel as 1|2|3}))).toEqual([1,3,9]);
  });
  it('Mel needs the twelfth PvP cast and cannot save twice or qualify from PvE',()=>{
    const base=opening(),p=createG23Progress(base.seed);
    const s=writeG23Progress(base,{...p,mel:{pvpCasts:11,savedBattleId:null}});
    const facts={battleId:'b',round:s.round,roundKind:'pvp' as const,result:'loss' as const,conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0 as const,highRollerGold:0};
    expect(melCanSave(s,facts,0)).toBe(false);expect(melCanSave(s,{...facts,melCasts:1},0)).toBe(true);
    expect(melCanSave(s,{...facts,roundKind:'pve',melCasts:12},0)).toBe(false);
    expect(melCanSave(writeG23Progress(base,{...p,mel:{pvpCasts:12,savedBattleId:'old'}}),facts,0)).toBe(false);
  });
});
