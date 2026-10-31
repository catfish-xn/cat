import { expect, it } from 'vitest';
import { createMatch, deployMatchUnit, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { advanceMadChemist, leaveMadChemistCloud, madChemistMoveInterval, madChemistVamp, moveMadChemist } from '../src/simulation/augment-pool-batch5-r4';
import { isMadChemist } from '../src/simulation/augment-pool-batch5-r4';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { asSource } from '../src/simulation/m8/s13-definitions';
import { executeMechanismEffect } from '../src/simulation/m8/s13-mechanisms';
import { wearing } from './fixtures/m8-b4-items';
import { augmentPool, madChemistExpected } from './fixtures/m5/oracle.g2.cjs';
import { augmentDraw } from './fixtures/m5/oracle.g2.cjs';
import { resolveAugmentTier } from '../src/simulation/augment-offers';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { d11ChoiceDisplay, d11PrivateDisplay } from '../src/simulation/d11-display';

function fixture(starLevel: 1|2|3 = 1): CombatState {
  const base = createMatch(42), unit = base.preparation.units[0];
  const preparation = { ...base.preparation, units: [
    { ...unit, id: 'p', definitionId: 'singed', starLevel, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 3, row: 4 } } },
    { ...unit, id: 'enemy', definitionId: 'training-dummy', starLevel: 3 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 3, row: 3 } } },
  ] };
  return createCombatWithEvents(preparation, buildStrategySnapshot({ ...base, preparation,
    augments: [{ definitionId: 'mad-chemist', choiceId: 'fixture', acquiredRound: 1 }] }), 'b5-67-numbers', 42).state;
}
function context(combat: CombatState): AbilityContext {
  return { tick: 1, board: combat.board, units: structuredClone(combat.units) as S13Unit[], events: [], packets: [], heals: [], manaRequests: [], draw: () => { throw Error('unexpected RNG'); } };
}

it('offers silver B5-67 only at 2-1, with the same independently transcribed pool and exclusions', () => {
  expect(AUGMENT_TIERS['mad-chemist']).toBe('silver');
  expect(AUGMENT_DEFINITIONS['mad-chemist'].name).toBe('炼金术士');
  expect(d11ChoiceDisplay('mad-chemist')).toMatchObject({name:'炼金术士',tier:'silver',description:AUGMENT_DEFINITIONS['mad-chemist'].description});
  expect(d11PrivateDisplay({...createMatch(42),augments:[{definitionId:'mad-chemist',choiceId:'fixture',acquiredRound:1}]})?.definitions)
    .toContainEqual(d11ChoiceDisplay('mad-chemist'));
  for (const node of ['2-1','3-2','4-2']) {
    const filter = { node, fieldedTraits: ['sentinel'], blocked: [] };
    expect(augmentOfferAllowed('mad-chemist', [], filter)).toBe(node === '2-1');
    expect(augmentCandidates('silver', [], [], null, filter).sort()).toEqual(augmentPool('silver', [], [], `round:${node}:augment`, ['sentinel']));
    expect(augmentCandidates('gold', [], [], null, filter)).not.toContain('mad-chemist');
  }
  expect(augmentOfferAllowed('mad-chemist', [{ definitionId: 'blood-brothers', choiceId: 'old', acquiredRound: 1 }], { node: '2-1', fieldedTraits: [], blocked: [] })).toBe(false);
  for(const definitionId of ['blood-brothers','betrayal','geniuses','mentorship','reunion','sisters']){
    const owned=[{definitionId,choiceId:'old',acquiredRound:1}],filter={node:'2-1',fieldedTraits:[],blocked:[]};
    expect(augmentCandidates('silver',owned,[],null,filter).sort()).toEqual(augmentPool('silver',owned,[],'round:2-1:augment'));
    expect(augmentPool('silver',owned,[],'round:2-1:augment')).not.toContain('mad-chemist');
  }
});

it.each([1,2,3] as const)('only the strongest %i-star Singed receives the hero mechanic', star => {
  const base = createMatch(42), u = base.preparation.units[0];
  const units = ['c','b','a'].map((id, i) => ({ ...u, id, definitionId: 'singed', team: 'player' as const,
    starLevel: star, location: { kind: 'board' as const, cell: { col: i, row: 4 } } }));
  const input = { ...base, preparation: { ...base.preparation, units },
    items: [{ id: 'item', definitionId: 'rod', location: { kind: 'unit' as const, unitId: 'b', slot: 0 } }],
    augments: [{ definitionId: 'mad-chemist', choiceId: 'fixture', acquiredRound: 1 }] };
  const marked = (s: typeof input) => buildStrategySnapshot(s).units.filter(u => u.mechanics?.some(m => m.mechanic === 'madChemist')).map(u => u.unitId);
  expect(marked(input)).toEqual(['b']);
  expect(marked({ ...input, items: [] })).toEqual(['a']);
  if (star < 3) expect(marked({ ...input, preparation: { ...input.preparation, units: units.map(u => u.id === 'c' ? { ...u, starLevel: 3 } : u) } })).toEqual(['c']);
});

it.each([1,2,3,4] as const)('splits %i-star poison into exactly ten AP-scaled 10-tick pulses, including the last tick', star => {
  const ctx = context(fixture(Math.min(star,3) as 1|2|3)), p = ctx.units.find(u => u.id === 'p')!;
  p.effectiveStarLevel=star;
  p.hp = 0; p.alive = false; p.abilityPower = 150;
  p.madChemist = { manaRemainder: 0, buffUntilTick: 0, clouds: [{ cell: { col: 3, row: 3 }, expiresAtTick: 2 }], poisons: [] };
  let seq = 0; const hits: { tick: number; raw: number }[] = [];
  for (let tick = 1; tick <= 102; tick++) {
    ctx.tick = tick; ctx.packets = []; advanceMadChemist(ctx, p, () => seq++);
    hits.push(...ctx.packets.map(packet => ({ tick, raw: packet.raw })));
  }
  const expected = madChemistExpected(star, 150, 6000);
  expect(hits.map(h => h.tick)).toEqual([11,21,31,41,51,61,71,81,91,101]);
  expect(hits.map(h => h.raw)).toEqual(expected.pulses);
  expect(hits.reduce((n,h) => n+h.raw, 0)).toBe(expected.total);
  expect(seq).toBe(1); expect(p.madChemist.poisons).toEqual([]);
});

it('runs at the nearest enemy with ID ties, preserves occupancy, and is deterministic under input permutations',()=>{
  const combat=fixture(),ctx=context(combat),p=ctx.units.find(u=>u.id==='p')!,enemy=ctx.units.find(u=>u.id==='enemy')!;
  enemy.id='z';
  const other={...structuredClone(enemy),id:'a',cell:{col:4,row:4}};ctx.units.push(other);
  const occupied=()=>new Set(ctx.units.map(u=>`${u.cell.col}:${u.cell.row}`));
  const path=moveMadChemist(ctx,p,occupied())!;
  expect(path[0]).toEqual(other.cell);expect(occupied().has(`${path.at(-1)!.col}:${path.at(-1)!.row}`)).toBe(false);
  other.cell={col:6,row:0};
  expect(moveMadChemist(ctx,p,occupied())![0]).toEqual(enemy.cell);
  expect(stepCombat({...combat,units:[...combat.units].reverse()})).toEqual(stepCombat(combat));
});

it('refreshes a cell and a single poison, preserves pulse phase, and never hits a neighbouring hex', () => {
  const ctx = context(fixture()), p = ctx.units.find(u => u.id === 'p')!, target = ctx.units.find(u => u.id === 'enemy')!;
  p.alive = false; p.hp = 0;
  ctx.units.push({ ...structuredClone(target), id: 'beside', cell: { col: 4, row: 3 } });
  leaveMadChemistCloud(p, [target.cell, target.cell], 1);
  leaveMadChemistCloud(p, [target.cell], 6);
  expect(p.madChemist!.clouds).toEqual([{ cell: target.cell, expiresAtTick: 66 }]);
  let seq = 0;
  for (let tick=1; tick<=65; tick++) {
    ctx.tick=tick; advanceMadChemist(ctx,p,()=>seq++);
    expect(p.madChemist!.poisons).toHaveLength(1);
    expect(p.madChemist!.poisons[0].nextTick).toBe((Math.floor((tick-1)/10)+1)*10+1);
  }
  expect(seq).toBe(1); expect(p.madChemist!.poisons[0].expiresAtTick).toBe(165);
  expect(ctx.packets.every(p => p.targetId === 'enemy')).toBe(true);
  expect(ctx.packets.map(p => p.raw)).toEqual([14,14,14,14,14,14]);
});

it.each(['invisible', 'untargetable'] as const)('poisons an %s enemy on a cloud while pursuing only selectable enemies', hidden => {
  const ctx = context(fixture()), p = ctx.units.find(u => u.id === 'p')!, target = ctx.units.find(u => u.id === 'enemy')!;
  const visible = { ...structuredClone(target), id: 'visible', cell: { col: 4, row: 4 } };
  ctx.units.push(visible, { ...structuredClone(target), id: 'absent', itemBanish: { ownerId: 'p', itemInstanceId: 'zephyr', untilTick: 200 } });
  if (hidden === 'invisible') target.anomalyState = { invisibleUntilTick: 200 };
  else target.mechanismState = { ...target.mechanismState!, statuses: applyStatusContribution([], effectIdentity('b5-67-hidden', asSource(origin(target)), target.id), {
    kind: 'untargetable', magnitudeBps: 10000, duration: { kind: 'ticks', ticks: 200 }, activation: 'immediate',
    stackPolicy: { kind: 'independent-instances' }, removable: false, polarity: 'beneficial', damageFilter: null, onEnd: null,
  }, 0).groups };
  expect(moveMadChemist(ctx, p, new Set(ctx.units.map(u => `${u.cell.col}:${u.cell.row}`)))![0]).toEqual(visible.cell);
  p.alive = false; p.hp = 0;
  p.madChemist = { manaRemainder: 0, buffUntilTick: 0, clouds: [{ cell: target.cell, expiresAtTick: 2 }], poisons: [] };
  advanceMadChemist(ctx, p, () => 0);
  expect(p.madChemist.poisons.map(poison => poison.targetId)).toEqual(['enemy']);
  for (let tick = 2; tick <= 11; tick++) { ctx.tick = tick; advanceMadChemist(ctx, p, () => 0); }
  expect(ctx.packets).toHaveLength(1);
  expect(ctx.packets[0]).toMatchObject({ targetId: 'enemy', raw: 14, delivery: 'ability-periodic' });
});

it('Edge of Night cleanses the attached poison at tick 11, so it cannot damage again after prevention expires', () => {
  const initial = fixture(), holder = wearing('edge-of-night', { hp: 600, maxMana: 0, cooldownTicks: 1000, moveCooldownTicks: 1000 });
  const chemist = { ...initial.units.find(u => u.id === 'p')!, id: 'chemist', team: 'enemy' as const, moveCooldownTicks: 1000,
    madChemist: { manaRemainder: 0, buffUntilTick: 0, clouds: [{ cell: holder.cell, expiresAtTick: 2 }], poisons: [] } };
  let combat: CombatState = { ...initial, units: [chemist, holder] }, afterCleanse: CombatState | undefined;
  const events: CombatEvent[] = [];
  for (let tick = 1; tick <= 41; tick++) {
    const result = stepCombat(combat); combat = result.state; events.push(...result.events);
    if (tick === 10) expect(combat.units.find(u => u.id === 'chemist')!.madChemist!.poisons).toHaveLength(1);
    if (tick === 11) {
      expect(result.events.some(e => e.type === 'statusChanged' && e.reason === 'applied'
        && e.group.kind === 'damage-prevention' && e.group.contributions.some(c => c.source.definitionId === 'edge-of-night'))).toBe(true);
      expect(combat.units.find(u => u.id === 'chemist')!.madChemist!.clouds.some(c => c.cell.col === holder.cell.col && c.cell.row === holder.cell.row)).toBe(false);
      afterCleanse = combat;
    }
  }
  const hits = events.filter(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === 'chemist');
  expect(hits.filter(e => e.type === 'packetDamage' && e.outcome.hpDamage > 0).map(e => e.tick)).toEqual([11]);
  expect(hits.map(e => e.tick)).toEqual([11]);
  expect(afterCleanse!.units.find(u => u.id === 'chemist')!.madChemist!.poisons).toEqual([]);
  expect(combat.units.find(u => u.id === 'p')!.hp).toBe(586);
});

it('cleanses poison from a dead source without clearing other targets or clouds; later contact starts a fresh pulse phase', () => {
  const ctx = context(fixture()), p = ctx.units.find(u => u.id === 'p')!, target = ctx.units.find(u => u.id === 'enemy')!;
  const other = { ...structuredClone(target), id: 'other', cell: { col: 4, row: 3 } };
  ctx.units.push(other); p.alive = false; p.hp = 0;
  leaveMadChemistCloud(p, [target.cell, other.cell], 1);
  let seq = 0; advanceMadChemist(ctx, p, () => seq++);
  expect(p.madChemist!.poisons.map(poison => poison.targetId)).toEqual(['enemy', 'other']);
  const clouds = structuredClone(p.madChemist!.clouds), cell = target.cell;
  ctx.tick = 2;
  executeMechanismEffect(ctx, target, asSource(origin(target)), target, { kind: 'cleanse', remove: 'removable-hostile-control-dot-debuff', retarget: true }, 2, 0);
  expect(p.madChemist!.poisons.map(poison => poison.targetId)).toEqual(['other']);
  expect(p.madChemist!.clouds).toEqual(clouds);
  target.cell = { col: 0, row: 0 };
  for (let tick = 3; tick <= 11; tick++) { ctx.tick = tick; advanceMadChemist(ctx, p, () => seq++); }
  expect(ctx.packets.map(packet => packet.targetId)).toEqual(['other']);
  target.cell = cell; ctx.tick = 12; ctx.packets = []; advanceMadChemist(ctx, p, () => seq++);
  expect(p.madChemist!.poisons.find(poison => poison.targetId === target.id)).toMatchObject({ nextTick: 22, ordinal: 0 });
  for (let tick = 13; tick <= 22; tick++) { ctx.tick = tick; advanceMadChemist(ctx, p, () => seq++); }
  expect(ctx.packets.filter(packet => packet.targetId === target.id)).toMatchObject([{ raw: 14, ordinal: 0 }]);
  expect(seq).toBe(3);
});

it.each([0,10000,100000])('regenerates exactly 10 × current AS with %i bonus bps; fractional ticks and lock do not create catch-up mana', bonus => {
  const ctx=context(fixture()), p=ctx.units.find(u=>u.id==='p')!;
  p.attackSpeedBonusBps=bonus;ctx.units.find(u=>u.id==='enemy')!.cell={col:0,row:0};
  for(let tick=1;tick<=20;tick++){ctx.tick=tick;advanceMadChemist(ctx,p,()=>0);}
  expect(ctx.manaRequests!.reduce((n,r)=>n+r.amount,0)).toBe(madChemistExpected(1,100,6000*(1+bonus/10000)).mana);
  const count=ctx.manaRequests!.length, remainder=p.madChemist!.manaRemainder;
  p.manaLockedUntilTick=41;
  for(let tick=21;tick<=40;tick++){ctx.tick=tick;advanceMadChemist(ctx,p,()=>0);}
  expect(ctx.manaRequests).toHaveLength(count);expect(p.madChemist!.manaRemainder).toBe(remainder);
});

it('runs through the nearest enemy, never attacks, self-casts and uses the four-second vamp/movement effect', () => {
  let combat=fixture();let damage=0, casts=0, mana=0, heals=0;
  combat={...combat,units:combat.units.map(u=>u.id==='p'?{...u,hp:u.hp-100}:u)};
  for(let tick=1;tick<=300&&combat.status==='running';tick++){
    const checkpoint=combat, before=structuredClone(combat), result=stepCombat(combat);combat=result.state;
    expect(checkpoint).toEqual(before); // Stepping did not mutate the previous checkpoint.
    expect(result.events.some(e=>e.type==='attack'&&e.attackerId==='p')).toBe(false);
    for(const event of result.events){
      if(event.type==='packetDamage'&&event.outcome.context.source.ownerId==='p') { damage++;expect(event.outcome.context.delivery).toBe('ability-periodic');expect(event.outcome.raw).toBe(14); }
      if(event.type==='manaChanged'&&'outcome' in event&&event.outcome.source.ownerId==='p'&&event.outcome.reason==='periodic')mana+=event.outcome.applied;
      if(event.type==='heal'&&event.outcome.shares.some(s=>s.source.ownerId==='p')){
        heals++;expect(event.outcome.requested).toBe(2);expect(event.outcome.actual).toBe(2);
        expect(combat.units.find(u=>u.id==='p')!.madChemist!.buffUntilTick).toBeGreaterThan(combat.tick);
      }
      if(event.type==='cast'&&'receipt' in event&&event.receipt.source.ownerId==='p'){
        casts++;expect(event.receipt.targetIds).toEqual(['p']);
        const p=combat.units.find(u=>u.id==='p')! as S13Unit;
        expect(p.madChemist!.buffUntilTick).toBe(combat.tick+80);
        expect(madChemistVamp(p,combat.tick)[0].bps).toBe(2000);
        expect(madChemistVamp(p,p.madChemist!.buffUntilTick)).toEqual([]);
        expect(madChemistMoveInterval(p,combat.tick)).toBeLessThan(madChemistMoveInterval(p,p.madChemist!.buffUntilTick));
        expect(p.tasks.some(t=>t.kind==='g2SingedSpeed')).toBe(false);
        expect(p.statuses.some(s=>s.kind==='damageReduction'||s.kind==='attackSpeed')).toBe(false);
      }
    }
  }
  expect(damage).toBeGreaterThan(10);expect(casts).toBeGreaterThan(0);expect(mana).toBeGreaterThanOrEqual(50);expect(heals).toBeGreaterThan(0);
  expect(isMadChemist(combat.units.find(u=>u.id==='p')!)).toBe(true);
});

it('keeps the solo command path valid and authenticates active poison/mana/movement saves by full replay',()=>{
  const seed=Array.from({length:101},(_,i)=>i).find(seed=>{
    const s=createMatch(seed),tier=resolveAugmentTier(s,'round:2-1:augment');
    return augmentDraw(s.choiceRngState,tier,[],[],'round:2-1:augment').offers.includes('mad-chemist');
  });
  expect(seed).toBeDefined();
  let match=reachRound('2-1',false,seed!),choice=match.pendingChoice!;
  expect(choice.offers).toContain('mad-chemist');
  match=resolveM5Choices(accepted(selectChoice(match,choice.choiceId,choice.generation,'mad-chemist')));
  // v26 PvE loot carryover (8f794062, merge c684c3ec) keeps the conceded 1-x loot units, so fieldBench filled the
  // three-unit cap before reaching the gifted Singed (board irelia/sett/urgot, no Mad Chemist at all). Field the
  // gifted Singed first through the public deploy command, then fill the rest as before.
  const singed=match.preparation.units.find(u=>u.team==='player'&&u.definitionId==='singed'&&u.location.kind==='bench')!;
  match=fieldBench(accepted(deployMatchUnit(match,singed.id,{kind:'board',cell:{col:3,row:4}})));
  expect(match.preparation.units.some(u=>u.definitionId==='singed'&&u.location.kind==='board')).toBe(true);
  match=accepted(startMatchCombat(match));
  for(let tick=0;tick<100&&match.phase==='combat'&&!match.combat!.units.some(u=>u.madChemist?.poisons.length);tick++)match=stepMatch(match).state;
  expect(match.combat!.units.some(u=>u.madChemist?.poisons.length)).toBe(true);
  const text=serializeMatch(match);
  for(const input of [match,JSON.parse(text),text])expect(restoreMatch(input)).toEqual(match);
  const mutations:((s:any)=>void)[]=[
    s=>{s.combat.units.find((u:any)=>u.madChemist).madChemist.manaRemainder++;},
    s=>{s.combat.units.find((u:any)=>u.madChemist).madChemist.buffUntilTick++;},
    s=>{s.combat.units.find((u:any)=>u.madChemist).madChemist.clouds[0].expiresAtTick++;},
    s=>{s.combat.units.find((u:any)=>u.madChemist).madChemist.clouds[0].cell.col=(s.combat.units.find((u:any)=>u.madChemist).madChemist.clouds[0].cell.col+1)%7;},
    s=>{s.combat.units.find((u:any)=>u.madChemist).madChemist.poisons[0].totalDamage++;},
    s=>{s.combat.units.find((u:any)=>u.madChemist).madChemist.poisons[0].nextTick++;},
    s=>{s.combat.units.find((u:any)=>u.madChemist).madChemist.poisons[0].ordinal++;},
    s=>{delete s.combat.units.find((u:any)=>u.madChemist).madChemist;},
    s=>{s.combatInputBasis.inputs.augments.find((a:any)=>a.definitionId==='mad-chemist').acquiredRound++;},
  ];
  for(const mutate of mutations){const bad=JSON.parse(text);mutate(bad);expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();expect(()=>serializeMatch(bad)).toThrow();}
  const next=stepMatch(match);expect(stepMatch(restoreMatch(text))).toEqual(next);
});
