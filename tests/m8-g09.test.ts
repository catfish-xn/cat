import { describe, expect, it } from 'vitest';
import { dispatchTriggers, EMPTY_FACTS, EMPTY_TRIGGER_LEDGER, validateTriggerLedger, type TriggerSignal } from '../src/simulation/m8/triggers';
import { cast, context, source, trigger } from './fixtures/m8-contract-cases';
import type { CounterDefinition, TriggerDefinition } from '../src/simulation/m8/contracts';
const units=[{id:'p',team:'player' as const,cell:{col:3,row:4},hp:100,maxHp:100,alive:true},{id:'a',team:'enemy' as const,cell:{col:3,row:3},hp:100,maxHp:100,alive:true},{id:'b',team:'enemy' as const,cell:{col:3,row:2},hp:100,maxHp:100,alive:true}];
const signal=(n:number):TriggerSignal=>({context:{event:'attack-completed',eventSeq:n,tick:n,actionSeq:n,actorId:'p',targetId:'a',cast:null},facts:EMPTY_FACTS,aggregation:'event'});
const counter=(cap:number|null=null):CounterDefinition=>({id:'attacks',scope:'source-instance',reset:'combat-start',cap,events:[{event:'attack-completed',listener:{subject:'actor',relationToHolder:'self',withinHexes:null},qualifies:'completed-event'}]});
const definition=(patch:Partial<TriggerDefinition>={})=>trigger({source:source('finite','item','p'),counters:[counter()],gate:{kind:'every-n',counterId:'attacks',firstAt:3,everyN:3},...patch});
describe('G09 frozen occurrence counters, gates and full result facts',()=>{
 it('attacks1..6 count1..6 and fire only3/6; duplicate/recovered events do not count',()=>{
  const d=definition();let ledger=EMPTY_TRIGGER_LEDGER;const fired:number[]=[],counts:number[]=[];
  for(let n=1;n<=6;n++){const r=dispatchTriggers('c',[d],ledger,signal(n),units,()=>['a']);ledger=JSON.parse(JSON.stringify(r.ledger));counts.push(ledger.runtimes[0].counters.attacks);if(r.invocations.length)fired.push(n);expect(dispatchTriggers('c',[d],ledger,signal(n),units,()=>['a']).ledger).toEqual(ledger);}
  expect(counts).toEqual([1,2,3,4,5,6]);expect(fired).toEqual([3,6]);validateTriggerLedger(ledger,'c',[d]);
 });
 it('no target at3 loses only that proc,6 fires; ICD does not undo occurrence counts',()=>{
  const d=definition({internalCooldownTicks:10});let ledger=EMPTY_TRIGGER_LEDGER;const fired:number[]=[];
  for(let n=1;n<=18;n++){const r=dispatchTriggers('c',[d],ledger,signal(n),units,()=>n===3?[]:['a']);ledger=r.ledger;if(r.invocations.length)fired.push(n);}
  expect(ledger.runtimes[0].counters.attacks).toBe(18);expect(fired).toEqual([6,18]);
 });
 it('24/25/26 produce24/25/25 and exactly one cap reward; two item instances independent',()=>{
  const d=definition({event:'counter-updated',counters:[counter(25)],gate:{kind:'stack-threshold-once',counterId:'attacks',at:25,rewardId:'cap-resists'}});
  const other={...d,source:{...d.source,instanceId:'other'}};let ledger=EMPTY_TRIGGER_LEDGER;const rows:number[][]=[];
  for(let n=1;n<=26;n++){const r=dispatchTriggers('c',[d,other],ledger,signal(n),units,()=>['p']);ledger=r.ledger;if(n>=24)rows.push([ledger.runtimes[0].counters.attacks,r.invocations.length]);}
  expect(rows).toEqual([[24,0],[25,2],[25,0]]);expect(ledger.runtimes.map(r=>r.consumedRewards)).toEqual([['cap-resists'],['cap-resists']]);
 });
 it('cast actor B80 mana at completion distance2 selectsB, never closerA; facts preserve amount fields',()=>{
  const d=definition({event:'cast-completed',counters:[],gate:{kind:'always'},listener:{subject:'actor',relationToHolder:'enemy',withinHexes:2}});
  const receipt=cast({source:{...source('ability','b','b'),sourceKind:'ability'},actionSeq:8,targetsSampledAtTick:10});
  const e:TriggerSignal={context:{event:'cast-completed',eventSeq:1,tick:10,actionSeq:8,actorId:'b',targetId:'p',cast:receipt},facts:{...EMPTY_FACTS,damage:[{context:context(),hit:true,raw:100,prevented:0,mitigated:100,absorbed:20,hpDamage:30,overkill:50,critical:false,killingPacket:true}]},aggregation:'event'};
  const r=dispatchTriggers('c',[d],EMPTY_TRIGGER_LEDGER,e,units,(_d,s)=>[s.context.actorId]);expect(r.invocations[0].targetIds).toEqual(['b']);expect(r.invocations[0].signal.facts.damage[0]).toMatchObject({absorbed:20,hpDamage:30,overkill:50});
  expect(r.invocations[0].signal.context.cast?.actualManaSpent).toBe(80);
  expect(dispatchTriggers('c',[d],EMPTY_TRIGGER_LEDGER,{...e,context:{...e.context,event:'cast-completed',cast:{...receipt,completionCell:{col:3,row:0}}}},units,()=>['b']).invocations).toEqual([]);
 });
});
