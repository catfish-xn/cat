import { lootPlan, openingEncounter } from './fixtures/m5/oracle.g2.cjs';
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
import { preparePublicHeraldEquipmentRoute, publicAuthoredPreparation, publicHeraldTarget as publicDragonTarget, publicHeraldEquipment as publicDragonEquipment } from './fixtures/m8-neutral-public-route';
import { NEUTRAL_ENCOUNTERS } from '../src/simulation/content/neutral-encounters';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

// Every prefix comes from a complete public command-only acquisition route. v22: seed 42's scuttle-crab
// opening replaces the authored encounters, so these prefixes come from the crab-free route.
const prepared=publicAuthoredPreparation;
// Command-only acquisition is shared fixture setup, just like the route prefixes above.
// Each timed case still parses/restores its own graph and checks every combat checkpoint.
// v26: the equipment fork now comes from the Herald recorder's cloak-reserved seed-65 route
// (see preparePublicHeraldEquipmentRoute); seed 65 itself is unchanged.
await preparePublicHeraldEquipmentRoute();
const equipmentPrefixes=new Map([[],['ionic-spark'],['evenshroud'],['ionic-spark','evenshroud'],['quicksilver'],['edge-of-night']]
  .map(ids=>[JSON.stringify(ids),publicDragonEquipment(ids)] as const));
const dragonEquipment=(ids:readonly string[])=>restoreMatch(serializeMatch(equipmentPrefixes.get(JSON.stringify(ids))!));
// COMPILED_NEUTRAL_ENCOUNTERS now also lists the opening crab variants; this suite covers the eight authored ones.
const AUTHORED=COMPILED_NEUTRAL_ENCOUNTERS.filter(e=>NEUTRAL_ENCOUNTERS.some(n=>n.encounterId===e.encounterId));
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
  it.each(AUTHORED.map(e=>e.roundId))('%s freezes, starts, runs to settlement and resumes canonical saves',roundId=>{
    let s=battleFixture(roundId),steps=0;
    const compiled=AUTHORED.find(e=>e.roundId===roundId)!;
    expect(s.m8.preparation.enemies).toEqual(compiled.deployment);
    expect(s.combat!.units.filter(u=>u.team==='enemy').map(u=>[u.id,u.maxMana,u.baseCritChanceBps])).toEqual(compiled.units.map(u=>[u.id,0,2500]));
    expect(s.m8.encounterPlan).toBeNull(); // The authoritative B8 plan lives in the independently frozen loot ledger.
    roundTrip(s);
    while(s.phase==='combat') {
      const step=api.stepMatch(s);s=step.state;steps++;
      expect(step.events.some(e=>e.type==='cast' && compiled.units.some(u=>u.id===e.receipt.source.ownerId))).toBe(false);
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
  it.each(['3-7'])('%s separates captured initial events from tick-zero opening moves committed by the first step',roundId=>{
    const preparedState=prepared(roundId),start=api.startMatchCombat(preparedState);
    if(!start.ok) throw new Error('fixture cannot start');
    const initial=start.state.combat!,initialEvents=start.events.filter(e=>e.domain==='combat');
    expect(initial.tick).toBe(0);expect(initial.nextEventSeq).toBe(initialEvents.length);
    expect(initial.openingState).toBeUndefined();
    expect(initialEvents.some(e=>e.type==='movement')).toBe(false);
    const first=api.stepMatch(start.state),moves=first.events.filter(e=>e.type==='movement' && e.tick===0);
    expect(first.state.combat!.tick).toBe(1);expect(moves.length).toBe(5);
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
    expect(ROUND_CATALOG.filter(r=>r.kind==='pve').flatMap(r=>createRoundEnemies(r.ordinal))).toHaveLength(24);
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
    // v22 cleaned the encounter text; a crab-free 1-2 is the fixed ordinary PvE note, never a special pool.
    expect(readEncounterPreview(prepared('1-2'))!.rulesNote).toBe('固定普通PvE；2026-10-29批准的14.24基础数值，25%基础普攻暴击、1.4倍伤害；无装备、无羁绊、不可购买或出售。失败或平局：基础0+每只存活野怪1，最少扣1生命；召唤物及非战斗单位不计。');
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
  it.each(['3-7'])('rejects replayed, removed, cancelled and geometry-mutated opening consumption for %s',id=>{
    const s=api.stepMatch(battleFixture(id)).state;roundTrip(s);
    corrupt(s,x=>{delete x.combat.openingState;});
    corrupt(s,x=>{x.combat.openingState.committed=false;});
    corrupt(s,x=>{x.combat.openingState.initialUnits[0].cell.col=6;});
    corrupt(s,x=>{x.combat.openingState.plans[0].to.col=6;});

  });

  it.each([[],['ionic-spark'],['evenshroud'],['ionic-spark','evenshroud']])('restores real dragon attacks after earlier tick-one aura maintenance: %j',(...ids)=>{
    const items=ids as string[];
    // Acquire equipment through public commands in the current epoch; no old Herald save is restored.
    let s=dragonEquipment(items);
    if (!items.length) {
      const aura = s.items.find(item => item.definitionId === 'ionic-spark');
      expect(aura).toBeDefined();
      expect(aura!.location.kind).toBe('unit');
      if (aura!.location.kind !== 'unit') throw new Error('Expected publicly equipped Ionic Spark');
      if(aura!.location.unitId!=='unit-1')s = accepted(api.sellUnit(s, aura!.location.unitId));
      if(aura!.location.unitId!=='unit-1'){
        if(s.items.some(i=>i.location.kind==='unit'&&i.location.unitId==='unit-1')){const remover=s.consumables.find(c=>c.definitionId==='magnetic-remover')!;s=accepted(api.useConsumable(s,remover.consumableId,{kind:'unit',unitId:'unit-1'}));}
        expect(s.items.find(item => item.id === aura!.id)?.location).toEqual({kind:'inventory'});
      s = accepted(api.equipItem(s, aura!.id, 'unit-1', 1));}
      roundTrip(s);
    }
    s=accepted(api.startMatchCombat(s));roundTrip(s);
    const maintained = api.stepMatch(s); s=maintained.state; roundTrip(s);
    const auraContributions = s.combat!.units.flatMap(u => u.mechanismState?.statuses.flatMap(g => g.contributions) ?? [])
      .filter(c => ['ionic-spark','evenshroud'].includes(c.source.definitionId));
    expect(auraContributions.length).toBeGreaterThanOrEqual(items.length || 1);
    const events = [...maintained.events];
    while (s.phase === 'combat' && !events.some(e => e.type === 'attack' && e.attackerId.startsWith('["pve"'))) {
      const step = api.stepMatch(s); s = step.state; events.push(...step.events); roundTrip(s);
    }
    const auraIndex = events.findIndex(e => e.type === 'statusChanged' && e.group.contributions.some(c=>['ionic-spark','evenshroud'].includes(c.source.definitionId)));
    const dragonIndex = events.findIndex(e => e.type === 'attack' && e.attackerId.startsWith('["pve"'));
    expect(auraIndex).toBeGreaterThanOrEqual(0); expect(dragonIndex).toBeGreaterThan(auraIndex);
    expect(s.combat!.units.find(u=>u.team==='enemy')).toMatchObject({definitionId:'pve-elder-dragon',attackCone:{secondaryDamageBps:3500}});
    corrupt(s,x=>{const target=x.combat.units.find((u:any)=>u.id==='unit-1');target.maxMana=0;target.mana=0;});
    corrupt(s,x=>{x.combat.units.find((u:any)=>u.team==='enemy').attackCone.secondaryDamageBps=3501;});
    corrupt(s,x=>{const target=x.combat.units.find((u:any)=>u.mechanismState?.statuses.some((g:any)=>g.contributions.some((c:any)=>['ionic-spark','evenshroud'].includes(c.source.definitionId))));
      target.mechanismState.statuses.flatMap((g:any)=>g.contributions).find((c:any)=>['ionic-spark','evenshroud'].includes(c.source.definitionId)).source.effectIndex=99;});
  });
  it.each(['quicksilver','edge-of-night'])('round-trips actual dragon damage and item protection with %s',definitionId=>{
    let s=dragonEquipment([definitionId]);
    const start=api.startMatchCombat(s);s=accepted(start);roundTrip(s);
    const events:api.MatchEvent[]=start.ok?[...start.events]:[];
    for(let tick=0;tick<30 && s.phase==='combat';tick++) {const step=api.stepMatch(s);s=step.state;events.push(...step.events);roundTrip(s);}
    expect(events.some(e=>e.type==='packetDamage' && e.outcome.context.source.ownerId.startsWith('["pve"'))).toBe(true);
    const protection=events.filter(e=>e.type==='statusChanged' && e.group.contributions.some(c=>c.source.definitionId===definitionId));
    expect(protection.some(e=>e.type==='statusChanged' && e.group.kind===(definitionId==='quicksilver'?'control-immunity':'damage-prevention'))).toBe(true);
    expect(s.combat!.neutralReceipts!.controls).toEqual([]);
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
  it('6-7 restores real dragon attack boundaries and rejects legacy opening/control injection',()=>{
    let s=publicDragonTarget();
    s=api.stepMatch(accepted(api.startMatchCombat(s))).state;roundTrip(s);
    expect(s.combat!.units.filter(u=>u.team==='enemy').map(u=>u.definitionId)).toEqual(['pve-elder-dragon']);
    expect(s.combat!.openingDefinitions).toEqual([]);
    // A forged opening or control receipt must fail even though the dragon has no opening task.
    corrupt(s,x=>{x.combat.openingDefinitions=[{kind:'path-charge',source:{}}];});
    corrupt(s,x=>{x.combat.openingState={committed:true,plans:[],initialUnits:[]};});
    corrupt(s,x=>{x.combat.neutralReceipts.controls.push({key:'legacy-charge',targetId:'unit-1',appliedEventSeq:0,removedAtTick:null,removedEventSeq:null,removedReason:null});});
    let attacks=0;
    while(s.phase==='combat' && attacks<2){
      const step=api.stepMatch(s);s=step.state;
      if(step.events.some(e=>e.type==='attack'&&e.attackerId.startsWith('["pve"'))){attacks++;roundTrip(s);}
    }
    expect(attacks).toBe(2);roundTrip(s);
  });
  it.each([0,1,42,0xffffffff])('stage-one combat clears with random one-star opening heroes, seed %i through actual orb grants',seed=>{
    let s=api.createMatch(seed);
    for(let i=0;i<3;i++) {
      s=accepted(api.startMatchCombat(s));
      while(s.phase==='combat') s=api.stepMatch(s).state;
      expect(s.combat!.result).toBe('playerWin');expect(s.playerHp).toBe(100);roundTrip(s);
      s=resolveM5Choices(s);roundTrip(s);
      s=accepted(api.nextRound(s,s.round));
      if(i<2) {
        const expectedDrops=lootPlan(seed,3).rounds[i].encounterPlan.drops;
        const ids=expectedDrops.flatMap(d=>{const receipt=s.m8.loot.receipts.find(r=>r.dropId===d.dropId)!;expect(receipt.payload).toEqual(d.payload);return receipt.grantedUnitIds;});
        for(const id of ids){const unit=s.preparation.units.find(u=>u.id===id);if(!unit)continue;
          const board=s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(board.length>=s.level)break;
          const col=[3,5,1,0,6,2,4].find(col=>!board.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===7))!;
          s=accepted(api.deployMatchUnit(s,id,{kind:'board',cell:{col,row:7}}));
        }
        roundTrip(s);
      }
    }
    const expected=lootPlan(seed,3).rounds.flatMap(r=>r.encounterPlan.drops.map(d=>d.payload));
    const bonus=expected.filter(p=>p.kind==='gold').reduce((n,p)=>n+p.quantity,0);
    // v22 opening income: base 2/3/4 plus PvE win-streak gold 0/1/1 = 11. Crab openings (independent
    // literal table) also pay 1G per stage-one crab kill: 2+3+4 crabs, all cleared by these wins.
    const crabGold=['scuttle-puddle','crab-rave'].includes(openingEncounter(seed))?9:0;
    expect(s).toMatchObject({roundDefinitionId:'2-1',gold:11+bonus+crabGold,level:3,xp:2,playerHp:100});
    expect(s.items.map(item=>item.definitionId)).toEqual(expected.flatMap(p=>p.kind==='item'?[p.definitionId]:[]));
    expect(s.m8.loot.receipts.filter(receipt=>receipt.payload.kind==='item').map(receipt=>receipt.payload))
      .toEqual(expected.filter(p=>p.kind==='item'));
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
