import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_G4 } from '../src/simulation/content/augment-pool-batch5-g4';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { applyCombatStart } from '../src/simulation/combat-effects';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { castB5Voidcaller, spawnB5Voidlings, type B5VoidcallerCounter, type B5VoidlingBirth } from '../src/simulation/augment-pool-batch5-g4';
import { b5VoidSwarmGiftPlan, b5VoidSwarmVamp, b5VoidSwarmTarget, b5PortalEffects, startB5VoidSwarm } from '../src/simulation/augment-pool-batch5-g4-swarm';
import { batch1GiftPlan } from '../src/simulation/augment-pool-grants';
import { hexDistance } from '../src/simulation/board';
import { p2Target } from '../src/simulation/s13-augments-p2-combat';
import type { CombatState } from '../src/simulation/combat-types';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import type { MatchState } from '../src/simulation/match-types';
import { voidFixture } from './augment-pool-batch5-g4-helpers';
import { augmentPool, voidSwarmPortals, ROUNDS } from './fixtures/m5/oracle.g2.cjs';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { deployMatchUnit, startMatchCombat } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';

function publicVoidSwarm() {
  // Real first-node draw in the authorized 0..100 range; no scripted offers.
  const open=reachRound('2-1',false,53);
  expect(open.pendingChoice!.offers).toContain('void-swarm');
  return resolveM5Choices(open,['void-swarm']);
}

it('B5-73 solo running combat preserves the exact pre-fix history order and save bytes', () => {
  let state=publicVoidSwarm();
  const hero=state.preparation.units.find(u=>u.team==='player')!;
  state=accepted(deployMatchUnit(state,hero.id,{kind:'board',cell:{col:3,row:4}}));
  const started=accepted(startMatchCombat(state));
  expect(started.phase).toBe('combat');
  expect(started.combat).toMatchObject({status:'running',tick:0});
  expect(started.augmentHistory!.facts.slice(state.augmentHistory!.facts.length)
    .map(f=>({kind:f.kind,sequence:f.sequence}))).toEqual([
      {kind:'combat-roster',sequence:3},{kind:'pvp-roster',sequence:4},{kind:'deaths',sequence:5},
    ]);
  // Independently exported with 97068956's unmodified match.ts and these same
  // public commands. Hash the entire serialization, including history sequences.
  // v25 identity-only refresh and reverse-substitution proof: docs/V25_STARRY_PINS.md.
  const save=serializeMatch(started);
  expect(createHash('sha256').update(save).digest('hex'))
    .toBe('8dedd86620e10240b954970b1f2c544e9dc8275ab65c5c5a2bb59c889bd8178d');
  expect(restoreMatch(save)).toEqual(started);
});

it('B5-73 solo tick-zero concession records one PvP roster before settlement and restores', () => {
  const state=emptyBoard(publicVoidSwarm());
  const settled=accepted(startMatchCombat(state));
  expect(settled.phase).toBe('settlement');
  expect(settled.combat).toMatchObject({status:'finished',tick:0});
  const rosters=settled.augmentHistory!.facts.filter(f=>f.kind==='pvp-roster'&&f.round===state.round);
  expect(rosters).toHaveLength(1);
  expect(rosters[0]).toMatchObject({battleId:'round-4',seats:[{units:state.preparation.units.filter(u=>u.team==='player')}]});
  expect(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')).toEqual([]);
  expect(settled.roundResults.filter(r=>r.round===state.round)).toHaveLength(1);
  expect(restoreMatch(serializeMatch(settled))).toEqual(settled);
});

const ARCHIVE = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(ARCHIVE))('B5-73 uses the standard 14.24 values rather than Hyper Roll or S14', () => {
  const row = JSON.parse(readFileSync(ARCHIVE,'utf8')).find((r: any) => r.apiName === 'TFT_Augment_Voidborne');
  expect(AUGMENT_BATCH5_G4['void-swarm'].source.values).toEqual(row.effects);
});
it('B5-73 respects both 14.24 later-node bans and the independent oracle pool', () => {
  for (const node of ['2-1','3-2','4-2']) {
    expect(augmentCandidates('prismatic',[],[],null,{node,fieldedTraits:['visionary'],blocked:[]}).includes('void-swarm')).toBe(node === '2-1');
    expect(augmentPool('prismatic',[],[],`round:${node}:augment`,['visionary']).includes('void-swarm')).toBe(node === '2-1');
  }
});
it.each([
  ['2-1',1000,80],['3-1',1500,80],['4-1',2000,115],['5-1',2500,150],['6-1',3000,180],['overtime',3000,180],
] as const)('B5-73 %s has the approved stage totals and opens in front of the holder', (roundId, hp, ad) => {
  const round = roundId === 'overtime' ? ROUNDS.length+1 : ROUNDS.find(r => r.roundId === roundId)!.ordinal;
  const fixtureRound=roundId==='overtime'?ROUNDS.find(r=>r.roundId==='6-1')!.ordinal:round;
  const { initial, strategy, state } = voidFixture(fixtureRound,['void-swarm'],1);
  const compiled=b5PortalEffects({round,augments:state.augments},'TFT5_Item_ZzRotPortalRadiant',[]);
  expect(compiled).toEqual([{kind:'mechanic',mechanic:'b5VoidPortal',values:{health:hp,attack:ad}}]);
  expect(strategy.units.some(u => u.itemSummon?.kind === 'voidspawn')).toBe(false);
  const big = initial.state.units.find(u => u.itemSummon?.kind === 'voidspawn')!; expect(big).toBeDefined();
  expect(big).toMatchObject({ maxHp:hp, hp, attackDamage:ad, attackRange:1, armor:30, magicResist:30,
    baseAttackSpeedBps:8000, attackSpeedBonusBps:4000, attackIntervalTicks:18, maxMana:0, mana:0, cell:{col:3,row:3} });
  expect(b5VoidSwarmVamp(big as S13Unit)).toMatchObject([{bps:4000,allyBps:0}]);
  expect(initial.events.filter(e => e.type === 'unitSpawned' && e.unitId === big.id)).toHaveLength(1);
  expect(applyCombatStart(initial.state)).toEqual({state:initial.state,events:[]});
});
it('B5-73 taunts only enemies within two hexes, retains the target, and releases a dead/absent target', () => {
  const f=voidFixture(4,['void-swarm'],1), initial=f.initial;
  const units=structuredClone(initial.state.units.filter(u=>!u.itemSummon)) as S13Unit[];
  units.push({...structuredClone(units.find(u=>u.id==='enemy')!),id:'far',cell:{col:0,row:0},voidSwarmTaunt:undefined,targetId:null});
  startB5VoidSwarm({...f.ctx,tick:0,units}, {...initial.state,units});
  const big = units.find(u => u.itemSummon?.kind === 'voidspawn')!, enemy = units.find(u => u.id === 'enemy')!;
  expect(hexDistance(enemy.cell,big.cell)).toBeLessThanOrEqual(2);
  expect(enemy.voidSwarmTaunt).toBe(big.id); expect(p2Target(enemy,units,1)?.id).toBe(big.id);
  expect(units.find(u => u.id === 'rell')!.voidSwarmTaunt).toBeUndefined();
  expect(units.find(u=>u.id==='far')!.voidSwarmTaunt).toBeUndefined();
  big.alive = false; big.hp = 0;
  expect(b5VoidSwarmTarget(enemy,units,2)).toBeUndefined(); expect(enemy.voidSwarmTaunt).toBeUndefined();
  expect(p2Target(enemy,units,2)?.id).not.toBe(big.id);
});
it('B5-73 two portals reserve different empty cells; a completely full board gets no portal summon', () => {
  const f = voidFixture(4,['void-swarm'],2), bodies = f.initial.state.units.filter(u => u.itemSummon?.kind === 'voidspawn');
  expect(bodies).toHaveLength(2); expect(new Set(bodies.map(u => `${u.cell.col},${u.cell.row}`)).size).toBe(2);
  const holder = f.state.preparation.units[0];
  const full = { ...f.state.preparation, units:Array.from({length:56},(_,i)=>({...holder,id:i===31?'rell':`block-${i}`,location:{kind:'board' as const,cell:{col:i%7,row:Math.floor(i/7)}}})) };
  // Rebind the portal declaration to the real holder; all 56 cells remain occupied.
  const strategy = {...f.strategy,units:full.units.map(u=>({...f.strategy.units.find(x=>x.unitId==='rell')!,unitId:u.id,
    mechanics:u.id==='rell'?f.strategy.units.find(x=>x.unitId==='rell')!.mechanics:[],sources:[],triggers:[]}))};
  const combat = createCombatWithEvents(full,strategy,'full-board',17);
  expect(combat.state.units.filter(u=>u.itemSummon?.kind==='voidspawn')).toHaveLength(0);
});
it('B5-73 grants the same 40% AS and omnivamp to small Visionary voidlings, with real healing', () => {
  const { ctx, initial, rell } = voidFixture(4,['voidcaller','void-swarm']), counters:B5VoidcallerCounter[] = [], births:B5VoidlingBirth[] = [];
  castB5Voidcaller(ctx,rell,275,counters,births); spawnB5Voidlings(ctx,initial.state,births,counters);
  const small = ctx.units.find(u=>u.definitionId==='b5-voidling')!;
  expect(small).toMatchObject({maxHp:400,attackDamage:60,baseAttackSpeedBps:8000,attackSpeedBonusBps:4000,attackIntervalTicks:18});
  expect(b5VoidSwarmVamp(small)).toMatchObject([{bps:4000,allyBps:0}]);
  expect(b5VoidSwarmVamp(rell)).toEqual([]);
  small.hp -= 100;
  let combat: CombatState = {...initial.state,units:ctx.units}; let healed = false;
  for(let i=0;i<50&&combat.status==='running';i++){
    const next=stepCombat(combat);combat=next.state;
    healed ||= next.events.some(e=>e.type==='heal'&&e.outcome.targetId===small.id&&e.outcome.actual>0);
  }
  expect(healed).toBe(true);
});
it('B5-73 periodic rewards are independently derived from completed PvP history, never receipt counters', () => {
  const {state:base}=voidFixture(4,['void-swarm']);
  const rounds=[...ROUNDS,...Array.from({length:12},(_,i)=>({roundId:`overtime-${i+1}`,ordinal:ROUNDS.length+i+1,kind:'pvp'}))];
  for(const n of [0,10,11,21,22]){
    const pvp=rounds.filter(r=>r.ordinal>=4&&r.kind==='pvp').slice(0,n);
    const completed=rounds.filter(r=>r.ordinal>=4&&r.ordinal<=(pvp.at(-1)?.ordinal??3));
    const s={...base,round:pvp.at(-1)?.ordinal??4,roundResults:completed.map(r=>({round:r.ordinal,roundKind:r.kind})),
      augmentHistory:{facts:pvp.map(r=>({kind:'pvp-roster',round:r.ordinal}))}} as unknown as MatchState;
    const plan=batch1GiftPlan(s);
    expect(plan).toHaveLength(voidSwarmPortals(s.roundResults,4));
    expect(plan.map(g=>({...g,source:'augment-pool-batch1',starLevel:g.starLevel??1}))).toEqual(rewardPlan(s,{ROUNDS}).gifts);
    expect(b5VoidSwarmGiftPlan(s)).toHaveLength(Math.floor(n/11));
    expect(new Set(plan.map(g=>g.receiptId)).size).toBe(plan.length);
  }
  const missing={...base,roundResults:[{round:4,roundKind:'pvp'}],augmentHistory:{facts:[]}} as unknown as MatchState;
  expect(()=>b5VoidSwarmGiftPlan(missing)).toThrow(/missing pvp-roster/);
});
it('B5-73 opening stats, taunt targets, attack speed and omnivamp declarations all require exact replay', () => {
  const {initial,basis,strategy}=voidFixture(4,['void-swarm'],1);
  for(const json of [false,true]){
    expect(validateDynamicCombat(initial.state,basis,strategy,json)).toBe(true);
    for(const edit of [
      (s:any)=>{s.units.find((u:any)=>u.itemSummon?.kind==='voidspawn').attackDamage++;},
      (s:any)=>{s.units.find((u:any)=>u.itemSummon?.kind==='voidspawn').attackSpeedBonusBps++;},
      (s:any)=>{s.units.find((u:any)=>u.itemSummon?.kind==='voidspawn').mechanics.find((m:any)=>m.mechanic==='voidSwarm').values.omnivampBps++;},
      (s:any)=>{delete s.units.find((u:any)=>u.id==='enemy').voidSwarmTaunt;},
      (s:any)=>{s.units=s.units.filter((u:any)=>u.itemSummon?.kind!=='voidspawn');},
    ]){const bad=json?JSON.parse(JSON.stringify(initial.state)):structuredClone(initial.state);edit(bad);expect(()=>validateDynamicCombat(bad,basis,strategy,json)).toThrow();}
  }
});
