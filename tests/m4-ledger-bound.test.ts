import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/rendering/match-session';
import * as api from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import type { CombatEvent } from '../src/simulation/combat';
import type { ItemInstance } from '../src/simulation/strategy-types';
import type { Unit } from '../src/simulation/unit-types';
import {run} from '../scripts/generate-m5-route.cjs';

/** Synthetic engine-capacity fixture: nine three-star units, 27 complete items,
 * three augments and one anomaly. It intentionally exceeds the normal 15-component
 * acquisition ceiling and is NEVER passed off as a normal full-match route.
 * The real route snapshot is round-tripped first. The inflated observer-only load
 * is explicitly rejected by full Match restore because its resources are unearned.
 * Ordinary acquisition and resource conservation live in m5-route.test.ts. */
async function maximumLoadout():Promise<api.MatchState>{
 let reached:api.MatchState|undefined;
 await run(api,{build:'cannon',seed:42,onStep(before,_result,command){if(command?.type==='start'&&before.round===33)reached=before;}});
 if(!reached)throw Error('Normal route did not reach ordinal 33');
 const base:api.MatchState=restoreMatch(JSON.stringify(reached));
 expect(base).toEqual(reached);
 const definitions=['irelia','rell','leona','loris','tristana','urgot','ezreal','corki','caitlyn'];
 const players:Unit[]=definitions.map((definitionId,index)=>({id:`unit-${200+index}`,definitionId,team:'player',starLevel:3,location:{kind:'board',cell:index<4?{col:index*2,row:4}:{col:index-4,row:7}}}));
 const items:ItemInstance[]=players.flatMap((unit,index)=>['rageblade','archangel','gunblade'].map((definitionId,slot)=>({id:`item-${200+index*3+slot}`,definitionId,location:{kind:'unit' as const,unitId:unit.id,slot}})));
 const binding={...base.anomalyBinding!,unitId:players[7].id};
 const inflated:api.MatchState={...base,level:9,xp:0,nextUnitSerial:300,nextItemSerial:300,items,persistentGrowth:[],
  preparation:{...base.preparation,units:[...players,...base.preparation.units.filter(u=>u.team==='enemy')]},anomalyBinding:binding};
 // The capacity envelope is intentionally larger than the legal 15-component campaign.
 // Keep the full load and all original observer limits, while requiring strict save
 // validation to reject this same synthetic load rather than fabricating provenance.
 expect(() => restoreMatch(inflated)).toThrow(/current resource fold/);
 expect(() => restoreMatch(JSON.stringify(inflated))).toThrow(/current resource fold/);
 expect(restoreMatch(JSON.stringify(base))).toEqual(base);
 return inflated;
}
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe('M4 observer safety retained under M5 finite-content capacity',()=>{
 it('retains complete event sequences, deep-copy isolation, and clears at Continue/New Match',async()=>{
  const fixture=await maximumLoadout(),session=new MatchSession(fixture);
  expect(fixture.preparation.units.filter(u=>u.team==='player')).toHaveLength(9);
  expect(fixture.preparation.units.filter(u=>u.team==='enemy')).toHaveLength(8);
  expect(fixture.items).toHaveLength(27);expect(fixture.augments).toHaveLength(3);expect(fixture.anomalyBinding).not.toBeNull();
  const started=session.start();expect(started.ok).toBe(true);if(!started.ok)throw Error(started.reason);
  const commandEvents=started.events.filter((e):e is CombatEvent=>'tick'in e);
  expect(commandEvents.every(e=>e.tick===0)).toBe(true);expect(session.combatEvents).toEqual(commandEvents);
  const events:CombatEvent[]=[...commandEvents];
  const tickCosts:number[]=[];
  for(let tick=0;tick<1200&&session.phase==='combat';tick++){const began=performance.now();events.push(...session.advance(50));tickCosts.push(performance.now()-began);}
  expect(session.phase).toBe('settlement');expect(session.combat!.status).toBe('finished');expect(session.combat!.tick).toBeLessThanOrEqual(1200);
  const ledger=session.combatEvents;expect(ledger).toEqual(events);expect(ledger.length).toBeGreaterThan(200);
  expect(ledger.map(e=>e.eventSeq)).toEqual(ledger.map((_,i)=>i));expect(new Set(ledger.map(e=>`${e.combatId}:${e.eventSeq}`)).size).toBe(ledger.length);
  expect(ledger.every(e=>e.domain==='combat'&&e.combatId==='round-33')).toBe(true);expect(ledger.filter(e=>e.type==='combatFinished')).toHaveLength(1);expect(ledger.at(-1)?.type).toBe('combatFinished');
  expect(ledger.some(e=>e.type==='cast')).toBe(true);expect(ledger.some(e=>e.type==='manaChanged')).toBe(true);expect(ledger.some(e=>e.type==='packetDamage')).toBe(true);
  const ledgerBytes=bytes(ledger),combinedBytes=bytes({state:session.state,ledger});
  expect(ledgerBytes).toBeLessThan(20*1024*1024);expect(combinedBytes).toBeLessThan(20*1024*1024);
  console.info(`M5 capacity ledger: ticks=${session.combat!.tick}, events=${ledger.length}, ledgerBytes=${ledgerBytes}, stateAndLedgerBytes=${combinedBytes}`);
  const observerCosts:number[]=[];
  for(let read=0;read<5;read++){const began=performance.now();const copy=session.combatEvents as CombatEvent[];observerCosts.push(performance.now()-began);expect(copy).toEqual(ledger);expect(copy).not.toBe(ledger);expect(copy[0]).not.toBe(ledger[0]);const packet=copy.find(e=>e.type==='packetDamage');if(!packet||packet.type!=='packetDamage')throw Error('missing packet');(packet.source as {ownerId:string}).ownerId='tampered';(packet as {raw:number}).raw=-1;copy.length=0;expect(session.combatEvents).toEqual(ledger);expect(bytes({state:session.state,ledger:session.combatEvents})).toBe(combinedBytes);}
  const quantiles=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:sorted.length,p50:sorted[Math.ceil(sorted.length*.50)-1],p95:sorted[Math.ceil(sorted.length*.95)-1],p99:sorted[Math.ceil(sorted.length*.99)-1],max:sorted.at(-1)};};
  console.info(`M5 maximum-capacity measured milliseconds: ${JSON.stringify({tick:quantiles(tickCosts),observer:quantiles(observerCosts)})}`);
  const settled=session.state;expect(session.advance(60000)).toEqual([]);expect(session.state).toBe(settled);expect(session.combatEvents).toEqual(ledger);
  expect(session.continue(33).ok).toBe(true);expect(session.combatEvents).toEqual([]);expect(session.state.round).toBe(34);expect(session.start().ok).toBe(true);session.advance(50);
  expect(session.combatEvents.every(e=>e.combatId==='round-34')).toBe(true);expect(session.combatEvents.map(e=>e.eventSeq)).toEqual(session.combatEvents.map((_,i)=>i));
  session.newMatch();expect(session.combatEvents).toEqual([]);expect(session.state).toEqual(api.createMatch(42));expect(session.combat).toBeNull();
 },120000);
 it('retains actual tick-zero combat events returned from Start commands',()=>{
  let state=api.createMatch(42);while(state.phase==='choice'){const c=state.pendingChoice!,result=api.selectChoice(state,c.choiceId,c.generation,c.offers[0]);if(!result.ok)throw Error(result.reason);state=result.state;}
  const session=new MatchSession({...state,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team==='enemy')}});
  const result=session.start();expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);
  const events=result.events.filter((e):e is CombatEvent=>'tick'in e);expect(events).toHaveLength(1);expect(events[0]).toMatchObject({type:'combatFinished',tick:0,eventSeq:0});expect(session.combatEvents).toEqual(events);
 });
});
