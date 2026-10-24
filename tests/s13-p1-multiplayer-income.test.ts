import {expect,it} from 'vitest';
import {accepted,reachRound} from './match-helpers';
import {buyUnit,deployMatchUnit,selectChoice,nextRound} from '../src/simulation/match';
import {enableMultiplayerSettlement,applyRoundSettlement,ROUND_SETTLEMENT_VERSION} from '../src/simulation/round-settlement';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {compileBattle,resolveTwoSidedBattle,proposeSettlement} from '../src/simulation/two-sided-battle';
import {deriveTraits} from '../src/simulation/trait-snapshot';
import {grantXp} from '../src/simulation/progression';
const onlineAccepted=(r:ReturnType<typeof applyRoundSettlement>)=>{if(!r.ok)throw Error(r.reason);return r.state;};
it.each(['going-long','investment-strategy-ii'])('%s public board crosses Conqueror breakpoint and both real online receipts settle',id=>{
 let s=reachRound('2-1',false,0),found=false;
 for(let seed=0;seed<3000;seed++){ // bounded; the 14.24 stage tags moved the first matching seed
  s=reachRound('2-1',false,seed);
  const available=new Set([...s.shop.slots.filter(x=>x.status==='available').map(x=>x.definitionId),...s.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId)]);
  if(s.pendingChoice!.offers.includes(id)&&available.has('darius')&&available.has('draven')){found=true;break;}
 }
 expect(found).toBe(true);const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,id));
 for(const definitionId of ['darius','draven']){
  if(!s.preparation.units.some(u=>u.team==='player'&&u.definitionId===definitionId))s=accepted(buyUnit(s,s.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId===definitionId),s.shop.generation));
  const unit=s.preparation.units.find(u=>u.team==='player'&&u.definitionId===definitionId)!;
  s=accepted(deployMatchUnit(s,unit.id,{kind:'board',cell:{col:definitionId==='darius'?1:3,row:4}}));
 }
 expect(deriveTraits(s.preparation,'player').find(t=>t.traitId==='conqueror')?.tier).toBe(2);
 s=onlineAccepted(enableMultiplayerSettlement(s,'A'));
 for(const tier of [2,0]){
  const gold=s.gold,beforeLevel=s.level,beforeXp=s.xp;
  const battle=resolveTwoSidedBattle(compileBattle(snapshotForBattle(s,'A'),snapshotForBattle(s,'B'),7,{battleId:`p1-${id}-${tier}`}),1201);
  const {events:_,...p}=proposeSettlement(battle).a;expect(p.g23Facts?.conquerorTier).toBe(tier);
  const receipt={...p,version:ROUND_SETTLEMENT_VERSION,round:s.round,settlementId:`p1:${id}:${tier}`,combatTicks:battle.terminal.tick,combatEventCount:battle.events.length};
  s=onlineAccepted(applyRoundSettlement(s,receipt));const r=s.roundResults.at(-1)!;
  expect(r.incomeBreakdown.interest).toBe(id==='going-long'?0:Math.min(7,Math.floor((gold+(p.result==='win'?1:0))/10)));
  expect(r.xpRequested).toBe(2);
  const natural=grantXp(beforeLevel,beforeXp,2);expect([s.level,s.xp]).toEqual([natural.level,natural.xp]);
  expect(applyRoundSettlement(s,receipt).ok).toBe(false);
  if(tier===2){const prior=s;s=accepted(nextRound(s,s.round));const xp=grantXp(prior.level,prior.xp,id==='going-long'?4:0);expect([s.level,s.xp]).toEqual([xp.level,xp.xp]);
   const u=s.preparation.units.find(u=>u.team==='player'&&u.definitionId==='draven')!,used=new Set(s.preparation.units.flatMap(x=>x.location.kind==='bench'?[x.location.slot]:[]));
   s=accepted(deployMatchUnit(s,u.id,{kind:'bench',slot:[0,1,2,3,4,5,6,7,8].find(x=>!used.has(x))!}));
   expect(deriveTraits(s.preparation,'player').find(t=>t.traitId==='conqueror')?.tier??0).toBe(0);
  }
 }
},20_000);
