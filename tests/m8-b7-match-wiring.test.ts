import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { COMPILED_NEUTRAL_ENCOUNTERS } from '../src/simulation/neutral-encounter-compiler';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { NEUTRAL_DEFINITIONS } from '../src/simulation/content/neutrals';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { createRoundEnemies, getRoundEnemyItems } from '../src/simulation/round-enemies';
import { readEncounterPreview } from '../src/simulation/encounter-selectors';
import { getUnitStats } from '../src/simulation/unit-stats';
import { planPurchase } from '../src/simulation/upgrades';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { accepted, resolveM5Choices } from './match-helpers';
import { publicNeutralPreparation, publicHeraldTarget, publicHeraldEquipment } from './fixtures/m8-neutral-public-route';

// Every prefix comes from the complete public command-only acquisition route.
const prepared=publicNeutralPreparation;
function battleFixture(roundId:string):api.MatchState {
  return accepted(api.startMatchCombat(prepared(roundId)));
}
function roundTrip(s:api.MatchState):api.MatchState {
  const saved=serializeMatch(s), restored=restoreMatch(saved);
  expect(restored).toEqual(s);expect(serializeMatch(restored)).toBe(saved);
  expect(api.stepMatch(restored)).toEqual(api.stepMatch(s));
  return restored;
}
const corrupt=(s:api.MatchState,mutate:(x:any)=>void)=>{ const saved=serializeMatch(s);expect(restoreMatch(saved)).toEqual(s);const x=JSON.parse(saved);mutate(x);expect(()=>restoreMatch(x)).toThrow(); };

describe('B7 installed encounters and trusted Match restore',()=>{
  it.each(COMPILED_NEUTRAL_ENCOUNTERS.map(e=>e.roundId))('%s freezes, starts, runs to settlement and resumes canonical saves',roundId=>{
    let s=battleFixture(roundId),steps=0;
    const compiled=COMPILED_NEUTRAL_ENCOUNTERS.find(e=>e.roundId===roundId)!;
    expect(s.m8.preparation.enemies).toEqual(compiled.deployment);
    expect(s.combat!.units.filter(u=>u.team==='enemy').map(u=>[u.id,u.maxMana,u.baseCritChanceBps])).toEqual(compiled.units.map(u=>[u.id,0,2500]));
    expect(s.m8.encounterPlan).toBeNull(); // The authoritative B8 plan lives in the independently frozen loot ledger.
    roundTrip(s);
    while(s.phase==='combat') {
      const step=api.stepMatch(s);s=step.state;steps++;
      expect(step.events.some(e=>e.type==='cast' && compiled.units.some(u=>u.id===e.sourceId))).toBe(false);
      if(steps<=2 || steps%25===0 || s.phase!=='combat') roundTrip(s);
    }
    expect(steps).toBeLessThanOrEqual(1200);
    if(s.phase==='choice') {
      const blocked=api.nextRound(s,s.round);
      expect(blocked).toEqual({ok:false,state:s,reason:'wrong-phase'});expect(blocked.state).toBe(s);
      s=resolveM5Choices(s);roundTrip(s);
    }
    expect(['settlement','gameOver']).toContain(s.phase);
    expect(s.combat!.units.filter(u=>u.team==='enemy').every(u=>u.mana===0 && u.maxMana===0)).toBe(true);
  });
  it.each(['3-7','6-7'])('%s separates captured initial events from tick-zero opening moves committed by the first step',roundId=>{
    const preparedState=prepared(roundId),start=api.startMatchCombat(preparedState);
    if(!start.ok) throw new Error('fixture cannot start');
    const initial=start.state.combat!,initialEvents=start.events.filter(e=>e.domain==='combat');
    expect(initial.tick).toBe(0);expect(initial.nextEventSeq).toBe(initialEvents.length);
    expect(initial.openingState).toBeUndefined();
    expect(initialEvents.some(e=>e.type==='movement')).toBe(false);
    const first=api.stepMatch(start.state),moves=first.events.filter(e=>e.type==='movement' && e.tick===0);
    expect(first.state.combat!.tick).toBe(1);expect(moves.length).toBe(roundId==='3-7'?5:1);
    for(const e of moves) expect(e.eventSeq).toBeGreaterThanOrEqual(initial.nextEventSeq!);
    expect(first.state.combat!.openingState!.committed).toBe(true);
    expect(api.stepMatch(first.state).events.filter(e=>e.type==='movement' && e.tick===0)).toEqual([]);
    roundTrip(start.state);roundTrip(first.state);
  });
  it('replaces the B6 stage-one placeholder with independently enumerated 2/3/4 minions',()=>{
    expect([1,2,3].map(n=>createRoundEnemies(n).map(u=>u.definitionId))).toEqual([
      ['pve-minion-melee-a','pve-minion-melee-a'],
      ['pve-minion-melee-b','pve-minion-melee-b','pve-minion-ranged-b'],
      ['pve-minion-melee-c','pve-minion-melee-c','pve-minion-ranged-c','pve-minion-ranged-c'],
    ]);
    expect(ROUND_CATALOG.filter(r=>r.kind==='pve').flatMap(r=>createRoundEnemies(r.ordinal))).toHaveLength(25);
  });
  it('returns public immutable previews without draws, hidden loot or manufacturing a special encounter pool',()=>{
    for(const id of ['1-2','2-1','2-4','4-7','6-7']) {
      const s=prepared(id), before=serializeMatch(s), view=readEncounterPreview(s);
      expect(serializeMatch(s)).toBe(before);
      if(id==='2-4') {expect(view).toBeNull();continue;}
      expect(Object.isFrozen(view)).toBe(true);
      expect(view!.units.map(u=>u.unitId)).toEqual(s.m8.preparation.enemies.map(u=>u.id));
      expect(Object.keys(view!).sort()).toEqual(['encounterId','rulesNote','units']);
      expect(view!.units.every(u=>u.abilityDescription.length>5)).toBe(true);
      for(const u of view!.units) expect(u.stats.maxHp).toBeGreaterThan(0);
    }
    expect(readEncounterPreview(prepared('1-2'))!.rulesNote).toContain('特殊奇遇池未启用');
    expect(readEncounterPreview(prepared('2-1'))!.encounterId).toBe('pvp:2-1');
  });
  it('keeps neutral registration out of all hero acquisition, traits, equipment and PvP templates',()=>{
    const s=api.createMatch(42), enemy=s.m8.preparation.enemies[0];
    for(const id of Object.keys(NEUTRAL_DEFINITIONS)) {
      expect(()=>planPurchase(s.preparation,id,'unit-2')).toThrow();
      const forged={...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>u.team==='player'?{...u,definitionId:id}:u)}};
      expect(()=>restoreMatch(forged)).toThrow();
      expect(()=>getUnitStats(id,2)).toThrow();
    }
    expect(api.sellUnit(s,enemy.id)).toEqual({ok:false,state:s,reason:'enemy-unit'});
    expect(api.deployMatchUnit(s,enemy.id,{kind:'board',cell:{col:0,row:4}})).toEqual({ok:false,state:s,reason:'enemy-unit'});
    expect(deriveTraits(s.preparation,'enemy').every(t=>t.count===0 && t.tier===0 && !t.targetUnitIds.length)).toBe(true);
    for(const r of ROUND_CATALOG) if(r.kind==='pvp') expect(createRoundEnemies(r.ordinal).every(u=>!Object.hasOwn(NEUTRAL_DEFINITIONS,u.definitionId))).toBe(true);
    for(const r of ROUND_CATALOG) if(r.kind==='pve') expect(getRoundEnemyItems(r.ordinal)).toEqual([]);
  });
  it('rejects injected or mutated authored inputs, including neutral capabilities placed on a champion',()=>{
    const s=battleFixture('1-2');
    for(const field of ['unitKind','monsterFamily','encounterId','baseCritChanceBps','baseCritMultiplierBps','companionDefinitions','attackCone']) {
      corrupt(s,x=>{const e=x.combat.units.find((u:any)=>u.team==='enemy');e[field]=field.includes('Bps')?1:field==='attackCone'?{secondaryDamageBps:3500}:'forged';});
    }
    for(const [field,value] of Object.entries({unitKind:'neutral',monsterFamily:'wolf',encounterId:'minions-a-v1',baseCritChanceBps:2500,baseCritMultiplierBps:14000,attackCone:{secondaryDamageBps:3500},companionDefinitions:[]}))
      corrupt(s,x=>{x.combat.units.find((u:any)=>u.team==='player')[field]=value;});
    for(const field of ['mana','maxMana','baseAttackSpeedBps','attackIntervalTicks']) corrupt(s,x=>{x.combat.units.find((u:any)=>u.team==='enemy')[field]+=1;});
    corrupt(s,x=>{x.combat.openingDefinitions=[{kind:'backline-jump',source:{}}];});
    corrupt(s,x=>{x.combat.companionState={};});
  });
  it.each(['3-7','6-7'])('rejects replayed, removed, cancelled and geometry-mutated opening consumption for %s',id=>{
    const s=api.stepMatch(battleFixture(id)).state;roundTrip(s);
    corrupt(s,x=>{delete x.combat.openingState;});
    corrupt(s,x=>{x.combat.openingState.committed=false;});
    corrupt(s,x=>{x.combat.openingState.initialUnits[0].cell.col=6;});
    corrupt(s,x=>{x.combat.openingState.plans[0].to.col=6;});
    if(id==='6-7') for(const status of ['pending','cancelled']) corrupt(s,x=>{x.combat.openingState.plans[0].task.status=status;});
  });

  it.each([[],['ionic-spark'],['evenshroud'],['ionic-spark','evenshroud']])('restores Herald action identity after earlier tick-one aura maintenance: %j',(...ids)=>{
    const items=ids as string[];
    let s=publicHeraldEquipment(items);
    s=accepted(api.startMatchCombat(s));roundTrip(s);s=api.stepMatch(s).state;roundTrip(s);
    const c=s.combat!.units.find(u=>u.id==='unit-1')!.mechanismState!.statuses.flatMap(g=>g.contributions).find(c=>c.source.definitionId==='void-charge-project-v1')!;
    expect(c).toBeDefined();expect(JSON.parse(JSON.parse(c.key)[8])).toEqual([items.length,1]);
    corrupt(s,x=>{const target=x.combat.units.find((u:any)=>u.id==='unit-1');target.maxMana=0;target.mana=0;});
    corrupt(s,x=>{const target=x.combat.units.find((u:any)=>u.id==='unit-1');const status=target.mechanismState.statuses.flatMap((g:any)=>g.contributions).find((c:any)=>c.source.definitionId==='void-charge-project-v1');status.source.effectIndex=2;});
  });
  it.each(['quicksilver','edge-of-night'])('round-trips legal Herald item immunity/cleanup boundaries with %s',definitionId=>{
    let s=publicHeraldEquipment([definitionId]);
    s=accepted(api.startMatchCombat(s));roundTrip(s);
    for(let tick=0;tick<15;tick++) {s=api.stepMatch(s).state;roundTrip(s);}
    if(definitionId==='quicksilver') expect(s.combat!.neutralReceipts!.controls).toEqual([]);
    else expect(s.combat!.neutralReceipts!.controls).toHaveLength(1);
  });
  it('pins the current catalog assumptions used by pure opening restore, without executing combatStart',()=>{
    const first=Object.values(ITEM_DEFINITIONS).flatMap(d=>d.combatProgram?.periodic ?? []).filter(p=>(p.startsAtTick ?? p.periodTicks)===1);
    expect(first).toHaveLength(2);
    for(const p of first) {expect(p.condition).toBeUndefined();expect(p.program.selector.sample).toBe('each-tick');
      expect(p.program.effects.every(e=>e.kind==='apply-status' && ['shred','sunder'].includes(e.status.kind))).toBe(true);}
    const initial=Object.values(ITEM_DEFINITIONS).flatMap(d=>d.combatProgram?.survival ?? []).filter(t=>t.initialAlso);
    expect(initial).toHaveLength(1);expect(initial[0].condition).toMatchObject({kind:'hp-ratio',subject:'holder',op:'lte',thresholdBps:6000});
  });
  it('rejects re-dating an executed krug heal into a new pending reaction and validates independent death facts',()=>{
    let s=battleFixture('2-7');
    while(s.phase==='combat' && !s.combat.companionState?.reactions.some(r=>r.status==='executed' && s.combat!.units.some(u=>u.id===r.targetId && u.alive && u.hp<u.maxHp))) s=api.stepMatch(s).state;
    expect(s.phase).toBe('combat');roundTrip(s);
    const r=s.combat!.companionState!.reactions.find(r=>r.status==='executed' && s.combat!.units.some(u=>u.id===r.targetId && u.alive && u.hp<u.maxHp))!;
    expect(r).toBeDefined();
    corrupt(s,x=>{const row=x.combat.companionState.reactions.find((v:any)=>v.key===r.key);row.status='pending';row.registeredAtTick=x.combat.tick;row.executeAtTick=x.combat.tick+1;row.deathEventId=JSON.stringify([x.combat.combatId,x.combat.tick,0]);});
    corrupt(s,x=>{delete x.combat.neutralReceipts;});
    corrupt(s,x=>{x.combat.neutralReceipts.deaths=[];});
    corrupt(s,x=>{x.combat.neutralReceipts.deaths.push(x.combat.neutralReceipts.deaths[0]);});
    corrupt(s,x=>{x.combat.neutralReceipts.deaths[0].tick++;});
    corrupt(s,x=>{x.combat.neutralReceipts.deaths[0].eventSeq++;});
  });
  it('rejects deletion of active Herald control, its receipt, or both, and forged cleanup',()=>{
    let s=publicHeraldTarget();
    s=api.stepMatch(accepted(api.startMatchCombat(s))).state;roundTrip(s);
    expect(s.combat!.neutralReceipts!.controls).toHaveLength(1);
    const erase=(x:any)=>{const u=x.combat.units.find((u:any)=>u.id==='unit-1');u.mechanismState.statuses=[];u.statuses=[];};
    corrupt(s,erase);corrupt(s,x=>{x.combat.neutralReceipts.controls=[];});
    corrupt(s,x=>{erase(x);x.combat.neutralReceipts.controls=[];});
    corrupt(s,x=>{erase(x);const r=x.combat.neutralReceipts.controls[0];r.removedAtTick=1;r.removedEventSeq=x.combat.nextEventSeq-1;r.removedReason='expired';});
    corrupt(s,x=>{x.combat.neutralReceipts.controls.push(x.combat.neutralReceipts.controls[0]);});
    for(let i=0;i<11;i++) s=api.stepMatch(s).state;
    roundTrip(s);expect(s.combat!.neutralReceipts!.controls[0]).toMatchObject({removedAtTick:12,removedReason:'expired'});
  });
  it.each([0,1,42,0xffffffff])('stage-one combat baseline clears with approved one-star Irelia→Maddie→Lux, seed %i through actual B8 grants',seed=>{
    let s=api.createMatch(seed);
    for(let i=0;i<3;i++) {
      s=accepted(api.startMatchCombat(s));
      while(s.phase==='combat') s=api.stepMatch(s).state;
      expect(s.combat!.result).toBe('playerWin');expect(s.playerHp).toBe(100);roundTrip(s);
      s=resolveM5Choices(s);roundTrip(s);
      s=accepted(api.nextRound(s,s.round));
      if(i<2) {
        const id=`unit-${i+2}`,definitionId=i===0?'maddie':'lux';
        expect(s.preparation.units.find(u=>u.id===id)).toMatchObject({definitionId,starLevel:1});
        expect(s.m8.loot.receipts.find(receipt=>receipt.grantedUnitIds.includes(id))).toMatchObject({
          payload:{kind:'unit',definitionId,quantity:1},grantedUnitIds:[id],
        });
        s=accepted(api.deployMatchUnit(s,id,{kind:'board',cell:{col:3+i*2,row:7}}));
        roundTrip(s);
      }
    }
    expect(s).toMatchObject({roundDefinitionId:'2-1',gold:10,level:3,xp:0,playerHp:100});
    expect(s.items.map(item=>item.definitionId)).toEqual(['sword','sword']);
    expect(s.m8.loot.receipts.filter(receipt=>receipt.payload.kind==='item').map(receipt=>receipt.payload))
      .toEqual([{kind:'item',definitionId:'sword',quantity:1},{kind:'item',definitionId:'sword',quantity:1}]);
    expect(s.scheduleReceipts).toEqual([]);
  });
  it('restores real bird next-tick reactions and rejects changed effects, death identity and missing consumption',()=>{
    let s=battleFixture('4-7');
    while(s.phase==='combat' && !s.combat.companionState?.reactions.some(r=>r.status==='pending')) s=api.stepMatch(s).state;
    expect(s.combat!.companionState!.reactions.some(r=>r.status==='pending')).toBe(true);roundTrip(s);
    corrupt(s,x=>{x.combat.companionState.reactions[0].executeAtTick++;});
    corrupt(s,x=>{x.combat.companionState.reactions[0].deathEventId='["wrong",1,0]';});
    corrupt(s,x=>{x.combat.companionState.reactions=[];});
    s=api.stepMatch(s).state;roundTrip(s);
    const buff=s.combat!.units.find(u=>u.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.application.modifier?.stat==='attackSpeed')))!;
    expect(buff).toBeDefined();
    corrupt(s,x=>{x.combat.units.find((u:any)=>u.id===buff.id).mechanismState.statuses.find((g:any)=>g.contributions[0].application.modifier?.stat==='attackSpeed').contributions[0].application.modifier.value.amount=3000;});
    corrupt(s,x=>{const u=x.combat.units.find((u:any)=>u.id===buff.id);u.mechanismState.statuses=[];u.statuses=[];});
  });
});
