import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { createMatch } from '../../src/simulation/match';
import { createOpeningEncounter, bindSharedOpeningEncounter } from '../../src/simulation/opening-encounter';
import { resolveAugmentTier } from '../../src/simulation/augment-offers';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { validateLuckyGlovesEquipment, luckyGlovesPair } from '../fixtures/m5/oracle.g2.cjs';
import type { MatchState } from '../../src/simulation/match-types';

const seed=Array.from({length:101},(_,i)=>i).find(seed=>{
  const s={...createMatch(1,{mode:'shared-deferred'}),augmentTierSeed:seed,openingEncounter:bindSharedOpeningEncounter(createOpeningEncounter(seed),'test-room','s0')};
  return resolveAugmentTier(s,'round:2-1:augment')==='gold' && resolveAugmentTier(s,'round:3-2:augment')==='prismatic';
});
if(seed===undefined)throw Error('no prismatic 3-2 in seeds 0..100');
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed});
let seatId:string;
const current=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
afterAll(()=>room.dispose());
it('starts the room for B5-54',()=>{room.start();});
for(const round of ['1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2'])it(`reaches ${round}`,()=>{
  answerOpenChoices(room);
  runUntilClaiming(room,clock,s=>s.roundId===round&&(round==='2-4'||s.phase==='preparation'));
});
it('takes the real B5-54 offer, immediately grants three gloves and equips two as a parent',()=>{
  for(const id of ['s0','s1','s2','s3'])for(let slot=0;slot<3&&!room.state.seats.some(s=>s.match.pendingChoice?.offers.includes('lucky-gloves-plus'));slot++){
    const c=room.state.seats.find(s=>s.seatId===id)!.match.pendingChoice!;
    expect(room.handle(id,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});
  }
  const seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('lucky-gloves-plus'));
  expect(seat,`seed ${seed}`).toBeDefined();if(!seat)throw Error('no Lucky Gloves+ offer');seatId=seat.seatId;
  const c=seat.match.pendingChoice!,before=seat.match;
  expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'lucky-gloves-plus'})).toMatchObject({ok:true});
  const receipts=current().seatMechanics!.receipts.slice(before.seatMechanics?.receipts.length??0).filter(r=>r.receiptId.includes('lucky-gloves-plus'));
  expect(receipts).toHaveLength(3);expect(receipts.every(r=>r.kind==='item'&&r.definitionId==='gloves')).toBe(true);
  const gloves=current().items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  expect(room.handle(seatId,{type:'combine',a:gloves[0].id,b:gloves[1].id})).toMatchObject({ok:true});
  const parent=current().items.find(i=>i.definitionId==='thiefs-gloves'&&i.location.kind==='inventory')!,holder=current().preparation.units.find(u=>u.team==='player')!;
  expect(room.handle(seatId,{type:'equip',itemId:parent.id,unitId:holder.id,slot:0})).toMatchObject({ok:true});
  const s=current(),roll=s.equipmentState.rolls.at(-1)!;
  expect(roll.poolVersion).toBe('lucky-gloves-v1');
  expect(roll.children).toEqual(luckyGlovesPair((s.seed^0x243f6a88)>>>0,roll.rngDrawStart,roll.lucky!.role).children);
  validateLuckyGlovesEquipment(s);assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
});
it('B5-54 restores object/JSON/canonical saves and rejects independent tampering',()=>{
  const state=current(),authority=room.augmentHistoryAuthority(seatId);
  for(const encode of [(s:MatchState):unknown=>s,(s:MatchState):unknown=>JSON.stringify(s),(s:MatchState):unknown=>canonicalContent(s)]){
    expect(restoreSharedOrbSnapshot(room.state.pool,encode(state),authority)).toEqual(state);
    for(const edit of [
      (s:any)=>{s.seatMechanics.receipts.find((r:any)=>r.receiptId.includes('lucky-gloves-plus')).definitionId='sword';},
      (s:any)=>{s.equipmentState.rolls.at(-1).lucky.radiant=true;},
      (s:any)=>{s.equipmentState.rolls.at(-1).children[1]=s.equipmentState.rolls.at(-1).children[0];},
      (s:any)=>{s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='acquire');},
      (s:any)=>{delete s.augmentHistory;},
    ]){const bad=structuredClone(state);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(bad),authority)).toThrow();}
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(state))).toThrow('missing independent server authority');
  }
});
it('B5-54 freezes real recommended equipment for PvP and restores after the next entry',()=>{
  answerOpenChoices(room);runUntilClaiming(room,clock,s=>s.roundId==='3-3'&&s.phase==='preparation');
  const s=current();expect(s.augmentHistory!.facts.some(f=>f.kind==='pvp-roster'&&f.round===12)).toBe(true);
  expect(s.seatMechanics!.receipts.filter(r=>r.receiptId.includes('lucky-gloves-plus'))).toHaveLength(3);
  validateLuckyGlovesEquipment(s);
  expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(s),room.augmentHistoryAuthority(seatId))).toEqual(s);
});
