import type { MatchState } from './match-types';
import { preflightH13Fact } from './augment-pool-batch5-h13-history';
import type { AugmentDeath, HistorySeat } from './augment-history-types';
import { AUGMENT_HISTORY_VERSION, AUGMENT_HISTORY_LIMITS as LIMIT } from './augment-history-types';
import { canonicalContent } from './content';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { historyCheck, needsAugmentHistory, historySeatId, validateAugmentAuthority, initializeAugmentTrace,
  advanceAugmentPreparationTime, carryRestoredAugmentTrace, type AugmentHistoryAuthority } from './augment-history';
import * as commands from './match';
import { validateMatchStructure } from './serialization-structure';
const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);

export function preflightAugmentHistory(s: MatchState): void {
  const h = s.augmentHistory;
  if (h === undefined) { historyCheck(!needsAugmentHistory(s), 'missing augment-history-v1; history-dependent augment saves cannot be authenticated'); return; }
  historyCheck(h && typeof h === 'object' && !Array.isArray(h), 'section shape');
  historyCheck(needsAugmentHistory(s), 'history without owner');
  historyCheck(same(Object.keys(h).sort(), ['facts','proof','seatId','version']) && h.version === AUGMENT_HISTORY_VERSION && h.seatId === historySeatId(s), 'version/seat/fields');
  historyCheck(Array.isArray(h.facts) && h.facts.length <= LIMIT.facts && s.round <= LIMIT.rounds, 'fact bounds');
  let round = 0, prefix = 0;
  for (const [i,f] of h.facts.entries()) {
    historyCheck(f && f.sequence === i && f.seatId === h.seatId && Number.isSafeInteger(f.round) && f.round >= round && f.round <= s.round && f.roundId === getMultiplayerRoundByOrdinal(f.round).roundId, 'fact sequence/seat/round');
    historyCheck(Number.isSafeInteger(f.resourcePrefix) && f.resourcePrefix >= prefix && f.resourcePrefix <= s.resourceProvenance.entries.length, 'resource prefix');
    round = f.round; prefix = f.resourcePrefix;
    preflightH13Fact(s, f);
    if ('roster' in f) historyCheck(f.roster && Array.isArray(f.roster.units) && f.roster.units.length <= LIMIT.units && Array.isArray(f.roster.items) && f.roster.items.length <= 1024, 'roster bounds');
    if ('seats' in f) historyCheck(Array.isArray(f.seats) && f.seats.length > 0 && f.seats.length <= LIMIT.seats && new Set(f.seats.map((x: HistorySeat) => x.seatId)).size === f.seats.length && f.seats.every((x:HistorySeat) => Array.isArray(x.units) && x.units.length <= LIMIT.units && Array.isArray(x.items) && x.items.length <= 1024 && Number.isSafeInteger(x.rank) && x.rank >= 1 && x.rank <= LIMIT.seats), 'table bounds');
    if (f.kind === 'offer-level') historyCheck(f.choiceId==='round:4-2:augment' && Number.isSafeInteger(f.generation) && f.generation>=0 && f.generation<=3 && Number.isSafeInteger(f.level) && f.level>=1 && f.level<=10 && Number.isSafeInteger(f.xp) && f.xp>=0, 'offer level');
    if (f.kind === 'deaths') {
      historyCheck(Array.isArray(f.deaths) && f.deaths.length <= LIMIT.deaths, 'death bounds');
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

