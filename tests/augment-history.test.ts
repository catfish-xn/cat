import { firstNodeSeed } from './augment-stage-helpers';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import * as historyApi from '../src/simulation/augment-history';
import { validateAugmentHistory } from '../src/simulation/augment-history-restore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import * as acquisition from '../src/simulation/augment-acquisition';
import { createMatch, deployMatchUnit, startMatchCombat, nextRound, selectChoice, rerollShop, openMatchCombatStream, stepMatchCombatStream, revealMatchCombatStreamTerminal, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { advanceAugmentPreparationTime, requireAugmentFacts, readPreviousAugmentBattle, recordAugmentGrowth, readAugmentGrowth, captureAugmentHistoryAuthority } from '../src/simulation/augment-history';
import { restoreSharedOrbSnapshot, runSharedMatchCommand } from '../src/simulation/shared-pool';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
import { makeRoom, runUntil, answerOpenChoices, DamageResolver } from './server/helpers';
import { toPlayerView, toSeatPrivateView, toCombatReplayFor } from '../src/server/room/projection';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { createCarousel, advanceCarousel, pickCarouselForSeat, grantAdditionalCarouselPick, restoreCarouselSeat } from '../src/simulation/carousel';
import { supplySeats, must } from './p7-carousel-helper';
import { assertSharedPoolConservation } from '../src/simulation/shared-pool';

// Infrastructure fixture: real existing offers/commands, with only the history capability mocked.
// No new augment definition/effect is installed, no production content/offer pool is changed.
const fixture = vi.hoisted(() => ({ allOwners: false }));
vi.mock('../src/simulation/augment-history-owners', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/simulation/augment-history-owners')>();
  return {...actual,augmentNeedsHistory:(id:string)=>actual.augmentNeedsHistory(id)||id==='starry-night'||fixture.allOwners};
});
let acquired: MatchState, advanced: MatchState;
const baselineIdentity=(text:string)=>text.replaceAll('s13-g2-3-v25-online-rules','s13-g2-3-v24-online-rules')
  .replaceAll('s13-14.24b-g2-3-v25-online-rules','s13-14.24b-g2-3-v24-online-rules')
  .replaceAll('fnv1a32-utf16:2cfdbb54','fnv1a32-utf16:db662e0b')
  .replaceAll('fnv1a32-utf16:722ab6e2','fnv1a32-utf16:18c876b2');
beforeAll(() => {
  const open = reachRound('2-1', false, firstNodeSeed('starry-night', 101)), c = open.pendingChoice!;
  expect(c.offers).toContain('starry-night');
  acquired = accepted(selectChoice(open, c.choiceId, c.generation, 'starry-night'));
  let s = advanceAugmentPreparationTime(acquired, 2500);
  s = accepted(rerollShop(s));
  s = accepted(startMatchCombat(emptyBoard(s)));
  s = resolveM5Choices(s);
  advanced = accepted(nextRound(s, s.round));
});

it('keeps four no-owner saves byte-identical to HEAD ee2b019c (independent baseline SHA-256)', () => {
  let s = createMatch(42); const hashes: string[] = [];
  const check = () => { const text = serializeMatch(s); expect(text).not.toContain('augmentHistory'); expect(serializeMatch(restoreMatch(text))).toBe(text);
    // Compare the unchanged no-owner payload to the original epoch after normalizing the intentionally changed identities.
    hashes.push(createHash('sha256').update(baselineIdentity(text)).digest('hex')); };
  check(); const u = s.preparation.units.find(u => u.team === 'player')!;
  s = accepted(deployMatchUnit(s, u.id, {kind:'bench',slot:0})); check();
  s = resolveM5Choices(accepted(startMatchCombat(s))); check();
  s = accepted(nextRound(s, s.round)); check();
  expect(hashes).toEqual(['b2241cbf3f5f15734341fbf8ed2f1de589ab77a8ff4b53cffd8b194ad0510e31','318c884b3bc964bb0c225eabc73ed58b665078266ca5f7b3519f714deb7a814f','39c02c0190fa9395576008c55fea45ad3b514407363b0c335376174d3b497f2d','2c29384cb16d144c3036b460ed03093634c8ac0fc4ff5a2b29d56915ea350692']);
});
const entries = ['object','JSON','serialized'] as const;
const onlineAttacks: readonly [string, (s: any) => void][] = [
  ['missing section',s=>{delete s.augmentHistory;}],
  ['wrong version',s=>{s.augmentHistory.version='augment-history-v2';}],
  ['wrong seat',s=>{s.augmentHistory.seatId='s7';}],
  ['wrong fact seat',s=>{s.augmentHistory.facts[0].seatId='s7';}],
  ['wrong round',s=>{s.augmentHistory.facts[0].round++;}],
  ['wrong round identity',s=>{s.augmentHistory.facts[0].roundId='3-1';}],
];
function onlineTamperMatrix(s: MatchState, restore: (input: unknown) => MatchState): void {
  for (const entry of ['object','JSON'] as const) {
    const input = (value: MatchState) => entry === 'object' ? value : JSON.stringify(value);
    expect(restore(input(s))).toEqual(s);
    for (const [name,edit] of onlineAttacks) {
      const bad = structuredClone(s); edit(bad);
      expect(()=>restore(input(bad)),`${entry}: ${name}`).toThrow(/augment history/);
    }
  }
}
function restore(s: MatchState, entry: typeof entries[number]): MatchState {
  return entry === 'object' ? restoreMatch(s) : entry === 'JSON' ? restoreMatch(JSON.stringify(s)) : restoreMatch(serializeMatch(s));
}
for (const entry of entries) describe(entry, () => {
  it('round trips acquisition, positions, logical time, complete empty combat, PvP and next entry; continues identically', () => {
    for (const s of [acquired, advanced]) { const copy = restore(s, entry); expect(copy).toEqual(s); expect(rerollShop(copy)).toEqual(rerollShop(s)); }
    expect(requireAugmentFacts(advanced,'round-entry',advanced.round)).toHaveLength(1);
    expect(readPreviousAugmentBattle(acquired,acquired.augments[0].choiceId)).toMatchObject({status:'recorded',round:3,roundId:'1-4'});
    expect(requireAugmentFacts(advanced,'deaths',acquired.round)[0].deaths).toEqual([]);
    expect(requireAugmentFacts(advanced,'player-damage',acquired.round)[0].actualDamage).toBeNull();
  });
  const attacks: readonly [string, (s: any) => void][] = [
    ['missing section',s=>{delete s.augmentHistory;}],
    ['unknown version',s=>{s.augmentHistory.version='augment-history-v2';}],
    ['wrong seat',s=>{s.augmentHistory.seatId='s7';}],
    ['wrong fact seat',s=>{s.augmentHistory.facts[0].seatId='s7';}],
    ['wrong round',s=>{s.augmentHistory.facts[0].round++;}],
    ['wrong round identity',s=>{s.augmentHistory.facts[0].roundId='3-1';}],
    ['added fact',s=>{s.augmentHistory.facts.push({...s.augmentHistory.facts.at(-1),sequence:s.augmentHistory.facts.length});}],
    ['removed fact with repaired sequence',s=>{s.augmentHistory.facts.splice(1,1);s.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);}],
    ['changed principal',s=>{s.augmentHistory.facts[0].goldBefore++;}],
    ['changed board or bench position',s=>{s.augmentHistory.facts[0].roster.units[0].location={kind:'bench',slot:8};}],
    ['changed clock',s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='preparation-time').elapsedMs++;}],
    ['fake death',s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='deaths').deaths.push({unitId:'fake'});}],
    ['fabricated zero opponent HP',s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='player-damage').actualDamage=0;}],
    ['removed command',s=>{s.augmentHistory.proof.commands.pop();}],
    ['oversized repeat',s=>{s.augmentHistory.proof.commands[0].count=Number.MAX_SAFE_INTEGER;}],
    ['recursive origin',s=>{s.augmentHistory.proof.origin.augmentHistory={};}],
  ];
  for (const [name, edit] of attacks) it(`rejects ${name}`, () => {
    const s = structuredClone(advanced); edit(s); expect(()=>restore(s,entry)).toThrow(/augment history/);
  });
  it('rejects add/remove/alter for each recorded fact family', () => {
    for (let i=0;i<advanced.augmentHistory!.facts.length;i++) for (const action of ['remove','alter','add']) {
      const s:any=structuredClone(advanced);
      if(action==='remove')s.augmentHistory.facts.splice(i,1);
      else if(action==='alter')s.augmentHistory.facts[i].invented=true;
      else s.augmentHistory.facts.splice(i,0,structuredClone(s.augmentHistory.facts[i]));
      s.augmentHistory.facts.forEach((f:any,j:number)=>f.sequence=j);
      expect(()=>restore(s,entry),`${action} ${advanced.augmentHistory!.facts[i].kind}`).toThrow(/augment history/);
    }
  });
});
it('does not turn missing rows into zero and preserves failed/no-op command identity',()=>{
  expect(()=>requireAugmentFacts(acquired,'round-entry',1)).toThrow('missing round-entry');
  expect(advanceAugmentPreparationTime(acquired,0)).toBe(acquired);
  const same=advanceAugmentPreparationTime(acquired,100);expect(advanceAugmentPreparationTime(same,100)).toBe(same);
  expect(()=>advanceAugmentPreparationTime(same,99)).toThrow('regression');
  const failure=deployMatchUnit(acquired,'absent',{kind:'bench',slot:0});expect(failure.ok).toBe(false);expect(failure.state).toBe(acquired);
});
it('generic integer HP/AP/AD growth uses ordinary units, unique receipts and rejects conflicting retries',()=>{
  const unitId=acquired.preparation.units.find(u=>u.team==='player')!.id,choiceId=acquired.augments[0].choiceId;
  const deltas=[{unitId,healthFlat:20,healthBps:100,attackDamageBps:150,abilityPowerCenti:2}];
  const grown=recordAugmentGrowth(acquired,choiceId,'growth-1',deltas);
  expect(readAugmentGrowth(grown,unitId)).toEqual(deltas[0]);
  expect(recordAugmentGrowth(grown,choiceId,'growth-1',deltas)).toBe(grown);
  expect(()=>recordAugmentGrowth(grown,choiceId,'growth-1',[{...deltas[0],healthFlat:99}])).toThrow('conflict');
  expect(()=>recordAugmentGrowth(acquired,choiceId,'growth-bad',[{...deltas[0],abilityPowerCenti:1.5}])).toThrow('amount');
  // Appending evidence outside a replayable rule transaction is not an authenticated reward.
  expect(()=>restoreMatch(grown)).toThrow('replayed facts/state mismatch');
});

describe('online authority',()=>{
  const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:18,carousel:CAROUSEL_RULES_BINDING});
  let first: typeof room.state.seats[number];
  beforeAll(()=>{fixture.allOwners=true;room.start();});
  for(const round of [2,3,4])beforeAll(()=>{runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');});
  beforeAll(()=>{
    const clockCapability=vi.spyOn(historyApi,'needsAugmentPreparationClock').mockImplementation(s=>!!s.augmentHistory);
    const grant=acquisition.grantAugmentAcquisition;
    const seen:string[]=[];
    const acquisitionHook=vi.spyOn(acquisition,'grantAugmentAcquisition').mockImplementation((state,augment)=>{
      expect(readPreviousAugmentBattle(state,augment.choiceId).status).toBe('recorded');
      expect(requireAugmentFacts(state,'acquire',state.round).at(-1)!.preparationElapsedMs).toBe(0);
      seen.push(augment.choiceId);return grant(state,augment);
    });
    try{answerOpenChoices(room);}finally{acquisitionHook.mockRestore();}
    expect(seen.length).toBeGreaterThan(0);first=room.state.seats.find(s=>s.alive)!;
    expect(first.match.augmentHistory).toBeDefined();
    for(const input of [first.match,JSON.stringify(first.match)])expect(restoreSharedOrbSnapshot(room.state.pool,input,room.augmentHistoryAuthority(first.seatId))).toEqual(first.match);
    clock.advance(50);
    const sampled=room.state.seats.find(s=>s.seatId===first.seatId)!.match;
    expect(requireAugmentFacts(sampled,'preparation-time',4).at(-1)!.elapsedMs).toBe(50);
    clockCapability.mockRestore();
  });
  beforeAll(()=>{runUntil(room,clock,s=>s.round===4&&s.phase==='settlement');});
  afterAll(()=>{room.dispose();fixture.allOwners=false;});
  it('records real room acquisition, all-seat PvP roster, deaths, damage and ranking, and rejects independent-authority attacks',()=>{

    const seat=room.state.seats.find(s=>s.seatId===first.seatId)!,s=seat.match,authority=room.augmentHistoryAuthority(seat.seatId);
    onlineTamperMatrix(s,input=>restoreSharedOrbSnapshot(room.state.pool,input,authority));
    expect(requireAugmentFacts(s,'pvp-roster',4)[0].seats).toHaveLength(8);
    expect(requireAugmentFacts(s,'table',4).at(-1)!.stage).toBe('settlement');
    expect(requireAugmentFacts(s,'deaths',4)).not.toHaveLength(0);
    const damage=requireAugmentFacts(s,'player-damage',4)[0];
    expect(damage.actualDamage).toBe(damage.hpBefore!-damage.hpAfterDamage!);
    for(const entry of ['object','JSON'] as const){
      expect(restoreSharedOrbSnapshot(room.state.pool,entry==='object'?s:JSON.stringify(s),authority)).toEqual(s);
      for(let i=0;i<s.augmentHistory!.facts.length;i++)for(const action of ['remove','alter','add']){
        const bad:any=structuredClone(s);if(action==='remove')bad.augmentHistory.facts.splice(i,1);else if(action==='alter')bad.augmentHistory.facts[i].invented=1;else bad.augmentHistory.facts.splice(i,0,bad.augmentHistory.facts[i]);
        bad.augmentHistory.facts.forEach((f:any,j:number)=>f.sequence=j);
        expect(()=>restoreSharedOrbSnapshot(room.state.pool,entry==='object'?bad:JSON.stringify(bad),authority)).toThrow(/augment history/);
      }
    }
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,s)).toThrow('missing independent server authority');
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,s,{kind:'server-augment-history-authority'})).toThrow('missing independent server authority');
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,s,room.augmentHistoryAuthority('s1'))).toThrow('server facts/state mismatch');
    const missing:any=structuredClone(s);delete missing.augmentHistory;expect(()=>restoreSharedOrbSnapshot(room.state.pool,missing,authority)).toThrow('missing augment-history-v1');
    const detached=structuredClone(s);(detached as any).augmentHistory.facts[0].goldBefore++;
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,detached,authority)).toThrow();
  });
  it('keeps held augment history out of every public/private/replay projection',()=>{
    const seat=room.state.seats.find(s=>s.seatId===first.seatId)!;
    expect(seat.match.augmentHistory!.facts.some(f=>f.kind==='table'&&f.seats.length===8)).toBe(true);
    const before=canonicalContent(room.state);
    const withoutHistory={...room.state,seats:room.state.seats.map(s=>{const {augmentHistory:_history,...match}=s.match;return {...s,match:match as MatchState};})};
    for(const recipient of room.state.seats){
      const view=toPlayerView(room.state,recipient.seatId,clock.now());
      expect(view.seats.find(s=>s.seatId===seat.seatId)!.publicBoard!.augments).toContain(seat.match.augments[0].definitionId);
      const privateView=toSeatPrivateView(recipient.match),replay=toCombatReplayFor(room.state,recipient.seatId);
      expect(view).toEqual(toPlayerView(withoutHistory,recipient.seatId,clock.now()));
      expect(privateView).toEqual(toSeatPrivateView(withoutHistory.seats.find(s=>s.seatId===recipient.seatId)!.match));
      expect(replay).toEqual(toCombatReplayFor(withoutHistory,recipient.seatId));
      const projected=JSON.stringify({view,private:privateView,replay});
      for(const key of ['augmentHistory','augment-history-v1','previousBattle','resourcePrefix','ownerSeatId'])expect(projected).not.toContain(`"${key}"`);
      // Own roundResults legitimately expose economy.goldBefore; public projections do not.
      expect(JSON.stringify(view)).not.toContain('"goldBefore"');
    }
    expect(canonicalContent(room.state)).toBe(before);
  });
});

for(const mode of ['manual','bot','timeout'] as const)it(`makes three prior eliminations readable inside the ${mode} acquisition effect`,()=>{
  fixture.allOwners=true;
  const inner=new TwoSidedBattleResolver();
  // Same lethal-result fixture as round-commit tests: mark the rules seat eliminated so pool shares release.
  const {room,clock}=makeRoom({resolveBattle(input,pool){
    const seat=input.seats[0];
    if(input.round===1&&['s1','s2','s3'].includes(seat.seatId))return {kind:'placeholder',battleId:input.battleId,round:input.round,roomRevision:input.roomRevision,outcomes:[{
      seatId:seat.seatId,state:{...seat.state,playerHp:0,multiplayer:{...seat.state.multiplayer!,status:'eliminated'}},result:null,damage:100,combat:null}]};
    return inner.resolveBattle(input,pool);
  }});
  const grant=acquisition.grantAugmentAcquisition,seen:string[]=[];
  const hook=vi.spyOn(acquisition,'grantAugmentAcquisition').mockImplementation((state,augment)=>{
    const tables=requireAugmentFacts(state,'table',state.round);
    expect(tables).toHaveLength(1);expect(tables[0].stage).toBe('acquire');
    expect(tables[0].seats).toHaveLength(8);
    const eliminated=tables[0].seats.filter(s=>!s.alive);
    expect(eliminated.map(s=>s.seatId)).toEqual(['s1','s2','s3']);
    expect(eliminated.every(s=>s.hp===0&&s.eliminatedRound===1&&s.rank>=6)).toBe(true);
    seen.push(state.multiplayer!.seatId);
    const granted=grant(state,augment);
    // Infrastructure probe: a history consumer executes and records its result within acquisition.
    return {...granted,state:recordAugmentGrowth(granted.state,augment.choiceId,`elimination-probe:${augment.choiceId}`,[{
      unitId:state.preparation.units.find(u=>u.team==='player')!.id,healthFlat:eliminated.length,healthBps:0,attackDamageBps:0,abilityPowerCenti:0}])};
  });
  try {
    room.start();runUntil(room,clock,s=>s.round===4&&s.phase==='preparation');
    const id=mode==='bot'?'s4':'s0',seat=room.state.seats.find(s=>s.seatId===id)!,c=seat.match.pendingChoice!;
    expect(seat.match.augmentHistory).toBeUndefined();
    const before=room.state;
    expect(room.handle(id,{type:'choose',choiceId:c.choiceId,generation:c.generation+1,definitionId:c.offers[0]})).toMatchObject({ok:false,reason:'stale-choice'});
    expect(room.state).toBe(before);expect(seen).toEqual([]);
    const command={type:'choose' as const,choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]};
    if(mode==='manual')expect(room.handle(id,command)).toMatchObject({ok:true});
    else if(mode==='bot')expect(room.handleBot(id,seat.controlEpoch,command)).toMatchObject({ok:true});
    else runUntil(room,clock,s=>!!s.seats.find(s=>s.seatId===id)!.match.augmentHistory);
    expect(seen).toContain(id);
    const picked=room.state.seats.find(s=>s.seatId===id)!.match;
    expect(requireAugmentFacts(picked,'table',4).filter(f=>f.stage==='acquire')).toHaveLength(1);
    expect(requireAugmentFacts(picked,'growth',4)[0].deltas[0].healthFlat).toBe(3);
    expect(restoreSharedOrbSnapshot(room.state.pool,picked,room.augmentHistoryAuthority(id))).toEqual(picked);
  } finally {hook.mockRestore();room.dispose();fixture.allOwners=false;}
});

for(const streaming of [false,true])describe(`online PvE deaths (${streaming?'stream':'ordinary'})`,()=>{
  const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:42,carousel:CAROUSEL_RULES_BINDING,combatStreaming:streaming});
  beforeAll(()=>{fixture.allOwners=true;room.start();});
  for(let round=2;round<=10;round++)beforeAll(()=>{
    runUntil(room,clock,s=>s.round>=round&&s.phase==='preparation');
  });
  beforeAll(()=>{
    // Keep one low-cost champion fielded so this death-ownership fixture remains meaningful after pool expansion.
    let match=room.state.seats.find(s=>s.seatId==='s0')!.match;
    const players=match.preparation.units.filter(u=>u.team==='player'&&!UNIT_DEFINITIONS[u.definitionId]?.summon);
    const chosen=[...players].sort((a,b)=>UNIT_DEFINITIONS[a.definitionId].cost-UNIT_DEFINITIONS[b.definitionId].cost)[0];
    for(const unit of players.filter(u=>u.id!==chosen.id&&u.location.kind==='board')){
      const occupied=new Set(match.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').map(u=>u.location.kind==='bench'?u.location.slot:-1));
      const slot=Array.from({length:match.preparation.benchSize},(_,i)=>i).find(i=>!occupied.has(i));
      if(slot===undefined)throw Error('death fixture bench full');
      expect(room.handle('s0',{type:'deploy',unitId:unit.id,target:{kind:'bench',slot}})).toMatchObject({ok:true});
      match=room.state.seats.find(s=>s.seatId==='s0')!.match;
    }
    if(chosen.location.kind==='bench')expect(room.handle('s0',{type:'deploy',unitId:chosen.id,target:{kind:'board',cell:{col:0,row:4}}})).toMatchObject({ok:true});
    for(const unit of players.filter(u=>u.id!==chosen.id))expect(room.handle('s0',{type:'sell',unitId:unit.id})).toMatchObject({ok:true});
  });
  afterAll(()=>{room.dispose();fixture.allOwners=false;});
  it('binds live and terminal samples, authenticates them and resumes object/JSON snapshots identically',()=>{
    const seat=room.state.seats.find(s=>s.seatId==='s0')!;
    expect(seat.match.roundDefinitionId).toBe('2-7');expect(seat.match.augmentHistory).toBeDefined();
    let pool=room.state.pool;
    let state:MatchState;
    if(streaming)state=accepted(openMatchCombatStream(seat.match));
    else {const opened=must(runSharedMatchCommand(pool,seat.match,{type:'startCombat'}));pool=opened.pool;state=opened.state;}
    for(let tick=0;tick<4;tick++){
      if(streaming){const step=stepMatchCombatStream(state);expect(step.terminal).toBeNull();state=step.state;}
      else {const step=must(runSharedMatchCommand(pool,state,{type:'step'}));pool=step.pool;state=step.state;}
    }
    const authority=captureAugmentHistoryAuthority(state);
    const finish=(initial:MatchState)=>{
      let current=initial,latest=pool;const events:import('../src/simulation/match-types').MatchEvent[]=[];
      for(let guard=0;current.phase==='combat';guard++){
        expect(guard).toBeLessThan(1000);
        if(streaming){
          const step=stepMatchCombatStream(current);events.push(...step.events);current=step.state;
          if(step.terminal){
            current=accepted(revealMatchCombatStreamTerminal(current,step.terminal));
            const settled=must(runSharedMatchCommand(latest,current,{type:'settleCombatStream',terminal:step.terminal}));
            current=settled.state;latest=settled.pool;
          }
        }else{
          const step=must(runSharedMatchCommand(latest,current,{type:'step'}));current=step.state;latest=step.pool;events.push(...step.events);
        }
      }
      return {state:current,pool:latest,events};
    };
    const finished=finish(state),rows=requireAugmentFacts(finished.state,'deaths',10),deaths=rows.flatMap(f=>f.deaths);
    expect(deaths.filter(d=>d.team==='player').length).toBeGreaterThan(0);
    expect(rows.at(-1)!.completeThroughTick).toBe(finished.state.combat!.tick);
    expect(deaths.map(d=>[d.unitId,d.eventSeq])).toEqual(finished.events.filter(e=>e.type==='death').map(e=>[e.unitId,e.eventSeq]));
    expect(deaths.every(d=>d.ownerSeatId===(d.team==='player'?'s0':null))).toBe(true);
    expect(new Set(deaths.map(d=>`${d.combatId}:${d.eventSeq}`)).size).toBe(deaths.length);
    const finalAuthority=captureAugmentHistoryAuthority(finished.state);
    for(const entry of ['object','JSON'] as const){
      const input=(s:MatchState)=>entry==='object'?s:JSON.stringify(s);
      expect(finish(restoreSharedOrbSnapshot(pool,input(state),authority))).toEqual(finished);
      expect(restoreSharedOrbSnapshot(finished.pool,input(finished.state),finalAuthority)).toEqual(finished.state);
      for(const owner of ['solo','s1',null]){
        const bad:any=structuredClone(finished.state);
        bad.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.round===10&&f.deaths.some((d:any)=>d.team==='player')).deaths.find((d:any)=>d.team==='player').ownerSeatId=owner;
        expect(()=>restoreSharedOrbSnapshot(finished.pool,input(bad),finalAuthority)).toThrow('death owner');
        expect(()=>restoreSharedOrbSnapshot(finished.pool,input(bad),captureAugmentHistoryAuthority(bad))).toThrow('death owner');
      }
      const disguised:any=structuredClone(finished.state);
      const death=disguised.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.round===10&&f.deaths.some((d:any)=>d.team==='player')).deaths.find((d:any)=>d.team==='player');
      Object.assign(death,{team:'enemy',ownerSeatId:null});
      expect(()=>restoreSharedOrbSnapshot(finished.pool,input(disguised),finalAuthority)).toThrow('server facts/state mismatch');
    }
  });
  it('publishes real room PvE death rows for the actual seat with an independent restore authority',()=>{
    runUntil(room,clock,s=>s.round===10&&s.phase==='settlement');
    expect(room.state.fault).toBeNull();
    const match=room.state.seats.find(s=>s.seatId==='s0')!.match;
    const rows=requireAugmentFacts(match,'deaths',10),deaths=rows.flatMap(f=>f.deaths);
    expect(rows.every(f=>f.seatId==='s0')).toBe(true);
    expect(deaths.some(d=>d.team==='player')).toBe(true);
    expect(deaths.every(d=>d.ownerSeatId===(d.team==='player'?'s0':null))).toBe(true);
    expect(rows.at(-1)!.completeThroughTick).toBe(match.combat!.tick);
    expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(match),room.augmentHistoryAuthority('s0'))).toEqual(match);
  });
});

it('supports multiple distinct carousel receipts per seat, keeps normal picks single, authenticates source/placement',()=>{
  fixture.allOwners=true;
  try {
    const ready=supplySeats(1);let pool=ready.pool,match=ready.states[0];
    let carousel=must(createCarousel(pool,'2-4',{algorithm:'lcg32-v1',state:17})).state;
    carousel=must(advanceCarousel(carousel,carousel.releaseAtMs.s0)).state;pool=carousel.pool;
    const normal=must(pickCarouselForSeat(pool,carousel,match,'s0',0));pool=normal.pool;carousel=normal.carousel;match=normal.state;
    const normalAuthority=captureAugmentHistoryAuthority(match);
    onlineTamperMatrix(match,input=>restoreCarouselSeat(carousel,input,normalAuthority));
    const extra=must(grantAdditionalCarouselPick(pool,carousel,match,'s0',1,match.augments[0].choiceId));pool=extra.pool;carousel=extra.carousel;match=extra.state;
    expect(match.carousel!.receipts).toHaveLength(2);expect(new Set(match.carousel!.receipts.map(r=>r.id)).size).toBe(2);
    expect(requireAugmentFacts(match,'carousel',match.round).map(f=>[f.ordinal,f.source])).toEqual([[0,'manual'],[1,'augment']]);
    assertSharedPoolConservation(pool,[match]);
    const authority=captureAugmentHistoryAuthority(match);
    expect(restoreCarouselSeat(carousel,JSON.stringify(match),authority)).toEqual(match);
    for(const input of [match,JSON.stringify(match)]){
      expect(()=>restoreCarouselSeat(carousel,input)).toThrow('missing independent server authority');
      expect(()=>restoreCarouselSeat(carousel,input,{kind:'server-augment-history-authority'})).toThrow('missing independent server authority');
    }
    expect(pickCarouselForSeat(pool,carousel,match,'s0',2)).toMatchObject({ok:false,reason:'already-picked'});
    const retry=grantAdditionalCarouselPick(pool,carousel,match,'s0',1,match.augments[0].choiceId);expect(retry).toMatchObject({ok:false,reason:'slot-taken'});expect(retry.state).toBe(match);expect(retry.pool).toBe(pool);
    for(const edit of [(s:any)=>s.augmentHistory.facts.pop(),(s:any)=>s.augmentHistory.facts.at(-1).source='manual',(s:any)=>s.augmentHistory.facts.at(-1).ordinal=0]){
      const bad=structuredClone(match);edit(bad);
      for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreCarouselSeat(carousel,input,authority)).toThrow();
    }
    validateAugmentHistory(match,authority);
    carousel=must(advanceCarousel(carousel,carousel.deadlineMs)).state;pool=carousel.pool;
    const closedExtra=must(grantAdditionalCarouselPick(pool,carousel,match,'s0',2,match.augments[0].choiceId));
    expect(closedExtra.state.carousel!.receipts).toHaveLength(3);
    assertSharedPoolConservation(closedExtra.pool,[closedExtra.state]);
    expect(restoreCarouselSeat(closedExtra.carousel,closedExtra.state,captureAugmentHistoryAuthority(closedExtra.state))).toEqual(closedExtra.state);
  } finally {fixture.allOwners=false;}
});

it('authenticates generic HP/AP growth written inside an acquisition transaction across all offline entries',()=>{
  const grant=acquisition.grantAugmentAcquisition;
  const hook=vi.spyOn(acquisition,'grantAugmentAcquisition').mockImplementation((state,augment)=>{
    const result=grant(state,augment);
    if(augment.definitionId!=='starry-night')return result;
    const unitId=state.preparation.units.find(u=>u.team==='player')!.id;
    return {...result,state:recordAugmentGrowth(result.state,augment.choiceId,'generic-fixture-growth',[
      {unitId,healthFlat:20,healthBps:0,attackDamageBps:150,abilityPowerCenti:150}])};
  });
  try{
    const open=reachRound('2-1',false,firstNodeSeed('starry-night', 101)),c=open.pendingChoice!;
    const grown=accepted(selectChoice(open,c.choiceId,c.generation,'starry-night'));
    const row=requireAugmentFacts(grown,'growth',grown.round)[0];
    expect(readAugmentGrowth(grown,row.deltas[0].unitId)).toEqual(row.deltas[0]);
    for(const entry of entries){
      expect(restore(grown,entry)).toEqual(grown);
      for(const edit of [(s:any)=>s.augmentHistory.facts.splice(s.augmentHistory.facts.findIndex((f:any)=>f.kind==='growth'),1),
        (s:any)=>s.augmentHistory.facts.find((f:any)=>f.kind==='growth').deltas[0].healthFlat++,
        (s:any)=>s.augmentHistory.facts.find((f:any)=>f.kind==='growth').deltas[0].abilityPowerCenti++,
        (s:any)=>s.augmentHistory.facts.find((f:any)=>f.kind==='growth').choiceId='wrong-owner']){
        const bad:any=structuredClone(grown);edit(bad);bad.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);
        expect(()=>restore(bad,entry)).toThrow(/augment history/);
      }
    }
  }finally{hook.mockRestore();}
});

import { canonicalContent } from '../src/simulation/content';
import { stepMatch } from '../src/simulation/match';
import { augmentDeathsFromEvents, sampleAugmentDeath } from '../src/simulation/augment-death-samples';
import { stepCombat, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit } from './combat-helpers';

it('keeps a real battle ledger and terminal save byte-identical to the independent baseline',()=>{
  const started=startMatchCombat(createMatch(42));if(!started.ok)throw new Error(started.reason);let s=started.state;const events=[...started.events];
  while(s.phase==='combat'){const step=stepMatch(s);s=step.state;events.push(...step.events);}
  expect(s.combat!.tick).toBe(164);expect(events).toHaveLength(113);
  expect(createHash('sha256').update(canonicalContent(events)).digest('hex')).toBe('0039c483da70364e45f0758d45caa5f28374b148740ee3409d0a1de315ff0324');
  expect(createHash('sha256').update(baselineIdentity(serializeMatch(s))).digest('hex')).toBe('99174cbf08013d1ee651990be6036b6ab0ddba8a6a4f1cd5660acd35decee431');
});
it('records a Forge death, a real Jayce revival and its second death with equipment at each death',()=>{
  const combatUnit=(id:string,definitionId:string,team:'player'|'enemy',col:number,row:number,patch:Partial<CombatUnit>={})=>unit(id,team,col,row,{
    definitionId,ability:resolveAbility(definitionId==='jayce'?'jayce-ability':'neutral-attack',1),hp:5000,maxHp:5000,armor:0,magicResist:0,
    mana:0,maxMana:100,attackDamage:0,attackRange:6,abilityPower:100,baseAttackSpeedBps:1,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],mechanics:[],equipment:[],...patch});
  let s=battle([combatUnit('j','jayce','player',1,4),combatUnit('j:g23-forge','g23-forge','player',2,4,{hp:0}),
    combatUnit('enemy','garen','enemy',2,3)],{rngState:42,combatId:'history-revive',nextEventSeq:0,strategy:{units:[],traits:[]},startEffectsApplied:true});
  const initial=s;
  const first=stepCombat(s);s=first.state;
  expect(first.events.filter(e=>e.type==='death').map(e=>e.unitId)).toEqual(['j:g23-forge']);
  Object.assign(s.units.find(u=>u.id==='j')!,{mana:100});
  const revived=stepCombat(s);s=revived.state;
  expect(revived.events.some(e=>e.type==='unitRevived'&&e.unitId==='j:g23-forge')).toBe(true);
  Object.assign(s.units.find(u=>u.id==='j:g23-forge')!,{hp:0,equipment:[{definitionId:'chain-vest',slot:0,temporary:false}]});
  const second=stepCombat(s);
  const rows=augmentDeathsFromEvents([...first.events,...revived.events,...second.events]);
  expect(rows.map(d=>d.unitId)).toEqual(['j:g23-forge','j:g23-forge']);
  expect(rows[1].eventSeq).toBeGreaterThan(rows[0].eventSeq);
  expect(rows.map(d=>d.tick)).toEqual([1,3]);expect(rows.every(d=>!d.ordinaryHero)).toBe(true);
  expect(rows[0].equipment).toEqual([]);expect(rows[1].equipment).toEqual([{definitionId:'chain-vest',slot:0,temporary:false}]);
  expect(first.events.find(e=>e.type==='death')).not.toHaveProperty('equipment');
  // The same revived unit must retain both deaths when Match binds live and terminal-only samples.
  const {room}=makeRoom(new DamageResolver(()=>0));room.start();
  try {
    const base=room.state.seats[0].match;
    const owned=historyApi.recordAugmentAcquisition(base,{...base,augments:[{definitionId:'starry-night',choiceId:'revival-probe',acquiredRound:base.round}]});
    let live=historyApi.recordAugmentTransition(owned,{...owned,combat:initial} as MatchState);
    for(const step of [first,revived,second]){
      const events=step.events.filter((e):e is import('../src/simulation/combat-types').LedgerCombatEvent=>e.domain==='combat'&&typeof e.combatId==='string'&&typeof e.eventSeq==='number');
      expect(events).toHaveLength(step.events.length);
      live=historyApi.recordAugmentTransition(live,{...live,combat:step.state} as MatchState,events);
    }
    const liveRows=requireAugmentFacts(live,'deaths',base.round).flatMap(f=>f.deaths);
    expect(liveRows).toEqual(rows.map(d=>({...d,ownerSeatId:'s0'})));
    Object.assign(second.state.units.find(u=>u.id==='enemy')!,{hp:0});
    const terminal=stepCombat(second.state);expect(terminal.state.status).toBe('finished');
    const terminalOnly=historyApi.recordAugmentTransition(owned,{...owned,combat:terminal.state} as MatchState);
    const terminalRows=requireAugmentFacts(terminalOnly,'deaths',base.round).flatMap(f=>f.deaths);
    expect(terminalRows.filter(d=>d.team==='player')).toEqual(liveRows);
    expect(terminalRows.filter(d=>d.team==='enemy')).toMatchObject([{unitId:'enemy',ownerSeatId:null}]);
    expect(terminalRows.map(d=>d.eventSeq)).toEqual([...rows,...augmentDeathsFromEvents(terminal.events)].map(d=>d.eventSeq));
  } finally {room.dispose();}
});

it('preserves slotted temporary items and unslotted chest grants independently at death',()=>{
  const holder=unit('holder','player',1,4,{definitionId:'garen',equipment:[{definitionId:'chain-vest',slot:0,temporary:true}],
    combatItemGrants:[{chest:{sourceKind:'item',ownerId:'chest-holder',definitionId:'unstable-treasure-chest',instanceId:'chest-1',parentItemInstanceId:null,effectIndex:0},ordinal:0,definitionId:'chain-vest',grantedAtTick:2}]});
  const event=sampleAugmentDeath({type:'death' as const,tick:3,unitId:holder.id,combatId:'sample',eventSeq:9},holder);
  const before=structuredClone(holder.combatItemGrants);
  Object.assign(holder.combatItemGrants![0],{definitionId:'giants-belt'});Object.assign(holder.equipment![0],{definitionId:'giants-belt'});
  const [row]=augmentDeathsFromEvents([event]);
  expect(row.ordinaryHero).toBe(true);
  expect(row.equipment).toEqual([{definitionId:'chain-vest',slot:0,temporary:true}]);
  expect(row.combatItemGrants).toEqual(before);
  expect(event).not.toHaveProperty('combatItemGrants');
});

it('records logical time before acquisition without adding bytes to an unowned save',()=>{
  const open=reachRound('2-1',false,firstNodeSeed('starry-night', 101)),timed=advanceAugmentPreparationTime(open,10000);
  expect(serializeMatch(timed)).toBe(serializeMatch(open));
  const c=timed.pendingChoice!,picked=accepted(selectChoice(timed,c.choiceId,c.generation,'starry-night'));
  expect(requireAugmentFacts(picked,'acquire',picked.round)[0].preparationElapsedMs).toBe(10000);
  const advanced=advanceAugmentPreparationTime(picked,12500);
  expect(restoreMatch(serializeMatch(advanced))).toEqual(advanced);
});

describe('solo live combat evidence',()=>{
  let terminal:MatchState;
  let eventDeaths:readonly {unitId:string;eventSeq?:number}[];
  beforeAll(()=>{
    const hero=acquired.preparation.units.find(u=>u.team==='player')!;
    let s=accepted(deployMatchUnit(acquired,hero.id,{kind:'board',cell:{col:0,row:4}}));
    s=accepted(startMatchCombat(s));const deaths:{unitId:string;eventSeq?:number}[]=[];
    while(s.phase==='combat'){const step=stepMatch(s);s=step.state;for(const e of step.events)if(e.type==='death')deaths.push(e);}
    terminal=s;eventDeaths=deaths;
    expect(deaths.length).toBeGreaterThan(0);
  });
  it('records every real death through Match event stamping and carries tick completeness',()=>{
    const rows=requireAugmentFacts(terminal,'deaths',terminal.round);
    expect(rows.flatMap(f=>f.deaths.map(d=>({unitId:d.unitId,eventSeq:d.eventSeq})))).toEqual(eventDeaths.map(e=>({unitId:e.unitId,eventSeq:e.eventSeq})));
    expect(rows.at(-1)!.completeThroughTick).toBe(terminal.combat!.tick);
  });
  for(const entry of entries)it(`authenticates actual deaths at ${entry} restore`,()=>{
    expect(restore(terminal,entry)).toEqual(terminal);
    const forged:any=structuredClone(terminal),row=forged.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.deaths.length);
    row.deaths[0].equipment.push({definitionId:'chain-vest',slot:0,temporary:false});
    expect(()=>restore(forged,entry)).toThrow(/augment history/);
  });
});

import { BattleHistory } from '../src/replay/history';
import { recordCommand, recordedEmptyRoute } from './fixtures/recorded-empty-route';
import { exportFile, validateFile } from '../src/persistence/format';
import type { SaveEnvelope } from '../src/m6/contracts';
import { M8_VERSION } from '../src/simulation/m8/version';

it('keeps the existing save/replay envelope versions and authenticates a carried history through BattleRecord',async()=>{
  const history=new BattleHistory('augment-history-envelope');
  let s=recordedEmptyRoute(firstNodeSeed('starry-night', 101),'2-1',history),c=s.pendingChoice!;
  s=accepted(selectChoice(s,c.choiceId,c.generation,'starry-night'));
  s=accepted(recordCommand(history,s,startMatchCombat(emptyBoard(s))));s=resolveM5Choices(s);s=accepted(nextRound(s,s.round));
  const envelope:SaveEnvelope={kind:'hex-autobattler-save',saveFormatVersion:M8_VERSION.saveFormatVersion,replayFormatVersion:M8_VERSION.replayFormatVersion,
    runId:'augment-history-envelope',createdAt:'2026-10-27T00:00:00.000Z',match:s,battles:history.completedRecords,currentBattle:null};
  expect(envelope.saveFormatVersion).toBe(8);expect(envelope.replayFormatVersion).toBe(8);
  expect(await validateFile(exportFile(envelope),()=>{})).toEqual(envelope);
  const bad:any=structuredClone(envelope);delete bad.match.augmentHistory;
  await expect(validateFile(exportFile(bad),()=>{})).rejects.toThrow('missing augment-history-v1');
});
