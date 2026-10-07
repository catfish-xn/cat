import type { MatchState } from './match-types';
import { CONTENT_DIGEST, canonicalContent } from './content';
import { UNIT_DEFINITIONS } from './units';
import { ITEM_DEFINITIONS } from './content/items';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { getRoundKind, getStageRound, getRoundSchedule } from './round-schedule';
import { validateSeed } from './rng';
import { cloneEffect, effectKey } from './effects';
import { buildStrategySnapshot } from './strategy-snapshot';
import { eliminationResult } from './combat-types';
import { createRoundEnemies } from './round-enemies';
import { XP_TO_NEXT_LEVEL } from './match-rules';
import { planRoundEconomy } from './economy';
import { sourceKey, variable, mechanic, champion } from './combat-s13-state';
import { M5_UNIT_DEFINITIONS } from './units';
import { DEFAULT_BOARD, contains, isDeploymentCell } from './board';
import { validateMechanisms } from './m8/restore';
import { validateSpellCrit } from './m8/crit';

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
  requireValue(raw.schemaVersion === 5 && raw.rulesVersion === 'm5-14.24b-v1' && raw.contentVersion === 's13-14.24b-slice-v1' && raw.commandProtocolVersion === 2 && raw.rngAlgorithm === 'lcg32-v1' && raw.tickMs === 50, 'unsupported-version');
  requireValue(raw.contentDigest === CONTENT_DIGEST, 'content-digest');
  for (const name of ['seed', 'rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState']) validateSeed(raw[name] as number);
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
  requireValue(canonicalContent(state.preparation.board) === canonicalContent(DEFAULT_BOARD) && state.preparation.benchSize === 9, 'board rules');
  const units = new Map<string, MatchState['preparation']['units'][number]>(); const locations = new Set<string>();
  for (const unit of state.preparation.units) {
    record(unit); id(unit.id); requireValue(!units.has(unit.id), 'duplicate unit'); units.set(unit.id, unit);
    definitionId(unit.definitionId, unit.team === 'player' ? M5_UNIT_DEFINITIONS : UNIT_DEFINITIONS, 'unit definition');
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
  record(raw.shop); requireValue(typeof raw.shop.locked === 'boolean', 'shop lock'); integer(raw.shop.generation, 1); list(raw.shop.slots); requireValue(raw.shop.slots.length === 5, 'shop size');
  for (const slot of state.shop.slots) {
    record(slot); requireValue(slot.status === 'purchased' || slot.status === 'available', 'shop slot');
    if (slot.status === 'available') definitionId(slot.definitionId, M5_UNIT_DEFINITIONS, 'shop definition');
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
  list(raw.augments); requireValue(state.augments.length <= 3, 'augment count'); const augmentIds = new Set<string>();
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
  list(raw.roundResults); requireValue(state.roundResults.length === state.round - (state.phase === 'settlement' || state.phase === 'gameOver' || state.pendingChoice?.returnPhase === 'settlement' && getRoundKind(state.round) !== 'supply' ? 0 : 1), 'history length');
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
    } else if (event.kind === 'component') {
      definitionId(receipt.definitionId, ITEM_DEFINITIONS, 'component receipt');
      requireValue(ITEM_DEFINITIONS[receipt.definitionId!].kind === 'component' && receipt.itemIds.length === 1 && receipt.gold === 0 && receipt.unitId === null, 'component receipt values');
    } else requireValue(receipt.gold === (receipt.definitionId === 'placebo' ? 8 : 0) && receipt.itemIds.length === 0, 'choice receipt values'); integer(receipt.gold); list(receipt.itemIds);
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
    if (choice.step === 'target') requireValue(choice.kind === 'anomaly' && choice.targetId === null && choice.offers.length === 0 && choice.generation === 0 && choice.rerollCount === 0 && state.preparation.units.some(unit => unit.team === 'player'), 'target substate');
    else {
      requireValue(choice.step === 'offer' && choice.offers.length === (choice.kind === 'component' ? 7 : choice.kind === 'anomaly' ? 1 : 3) && new Set(choice.offers).size === choice.offers.length, 'offer substate');
      const catalog = choice.kind === 'augment' ? AUGMENT_DEFINITIONS : choice.kind === 'component' ? ITEM_DEFINITIONS : ANOMALY_DEFINITIONS;
      for (const offer of choice.offers) definitionId(offer, catalog, 'offer definition');
      if (choice.kind === 'component') requireValue(choice.targetId === null && choice.rerollCount === 0 && choice.generation === 0 && choice.offers.every(def => ITEM_DEFINITIONS[def].kind === 'component'), 'component offers');
      else if (choice.kind === 'augment') requireValue(choice.targetId === null && choice.rerollCount === 0 && choice.generation === 0 && choice.offers.every(def => !augmentIds.has(def)), 'augment offers');
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
    if (round === state.round && event.kind === 'anomaly' && !receipts.has(event.id) && state.phase === 'preparation' && !state.preparation.units.some(unit => unit.team === 'player')) {
      requireValue(state.shop.slots.some(slot => slot.status === 'available' && UNIT_DEFINITIONS[slot.definitionId].cost <= state.gold), 'anomaly recruitment affordability');
      stopped = true;
    }
    if ((event.timing ?? 'before') === 'after' && state.roundResults.length < round || state.outcome !== null && round === state.round && event.timing === 'after') continue;
    if (!stopped) requireValue(receipts.has(event.id), 'missing schedule receipt');
    else requireValue(!receipts.has(event.id), 'receipt beyond pending choice');
  }
  list(raw.roundResults);
  const settled = state.roundResults.length === state.round;
  requireValue(state.roundResults.length === state.round - (settled ? 0 : 1), 'history length');
  let streak = { kind: null as 'win' | 'loss' | null, count: 0 };
  for (const [i, result] of state.roundResults.entries()) {
    record(result); requireValue(result.round === i + 1 && result.settlementId === `round-${i+1}-settled` && result.roundKind === getRoundKind(i+1), 'history round/identity');
    for (const field of ['round','combatTicks','income','goldBefore','goldAfter','xpRequested','xpAwarded','levelBefore','levelAfter','xpBefore','xpAfter','hpBefore','hpAfter','baseDamage','survivingEnemyCount','playerDamage','hpLost']) integer(result[field as keyof typeof result]);
    requireValue(result.hpBefore === (i === 0 ? 100 : state.roundResults[i-1].hpAfter), 'history HP chain');
    requireValue(canonicalContent(result.streakBefore) === canonicalContent(streak), 'history streak before');
    const expected = planRoundEconomy({ stage: getStageRound(i+1).stage, roundKind: result.roundKind,
      result: result.result === 'supply' ? null : result.result, gold: result.goldBefore, hp: result.hpBefore,
      level: result.levelBefore, xp: result.xpBefore, streak, enemySurvivors: result.survivingEnemyCount });
    requireValue(result.levelAfter === expected.progression.level && result.xpAfter === expected.progression.xp && result.xpAwarded === expected.progression.xpApplied && result.xpRequested === 2, 'history XP');
    requireValue(result.baseDamage === expected.baseDamage && result.playerDamage === expected.playerDamage && result.hpAfter === expected.hpAfter && result.hpLost === expected.hpLost, 'history damage');
    requireValue(result.income === expected.income && result.goldAfter === expected.goldAfter && result.interestBasis === expected.interestBasis && canonicalContent(result.incomeBreakdown) === canonicalContent(expected.incomeBreakdown), 'history income');
    requireValue(canonicalContent(result.streakAfter) === canonicalContent(expected.streakAfter), 'history streak'); streak = expected.streakAfter;
    requireValue(result.combatTicks <= 1200 && (result.roundKind !== 'supply' || result.combatTicks === 0), 'history ticks');
  }
  requireValue(canonicalContent(state.streak) === canonicalContent(streak), 'current streak');
  const stageRound = getStageRound(state.round);
  requireValue(state.round <= 35 && state.roundDefinitionId === `${stageRound.stage}-${stageRound.round}`, 'round definition');
  requireValue(state.phase === 'gameOver' ? state.outcome === (state.round === 35 && state.playerHp > 0 && state.roundResults.at(-1)?.result === 'playerWin' ? 'victory' : 'defeat') : state.outcome === null, 'outcome');
  record(state.augmentProgress); integer(state.augmentProgress.pumpingRounds); integer(state.augmentProgress.investmentHp);
  const pump = state.augments.find(a => a.definitionId === 'pumping-up-i'), investment = state.augments.find(a => a.definitionId === 'investment-strategy-i');
  requireValue(state.augmentProgress.pumpingRounds === (pump ? state.roundResults.filter(r => r.round >= pump.acquiredRound).length : 0), 'pumping progress');
  requireValue(state.augmentProgress.investmentHp === (investment ? state.roundResults.filter(r => r.round >= investment.acquiredRound).reduce((n,r) => n + r.incomeBreakdown.interest * 8,0) : 0), 'investment progress');
  list(state.persistentGrowth); const growthIds = new Set<string>();
  for (const growth of state.persistentGrowth) { record(growth); id(growth.unitId); integer(growth.attackDamageBps,1);
    requireValue(units.get(growth.unitId)?.definitionId === 'tristana' && !growthIds.has(growth.unitId) && growth.attackDamageBps % 125 === 0, 'persistent growth'); growthIds.add(growth.unitId); }
  requireValue(state.playerHp === (state.roundResults.at(-1)?.hpAfter ?? 100), 'current HP');
  if (settled) { const last = state.roundResults.at(-1)!; requireValue(state.gold === last.goldAfter && state.level === last.levelAfter && state.xp === last.xpAfter, 'current settlement totals'); }
  requireValue((state.phase === 'gameOver') === (state.playerHp === 0 || settled && state.round === 35), 'terminal boundary');
  if (state.phase === 'preparation' || state.phase === 'choice' && !settled || getRoundKind(state.round) === 'supply') requireValue(state.combat === null, 'inactive combat');
  else {
    record(state.combat); const combat = state.combat;
    validateSeed(combat.rngState!); integer(combat.rngDraws); integer(combat.nextActionSeq); integer(combat.tick); integer(combat.maxTicks, 1); requireValue(combat.tick <= combat.maxTicks && combat.maxTicks === 1200, 'combat ticks');
    requireValue(combat.combatId === `round-${state.round}` && combat.startEffectsApplied === true, 'combat identity/start'); integer(combat.nextEventSeq);
    requireValue(combat.status === 'running' || combat.status === 'finished', 'combat status');
    requireValue((state.phase === 'combat') === (combat.status === 'running'), 'combat phase');
    requireValue(combat.status !== 'running' || combat.tick < combat.maxTicks, 'running timeout');
    requireValue(combat.status === 'running' ? combat.result === null : ['playerWin','enemyWin','draw'].includes(combat.result!), 'combat result');
    record(combat.strategy); list(combat.strategy.units); list(combat.strategy.traits); list(combat.units);
    const last = settled ? state.roundResults.at(-1)! : null;
    const snapshotState = last ? { ...state, persistentGrowth: state.persistentGrowth.map(g => ({ ...g, attackDamageBps: g.attackDamageBps - (combat.units.find(u => u.id === g.unitId)?.runtime?.permanentAdBps ?? 0) })).filter(g => g.attackDamageBps > 0),
      augmentProgress: { pumpingRounds: state.augmentProgress.pumpingRounds - (pump ? 1 : 0), investmentHp: state.augmentProgress.investmentHp - (investment ? last.incomeBreakdown.interest * 8 : 0) } } : state;
    const expectedStrategy = buildStrategySnapshot(snapshotState);
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
      if (unit.ability.kind === 's13') { requireValue(unit.attackDamageBase === resolved.attackDamageBase && unit.attackDamagePercentBps === resolved.attackDamagePercentBps && unit.abilityPower === resolved.abilityPower && unit.baseAttackSpeedBps === (resolved.stats.baseAttackSpeedBps ?? Math.floor(200000 / resolved.stats.attackIntervalTicks)) && unit.attackSpeedBonusBps === (resolved.stats.attackSpeedBonusBps ?? 0), 'resolved dynamic bases'); requireValue(canonicalContent(unit.mechanics) === canonicalContent(resolved.mechanics), 'resolved mechanics'); }
      requireValue(unit.team === origin.team && unit.definitionId === origin.definitionId && unit.starLevel === origin.starLevel, 'combat unit identity');
      const { stats } = resolved;
      for (const [field, value] of Object.entries({ maxHp: stats.health, attackDamage: stats.attack, armor: stats.armor, magicResist: stats.magicResist, maxMana: stats.maxMana, attackIntervalTicks: stats.attackIntervalTicks, attackRange: stats.attackRange })) requireValue(unit[field as keyof typeof unit] === value, 'resolved combat stat');
      requireValue(canonicalContent(unit.ability) === canonicalContent(resolved.ability), 'resolved ability');
      requireValue(canonicalContent(unit.sources) === canonicalContent(resolved.sources) && canonicalContent(unit.triggers) === canonicalContent(resolved.triggers), 'resolved effect source/trigger');
      for (const field of ['hp','maxHp','attackDamage','armor','magicResist','mana','maxMana','shield','cooldownTicks','moveCooldownTicks','attackIntervalTicks','attackRange']) integer(unit[field as keyof typeof unit]);
      requireValue(unit.maxHp >= 1 && unit.maxMana >= 1 && unit.attackIntervalTicks >= 1 && unit.hp <= unit.maxHp && unit.mana <= unit.maxMana, 'combat stats');
      requireValue(unit.alive === (unit.hp > 0), 'alive flag'); nullableString(unit.targetId); if (unit.targetId) requireValue(combatIds.has(unit.targetId) && combat.units.find(other=>other.id===unit.targetId)?.team !== unit.team, 'target reference');
      requireValue(unit.cooldownTicks <= 1200 && unit.moveCooldownTicks <= 5, 'cooldown bounds');
      requireValue(contains(state.preparation.board, unit.cell), 'combat cell');
      if (unit.alive) { const key = `${unit.cell.col}:${unit.cell.row}`; requireValue(!cells.has(key), 'combat occupancy'); cells.add(key); }
      requireValue(unit.shield === 0 ? unit.shieldExpiresAtTick === null : Number.isSafeInteger(unit.shieldExpiresAtTick) && unit.shieldExpiresAtTick! > combat.tick, 'shield expiry');
      if (!unit.alive) requireValue(unit.targetId === null && unit.mana === 0 && unit.shield === 0 && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0, 'dead fields');
      if (unit.ability.kind === 's13') validateMechanisms(unit, combat.units, combat.tick, combat.combatId!, combat.status === 'finished', combat.nextActionSeq!);
      record(unit.ability); integer(unit.ability.amount); requireValue(['damage','selfShield','s13'].includes(unit.ability.kind), 'ability kind');
      validateM5Runtime(unit, combat.tick, combatIds, combat.units, combat.combatId!);
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

/** Runtime records are checked separately from frozen stats; restoring never executes them. */
function validateM5Runtime(unit: import('./combat-types').CombatUnit, tick: number, combatIds: Set<string>, combatUnits: readonly import('./combat-types').CombatUnit[], combatId: string): void {
  if (unit.ability.kind !== 's13') return;
  if (unit.spellCrit !== undefined) {
    record(unit.spellCrit); list(unit.spellCrit.itemSources); list(unit.spellCrit.nonItemSources);
    validateSpellCrit(unit.spellCrit);
    // The current nine-item compiler has no authorization provider. B4 must
    // bind these frozen sources to its enabled definitions before saving them.
    requireValue(unit.spellCrit.itemSources.length === 0 && unit.spellCrit.nonItemSources.length === 0
      && unit.spellCrit.chanceBps === (champion(unit) === 'neutral' ? 0 : 2500) && unit.spellCrit.multiplierBps === 14000, 'uncompiled spell critical sources');
  }
  integer(unit.attackDamageBase); integer(unit.attackDamagePercentBps); integer(unit.abilityPower); integer(unit.baseAttackSpeedBps, 1); integer(unit.attackSpeedBonusBps);
  record(unit.runtime);
  for (const field of ['attackCount','castCount','attackSpeedBps','abilityPowerFlat','rangeBonus','nextAttackMagic','nextAttackPhysical','permanentAdBps']) integer(unit.runtime[field as keyof typeof unit.runtime]);
  requireValue(typeof unit.runtime.buddyTriggered === 'boolean' && unit.runtime.attackCount <= tick && unit.runtime.castCount <= tick && unit.runtime.permanentAdBps % 125 === 0, 'combat runtime');
  if (unit.definitionId !== 'tristana') requireValue(unit.runtime.permanentAdBps === 0, 'growth owner');
  const runtime = unit.runtime, isKog = champion(unit) === 'kogmaw';
  requireValue(runtime.attackCount + runtime.castCount <= tick, 'action count bound');
  const expectedSpeed = runtime.attackCount * mechanic(unit, 'rageblade', 'attackSpeedBps')
    + (isKog ? runtime.castCount * Math.round(variable(unit, 'AttackSpeed', .25) * 10000) : 0);
  requireValue(runtime.attackSpeedBps === expectedSpeed, 'derived attack speed');
  requireValue(runtime.rangeBonus === (isKog ? Math.floor(runtime.castCount / variable(unit, 'RangeIncreaseNumAttacks', 3)) : 0), 'derived range');
  const archangels = (unit.mechanics ?? []).filter(m => m.mechanic === 'archangel');
  const maximumAp = archangels.reduce((sum, m) => sum + Math.floor(tick / m.values.periodTicks) * m.values.abilityPower, 0);
  // A dead unit stops periodic grants at its death tick. Death time is not retained
  // in this schema, so check the finite set of possible grants rather than invent it.
  const possibleAp = new Set([0]);
  for (const source of archangels) for (let at = source.values.periodTicks; at <= tick; at += source.values.periodTicks)
    possibleAp.add(archangels.reduce((sum, m) => sum + Math.floor(at / m.values.periodTicks) * m.values.abilityPower, 0));
  requireValue(unit.alive ? runtime.abilityPowerFlat === maximumAp : possibleAp.has(runtime.abilityPowerFlat), 'derived ability power');
  requireValue(runtime.permanentAdBps <= runtime.castCount * (champion(unit) === 'tristana' ? Math.round(variable(unit, 'ASKillGain', 1.25) * 100) : 0), 'derived growth bound');
  if (runtime.nextAttackMagic > 0) {
    requireValue(champion(unit) === 'lux' && runtime.castCount > 0 && [...possibleAp].some(value =>
      Math.floor(((unit.abilityPower ?? 100) + value) * variable(unit, 'Damage') / 100) === runtime.nextAttackMagic), 'derived empowered magic');
  }
  if (runtime.nextAttackPhysical > 0) {
    const attack = Math.floor(unit.attackDamageBase! * (10000 + unit.attackDamagePercentBps!) / 10000);
    const coefficient = variable(unit, 'PercentAttackDamage') + variable(unit, 'BonusDamageADRatio') * mechanic(unit, 'lowCostAllies', 'count');
    requireValue(champion(unit) === 'vander' && runtime.castCount > 0 && runtime.nextAttackPhysical === Math.floor(attack * Math.round(coefficient * 10000) / 10000), 'derived empowered physical');
  }
  requireValue(!runtime.buddyTriggered || (unit.mechanics ?? []).some(m => m.mechanic === 'bulkyBuddies' && combatUnits.some(other => other.id === m.targetId && !other.alive)), 'derived buddy trigger');
  const numerator = unit.attackDamageBase! * (10000 + unit.attackDamagePercentBps! + runtime.permanentAdBps);
  requireValue(Number.isSafeInteger(numerator) && Number.isSafeInteger(unit.baseAttackSpeedBps! * (10000 + unit.attackSpeedBonusBps! + expectedSpeed)), 'dynamic arithmetic bound');
  if (unit.ability.kind === 's13') {
    const largestCoefficient = Math.max(10000, ...Object.values(unit.ability.variables));
    requireValue(Number.isSafeInteger(largestCoefficient * (1 + Math.floor(numerator / 10000) + unit.maxHp + unit.abilityPower! + maximumAp)), 'ability arithmetic bound');
  }
  const origin = (source: import('./combat-types').CombatOrigin) => {
    record(source); id(source.ownerId); id(source.definitionId); id(source.instanceId); integer(source.effectIndex);
    requireValue(combatIds.has(source.ownerId) && ['attack','ability','trait','item','augment','anomaly','enemyGrowth'].includes(source.sourceKind), 'runtime source');
    const owner = combatUnits.find(value => value.id === source.ownerId)!;
    if (source.sourceKind === 'ability' || source.sourceKind === 'attack') {
      requireValue(source.definitionId === owner.ability.id && source.instanceId === owner.id && source.effectIndex === 0, 'ability source identity');
    } else {
      requireValue(owner.sources?.some(entry => entry.source.ownerId === source.ownerId
        && entry.source.sourceKind === source.sourceKind && entry.source.sourceDefinitionId === source.definitionId
        && entry.source.sourceInstanceId === source.instanceId && entry.source.effectIndex === source.effectIndex), 'frozen runtime source');
    }
  };
  list(unit.shieldLayers); const shieldKeys = new Set<string>(); let total = 0;
  for (const layer of unit.shieldLayers) {
    record(layer); origin(layer.source); integer(layer.granted); integer(layer.remaining); integer(layer.absorbed); integer(layer.expiresAtTick);
    requireValue(layer.key === sourceKey(layer.source) && !shieldKeys.has(layer.key) && layer.remaining <= layer.granted && (layer.remaining === 0 || layer.expiresAtTick > tick), 'shield layer');
    shieldKeys.add(layer.key); total += layer.remaining;
    if (layer.grantedAtTick !== undefined || layer.decayDurationTicks !== undefined) { integer(layer.grantedAtTick); integer(layer.decayDurationTicks,1); requireValue(layer.grantedAtTick! <= tick && layer.expiresAtTick === layer.grantedAtTick! + layer.decayDurationTicks!, 'shield decay timing'); }
    if (layer.decayPerTick !== undefined) integer(layer.decayPerTick, 1);
  }
  requireValue(total === unit.shield && unit.shieldExpiresAtTick === (total ? Math.max(...unit.shieldLayers.filter(l => l.remaining > 0).map(l => l.expiresAtTick)) : null), 'shield aggregate');
  list(unit.statuses); const statusKeys = new Set<string>();
  for (const status of unit.statuses) {
    record(status); origin(status.source); id(status.key); integer(status.startsAtTick); integer(status.expiresAtTick);
    requireValue(Number.isSafeInteger(status.amount) && (status.amount >= 0 || status.kind === 'resistanceFlat') && !statusKeys.has(status.key) && status.expiresAtTick > tick && status.startsAtTick <= tick + 1, 'status range');
    requireValue(['stun','damageReduction','armorReduction','resistanceFlat','attackSpeed','abilityPower','channel','redirect'].includes(status.kind), 'status kind');
    requireValue(status.kind !== 'abilityPower' && status.kind !== 'attackSpeed', 'unsupported dynamic status source');
    requireValue(Math.abs(status.amount) <= 1000000, 'status arithmetic bound');
    if (['damageReduction','armorReduction','redirect'].includes(status.kind)) requireValue(status.amount <= 10000, 'status bps');
    requireValue(status.key.startsWith(sourceKey(status.source)), 'status key/source'); statusKeys.add(status.key);
  }
  list(unit.tasks); const taskKeys = new Set<string>();
  for (const task of unit.tasks) {
    record(task); origin(task.source); id(task.key); integer(task.executeAtTick); integer(task.amount); integer(task.ordinal); integer(task.total,1); integer(task.actionSeq);
    requireValue(task.attachedDot === (task.kind === 'bleed' ? true : undefined) && task.shieldEndKey === (task.kind === 'ireliaEnd' ? sourceKey(task.source) : undefined), 'task mechanism binding');
    const owner = combatUnits.find(value => value.id === task.source.ownerId)!;
    const maximumAmp = mechanic(owner, 'damageAmp', 'bps') + mechanic(owner, 'glassCannon', 'damageAmpBps')
      + mechanic(owner, 'sniper', 'damageBpsPerHex') * (DEFAULT_BOARD.columns + DEFAULT_BOARD.rows);
    requireValue(task.amount <= 100000000 && task.executeAtTick <= 2401
      && Number.isSafeInteger(task.amount * (10000 + maximumAmp) * 10000), 'task arithmetic bound');
    requireValue(!taskKeys.has(task.key) && task.executeAtTick > tick && task.ordinal < task.total && typeof task.cancellable === 'boolean', 'task range');
    requireValue(['maddie','bleed','ireliaEnd','leonaEnd','lorisEnd','corki','caitlyn','tristanaBounce'].includes(task.kind), 'task kind');
    if (task.kind === 'tristanaBounce') {
      record(task.inherited); id(task.inherited.parentPacketId); integer(task.inherited.resolvedAtTick);
      requireValue(task.inherited.portion === 'overkill' && typeof task.inherited.critical === 'boolean'
        && task.executeAtTick === task.inherited.resolvedAtTick + 1 && task.inherited.resolvedAtTick <= tick, 'inherited bounce receipt');
      const tuple: unknown = JSON.parse(task.inherited.parentPacketId);
      list(tuple);
      requireValue(tuple.length === 6 && tuple[0] === combatId && tuple[1] === task.inherited.resolvedAtTick && tuple[2] === task.source.ownerId
        && tuple[3] === task.actionSeq && typeof tuple[4] === 'string' && combatIds.has(tuple[4])
        && tuple[5] === 0 && JSON.stringify(tuple) === task.inherited.parentPacketId, 'inherited parent packet identity');
      const parentTarget = combatUnits.find(value => value.id === tuple[4])!;
      requireValue(champion(owner) === 'tristana' && task.source.sourceKind === 'ability' && task.ordinal === 0
        && task.total === 1 && !task.cancellable && !parentTarget.alive && parentTarget.team !== owner.team, 'inherited primary kill');
    } else requireValue(task.inherited === undefined, 'unexpected inherited receipt');
    requireValue(task.targetId === null || combatIds.has(task.targetId), 'task target'); taskKeys.add(task.key);
  }
  list(unit.mechanics);
  for (const mechanic of unit.mechanics) { record(mechanic); origin(mechanic.source); id(mechanic.mechanic); record(mechanic.values);
    for (const value of Object.values(mechanic.values)) integer(value);
    if (mechanic.targetId !== undefined) requireValue(combatIds.has(mechanic.targetId), 'mechanic target'); }
}
