import { validateBatch5R6Transforms } from './augment-pool-batch5-r6';
import type { MatchState } from './match-types';
import { preflightH13Fact } from './augment-pool-batch5-h13-history';
import type { AugmentDeath, AugmentTakedownActor, HistorySeat } from './augment-history-types';
import { AUGMENT_HISTORY_VERSION, AUGMENT_HISTORY_LIMITS as LIMIT } from './augment-history-types';
import { canonicalContent } from './content';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { historyCheck, needsAugmentHistory, historySeatId, validateAugmentAuthority, initializeAugmentTrace,
  advanceAugmentPreparationTime, carryRestoredAugmentTrace, type AugmentHistoryAuthority } from './augment-history';
import * as commands from './match';
import { validateMatchStructure } from './serialization-structure';
const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);

export function preflightAugmentHistory(s: MatchState): void {
  validateBatch5R6Transforms(s);
  const h = s.augmentHistory;
  if (h === undefined) { historyCheck(!needsAugmentHistory(s), 'missing augment-history-v1; history-dependent augment saves cannot be authenticated'); return; }
  historyCheck(h && typeof h === 'object' && !Array.isArray(h), 'section shape');
  historyCheck(needsAugmentHistory(s), 'history without owner');
  historyCheck(same(Object.keys(h).sort(), ['facts','proof','seatId','version']) && h.version === AUGMENT_HISTORY_VERSION && h.seatId === historySeatId(s), 'version/seat/fields');
  historyCheck(Array.isArray(h.facts) && h.facts.length <= LIMIT.facts && s.round <= LIMIT.rounds, 'fact bounds');
  let round = 0, prefix = 0;
  const attributedBattles = new Set<string>();
  for (const [i,f] of h.facts.entries()) {
    historyCheck(f && f.sequence === i && f.seatId === h.seatId && Number.isSafeInteger(f.round) && f.round >= round && f.round <= s.round && f.roundId === getMultiplayerRoundByOrdinal(f.round).roundId, 'fact sequence/seat/round');
    historyCheck(Number.isSafeInteger(f.resourcePrefix) && f.resourcePrefix >= prefix && f.resourcePrefix <= s.resourceProvenance.entries.length, 'resource prefix');
    round = f.round; prefix = f.resourcePrefix;
    preflightH13Fact(s, f);
    if ('roster' in f) historyCheck(f.roster && Array.isArray(f.roster.units) && f.roster.units.length <= LIMIT.units && Array.isArray(f.roster.items) && f.roster.items.length <= 1024, 'roster bounds');
    if ('seats' in f) historyCheck(Array.isArray(f.seats) && f.seats.length > 0 && f.seats.length <= LIMIT.seats && new Set(f.seats.map((x: HistorySeat) => x.seatId)).size === f.seats.length && f.seats.every((x:HistorySeat) => Array.isArray(x.units) && x.units.length <= LIMIT.units && Array.isArray(x.items) && x.items.length <= 1024 && Number.isSafeInteger(x.rank) && x.rank >= 1 && x.rank <= LIMIT.seats), 'table bounds');
    if (f.kind === 'offer-level') historyCheck(f.choiceId==='round:4-2:augment' && Number.isSafeInteger(f.generation) && f.generation>=0 && f.generation<=3 && Number.isSafeInteger(f.level) && f.level>=1 && f.level<=10 && Number.isSafeInteger(f.xp) && f.xp>=0, 'offer level');
    if (f.kind === 'combat-binding') {
      const b = f.binding;
      historyCheck(typeof f.battleId === 'string' && f.battleId.length > 0 && f.battleId.length <= 256 &&
        (b === null || !!b && typeof b === 'object' && typeof b.unitId === 'string' && b.unitId.length > 0 &&
          typeof b.definitionId === 'string' && b.definitionId.length > 0 && typeof b.choiceId === 'string' && b.choiceId.length > 0 &&
          Number.isSafeInteger(b.boundRound) && b.boundRound > 0 && b.boundRound <= f.round) && !attributedBattles.has(f.battleId), 'combat binding');
      attributedBattles.add(f.battleId);
    }
    if (f.kind === 'summon-growth') {
      historyCheck(s.augments.some(a=>a.definitionId==='forbidden-magic'&&a.choiceId===f.choiceId)&&f.definitionId==='g23-sion'
        && typeof f.receiptId==='string'&&f.receiptId.length<=256
        && [f.stacks,f.healthFlat,f.attackDamageBps].every(n=>Number.isSafeInteger(n)&&n>0&&n<=1000000000), 'summon growth');
    }
    if(f.kind==='anomaly-copy-kills')historyCheck(typeof f.battleId==='string'&&typeof f.itemId==='string'&&typeof f.unitId==='string'&&Array.isArray(f.kills)&&f.kills.length<=LIMIT.deaths&&f.kills.every((k:{eventSeq:number;victimId:string})=>Number.isSafeInteger(k.eventSeq)&&k.eventSeq>=0&&typeof k.victimId==='string'),'anomaly copy bounds');
    if (f.kind === 'deaths') {
      historyCheck(Array.isArray(f.deaths) && f.deaths.length <= LIMIT.deaths, 'death bounds');
      if(s.augments.some(a=>a.definitionId==='forbidden-magic'&&a.acquiredRound<=f.round))
        historyCheck(f.deaths.every((d: AugmentDeath)=>Array.isArray(d.takedowns)&&d.takedowns.length<=LIMIT.units&&new Set(d.takedowns.map((a: AugmentTakedownActor)=>a.unitId)).size===d.takedowns.length
          &&d.takedowns.every((a: AugmentTakedownActor)=>typeof a.unitId==='string'&&a.unitId.length>0&&a.unitId.length<=1024&&typeof a.definitionId==='string'&&['player','enemy'].includes(a.team)&&typeof a.eligible==='boolean')), 'death takedowns');
      if (attributedBattles.has(f.battleId))
        historyCheck(f.deaths.every((d: AugmentDeath) => !!d && typeof d === 'object' && Object.hasOwn(d, 'killer') && (d.killer === null || !!d.killer &&
          typeof d.killer.ownerId === 'string' && d.killer.ownerId.length > 0 && d.killer.ownerId.length <= 1024 &&
          typeof d.killer.definitionId === 'string' && typeof d.killer.instanceId === 'string' &&
          ['attack','ability','trait','item','augment','anomaly','enemyGrowth'].includes(d.killer.sourceKind) &&
          Number.isSafeInteger(d.killer.effectIndex) && d.killer.effectIndex >= 0)), 'death killer');
      if (!s.multiplayer || getMultiplayerRoundByOrdinal(f.round).kind === 'pve')
        historyCheck(f.deaths.every((d: AugmentDeath) => d && (d.team === 'player' || d.team === 'enemy') && d.ownerSeatId === (d.team === 'player' ? h.seatId : null)), 'death owner');
    }
  }
  historyCheck(h.facts[0]?.kind === 'acquire' || h.facts[0]?.kind === 'offer-level', 'acquisition boundary');
  historyCheck(h.proof && (h.proof.kind === 'solo' || h.proof.kind === 'server'), 'proof kind');
  // Bound arbitrary nested payloads before canonicalization/replay, including an adversarial object entry.
  let bytes = 0, nodes = 0; const stack: [unknown,number][] = [[h,0]];
  while (stack.length) {
    const [v,d] = stack.pop()!;
    historyCheck(++nodes <= 1000000 && d < 64, 'payload bounds');
    if (typeof v === 'string') bytes += v.length * 2;
    else if (v && typeof v === 'object') for (const [k,x] of Object.entries(v)) { bytes += k.length * 2 + 8; stack.push([x,d+1]); }
    historyCheck(bytes <= LIMIT.bytes, 'payload bytes');
  }
}
export function validateAugmentHistory(s: MatchState, authority?: AugmentHistoryAuthority): void {
  preflightAugmentHistory(s); const h = s.augmentHistory;
  validateAugmentAuthority(s,authority,false);
  if (!h) return;
  if (s.multiplayer) {
    historyCheck(h.proof.kind === 'server', 'online proof');
    validateAugmentAuthority(s,authority,true); return;
  }
  historyCheck(h.proof.kind === 'solo', 'solo proof');
  const proof = h.proof;
  historyCheck(proof.origin && !proof.origin.augmentHistory && !proof.origin.multiplayer && !needsAugmentHistory(proof.origin), 'recursive/owned origin');
  historyCheck(Array.isArray(proof.commands) && proof.commands.length <= LIMIT.commands, 'command bounds');
  let steps = 0;
  for (const c of proof.commands) {
    historyCheck(c && same(Object.keys(c).sort(), ['args','count','name']) && SOLO_COMMANDS.has(c.name) && Array.isArray(c.args) && c.args.length <= 5 && Number.isSafeInteger(c.count) && c.count > 0 && (c.count === 1 || c.name === 'stepMatch'), 'command shape');
    steps += c.count; historyCheck(steps <= LIMIT.steps, 'step bounds');
  }
  let replay = initializeAugmentTrace(validateMatchStructure(proof.origin));
  for (const c of proof.commands) for (let i = 0; i < c.count; i++) {
    const fn = (c.name === 'advanceAugmentPreparationTime' ? advanceAugmentPreparationTime : (commands as unknown as Record<string, (...a: unknown[]) => unknown>)[c.name]) as (...args: unknown[]) => unknown;
    const result = fn(replay, ...c.args.map((a: unknown) => a === null ? undefined : a)) as { ok?: boolean; state?: MatchState };
    historyCheck(result && result.ok !== false, `replay command ${c.name}`);
    const next = result.state ?? result as unknown as MatchState;
    historyCheck(next !== replay, 'replay no-op'); replay = next;
  }
  historyCheck(same(replay, s), 'replayed facts/state mismatch');
  carryRestoredAugmentTrace(replay,s);
}
export const SOLO_COMMANDS = new Set(['deployMatchUnit','buyUnit','openAnvil','sellUnit','setShopLock','rerollShop','buyXp','startMatchCombat','stepMatch','nextRound','useConsumable','combineItems','equipItem','selectAnomalyTarget','rerollAugment','rerollAnomaly','forfeitPendingChoice','forfeitTerminalOrbs','claimOrb','claimOrDiscardLoot','selectChoice','chooseG23Junker','chooseG23BlackMarket','claimG23Reward','advanceAugmentPreparationTime']);

