import type { MatchState, MatchEvent } from './match-types';
import type { PendingCarouselUnit } from './carousel-types';
import type { GameState } from './game';
import { sameCell } from './board';
import { getCatalogRoundById } from './round-selectors';
import { planDeferredUpgrades, transferUpgradeResources } from './upgrades';
import { appendResourceProvenance, mergeGrowthLedger } from './resource-provenance';
import { canonicalContent } from './content';

/** The deprecated aliases are persisted for the current server adapter, never separate queues. */
export function validateCarouselMetadata(state: MatchState): void {
  const metadata=state.carousel;
  if (!metadata) return;
  const invalid=()=>{throw new Error('invalid-carousel-metadata');};
  if(metadata.openingPending!==undefined || !Array.isArray(metadata.receipts) || !Array.isArray(metadata.heldCarouselUnits)
    || !Array.isArray(metadata.pendingUnits) || !Array.isArray(metadata.preparationReceipts)
    || canonicalContent(metadata.pendingUnits)!==canonicalContent(metadata.heldCarouselUnits)) invalid();
  const settled=state.resourceProvenance.entries.filter(e=>e.kind==='carousel-preparation-settled').flatMap(e=>e.receiptIds);
  if(new Set(settled).size!==settled.length || canonicalContent(settled)!==canonicalContent(metadata.preparationReceipts)) invalid();
  for(const id of settled){
    const receipt=metadata.receipts.find(r=>r.id===id);
    const fact=state.resourceProvenance.entries.find(e=>e.kind==='carousel-preparation-settled'&&e.receiptIds.includes(id));
    if(!receipt || !fact || getCatalogRoundById(receipt.carouselId.split(':').at(-1)!).ordinal>=getCatalogRoundById(fact.roundId).ordinal) invalid();
  }
  const ids=new Set<string>();
  for(const unit of metadata.heldCarouselUnits){
    if(ids.has(unit.unitId) || state.preparation.units.some(u=>u.id===unit.unitId)
      || !metadata.receipts.some(r=>r.id===unit.receiptId&&r.unitId===unit.unitId&&r.definitionId===unit.definitionId)) invalid();
    ids.add(unit.unitId);
  }
}

/** No merge, ID allocation or RNG: a held card owns stock but has no location. */
export function placeCarouselUnit(state: MatchState, unit: PendingCarouselUnit): GameState | null {
  const preparation = state.preparation;
  let location: import('./units').UnitLocation | undefined;
  for (let slot = 0; slot < preparation.benchSize; slot++) {
    if (!preparation.units.some(u => u.location.kind === 'bench' && u.location.slot === slot)) {
      location = {kind:'bench',slot}; break;
    }
  }
  if (!location && preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length < state.level) {
    const zone = preparation.board.deploymentZones.player;
    for (let row = zone.firstRow; row <= zone.lastRow && !location; row++) {
      for (let col = 0; col < preparation.board.columns; col++) {
        if (!preparation.units.some(u => u.location.kind === 'board' && sameCell(u.location.cell,{col,row}))) {
          location = {kind:'board',cell:{col,row}}; break;
        }
      }
    }
  }
  return location ? {...preparation,units:[...preparation.units,{id:unit.unitId,definitionId:unit.definitionId,team:'player',starLevel:1,location}]} : null;
}

/** Runs on preparation entry and after preparation operations that may open a slot. */
export function resolveCarouselPreparation(state: MatchState): {state:MatchState;events:readonly MatchEvent[]} {
  const metadata = state.carousel;
  if (!metadata || state.phase !== 'preparation' || state.multiplayer?.combatRosterLocked || state.multiplayer?.status==='eliminated') return {state,events:[]};
  if (metadata.receipts.some(r=>r.carouselId.endsWith(`:carousel:${state.roundDefinitionId}`))) return {state,events:[]};
  const eligible = metadata.receipts.filter(r => getCatalogRoundById(r.carouselId.split(':').at(-1)!).ordinal < state.round);
  const receiptIds = eligible.filter(r => !metadata.preparationReceipts.includes(r.id)).map(r=>r.id);
  const candidates = metadata.heldCarouselUnits.filter(u => eligible.some(r=>r.id===u.receiptId)).sort((a,b)=>a.receiptId<b.receiptId?-1:a.receiptId>b.receiptId?1:0);
  if (!receiptIds.length && !candidates.length) return {state,events:[]};
  let next = state;
  const claimedUnitIds: string[] = [], events: MatchEvent[] = [];
  const upgrades: import('./units').UnitUpgradedEvent[] = [];
  // Merges can open slots for another held card; continue until no card can move.
  let progress = true;
  while (progress) {
    progress = false;
    for (const unit of candidates) {
      if (claimedUnitIds.includes(unit.unitId)) continue;
      const preparation = placeCarouselUnit(next,unit);
      if (preparation) {
        next = {...next,preparation}; claimedUnitIds.push(unit.unitId); progress = true;
        events.push({type:'carouselPendingClaimed',unitId:unit.unitId,receiptId:unit.receiptId});
      }
    }
    const merged = planDeferredUpgrades(next.preparation);
    if (merged.events.length) {
      const resources = transferUpgradeResources(next.items,next.anomalyBinding,merged.events);
      next = {...next,preparation:merged.preparation,items:resources.items,anomalyBinding:resources.anomalyBinding,
        persistentGrowth:mergeGrowthLedger(next.persistentGrowth,merged.events)};
      upgrades.push(...merged.events); events.push(...merged.events,...resources.events); progress = true;
    }
  }
  if (!receiptIds.length && !claimedUnitIds.length && !upgrades.length) return {state,events:[]};
  const held = metadata.heldCarouselUnits.filter(u=>!claimedUnitIds.includes(u.unitId));
  next = {...next,carousel:{...metadata,heldCarouselUnits:held,pendingUnits:held,preparationReceipts:[...metadata.preparationReceipts,...receiptIds]},
    resourceProvenance:appendResourceProvenance(next.resourceProvenance,next.roundDefinitionId,
      {kind:'carousel-preparation-settled',receiptIds,claimedUnitIds,upgrades})};
  events.push({type:'carouselPreparationSettled',receiptIds,claimedUnitIds});
  return {state:next,events};
}
