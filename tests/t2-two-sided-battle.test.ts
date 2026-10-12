import { describe, expect, it } from 'vitest';
import {
  createMatch, snapshotForBattle, restorePlayerBattleSnapshot, compileBattle, restoreBattleInput,
  startTwoSidedCombat, startTwoSidedCombatWithEvents, resolveTwoSidedBattle, proposeSettlement,
  stepCombat, restoreMatch, type MatchState, type PlayerBattleSnapshot, type BattleInput,
} from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { planTemporaryEquipment } from '../src/simulation/temporary-equipment';
import { getUnitStats } from '../src/simulation/unit-stats';
import type { Unit } from '../src/simulation/unit-types';
import { freeze } from './combat-helpers';

const hero = (definitionId: string, id = 'unit-1', starLevel: 1|2|3 = 1, col = 3, row = 4): Unit =>
  ({ id, definitionId, starLevel, team:'player', location:{kind:'board',cell:{col,row}} });
// Legal combat assets only; deliberately not a fabricated restoreable Match history.
function seat(units: readonly Unit[], extra: Partial<MatchState> = {}, seed = 42): MatchState {
  const base = createMatch(seed), round = getCatalogRoundById('2-1');
  return {...base, round:round.ordinal, roundDefinitionId:round.roundId, m8:{...base.m8,round},
    level:9, preparation:{...base.preparation,units}, ...extra} as MatchState;
}
const snap = (units: readonly Unit[], seatId: string, extra: Partial<MatchState> = {}) => snapshotForBattle(seat(units,extra),seatId);
const input = (a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, seed = 42) => compileBattle(a,b,seed,{battleId:'match-7:round-2-1:pair-0'});
const run = (a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, seed = 42) => resolveTwoSidedBattle(input(a,b,seed),1200);
const local = (value: BattleInput, seatId: string, originalId: string, kind = 'unit') => value.mapping.find(m=>m.seatId === seatId && m.originalId === originalId && m.kind === kind)!.combatId;

describe('T2 true two-sided combat', () => {
  it('hand oracle: 3-star Maddie defeats 1-star Maddie in four simultaneous basic attacks', () => {
    // Frozen content: HP 500, AD 50, armor 15, 0.7 attacks/s; 3-star = 324% HP/AD.
    // Seed42 LCG's first 8 words alternate noncrit(A), crit(B). No skill reaches 120 mana.
    // A hit floor(162*100/115)=140; B crit floor(50*1.4*100/115)=60.
    // Four attacks at ticks 1,30,59,88: B loses 560 HP; A has 1620-240=1380 HP.
    const a = snap([hero('maddie','unit-1',3)],'A'), b = snap([hero('maddie')],'B');
    const result = run(a,b);
    expect(result.winnerSeatId).toBe('A');
    expect(result.terminal.tick).toBe(88);
    expect(result.a.survivors).toEqual([{unitId:'unit-1',definitionId:'maddie',starLevel:3,hp:1380}]);
    expect(result.b.survivors).toEqual([]);
    expect(result.terminal.rngDraws).toBe(8);
    const proposal = proposeSettlement(result);
    expect(proposal.a).toMatchObject({seatId:'A',result:'win',damage:0});
    expect(proposal.b).toMatchObject({seatId:'B',result:'loss',baseDamage:2,opposingSurvivors:1,damage:3});
    expect(proposal.a.events).toBe(proposal.b.events);
  });

  it('a fixed two-star A wins against one-star B and loses against three-star B', () => {
    // Identical hero/ability, but HP and AD scale 100/180/324%; assert actual expected winners.
    const a = snap([hero('maddie','unit-1',2)],'A');
    expect(run(a,snap([hero('maddie')],'B')).winnerSeatId).toBe('A');
    expect(run(a,snap([hero('maddie','unit-1',3)],'B')).winnerSeatId).toBe('B');
  });

  it.each([['2-1',2],['3-1',5],['4-1',8],['5-1',10],['6-1',12]] as const)(
    'round %s uses frozen stage base %i, adds opposing survivors, and leaves the winner at zero', (roundId,baseDamage) => {
      const a = {...snap([],'A'),roundId}, b = {...snap([hero('maddie')],'B'),roundId};
      const proposal = proposeSettlement(run(a,b));
      expect(proposal.a.damage).toBe(baseDamage + 1);
      expect(proposal.b.damage).toBe(0);
      expect(proposal.a.baseDamage).toBe(baseDamage);
    });

  it('descriptor permutations are canonical and only the explicit seed initializes combat RNG', () => {
    const a = snap([hero('maddie','unit-1'),hero('irelia','unit-2',1,2,4)],'A');
    const b = snap([hero('maddie')],'B');
    expect(input({...a,units:[...a.units].reverse()},b)).toEqual(input(a,b));
    const zero = startTwoSidedCombat(input(a,b,0)), last = startTwoSidedCombat(input(a,b,0xffffffff));
    expect(zero.rngState).toBe(0); expect(last.rngState).toBe(0xffffffff);
    expect(zero.rngDraws).toBe(0); expect(last.rngDraws).toBe(0);
    const punctuated = input({...a,seatId:'A",item:['},{...b,seatId:'A'});
    expect(new Set(punctuated.mapping.map(m=>m.combatId)).size).toBe(punctuated.mapping.length);
  });

  it('all five effect classes work on BOTH sides with colliding original unit/item/choice IDs', () => {
    const units = [hero('tristana','unit-1',1,3,7),hero('irelia','unit-2',1,2,4),hero('leona','unit-3',1,4,4)];
    const effects: Partial<MatchState> = {
      items:[{id:'item-1',definitionId:'rod',location:{kind:'unit',unitId:'unit-1',slot:0}}],
      augments:[{definitionId:'pumping-up-i',choiceId:'same-choice',acquiredRound:4}],
      augmentProgress:{pumpingRounds:2,investmentHp:0},
      anomalyBinding:{definitionId:'mage-armor',choiceId:'same-choice',unitId:'unit-1',boundRound:4},
      persistentGrowth:[{unitId:'unit-1',attackDamageBps:2500}],
    };
    const battle = input(snap(units,'A',effects),snap(units,'B',effects));
    const started = startTwoSidedCombat(battle);
    for (const seatId of ['A','B']) {
      const id = local(battle,seatId,'unit-1'), unit = started.units.find(u=>u.id === id)!;
      // Rod AP=110; Sentinel2 team armor12; MageArmor floor(110/2)=55; base20 =>87.
      expect(unit.abilityPower).toBe(110);
      expect(unit.armor).toBe(87);
      expect(unit.attackDamage).toBe(52); // floor(42 * 1.25)
      expect(unit.attackSpeedBonusBps).toBe(700); // 600 + 2*50 from pumping progress.
      expect(unit.sources!.filter(s=>s.source.sourceKind === 'item')[0].source.sourceInstanceId).toBe(local(battle,seatId,'item-1','item'));
      expect(new Set(unit.sources!.map(s=>s.source.sourceKind))).toEqual(new Set(['trait','item','augment','anomaly','ability']));
      expect(unit.sources!.every(s=>s.source.ownerId === id)).toBe(true);
      expect(unit.cell).toEqual({col:3,row:seatId === 'A' ? 7 : 0});
      const irelia = started.units.find(u=>u.id === local(battle,seatId,'unit-2'))!;
      expect(irelia.armor).toBe(76); // base40 + team12 + member24.
    }
    expect(new Set(battle.mapping.map(m=>m.combatId)).size).toBe(battle.mapping.length);
    expect(new Set(started.units.flatMap(u=>u.sources!.map(s=>s.key))).size).toBe(started.units.flatMap(u=>u.sources!).length);
    expect(resolveTwoSidedBattle(battle,1200).events.length).toBeGreaterThan(0);
  });

  it('back-row augments and buddy targets use each owner roster before the B row mirror', () => {
    const units = [hero('maddie','unit-1',1,3,7),hero('maddie','unit-2',1,4,7),hero('irelia','unit-3',1,0,4)];
    const effects: Partial<MatchState> = {augments:[
      {definitionId:'glass-cannon-i',choiceId:'glass',acquiredRound:4},
      {definitionId:'bulky-buddies-i',choiceId:'buddy',acquiredRound:4},
    ]};
    const battle = input(snap(units,'A',effects),snap(units,'B',effects)), started = startTwoSidedCombat(battle);
    for (const seatId of ['A','B']) {
      const unit = started.units.find(u=>u.id === local(battle,seatId,'unit-1'))!;
      expect(unit.maxHp).toBe(600); expect(unit.hp).toBe(480);
      expect(unit.mechanics!.find(m=>m.mechanic === 'bulkyBuddies')!.targetId).toBe(local(battle,seatId,'unit-2'));
      const front = started.units.find(u=>u.id === local(battle,seatId,'unit-3'))!;
      expect(front.hp).toBe(front.maxHp);
    }
  });

  it('temporary equipment and item programs preserve both holder and parent ownership', () => {
    const equipped = planTemporaryEquipment(seat([hero('tristana')],{
      items:[{id:'item-1',definitionId:'thiefs-gloves',location:{kind:'unit',unitId:'unit-1',slot:0}}],
    })).state;
    const a = snapshotForBattle(equipped,'A'), b = snapshotForBattle(equipped,'B');
    const battle = input(a,b), initial = startTwoSidedCombat(battle);
    for (const seatId of ['A','B']) {
      const unit = initial.units.find(u=>u.id === local(battle,seatId,'unit-1'))!;
      const childSources = unit.sources!.filter(s=>s.source.parentItemInstanceId);
      expect(childSources.length).toBeGreaterThan(0);
      expect(childSources.every(s=>s.source.parentItemInstanceId === local(battle,seatId,'item-1','item'))).toBe(true);
      for (const program of unit.itemPrograms ?? []) expect(program.source.ownerId).toBe(unit.id);
    }
    expect(resolveTwoSidedBattle(battle,1200).winnerSeatId).not.toBeUndefined();
  });

  it('empty sides end at tick zero, both empty draw, and repeat proposals never mutate assets', () => {
    const empty = snap([],'A'), nonempty = snap([hero('maddie')],'B');
    const one = run(empty,nonempty);
    expect(one.winnerSeatId).toBe('B'); expect(one.terminal.tick).toBe(0);
    expect(one.events).toHaveLength(1); expect(one.events[0].type).toBe('combatFinished');
    const both = run(empty,snap([],'B'));
    expect(both.winnerSeatId).toBeNull(); expect(both.terminal.tick).toBe(0);
    expect(proposeSettlement(both).a.damage).toBe(2); expect(proposeSettlement(both).b.damage).toBe(2);
    const before = JSON.stringify(both);
    expect(proposeSettlement(both)).toEqual(proposeSettlement(both));
    expect(JSON.stringify(both)).toBe(before);
  });

  it('real equipped tanks reach the unchanged 1200-tick limit; budget exhaustion is not a draw', () => {
    const tanks = (seatId: string) => snap([hero('leona','unit-1',3)],seatId,{
      items:['warmog','dragons-claw','gargoyle'].map((definitionId,slot)=>({id:`item-${slot+1}`,definitionId,location:{kind:'unit' as const,unitId:'unit-1',slot}})),
    });
    const battle = input(tanks('A'),tanks('B'));
    expect(()=>resolveTwoSidedBattle(battle,1)).toThrow('step-limit-exceeded');
    const result = resolveTwoSidedBattle(battle,1200);
    expect(result.terminal.tick).toBe(1200); expect(result.winnerSeatId).toBeNull();
    expect(result.a.survivors).toHaveLength(1); expect(result.b.survivors).toHaveLength(1);
    expect(result.events.at(-1)).toMatchObject({type:'combatFinished',reason:'timeout'});
    expect(proposeSettlement(result).a.damage).toBe(3); expect(proposeSettlement(result).b.damage).toBe(3);
  });

  it('growth deltas belong to the correct original seat and survive swapping a/b', () => {
    const strong = snap([hero('tristana','unit-1',3)],'grow',{
      persistentGrowth:[{unitId:'unit-1',attackDamageBps:500}],
      items:[{id:'item-1',definitionId:'shojin',location:{kind:'unit',unitId:'unit-1',slot:0}}],
    });
    const victims = snap([hero('maddie','unit-1',1,2,4),hero('maddie','unit-2',1,4,4),hero('maddie','unit-3',1,3,5)],'other');
    for (const [a,b] of [[strong,victims],[victims,strong]]) {
      const result = run(a,b), grow = result.a.seatId === 'grow' ? result.a : result.b;
      const other = result.a.seatId === 'grow' ? result.b : result.a;
      expect(grow.growth.length).toBeGreaterThan(0);
      expect(grow.growth.every(g=>g.unitId === 'unit-1' && g.attackDamageBps % 125 === 0)).toBe(true);
      expect(other.growth).toEqual([]);
      const growthEvents = result.events.filter(e=>e.type === 'growth');
      expect(grow.growth[0].attackDamageBps).toBe(growthEvents.reduce((sum,e)=>sum + (e.type === 'growth' ? e.amountBps : 0),0));
      expect(strong.persistentGrowth).toEqual([{unitId:'unit-1',attackDamageBps:500}]);
      const proposals = proposeSettlement(result);
      expect((proposals.a.seatId === 'grow' ? proposals.a : proposals.b).growth).toEqual(grow.growth);
    }
  });

  it('same frozen input and JSON-restored input reproduce every state, event, RNG and result', () => {
    const battle = input(snap([hero('maddie','unit-1',3)],'A'),snap([hero('maddie')],'B'));
    const copy = restoreBattleInput(JSON.stringify(battle));
    expect(resolveTwoSidedBattle(copy,1200)).toEqual(resolveTwoSidedBattle(battle,1200));
    const first = startTwoSidedCombatWithEvents(battle);
    let current = first.state; const events = [...first.events];
    while (current.status === 'running') {
      const next = stepCombat(current); expect(stepCombat(JSON.parse(JSON.stringify(current)))).toEqual(next);
      current = next.state; events.push(...next.events);
    }
    const result = resolveTwoSidedBattle(battle,1200);
    expect(current).toEqual(result.terminal); expect(events).toEqual(result.events);
    expect(events.map(e=>e.eventSeq)).toEqual(events.map((_,i)=>i));
    expect(new Set(events.map(e=>e.combatId))).toEqual(new Set([battle.battleId]));
  });

  it('snapshots omit private/bench fields, remain independent and ignore Match random streams', () => {
    const bench: Unit = {...hero('tristana','unit-2'),location:{kind:'bench',slot:0}};
    const state = seat([hero('maddie'),bench],{
      items:[{id:'item-1',definitionId:'rod',location:{kind:'inventory'}}],
      anomalyBinding:{definitionId:'mage-armor',choiceId:'bench',unitId:'unit-2',boundRound:4},
      persistentGrowth:[{unitId:'unit-2',attackDamageBps:125}],
    });
    const before = JSON.stringify(state), a = snapshotForBattle(freeze(state),'A');
    expect(a.units).toHaveLength(1); expect(a.items).toEqual([]); expect(a.anomalyBinding).toBeNull(); expect(a.persistentGrowth).toEqual([]);
    for (const field of ['shop','gold','rngState','battleSeedRngState','equipmentState']) expect(field in a).toBe(false);
    const different = {...state,seed:99,rngState:123,choiceRngState:456,rewardRngState:789,battleSeedRngState:1,
      equipmentState:{...state.equipmentState,equipment:{state:123,draws:999}}};
    expect(snapshotForBattle(different,'A')).toEqual(a);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects malformed/versioned inputs atomically and keeps old Match restore strict', () => {
    const a = snap([hero('maddie')],'A'), b = snap([hero('maddie')],'B'), battle = input(a,b);
    expect(()=>input(a,a)).toThrow('seat-collision');
    expect(()=>input(a,b,-1)).toThrow('invalid-seed');
    expect(()=>input(a,{...b,version:'future'} as never)).toThrow('snapshot-version');
    expect(()=>input(a,{...b,roundId:'2-2'})).toThrow('round-mismatch');
    expect(()=>input({...a,roundId:'1-2'},{...b,roundId:'1-2'})).toThrow('round-kind');
    expect(()=>restorePlayerBattleSnapshot({...a,gold:1})).toThrow('invalid-snapshot');
    expect(()=>restorePlayerBattleSnapshot({...a,units:[...a.units,...a.units]})).toThrow('invalid-snapshot');
    expect(()=>restorePlayerBattleSnapshot({...a,units:[hero('maddie','unit-1',1,3,0)]})).toThrow('invalid-snapshot');
    expect(()=>restorePlayerBattleSnapshot({...a,contentDigest:'forged'})).toThrow('content-digest');
    const forged = structuredClone(battle);
    (forged.strategy.units[0].stats as {attack:number}).attack++;
    expect(()=>startTwoSidedCombat(forged)).toThrow('battle-input');
    expect(()=>restoreMatch(battle)).toThrow();
    expect(()=>resolveTwoSidedBattle(battle,0)).toThrow('invalid-budget');
    expect(()=>snapshotForBattle({...createMatch(),phase:'combat'} as never,'A')).toThrow('wrong-phase');
    const badBoard = structuredClone(seat([hero('maddie')]));
    (badBoard.preparation.board as {rows:number}).rows = 9;
    expect(()=>snapshotForBattle(badBoard,'A')).toThrow('invalid-snapshot');
    expect(()=>proposeSettlement({...run(a,b),winnerSeatId:'stranger'})).toThrow('invalid-result');
    expect(getUnitStats('maddie',3).attack).toBe(162);
  });
});
