import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as api from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match';
import { accepted, resolveM5Choices } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { toCombatViewState } from '../src/simulation/combat-replay-view';
import { reconcileD14 } from '../src/simulation/d14-runtime';
import { compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import { enableMultiplayerSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { d14UnitBase } from '../src/simulation/d14-anomalies/projection';
import { getUnitStats } from '../src/simulation/unit-stats';

let prefix:MatchState|undefined;
const stop=Error('public 4-5 prefix');
try{await createRequire(import.meta.url)('../scripts/generate-m5-route.cjs').run(api,{build:'sniper',seed:42,copyLimits:{irelia:9,maddie:9,darius:9},onStep(_before:MatchState,result:{state:MatchState}){
  if(result.state.roundDefinitionId==='4-5'&&result.state.phase==='preparation'){prefix=result.state;throw stop;}
}});}catch(e){if(e!==stop)throw e;}
if(!prefix)throw Error('Missing paid army');
let unknownPrefix=prefix;
const unknownTarget=unknownPrefix.preparation.units.find(u=>u.team==='player'&&u.definitionId==='irelia')!;
for(const u of unknownPrefix.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'))unknownPrefix=accepted(api.sellUnit(unknownPrefix,u.id));
// Pay for the remaining two Irelias; never inject units, stars, currency, offers or receipts.
for(const u of prefix.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&u.definitionId!=='irelia'))prefix=accepted(api.sellUnit(prefix,u.id));
for(let n=0;n<50&&!prefix.preparation.units.some(u=>u.team==='player'&&u.definitionId==='irelia'&&u.starLevel===3);n++){
  for(let i=0;i<5;i++)if(((o)=>o.status==='available'&&o.definitionId==='irelia')(prefix.shop.slots[i]))prefix=accepted(api.buyUnit(prefix,i,prefix.shop.generation));
  if(prefix.preparation.units.some(u=>u.team==='player'&&u.definitionId==='irelia'&&u.starLevel===3))break;
  prefix=accepted(api.rerollShop(prefix));
}
const target=prefix.preparation.units.find(u=>u.team==='player'&&u.definitionId==='irelia'&&u.starLevel===3)!;
if(!target)throw Error('Paid three-star target missing');
function finish(s:MatchState){s=accepted(api.startMatchCombat(s));while(s.phase==='combat')s=api.stepMatch(s).state;return resolveM5Choices(s);}
prefix=finish(prefix);prefix=accepted(api.nextRound(prefix,prefix.round));
unknownPrefix=finish(unknownPrefix);unknownPrefix=accepted(api.nextRound(unknownPrefix,unknownPrefix.round));
function choose(id:string){const chosenTarget=id==='ultimate-hero'?target:unknownTarget;let s=id==='ultimate-hero'?prefix!:unknownPrefix,c=s.pendingChoice!;s=accepted(api.selectAnomalyTarget(s,c.choiceId,c.generation,chosenTarget.id));
  for(let n=0;n<56&&!s.pendingChoice!.offers.includes(id);n++){c=s.pendingChoice!;s=accepted(api.rerollAnomaly(s,c.choiceId,c.generation));}
  c=s.pendingChoice!;expect(c.offers).toEqual([id]);return accepted(api.selectChoice(s,c.choiceId,c.generation,id));}
function restored(s:MatchState){const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);}

const cases=['ultimate-hero','into-the-unknown'].map(id=>{
  let s=choose(id);const checkpoints=[{label:'acquisition',state:s}];
  for(let count=1;count<=3;count++){
    s=accepted(api.startMatchCombat(s));checkpoints.push({label:`combat-${count}`,state:s});
    while(s.phase==='combat')s=api.stepMatch(s).state;
    checkpoints.push({label:`settled-${count}`,state:s});
    s=resolveM5Choices(s);s=accepted(api.nextRound(s,s.round));
  }
  return {id,checkpoints,ready:s};
});
// Continue the earned solo resources through the opt-in multiplayer API. The
// third barrier is a resolved PvP battle, with no fabricated settlement facts.
const onlineCases=cases.map(c=>{
  const before=resolveM5Choices(c.checkpoints.find(p=>p.label==='settled-2')!.state);
  const enabled=enableMultiplayerSettlement(before,'a');
  if(!enabled.ok)throw Error(enabled.reason);
  let s=enabled.state;
  s=accepted(api.nextRound(s,s.round));
  const input=compileBattle(snapshotForBattle(s,'a'),snapshotForBattle(s,'b'),123,{battleId:`d14-online-${c.id}`});
  s=accepted(api.lockMatchCombatRoster(s));
  const battle=resolveTwoSidedBattle(input,5000);
  const p=proposeSettlement(battle).a;
  const receipt={version:ROUND_SETTLEMENT_VERSION,settlementId:`${battle.battleId}:a`,battleId:p.battleId,seatId:p.seatId,round:s.round,roundId:p.roundId,
    settlementEligible:p.settlementEligible,result:p.result,damage:p.damage,baseDamage:p.baseDamage,opposingSurvivors:p.opposingSurvivors,growth:p.growth,g23Facts:p.g23Facts,
    combatTicks:battle.terminal.tick,combatEventCount:battle.events.length};
  const settled=applyRoundSettlement(s,receipt);
  if(!settled.ok)throw Error(`${c.id}: ${settled.reason} at ${s.roundDefinitionId}/${s.phase}; combat=${s.combat!==null}, choice=${s.pendingChoice?.kind??'none'}, players=${s.preparation.units.filter(u=>u.team==='player').length}`);
  const next=accepted(api.nextRound(resolveM5Choices(settled.state),settled.state.round));
  return {id:c.id,before:s,receipt,settled,next};
});
it.each(cases.flatMap(c=>c.checkpoints.map(p=>({id:c.id,...p}))))('$id preserves the D14 display fields at $label',({state:s})=>{
  const d=s.d14!,unit=s.preparation.units.find(u=>u.id===d.unitId);
  const legacy={anomalyId:d.anomalyId,choiceId:d.choiceId,unitId:d.unitId,phase:d.phase,dueOrdinal:d.atOrdinal+3,
    remainingSettlements:Math.max(0,d.atOrdinal+3-s.roundResults.length),effectiveStarLevel:d.phase==='promoted'?4:(unit?.starLevel??d.originalUnit.starLevel),
    physicalStarLevel:unit?.starLevel??d.originalUnit.starLevel,...(d.anomalyId==='ultimate-hero'?{sellGold:9,poolCopies:9}:{}),
    ...(d.held?{heldUnit:structuredClone(d.held.unit),heldItems:structuredClone(d.held.items)}:{})};
  const display=toPrivateSeatView(s).d14Display;
  expect(display).toEqual(legacy);
  if(!d.held)expect(JSON.stringify(display)).toBe(JSON.stringify(legacy));
});

it('whitelists held unit/item fields and locations without leaking future nested authority fields',()=>{
  const s=cases.find(c=>c.id==='into-the-unknown')!.checkpoints[0].state;
  const expected=toPrivateSeatView(s).d14Display!,injected=structuredClone(s),held=injected.d14!.held!;
  for(const value of [held.unit,held.unit.location,...held.items.flatMap(item=>[item,item.location])])
    Object.assign(value,{privateSentinel:'DO_NOT_SEND'});
  if(held.unit.location.kind==='board')Object.assign(held.unit.location.cell,{privateSentinel:'DO_NOT_SEND'});
  const before=JSON.stringify(injected),display=toPrivateSeatView(injected).d14Display!;
  expect(display).toEqual(expected);
  expect(JSON.stringify(display)).not.toContain('DO_NOT_SEND');
  expect(JSON.stringify(injected)).toBe(before);
  expect(display.heldUnit).not.toBe(held.unit);
  expect(display.heldUnit!.location).not.toBe(held.unit.location);
  if(display.heldUnit!.location.kind==='board'&&held.unit.location.kind==='board')
    expect(display.heldUnit!.location.cell).not.toBe(held.unit.location.cell);
  display.heldItems!.forEach((item,index)=>{
    expect(item).not.toBe(held.items[index]);expect(item.location).not.toBe(held.items[index].location);
  });
});

it('keeps the held Unit field set for a form swapper without adding a live preparation form',()=>{
  const s=structuredClone(cases.find(c=>c.id==='into-the-unknown')!.checkpoints[0].state);
  Object.assign(s.d14!.held!.unit,{definitionId:'jayce'});
  const display=toPrivateSeatView(s).d14Display!;
  expect(display.heldUnit).toEqual(s.d14!.held!.unit);
  expect(display.heldUnit).not.toHaveProperty('form');
});

it.each(onlineCases)('$id crosses the third real PvP settlement once and preserves the restored public snapshot',({id,before,receipt,settled,next})=>{
  expect(before.d14!.phase).toBe(id==='ultimate-hero'?'waiting':'absent');
  expect(settled.state.d14!.phase).toBe(id==='ultimate-hero'?'promoted':'returned');
  expect(settled.state.multiplayer!.combatRosterLocked).toBeUndefined();
  expect(settled.events.filter(e=>e.type===(id==='ultimate-hero'?'d14Promoted':'d14Returned'))).toHaveLength(1);
  expect(applyRoundSettlement(settled.state,receipt)).toEqual({ok:false,state:settled.state,reason:'duplicate-settlement'});
  expect(()=>restoreMatch(settled.state)).toThrow('multiplayer-state');
  const snapshot=snapshotForBattle(next,'a');
  expect(restorePlayerBattleSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  if(id==='ultimate-hero')expect(snapshot.d14Combat).toMatchObject({phase:'promoted'});
  else expect(settled.state.preparation.units.some(u=>u.id===before.d14!.unitId)).toBe(true);
});
it.each(cases.flatMap(c=>c.checkpoints.map(p=>({id:c.id,...p}))))('$id strictly restores $label and continues identically',({id,label,state:s})=>{
  restored(s);
  if(s.phase==='combat')expect(api.stepMatch(restoreMatch(serializeMatch(s)))).toEqual(api.stepMatch(s));
  if(label.startsWith('settled')){
    const count=Number(label.slice(-1));expect(s.d14!.phase).toBe(count<3?(id==='ultimate-hero'?'waiting':'absent'):(id==='ultimate-hero'?'promoted':'returned'));
    expect(api.stepMatch(s).state).toBe(s);
  }
});
it.each(cases)('$id applies certified combat values and retires the same physical ownership on sale',({id,checkpoints,ready})=>{
  let s=ready;const acquisition=checkpoints[0].state,target=s.d14!.originalUnit,heldItems=acquisition.d14!.held?.items;
  expect(acquisition.d14!.atOrdinal).toBe(acquisition.round-1);
  if(id==='into-the-unknown'){
    expect(acquisition.preparation.units.some(u=>u.id===target.id)).toBe(false);expect(heldItems!.length).toBeGreaterThan(0);
    expect(acquisition.items.some(i=>heldItems!.some(h=>h.id===i.id))).toBe(false);
    expect(api.sellUnit(acquisition,target.id)).toMatchObject({ok:false,state:acquisition});
    const absentSnapshot=snapshotForBattle(acquisition,'owner');expect(absentSnapshot.units.some(u=>u.id===target.id)).toBe(false);expect(absentSnapshot.anomalyBinding).toBeNull();
    const current=s.preparation.units.find(u=>u.id===target.id)!;
    expect(current.location).toEqual({kind:'bench',slot:3});
    expect(s.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===target.id)).toEqual(heldItems);
    const open=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;s=accepted(api.deployMatchUnit(s,current.id,open.location));
    const normal=getUnitStats(target.definitionId,target.starLevel),compiled=buildStrategySnapshot(s).units.find(u=>u.unitId===target.id)!;
    expect(compiled.sources.filter(e=>e.source.sourceInstanceId===s.anomalyBinding!.choiceId+':return').map(e=>e.effect)).toEqual([{kind:'statPercentBps',stat:'attackDamage',bps:5000},{kind:'statFlat',stat:'abilityPower',amount:50}]);
    expect(compiled.stats.attack).toBeGreaterThanOrEqual(Math.floor(normal.attack*1.5));expect(compiled.abilityPower).toBeGreaterThanOrEqual(150);
  }else{
    const compiled=buildStrategySnapshot(s).units.find(u=>u.unitId===target.id)!;
    expect(compiled.effectiveStarLevel).toBe(4);expect(compiled.ability).toEqual(d14UnitBase(target,true).ability);
    expect(toPrivateSeatView(s).preparation.units.find(u=>u.id===target.id)).toMatchObject({starLevel:3,effectiveStarLevel:4,sellGold:9,poolCopies:9});
    const snapshot=snapshotForBattle(s,'owner');expect(restorePlayerBattleSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    const bad=structuredClone(snapshot);Object.assign(bad.d14Combat!,{phase:'returned'});expect(()=>restorePlayerBattleSnapshot(bad)).toThrow();
    const highCost=structuredClone(snapshot);Object.assign(highCost.units.find(u=>u.id===target.id)!,{definitionId:'kogmaw'});expect(()=>restorePlayerBattleSnapshot(highCost)).toThrow();
    const early=structuredClone(snapshot);Object.assign(early,{roundId:'4-7'});expect(()=>restorePlayerBattleSnapshot(early)).toThrow();
  }
  restored(s);const combat=accepted(api.startMatchCombat(s));restored(combat);
  if(id==='ultimate-hero')expect(toCombatViewState(combat.combat!).units.find(u=>u.id===target.id)).toMatchObject({starLevel:3,effectiveStarLevel:4});
  const sold=accepted(api.sellUnit(s,target.id));expect(sold.gold-s.gold).toBe(api.getUnitSellPrice(target));expect(sold.anomalyBinding).toBeNull();expect(sold.d14!.phase).toBe('retired');restored(sold);
});

it.each(['ultimate-hero','into-the-unknown'])('%s rejects edited certificates, clock, resources and frozen combat inputs',id=>{
  const s=choose(id),target=s.d14!.originalUnit;
  for(const mutate of [
    (x:MatchState)=>Object.assign(x.d14!,{phase:id==='ultimate-hero'?'promoted':'returned',held:null}),
    (x:MatchState)=>Object.assign(x.d14!,{atOrdinal:x.d14!.atOrdinal-1}),
    (x:MatchState)=>Object.assign(x.d14!.originalUnit,{starLevel:1}),
    (x:MatchState)=>Object.assign(x.d14!,{selectionPrefixLength:1}),
    (x:MatchState)=>Object.assign(x.d14!,{unitId:'unit-999'}),
  ]){const bad=structuredClone(s);mutate(bad);expect(()=>restoreMatch(bad)).toThrow();}
  if(id==='into-the-unknown'){
    const bad=structuredClone(s);Object.assign(bad.d14!.held!.items[0],{definitionId:'sword'});expect(()=>restoreMatch(bad)).toThrow();
  }
  const started=accepted(api.startMatchCombat(s)),bad=structuredClone(started);
  Object.assign(bad.combatInputBasis!.inputs,{d14Combat:{unitId:target.id,anomalyId:id,phase:id==='ultimate-hero'?'promoted':'returned'}});
  expect(()=>restoreMatch(bad)).toThrow();
});

it.each(cases)('$id preserves its active certificate in a namespaced two-sided battle snapshot',({id,ready})=>{
  let s=ready;const target=s.d14!.originalUnit;
  if(id==='into-the-unknown'){
    const location=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!.location;
    s=accepted(api.deployMatchUnit(s,target.id,location));
  }
  const a=snapshotForBattle(s,'a'),b=snapshotForBattle(s,'b');
  const compiled=compileBattle(a,b,123,{battleId:'d14-live-pvp'});
  const namespaced=compiled.strategy.units.filter(u=>compiled.mapping.some(m=>m.kind==='unit'&&m.originalId===target.id&&m.combatId===u.unitId));
  expect(namespaced).toHaveLength(2);
  for(const u of namespaced){
    expect(u.effectiveStarLevel).toBe(id==='ultimate-hero'?4:undefined);
    expect(u.sources.filter(e=>e.source.sourceDefinitionId==='into-the-unknown'&&e.effect.kind==='statPercentBps')).toHaveLength(id==='into-the-unknown'?1:0);
  }
});

it('production return placement retains full-seat identity, then tries bench before row/column board order',()=>{
  const c=cases.find(c=>c.id==='into-the-unknown')!,acquired=c.checkpoints[0].state;
  const ready=c.ready,d=acquired.d14!,held=d.held!;
  const unit=(id:string,location:import('../src/simulation/unit-types').UnitLocation)=>({...held.unit,id,starLevel:1 as const,location});
  const bench=Array.from({length:9},(_,slot)=>unit(`bench-${slot}`,{kind:'bench',slot}));
  const board=Array.from({length:ready.level},(_,index)=>unit(`board-${index}`,{kind:'board',cell:{row:4+Math.floor(index/7),col:index%7}}));
  const full:MatchState={...ready,d14:d,anomalyBinding:acquired.anomalyBinding,items:[],preparation:{...ready.preparation,units:[...bench,...board]}};
  // Focused policy fixture; the real ownership/restore trajectory is covered above.
  expect(reconcileD14(full)).toBe(full);
  const opened={...full,preparation:{...full.preparation,units:full.preparation.units.filter(u=>u.id!=='bench-3')}};
  const returned=reconcileD14(opened),u=returned.preparation.units.find(u=>u.id===held.unit.id)!;
  expect(u).toEqual({...held.unit,location:{kind:'bench',slot:3}});expect(returned.items).toEqual(held.items);
  expect(reconcileD14(returned)).toBe(returned);
  const boardOpening={...full,preparation:{...full.preparation,units:full.preparation.units.filter(u=>u.id!=='board-2')}};
  expect(reconcileD14(boardOpening).preparation.units.find(u=>u.id===held.unit.id)?.location).toEqual({kind:'board',cell:{row:4,col:2}});
});
