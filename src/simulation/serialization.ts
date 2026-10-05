import type { MatchState } from './match-types';
import { CONTENT_DIGEST, canonicalContent } from './content';
import { UNIT_DEFINITIONS } from './units';
import { ITEM_DEFINITIONS } from './content/items';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { getRoundSchedule } from './round-schedule';
import { validateSeed } from './rng';
import { cloneEffect, effectKey } from './effects';
import { buildStrategySnapshot } from './strategy-snapshot';
import { eliminationResult } from './combat-types';
import { createRoundEnemies } from './round-enemies';
import { XP_TO_NEXT_LEVEL } from './match-rules';
import { grantXp } from './progression';
import { DEFAULT_BOARD, contains, isDeploymentCell } from './board';

function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Invalid Match save: ${message}`); }
function integer(value: unknown, min = 0): asserts value is number { requireValue(Number.isSafeInteger(value) && (value as number) >= min, 'integer'); }
function id(value: unknown): asserts value is string { requireValue(typeof value === 'string' && value.length > 0, 'ID'); }
function definitionId(value: unknown, catalog: object, label: string): asserts value is string {
  id(value); requireValue(Object.hasOwn(catalog, value), label);
}
function list(value: unknown): asserts value is unknown[] { requireValue(Array.isArray(value), 'array'); }
function record(value: unknown): asserts value is Record<string, unknown> { requireValue(value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, 'object'); }
function nullableString(value: unknown): void { if (value !== null) id(value); }
function checkSerial(instanceId: string, prefix: string, next: number): void {
  id(instanceId);
  requireValue(new RegExp(`^${prefix}-[1-9][0-9]*$`).test(instanceId), `${prefix} ID`);
  requireValue(Number(instanceId.slice(prefix.length + 1)) < next, `${prefix} serial`);
}
/** Validates plain JSON and all persistent references before returning an independent state.
 * It never draws RNG, grants rewards, rebuilds offers, or executes combatStart.
 */
export function restoreMatch(input: unknown): MatchState {
  const raw: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  canonicalContent(raw); // Reject functions, undefined, nonfinite values and non-plain containers.
  record(raw);
  requireValue(raw.schemaVersion === 4 && raw.rulesVersion === 'm4-v1' && raw.contentVersion === 'm4-slice-v1', 'unsupported-version');
  requireValue(raw.contentDigest === CONTENT_DIGEST, 'content-digest');
  for (const name of ['seed', 'rngState', 'choiceRngState', 'rewardRngState']) validateSeed(raw[name] as number);
  for (const name of ['gold', 'xp', 'playerHp', 'nextMatchEventSeq']) integer(raw[name]);
  for (const name of ['round', 'level', 'nextItemSerial', 'nextUnitSerial']) integer(raw[name], 1);
  requireValue((raw.level as number) >= 3 && (raw.level as number) <= 9 && (raw.playerHp as number) <= 100, 'level/HP bounds');
  requireValue(['preparation','choice','combat','settlement','gameOver'].includes(raw.phase as string), 'phase');
  record(raw.preparation); record(raw.preparation.board); record(raw.preparation.board.deploymentZones);
  const board = raw.preparation.board; record(board.deploymentZones);
  integer(board.columns, 1); integer(board.rows, 1);
  for (const team of ['player','enemy']) { record(board.deploymentZones[team]); integer(board.deploymentZones[team].firstRow); integer(board.deploymentZones[team].lastRow); }
  integer(raw.preparation.benchSize, 1); list(raw.preparation.units);
  const state = raw as unknown as MatchState;
  requireValue(state.level === 9 ? state.xp === 0 : state.xp < XP_TO_NEXT_LEVEL[state.level], 'current XP');
  requireValue(canonicalContent(state.preparation.board) === canonicalContent(DEFAULT_BOARD) && state.preparation.benchSize === 7, 'board rules');
  const units = new Map<string, MatchState['preparation']['units'][number]>(); const locations = new Set<string>();
  for (const unit of state.preparation.units) {
    record(unit); id(unit.id); requireValue(!units.has(unit.id), 'duplicate unit'); units.set(unit.id, unit);
    definitionId(unit.definitionId, UNIT_DEFINITIONS, 'unit definition');
    requireValue(unit.team === 'player' || unit.team === 'enemy', 'team');
    requireValue([1,2,3].includes(unit.starLevel), 'star'); record(unit.location);
    if (unit.team === 'player') checkSerial(unit.id, 'unit', state.nextUnitSerial);
    if (unit.location.kind === 'bench') { integer(unit.location.slot); requireValue(unit.team === 'player' && unit.location.slot < state.preparation.benchSize, 'bench location'); }
    else { requireValue(unit.location.kind === 'board', 'location kind'); record(unit.location.cell); integer(unit.location.cell.col); integer(unit.location.cell.row);
      requireValue(contains(state.preparation.board, unit.location.cell) && isDeploymentCell(state.preparation.board, unit.team, unit.location.cell), 'board location'); }
    const key = unit.location.kind === 'bench' ? `bench:${unit.location.slot}` : `board:${unit.location.cell.col}:${unit.location.cell.row}`;
    requireValue(!locations.has(key), 'occupied location'); locations.add(key);
  }
  requireValue(canonicalContent(state.preparation.units.filter(unit=>unit.team==='enemy').sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0))
    === canonicalContent([...createRoundEnemies(state.round)].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)), 'enemy roster identity');
  requireValue([...units.values()].filter(unit => unit.team === 'player' && unit.location.kind === 'board').length <= state.level, 'population cap');
  record(raw.shop); integer(raw.shop.generation, 1); list(raw.shop.slots); requireValue(raw.shop.slots.length === 5, 'shop size');
  for (const slot of state.shop.slots) {
    record(slot); requireValue(slot.status === 'purchased' || slot.status === 'available', 'shop slot');
    if (slot.status === 'available') definitionId(slot.definitionId, UNIT_DEFINITIONS, 'shop definition');
  }
  list(raw.items); const itemIds = new Set<string>(), equipment = new Set<string>();
  for (const item of state.items) {
    record(item); id(item.id); checkSerial(item.id, 'item', state.nextItemSerial);
    requireValue(!itemIds.has(item.id), 'duplicate item'); itemIds.add(item.id);
    definitionId(item.definitionId, ITEM_DEFINITIONS, 'item definition'); record(item.location);
    if (item.location.kind === 'unit') {
      requireValue(units.get(item.location.unitId)?.team === 'player', 'item owner'); integer(item.location.slot);
      requireValue(item.location.slot <= 2, 'equipment slot'); const key = `${item.location.unitId}:${item.location.slot}`;
      requireValue(!equipment.has(key), 'occupied equipment slot'); equipment.add(key);
    } else requireValue(item.location.kind === 'inventory', 'item location');
  }
  list(raw.augments); requireValue(state.augments.length <= 2, 'augment count'); const augmentIds = new Set<string>();
  for (const augment of state.augments) {
    record(augment); definitionId(augment.definitionId, AUGMENT_DEFINITIONS, 'augment definition');
    requireValue(!augmentIds.has(augment.definitionId), 'duplicate augment');
    augmentIds.add(augment.definitionId); id(augment.choiceId); integer(augment.acquiredRound, 1); requireValue(augment.acquiredRound <= state.round, 'augment round');
  }
  if (state.anomalyBinding !== null) {
    record(state.anomalyBinding); const binding = state.anomalyBinding;
    definitionId(binding.definitionId, ANOMALY_DEFINITIONS, 'anomaly definition'); id(binding.unitId);
    requireValue(units.get(binding.unitId)?.team === 'player', 'anomaly binding');
    id(binding.choiceId); integer(binding.boundRound, 1); requireValue(binding.boundRound <= state.round, 'binding round');
  }
  list(raw.roundResults); requireValue(state.roundResults.length === state.round - (state.phase === 'settlement' || state.phase === 'gameOver' ? 0 : 1), 'history length');
  list(raw.scheduleReceipts); const receipts = new Map<string, MatchState['scheduleReceipts'][number]>();
  for (const receipt of state.scheduleReceipts) {
    record(receipt); id(receipt.eventId); integer(receipt.round, 1); requireValue(receipt.round <= state.round, 'receipt future');
    requireValue(!receipts.has(receipt.eventId), 'duplicate receipt'); receipts.set(receipt.eventId, receipt);
    const event = getRoundSchedule(receipt.round).find(event => event.id === receipt.eventId);
    requireValue(event && receipt.kind === event.kind, 'receipt event');
    if (event.kind === 'reward') {
      requireValue(receipt.gold === event.gold && receipt.itemIds.length === event.components.length + event.randomComponents && receipt.definitionId === null, 'reward receipt values');
      requireValue(new Set(receipt.itemIds).size === receipt.itemIds.length, 'reward duplicate items');
      requireValue(event.recruitIfEmpty || receipt.unitId === null, 'unexpected fallback recruit');
      if (receipt.unitId !== null) checkSerial(receipt.unitId, 'unit', state.nextUnitSerial);
    } else requireValue(receipt.gold === 0 && receipt.itemIds.length === 0, 'choice receipt values'); integer(receipt.gold); list(receipt.itemIds);
    for (const itemId of receipt.itemIds) checkSerial(itemId, 'item', state.nextItemSerial);
    nullableString(receipt.unitId); nullableString(receipt.definitionId);
    if (receipt.kind === 'augment') requireValue(state.augments.some(a => a.choiceId === receipt.eventId && a.definitionId === receipt.definitionId), 'augment receipt');
    if (receipt.kind === 'anomaly') definitionId(receipt.definitionId, ANOMALY_DEFINITIONS, 'anomaly receipt');
  }
  for (const augment of state.augments) requireValue(receipts.get(augment.choiceId)?.definitionId === augment.definitionId && receipts.get(augment.choiceId)?.round === augment.acquiredRound, 'augment missing receipt');
  if (state.anomalyBinding) requireValue(receipts.get(state.anomalyBinding.choiceId)?.definitionId === state.anomalyBinding.definitionId && receipts.get(state.anomalyBinding.choiceId)?.round === state.anomalyBinding.boundRound, 'binding missing receipt');
  if (state.phase === 'choice') {
    record(state.pendingChoice); const choice = state.pendingChoice;
    id(choice.choiceId); id(choice.eventId); nullableString(choice.targetId); requireValue(choice.choiceId === choice.eventId, 'choice event ID');
    integer(choice.generation); integer(choice.rerollCount); list(choice.offers);
    requireValue(!receipts.has(choice.eventId), 'choice already completed');
    const event = getRoundSchedule(state.round).find(event => event.id === choice.eventId);
    requireValue(event?.kind === choice.kind && choice.kind !== undefined, 'choice scheduled');
    if (choice.step === 'target') requireValue(choice.kind === 'anomaly' && choice.targetId === null && choice.offers.length === 0 && choice.generation === 0 && choice.rerollCount === 0, 'target substate');
    else {
      requireValue(choice.step === 'offer' && choice.offers.length === 3 && new Set(choice.offers).size === 3, 'offer substate');
      const catalog = choice.kind === 'augment' ? AUGMENT_DEFINITIONS : ANOMALY_DEFINITIONS;
      for (const offer of choice.offers) definitionId(offer, catalog, 'offer definition');
      if (choice.kind === 'augment') requireValue(choice.targetId === null && choice.rerollCount === 0 && choice.generation === 0 && choice.offers.every(def => !augmentIds.has(def)), 'augment offers');
      else requireValue(units.get(choice.targetId!)?.team === 'player' && choice.generation === choice.rerollCount + 1, 'locked target');
    }
  } else requireValue(state.pendingChoice === null, 'pending outside choice');
  const receiptOrder = state.scheduleReceipts.map(receipt => receipt.eventId);
  const expectedReceiptOrder: string[] = [];
  for (let round=1;round<=state.round;round++) for (const event of getRoundSchedule(round)) if (receipts.has(event.id)) expectedReceiptOrder.push(event.id);
  requireValue(canonicalContent(receiptOrder) === canonicalContent(expectedReceiptOrder), 'receipt order');
  let stopped = false;
  for (let round = 1; round <= state.round; round++) for (const event of getRoundSchedule(round)) {
    if (state.pendingChoice?.eventId === event.id) stopped = true;
    if (!stopped) requireValue(receipts.has(event.id), 'missing schedule receipt');
    else requireValue(!receipts.has(event.id), 'receipt beyond pending choice');
  }
  list(raw.roundResults);
  const settled = state.phase === 'settlement' || state.phase === 'gameOver';
  requireValue(state.roundResults.length === state.round - (settled ? 0 : 1), 'history length');
  for (const [i, result] of state.roundResults.entries()) {
    record(result); requireValue(result.round === i + 1, 'history round');
    const fields = ['round','combatTicks','income','goldBefore','goldAfter','xpAwarded','levelBefore','levelAfter','xpBefore','xpAfter','hpBefore','hpAfter','baseDamage','survivingEnemyCount','playerDamage','hpLost'];
    for (const field of fields) integer(result[field as keyof typeof result]);
    requireValue(result.hpBefore === (i === 0 ? 100 : state.roundResults[i-1].hpAfter), 'history HP chain');
    requireValue(result.levelBefore >= 3 && result.levelBefore <= 9 && result.levelAfter <= 9, 'history level');
    const progress = grantXp(result.levelBefore, result.xpBefore, 2);
    requireValue(result.levelAfter === progress.level && result.xpAfter === progress.xp && result.xpAwarded === progress.xpApplied, 'history XP');
    const base = 2 + 2 * Math.floor(i / 3);
    const damage = result.result === 'playerWin' ? 0 : base + (result.result === 'enemyWin' ? 2 * result.survivingEnemyCount : 0);
    requireValue(result.baseDamage === base && result.playerDamage === damage && result.hpAfter === Math.max(0, result.hpBefore-damage), 'history damage');
    requireValue(result.income === 5 && result.goldAfter === result.goldBefore+5 && result.combatTicks <= 1200, 'history income/ticks');
    for (const [key, value] of Object.entries(result)) if (key !== 'result') integer(value);
    requireValue(['playerWin','enemyWin','draw'].includes(result.result), 'round result');
    requireValue(result.hpAfter <= result.hpBefore && result.hpLost === result.hpBefore - result.hpAfter, 'history HP');
  }
  requireValue(state.playerHp === (state.roundResults.at(-1)?.hpAfter ?? 100), 'current HP');
  if (settled) { const last = state.roundResults.at(-1)!; requireValue(state.gold === last.goldAfter && state.level === last.levelAfter && state.xp === last.xpAfter, 'current settlement totals'); }
  requireValue((state.phase === 'gameOver') === (state.playerHp === 0), 'terminal HP');
  if (state.phase === 'preparation' || state.phase === 'choice') requireValue(state.combat === null, 'inactive combat');
  else {
    record(state.combat); const combat = state.combat;
    integer(combat.tick); integer(combat.maxTicks, 1); requireValue(combat.tick <= combat.maxTicks && combat.maxTicks === 1200, 'combat ticks');
    requireValue(combat.combatId === `round-${state.round}` && combat.startEffectsApplied === true, 'combat identity/start'); integer(combat.nextEventSeq);
    requireValue(combat.status === 'running' || combat.status === 'finished', 'combat status');
    requireValue((state.phase === 'combat') === (combat.status === 'running'), 'combat phase');
    requireValue(combat.status !== 'running' || combat.tick < combat.maxTicks, 'running timeout');
    requireValue(combat.status === 'running' ? combat.result === null : ['playerWin','enemyWin','draw'].includes(combat.result!), 'combat result');
    record(combat.strategy); list(combat.strategy.units); list(combat.strategy.traits); list(combat.units);
    const expectedStrategy = buildStrategySnapshot(state);
    requireValue(canonicalContent(combat.strategy) === canonicalContent(expectedStrategy), 'resolved strategy');
    requireValue(canonicalContent(combat.board) === canonicalContent(state.preparation.board), 'combat board');
    const expectedIds = state.preparation.units.filter(unit => unit.location.kind === 'board').map(unit => unit.id).sort();
    requireValue(canonicalContent(combat.units.map(unit => unit.id).sort()) === canonicalContent(expectedIds), 'combat roster');
    if (settled) { const last = state.roundResults.at(-1)!; requireValue(last.result === combat.result && last.combatTicks === combat.tick && last.survivingEnemyCount === combat.units.filter(unit=>unit.alive&&unit.team==='enemy').length, 'combat settlement result'); }
    const combatIds = new Set(combat.units.map(unit => unit.id)); requireValue(combatIds.size === combat.units.length, 'duplicate combat ID');
    const cells = new Set<string>();
    for (const unit of combat.units) {
      record(unit); requireValue(units.get(unit.id)?.location.kind === 'board', 'combat unit origin');
      const origin = units.get(unit.id)!; const resolved = expectedStrategy.units.find(value => value.unitId === unit.id)!;
      requireValue(unit.team === origin.team && unit.definitionId === origin.definitionId && unit.starLevel === origin.starLevel, 'combat unit identity');
      const { stats } = resolved;
      for (const [field, value] of Object.entries({ maxHp: stats.health, attackDamage: stats.attack, armor: stats.armor, magicResist: stats.magicResist, maxMana: stats.maxMana, attackIntervalTicks: stats.attackIntervalTicks, attackRange: stats.attackRange })) requireValue(unit[field as keyof typeof unit] === value, 'resolved combat stat');
      requireValue(canonicalContent(unit.ability) === canonicalContent(resolved.ability), 'resolved ability');
      requireValue(canonicalContent(unit.sources) === canonicalContent(resolved.sources) && canonicalContent(unit.triggers) === canonicalContent(resolved.triggers), 'resolved effect source/trigger');
      for (const field of ['hp','maxHp','attackDamage','armor','magicResist','mana','maxMana','shield','cooldownTicks','moveCooldownTicks','attackIntervalTicks','attackRange']) integer(unit[field as keyof typeof unit]);
      requireValue(unit.maxHp >= 1 && unit.maxMana >= 1 && unit.attackIntervalTicks >= 1 && unit.hp <= unit.maxHp && unit.mana <= unit.maxMana, 'combat stats');
      requireValue(unit.alive === (unit.hp > 0), 'alive flag'); nullableString(unit.targetId); if (unit.targetId) requireValue(combatIds.has(unit.targetId) && combat.units.find(other=>other.id===unit.targetId)?.team !== unit.team, 'target reference');
      requireValue(unit.cooldownTicks <= unit.attackIntervalTicks && unit.moveCooldownTicks <= 5, 'cooldown bounds');
      requireValue(contains(state.preparation.board, unit.cell), 'combat cell');
      if (unit.alive) { const key = `${unit.cell.col}:${unit.cell.row}`; requireValue(!cells.has(key), 'combat occupancy'); cells.add(key); }
      requireValue(unit.shield === 0 ? unit.shieldExpiresAtTick === null : Number.isSafeInteger(unit.shieldExpiresAtTick) && unit.shieldExpiresAtTick! > combat.tick, 'shield expiry');
      if (!unit.alive) requireValue(unit.targetId === null && unit.mana === 0 && unit.shield === 0 && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0, 'dead fields');
      record(unit.ability); integer(unit.ability.amount); requireValue(['damage','selfShield'].includes(unit.ability.kind), 'ability kind');
      list(unit.sources); list(unit.triggers); list(unit.effectRuntime);
      const sourceKeys = new Set<string>();
      for (const source of unit.sources) { requireValue(source.key === effectKey(source.source) && source.source.ownerId === unit.id && !sourceKeys.has(source.key), 'source key'); sourceKeys.add(source.key); cloneEffect(source.effect); }
      const triggerKeys = new Set<string>();
      for (const trigger of unit.triggers) { requireValue(sourceKeys.has(trigger.key) && !triggerKeys.has(trigger.key), 'trigger key'); triggerKeys.add(trigger.key); cloneEffect({ kind: 'trigger', ...trigger }); }
      requireValue(unit.effectRuntime.length === triggerKeys.size, 'runtime size');
      const runtimeKeys = new Set<string>();
      for (const counter of unit.effectRuntime) { requireValue(triggerKeys.has(counter.key) && !runtimeKeys.has(counter.key), 'runtime key'); runtimeKeys.add(counter.key); integer(counter.count); const trigger = unit.triggers.find(t => t.key === counter.key)!; requireValue(counter.count <= (trigger.hook === 'combatStart' ? 1 : combat.tick), 'runtime count'); }
    }
    const eliminated = eliminationResult(combat.units);
    requireValue(combat.status === 'running' ? eliminated === null
      : eliminated === null ? combat.tick === combat.maxTicks && combat.result === 'draw' : combat.result === eliminated, 'combat terminal consistency');
  }
  return structuredClone(state);
}
export function serializeMatch(state: MatchState): string { return canonicalContent(restoreMatch(state)); }
