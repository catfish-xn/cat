import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appendResourceProvenance, RESOURCE_PROVENANCE_VERSION, type ResourceProvenanceContext } from '../src/simulation/resource-provenance';
import { foldResourceProvenance } from '../src/simulation/restore-checks/fold-provenance';
import type { MechanicReceipt } from '../src/simulation/seat-mechanics/types';
import { receiptId, SHOP_AUGMENT_SOURCE } from '../src/simulation/shop-augments';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { answerOpenChoices, makeRoom, runUntil } from './server/helpers';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';

// Isolated ledger vector: tests the supply-birth binding, not a full playable match or shop RNG proof.
function fixture() {
  const owner={definitionId:'firesale',choiceId:'round:3-2:augment',acquiredRound:12};
  const receipt:Extract<MechanicReceipt,{kind:'unit'}>={kind:'unit',source:SHOP_AUGMENT_SOURCE,
    receiptId:receiptId('firesale',owner,14),round:14,roundId:'3-4',definitionId:'lux',
    resolution:'held',unitId:'unit-2',gold:0};
  const opening=appendResourceProvenance({version:RESOURCE_PROVENANCE_VERSION,equipmentHistory:'ordered',entries:[]},'1-2',
    {kind:'unit-acquired',unitId:'unit-1',source:{kind:'opening',seed:42,seatId:'solo'}});
  const provenance=appendResourceProvenance(opening,'3-4',
    {kind:'unit-acquired',unitId:'unit-2',source:{kind:'mechanic',receiptId:receipt.receiptId}});
  const context:ResourceProvenanceContext={throughRoundOrdinal:14,combatSettlements:[],lootReceipts:[],
    scheduleReceipts:[{eventId:owner.choiceId,round:12,kind:'augment',definitionId:'firesale',itemIds:[],unitId:null,gold:1}],
    mechanicReceipts:[receipt]};
  return {provenance,context,receipt};
}

it('folds the exact Firesale supply birth without changing the ledger or its earlier prefix',()=>{
  const {provenance,context}=fixture(),before=JSON.stringify({provenance,context});
  expect(foldResourceProvenance(provenance,context)).toEqual({
    units:[{id:'unit-1',definitionId:'irelia',starLevel:1},{id:'unit-2',definitionId:'lux',starLevel:1}],
    items:[],persistentGrowth:[],nextUnitSerial:3,nextItemSerial:1,
  });
  expect(foldResourceProvenance(provenance,{...context,prefixLength:1})).toEqual({
    units:[{id:'unit-1',definitionId:'irelia',starLevel:1}],items:[],persistentGrowth:[],nextUnitSerial:2,nextItemSerial:1,
  });
  expect(JSON.stringify({provenance,context})).toBe(before);
});

it.each([
  {source:'test'}, {receiptId:'unrelated-supply-birth'}, {round:13}, {roundId:'3-3'},
  {unitId:'unit-3'}, {resolution:'orb' as const},
])('rejects a supply birth with an unbound mechanic receipt %j',patch=>{
  const {provenance,context,receipt}=fixture();
  expect(()=>foldResourceProvenance(provenance,{...context,mechanicReceipts:[{...receipt,...patch}]})).toThrow('unit birth in supply');
});

it('rejects joint generic-receipt substitution and missing or different augment ownership',()=>{
  const {provenance,context,receipt}=fixture();
  const unrelated='unrelated-supply-birth';
  const joint={...provenance,entries:provenance.entries.map(e=>e.kind==='unit-acquired'&&e.source.kind==='mechanic'
    ?{...e,source:{kind:'mechanic' as const,receiptId:unrelated}}:e)};
  expect(()=>foldResourceProvenance(joint,{...context,mechanicReceipts:[{...receipt,receiptId:unrelated,source:'test'}]}))
    .toThrow('unit birth in supply');
  expect(()=>foldResourceProvenance(provenance,{...context,scheduleReceipts:[]})).toThrow('unit birth in supply');
  expect(()=>foldResourceProvenance(provenance,{...context,scheduleReceipts:context.scheduleReceipts.map(r=>({...r,definitionId:'moonlight'}))}))
    .toThrow('unit birth in supply');
});

it('rejects a supply birth bound to a later, structurally valid augment selection',()=>{
  const {provenance,context,receipt}=fixture();
  const later={definitionId:'firesale',choiceId:'round:4-2:augment',acquiredRound:19};
  const id=receiptId('firesale',later,14);
  const forged={...provenance,entries:provenance.entries.map(e=>e.kind==='unit-acquired'&&e.source.kind==='mechanic'
    ?{...e,source:{kind:'mechanic' as const,receiptId:id}}:e)};
  expect(()=>foldResourceProvenance(forged,{...context,throughRoundOrdinal:19,
    mechanicReceipts:[{...receipt,receiptId:id}],
    scheduleReceipts:context.scheduleReceipts.map(r=>({...r,eventId:later.choiceId,round:later.acquiredRound})),
  })).toThrow('unit birth in supply');
});

it('rejects a missing held-unit receipt or a repeated Firesale birth',()=>{
  const {provenance,context}=fixture();
  expect(()=>foldResourceProvenance(provenance,{...context,mechanicReceipts:[]})).toThrow('unit birth in supply');
  const duplicated=appendResourceProvenance(provenance,'3-4',
    {kind:'unit-acquired',unitId:'unit-3',source:{kind:'mechanic',receiptId:context.mechanicReceipts![0].receiptId}});
  expect(()=>foldResourceProvenance(duplicated,context)).toThrow('unit birth in supply');
});

describe('eight-seat Firesale supply grant',()=>{
  // Multiplayer restore does not pass through fold; this case only covers fold's binding itself.
  const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:1});
  let restoreOffers:()=>void;
  beforeAll(()=>{restoreOffers=installB1Offers(['firesale']);room.start();});
  afterAll(()=>{room.dispose();restoreOffers?.();});
  // Traverse one public round per hook, retaining the existing timeout and timer budget.
  for(const round of [2,3,4,5,6,8,9,10,11,12])beforeAll(()=>{
    runUntil(room,clock,s=>{
      if(s.round===round&&s.phase==='preparation')return true;
      if(s.phase==='preparation')answerOpenChoices(room);
      return false;
    });
  });
  it('binds the real grant without changing authoritative state',()=>{
    const owner=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('firesale'));
    expect(owner).toBeDefined();
    const choice=owner!.match.pendingChoice!;
    // Scripted eligible 3-2 draw only; this is a fixture self-check, not a natural-offer claim.
    expect(choice.offers).toContain('firesale');
    expect(room.handle(owner!.seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,
      definitionId:'firesale'})).toMatchObject({ok:true});
    answerOpenChoices(room);
    runUntil(room,clock,s=>s.round===14);
    const state=room.state.seats.find(s=>s.seatId===owner!.seatId)!.match,pool=room.state.pool;
    const receipt=state.seatMechanics!.receipts.find(r=>r.source===SHOP_AUGMENT_SOURCE&&r.round===14);
    expect(receipt).toMatchObject({kind:'unit',roundId:'3-4',resolution:'held'});
    if(receipt?.kind!=='unit'||receipt.resolution!=='held')throw Error('missing held Firesale supply grant');
    expect(state.resourceProvenance.entries).toContainEqual(expect.objectContaining({kind:'unit-acquired',
      unitId:receipt.unitId,roundId:'3-4',source:{kind:'mechanic',receiptId:receipt.receiptId}}));
    const before=JSON.stringify({state,pool});
    const folded=foldResourceProvenance(state.resourceProvenance,{
      scheduleReceipts:state.scheduleReceipts,lootReceipts:state.m8.loot.receipts,
      mechanicReceipts:state.seatMechanics?.receipts,throughRoundOrdinal:state.round,
      carouselReceipts:state.carousel?.receipts,pendingCarouselUnitIds:state.carousel?.pendingUnits.map(u=>u.unitId),
      carouselOpening:!!state.carousel,g23:readG23Progress(state),
      combatSettlements:state.roundResults.filter(r=>r.roundKind==='pve').map(r=>({roundId:r.roundId,
        combatId:`round-${r.round}`,settlementId:r.settlementId})),
    });
    expect(folded.units).toContainEqual({id:receipt.unitId,definitionId:receipt.definitionId,starLevel:receipt.starLevel??1});
    for(const input of [state,JSON.stringify(state)]){
      expect(restoreSharedOrbSnapshot(pool,input,room.augmentHistoryAuthority(owner!.seatId))).toEqual(state);
    }
    expect(JSON.stringify({state,pool})).toBe(before);
  });
});
