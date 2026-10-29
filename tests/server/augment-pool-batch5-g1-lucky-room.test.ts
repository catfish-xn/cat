import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming, claimAllOrbs, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { createMatch } from '../../src/simulation/match';
import { bindSharedOpeningEncounter, createOpeningEncounter, openingEncounterId } from '../../src/simulation/opening-encounter';
import { nextRandom } from '../../src/simulation/rng';
import { generateChoices } from '../../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../../src/simulation/augment-offers';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { luckyGlovesPair, validateLuckyGlovesEquipment, CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from '../fixtures/m5/oracle.g2.cjs';
import { validateRewards } from '../fixtures/m5/augment-rewards-oracle.cjs';
import { createRequire } from 'node:module';
const { validateTransition } = createRequire(import.meta.url)('../fixtures/m5/lucky-gloves-oracle.cjs') as {
  validateTransition(before: MatchState, after: MatchState, command: unknown): void;
};
import type { MatchState } from '../../src/simulation/match-types';

let found:{seed:number;seatId:string}|undefined;
for(let seed=0;seed<=100&&!found;seed++){
  let rng=seed;
  for(let index=0;index<4;index++){
    const d=nextRandom(rng);rng=d.state;
    const s={...createMatch(d.word,{mode:'shared-deferred'}),augmentTierSeed:seed,openingEncounter:bindSharedOpeningEncounter(createOpeningEncounter(seed),'test-room',`s${index}`)};
    if(generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],openingEncounterId(s),{node:'2-1',fieldedTraits:[],blocked:[]}),s.choiceRngState).offers.includes('lucky-gloves')){found={seed,seatId:`s${index}`};break;}
  }
}
if(!found)throw Error('no Lucky Gloves room offer in seeds 0..100');
const {seatId}=found,{room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:found.seed});
const current=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
const rewards=(s:MatchState)=>s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.receiptId.includes('lucky-gloves'));
afterAll(()=>room.dispose());
it('starts the online room',()=>{room.start();});
for(const round of ['1-3','1-4','2-1'])it(`reaches ${round} through real room commands`,()=>{
  runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase==='preparation');
});
it('chooses B5-53, combines its two gloves and equips the parent through Room.handle',()=>{
  const beforeChoice=current(),c=beforeChoice.pendingChoice!;expect(c.offers).toContain('lucky-gloves');
  const choose={type:'choose' as const,choiceId:c.choiceId,generation:c.generation,definitionId:'lucky-gloves'};
  expect(room.handle(seatId,choose)).toMatchObject({ok:true});
  expect(()=>validateTransition(beforeChoice,current(),choose)).not.toThrow();
  expect(rewards(current())).toHaveLength(2);
  const receipts=rewards(current());expect(receipts.every(r=>r.kind==='item'&&r.definitionId==='gloves')).toBe(true);
  claimAllOrbs(room,[seatId]);
  const gloves=current().items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  expect(room.handle(seatId,{type:'combine',a:gloves[0].id,b:gloves[1].id})).toMatchObject({ok:true});
  const parent=current().items.find(i=>i.definitionId==='thiefs-gloves')!,holder=current().preparation.units.find(u=>u.team==='player')!;
  const beforeEquip=current(), command={type:'equip' as const,itemId:parent.id,unitId:holder.id,slot:0 as const};
  const equip=room.handle(seatId,command);expect(equip).toMatchObject({ok:true});
  if(!equip.ok)throw Error(equip.reason);
  const state=current(),roll=state.equipmentState.rolls.at(-1)!;
  expect(found).toEqual({seed:10,seatId:'s3'});
  expect(beforeEquip.equipmentState.rolls).toHaveLength(0);
  expect(roll.rngDrawStart).toBe(0);
  const env={CATALOG,COST,ROUNDS,xp,entryXp,benchXp};
  const check=(candidate:MatchState)=>{
    validateRewards(beforeEquip,candidate,command,equip.events,env);
    validateTransition(beforeEquip,candidate,command);
  };
  expect(()=>check(state)).not.toThrow();
  const wrongLevel=structuredClone(state) as any;wrongLevel.equipmentState.rolls.at(-1).playerLevelSnapshot++;
  expect(wrongLevel.equipmentState.rolls.at(-1).playerLevelSnapshot).toBe(state.level+1);
  expect(()=>validateRewards(beforeEquip,wrongLevel,command,equip.events,env)).toThrow(/independent command equipment level/);
  expect(()=>validateTransition(beforeEquip,wrongLevel,command)).toThrow(/independent command equipment level/);
  const missing=structuredClone(state) as any;
  missing.equipmentState=structuredClone(beforeEquip.equipmentState);
  const duplicated=structuredClone(state) as any;
  duplicated.equipmentState.rolls.push(structuredClone(duplicated.equipmentState.rolls.at(-1)));
  const skipped=structuredClone(state) as any;
  const shifted=luckyGlovesPair((state.seed^0x243f6a88)>>>0,8,roll.lucky!.role);
  expect(shifted.children).not.toEqual(roll.children);
  Object.assign(skipped.equipmentState.rolls.at(-1),{rngDrawStart:8,rngDrawEnd:shifted.draws,children:shifted.children});
  skipped.equipmentState.equipment={state:shifted.state,draws:shifted.draws};
  skipped.temporaryEquipment.forEach((child:any,index:number)=>{child.definitionId=shifted.children[index];});
  const erased=structuredClone(missing);erased.temporaryEquipment=[];
  const missingChild=structuredClone(state) as any;missingChild.temporaryEquipment.pop();
  for(const [bad,reason] of [
    [missing,/independent required lucky caches/],
    [duplicated,/duplicate independent equipment cache/],
    [skipped,/independent equipment draw start/],
    [erased,/independent required lucky caches/],
    [missingChild,/independent current temporary equipment/],
  ] as const){
    // The complete rewards entry point itself must reach and reject each forged equipment field.
    expect(()=>validateRewards(beforeEquip,bad,command,equip.events,env)).toThrow(reason);
    expect(()=>validateTransition(beforeEquip,bad,command)).toThrow(reason);
  }
  expect(roll.poolVersion).toBe('lucky-gloves-v1');expect(roll.lucky?.holderId).toBe(holder.id);
  expect(roll.children).toEqual(luckyGlovesPair((state.seed^0x243f6a88)>>>0,roll.rngDrawStart,roll.lucky!.role).children);
  expect(state.temporaryEquipment.map(t=>t.definitionId)).toEqual(roll.children);
  validateLuckyGlovesEquipment(state);
  const before=current(),failed=room.handle(seatId,{type:'equip',itemId:state.temporaryEquipment[0].temporaryId,unitId:holder.id,slot:0});
  expect(failed.ok).toBe(false);expect(current()).toBe(before);
});
it('round trips all three online save forms and rejects reward, role, RNG and history tampering',()=>{
  const state=current(),authority=room.augmentHistoryAuthority(seatId);
  const edits:((s:any)=>void)[]=[
    s=>{s.seatMechanics.receipts.find((r:any)=>r.receiptId.includes('lucky-gloves')).definitionId='sword';},
    s=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>!r.receiptId.includes('lucky-gloves'));},
    s=>{s.equipmentState.rolls.at(-1).children[0]='sword';},
    s=>{s.equipmentState.rolls.at(-1).lucky.role='ADCarry';},
    s=>{s.equipmentState.equipment.state^=1;},
    s=>{s.temporaryEquipment[0].definitionId='sword';},
    s=>{s.augmentHistory.facts[0].roster.units=[];},
    s=>{delete s.augmentHistory;},
  ];
  for(const encode of [(s:MatchState):unknown=>s,(s:MatchState):unknown=>JSON.stringify(s),(s:MatchState):unknown=>canonicalContent(s)]){
    expect(restoreSharedOrbSnapshot(room.state.pool,encode(state),authority)).toEqual(state);
    for(const edit of edits){const bad=structuredClone(state);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(bad),authority)).toThrow();}
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(state))).toThrow('missing independent server authority');
  }
});
for(const [index,round] of ['2-2','2-3','2-4','2-5','2-6'].entries())it(`advances ${round}, paying the delayed glove only at entry five`,()=>{
  answerOpenChoices(room);
  runUntilClaiming(room,clock,s=>s.roundId===round&&(round==='2-4'||s.phase==='preparation'));
  expect(rewards(current())).toHaveLength(index===4?3:2);
  if(index===4){
    const state=current();expect(rewards(state).filter(r=>r.round===state.round)).toHaveLength(1);
    expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(state),room.augmentHistoryAuthority(seatId))).toEqual(state);
    assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
    expect(state.augmentHistory!.facts.some(f=>f.kind==='pvp-roster')).toBe(true);
  }
});
