import { expect, it } from 'vitest';
import { advanceMultiplayerRound, buyXp, selectChoice, type MatchState } from '../src/simulation/match';
import { batch5XpPurchases } from '../src/simulation/augment-pool-batch5-progress';
import { validateBatch5Gold } from '../src/simulation/restore-checks/batch5-progress-check';
import { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { firstNodeSeed } from './augment-stage-helpers';
import { grantMechanicGold } from '../src/simulation/seat-mechanics/grants';
import { XP_TO_NEXT_LEVEL } from '../src/simulation/match-rules';
import { grantXp } from '../src/simulation/progression';
import { reachRound, resolveM5Choices } from './match-helpers';

function accepted(result:{readonly ok:true;readonly state:MatchState}|{readonly ok:false;readonly reason:string}):MatchState {
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.reason);return result.state;
}

function selected() {
 const open=reachRound('2-1',false,firstNodeSeed('dual-purpose')),c=open.pendingChoice!;
 expect(c.offers).toContain('dual-purpose');
 return accepted(enableMultiplayerSettlement(resolveM5Choices(accepted(selectChoice(open,c.choiceId,c.generation,'dual-purpose'))),'dual-seat'));
}
function settle(s:MatchState) {
 return applyRoundSettlement(s,{version:ROUND_SETTLEMENT_VERSION,settlementId:`dual:${s.round}`,battleId:`dual-battle:${s.round}`,
  seatId:'dual-seat',round:s.round,roundId:s.roundDefinitionId,settlementEligible:true,result:'win',damage:0,baseDamage:2,
  opposingSurvivors:0,growth:[],combatTicks:10,combatEventCount:2});
}
function validate(s:MatchState){expect(()=>validateBatch5Gold(s)).not.toThrow();}
function reject(s:MatchState,mutate:(x:any)=>void){const copy=structuredClone(s);mutate(copy);expect(()=>validateBatch5Gold(copy)).toThrow();}

it('real 2-1 pick: settlement XP buys nothing; first settlement buy costs 12→10, repeated buy costs four',()=>{
 let s=selected();expect(batch5XpPurchases(s,s.round)).toBe(0);validate(s);
 s=accepted(settle(s));expect(s.gold).toBe(12);expect(s.roundResults.at(-1)!.xpAwarded).toBe(2);
 expect(batch5XpPurchases(s,s.round)).toBe(0);validate(s);
 const settled=s;s=accepted(buyXp(s));expect(s.gold).toBe(10);expect(s.shop.generation).toBe(settled.shop.generation+1);
 expect(batch5XpPurchases(s,s.round)).toBe(1);validate(s);
 const first=s;s=accepted(buyXp(s));expect(s.gold).toBe(6);expect(s.shop.generation).toBe(first.shop.generation+1);
 expect(batch5XpPurchases(s,s.round)).toBe(2);validate(s);
 expect(s.roundResults).toBe(settled.roundResults);
 const repeated=settle(s);expect(repeated.ok).toBe(false);expect(repeated.state).toBe(s);
 const poor={...s,gold:0},failed=buyXp(poor);expect(failed).toEqual({ok:false,state:poor,reason:'insufficient-gold'});
 expect(failed.state).toBe(poor);expect(failed.state.resourceProvenance).toBe(s.resourceProvenance);
});

it.each([false,true])('settlement purchases stay in their round and next round refunds once (preparation purchase=%s)',preparation=>{
 let s=selected();if(preparation)s=accepted(buyXp(s));
 s=accepted(settle(s));const before=s;s=accepted(buyXp(s));expect(s.gold).toBe(before.gold-(preparation?4:2));validate(s);
 const round=s.round,count=preparation?2:1;
 s=accepted(advanceMultiplayerRound(s,s.round));expect(batch5XpPurchases(s,round)).toBe(count);expect(batch5XpPurchases(s,s.round)).toBe(0);validate(s);
 const next=s;s=accepted(buyXp(s));expect(s.gold).toBe(next.gold-2);expect(batch5XpPurchases(s,round)).toBe(count);validate(s);
 const second=s;s=accepted(buyXp(s));expect(s.gold).toBe(second.gold-4);validate(s);
});

it('rejects omitted/duplicate/edited/moved purchase facts, forged XP, reward XP counted as purchase and refund tampering',()=>{
 let s=accepted(buyXp(accepted(settle(selected()))));s=accepted(buyXp(s));validate(s);
 const fact=(x:any)=>x.resourceProvenance.entries.find((e:any)=>e.kind==='dual-purpose-xp-purchased');
 const receipt=(x:any)=>x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5');
 reject(s,x=>{x.resourceProvenance.entries=x.resourceProvenance.entries.filter((e:any)=>e!==fact(x));});
 reject(s,x=>{const e=structuredClone(fact(x));e.sequence=x.resourceProvenance.entries.length;x.resourceProvenance.entries.push(e);});
 reject(s,x=>{fact(x).xpBefore++;});reject(s,x=>{fact(x).settled=false;});
 reject(s,x=>{fact(x).generation=x.shop.generation+1;});reject(s,x=>{fact(x).roundId='2-2';});
 reject(s,x=>{x.xp++;});reject(s,x=>{x.roundResults.at(-1).xpAwarded+=4;});
 reject(s,x=>{receipt(x).amount++;});reject(s,x=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r!==receipt(x));});
 reject(s,x=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='dual-purpose-selected').xp++;});
 s=accepted(advanceMultiplayerRound(s,s.round));validate(s);
 reject(s,x=>{fact(x).settled=false;});reject(s,x=>{x.resourceProvenance.entries=x.resourceProvenance.entries.filter((e:any)=>e!==fact(x));});
 const free=accepted(settle(selected()));
 reject(free,x=>{const r=x.roundResults.at(-1),forged=grantXp(r.levelBefore,r.xpBefore,r.xpRequested+4);
  r.xpRequested=forged.xpRequested;r.xpAwarded=forged.xpApplied;r.levelAfter=x.level=forged.level;r.xpAfter=x.xp=forged.xp;});
});

it('a legal buy while choosing does not trigger the unowned augment; the first owned buy still refunds once',()=>{
 let s=accepted(enableMultiplayerSettlement(reachRound('2-1',false,firstNodeSeed('dual-purpose')),'dual-seat'));
 s=accepted(buyXp(s));expect(batch5XpPurchases(s,s.round)).toBe(0);
 const choice=s.pendingChoice!;s=accepted(selectChoice(s,choice.choiceId,choice.generation,'dual-purpose'));
 validate(s);expect(batch5XpPurchases(s,s.round)).toBe(0);
 const before=s;s=accepted(buyXp(s));expect(s.gold).toBe(before.gold-2);expect(batch5XpPurchases(s,s.round)).toBe(1);validate(s);
});

it('the last capped purchase is one authenticated purchase and a max-level refusal adds no fact or refund',()=>{
 let s=accepted(grantMechanicGold(selected(),{receiptId:'dual-cap-vector',source:'test',amount:1000}));
 const total=(s:MatchState)=>s.xp+Object.entries(XP_TO_NEXT_LEVEL).filter(([l])=>Number(l)<s.level).reduce((n,[,xp])=>n+xp,0);
 let count=0,lastGain=0;
 while(s.level<10&&count<200){const before=s;s=accepted(buyXp(s));lastGain=total(s)-total(before);count++;}
 expect(s.level).toBe(10);expect(s.xp).toBe(0);expect(lastGain).toBe(2);
 expect(batch5XpPurchases(s,s.round)).toBe(count);validate(s);
 expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5')).toHaveLength(1);
 const failed=buyXp(s);expect(failed).toEqual({ok:false,state:s,reason:'max-level'});expect(failed.state).toBe(s);
});
