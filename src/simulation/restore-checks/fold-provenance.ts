// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { carryGolemStar } from '../augment-pool-batch5-g6-stats';
import { carryGolemFixedItemIds } from '../augment-pool-batch5-g6-equipment';
import { projectBatch5Items } from '../augment-pool-batch5-s3a';
import { academicCraft } from '../augment-pool-batch5-s3b';
import { isS3bConversion, validS3bConversion } from '../augment-pool-batch5-s3b-conversions';
import { DEFAULT_BOARD, isDeploymentCell } from '../board';
import { MAX_COMBAT_TICKS } from '../combat-types';
import { isAnvil } from '../content/anvils';
import { isAngerIssuesConvertibleItem } from '../content/augment-pool-batch5-r2';
import { freezeContent } from '../content/freeze';
import { ITEM_DEFINITIONS } from '../content/g2-3-item-registry';
import { canonicalContent } from '../content/index';
import { TRAINER_ID, trainerStar } from '../content/opening-batch-b';
import { g23RadiantDefinitionId, g23RewardAtoms } from '../g2-3-rewards';
import { compareCodePoints } from '../m8/identity';
import { MATCH_RULES, OPENING_INITIAL_STATE, SHOP_CATALOG } from '../match-rules';
import type { PersistentGrowth } from '../match-types';
import { selectOpeningUnit } from '../opening-unit';
import { type BirthReceipt, compareGrowth, type FoldedResourceProvenance, integer, keys, mergeGrowthLedger, nonempty, plainJson, type ProvenanceCombatSettlement, type ProvenanceItem, type ProvenanceUnit, record, requireValue, RESOURCE_PROVENANCE_VERSION, type ResourceProvenanceContext, type ResourceProvenanceEntry, validateResourceReceipts } from '../resource-provenance';
import { getCatalogRoundById, getCatalogRoundByOrdinal } from '../round-selectors';
import { receiptId, SHOP_AUGMENT_SOURCE } from '../shop-augments';
import { getUnitSellPrice } from '../unit-stats';
import type { UnitUpgradedEvent } from '../unit-types';
import { UNIT_DEFINITIONS } from '../units';

const compareIds = (a: { readonly id: string }, b: { readonly id: string }) => compareCodePoints(a.id, b.id);

function validateUpgrade(event: UnitUpgradedEvent): void {
  keys(event, ['type', 'survivorId', 'consumedIds', 'definitionId', 'fromStar', 'toStar', 'location']);
  nonempty(event.definitionId);
  requireValue(event.type === 'unitUpgraded' && (event.fromStar === 1 || event.fromStar === 2)
    && event.toStar === event.fromStar + 1, 'upgrade stars');
  requireValue(Array.isArray(event.consumedIds) && event.consumedIds.length === 2
    && new Set([event.survivorId, ...event.consumedIds]).size === 3
    && compareCodePoints(event.consumedIds[0], event.consumedIds[1]) < 0, 'upgrade participants');
  [event.survivorId, ...event.consumedIds].forEach(nonempty);
  record(event.location);
  if (event.location.kind === 'board') {
    keys(event.location, ['kind', 'cell']); keys(event.location.cell, ['col', 'row']);
    requireValue(isDeploymentCell(DEFAULT_BOARD, 'player', event.location.cell), 'upgrade location');
  } else {
    keys(event.location, ['kind', 'slot']); integer(event.location.slot);
    requireValue(event.location.kind === 'bench' && event.location.slot < 9, 'upgrade location');
  }
}

/** Read-only structural proof. Location/retention and current combat deltas are cross-checked by
 * Match against its independently validated basis and the existing planPurchase implementation.
 * This does not authenticate jointly forged historical shop commands or historical combat events.
 */
export function foldResourceProvenance(value: unknown, context: ResourceProvenanceContext, parsedJsonInput = false): FoldedResourceProvenance {
  getCatalogRoundByOrdinal(context.throughRoundOrdinal);
  if (!parsedJsonInput) plainJson(value);
  record(value);
  requireValue(Object.hasOwn(value, 'equipmentHistory'), 'ordered equipment history required');
  keys(value, ['version', 'equipmentHistory', 'entries']);
  requireValue(value.equipmentHistory === 'ordered', 'ordered equipment history required');
  requireValue(value.version === RESOURCE_PROVENANCE_VERSION && Array.isArray(value.entries) && (value.entries.length > 0 || context.carouselOpening===true), 'version/opening');
  const entries = value.entries as ResourceProvenanceEntry[];
  const prefixLength = context.prefixLength ?? entries.length;
  integer(prefixLength); requireValue(prefixLength <= entries.length, 'prefix bounds');
  const births = validateResourceReceipts(context), usedBirths = new Set<string>();
  const fixedItemIds = carryGolemFixedItemIds(context.mechanicReceipts);
  const rewardAtoms = new Map(context.g23?.rewards.flatMap(bundle => g23RewardAtoms(bundle,context.g23!.seed).map(atom => [atom.id,atom] as const)));
  const duplicatorClaims = new Map(context.g23?.rewardClaims.flatMap(claim => {
    const atom = rewardAtoms.get(claim.atomId);
    return atom?.kind === 'duplicator' ? [[claim.id,atom] as const] : [];
  }));
  // Progress has been replayed from economy actions and linked to round results.
  // Derive reward availability from that authority, never from the saved ordering.
  const rewardBoundaries = new Map(context.g23?.rewardClaims.map(claim => {
    const bundle = context.g23!.rewards.find(bundle => bundle.id === claim.bundleId)!;
    const battle = context.g23!.economyReceipts.find(receipt => receipt.kind === 'battle'
      && (bundle.source === 'conqueror' || bundle.source === 'family' ? receipt.bundles.includes(bundle.id)
        : bundle.id === `g23:market:${receipt.facts.battleId}:${bundle.tier}`));
    requireValue(battle?.kind === 'battle', 'mechanic reward battle');
    const roundId = getCatalogRoundByOrdinal(battle.facts.round).roundId;
    const settlement = context.combatSettlements.find(value => value.roundId === roundId);
    requireValue(settlement && claim.round >= bundle.round && bundle.round >= battle.facts.round,
      'mechanic reward settlement');
    const commitIndex = entries.findIndex(entry => entry.kind === 'combat-growth-committed'
      && entry.roundId === roundId && entry.combatId === settlement.combatId
      && entry.settlementId === settlement.settlementId);
    requireValue(commitIndex >= 0, 'mechanic reward settlement');
    return [claim.id, {claimRound:claim.round, commitIndex}] as const;
  }));
  const absent=new Set<string>();
  const units = new Map<string, ProvenanceUnit>(), items = new Map<string, ProvenanceItem>();
  let growth: readonly PersistentGrowth[] = [], nextUnitSerial = 1, nextItemSerial = 1, lastOrdinal = 1;
  let acquisition: { readonly sequence: number; readonly unitId: string; readonly definitionId: string; readonly roundId: string; survivorId: string; star: number } | null = null;
  let lastShopGeneration = 0, lastFreeReroll = 0;
  const shopSlots = new Set<string>(), commits = new Map<string, ProvenanceCombatSettlement>();
  const firstLootBirth = new Map<string, number>();
  const starts = new Set(entries.filter(entry => entry?.kind === 'combat-growth-committed')
    .map(entry => (entry as Extract<ResourceProvenanceEntry, { kind: 'combat-growth-committed' }>).combatStartProvenancePrefixLength));
  const unitPrefixes = new Map<number, ReadonlyMap<string, ProvenanceUnit>>();
  let inventoryPrefix=-1,inventoryRound=0;
  const projection = (): FoldedResourceProvenance => ({ units: [...units.values()].map(unit => ({ ...unit,...(unit.definitionId==='carry-golem'?{starLevel:carryGolemStar(context.throughRoundOrdinal,context.scheduleReceipts.find(r=>r.kind==='augment'&&r.definitionId==='im-the-carry-now')?.round??context.throughRoundOrdinal)}:unit.definitionId===TRAINER_ID?{starLevel:trainerStar(getCatalogRoundByOrdinal(context.throughRoundOrdinal).stage)}:{}) })).sort(compareIds),
    items: projectBatch5Items([...items.values()],context.batch5Inventory??{conversions:[],anvils:[]},prefixLength,context.throughRoundOrdinal,inventoryPrefix,inventoryRound).map(item => ({ ...item })).sort(compareIds), persistentGrowth: growth.map(entry => ({ ...entry })), nextUnitSerial, nextItemSerial });
  let result = projection();
  const deferredCarouselIds = new Set<string>(), preparationReceipts = new Set<string>(), claimedCarouselIds = new Set<string>();
  const finishAcquisition = () => {
    if (!acquisition) return;
    if(isAnvil(acquisition.definitionId)){acquisition=null;return;}
    for (const star of [1, 2]) requireValue([...units.values()].filter(unit => unit.definitionId === acquisition!.definitionId && unit.starLevel === star && !absent.has(unit.id) && !deferredCarouselIds.has(unit.id) && !context.pendingCarouselUnitIds?.includes(unit.id)).length < 3, 'missing upgrade');
    acquisition = null;
  };
  const takeBirth = (key: string, kind: BirthReceipt['kind'], id: string, roundId: string): string => {
    const birth = births.get(key);
    requireValue(birth && birth.kind === kind && birth.id === id && birth.roundId === roundId && !usedBirths.has(key), 'receipt birth binding');
    usedBirths.add(key); return birth.definitionId;
  };
  for (const [index, entry] of entries.entries()) {
    record(entry); integer(entry.sequence);
    requireValue(entry.sequence === index, 'sequence');
    const round = getCatalogRoundById(entry.roundId);
    requireValue(round.ordinal >= lastOrdinal && round.ordinal <= context.throughRoundOrdinal, 'round order/boundary');
    if(context.batch5Inventory){const projected=projectBatch5Items([...items.values()],context.batch5Inventory,index,round.ordinal,inventoryPrefix,inventoryRound);inventoryPrefix=index;inventoryRound=round.ordinal;items.clear();for(const item of projected)items.set(item.id,item);}
    lastOrdinal = round.ordinal;
    if (starts.has(index)) unitPrefixes.set(index, new Map([...units].filter(([id])=>!absent.has(id))));
    if (entry.kind !== 'unit-upgraded') finishAcquisition();
    const common = ['kind', 'sequence', 'roundId'];
    const lootSourceId=(entry.kind==='unit-acquired'||entry.kind==='item-acquired')&&entry.source?.kind==='loot'?entry.source.receiptId:null;
    const explicitOrbReceipt=lootSourceId?context.lootReceipts.find(r=>r.receiptId===lootSourceId&&r.claimedRoundId===entry.roundId):undefined;
    if ((entry.kind === 'unit-acquired' || entry.kind === 'item-acquired') && entry.source?.kind === 'loot'
      && !explicitOrbReceipt
      && !firstLootBirth.has(entry.roundId)) firstLootBirth.set(entry.roundId, index);
    if ((entry.kind === 'unit-acquired' || entry.kind === 'item-acquired') && entry.source?.kind === 'mechanic') {
      const boundary = rewardBoundaries.get(entry.source.receiptId);
      if (boundary) {
        const commit = entries[boundary.commitIndex] as Extract<ResourceProvenanceEntry, {kind:'combat-growth-committed'}>;
        requireValue(round.ordinal === boundary.claimRound && index > boundary.commitIndex,
          'mechanic reward settlement order');
        requireValue(commit.combatStartProvenancePrefixLength <= boundary.commitIndex
          && commit.combatStartProvenancePrefixLength < index, 'mechanic reward combat prefix');
      }
    }
    if (entry.kind === 'unit-transformed' || entry.kind === 'augment-transform-completed') {
      keys(entry, [...common, 'choiceId', ...(entry.kind === 'unit-transformed' ? ['unitId','from','to','starLevel'] : [])]);
      const receipt = context.scheduleReceipts.find(r => r.eventId === entry.choiceId && r.kind === 'augment');
      const recombobulator = receipt?.definitionId === 'recombobulator';
      requireValue(receipt && (recombobulator ? receipt.round === round.ordinal : receipt.definitionId === 'pandoras-bench' && receipt.round < round.ordinal), 'transform owner/round');
      requireValue(!entries.slice(0,index).some(e => e.kind === 'augment-transform-completed' && e.choiceId === entry.choiceId && e.roundId === entry.roundId), 'duplicate transform batch');
      if (entry.kind === 'unit-transformed') {
        const unit = units.get(entry.unitId);
        requireValue(unit && !absent.has(entry.unitId) && unit.definitionId === entry.from && unit.starLevel === entry.starLevel
          && SHOP_CATALOG.includes(entry.to) && (recombobulator ? UNIT_DEFINITIONS[entry.from].cost <= 5 && Math.min(5,UNIT_DEFINITIONS[entry.from].cost+1) === UNIT_DEFINITIONS[entry.to].cost : UNIT_DEFINITIONS[entry.from].cost === UNIT_DEFINITIONS[entry.to].cost), 'transform ownership/tier');
        units.set(entry.unitId, { ...unit!, definitionId: entry.to });
      }
    } else if(entry.kind==='dual-purpose-selected'){
      keys(entry,[...common,'choiceId','level','xp']);integer(entry.level,1);integer(entry.xp);
      requireValue(context.scheduleReceipts.some(r=>r.eventId===entry.choiceId&&r.definitionId==='dual-purpose'&&r.round===round.ordinal),'dual purpose selection');
    } else if(entry.kind==='dual-purpose-xp-purchased'){
      keys(entry,[...common,'levelBefore','xpBefore','generation','settled']);
      integer(entry.levelBefore,1);integer(entry.xpBefore);integer(entry.generation,1);requireValue(typeof entry.settled==='boolean','dual purpose phase');
      // Full XP/round/generation authentication belongs to validateBatch5Gold, beside its refund plan.
    } else if(entry.kind==='form-swapper-selected'){
      keys(entry,[...common,'choiceId']);
      const receipt=context.scheduleReceipts.find(r=>r.eventId===entry.choiceId&&r.kind==='augment');
      requireValue(receipt?.definitionId==='why-not-both'&&receipt.round===round.ordinal,'form swapper selection');
      requireValue(!entries.slice(0,index).some(e=>e.kind==='form-swapper-selected'),'form swapper duplicate selection');
    }else if(entry.kind==='d14-selected'){
      keys(entry,[...common,'choiceId','unitId','heldItems']);
      const receipt=context.scheduleReceipts.find(r=>r.eventId===entry.choiceId&&r.kind==='anomaly');
      const u=units.get(entry.unitId);requireValue(receipt&&receipt.unitId===entry.unitId&&receipt.round===round.ordinal&&u,'D14 selection');
      requireValue(receipt.definitionId==='ultimate-hero'?u.starLevel===3&&UNIT_DEFINITIONS[u.definitionId].cost===1:receipt.definitionId==='into-the-unknown','D14 target');
      requireValue(!entries.slice(0,index).some(e=>e.kind==='d14-selected'),'D14 duplicate selection');
      requireValue(Array.isArray(entry.heldItems)&&new Set(entry.heldItems.map(i=>i.id)).size===entry.heldItems.length,'D14 equipment');
      for(const value of entry.heldItems){keys(value,['id','definitionId','location']);keys(value.location,['kind','unitId','slot']);const i=value as unknown as import('../strategy-types').ItemInstance;requireValue(items.get(i.id)?.definitionId===i.definitionId&&i.location.kind==='unit'&&i.location.unitId===entry.unitId&&[0,1,2].includes(i.location.slot),'D14 equipment ownership');}
      requireValue(receipt.definitionId==='into-the-unknown'||entry.heldItems.length===0,'D14 unexpected equipment');
      if(receipt.definitionId==='into-the-unknown')absent.add(entry.unitId);
    }else if(entry.kind==='d14-returned'){
      keys(entry,[...common,'choiceId','unitId','settledOrdinal']);
      const receipt=context.scheduleReceipts.find(r=>r.eventId===entry.choiceId&&r.kind==='anomaly'&&r.definitionId==='into-the-unknown');
      requireValue(receipt&&receipt.unitId===entry.unitId&&absent.has(entry.unitId)&&Number.isSafeInteger(entry.settledOrdinal)&&entry.settledOrdinal>=receipt.round-1+3&&entry.settledOrdinal<=round.ordinal,'D14 return');
      absent.delete(entry.unitId);
    }else if (entry.kind === 'unit-acquired') {
      keys(entry, [...common, 'unitId', 'source']); record(entry.source);
      const source=entry.source;
      const pilferBirth=source.kind==='mechanic'&&context.pilferRewards?.some(gift=>gift.kind==='unit'
        &&gift.receiptId===source.receiptId&&gift.acquiredRound===round.ordinal);
      // Firesale grants on natural supply entries too. Shop-history replay separately authenticates the slot/RNG;
      // here bind the birth to its earlier augment selection and the exact held-unit receipt, not any mechanic grant.
      const firesaleBirth=round.kind==='supply'&&source.kind==='mechanic'&&context.scheduleReceipts.some(owner=>owner.kind==='augment'
        &&owner.definitionId==='firesale'&&owner.round<round.ordinal
        &&source.receiptId===receiptId('firesale',{definitionId:owner.definitionId,choiceId:owner.eventId,acquiredRound:owner.round},round.ordinal))
        &&context.mechanicReceipts?.some(r=>r.kind==='unit'&&r.source===SHOP_AUGMENT_SOURCE
          &&r.receiptId===source.receiptId&&r.resolution==='held'&&r.unitId===entry.unitId
          &&r.round===round.ordinal&&r.roundId===entry.roundId);
      requireValue(round.kind !== 'supply'||entry.source.kind==='carousel'||entry.source.kind==='loot'
        &&explicitOrbReceipt?.resolution==='held'||pilferBirth||firesaleBirth, 'unit birth in supply');
      requireValue(entry.unitId === `unit-${nextUnitSerial}`, 'unit serial'); integer(nextUnitSerial + 1, 1);
      let definitionId: string;
      if (entry.source.kind === 'opening') {
        keys(entry.source, ['kind','seed','seatId']);
        requireValue(index === 0 && entry.unitId === OPENING_INITIAL_STATE.unit.id && round.ordinal === 1, 'opening');
        definitionId = selectOpeningUnit(entry.source.seed as number, entry.source.seatId as string);
      } else if(entry.source.kind==='carousel') {
        keys(entry.source,['kind','receiptId']);definitionId=takeBirth(`carousel-unit:${entry.source.receiptId}`,'unit',entry.unitId,entry.roundId);
      } else if (entry.source.kind === 'shop') {
        keys(entry.source, ['kind', 'generation', 'slotIndex', 'definitionId',...(Object.hasOwn(entry.source,'starLevel')?['starLevel']:[])]);
        requireValue(entry.source.starLevel===undefined||entry.source.starLevel===2&&UNIT_DEFINITIONS[entry.source.definitionId]?.cost<=2, 'shop star');
        requireValue(!commits.has(entry.roundId), 'shop after settlement');
        integer(entry.source.generation, 1); integer(entry.source.slotIndex);
        requireValue(entry.source.slotIndex < MATCH_RULES.shopSize && entry.source.generation >= lastShopGeneration
          && SHOP_CATALOG.includes(entry.source.definitionId), 'shop source');
        const key = `${entry.source.generation}:${entry.source.slotIndex}`;
        requireValue(!shopSlots.has(key), 'duplicate shop purchase'); shopSlots.add(key); lastShopGeneration = entry.source.generation;
        definitionId = entry.source.definitionId;
      } else if (entry.source.kind === 'mechanic') {
        keys(entry.source, ['kind', 'receiptId']); nonempty(entry.source.receiptId);
        definitionId = takeBirth(`mechanic:${entry.source.receiptId}`, 'unit', entry.unitId, entry.roundId);
        // Dummify/Golemify: their summon is born right after the removals, so nothing but summons (and carousel picks not
        // yet placed, P 2026-10-24) may remain; this also covers an acquisition with no champion to remove.
        if(definitionId==='forming-dummy'||definitionId==='augment-golem')
          requireValue([...units.values()].every(unit=>absent.has(unit.id)||deferredCarouselIds.has(unit.id)||context.pendingCarouselUnitIds?.includes(unit.id)||UNIT_DEFINITIONS[unit.definitionId]?.summon),'forming removal completeness');
        const atom = duplicatorClaims.get(entry.source.receiptId);
        if (atom) {
          const owned = new Set([...units.values()].filter(unit => !deferredCarouselIds.has(unit.id)
            && !context.pendingCarouselUnitIds?.includes(unit.id)).map(unit => unit.definitionId));
          // Settlement births can only be automatic: the public claim command is
          // preparation-only. Replay its ordered selection before adding this birth,
          // even when the saved match has already advanced and combat is null.
          if (commits.has(entry.roundId)) requireValue(atom.options.find(id => owned.has(id)) === definitionId, 'mechanic duplicator target');
        }
      } else {
        keys(entry.source, ['kind', 'receiptId']);
        requireValue(entry.source.kind === 'loot', 'unit source'); nonempty(entry.source.receiptId);
        definitionId = takeBirth(`${entry.source.kind}:${entry.source.receiptId}`, 'unit', entry.unitId, entry.roundId);
      }
      requireValue(index !== 0 || (entry.source.kind === 'opening'||entry.source.kind==='carousel'&&context.carouselOpening===true), 'missing opening');
      const starLevel=entry.source.kind==='shop'?entry.source.starLevel??1:entry.source.kind==='loot'?births.get(`loot:${entry.source.receiptId}`)?.starLevel??1:entry.source.kind==='mechanic'?births.get(`mechanic:${entry.source.receiptId}`)?.starLevel??1:1;
      units.set(entry.unitId, { id: entry.unitId, definitionId, starLevel }); nextUnitSerial++;
      if(entry.source.kind==='carousel')deferredCarouselIds.add(entry.unitId);
      acquisition = { sequence: index, unitId: entry.unitId, definitionId, roundId: entry.roundId, survivorId: entry.unitId, star: starLevel };
    } else if (entry.kind === 'unit-upgraded') {
      keys(entry, [...common, 'acquisitionSequence', 'event']); integer(entry.acquisitionSequence);
      validateUpgrade(entry.event);
      const event = entry.event;
      requireValue(acquisition && acquisition.sequence === entry.acquisitionSequence && acquisition.sequence > 0
        && acquisition.roundId === entry.roundId && acquisition.definitionId === event.definitionId
        && acquisition.star === event.fromStar && [event.survivorId, ...event.consumedIds].includes(acquisition.survivorId), 'upgrade transaction');
      for (const id of [event.survivorId, ...event.consumedIds]) {
        const unit = units.get(id);
        requireValue(unit && !absent.has(id) && unit.definitionId === event.definitionId && unit.starLevel === event.fromStar, 'upgrade ownership');
      }
      event.consumedIds.forEach(id => units.delete(id));
      units.set(event.survivorId, { id: event.survivorId, definitionId: event.definitionId, starLevel: event.toStar });
      growth = mergeGrowthLedger(growth, [event]); acquisition.survivorId = event.survivorId; acquisition.star = event.toStar;
    } else if(entry.kind==='carousel-preparation-settled') {
      keys(entry,[...common,'receiptIds','claimedUnitIds','upgrades']);
      requireValue(Array.isArray(entry.receiptIds)&&Array.isArray(entry.claimedUnitIds)&&Array.isArray(entry.upgrades),'carousel preparation');
      const eligible = (id:string) => { const r=context.carouselReceipts?.find(r=>r.id===id);requireValue(r && getCatalogRoundById(r.carouselId.split(':').at(-1)!).ordinal<round.ordinal,'carousel preparation boundary');return r!; };
      for(const id of entry.receiptIds){const r=eligible(id);requireValue(!preparationReceipts.has(id),'duplicate carousel preparation');preparationReceipts.add(id);if(r.unitId)deferredCarouselIds.delete(r.unitId);}
      for(const id of entry.claimedUnitIds){const r=context.carouselReceipts?.find(r=>r.unitId===id);requireValue(r&&units.has(id)&&!claimedCarouselIds.has(id),'carousel claim ownership');eligible(r!.id);claimedCarouselIds.add(id);deferredCarouselIds.delete(id);}
      for(const event of entry.upgrades as readonly UnitUpgradedEvent[]){validateUpgrade(event);for(const id of [event.survivorId,...event.consumedIds]){const u=units.get(id);requireValue(u&&!absent.has(id)&&u.definitionId===event.definitionId&&u.starLevel===event.fromStar,'carousel upgrade ownership');}event.consumedIds.forEach(id=>units.delete(id));units.set(event.survivorId,{id:event.survivorId,definitionId:event.definitionId,starLevel:event.toStar});growth=mergeGrowthLedger(growth,[event]);}
    } else if(entry.kind==='carousel-unit-claimed') {
      keys(entry,[...common,'unitId','receiptId','upgrades']);
      const receipt=context.carouselReceipts?.find(r=>r.id===entry.receiptId);
      requireValue(receipt?.unitId===entry.unitId&&units.has(entry.unitId)&&Array.isArray(entry.upgrades),'pending carousel ownership');
      for(const event of entry.upgrades as readonly UnitUpgradedEvent[]){validateUpgrade(event);for(const id of [event.survivorId,...event.consumedIds]){const u=units.get(id);requireValue(u&&!absent.has(id)&&u.definitionId===event.definitionId&&u.starLevel===event.fromStar,'pending upgrade ownership');}event.consumedIds.forEach(id=>units.delete(id));units.set(event.survivorId,{id:event.survivorId,definitionId:event.definitionId,starLevel:event.toStar});growth=mergeGrowthLedger(growth,[event]);}
    } else if(entry.kind==='anvil-opened'){
      keys(entry,[...common,'unitId','choiceId']);
      requireValue(units.has(entry.unitId)&&isAnvil(units.get(entry.unitId)!.definitionId),'anvil ownership');
      nonempty(entry.choiceId);units.delete(entry.unitId);
    } else if(entry.kind==='free-reroll'){
      keys(entry,[...common,'generation']);integer(entry.generation,1);
      requireValue(entry.generation>lastFreeReroll,'free reroll order');lastFreeReroll=entry.generation;
    } else if(entry.kind==='unit-removed'){
      // Support Mining retires its dummy; Dummify/Golemify remove champions and record what was removed.
      const forming=Object.hasOwn(entry,'definitionId');
      keys(entry,[...common,'unitId','receiptId',...(forming?['definitionId','starLevel']:[])]);nonempty(entry.receiptId);
      const removed=units.get(entry.unitId);
      requireValue(removed&&!absent.has(entry.unitId)&&(forming?removed.definitionId===entry.definitionId&&removed.starLevel===entry.starLevel&&!UNIT_DEFINITIONS[removed.definitionId]?.summon
        &&entry.receiptId.endsWith(',"forming"]'):removed.definitionId==='training-dummy'),'mechanic removal ownership');
      units.delete(entry.unitId);growth=growth.filter(value=>value.unitId!==entry.unitId);
    } else if (entry.kind === 'unit-sold') {
      keys(entry, [...common, 'unitId', 'context', 'goldGranted']); integer(entry.goldGranted);
      const unit = units.get(entry.unitId);
      requireValue(unit && !isAnvil(unit.definitionId) && !absent.has(unit.id) && round.kind !== 'supply' && (entry.context === 'preparation' || entry.context === 'settlement-capacity'), 'sale ownership/context');
      requireValue(entry.context !== 'preparation' || !commits.has(entry.roundId), 'preparation sale after settlement');
      requireValue(entry.context !== 'settlement-capacity' || commits.has(entry.roundId), 'sale before settlement');
      requireValue(entry.goldGranted === getUnitSellPrice({ ...unit, team: 'player', location: { kind: 'bench', slot: 0 } }), 'sale price');
      units.delete(entry.unitId); growth = growth.filter(value => value.unitId !== entry.unitId);
    } else if (entry.kind === 'item-acquired') {
      keys(entry, [...common, 'itemId', 'source']); record(entry.source);
      requireValue(entry.itemId === `item-${nextItemSerial}`, 'item serial'); integer(nextItemSerial + 1, 1);
      const source = entry.source;
      requireValue(source.kind === 'schedule' || source.kind === 'loot'||source.kind==='carousel'||source.kind==='mechanic', 'item source');
      keys(source, source.kind === 'schedule' ? ['kind', 'eventId'] : ['kind', 'receiptId']);
      nonempty(source.kind === 'schedule' ? source.eventId : source.receiptId);
      const key = source.kind === 'schedule' ? `schedule:${source.eventId}` : source.kind==='carousel'?`carousel-item:${source.receiptId}`:source.kind==='mechanic'?`mechanic:${source.receiptId}`:`loot:${source.receiptId}`;
      const definitionId = takeBirth(key, 'item', entry.itemId, entry.roundId);
      items.set(entry.itemId, { id: entry.itemId, definitionId }); nextItemSerial++;
    } else if(entry.kind==='augment-item-transform'){
      keys(entry,[...common,'choiceId','receiptId','input','outputs']);
      const proof=context.augmentHistory?.facts.find(f=>f.kind==='augment-item-transform'&&f.receiptId===entry.receiptId);
      requireValue(proof&&proof.kind==='augment-item-transform'&&proof.resourcePrefix===index&&proof.roundId===entry.roundId
        &&canonicalContent([proof.choiceId,proof.input,proof.outputs])===canonicalContent([entry.choiceId,entry.input,entry.outputs]),'augment transform history');
      requireValue(items.get(entry.input.id)?.definitionId===entry.input.definitionId&&Array.isArray(entry.outputs)&&entry.outputs.length>0&&entry.outputs.length<=2,'augment transform input');
      items.delete(entry.input.id);
      for(const output of entry.outputs){
        requireValue(output.id===`item-${nextItemSerial}`&&!!ITEM_DEFINITIONS[output.definitionId]&&output.location.kind==='inventory','augment transform output');
        items.set(output.id,{id:output.id,definitionId:output.definitionId});nextItemSerial++;
      }
    } else if(entry.kind==='anger-item-converted'){
      keys(entry,[...common,'itemId','from','to','receiptId']);
      const owner=context.scheduleReceipts.find(r=>r.kind==='augment'&&r.definitionId==='anger-issues'&&r.eventId===entry.receiptId);
      requireValue(!fixedItemIds.has(entry.itemId)&&owner&&owner.round<=round.ordinal&&items.get(entry.itemId)?.definitionId===entry.from&&entry.from!=='rageblade'&&isAngerIssuesConvertibleItem(entry.from)&&entry.to==='rageblade','anger issues conversion');
      items.set(entry.itemId,{id:entry.itemId,definitionId:entry.to});
    } else if(entry.kind==='g23-item-converted'){
      keys(entry,[...common,'itemId','from','to','receiptId']);requireValue(isS3bConversion(entry)?!!context.s3bState&&items.get(entry.itemId)?.definitionId===entry.from&&validS3bConversion(context.s3bState,entry,entry.roundId):context.g23RadiantRound!==undefined&&getCatalogRoundById(entry.roundId).ordinal>=context.g23RadiantRound&&entry.receiptId==='g23:conqueror:15'&&items.get(entry.itemId)?.definitionId===entry.from&&g23RadiantDefinitionId(entry.from)===entry.to,'radiant conversion');items.set(entry.itemId,{id:entry.itemId,definitionId:entry.to});
    } else if (entry.kind === 'item-equipped') {
      keys(entry, [...common, 'itemId', 'unitId', 'slot', ...(Object.hasOwn(entry, 'tick') ? ['tick'] : [])]); integer(entry.slot);
      if (Object.hasOwn(entry, 'tick')) { integer(entry.tick); requireValue(entry.tick! < MAX_COMBAT_TICKS, 'equipment tick'); }
      requireValue(items.has(entry.itemId) && !absent.has(entry.unitId) && units.has(entry.unitId) && entry.slot < 3, 'equipment ownership/slot');
    } else if (entry.kind === 'item-combined') {
      keys(entry, [...common, 'event', ...(Object.hasOwn(entry, 'tick') ? ['tick'] : [])]); keys(entry.event, ['type', 'consumedIds', 'itemId', 'definitionId']);
      if (Object.hasOwn(entry, 'tick')) { integer(entry.tick); requireValue(entry.tick! < MAX_COMBAT_TICKS, 'equipment tick'); }
      // T12 permits combinations before/after settlement and during supply choices.
      // Input ownership, recipe, consumption and serial checks remain mandatory below.
      const event = entry.event; nonempty(event.definitionId);
      requireValue(event.type === 'itemCombined' && Array.isArray(event.consumedIds) && event.consumedIds.length === 2
        && compareCodePoints(event.consumedIds[0], event.consumedIds[1]) < 0, 'combination inputs');
      const [a, b] = event.consumedIds.map(id => items.get(id));
      const recipe = ITEM_DEFINITIONS[event.definitionId];
      requireValue(a && b && ITEM_DEFINITIONS[a.definitionId]?.kind === 'component' && ITEM_DEFINITIONS[b.definitionId]?.kind === 'component'
        && recipe?.kind === 'completed' && recipe.recipe && (recipe.recipe[0] === a.definitionId && recipe.recipe[1] === b.definitionId
          || recipe.recipe[0] === b.definitionId && recipe.recipe[1] === a.definitionId), 'combination recipe/ownership');
      requireValue(event.itemId === `item-${nextItemSerial}`, 'combined item serial'); integer(nextItemSerial + 1, 1);
      event.consumedIds.forEach(id => items.delete(id));
      if(!context.s3bState||!academicCraft(context.s3bState,entry))items.set(event.itemId, { id: event.itemId, definitionId: event.definitionId });
      nextItemSerial++;
    } else if(entry.kind==='consumable-used') {
      keys(entry,[...common,'record',...(Object.hasOwn(entry,'tick') ? ['tick'] : [])]);
      if (Object.hasOwn(entry,'tick')) { integer(entry.tick); requireValue(entry.tick! < MAX_COMBAT_TICKS, 'consumable tick'); }
      const r=entry.record;
      keys(r,['consumableId','definitionId','target','effect','affectedItems','output','outputs','copiedUnit','rngBefore','rngAfter']);
      requireValue(Array.isArray(r.affectedItems)&&(r.effect==='duplicate-unit'||r.affectedItems.length>0),'consumable affected items');
      for(const rawItem of r.affectedItems) {
        keys(rawItem, ['id','definitionId','location']);
        const item = rawItem as unknown as import('../strategy-types').ItemInstance;
        keys(item.location, item.location.kind === 'inventory' ? ['kind'] : ['kind','unitId','slot']);
        requireValue(items.get(item.id)?.definitionId===item.definitionId,'consumable ownership');
        if (item.location.kind !== 'inventory') {
          requireValue(item.location.kind === 'unit' && units.has(item.location.unitId), 'consumable holder');
          integer(item.location.slot); requireValue(item.location.slot < 3, 'consumable slot');
        }
      }
      keys(r.target, r.target.kind === 'unit' ? r.effect === 'masterwork-upgrade' ? ['kind','unitId','itemId'] : ['kind','unitId'] : ['kind','itemId']);
      keys(r.rngBefore, ['state','draws']); keys(r.rngAfter, ['state','draws']);
      if (r.output) keys(r.output, ['id','definitionId']);
      requireValue(r.target.kind==='unit'&&!absent.has(r.target.unitId)&&units.has(r.target.unitId),'consumable target');
      if(r.effect==='duplicate-unit'){
        requireValue(r.copiedUnit&&r.target.kind==='unit'&&r.copiedUnit.id===r.target.unitId&&units.get(r.target.unitId)?.definitionId===r.copiedUnit.definitionId&&r.affectedItems.length===0&&r.outputs.length===0,'duplicator target ownership');
        const receipt=context.mechanicReceipts?.find(x=>x.receiptId===JSON.stringify(['consumable-copy',r.consumableId]));
        requireValue(receipt?.kind==='unit'&&receipt.definitionId===r.copiedUnit?.definitionId,'duplicator receipt');
      }else{
        requireValue(Array.isArray(r.outputs)&&r.outputs.length===r.affectedItems.length,'consumable output count');
        for(const [n,output] of r.outputs.entries()){
          keys(output,['id','definitionId']);nonempty(output.id);nonempty(output.definitionId);const original=r.affectedItems[n];
          requireValue(!!ITEM_DEFINITIONS[output.definitionId],'consumable output definition');
          if(output.id!==original.id){requireValue(output.id===`item-${nextItemSerial}`,'reforge serial');nextItemSerial++;}
          items.delete(original.id);items.set(output.id,{id:output.id,definitionId:output.definitionId});
        }
      }
    } else if (entry.kind === 'combat-growth-committed') {
      keys(entry, [...common, 'combatId', 'settlementId', 'combatStartProvenancePrefixLength', 'sourceDeltas']);
      requireValue(round.kind !== 'supply' && entry.combatId === `round-${round.ordinal}`
        && entry.settlementId === `round-${round.ordinal}-settled` && !commits.has(entry.roundId), 'combat settlement identity/uniqueness');
      integer(entry.combatStartProvenancePrefixLength, 1);
      const start = entry.combatStartProvenancePrefixLength;
      requireValue(start <= index && Array.isArray(entry.sourceDeltas), 'combat start prefix');
      requireValue(start <= (firstLootBirth.get(entry.roundId) ?? index), 'loot before combat start');
      const suffix = entries.slice(start, index);
      requireValue(suffix.every(fact => fact.roundId === entry.roundId && (fact.kind==='anger-item-converted'||fact.kind==='g23-item-converted'||fact.kind === 'item-equipped' || fact.kind === 'item-combined' || fact.kind === 'consumable-used' || fact.kind === 'unit-upgraded'
        || (fact.kind === 'unit-acquired' || fact.kind === 'item-acquired') && fact.source.kind === 'loot')), 'combat resource suffix');
      requireValue(start === entries.length || entries[start]?.kind !== 'unit-upgraded', 'combat start transaction boundary');
      const originalUnits = unitPrefixes.get(start)!;
      let previousId = '';
      for (const delta of entry.sourceDeltas) {
        keys(delta, ['sourceUnitId', 'attackDamageBps']); nonempty(delta.sourceUnitId); integer(delta.attackDamageBps, 1);
        requireValue(compareCodePoints(previousId, delta.sourceUnitId) < 0 && delta.attackDamageBps % 125 === 0
          && originalUnits.get(delta.sourceUnitId)?.definitionId === 'tristana', 'combat growth source/step');
        previousId = delta.sourceUnitId;
      }
      const pending = mergeGrowthLedger(entry.sourceDeltas.map(delta => ({ unitId: delta.sourceUnitId, attackDamageBps: delta.attackDamageBps })),
        suffix.filter((fact): fact is Extract<ResourceProvenanceEntry, { kind: 'unit-upgraded' }> => fact.kind === 'unit-upgraded').map(fact => fact.event));
      const next = new Map(growth.map(value => [value.unitId, value.attackDamageBps]));
      for (const delta of pending) {
        requireValue(units.get(delta.unitId)?.definitionId === 'tristana', 'migrated growth owner');
        const total = (next.get(delta.unitId) ?? 0) + delta.attackDamageBps; integer(total, 1); next.set(delta.unitId, total);
      }
      growth = [...next].map(([unitId, attackDamageBps]) => ({ unitId, attackDamageBps })).sort(compareGrowth);
      commits.set(entry.roundId, { roundId: entry.roundId, combatId: entry.combatId, settlementId: entry.settlementId });
    } else requireValue(false, 'fact kind');
    requireValue(index !== 0 || entry.kind === 'unit-acquired' && (entry.source.kind === 'opening'||entry.source.kind==='carousel'&&context.carouselOpening===true), 'missing opening');
    if (index + 1 === prefixLength) result = projection();
  }
  finishAcquisition();
  if(context.scheduleReceipts.some(r=>r.kind==='augment'&&r.definitionId==='anger-issues'))requireValue([...items.values()].every(i=>fixedItemIds.has(i.id)||i.definitionId==='rageblade'||!isAngerIssuesConvertibleItem(i.definitionId)),'missing anger issues conversion');
  requireValue(usedBirths.size === births.size, 'missing receipt birth');
  {
    requireValue(Array.isArray(context.combatSettlements) && context.combatSettlements.length === commits.size, 'missing combat growth commit');
    const seen = new Set<string>();
    for (const expected of context.combatSettlements) {
      const commit = commits.get(expected.roundId);
      requireValue(!seen.has(expected.roundId) && commit && commit.combatId === expected.combatId
        && commit.settlementId === expected.settlementId, 'combat growth receipt binding');
      seen.add(expected.roundId);
    }
  }
  return freezeContent(result);
}
