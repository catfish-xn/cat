import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { COMPILED_NEUTRAL_ENCOUNTERS } from '../src/simulation/neutral-encounter-compiler';
import { NEUTRAL_DEFINITIONS } from '../src/simulation/content/neutrals';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import { createRoundEnemies, getRoundEnemyItems } from '../src/simulation/round-enemies';
import { readEncounterPreview } from '../src/simulation/encounter-selectors';
import { getUnitStats } from '../src/simulation/unit-stats';
import { planPurchase } from '../src/simulation/upgrades';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { accepted, resolveM5Choices } from './match-helpers';

/** Synthetic earlier combat outcomes only to obtain a valid late-round economic/history boundary.
 * The tested encounter itself uses unmodified production Start/step/serialize/restore.
 * This is not a public no-cheat route or balance/loot acceptance. */
function prepared(roundId:string): api.MatchState {
  let s=api.createMatch(42);
  while(s.roundDefinitionId!==roundId) {
    s=resolveM5Choices(s);
    if(s.phase==='preparation') {
      s=accepted(api.startMatchCombat(s));
      if(s.phase==='combat') s=api.stepMatch(s).state;
      if(s.phase==='combat') {
        s={...s,combat:{...s.combat,units:s.combat.units.map(u=>u.team==='enemy'?{...u,hp:0,alive:false}:u)}};
        s=api.stepMatch(s).state;
      }
    }
    s=resolveM5Choices(s);
    s=accepted(api.nextRound(s,s.round));
  }
  return resolveM5Choices(s);
}
function battleFixture(roundId:string):api.MatchState {
  let s=prepared(roundId);
  if(s.level>=3) s={...s,nextUnitSerial:4,preparation:{...s.preparation,units:[...s.preparation.units.filter(u=>u.team==='enemy'),
    ...['garen','caitlyn','lux'].map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,team:'player' as const,starLevel:3 as const,
      location:{kind:'board' as const,cell:{col:1+i*2,row:i===0?4:7}}}))]}};
  return accepted(api.startMatchCombat(s));
}
function roundTrip(s:api.MatchState):api.MatchState {
  const saved=serializeMatch(s), restored=restoreMatch(saved);
  expect(restored).toEqual(s);expect(serializeMatch(restored)).toBe(saved);
  expect(api.stepMatch(restored)).toEqual(api.stepMatch(s));
  return restored;
}
const corrupt=(s:api.MatchState,mutate:(x:any)=>void)=>{ const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow(); };

describe('B7 installed encounters and trusted Match restore',()=>{
  it.each(COMPILED_NEUTRAL_ENCOUNTERS.map(e=>e.roundId))('%s freezes, starts, runs to settlement and resumes canonical saves',roundId=>{
    let s=battleFixture(roundId),steps=0;
    const compiled=COMPILED_NEUTRAL_ENCOUNTERS.find(e=>e.roundId===roundId)!;
    expect(s.m8.preparation.enemies).toEqual(compiled.deployment);
    expect(s.combat!.units.filter(u=>u.team==='enemy').map(u=>[u.id,u.maxMana,u.baseCritChanceBps])).toEqual(compiled.units.map(u=>[u.id,0,2500]));
    expect(s.m8.encounterPlan).toBeNull(); // B8 has not installed loot; never pretend an empty plan is complete.
    roundTrip(s);
    while(s.phase==='combat') {
      const step=api.stepMatch(s);s=step.state;steps++;
      expect(step.events.some(e=>e.type==='cast' && compiled.units.some(u=>u.id===e.sourceId))).toBe(false);
      if(steps<=2 || steps%25===0 || s.phase!=='combat') roundTrip(s);
    }
    expect(steps).toBeLessThanOrEqual(1200);
    expect(['settlement','gameOver']).toContain(s.phase);
    expect(s.combat!.units.filter(u=>u.team==='enemy').every(u=>u.mana===0 && u.maxMana===0)).toBe(true);
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
