import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { requireAugmentFacts } from '../../src/simulation/augment-history';
import { voidSwarmPortals } from '../fixtures/m5/oracle.g2.cjs';

// v26 D5 pool (7953c99a): real 2-1 draw with Void Swarm on a human seat is now seed 47 seat s0 (was seed 7 seat s3; seed 76 s1 also draws it but its 3-7..4-1 leg is ~3x slower).
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:47});
const seatId='s0',mine=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
const portals=()=>mine().seatMechanics?.receipts.filter(r=>r.kind==='item'&&r.definitionId==='TFT5_Item_ZzRotPortalRadiant')??[];
afterAll(()=>room.dispose());
it('B5-73 starts a real room',()=>{room.start();});
for(const round of ['1-3','1-4','2-1'])it(`B5-73 reaches ${round}`,()=>{
  runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase==='preparation');
});
it('B5-73 public choose/equip grants a single real portal',()=>{
  const c=mine().pendingChoice!;expect(c.offers).toContain('void-swarm');
  expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'void-swarm'})).toMatchObject({ok:true});
  expect(portals()).toHaveLength(1);
  const portal=mine().items.find(i=>i.definitionId==='TFT5_Item_ZzRotPortalRadiant')!,hero=mine().preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
  expect(hero).toBeDefined();expect(room.handle(seatId,{type:'equip',itemId:portal.id,unitId:hero.id,slot:0})).toMatchObject({ok:true});
  const bad=room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'void-swarm'});expect(bad.ok).toBe(false);expect(portals()).toHaveLength(1);
});
it('B5-73 acquisition save round-trips and rejects missing history, forged grants and untrusted authority',()=>{
  const s=mine(),authority=room.augmentHistoryAuthority(seatId);
  for(const form of ['object','json','serialized'] as const){
    const input=form==='object'?s:form==='json'?JSON.stringify(s):canonicalContent(s);
    expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
    for(const edit of [(v:any)=>{delete v.augmentHistory;},(v:any)=>{v.items.find((i:any)=>i.definitionId==='TFT5_Item_ZzRotPortalRadiant').definitionId='belt';},(v:any)=>{v.augmentHistory.facts[0].hpBefore--;}]){
      const bad=structuredClone(s);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,form==='object'?bad:JSON.stringify(bad),authority)).toThrow();
    }
  }
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,s,{} as typeof authority)).toThrow(/authority/);
  const erased=structuredClone(s) as any;erased.augments=erased.augments.filter((a:any)=>a.definitionId!=='void-swarm');delete erased.augmentHistory;
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,erased)).toThrow();
});
it('B5-73 actual room opening spawns the approved large voidling with the linkage',()=>{
  runUntilClaiming(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement');
  const b=room.state.battles.find(b=>b.kind==='two-sided'&&b.participants.includes(seatId));expect(b?.kind).toBe('two-sided');if(b?.kind!=='two-sided')throw Error('missing battle');
  const big=b.battle.initial.units.find(u=>u.itemSummon?.kind==='voidspawn');
  expect(big).toMatchObject({maxHp:1000,attackDamage:80,baseAttackSpeedBps:8000,attackSpeedBonusBps:4000,armor:30,magicResist:30});
  expect(requireAugmentFacts(mine(),'pvp-roster',mine().round)).toHaveLength(1);expect(portals()).toHaveLength(1);expect(room.state.fault).toBeNull();
});
for(const round of ['2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2','3-3','3-4','3-5','3-6','3-7']){
 it(`B5-73 counts only completed player combats through ${round}`,()=>{
  runUntilClaiming(room,clock,s=>s.roundId===round&&(s.roundKind==='supply'||s.phase==='preparation'));
  expect(portals()).toHaveLength(voidSwarmPortals(mine().roundResults,4));
  expect(portals()).toHaveLength(1);expect(room.state.fault).toBeNull();
});
 if(round==='2-7')it('B5-73 persists its real online PvE summon and authenticates the combat save',()=>{
  runUntilClaiming(room,clock,s=>s.roundId==='2-7'&&s.phase==='settlement');
  const s=mine(),authority=room.augmentHistoryAuthority(seatId);
  expect(s.combat?.units.some(u=>u.itemSummon?.kind==='voidspawn')).toBe(true);
  for(const input of [s,JSON.stringify(s),canonicalContent(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
  const bad=structuredClone(s) as any;bad.combat.units.find((u:any)=>u.itemSummon?.kind==='voidspawn').maxHp++;
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,authority)).toThrow();
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(bad),authority)).toThrow();
  expect(portals()).toHaveLength(1);
 });
}
it('B5-73 reaches the eleventh PvP',()=>{runUntilClaiming(room,clock,s=>s.roundId==='4-1'&&s.phase==='preparation');});
it('B5-73 pays exactly once after eleven actual PvPs and authenticates all history/rewards',()=>{
  runUntilClaiming(room,clock,s=>s.roundId==='4-1'&&s.phase==='settlement');
  expect(mine().roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=4)).toHaveLength(11);expect(portals()).toHaveLength(2);
  const s=mine(),authority=room.augmentHistoryAuthority(seatId);
  for(const input of [s,JSON.stringify(s),canonicalContent(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
  for(const edit of [(x:any)=>{x.augmentHistory.facts=x.augmentHistory.facts.filter((f:any)=>f.kind!=='pvp-roster'||f.round!==4);},(x:any)=>{x.seatMechanics.receipts.findLast((r:any)=>r.kind==='item'&&r.definitionId==='TFT5_Item_ZzRotPortalRadiant').round--;}]){
    const bad=structuredClone(s);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,authority)).toThrow();expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(bad),authority)).toThrow();
  }
});
it('B5-73 next preparation does not repay the threshold',()=>{
  runUntilClaiming(room,clock,s=>s.roundId==='4-2'&&s.phase==='preparation');expect(portals()).toHaveLength(2);expect(room.state.fault).toBeNull();
});
