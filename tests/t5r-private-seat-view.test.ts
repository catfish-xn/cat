import { describe, expect, it } from 'vitest';
import { toPrivateSeatView, createMatch, advanceMultiplayerRound, equipItem, getDeploymentCap, priorPvpWins,
  type MatchState, type PrivateSeatView } from '../src/server-entry';
import { getPlayerDeploymentCount } from '../src/simulation/game';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { readItemInventory, readUnitEquipment } from '../src/simulation/item-selectors';
import { accepted, finalSettlement, catalogPreparation } from './t5r-helpers';
import { freeze } from './combat-helpers';
import { readEncounterPreview } from '../src/simulation/encounter-selectors';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import type { MechanicReceipt } from '../src/simulation/seat-mechanics/types';

type Subset<T> = T extends readonly (infer V)[] ? readonly Subset<V>[] : T extends object ? {[K in keyof T]?:Subset<T[K]>} : T;
// Core fields remain a recursive subset. openingEncounter is an explicit public projection.
const asSubset = (view:PrivateSeatView):Subset<Omit<MatchState, 'openingEncounter'>> => view;
function sentinels(value:unknown):void {
  if(value===null||typeof value!=='object') return;
  // Generic owner-visible payload is explicitly public JSON, not a field whitelist.
  for(const [key,child] of Object.entries(value)) if(key!=='seat') sentinels(child);
  if(!Array.isArray(value)) Object.assign(value,{rngState:'DO_NOT_SEND',futurePlan:'DO_NOT_SEND'});
}
function noReferences(a:unknown,b:unknown):void {
  if(!a||typeof a!=='object')return;
  expect(a).not.toBe(b);
  for(const [key,value] of Object.entries(a)) if(b&&typeof b==='object') noReferences(value,(b as Record<string,unknown>)[key]);
}
function richSeat():MatchState {
  let state=accepted(advanceMultiplayerRound(finalSettlement(),38));const id=state.preparation.units[0].id;
  state=accepted(equipItem({...state,items:[{id:'item-1',definitionId:'thiefs-gloves',location:{kind:'inventory'}}]},'item-1',id,0));
  return {...state,phase:'choice',combat:null,pendingChoice:{kind:'augment',step:'offer',choiceId:'shown',eventId:'secret-event',
    generation:1,offers:['placebo','manaflow-i','backup'],targetId:null,rerollCount:1,
    augmentTier:'silver',rerollsRemaining:2,rerolledSlots:[true,false,false],returnPhase:'preparation'},
    shop:{generation:17,locked:true,slots:[{status:'available',definitionId:'maddie'},{status:'purchased',empty:true},{status:'purchased'}]},
    augments:[{definitionId:'pumping-up-i',choiceId:'known',acquiredRound:4}],
    anomalyBinding:{definitionId:'mage-armor',unitId:id,choiceId:'known-anomaly',boundRound:20},
    persistentGrowth:[{unitId:id,attackDamageBps:125},{unitId:'opponent',attackDamageBps:999}],
    preparation:{...state.preparation,units:[...state.preparation.units,{id:'opponent',definitionId:'maddie',starLevel:1,team:'enemy',location:{kind:'board',cell:{col:0,row:0}}}]},
    items:[...state.items,{id:'their-item',definitionId:'rod',location:{kind:'unit',unitId:'opponent',slot:0}}]};
}

describe('T5R private own-seat whitelist',()=>{
  it('whitelists fixed PvE remover receipts and every mechanic receipt variant without retaining input references',()=>{
    const state=richSeat();
    const remover=state.seatMechanics!.receipts.find(r=>r.source==='pve-remover')!;
    expect(remover).toMatchObject({kind:'consumable',definitionId:'magnetic-remover'});
    const identity={receiptId:'shown-receipt',round:1,roundId:'1-2',source:'shown-source'};
    const receipts:MechanicReceipt[]=[remover,
      {...identity,kind:'gold',amount:7},
      {...identity,kind:'unit',definitionId:'maddie',resolution:'held',unitId:'unit-1',gold:0},
      {...identity,kind:'unit',definitionId:'maddie',resolution:'gold',unitId:null,gold:1},
      {...identity,kind:'unit',definitionId:'maddie',resolution:'orb',unitId:null,gold:0,orbId:'earned-orb',starLevel:2},
      {...identity,kind:'item',definitionId:'sword',itemId:'item-1'},
      {...identity,kind:'choice',choiceKind:'forge',optionId:'warmog',skipped:false,price:0,itemId:'item-2',timedOut:true},
    ];
    const raw={...state,seatMechanics:{...state.seatMechanics!,receipts:structuredClone(receipts)}};
    for(const receipt of raw.seatMechanics.receipts)Object.assign(receipt,{futurePlan:{secret:'DO_NOT_SEND'},rngState:123});
    const before=JSON.stringify(raw),view=toPrivateSeatView(raw);
    expect(view.seatMechanics!.receipts).toEqual(receipts);
    expect(JSON.stringify(view)).not.toMatch(/futurePlan|rngState|DO_NOT_SEND/);
    expect(JSON.stringify(raw)).toBe(before);noReferences(view.seatMechanics!.receipts,raw.seatMechanics.receipts);
    for(const receipt of raw.seatMechanics.receipts)expect(Object.isFrozen(receipt)).toBe(false);
    for(const receipt of view.seatMechanics!.receipts)expect(Object.isFrozen(receipt)).toBe(true);
  });
  it.each(ROUND_CATALOG.filter(r=>r.kind==='pve').map(r=>r.roundId))('SR-B7-02 %s: current public preview survives display adaptation without hidden fields',roundId=>{
    const state=catalogPreparation(roundId),before=JSON.stringify(state),view=toPrivateSeatView(freeze(state));
    expect(asSubset(view)).toBe(view);
    const shown=state.m8.preparation.enemies.map(({encounterId:_,...unit})=>unit);
    expect(view.m8.preparation?.enemies).toEqual(shown);
    expect(view.preparation.units.filter(u=>u.team==='enemy')).toEqual(shown);
    // Only displayed fields and harmless required metadata are restored, never hidden enemy plans.
    const base=createMatch(777);
    const display:MatchState={...base,preparation:view.preparation,
      round:view.round,roundDefinitionId:view.roundDefinitionId,
      m8:{...base.m8,round:{...view.m8.round,isFinal:false},
        preparation:{version:'m8-b8-preparation-v1',contentStatus:'ready-b8-loot',...view.m8.preparation!}}};
    expect(readEncounterPreview(display)).toEqual(readEncounterPreview(state));
    const injected=structuredClone(state);sentinels(injected);
    expect(toPrivateSeatView(injected)).toEqual(view);expect(JSON.stringify(view)).not.toMatch(/rng|futurePlan|loot|encounterPlan/);
    expect(JSON.stringify(state)).toBe(before);noReferences(view,state);
  });
  it('SR-B7-02 omits stale/future previews and all PvP/supply enemy templates',()=>{
    const state=catalogPreparation('3-7');
    for(const changed of [
      {...state,m8:{...state.m8,preparation:{...state.m8.preparation,roundId:'4-7'}}},
      {...state,m8:{...state.m8,preparation:{...state.m8.preparation,encounterId:'razorbeaks-v1'}}},
      catalogPreparation('2-1'),catalogPreparation('2-4'),
    ]) {
      const view=toPrivateSeatView(changed);
      expect(view.m8).not.toHaveProperty('preparation');expect(view.preparation.units.every(u=>u.team==='player')).toBe(true);
    }
  });
  it('SR-B7-02 preserves committed interest basis separately from current gold and interest income',()=>{
    const state=richSeat(),record=state.roundResults[0];
    const view=toPrivateSeatView({...state,gold:99,roundResults:[{...record,interestBasis:37,
      incomeBreakdown:{...record.incomeBreakdown,interest:3}}]});
    expect(view.roundResults[0].interestBasis).toBe(37);expect(view.roundResults[0].incomeBreakdown.interest).toBe(3);
    expect(view.roundResults[0]).not.toHaveProperty('settlementId');
  });
  it('projects each committed roundKind so the display can count prior PvP wins (Emissary) without the catalog',()=>{
    const state=richSeat(),record=state.roundResults[0];
    const kinds=['pve','pvp','pvp','supply','pvp'] as const,results=['playerWin','playerWin','enemyWin',undefined,'playerWin'] as const;
    const roundResults=kinds.map((roundKind,i)=>({...record,round:i+1,roundKind,result:results[i] ?? 'supply'})) as MatchState['roundResults'];
    const view=toPrivateSeatView({...state,roundResults});
    expect(view.roundResults.map(r=>r.roundKind)).toEqual([...kinds]);
    expect(priorPvpWins(view.roundResults,6)).toBe(priorPvpWins(roundResults,6));
    expect(priorPvpWins(view.roundResults,6)).toBe(2);
  });
  it('keeps exact Match names/nesting, shown choices, empty slots, own inventory and history',()=>{
    const state=richSeat(),view=toPrivateSeatView(freeze(state));expect(asSubset(view)).toBe(view);
    expect(view.shop).toEqual(state.shop);expect(view.pendingChoice).toEqual({kind:'augment',step:'offer',choiceId:'shown',
      generation:1,offers:['placebo','manaflow-i','backup'],targetId:null,rerollCount:1,
      augmentTier:'silver',rerollsRemaining:2,rerolledSlots:[true,false,false],augmentOptions:[
        {optionIndex:0,definitionId:'placebo',rerollAvailable:false},
        {optionIndex:1,definitionId:'manaflow-i',rerollAvailable:true},
        {optionIndex:2,definitionId:'backup',rerollAvailable:true},
      ]});
    expect(view.temporaryEquipment).toEqual(state.temporaryEquipment);expect(view.augments).toEqual(state.augments);
    expect(view.anomalyBinding).toEqual(state.anomalyBinding);expect(view.roundResults).toHaveLength(38);
    expect(view.m8.round).toMatchObject({roundId:'overtime-1',kind:'pvp'});
    expect(JSON.stringify(view)).not.toMatch(/opponent|their-item|secret-event|settlementId/);
    expect(view.preparation.units.every(u=>u.team==='player')).toBe(true);
    expect(Object.keys(view).sort()).toEqual(['openingEncounterProgress','openingEncounter','schemaVersion','rulesVersion','contentVersion','contentDigest','commandProtocolVersion','tickMs',
      'round','roundDefinitionId','phase','gold','level','xp','playerHp','streak','shop','preparation','items','temporaryEquipment','augments',
      'anomalyBinding','persistentGrowth','augmentProgress','pendingChoice','roundResults','m8','consumables','consumableTargets','seatMechanics',
      'unclaimedOrbs','orbClaimReceipts','familyReunion','shopOdds'].sort());
    expect(view.unclaimedOrbs).toEqual([]);expect(view.orbClaimReceipts).toEqual([]);
  });
  it('hidden RNG/future plans never affect output; nested sentinel additions never leak',()=>{
    const state=richSeat(),before=JSON.stringify(state),expected=toPrivateSeatView(state),hidden=structuredClone(state);
    Object.assign(hidden,{seed:999,rngState:123,battleSeedRngState:321,choiceRngState:444,rewardRngState:555,
      combatInputBasis:{secret:'DO_NOT_SEND'},resourceProvenance:{secret:'DO_NOT_SEND'},equipmentState:{...hidden.equipmentState,equipment:{state:123,draws:999},secret:'DO_NOT_SEND'}});
    // Loot now also supplies earned orb projections; preserve that ledger while changing only hidden data.
    Object.assign(hidden.m8.loot,{secret:'DO_NOT_SEND'});
    Object.assign(hidden.m8.loot.frozen.rng,{state:123,draws:999});
    for(const round of hidden.m8.loot.frozen.rounds) {
      for(const drop of round.encounterPlan.drops) if(hidden.m8.loot.direct.some(d=>d.dropId===drop.dropId&&d.status==='planned'))
        Object.assign(drop,{payload:{kind:'gold',quantity:999}});
      for(const choice of round.choices) Object.assign(choice,{terminalFallbackDefinitionId:'DO_NOT_SEND'});
      for(const orb of round.orbs) for(const entry of orb.entries) if(hidden.m8.loot.direct.some(d=>d.dropId===entry.dropId&&d.status==='planned'))
        Object.assign(entry,{payload:{kind:'gold',quantity:999}});
    }
    Object.assign(hidden.m8,{encounterPlan:{secret:'DO_NOT_SEND'}});
    expect(toPrivateSeatView(hidden)).toEqual(expected);
    const injected=structuredClone(state);sentinels(injected);
    expect(toPrivateSeatView(injected)).toEqual(expected);expect(JSON.stringify(toPrivateSeatView(injected))).not.toContain('DO_NOT_SEND');
    expect(JSON.stringify(state)).toBe(before);noReferences(expected,state);expect(Object.isFrozen(expected)).toBe(true);
  });
  it('does not display stale choices or temporary equipment from another round/holder/parent',()=>{
    const state=richSeat();const changed={...state,phase:'preparation' as const,combat:null,
      temporaryEquipment:state.temporaryEquipment.map(t=>({...t,roundId:'previous'}))};
    expect(toPrivateSeatView(changed).pendingChoice).toBeNull();expect(toPrivateSeatView(changed).temporaryEquipment).toEqual([]);
    expect(toPrivateSeatView({...state,items:[]}).temporaryEquipment).toEqual([]);
  });
  it('documented display selectors see the same data with private fields replaced',()=>{
    const state=richSeat(),view=toPrivateSeatView(state);
    const display:MatchState={...createMatch(777),...view,openingEncounter:state.openingEncounter,phase:'choice',combat:null,
      pendingChoice:view.pendingChoice?{...view.pendingChoice,eventId:'display-only'}:null,
      roundResults:view.roundResults.map(r=>({...r,settlementId:'display-only',
        streakBefore:{kind:null,count:0},streakAfter:{kind:null,count:0},xpRequested:0})),
      m8:{...createMatch(777).m8,round:{...view.m8.round,isFinal:false}}};
    expect(getDeploymentCap(display)).toBe(getDeploymentCap(state));
    expect(getPlayerDeploymentCount(display.preparation)).toBe(getPlayerDeploymentCount(state.preparation));
    expect(deriveTraits(display.preparation,'player')).toEqual(deriveTraits(state.preparation,'player'));
    expect(readItemInventory(display)).toEqual(readItemInventory(state));
    expect(readUnitEquipment(display,state.preparation.units[0].id)).toEqual(readUnitEquipment(state,state.preparation.units[0].id));
  });
});
