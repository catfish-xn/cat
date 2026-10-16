import { validateConsumableState, replayConsumableItems } from './consumables';
import { ITEM_DEFINITIONS } from './content/items';
import { canonicalContent, equalValidatedContent } from './content';
import { LOOT_POLICY_VERSION, LOOT_SLOTS } from './content/loot';
import { restoreFrozenLootLedger } from './loot-freeze';
import { lootReceiptId, compareLootChoices } from './loot-identity';
import { makeLootPendingChoice, orderedUnresolvedLootChoices } from './loot-choice';
import { readCombatStrategyInputs, restoreCombatInput, type CombatInputBasis } from './combat-input';
import { foldResourceProvenance, validateResourceReceipts, type ResourceFact, type ResourceProvenanceContext } from './resource-provenance';
import { getCatalogRoundById } from './round-selectors';
import { planUnitAcquisition } from './unit-acquisition';
import { getUnitSellPrice } from './unit-stats';
import type { MatchState } from './match-types';
import type { LootChoiceDescriptor, FrozenDirectDrop } from './loot-types';
import type { LootReceipt } from './m8/contracts';
import { planCombine, planEquip } from './inventory';
import type { ItemInstance } from './strategy-types';
import type { GameState } from './game';

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

/** Survivors of frozen equipment keep their exact position. Items still in
 * inventory in the replay may have been legally equipped since the freeze.
 * Final ownership/slots/unique/exclusive constraints are checked by restoreMatch. */
function equipmentContinuation(expected: readonly ItemInstance[], actual: readonly ItemInstance[]): boolean {
  return expected.length === actual.length && expected.every(item => {
    const current = actual.find(other => other.id === item.id);
    return current?.definitionId === item.definitionId
      && (item.location.kind === 'inventory' || equal(item.location, current.location));
  });
}

/** Pure ledger validation. Historical deaths have bounded evidence, not independent replay authentication. */
export function validateB8Loot(state: MatchState, parsedJsonInput = false): boolean {
  const equal = parsedJsonInput ? equalValidatedContent : (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
  const loot = state.m8.loot;
  keys(loot, ['layoutBinding','frozen','direct','choiceEligibility','choiceResolutions','earnedEvidence','receipts','guaranteeCounters']);
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
    const source = JSON.stringify([slot.roundId,slot.sourceUnitId]), identity = canonicalContent(entry.death);
    check(!sourceDeaths.has(source) || equal(sourceDeaths.get(source),entry.death), 'source death conflict');
    check(!deathSources.has(identity) || deathSources.get(identity) === source, 'duplicate death identity');
    sourceDeaths.set(source,entry.death); deathSources.set(identity,source); evidence.set(entry.dropId,entry);
  }
  // The same structural receipt validator also supplies the provenance birth proof.
  // Keep the frozen-slot authentication here; do not maintain a second receipt schema.
  validateResourceReceipts({scheduleReceipts:state.scheduleReceipts,lootReceipts:loot.receipts,throughRoundOrdinal:state.round});
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
      const death = state.combat?.neutralReceipts?.deaths.find(value => value.unitId === slot.sourceUnitId);
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
    if (slot.roundId !== state.roundDefinitionId) check(['granted','forfeited'].includes(progress.status), 'unresolved historical direct');
    if (state.combat?.status === 'finished' && slot.roundId === state.roundDefinitionId) {
      check(progress.status !== 'revealed', 'unprocessed direct');
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
  const counters = Object.fromEntries(Object.keys(LOOT_SLOTS).map(roundId => [JSON.stringify([LOOT_POLICY_VERSION,roundId,'components-granted']),0]));
  for (const receipt of loot.receipts) if (receipt.payload.kind === 'item') counters[JSON.stringify([LOOT_POLICY_VERSION,slots.get(receipt.dropId)!.roundId,'components-granted'])]+=ITEM_DEFINITIONS[receipt.payload.definitionId].kind==='completed'?2:1;
  check(equal(counters,loot.guaranteeCounters), 'actual guarantee counters');
  const unresolved = orderedUnresolvedLootChoices(choices,loot.choiceEligibility,loot.choiceResolutions);
  if (state.combat?.status === 'finished' && state.phase !== 'gameOver' && unresolved.length) {
    check(state.phase === 'choice' && equal(state.pendingChoice,makeLootPendingChoice(unresolved[0])), 'first loot choice'); return true;
  }
  return false;
}

/** Verify all births/consumption and independently compile the immutable combat prefix. */
export function validateB8Resources(state: MatchState, parsedJsonInput = false): { basis: CombatInputBasis | null; saleGold: number } {
  const equal = parsedJsonInput ? equalValidatedContent : (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
  validateConsumableState(state);
  const opening = state.resourceProvenance.entries[0];
  check(opening?.kind === 'unit-acquired' && opening.source.kind === 'opening' && opening.source.seatId === (state.sharedPool?.seatId ?? 'solo') && (state.sharedPool || opening.source.seed === state.seed), 'opening stream identity');
  const context: ResourceProvenanceContext = { carouselReceipts:state.carousel?.receipts,pendingCarouselUnitIds:state.carousel?.pendingUnits.map(u=>u.unitId),carouselOpening:!!state.carousel, scheduleReceipts:state.scheduleReceipts,lootReceipts:state.m8.loot.receipts,
    throughRoundOrdinal:state.round,combatSettlements:state.roundResults.filter(result => result.roundKind !== 'supply')
      .map(result => ({roundId:result.roundId,combatId:`round-${result.round}`,settlementId:result.settlementId})) };
  const current = foldResourceProvenance(state.resourceProvenance,context,parsedJsonInput);
  check(equal(current,{units:sorted([...state.preparation.units.filter(unit => unit.team === 'player').map(({id,definitionId,starLevel}) => ({id,definitionId,starLevel})),...(state.carousel?.pendingUnits.map(u=>({id:u.unitId,definitionId:u.definitionId,starLevel:1}))??[])]),
    items:sorted(state.items.map(({id,definitionId}) => ({id,definitionId}))),persistentGrowth:state.persistentGrowth,
    nextUnitSerial:state.nextUnitSerial,nextItemSerial:state.nextItemSerial}), 'current resource fold');
  if (state.combat === null) { check(state.combatInputBasis === null, 'inactive input basis'); return {basis:null,saleGold:0}; }
  const entries = state.resourceProvenance.entries, combat = state.combat;
  const commits = entries.filter(entry => entry.kind === 'combat-growth-committed' && entry.combatId === combat.combatId);
  check(combat.status === 'finished' ? commits.length === 1 : commits.length === 0, 'current growth commit count');
  const commit = commits[0];
  check(!commit || commit.kind === 'combat-growth-committed', 'growth commit');
  const candidate = state.combatInputBasis;
  check(candidate, 'missing input basis');
  const prefixLength = commit?.combatStartProvenancePrefixLength ?? candidate.provenancePrefixLength;
  integer(prefixLength, 1); check(prefixLength <= entries.length, 'combat prefix bounds');
  check(entries[prefixLength]?.kind !== 'unit-upgraded', 'combat prefix transaction boundary');
  const rollPrefix = candidate.equipmentRollPrefixLength;
  integer(rollPrefix); check(rollPrefix <= state.equipmentState.rolls.length, 'equipment prefix bounds');
  const basis = restoreCombatInput(state.combatInputBasis,{seed:state.seed,round:state.round,contentDigest:state.contentDigest,
    playerLevel:state.roundResults[state.round-1]?.levelBefore ?? state.level,provenancePrefixLength:prefixLength,
    // Only locally parsed JSON cannot run accessors between these reads. Keep
    // the original second validation for every object input and shorter prefix.
    resources:parsedJsonInput && prefixLength === entries.length ? current : foldResourceProvenance(state.resourceProvenance,{...context,prefixLength},parsedJsonInput),equipmentRolls:state.equipmentState.rolls,
    equipmentRollPrefixLength:rollPrefix,scheduleReceipts:state.scheduleReceipts,roundResults:state.roundResults}, parsedJsonInput);
  check(state.equipmentState.rolls.slice(rollPrefix).every(roll => roll.roundId === state.roundDefinitionId
    && !basis.inputs.items.some(item => item.id === roll.parentItemInstanceId && item.location.kind === 'unit')), 'post-freeze equipment rolls');
  check(state.battleSeedRngState === basis.battleSeed, 'battle seed cursor');
  if (combat.status === 'running') {
    const { items: _items, temporaryEquipment: _children, ...live } = readCombatStrategyInputs(state);
    const { items: originalItems, temporaryEquipment: _frozenChildren, ...frozenInputs } = basis.inputs;
    check(equal(live, frozenInputs), 'running input mutation');
    let items = originalItems, serial = basis.nextItemSerial;
    for (const fact of entries.slice(prefixLength)) {
      check((fact.kind === 'item-combined'||fact.kind==='consumable-used') && fact.roundId === state.roundDefinitionId, 'running resource suffix');
      const plan = fact.kind==='consumable-used'?replayConsumableItems(items,serial,fact.record,state.preparation):replayCombination(items, state.preparation, serial, fact);
      items = plan.items; serial = plan.nextItemSerial;
    }
    check(equipmentContinuation(items, state.items) && serial === state.nextItemSerial, 'running equipment projection');
    return {basis,saleGold:0};
  }
  const deltas = combat.units.filter(unit => unit.team === 'player' && (unit.runtime?.permanentAdBps ?? 0) > 0)
    .map(unit => ({sourceUnitId:unit.id,attackDamageBps:unit.runtime!.permanentAdBps})).sort((a,b) => a.sourceUnitId < b.sourceUnitId ? -1 : 1);
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
  const take = (fact: ResourceFact) => {
    check(equal(entries[cursor],{...fact,sequence:cursor,roundId:state.roundDefinitionId}), 'ordered resource transaction'); cursor++;
  };
  const combinations = () => {
    while (entries[cursor]?.kind === 'item-combined'||entries[cursor]?.kind==='consumable-used') {
      const tool=entries[cursor];
      if(tool.kind==='consumable-used') {
        check(!committed||state.phase!=='gameOver','terminal consumable operation');
        const plan=replayConsumableItems(items,nextItem,tool.record,state.preparation);take({kind:'consumable-used',record:tool.record});
        items=plan.items;nextItem=plan.nextItemSerial;continue;
      }
      check(!committed || state.phase !== 'gameOver', 'terminal equipment operation');
      const fact = entries[cursor] as Extract<ResourceFact, { kind: 'item-combined' }>;
      const plan = replayCombination(items, preparation, nextItem, fact);
      take({ kind: 'item-combined', event: fact.event });
      items = plan.items; nextItem = plan.nextItemSerial;
    }
  };
  // Plain equip has no birth/consumption fact. Before a loot-driven upgrade,
  // replay surviving inventory items at their final legal positions when the
  // holder already exists. This preserves the latest survivor's occupied slots
  // (including exclusive parents) when frozen donor equipment is transferred.
  // Never detach a frozen item or synthesize an unrecorded combination.
  const survivingPlacements = () => {
    for (const actual of state.items) {
      const location = actual.location;
      if (location.kind !== 'unit') continue;
      const item = items.find(candidate => candidate.id === actual.id);
      if (item?.location.kind !== 'inventory' || !preparation.units.some(unit => unit.id === location.unitId)) continue;
      const plan = planEquip(items, preparation, item.id, location.unitId, location.slot, nextItem);
      if (plan.ok && plan.nextItemSerial === nextItem) items = plan.items;
    }
  };
  const grant = (slot: FrozenDirectDrop | LootChoiceDescriptor, definitionId?: string): boolean => {
    const payload = 'payload' in slot ? slot.payload : {kind:'item' as const,definitionId:definitionId!,quantity:1};
    const receipt = receipts.get(slot.dropId);
    let itemIds: string[] = [], unitIds: string[] = [];
    if (payload.kind === 'unit') {
      survivingPlacements();
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
    : grant(slot) ? 'granted' : state.phase === 'gameOver' ? 'retained-terminal' : 'pending-capacity');
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
  let resolvedChoices = 0;
  if (state.phase !== 'gameOver') for (const choice of earnedChoices) {
    combinations(); // Between user choices, never inside a grant transaction.
    if (!loot.choiceResolutions.some(value => value.dropId === choice.dropId)) break;
    resolve(choice); resolvedChoices++;
  }
  while (cursor < entries.length) {
    combinations();
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
  check(equal(sorted(preparation.units),sorted(state.preparation.units)) && equipmentContinuation(items,state.items)
    && equal(binding,state.anomalyBinding) && equal(basis.inputs.augments,state.augments), 'finished resource projection');
  check(nextUnit === state.nextUnitSerial && nextItem === state.nextItemSerial, 'finished serial projection');
  check(equal(actualReceiptOrder,loot.receipts.filter(receipt => direct.some(slot => slot.dropId === receipt.dropId)
    || choices.some(slot => slot.dropId === receipt.dropId)).map(receipt => receipt.dropId)), 'current grant order');
  for (const progress of loot.direct.filter(entry => expectedProgress.has(entry.dropId))) check(progress.status === expectedProgress.get(progress.dropId), 'capacity retry projection');
  return saleGold;
}
