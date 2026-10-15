import { beforeAll, describe, expect, it } from 'vitest';
import { snapshotForBattle, compileBattle, resolveTwoSidedBattle, toCombatReplay, toCombatViewEvents,
  summarizeBattle, startMatchCombat, stepCombat, type CombatReplayInput, type CombatState, type LedgerCombatEvent } from '../src/server-entry';
import { mirrorCombatReplay } from '../src/server/room/projection';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { makeHealRequest, resolveHeal } from '../src/simulation/m8/heal';
import { catalogPreparation } from './t5r-helpers';
import { freeze } from './combat-helpers';

function pvp(seed: number, mirror = false) {
  const base = catalogPreparation('2-1', seed);
  const state = {...base, level:9, preparation:{...base.preparation,units:
    ['irelia','leona','tristana','maddie','lux','darius'].map((definitionId,i)=>({
      id:`unit-${i+1}`,definitionId,team:'player' as const,starLevel:1 as const,
      location:{kind:'board' as const,cell:{col:i,row:i<2?4:7}}}))},
    items:[{id:'item-1',definitionId:'bloodthirster',location:{kind:'unit' as const,unitId:'unit-1',slot:0 as const}}]};
  return resolveTwoSidedBattle(compileBattle(snapshotForBattle(state,'A'), snapshotForBattle(state,'B'),seed,
    {battleId:'g5',...(mirror?{mirrorOfSeatId:'B'}:{})}),1201);
}
function wolves(): CombatReplayInput {
  const start = startMatchCombat(catalogPreparation('3-7',43));
  if (!start.ok || !start.state.combat) throw new Error('start');
  const initial = start.state.combat;
  let terminal: CombatState = initial;
  const events = start.events.filter((e):e is LedgerCombatEvent => e.domain === 'combat');
  while (terminal.status === 'running') {
    const next = stepCombat(terminal); terminal = next.state; events.push(...toLedgerEvents(next.events));
  }
  return {initial,terminal,events};
}
/** Independent oracle: select/filter the full ledger separately for each unit, never view events. */
function ledgerSummary(battle: CombatReplayInput) {
  return battle.initial.units.map(unit => {
    const damage = battle.events.filter(e => e.type === 'packetDamage');
    const heals = battle.events.filter(e => e.type === 'heal');
    const incoming = damage.filter(e => e.outcome.context.targetId === unit.id);
    return { unitId:unit.id, definitionId:unit.definitionId, team:unit.team, starLevel:unit.starLevel,
      damageDealt:damage.filter(e => e.outcome.context.source.ownerId === unit.id).reduce((sum,e)=>sum+e.outcome.hpDamage+e.outcome.absorbed,0),
      damageTaken:incoming.reduce((sum,e)=>sum+e.outcome.hpDamage+e.outcome.absorbed,0),
      shieldAbsorbed:incoming.reduce((sum,e)=>sum+e.outcome.absorbed,0),
      healingDone:heals.flatMap(e=>e.outcome.shares).filter(s=>s.source.ownerId===unit.id).reduce((sum,s)=>sum+s.actual,0),
      healingReceived:heals.filter(e=>e.outcome.targetId===unit.id).reduce((sum,e)=>sum+e.outcome.actual,0),
      kills:battle.events.filter(e=>e.type==='kill' && e.source.ownerId===unit.id).length,
      alive:battle.terminal.units.find(u=>u.id===unit.id)!.alive };
  });
}
const fixtures = new Map<string, CombatReplayInput>();
beforeAll(() => {
  fixtures.set('pvp-42',freeze(pvp(42)));
  fixtures.set('mirror-42',freeze(pvp(42,true)));
  fixtures.set('pvp-73',freeze(pvp(73)));
  fixtures.set('wolves-3-7-43',freeze(wolves()));
});
describe('SR-G5-01 healing attribution and authoritative battle summary', () => {
  it.each(['pvp-42','mirror-42','pvp-73','wolves-3-7-43'])('%s: every unit equals an independent full-ledger tally', key => {
    const battle = fixtures.get(key)!;
    // Re-step the actual battle and read the complete ledger (including non-view facts).
    const startCursor = battle.initial.nextEventSeq ?? 0;
    const events = battle.events.filter(e=>e.eventSeq<startCursor);
    let state = battle.initial;
    while (state.status === 'running') {
      const next = stepCombat(state); state = next.state; events.push(...toLedgerEvents(next.events));
    }
    expect(events).toEqual(battle.events);
    const replay = freeze(toCombatReplay(battle)), before = JSON.stringify(replay);
    const summary = summarizeBattle(replay);
    expect(summary).toEqual(ledgerSummary({...battle,events}));
    expect(JSON.stringify(replay)).toBe(before);
    expect(summarizeBattle(replay)).toEqual(summary);
    expect(summary.reduce((s,u)=>s+u.healingDone,0)).toBe(summary.reduce((s,u)=>s+u.healingReceived,0));
    expect(summary.reduce((s,u)=>s+u.damageDealt,0)).toBe(summary.reduce((s,u)=>s+u.damageTaken,0));
    if (key.startsWith('pvp') || key.startsWith('mirror')) {
      for (const team of ['player','enemy']) expect(summary.filter(u=>u.team===team).reduce((s,u)=>s+u.healingDone,0)).toBeGreaterThan(0);
      expect(summary.some(u=>u.shieldAbsorbed>0)).toBe(true);
      expect(summary.some(u=>u.kills>0)).toBe(true);
    }
    for (const event of replay.ticks.flatMap(f=>f.events)) if (event.type==='heal') {
      expect(event.shares.reduce((s,share)=>s+share.actual,0)).toBe(event.actual);
      expect(Object.keys(event).sort()).toEqual(['actual','eventSeq','shares','targetId','tick','type']);
      for (const share of event.shares) expect(Object.keys(share).sort()).toEqual(['actual','sourceId']);
    }
  });
  it('mirror keeps both sides of the replay and all attribution symmetric with the real battle', () => {
    const normal = toCombatReplay(fixtures.get('pvp-42')!), mirror = toCombatReplay(fixtures.get('mirror-42')!);
    expect(mirror).toEqual(normal);
    expect(summarizeBattle(mirror)).toEqual(summarizeBattle(normal));
  });
  it('B-view row mirroring swaps teams but preserves every source, target and summary value', () => {
    const replay = toCombatReplay(fixtures.get('pvp-42')!);
    const mirrored = mirrorCombatReplay(replay);
    expect(summarizeBattle(mirrored)).toEqual(summarizeBattle(replay).map(row => ({...row,
      team:row.team==='player'?'enemy':'player'})));
    expect(mirrorCombatReplay(mirrored)).toEqual(replay);
    expect(mirrored.ticks.flatMap(f=>f.events).filter(e=>e.type==='heal'))
      .toEqual(replay.ticks.flatMap(f=>f.events).filter(e=>e.type==='heal'));
  });
  it('multi-owner, rounded, wounded and overheal shares keep one event/sequence and expose no plans', () => {
    const source = (ownerId:string) => ({ownerId,sourceKind:'ability' as const,definitionId:'heal',instanceId:ownerId,effectIndex:0,parentItemInstanceId:null});
    const outcome = resolveHeal(makeHealRequest('heal','target','direct',null,[
      {source:source('A'),numerator:9,denominator:2}, {source:source('B'),numerator:7,denominator:2},
    ]),{hp:97,maxHp:100,alive:true},2500);
    const event = {type:'heal' as const,domain:'combat' as const,combatId:'heal-test',tick:4,eventSeq:8,outcome};
    const projected = toCombatViewEvents([event]);
    expect(projected).toEqual([{type:'heal',tick:4,eventSeq:8,targetId:'target',actual:3,
      shares:outcome.shares.map(s=>({sourceId:s.source.ownerId,actual:s.actual}))}]);
    expect(outcome.shares).toHaveLength(2);
    expect(projected[0]).not.toHaveProperty('contributions');
    expect(JSON.stringify(projected)).not.toMatch(/sourceKind|definitionId|effectIndex|requested|overheal/);
  });
  it('source tampering, altered shares, missing or duplicated heal still fail replay-divergence', () => {
    const battle = fixtures.get('pvp-42')!;
    const heal = battle.events.find(e=>e.type==='heal' && e.eventSeq>=(battle.initial.nextEventSeq??0));
    if (!heal || heal.type !== 'heal') throw new Error('Expected a real heal');
    const changedSource = {...heal,outcome:{...heal.outcome,shares:heal.outcome.shares.map((s,i)=>i===0?{...s,source:{...s.source,ownerId:'forged'}}:s)}};
    const changedAmount = {...heal,outcome:{...heal.outcome,shares:heal.outcome.shares.map((s,i)=>i===0?{...s,actual:s.actual+1}:s)}};
    for (const changed of [changedSource,changedAmount]) expect(()=>toCombatReplay({...battle,events:battle.events.map(e=>e===heal?changed:e)})).toThrow('replay-divergence');
    expect(()=>toCombatReplay({...battle,events:battle.events.filter(e=>e!==heal)})).toThrow('replay-divergence');
    expect(()=>toCombatReplay({...battle,events:[...battle.events,heal]})).toThrow('replay-divergence');
  });
  it('tick-zero empty battle has no rows', () => {
    const base = catalogPreparation('2-1',8), state = {...base,preparation:{...base.preparation,units:[]}};
    const battle = resolveTwoSidedBattle(compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(state,'B'),8,{battleId:'empty'}),1201);
    expect(summarizeBattle(toCombatReplay(battle))).toEqual([]);
  });
});
