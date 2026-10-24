import { formingTotals, expectedMagicRoll } from './augment-pool-batch3-progress';
import { isAnvil } from './content/anvils';
import { openingRewardOrbs } from './opening-batch-rewards';
import { openingCrabCarrier } from './opening-crabs';
import { prepareBattleEquipment, validBattleInput } from './battle-equipment';
import { projectTemporaryEquipment } from './m8/equipment';
import { familyOrbs } from './family-orbs';
import { deriveTraits } from './trait-snapshot';
import type { G23GrantEvidence } from './g2-3-grant-evidence';
import { ROUND_CATALOG } from './content/round-catalog';
import { validateD14,d14OwnedUnits,d14OwnedItems,d14HeldAtPrefix,d14CertificateAtCombat } from './d14-runtime';
import {validateAnomalyAcquisition} from './anomaly-acquisition';
import {readItemSummonPositions} from './g2-4b-voidspawn';
import {validateG23GrantEvidence} from './g2-3-grant-evidence';
import { selectOpeningUnit } from './opening-unit';
import {validateG23Restoration} from './g2-3-restore';
import {readG23Progress,epicCrownsAtResourcePrefix} from './g2-3-state';
import {g23RadiantRound} from './g2-3-settlement';
import {g23RadiantDefinitionId,g23RewardAtoms} from './g2-3-rewards';
import { validateConsumableState, replayConsumableItems } from './consumables';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { canonicalContent, equalValidatedContent } from './content';
import { LOOT_POLICY_VERSION } from './content/loot';
import { restoreFrozenLootLedger } from './loot-freeze';
import { lootReceiptId, compareLootChoices } from './loot-identity';
import { makeLootPendingChoice, orderedUnresolvedLootChoices } from './loot-choice';
import { readCombatStrategyInputs, restoreCombatInput, type CombatInputBasis } from './combat-input';
import { foldResourceProvenance, validateResourceReceipts, type ResourceFact, type ResourceProvenanceContext } from './resource-provenance';
import { getCatalogRoundById } from './round-selectors';
import { transferUpgradeResources } from './upgrades';
import { planUnitAcquisition } from './unit-acquisition';
import { planPermanentItemGrant } from './item-grants';
import { getUnitSellPrice } from './unit-stats';
import type { MatchState } from './match-types';
import type { LootChoiceDescriptor, FrozenDirectDrop } from './loot-types';
import type { LootReceipt } from './m8/contracts';
import { planCombine, planEquip } from './inventory';
import type { ItemInstance } from './strategy-types';
import type { GameState } from './game';
import { validateMultiplayerOrbLedger } from './orb-restore';
export { validateMultiplayerOrbLedger } from './orb-restore';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(`Invalid B8 Match: ${message}`);
}
const equal = (a: unknown, b: unknown): boolean => canonicalContent(a) === canonicalContent(b);
function keys(value: unknown, names: readonly string[]): void {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype, 'object');
  const actual = Object.keys(value);
  check(actual.length === names.length && actual.every(key => names.includes(key)), 'fields');
}
function integer(value: unknown, min = 0): void { check(Number.isSafeInteger(value) && (value as number) >= min, 'integer'); }
const sorted = <T extends { readonly id: string }>(values: readonly T[]): T[] => [...values].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const allChoices = (state: MatchState) => state.m8.loot.frozen.rounds.flatMap(round => round.choices);

/** Replay only the legal inventory/in-place combination. Frozen equipped inputs
 * cannot be freely detached or borrowed from another unit during restoration. */
function replayCombination(items: readonly ItemInstance[], preparation: GameState, nextItemSerial: number,
  fact: Extract<ResourceFact, { kind: 'item-combined' }>) {
  const inputs = fact.event.consumedIds.map(id => items.find(item => item.id === id));
  check(inputs.length === 2 && inputs.every(item => item), 'combination ownership');
  const held = inputs.filter(item => item!.location.kind === 'unit');
  check(held.length <= 1, 'combination requires inventory input');
  const target = held[0], incoming = inputs.find(item => item!.location.kind === 'inventory')!;
  const plan = target?.location.kind === 'unit'
    ? planEquip(items, preparation, incoming.id, target.location.unitId, target.location.slot, nextItemSerial)
    : planCombine(items, nextItemSerial, inputs[0]!.id, inputs[1]!.id);
  check(plan.ok && equal(plan.events.find(event => event.type === 'itemCombined'), fact.event), 'combination transaction');
  return plan;
}

/** Exact projection: every ordinary placement now has an ordered resource fact. */
function equipmentContinuation(expected: readonly ItemInstance[], actual: readonly ItemInstance[]): boolean {
  return equal(sorted(expected), sorted(actual));
}

function replayEquipment(items: readonly ItemInstance[], preparation: GameState, serial: number,
  fact: Extract<ResourceFact, {kind:'item-equipped'}>) {
  const plan = planEquip(items, preparation, fact.itemId, fact.unitId, fact.slot, serial);
  check(plan.ok && plan.nextItemSerial === serial && equal(plan.events,
    [{type:'itemEquipped',itemId:fact.itemId,unitId:fact.unitId,slot:fact.slot}]), 'equipment transaction');
  return plan;
}

/** Carry exact equipment bindings through the ordered resource ledger.
 * Before the first battle, start empty and rebuild units/items from validated births. */
export function validateHistoricalEquipment(previous: MatchState | null, next: MatchState): void {
  let items: readonly ItemInstance[] = previous?d14OwnedItems(previous):[], serial = previous?.nextItemSerial ?? 1;
  let preparation = previous?.preparation ?? {...next.preparation, units:[]};
  const births = validateResourceReceipts({scheduleReceipts:next.scheduleReceipts,
    lootReceipts:next.m8.loot.receipts, carouselReceipts:next.carousel?.receipts,
    mechanicReceipts:next.seatMechanics?.receipts, throughRoundOrdinal:next.round});
  const birthById = new Map([...births.values()].map(birth => [birth.id, birth]));
  const absentItems=new Set<string>();
  const checkOpening = (prefixLength: number) => {
    for(const evidence of (next.seatMechanics?.hidden.grantEvidence??[]) as readonly G23GrantEvidence[]) {
      if(evidence.resourcePrefixLength!==prefixLength||!evidence.receiptId.startsWith('g23:academy:'))continue;
      const tier=Number(evidence.receiptId.split(':').at(-1));
      const actual=deriveTraits({...preparation,units:evidence.units},'player',undefined,undefined,items).find(t=>t.traitId==='academy')?.tier??0;
      check(actual>=tier,'academy qualification (historical equipment)');
    }
    const basis = next.combatInputBasis;
    if (basis?.provenancePrefixLength === prefixLength) {
      const hidden=new Set(d14HeldAtPrefix(next,prefixLength).heldItemIds);
      check(equipmentContinuation(items.filter(i=>!hidden.has(i.id)), basis.inputs.items), 'historical opening equipment continuation');
    }
  };
  for (const fact of next.resourceProvenance.entries.slice(previous?.resourceProvenance.entries.length ?? 0)) {
    checkOpening(fact.sequence);
    if(fact.kind==='item-combined')check(fact.event.consumedIds.every(id=>!absentItems.has(id)),'D14 hidden combine');
    if(fact.kind==='consumable-used')check(fact.record.affectedItems.every(i=>!absentItems.has(i.id)),'D14 hidden consumable');
    switch (fact.kind) {
      case 'd14-selected': {
        const receipt=next.scheduleReceipts.find(r=>r.eventId===fact.choiceId);
        if(receipt?.definitionId==='into-the-unknown'){
          const attached=items.filter(i=>i.location.kind==='unit'&&i.location.unitId===fact.unitId);
          check(equipmentContinuation(attached,fact.heldItems),'D14 departure equipment');
          fact.heldItems.forEach(i=>absentItems.add(i.id));
        }break;
      }
      case 'd14-returned': absentItems.clear();break;
      case 'unit-acquired': {
        const definitionId = fact.source.kind === 'opening' ? selectOpeningUnit(fact.source.seed, fact.source.seatId)
          : fact.source.kind === 'shop' ? fact.source.definitionId : birthById.get(fact.unitId)?.definitionId;
        check(definitionId, 'historical unit birth');
        // Equip planners inspect identity/team/definition only; deployment has no resource fact.
        preparation = {...preparation, units:[...preparation.units, {id:fact.unitId, definitionId,
          team:'player', starLevel:1, location:{kind:'bench',slot:0}}]};
        break;
      }
      case 'item-acquired': {
        const birth = birthById.get(fact.itemId);
        check(birth, 'historical item birth');
        items = [...items, {id:fact.itemId,definitionId:birth.definitionId,location:{kind:'inventory'}}];
        serial++;
        break;
      }
      case 'anvil-opened':
      case 'unit-sold':
        items = items.map(item => item.location.kind === 'unit' && item.location.unitId === fact.unitId
          ? {...item,location:{kind:'inventory'}} : item);
        preparation = {...preparation,units:preparation.units.filter(unit => unit.id !== fact.unitId)};
        break;
      case 'unit-upgraded':
      case 'unit-upgraded-after-combat':
      case 'carousel-unit-claimed':
      case 'carousel-preparation-settled': {
        // Final placements may follow this upgrade and a later removal. Keep the
        // current bindings until their ordered resource fact changes them; using
        // next.items here would let future equips occupy the migration slots.
        const upgrades = 'event' in fact ? [fact.event] : fact.upgrades;
        items = transferUpgradeResources(items, null, upgrades).items;
        for (const event of upgrades) preparation = {...preparation,units:preparation.units
          .filter(unit => !event.consumedIds.includes(unit.id))
          .map(unit => unit.id === event.survivorId ? {...unit,starLevel:event.toStar} : unit)};
        break;
      }
      case 'consumable-used': {
        const plan = replayConsumableItems(items, serial, fact.record, preparation);
        items = plan.items; serial = plan.nextItemSerial;
        break;
      }
      case 'item-equipped': {
        items = replayEquipment(items, preparation, serial, fact).items;
        break;
      }
      case 'item-combined': {
        const plan = replayCombination(items, preparation, serial, fact);
        items = plan.items; serial = plan.nextItemSerial;
        break;
      }
      case 'g23-item-converted':
        items = items.map(item => item.id === fact.itemId ? {...item,definitionId:fact.to} : item);
        break;
      case 'combat-growth-committed': break;
    }
  }
  checkOpening(next.resourceProvenance.entries.length);
  check(equipmentContinuation(items, d14OwnedItems(next)) && serial === next.nextItemSerial, 'historical equipment continuation');
}

/** Authenticate the combat transcript from the already validated resource suffix.
 * Candidate source inputs never serve as their own ownership or numerical proof. */
function validateBattleEquipmentHistory(state: MatchState, basis: CombatInputBasis): void {
  const combat = state.combat!;
  const receipts = [...combat.equipmentReceipts ?? [], ...combat.pendingEquipment ?? []];
  let cursor = 0, items = basis.inputs.items, serial = basis.nextItemSerial, inputs = basis.inputs;
  for (const fact of state.resourceProvenance.entries.slice(basis.provenancePrefixLength)) {
    if (fact.kind === 'combat-growth-committed') break;
    const before = items;
    if (fact.kind === 'item-equipped') items = replayEquipment(items, basis.inputs.preparation, serial, fact).items;
    else if (fact.kind === 'item-combined') {
      const plan = replayCombination(items, basis.inputs.preparation, serial, fact); items = plan.items; serial = plan.nextItemSerial;
    } else if (fact.kind === 'consumable-used') {
      const plan = replayConsumableItems(items, serial, fact.record, basis.inputs.preparation); items = plan.items; serial = plan.nextItemSerial;
    } else if (fact.kind === 'g23-item-converted') items = replayG23Conversion(items, fact);
    else continue;
    const equippedId = fact.kind === 'item-equipped' ? fact.itemId : fact.kind === 'item-combined' ? fact.event.itemId : null;
    const equipped = items.find(i => i.id === equippedId);
    const unitId = equipped?.location.kind === 'unit' ? equipped.location.unitId : null;
    if (!('tick' in fact) || fact.tick === undefined || !unitId
      || !basis.inputs.preparation.units.some(u => u.id === unitId && u.team === 'player' && u.location.kind === 'board')) continue;
    const receipt = receipts[cursor++];
    check(receipt && validBattleInput(receipt.input) && receipt.input.seq === cursor
      && receipt.input.seatId === 'player' && receipt.input.unitId === unitId && receipt.input.effectiveTick === fact.tick + 1,
      'battle equipment command sequence');
    check(fact.kind === 'item-equipped' ? receipt.input.itemId === fact.itemId
      : fact.kind === 'item-combined' && fact.event.consumedIds.includes(receipt.input.itemId)
        && before.find(i => i.id === receipt.input.itemId)?.location.kind === 'inventory', 'battle equipment command ownership');
    const plan = planEquip(before, basis.inputs.preparation, receipt.input.itemId, unitId, receipt.input.slot,
      fact.kind === 'item-combined' ? serial - 1 : serial);
    check(plan.ok && equal(plan.items, items), 'battle equipment command slot');
    // acceptEquipment may immediately convert the new permanent item to radiant.
    let through = fact.sequence;
    const converted = state.resourceProvenance.entries[through + 1];
    if (converted?.kind === 'g23-item-converted' && converted.itemId === equippedId) {
      items = replayG23Conversion(items, converted); through++;
    }
    const temporaryEquipment = items.flatMap(item => item.location.kind === 'unit' ? state.equipmentState.rolls
      .filter(r => r.parentItemInstanceId === item.id && r.roundId === basis.roundId)
      .flatMap(r => projectTemporaryEquipment(r, item.location.kind === 'unit' ? item.location.unitId : '')) : []);
    const source = { ...state, items, temporaryEquipment,
      gold: state.roundResults.find(r => r.round === state.round)?.goldBefore ?? state.gold,
      resourceProvenance: { ...state.resourceProvenance, entries: state.resourceProvenance.entries.slice(0, through + 1) } } as MatchState;
    const expected = prepareBattleEquipment(inputs, receipt.input, source, 'player', basis.battleSeed);
    check(equal(expected, receipt), 'battle equipment source evidence');
    inputs = expected.after;
  }
  check(cursor === receipts.length, 'extra battle equipment receipt');
}

/** Pure ledger validation. Historical deaths have bounded evidence, not independent replay authentication. */
export function validateB8Loot(state: MatchState, parsedJsonInput = false): boolean {
  const equal = parsedJsonInput ? equalValidatedContent : (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
  if(state.multiplayer) {
    validateMultiplayerOrbLedger(state);
    const unresolved=orderedUnresolvedLootChoices(allChoices(state),state.m8.loot.choiceEligibility,state.m8.loot.choiceResolutions);
    if(unresolved.length && state.pendingCombatTerminal) { check(state.pendingChoice===null,'pending terminal loot choice'); return false; }
    if(unresolved.length) check(state.phase==='choice'&&equal(state.pendingChoice,makeLootPendingChoice(unresolved[0])),'first multiplayer loot choice');
    return unresolved.length>0;
  }
  const loot = state.m8.loot;
  keys(loot, ['layoutBinding','frozen','direct','choiceEligibility','choiceResolutions','earnedEvidence','receipts','guaranteeCounters',...(loot.queuedOrbClaims?['queuedOrbClaims']:[])]);
  if(loot.queuedOrbClaims){check(Array.isArray(loot.queuedOrbClaims)&&new Set(loot.queuedOrbClaims).size===loot.queuedOrbClaims.length&&(!loot.queuedOrbClaims.length||state.phase==='combat'&&state.combat?.status==='running'),'family claim queue');for(const id of loot.queuedOrbClaims)check([...familyOrbs(state),...openingRewardOrbs(state)].some(o=>o.orbId===id),'family queued identity');}
  check(loot.layoutBinding.mode==='solo'&&loot.layoutBinding.layout.seed===state.seed&&loot.layoutBinding.layout.throughRoundOrdinal===state.round,'solo layout binding');
  const frozen = restoreFrozenLootLedger(loot.frozen, {seed:state.seed, throughRoundOrdinal:state.round,layout:loot.layoutBinding.layout}, parsedJsonInput);
  for (const value of [loot.direct,loot.choiceEligibility,loot.choiceResolutions,loot.earnedEvidence,loot.receipts]) check(Array.isArray(value), 'ledger array');
  const direct = frozen.rounds.flatMap(round => round.encounterPlan.drops), choices = allChoices(state);
  check(equal(loot.direct.map(entry => entry.dropId),direct.map(entry => entry.dropId))
    && equal(loot.choiceEligibility.map(entry => entry.dropId),choices.map(entry => entry.dropId)), 'slot coverage/order');
  const slots = new Map([...direct,...choices].map(slot => [slot.dropId,slot]));
  const evidence = new Map<string, typeof loot.earnedEvidence[number]>(), sourceDeaths = new Map<string,unknown>(), deathSources = new Map<string,string>();
  for (const entry of loot.earnedEvidence) {
    keys(entry,['dropId','death']); keys(entry.death,['combatId','tick','eventSeq']);
    const slot = slots.get(entry.dropId); check(slot && !evidence.has(entry.dropId), 'evidence identity');
    const round = getCatalogRoundById(slot.roundId), result = state.roundResults[round.ordinal-1];
    integer(entry.death.tick,1); integer(entry.death.eventSeq);
    check(entry.death.combatId === `round-${round.ordinal}`, 'death combat identity');
    const combat = round.ordinal === state.round ? state.combat : null;
    check(combat ? entry.death.tick <= combat.tick && entry.death.eventSeq < combat.nextEventSeq!
      : result && entry.death.tick <= result.combatTicks && entry.death.eventSeq < result.combatEventCount, 'death history boundary');
    const source = JSON.stringify([slot.roundId,openingCrabCarrier(state,slot.roundId,slot.sourceUnitId)]), identity = canonicalContent(entry.death);
    check(!sourceDeaths.has(source) || equal(sourceDeaths.get(source),entry.death), 'source death conflict');
    check(!deathSources.has(identity) || deathSources.get(identity) === source, 'duplicate death identity');
    sourceDeaths.set(source,entry.death); deathSources.set(identity,source); evidence.set(entry.dropId,entry);
  }
  // The same structural receipt validator also supplies the provenance birth proof.
  // Keep the frozen-slot authentication here; do not maintain a second receipt schema.
  validateResourceReceipts({scheduleReceipts:state.scheduleReceipts,lootReceipts:loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,throughRoundOrdinal:state.round});
  const receipts = new Map<string,LootReceipt>();
  let receiptRound = 0;
  for (const receipt of loot.receipts) {
    const slot = slots.get(receipt.dropId); check(slot, 'receipt identity');
    const ordinal = getCatalogRoundById(slot.roundId).ordinal;
    check(ordinal >= receiptRound, 'receipt order'); receiptRound = ordinal;
    if ('payload' in slot) check(equal(receipt.payload,slot.payload), 'frozen receipt payload');
    else check(receipt.payload.kind === 'item' && makeLootPendingChoice(slot).offers.includes(receipt.payload.definitionId), 'choice receipt payload');
    receipts.set(receipt.dropId,receipt);
  }
  const resolutions = new Map<string, typeof loot.choiceResolutions[number]>();
  for (const resolution of loot.choiceResolutions) {
    keys(resolution,['dropId','receiptId','method']);
    const choice = choices.find(entry => entry.dropId === resolution.dropId), receipt = receipts.get(resolution.dropId);
    check(choice && receipt && !resolutions.has(resolution.dropId) && resolution.receiptId === receipt.receiptId
      && ['player-choice','terminal-fallback'].includes(resolution.method), 'choice resolution');
    check(resolution.method !== 'terminal-fallback' || state.phase === 'gameOver' && choice.roundId === state.roundDefinitionId
      && equal(receipt.payload,{kind:'item',quantity:1,definitionId:choice.terminalFallbackDefinitionId}), 'terminal fallback');
    check(!(state.phase === 'gameOver' && choice.roundId === state.roundDefinitionId) || resolution.method === 'terminal-fallback', 'terminal choice method');
    resolutions.set(resolution.dropId,resolution);
  }
  const validateEligibility = (slot: FrozenDirectDrop | LootChoiceDescriptor, status: string) => {
    const earned = evidence.has(slot.dropId), current = slot.roundId === state.roundDefinitionId;
    const finished = !current || state.combat?.status === 'finished';
    check(earned === !['planned','forfeited'].includes(status), 'qualification evidence');
    if (current) {
      const death = state.combat?.neutralReceipts?.deaths.find(value => value.unitId === openingCrabCarrier(state,slot.roundId,slot.sourceUnitId));
      check(earned === !!death, 'current death qualification');
      if (death) check(equal(evidence.get(slot.dropId)!.death,{combatId:state.combat!.combatId,tick:death.tick,eventSeq:death.eventSeq}), 'current death evidence');
    }
    check(finished ? status !== 'planned' : status === (earned ? 'revealed' : 'planned'), 'qualification lifecycle');
  };
  for (const [index,progress] of loot.direct.entries()) {
    keys(progress,['dropId','status','receiptId']); const slot = direct[index], receipt = receipts.get(slot.dropId);
    check(['planned','revealed','pending-capacity','retained-terminal','forfeited','granted'].includes(progress.status), 'direct status');
    validateEligibility(slot,progress.status);
    check(progress.status === 'granted' ? receipt && progress.receiptId === receipt.receiptId : !receipt && progress.receiptId === null, 'direct receipt');
    if (slot.roundId !== state.roundDefinitionId) check(['granted','forfeited'].includes(progress.status)||slot.payload.kind==='forge'&&progress.status==='revealed', 'unresolved historical direct');
    if (state.combat?.status === 'finished' && slot.roundId === state.roundDefinitionId) {
      check(progress.status !== 'revealed'||slot.payload.kind==='forge', 'unprocessed direct');
      if (progress.status === 'pending-capacity' || progress.status === 'retained-terminal') check(slot.payload.kind === 'unit'
        && (progress.status === 'retained-terminal') === (state.phase === 'gameOver'), 'unit capacity status');
    }
  }
  for (const [index,eligibility] of loot.choiceEligibility.entries()) {
    keys(eligibility,['dropId','status']); const slot = choices[index], resolution = resolutions.get(slot.dropId);
    check(['planned','revealed','forfeited'].includes(eligibility.status), 'choice eligibility');
    validateEligibility(slot,eligibility.status);
    check(!!resolution === receipts.has(slot.dropId) && (!resolution || eligibility.status === 'revealed'), 'choice grant qualification');
    if (slot.roundId !== state.roundDefinitionId || state.phase === 'gameOver') check(eligibility.status !== 'revealed' || resolution, 'unresolved completed choice');
    if (state.combat?.status === 'running' && slot.roundId === state.roundDefinitionId) check(!resolution, 'combat choice grant');
  }
  const counters = Object.fromEntries(ROUND_CATALOG.filter(r=>r.kind==='pve').map(r=>r.roundId).map(roundId => [JSON.stringify([LOOT_POLICY_VERSION,roundId,'components-granted']),0]));
  for (const receipt of loot.receipts) if (receipt.payload.kind === 'item') counters[JSON.stringify([LOOT_POLICY_VERSION,slots.get(receipt.dropId)!.roundId,'components-granted'])]+=ITEM_DEFINITIONS[receipt.payload.definitionId].kind==='completed'?2:1;
  check(equal(counters,loot.guaranteeCounters), 'actual guarantee counters');
  const unresolved = orderedUnresolvedLootChoices(choices,loot.choiceEligibility,loot.choiceResolutions);
  if (state.combat?.status === 'finished' && state.phase !== 'gameOver' && unresolved.length) {
    check(state.phase === 'choice' && equal(state.pendingChoice,makeLootPendingChoice(unresolved[0])), 'first loot choice'); return true;
  }
  return false;
}

/** Verify all births/consumption and independently compile the immutable combat prefix. */
export function validateB8Resources(state: MatchState, parsedJsonInput = false, deferInputFreeze = false): { basis: CombatInputBasis | null; saleGold: number } {
  const equal = parsedJsonInput ? equalValidatedContent : (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
  validateConsumableState(state);
  validateG23Restoration(state,parsedJsonInput);
  const opening = state.resourceProvenance.entries[0];
  check(opening?.kind === 'unit-acquired' && opening.source.kind === 'opening' && opening.source.seatId === (state.sharedPool?.seatId ?? 'solo') && (state.sharedPool || opening.source.seed === state.seed), 'opening stream identity');
  const context: ResourceProvenanceContext = { g23:readG23Progress(state),g23RadiantRound:g23RadiantRound(state),carouselReceipts:state.carousel?.receipts,pendingCarouselUnitIds:state.carousel?.pendingUnits.map(u=>u.unitId),carouselOpening:!!state.carousel, scheduleReceipts:state.scheduleReceipts,lootReceipts:state.m8.loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,
    throughRoundOrdinal:state.round,combatSettlements:state.roundResults.filter(result => result.roundKind !== 'supply')
      .map(result => ({roundId:result.roundId,combatId:`round-${result.round}`,settlementId:result.settlementId})) };
  const current = foldResourceProvenance(state.resourceProvenance,context,parsedJsonInput);
  validateG23GrantEvidence(state,context,parsedJsonInput);
  validateAnomalyAcquisition(state,context,parsedJsonInput);
  validateD14(state,context);
  check(equal(current,{units:sorted([...d14OwnedUnits(state).filter(unit => unit.team === 'player').map(({id,definitionId,starLevel}) => ({id,definitionId,starLevel})),...(state.carousel?.pendingUnits.map(u=>({id:u.unitId,definitionId:u.definitionId,starLevel:1}))??[])]),
    items:sorted(d14OwnedItems(state).map(({id,definitionId}) => ({id,definitionId}))),persistentGrowth:state.persistentGrowth,
    nextUnitSerial:state.nextUnitSerial,nextItemSerial:state.nextItemSerial}), 'current resource fold');
  // Academy grants must authenticate their historical deployment/equipment even
  // for ordinary saves with completed battles and no externally supplied replay.
  const hasAcademyEvidence = ((state.seatMechanics?.hidden.grantEvidence ?? []) as readonly G23GrantEvidence[])
    .some(evidence => evidence.receiptId.startsWith('g23:academy:'));
  if (state.d14 || hasAcademyEvidence || !state.roundResults.some(result => result.roundKind !== 'supply')) validateHistoricalEquipment(null, state);
  if (state.combat === null) { check(state.combatInputBasis === null, 'inactive input basis'); return {basis:null,saleGold:0}; }
  const entries = state.resourceProvenance.entries, combat = state.combat;
  const commits = entries.filter(entry => entry.kind === 'combat-growth-committed' && entry.combatId === combat.combatId);
  check(combat.status === 'finished' ? commits.length === 1 : commits.length === 0, 'current growth commit count');
  const commit = commits[0];
  check(!commit || commit.kind === 'combat-growth-committed', 'growth commit');
  const candidate = state.combatInputBasis;
  check(candidate, 'missing input basis');
  check(!commit || commit.combatStartProvenancePrefixLength === candidate.provenancePrefixLength, 'combat prefix authority');
  const prefixLength = candidate.provenancePrefixLength;
  integer(prefixLength, 1); check(prefixLength <= entries.length, 'combat prefix bounds');
  check(entries[prefixLength]?.kind !== 'unit-upgraded', 'combat prefix transaction boundary');
  const rollPrefix = candidate.equipmentRollPrefixLength;
  integer(rollPrefix); check(rollPrefix <= state.equipmentState.rolls.length, 'equipment prefix bounds');
  const basis = restoreCombatInput(state.combatInputBasis,{...(formingTotals(state)?{forming:formingTotals(state)}:{}),...(expectedMagicRoll(state)?{magicRoll:expectedMagicRoll(state)}:{}),...d14HeldAtPrefix(state,prefixLength),d14Combat:d14CertificateAtCombat(state),itemSummonPositions:readItemSummonPositions(state),bankGold:state.roundResults[state.round-1]?.goldBefore??state.gold,g23:readG23Progress(state),epicCrownsBeforeCombat:epicCrownsAtResourcePrefix(state,prefixLength),playerHp:state.roundResults[state.round-1]?.hpBefore??state.playerHp,seed:state.seed,round:state.round,contentDigest:state.contentDigest,
    playerLevel:state.roundResults[state.round-1]?.levelBefore ?? state.level,provenancePrefixLength:prefixLength,
    // Only locally parsed JSON cannot run accessors between these reads. Keep
    // the original second validation for every object input and shorter prefix.
    resources:parsedJsonInput && prefixLength === entries.length ? current : foldResourceProvenance(state.resourceProvenance,{...context,prefixLength},parsedJsonInput),equipmentRolls:state.equipmentState.rolls,
    equipmentRollPrefixLength:rollPrefix,scheduleReceipts:state.scheduleReceipts,roundResults:state.roundResults}, parsedJsonInput, deferInputFreeze);
  check(state.equipmentState.rolls.slice(rollPrefix).every(roll => roll.roundId === state.roundDefinitionId
    && !basis.inputs.items.some(item => item.id === roll.parentItemInstanceId && item.location.kind === 'unit')), 'post-freeze equipment rolls');
  check(state.battleSeedRngState === basis.battleSeed, 'battle seed cursor');
  validateBattleEquipmentHistory(state, basis);
  if (combat.status === 'running') {
    const { items: _items, temporaryEquipment: _children, ...live } = readCombatStrategyInputs(state);
    const { items: originalItems, temporaryEquipment: _frozenChildren, ...frozenInputs } = basis.inputs;
    check(equal(live, frozenInputs), 'running input mutation');
    let items = originalItems, serial = basis.nextItemSerial;
    for (const fact of entries.slice(prefixLength)) {
      check((fact.kind==='g23-item-converted'||fact.kind === 'item-equipped'||fact.kind === 'item-combined'||fact.kind==='consumable-used') && fact.roundId === state.roundDefinitionId, 'running resource suffix');
      if(fact.kind==='g23-item-converted'){items=replayG23Conversion(items,fact);continue;}
      const plan = fact.kind==='item-equipped'?replayEquipment(items,state.preparation,serial,fact):fact.kind==='consumable-used'?replayConsumableItems(items,serial,fact.record,state.preparation):replayCombination(items, state.preparation, serial, fact);
      items = plan.items; serial = plan.nextItemSerial;
    }
    check(equipmentContinuation(items, state.items) && serial === state.nextItemSerial, 'running equipment projection');
    return {basis,saleGold:0};
  }
  const deltas = combat.units.filter(unit => unit.team === 'player' && !unit.itemSummon && (unit.runtime?.permanentAdBps ?? 0) > 0)
    .map(unit => ({sourceUnitId:unit.id,attackDamageBps:unit.runtime!.permanentAdBps}));
  for(const split of combat.trenchSplits??[])if(split.permanentAdBps>0&&basis.inputs.preparation.units.some(u=>u.id===split.ownerId&&u.team==='player'))
    deltas.push({sourceUnitId:split.ownerId,attackDamageBps:split.permanentAdBps});
  deltas.sort((a,b) => a.sourceUnitId < b.sourceUnitId ? -1 : 1);
  check(commit && equal(commit.sourceDeltas,deltas), 'original combat growth deltas');
  return {basis,saleGold:replayCurrentSuffix(state,basis)};
}

/** Isolated verification, never runtime repair: run only the original pure planners on copies. */
function replayCurrentSuffix(state: MatchState, basis: CombatInputBasis): number {
  const loot = state.m8.loot, entries = state.resourceProvenance.entries;
  const frozen = loot.frozen.rounds.find(round => round.encounterPlan.roundId === state.roundDefinitionId);
  const direct = frozen?.encounterPlan.drops ?? [], choices = [...(frozen?.choices ?? [])].sort(compareLootChoices);
  const earned = new Set(loot.earnedEvidence.map(entry => entry.dropId)), receipts = new Map(loot.receipts.map(receipt => [receipt.dropId,receipt]));
  const actualReceiptOrder: string[] = [], expectedProgress = new Map<string,string>();
  let preparation = structuredClone(basis.inputs.preparation), items = structuredClone(basis.inputs.items), binding = structuredClone(basis.inputs.anomalyBinding);
  let nextUnit = basis.nextUnitSerial, nextItem = basis.nextItemSerial, cursor = basis.provenancePrefixLength, saleGold = 0;
  let committed = false;
  const heldIds=new Set(d14HeldAtPrefix(state,basis.provenancePrefixLength).heldItemIds);
  let hiddenItems=state.resourceProvenance.entries.flatMap(e=>e.kind==='d14-selected'?e.heldItems:[]).filter(i=>heldIds.has(i.id));
  if(state.d14?.anomalyId==='into-the-unknown'&&!binding)binding={definitionId:state.d14.anomalyId,unitId:state.d14.originalUnit.id,choiceId:state.d14.choiceId,boundRound:state.d14.atOrdinal+1};
  const take = (fact: ResourceFact) => {
    check(equal(entries[cursor],{...fact,sequence:cursor,roundId:state.roundDefinitionId}), 'ordered resource transaction'); cursor++;
  };
  const combinations = () => {
    while (entries[cursor]?.kind==='item-equipped'||entries[cursor]?.kind==='g23-item-converted'||entries[cursor]?.kind === 'item-combined'||entries[cursor]?.kind==='consumable-used') {
      const tool=entries[cursor];
      if(tool.kind==='item-equipped'){
        check(!committed||state.phase!=='gameOver','terminal equipment operation');
        items=replayEquipment(items,preparation,nextItem,tool).items;
        take({kind:tool.kind,itemId:tool.itemId,unitId:tool.unitId,slot:tool.slot,
          ...(tool.tick === undefined ? {} : {tick:tool.tick})});continue;
      }
      if(tool.kind==='g23-item-converted'){items=replayG23Conversion(items,tool);take({kind:tool.kind,itemId:tool.itemId,from:tool.from,to:tool.to,receiptId:tool.receiptId});continue;}
      if(tool.kind==='consumable-used') {
        check(!committed||state.phase!=='gameOver','terminal consumable operation');
        const plan=replayConsumableItems(items,nextItem,tool.record,state.preparation);take({kind:'consumable-used',record:tool.record,...(tool.tick === undefined ? {} : {tick:tool.tick})});
        items=plan.items;nextItem=plan.nextItemSerial;continue;
      }
      check(!committed || state.phase !== 'gameOver', 'terminal equipment operation');
      const fact = entries[cursor] as Extract<ResourceFact, { kind: 'item-combined' }>;
      const plan = replayCombination(items, preparation, nextItem, fact);
      take({ kind: 'item-combined', event: fact.event, ...(fact.tick === undefined ? {} : {tick:fact.tick}) });
      items = plan.items; nextItem = plan.nextItemSerial;
    }
  };
  const grant = (slot: FrozenDirectDrop | LootChoiceDescriptor, definitionId?: string): boolean => {
    const payload = 'payload' in slot ? slot.payload : {kind:'item' as const,definitionId:definitionId!,quantity:1};
    const receipt = receipts.get(slot.dropId);
    let itemIds: string[] = [], unitIds: string[] = [];
    const birth=entries[cursor];
    if(payload.kind==='forge'&&(birth?.kind!=='unit-acquired'||birth.source.kind!=='loot'||birth.source.receiptId!==lootReceiptId(slot.dropId)))return false;
    if (payload.kind === 'unit'||payload.kind==='forge') {
      const plan = planUnitAcquisition({preparation,items,anomalyBinding:binding,nextUnitSerial:nextUnit},
        payload.definitionId,{kind:'loot',receiptId:lootReceiptId(slot.dropId)},cursor);
      if (!plan.ok) return false;
      for (const fact of plan.facts) take(fact);
      preparation = plan.preparation; items = plan.items; binding = plan.anomalyBinding;
      unitIds = [plan.unitId]; nextUnit = plan.nextUnitSerial;
    } else if (payload.kind === 'item') {
      const itemId = `item-${nextItem}`;
      take({kind:'item-acquired',itemId,source:{kind:'loot',receiptId:lootReceiptId(slot.dropId)}});
      items = [...items,{id:itemId,definitionId:payload.definitionId,location:{kind:'inventory'}}]; itemIds = [itemId]; nextItem++;
    }
    check(equal(receipt,{receiptId:lootReceiptId(slot.dropId),dropId:slot.dropId,payload,grantedItemIds:itemIds,grantedUnitIds:unitIds,
      ...(payload.kind==='consumable'?{grantedConsumableIds:receipt?.grantedConsumableIds}:{})}), 'actual grant receipt');
    actualReceiptOrder.push(slot.dropId); return true;
  };
  combinations(); // Commands during combat precede the atomic terminal grants/commit.
  for (const slot of direct) expectedProgress.set(slot.dropId,!earned.has(slot.dropId) ? 'forfeited'
    : grant(slot) ? 'granted' : slot.payload.kind==='forge'?'revealed':state.phase === 'gameOver' ? 'retained-terminal' : 'pending-capacity');
  const earnedChoices = choices.filter(choice => earned.has(choice.dropId));
  const resolve = (choice: LootChoiceDescriptor) => {
    const resolution = loot.choiceResolutions.find(value => value.dropId === choice.dropId), receipt = receipts.get(choice.dropId);
    check(resolution && receipt?.payload.kind === 'item', 'choice transaction');
    grant(choice,receipt.payload.definitionId);
  };
  if (state.phase === 'gameOver') for (const choice of earnedChoices) resolve(choice);
  const commit = entries[cursor]; check(commit?.kind === 'combat-growth-committed', 'growth transaction order');
  take({kind:'combat-growth-committed',combatId:basis.combatId,settlementId:`round-${state.round}-settled`,
    combatStartProvenancePrefixLength:basis.provenancePrefixLength,sourceDeltas:commit.sourceDeltas});
  committed = true;
  // Mechanic/G23 authority and provenance have already validated these receipts.
  // Replay every post-freeze birth in receipt order, even if later consumed.
  // Automatic rewards commit before loot choices; mechanic choices follow them.
  const mechanicBirths = (state.seatMechanics?.receipts ?? []).slice(basis.mechanicReceiptPrefixLength).filter(receipt =>
    receipt.kind === 'item' || receipt.kind === 'unit' && receipt.resolution === 'held'
    || receipt.kind === 'choice' && receipt.itemId !== null);
  const progress = readG23Progress(state);
  const rewardAtoms = new Map(progress?.rewards.flatMap(bundle => g23RewardAtoms(bundle,progress.seed).map(atom => [atom.id,atom] as const)));
  let mechanicCursor = 0;
  let resolvedChoices = 0;
  const mechanicBirth = (): boolean => {
    const birth = entries[cursor];
    if ((birth?.kind !== 'item-acquired' && birth?.kind !== 'unit-acquired') || birth.source.kind !== 'mechanic') return false;
    const receipt = mechanicBirths[mechanicCursor++];
    check(receipt && receipt.round === state.round && receipt.roundId === state.roundDefinitionId
      && receipt.receiptId === birth.source.receiptId, 'mechanic birth order');
    const source = {kind:'mechanic' as const,receiptId:receipt.receiptId};
    if (receipt.kind === 'unit') {
      check(birth.kind === 'unit-acquired' && receipt.resolution === 'held', 'mechanic unit birth');
      const claim = progress?.rewardClaims.find(claim => claim.id === receipt.receiptId);
      const atom = claim && rewardAtoms.get(claim.atomId);
      // Match drainG23Rewards at this birth, including heroes granted earlier in
      // the same bundle. The receipt/final roster cannot authorize its own target.
      if (atom?.kind === 'duplicator') {
        const target = atom.options.find(id => preparation.units.some(unit => unit.team === 'player' && unit.definitionId === id));
        check(target !== undefined && receipt.definitionId === target, 'mechanic duplicator target');
      }
      const plan = planUnitAcquisition({preparation,items,anomalyBinding:binding,nextUnitSerial:nextUnit},receipt.definitionId,source,cursor,false,receipt.starLevel??1);
      check(plan.ok && receipt.unitId === plan.unitId, 'mechanic unit transaction');
      for (const fact of plan.facts) take(fact);
      preparation = plan.preparation; items = plan.items; binding = plan.anomalyBinding; nextUnit = plan.nextUnitSerial;
    } else {
      check(birth.kind === 'item-acquired' && (receipt.kind === 'item' || receipt.kind === 'choice'
        && !receipt.skipped && state.phase !== 'gameOver' && resolvedChoices === earnedChoices.length), 'mechanic choice birth order');
      const definitionId = receipt.kind === 'item' ? receipt.definitionId : receipt.optionId;
      const plan = planPermanentItemGrant({items,nextItemSerial:nextItem},{definitionId,receiptId:receipt.receiptId},[]);
      check(plan.ok && receipt.itemId === plan.grantedItemIds[0], 'mechanic item transaction');
      take({kind:'item-acquired',itemId:plan.grantedItemIds[0],source});
      items = plan.state.items; nextItem = plan.state.nextItemSerial;
    }
    return true;
  };
  const continuation = () => {
    if(entries[cursor]?.kind==='d14-returned'){
      const fact=entries[cursor];check(fact.kind==='d14-returned'&&state.d14&&committed,'D14 return boundary');
      const unit=state.preparation.units.find(u=>u.id===fact.unitId);check(unit,'D14 returned unit');
      preparation={...preparation,units:[...preparation.units,unit]};items=[...items,...hiddenItems];hiddenItems=[];
      take({kind:'d14-returned',choiceId:fact.choiceId,unitId:fact.unitId,settledOrdinal:fact.settledOrdinal});
    }
    combinations();
    for(;;){
      const fact=entries[cursor];
      if(fact?.kind==='unit-acquired'&&fact.source.kind==='loot'){
        const receiptId=fact.source.receiptId;
        const slot=direct.find(s=>s.payload.kind==='forge'&&lootReceiptId(s.dropId)===receiptId) as FrozenDirectDrop|undefined;
        check(slot&&expectedProgress.get(slot.dropId)==='revealed'&&grant(slot),'deferred anvil claim');expectedProgress.set(slot.dropId,'granted');
      }else if(fact?.kind==='anvil-opened'){
        check(preparation.units.some(u=>u.id===fact.unitId&&isAnvil(u.definitionId)),'anvil consumption');
        preparation={...preparation,units:preparation.units.filter(u=>u.id!==fact.unitId)};
        take({kind:'anvil-opened',unitId:fact.unitId,choiceId:fact.choiceId});
      }else if(fact?.kind==='unit-removed'&&fact.definitionId===undefined){
        // Batch-3 Support Mining retires its own training dummy in the settlement drain; the dummy ledger authenticates it.
        check(preparation.units.some(u=>u.id===fact.unitId&&u.definitionId==='training-dummy'),'dummy retirement');
        preparation={...preparation,units:preparation.units.filter(u=>u.id!==fact.unitId)};
        take({kind:'unit-removed',unitId:fact.unitId,receiptId:fact.receiptId});
      }else if(!mechanicBirth())break;
      combinations();
    }
  };
  if (state.phase !== 'gameOver') for (const choice of earnedChoices) {
    continuation(); // Between user choices, never inside a grant transaction.
    if (!loot.choiceResolutions.some(value => value.dropId === choice.dropId)) break;
    resolve(choice); resolvedChoices++;
  }
  while (cursor < entries.length) {
    continuation();
    if (cursor === entries.length) break;
    const sale = entries[cursor];
    check(state.phase !== 'gameOver' && resolvedChoices === earnedChoices.length
      && [...expectedProgress.values()].includes('pending-capacity') && sale.kind === 'unit-sold'
      && sale.context === 'settlement-capacity', 'capacity sale boundary');
    const unit = preparation.units.find(value => value.id === sale.unitId);
    check(unit?.team === 'player' && sale.goldGranted === getUnitSellPrice(unit), 'capacity sale identity/price');
    take({kind:'unit-sold',unitId:sale.unitId,context:'settlement-capacity',goldGranted:sale.goldGranted});
    saleGold += sale.goldGranted;
    preparation = {...preparation,units:preparation.units.filter(value => value.id !== sale.unitId)};
    items = items.map(item => item.location.kind === 'unit' && item.location.unitId === sale.unitId ? {...item,location:{kind:'inventory'}} : item);
    if (binding?.unitId === sale.unitId) binding = null;
    for (const slot of direct) if (expectedProgress.get(slot.dropId) === 'pending-capacity' && grant(slot)) expectedProgress.set(slot.dropId,'granted');
  }
  check(mechanicCursor === mechanicBirths.length, 'mechanic birth coverage');
  check(equal(sorted(preparation.units),sorted(state.preparation.units)) && equipmentContinuation(items,state.items)
    && equal(binding,state.anomalyBinding) && equal(basis.inputs.augments,state.augments), 'finished resource projection');
  check(nextUnit === state.nextUnitSerial && nextItem === state.nextItemSerial, 'finished serial projection');
  check(equal(actualReceiptOrder,loot.receipts.filter(receipt => direct.some(slot => slot.dropId === receipt.dropId)
    || choices.some(slot => slot.dropId === receipt.dropId)).map(receipt => receipt.dropId)), 'current grant order');
  for (const progress of loot.direct.filter(entry => expectedProgress.has(entry.dropId))) check(progress.status === expectedProgress.get(progress.dropId), 'capacity retry projection');
  return saleGold;
}

function replayG23Conversion(items:readonly import('./strategy-types').ItemInstance[],fact:Extract<ResourceFact,{kind:'g23-item-converted'}>){
 check(items.some(i=>i.id===fact.itemId&&i.definitionId===fact.from)&&g23RadiantDefinitionId(fact.from)===fact.to,'G23 conversion source');
 return items.map(i=>i.id===fact.itemId?{...i,definitionId:fact.to}:i);
}
