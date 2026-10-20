import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import type { CombatEvent, CombatState } from '../src/simulation/combat-types';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { makeSourcedEffects, resolveEffects } from '../src/simulation/effects';
import { getUnitStats } from '../src/simulation/unit-stats';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { readCombatStats } from '../src/simulation/combat-s13';
import { validateItemProgram } from '../src/simulation/m8/item-program';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import type { Unit } from '../src/simulation/unit-types';
import { compileD11Augment, compileD11Anomaly, d11GiftPlan, drainD11Gifts,
  d11AvariceDamageAmpBps, grantD11AvariceGold, d11HeadhunterAttackSpeedBps, recordD11HeadhunterKills } from '../src/simulation/d11-fill';
const boardUnit=(id:string,definitionId:string,team:'player'|'enemy'='player',col=1,row=4):Unit=>
  ({id,definitionId,starLevel:1,team,location:{kind:'board',cell:{col,row}}});
const roster=[boardUnit('p','lux'),boardUnit('e','garen','enemy',1,3)];
function initial(grants:ReturnType<typeof compileD11Augment>['grants']=[],anomaly?:Parameters<typeof compileD11Anomaly>){
  const base=createMatch(42),preparation={...base.preparation,units:roster};
  const snapshot=buildStrategySnapshot({...base,preparation},{traits:TRAIT_DEFINITIONS,items:{},augments:{},anomalies:{}});
  const strategy={...snapshot,units:snapshot.units.map(s=>{
    const u=roster.find(u=>u.id===s.unitId)!,grant=grants.find(g=>g.unitId===u.id);
    const stats=getUnitStats(u.definitionId,u.starLevel);
    const result=resolveEffects(stats,resolveAbility(stats.abilityId,u.starLevel),[...s.sources,
      ...makeSourcedEffects(u.id,'augment','d11-test','choice',grant?.effects??[])]);
    const program=anomaly&&u.id==='p'?compileD11Anomaly(...anomaly):grant?.program;
    if(program)validateItemProgram(program);
    return {...s,...result,itemPrograms:program?[{source:{ownerId:u.id,sourceKind:'augment' as const,definitionId:'d11-test',instanceId:'choice',effectIndex:1024,parentItemInstanceId:null},program}]:[]};
  })};
  return createCombatWithEvents(preparation,strategy,'d11-test',42).state;
}
function attack(s:CombatState){return stepCombat({...s,units:s.units.map(u=>({...u,mana:0,maxMana:0,moveCooldownTicks:2000,cooldownTicks:u.id==='p'?0:2000,attackDamage:100,attackDamageBase:100,attackDamagePercentBps:0,baseCritChanceBps:0,attackRange:20,armor:0}))});}

it('One For All I counts unique deployed one-cost champions; excludes bench, enemies and duplicate definitions',()=>{
  const board=[...roster,boardUnit('p2','lux'),boardUnit('p3','irelia'),boardUnit('p4','loris'),
    {...boardUnit('bench','zyra'),location:{kind:'bench' as const,slot:0}}];
  const c=compileD11Augment('all-for-one-i',board,100,42);
  expect(c.rngState).toBe(42);expect(c.rngDraws).toBe(0);
  expect(c.grants.map(g=>g.unitId)).toEqual(['p','p2','p3','p4']);
  const s=initial(c.grants),u=s.units.find(u=>u.id==='p')!;
  expect(u.maxHp).toBe(Math.floor(getUnitStats('lux',1).health*1.04));
  const packet=attack(s).events.find(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p');
  expect(packet?.type==='packetDamage'&&packet.outcome.hpDamage).toBe(103);
});
it('Trifecta I selects exactly three distinct eligible heroes, preserves caller order and consumes three opening words',()=>{
  const board=['loris','nami','ezreal','gangplank'].map((d,i)=>boardUnit('p'+i,d));
  const before=JSON.stringify(board),a=compileD11Augment('trifecta-i',board,100,42),b=compileD11Augment('trifecta-i',[...board].reverse(),100,42);
  expect(a).toEqual(b);expect(JSON.stringify(board)).toBe(before);expect(a.rngDraws).toBe(3);expect(a.rngState).toBe(2479403867);
  // LCG(42): 1083814273,378494188,2479403867 => partial shuffle indices 1,2,3.
  const chosen=a.grants.filter(g=>g.effects.length);expect(chosen.map(g=>g.unitId)).toEqual(['p1','p2','p3']);
  for(const g of chosen){
    const unit=board.find(u=>u.id===g.unitId)!,base=getUnitStats(unit.definitionId,1);
    const r=resolveEffects(base,resolveAbility(base.abilityId,1),makeSourcedEffects(unit.id,'augment','trifecta-i','choice',g.effects));
    expect(r.stats.health).toBe(base.health+250);expect(r.stats.attackSpeedBonusBps).toBe(1800);
  }
  expect(compileD11Augment('trifecta-i',[board[0]],100,42).rngDraws).toBe(1);
  expect(compileD11Augment('trifecta-i',roster,100,42).rngDraws).toBe(0);
});
it.each([[100,25],[91,25],[90,27],[50,37],[0,50]])('Spirit Link at player HP %i heals %i of a 500-HP unit on tick 100, never tick zero', (hp,healing)=>{
  let s=initial(compileD11Augment('spirit-link',roster,hp,42).grants);
  s={...s,units:s.units.map(u=>({...u,hp:u.id==='p'?100:u.hp,maxHp:u.id==='p'?500:u.maxHp,mana:0,maxMana:0,cooldownTicks:2000,moveCooldownTicks:2000}))};
  for(let i=0;i<99;i++)s=stepCombat(s).state;
  expect(s.units.find(u=>u.id==='p')!.hp).toBe(100);
  s=stepCombat(s).state;expect(s.units.find(u=>u.id==='p')!.hp).toBe(100+healing);
});
it.each(['all-for-one-i','trifecta-i'])('%s gives two correct-cost units exactly once through existing grant/bench machinery',id=>{
  const base=createMatch(42),a={definitionId:id,choiceId:'d11-acquisition',acquiredRound:base.round};
  const state={...base,augments:[a]},before=[state.rngState,state.choiceRngState,state.rewardRngState,state.battleSeedRngState];
  const plan=d11GiftPlan(state,a),next=drainD11Gifts(state,a);
  expect(plan).toHaveLength(2);for(const gift of plan)expect(UNIT_DEFINITIONS[gift.definitionId].cost).toBe(id==='all-for-one-i'?1:3);
  expect(next.seatMechanics!.receipts.filter(r=>plan.some(g=>g.receiptId===r.receiptId))).toHaveLength(2);
  expect(drainD11Gifts(next,a)).toBe(next);
  expect([next.rngState,next.choiceRngState,next.rewardRngState,next.battleSeedRngState]).toEqual(before);
  expect(()=>drainD11Gifts(base,a)).toThrow('without acquisition');
});
it('gift escrow retries the same heroes after bench space opens; shared empty pools pay the two hero costs exactly once',()=>{
  const base=createMatch(42),a={definitionId:'trifecta-i',choiceId:'d11-gifts',acquiredRound:base.round};
  const state={...base,augments:[a]},plan=d11GiftPlan(state,a);
  const occupied=Object.values(UNIT_DEFINITIONS).filter(d=>!d.summon&&d.unitKind!=='neutral'&&!plan.some(g=>g.definitionId===d.id)).slice(0,9);
  const full={...state,preparation:{...state.preparation,units:occupied.map((d,i):Unit=>
    ({id:'full-'+i,definitionId:d.id,starLevel:1,team:'player',location:{kind:'bench',slot:i}}))}};
  expect(drainD11Gifts(full,a)).toBe(full);
  const free={...full,preparation:{...full.preparation,units:full.preparation.units.slice(0,7)}};
  const filled=drainD11Gifts(free,a);
  expect(filled.seatMechanics!.receipts.filter(r=>plan.some(g=>g.receiptId===r.receiptId))).toHaveLength(2);
  expect(d11GiftPlan(filled,a)).toEqual(plan);
  let calls=0;
  const paid=drainD11Gifts(state,a,()=>{calls++;return {kind:'gold',quantity:3};});
  expect(calls).toBe(2);expect(paid.gold).toBe(state.gold+6);
  expect(drainD11Gifts(paid,a,()=>{throw Error('duplicate reservation');})).toBe(paid);
});
it('Avarice acquisition pays 5 gold once; live bank samples can decrease as well as increase',()=>{
  const base=createMatch(42),s={...base,anomalyBinding:{definitionId:'avarice-incarnate',choiceId:'binding',unitId:'p',boundRound:base.round}};
  const r=grantD11AvariceGold(s);expect(r.ok).toBe(true);
  expect(r.state.gold).toBe(s.gold+5);
  const again=grantD11AvariceGold(r.state);expect(again.ok).toBe(false);expect(again.state).toBe(r.state);
  expect([49,50,2,0].map(d11AvariceDamageAmpBps)).toEqual([3900,4000,1600,1500]);
});
it.each([[0,115],[1,115],[2,116],[49,139],[50,140],[100,140]])('Avarice bank %i yields actual 100-raw attack damage %i with no defenses', (gold,damage)=>{
  const r=attack(initial([],['avarice-incarnate',gold]));
  const packet=r.events.find(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p');
  expect(packet?.type==='packetDamage'&&packet.outcome.hpDamage).toBe(damage);
});
it('Headhunter deduplicates event identity, counts revived deaths, excludes assists/allies/summons and rejects conflicting restore facts',()=>{
  const source={ownerId:'p',sourceKind:'attack' as const,definitionId:'lux',instanceId:'p',effectIndex:0};
  const kills:Extract<CombatEvent,{type:'kill'}>[]=[{type:'kill',tick:1,unitId:'e',source,combatId:'c1',eventSeq:1},
    {type:'kill',tick:4,unitId:'e',source,combatId:'c1',eventSeq:2}];
  const summon=Object.values(UNIT_DEFINITIONS).find(u=>u.summon)!;
  const roster2=[...roster,boardUnit('s',summon.id,'enemy')];
  const noise:CombatEvent[]=[{...kills[0],eventSeq:3,unitId:'s'},{...kills[0],eventSeq:4,unitId:'p'},
    {...kills[0],eventSeq:5,source:{...source,ownerId:'other'}}];
  const journal=recordD11HeadhunterKills([],'c1','p',[...kills,...noise,kills[0]],roster2);
  expect(journal[0].kills).toEqual([{eventSeq:1,victimId:'e'},{eventSeq:2,victimId:'e'}]);
  expect(recordD11HeadhunterKills(journal,'c1','p',kills,roster2)).toBe(journal);
  expect(()=>recordD11HeadhunterKills(journal,'c1','p',kills.slice(0,1),roster2)).toThrow('Conflicting');
  const restored=JSON.parse(JSON.stringify(journal));expect(recordD11HeadhunterKills(restored,'c1','p',kills,roster2)).toBe(restored);
  const bonus=d11HeadhunterAttackSpeedBps(journal[0].kills.length);expect(bonus).toBe(1700);
  const s=initial([],['headhunter',2]),u=s.units.find(u=>u.id==='p')!;
  expect(readCombatStats(u,s).attackIntervalTicks).toBe(Math.ceil(200000/(getUnitStats('lux',1).baseAttackSpeedBps!*1.17)));
});
it('Headhunter journals an actual engine kill and carries its one-percent growth into the next isolated combat',()=>{
  const base=initial(),s={...base,units:base.units.map(u=>u.id==='e'?{...u,hp:1}:u)};
  const r=attack(s),journal=recordD11HeadhunterKills([],'d11-test','p',r.events,roster);
  expect(journal[0].kills).toHaveLength(1);
  expect(d11HeadhunterAttackSpeedBps(journal[0].kills.length)).toBe(1600);
  const next=initial([],['headhunter',journal[0].kills.length]),unit=next.units.find(u=>u.id==='p')!;
  expect(readCombatStats(unit,next).attackIntervalTicks).toBe(Math.ceil(200000/(getUnitStats('lux',1).baseAttackSpeedBps!*1.16)));
  expect(recordD11HeadhunterKills(journal,'d11-test','p',r.events,roster)).toBe(journal);
});
it('rejects malformed fact inputs instead of introducing invalid numeric stats',()=>{
  for(const value of [-1,NaN,Infinity,0.5]){
    expect(()=>d11AvariceDamageAmpBps(value)).toThrow();expect(()=>d11HeadhunterAttackSpeedBps(value)).toThrow();
  }
  expect(()=>compileD11Augment('spirit-link',roster,101,42)).toThrow();
});
