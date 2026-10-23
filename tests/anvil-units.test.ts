import {describe,it,expect} from 'vitest';
import {createMatch,openAnvil,sellUnit,deployMatchUnit,autoDeployToCap,selectChoice,forfeitPendingChoice,startMatchCombat,stepMatch,nextRound,grantAnvilUnit,ANVIL_POLICY,type MatchState} from '../src/simulation/match';
import {isAnvil,anvilDisplay} from '../src/simulation/content/anvils';
import {createOpeningEncounter,openingForgeOffers} from '../src/simulation/opening-encounter';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {validateAnvils} from '../src/simulation/anvils';
import {getPlayerDeploymentCount} from '../src/simulation/game';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import {createSharedPool,initializeSharedSeat,runSharedMatchCommand,restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
import {decideBotAction} from '../src/simulation/bot';
import {accepted} from './match-helpers';
const seedFor=(id:string)=>{for(let s=0;s<20000;s++)if(createOpeningEncounter(s).selection.encounterId===id)return s;throw Error(id);};
const anvils=(s:MatchState)=>s.preparation.units.filter(u=>isAnvil(u.definitionId));
const streams=(s:MatchState)=>[s.rngState,s.choiceRngState,s.rewardRngState,s.battleSeedRngState,s.reforgeState];
const roundtrip=(s:MatchState)=>expect(restoreMatch(serializeMatch(s))).toEqual(s);
describe('14.24 anvil units',()=>{
 it.each(['component-anvils','artifact-anvil'])('%s grants bench units; open follows old stream; restore before/during/after',id=>{
  let s=createMatch(seedFor(id));const before=streams(s),units=anvils(s);
  expect(s.phase).toBe('preparation');expect(s.pendingChoice).toBeNull();expect(units).toHaveLength(id==='component-anvils'?2:1);roundtrip(s);
  for(const u of [...units].reverse()){
   const r=s.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.unitId===u.id)!;
   const expected=openingForgeOffers(s,r.receiptId);
   const opened=openAnvil(s,u.id);s=accepted(opened);
   expect(s.pendingChoice!.offers).toEqual(expected);expect(s.gold).toBe(0);expect(anvils(s).some(v=>v.id===u.id)).toBe(false);roundtrip(s);
   const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[2]));
   expect(s.items.at(-1)).toMatchObject({definitionId:expected[2],location:{kind:'inventory'}});roundtrip(s);
   expect(openAnvil(s,u.id)).toEqual({ok:false,state:s,reason:'unknown-unit'});
  }
  expect(streams(s)).toEqual(before);
 });
 it('bench moves and swaps, no population/auto-deploy/merge, sell is opening without gold',()=>{
  let s=createMatch(seedFor('component-anvils'));const u=anvils(s)[0],hero=s.preparation.units.find(u=>u.team==='player'&&!isAnvil(u.definitionId))!;
  s=accepted(deployMatchUnit(s,u.id,{kind:'bench',slot:8}));
  expect(deployMatchUnit(s,u.id,{kind:'board',cell:{col:0,row:4}})).toMatchObject({ok:false,reason:'invalid-location',state:s});
  s=accepted(deployMatchUnit(s,s.preparation.units.find(u=>u.team==='player'&&!isAnvil(u.definitionId))!.id,{kind:'board',cell:{col:0,row:4}}));expect(getPlayerDeploymentCount(s.preparation)).toBe(1);
  expect(deployMatchUnit(s,hero.id,{kind:'bench',slot:8})).toMatchObject({ok:false,reason:'invalid-location',state:s});
  const gold=s.gold;s=accepted(sellUnit(s,u.id));expect(s.gold).toBe(gold);expect(s.pendingChoice?.kind).toBe('forge');
 });
 it('30-second contract, timeout selects first, no repeated grant; rejects tampering',()=>{
  expect(ANVIL_POLICY.timeoutMs).toBe(30000);
  let s=createMatch(seedFor('component-anvils'));s=accepted(openAnvil(s,anvils(s)[0].id));const c=s.pendingChoice!;
  expect(()=>restoreMatch({...s,pendingChoice:{...c,offers:[...c.offers].reverse()}})).toThrow();
  expect(()=>restoreMatch({...s,resourceProvenance:{...s.resourceProvenance,entries:s.resourceProvenance.entries.filter(e=>e.kind!=='anvil-opened')}})).toThrow();
  const timed=forfeitPendingChoice(s,s.round,c.choiceId,c.generation);if(!timed.ok)throw Error(timed.reason);s=timed.state;expect(s.items.at(-1)?.definitionId).toBe(c.offers[0]);roundtrip(s);
  expect(forfeitPendingChoice(s,s.round,c.choiceId,c.generation)).toMatchObject({ok:false,state:s});
 });
 it('retains unopened units across a real round and save replay',()=>{
  let s=createMatch(seedFor('component-anvils'));const ids=anvils(s).map(u=>u.id);
  s=accepted(deployMatchUnit(s,s.preparation.units.find(u=>u.team==='player'&&!isAnvil(u.definitionId))!.id,{kind:'board',cell:{col:0,row:4}}));s=accepted(startMatchCombat(s));
  while(s.phase==='combat')s=stepMatch(s).state;
  roundtrip(s);expect(anvils(s).map(u=>u.id)).toEqual(ids);
  s=accepted(nextRound(s,s.round));roundtrip(s);expect(anvils(s).map(u=>u.id)).toEqual(ids);
 });
 it('four categories, unique unmerged units, capacity failure atomic',()=>{
  let s=createMatch(seedFor('none'));
  for(let i=0;i<9;i++)s=accepted(grantAnvilUnit(s,{receiptId:`test:${i}`,source:'test',definitionId:'TFT_ArmoryKeySupport'}));
  expect(anvils(s)).toHaveLength(9);expect(anvils(s).every(u=>u.starLevel===1)).toBe(true);
  expect(grantAnvilUnit(s,{receiptId:'overflow',source:'test',definitionId:'TFT_ArmoryKeyCompleted'})).toEqual({ok:false,state:s,reason:'bench-full'});
  for(const id of ['TFT_ArmoryKeyComponent','TFT_ArmoryKeyCompleted','TFT_ArmoryKeySupport','TFT_ArmoryKeyOrnn'])expect(anvilDisplay(id)).toMatchObject({sellGold:0,timeoutMs:30000});
 });
 it('shared view and snapshot, new command, bot opens then picks the first offer',()=>{
  const seed=seedFor('component-anvils');let pool=createSharedPool('anvil-test',seed);
  const init=initializeSharedSeat(pool,createMatch(99,{mode:'shared-deferred'}),'seat-0',0);if(!init.ok)throw Error(init.reason);
  let s=init.state;pool=init.pool;const u=anvils(s)[0];
  const view=toPrivateSeatView(s);expect(view.preparation.units.find(v=>v.id===u.id)?.anvil).toEqual(anvilDisplay(u.definitionId));
  const ctx={difficulty:'basic' as const,stepsTaken:0,maxSteps:60,self:{seatId:'seat-0',round:s.round,hp:s.playerHp}};
  expect(decideBotAction(s,ctx as Parameters<typeof decideBotAction>[1],123).action).toEqual({type:'sell',unitId:u.id});
  const open=runSharedMatchCommand(pool,s,{type:'openAnvil',unitId:u.id});if(!open.ok)throw Error(open.reason);s=open.state;pool=open.pool;
  expect(toPrivateSeatView(s).pendingChoice?.offers).toEqual(s.pendingChoice!.offers);
  const restored=restoreSharedOrbSnapshot(pool,s);expect(restored).toEqual(s);
  expect(autoDeployToCap(init.state).ok).toBe(true);
  const c=s.pendingChoice!;expect(decideBotAction(s,ctx as Parameters<typeof decideBotAction>[1],123).action).toEqual({type:'choose',choiceId:c.choiceId,generation:0,definitionId:c.offers[0]});
  expect(()=>validateAnvils(s)).not.toThrow();
  const timeout=runSharedMatchCommand(pool,s,{type:'timeoutChoice',round:s.round,choiceId:c.choiceId,generation:c.generation});if(!timeout.ok)throw Error(timeout.reason);
  expect(timeout.state.items.at(-1)?.definitionId).toBe(c.offers[0]);expect(restoreSharedOrbSnapshot(timeout.pool,timeout.state)).toEqual(timeout.state);
 });
});
it('opens after a real settlement and replays the consumed unit plus item birth',()=>{
 let s=createMatch(seedFor('component-anvils'));s=accepted(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;
 s=accepted(openAnvil(s,anvils(s)[0].id));roundtrip(s);
 const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[1]));roundtrip(s);
});
it('public scout board exposes only the visible anvil identity, never its offers or ledger',async()=>{
 const {toPublicBoard}=await import('../src/server/room/projection');
 let s=createMatch(seedFor('component-anvils'));const publicBefore=toPublicBoard(s);
 expect(publicBefore.bench!.filter(u=>isAnvil(u.definitionId))).toHaveLength(2);
 s=accepted(openAnvil(s,anvils(s)[0].id));const text=JSON.stringify(toPublicBoard(s));
 for(const forbidden of ['pendingChoice','anvil-unit','timeoutOption','resourceProvenance','rngState','unit-'])expect(text).not.toContain(forbidden);
 expect(toPublicBoard(s).bench!.filter(u=>isAnvil(u.definitionId))).toHaveLength(1);
});
it('wire command admits only unitId and routes through the shared transaction',async()=>{
 const {validateClientCommand}=await import('../src/server/net/messages');
 const {applySeatCommand,ROOM_COMMAND_GATE}=await import('../src/server/room/room');
 expect(validateClientCommand({type:'openAnvil',unitId:'unit-2'})).toEqual({type:'openAnvil',unitId:'unit-2'});
 expect(()=>validateClientCommand({type:'openAnvil',unitId:'unit-2',gold:99})).toThrow();
 const pool=createSharedPool('wire-anvil',seedFor('artifact-anvil'));const init=initializeSharedSeat(pool,createMatch(7,{mode:'shared-deferred'}),'seat-0',0);if(!init.ok)throw Error(init.reason);
 expect(ROOM_COMMAND_GATE.preparation.has('openAnvil')).toBe(true);
 const result=applySeatCommand(init.pool,init.state,{type:'openAnvil',unitId:anvils(init.state)[0].id});
 expect(result.ok).toBe(true);expect(result.state.pendingChoice?.payload).toMatchObject({source:'anvil-unit',timeoutMs:30000});
});
