import { validateOverEncumbered } from './over-encumbered';
import { validateBatch5R6Transforms } from './restore-checks/batch5-r6-check';
import type { MatchState } from './match-types';
import { preflightH13Fact } from './augment-pool-batch5-h13-history';
import type { AugmentDeath, AugmentTakedownActor, AugmentHistoryFact, HistorySeat } from './augment-history-types';
import { AUGMENT_HISTORY_VERSION, AUGMENT_HISTORY_LIMITS as LIMIT } from './augment-history-types';
import { canonicalContent } from './content';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { historyCheck, needsAugmentHistory, historySeatId, validateAugmentAuthority, initializeAugmentTrace,
  advanceAugmentPreparationTime, carryRestoredAugmentTrace, type AugmentHistoryAuthority } from './augment-history';
import * as commands from './match';
import { validateMatchStructure } from './serialization-structure';
import { freezeContent } from './content/freeze';
import { grantMechanicUnit } from './seat-mechanics/grants';
const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);

interface ReplayEvidence {
  readonly origin: string;
  readonly commands: readonly { readonly name: string; readonly args: string; readonly count: number }[];
  readonly state: MatchState;
  // Retained graph, commands and the trace roster, in UTF-16 bytes. Short node
  // texts are not included; those are charged once per origin.
  readonly bytes: number;
  // ASCII characters of every short node text. One byte each.
  readonly frozenBytes: number;
}
// Restore-only evidence, never candidate admission or live command results.
// Exact origin/argument encodings bind each prefix; a compressed step run may
// grow, but a changed argument, branch or shortened run cannot reuse that suffix.
const replays: ReplayEvidence[] = [];
const MAX_REPLAYS = 8, MAX_REPLAY_BYTES = 8 * 1024 * 1024;
// A late-game solo save (one deaths fact per combat tick) alone exceeds the
// shared budget above. Without a slot, every restore/serialize of such a save
// replayed the whole match again. Keep only the most recent over-budget prefix,
// outside the shared budget; it is bounded by the validated history payload
// limit, and the same exact-prefix and full-state comparisons apply to it.
let oversizedReplay: ReplayEvidence | undefined;
// The two most recent displaced checkpoints of a route. A sibling branch (the
// parked anvil, the pre-combat carry) resumes from one of them after the latest
// save takes the single oversized slot. Bounded so a tick stream cannot fill it.
const forkReplays: ReplayEvidence[] = [];
const MAX_FORKS = 2;
const MAX_OVERSIZED_REPLAY_BYTES = 2 * LIMIT.bytes;
function containsNegativeZero(values: readonly unknown[]): boolean {
  const stack = [...values];
  while (stack.length) {
    const value = stack.pop();
    if (Object.is(value, -0)) return true;
    if (value && typeof value === 'object') for (const child of Object.values(value)) stack.push(child);
  }
  return false;
}
function replayPrefix(origin: string, commands: ReplayEvidence['commands'], facts: readonly AugmentHistoryFact[]): ReplayEvidence | undefined {
  let best: ReplayEvidence | undefined, bestSteps = -1;
  for (const entry of [...replays, ...forkReplays, ...(oversizedReplay ? [oversizedReplay] : [])]) {
    if (entry.origin !== origin || entry.commands.length > commands.length) continue;
    let steps = 0;
    const matches = entry.commands.every((c, i) => {
      const next = commands[i];
      steps += c.count;
      return c.name === next.name && c.args === next.args && (i === entry.commands.length - 1 && c.name === 'stepMatch'
        ? c.count <= next.count : c.count === next.count);
    });
    if (!matches) continue;
    const priorFacts = entry.state.augmentHistory?.facts ?? [];
    // A candidate may only extend the independently generated fact prefix. At
    // an identical command boundary a same-length fact list was already replayed
    // into this cache entry, so a different list cannot be produced by replaying
    // those commands and is rejected here instead of repeating the combat.
    // A different fact count still replays: a command can record an extra fact
    // on a later call. A shorter command prefix still reconstructs.
    const exact = entry.commands.length === commands.length && entry.commands.at(-1)?.count === commands.at(-1)?.count;
    if ((exact && priorFacts.length !== facts.length) || !same(priorFacts, facts.slice(0, priorFacts.length))) {
      if (exact && priorFacts.length === facts.length) historyCheck(false, 'replayed facts/state mismatch');
      continue;
    }
    if (steps > bestSteps) { best = entry; bestSteps = steps; }
  }
  return best;
}
// Code units of every object/array value whose canonical text is under 2048.
// rememberFrozen retains exactly those strings after the graph is frozen.
function frozenTextUnits(text: string): number {
  let total = 0; const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { i++; while (i < text.length) { if (text[i] === '\\') { i += 2; continue; } if (text[i] === '"') break; i++; } continue; }
    if (c === '{' || c === '[') { stack.push(i); continue; }
    if (c === '}' || c === ']') { const start = stack.pop(); if (start !== undefined) { const len = i - start + 1; if (len < 2048) total += len; } }
  }
  return total;
}
function quotedChars(text: string): number {
  let n = 2;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    // JSON.stringify short-escapes the five controls and quote/backslash; other controls use \u00XX.
    n += c === 34 || c === 92 || c === 8 || c === 9 || c === 10 || c === 12 || c === 13 ? 2 : c < 32 ? 6 : 1;
  }
  return n;
}
// Canonical length without building the string. Key order does not change it.
function jsonChars(value: unknown): number {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): number => {
    if (v === null) return 4;
    if (typeof v === 'string') return quotedChars(v);
    if (typeof v === 'boolean') return v ? 4 : 5;
    if (typeof v === 'number') return Number.isFinite(v) ? String(v).length : 0;
    if (typeof v !== 'object') return 0;
    if (seen.has(v)) return 0;
    seen.add(v);
    if (Array.isArray(v)) {
      let n = 2;
      for (let i = 0; i < v.length; i++) n += (i ? 1 : 0) + walk(v[i]);
      return n;
    }
    const keys = Object.keys(v); let n = 2;
    for (let i = 0; i < keys.length; i++) n += (i ? 1 : 0) + quotedChars(keys[i]) + 1 + walk((v as Record<string, unknown>)[keys[i]]);
    return n;
  };
  return walk(value);
}
// The trace shares proof.origin and proof.commands with the state. It also
// keeps one previous-battle roster clone that no state field points at.
function traceRosterChars(state: MatchState): number {
  let max = jsonChars({ units: state.preparation.units.filter(unit => unit.team === 'player'), items: state.items });
  for (const fact of state.augmentHistory?.facts ?? []) if ('roster' in fact && fact.roster) {
    const chars = jsonChars(fact.roster);
    if (chars > max) max = chars;
  }
  return max;
}
// Short node texts of one origin are charged once, at the largest total. Each
// later prefix only adds the increment, and those increments sum to that maximum.
// The strings are ASCII, so a character is one byte, not a UTF-16 code unit.
function chargedReplayBytes(entries: readonly Pick<ReplayEvidence, 'origin' | 'bytes' | 'frozenBytes'>[]): number {
  let graph = 0;
  const frozen = new Map<string, number>();
  for (const entry of entries) {
    graph += entry.bytes;
    const prior = frozen.get(entry.origin) ?? 0;
    if (entry.frozenBytes > prior) frozen.set(entry.origin, entry.frozenBytes);
  }
  for (const value of frozen.values()) graph += value;
  return graph;
}
function commandsExtend(prefix: ReplayEvidence['commands'], full: ReplayEvidence['commands']): boolean {
  if (prefix.length === 0 || prefix.length > full.length) return false;
  return prefix.every((command, index) => {
    const next = full[index];
    return next !== undefined && command.name === next.name && command.args === next.args
      && (index === prefix.length - 1 && command.name === 'stepMatch' ? command.count <= next.count : command.count === next.count);
  });
}
/** Same command list, with only the trailing repeated stepMatch count increased. */
function stepCountExtended(prev: ReplayEvidence['commands'], next: ReplayEvidence['commands']): boolean {
  if (prev.length !== next.length || prev.length === 0) return false;
  for (let i = 0; i < prev.length; i++) {
    const before = prev[i], after = next[i];
    if (before.name !== after.name || before.args !== after.args) return false;
    if (i === prev.length - 1) {
      if (before.name !== 'stepMatch' || before.count >= after.count) return false;
    } else if (before.count !== after.count) return false;
  }
  return true;
}
function commandSteps(commands: ReplayEvidence['commands']): number {
  let steps = 0;
  for (const command of commands) steps += command.count;
  return steps;
}
/** The oversized slot holds one long checkpoint. Replacing it used to drop the
 * only copy of the previous checkpoint, so a sibling branch or an earlier save
 * resumed from a much older shared prefix and replayed the whole stage.
 * Keep that displaced prefix in the shared budget when it still fits. Per-tick
 * growth stays in the one oversized slot. Each other route keeps its longest
 * proof, so a 4-7 checkpoint cannot push out the only Loris prefix. */
function retainDisplacedPrefix(origin: string, commands: ReplayEvidence['commands']): void {
  const displaced = oversizedReplay;
  if (!displaced || displaced.origin !== origin || !commandsExtend(displaced.commands, commands) || stepCountExtended(displaced.commands, commands)) return;
  if (replays.some(entry => entry.origin === origin && same(entry.commands, displaced.commands))) return;
  const entries = [...replays];
  const fits = (list: readonly ReplayEvidence[]) => list.length + 1 <= MAX_REPLAYS && chargedReplayBytes([...list, displaced]) <= MAX_REPLAY_BYTES;
  const dropShortest = (choose: (entry: ReplayEvidence) => boolean): boolean => {
    let index = -1, best = Infinity;
    for (let i = 0; i < entries.length; i++) {
      if (!choose(entries[i])) continue;
      const steps = commandSteps(entries[i].commands);
      if (steps < best) { best = steps; index = i; }
    }
    if (index < 0) return false;
    entries.splice(index, 1);
    return true;
  };
  // Shorter prefixes of this same line are redundant once the displaced checkpoint
  // is kept. Never drop the longest one: a sibling branch still resumes from it.
  while (!fits(entries)) {
    const same = entries.filter(entry => entry.origin === origin && commandsExtend(entry.commands, displaced.commands));
    const longestSame = same.reduce((max, entry) => Math.max(max, commandSteps(entry.commands)), -1);
    if (dropShortest(entry => entry.origin === origin && commandsExtend(entry.commands, displaced.commands) && commandSteps(entry.commands) < longestSame)) continue;
    // Another route keeps its longest proof (the 4-7 / Loris case). Extra older
    // proofs of that route can make room for this checkpoint.
    if (!dropShortest(entry => {
      if (entry.origin === origin) return false;
      let longest = -1, peers = 0;
      for (const other of entries) if (other.origin === entry.origin) { peers++; longest = Math.max(longest, commandSteps(other.commands)); }
      return peers > 1 && commandSteps(entry.commands) < longest;
    })) break;
  }
  if (!fits(entries)) return;
  replays.splice(0, replays.length, ...entries, displaced);
}
function rememberFork(stored: ReplayEvidence): void {
  const previous = oversizedReplay;
  if (!previous || previous.origin !== stored.origin || same(previous.commands, stored.commands)) return;
  if (!commandsExtend(previous.commands, stored.commands) || stepCountExtended(previous.commands, stored.commands)) return;
  const mine = forkReplays.filter(entry => entry.origin === stored.origin && commandsExtend(entry.commands, stored.commands) && !same(entry.commands, previous.commands));
  mine.push(previous);
  while (mine.length > MAX_FORKS) mine.shift();
  const others = forkReplays.filter(entry => entry.origin !== stored.origin);
  forkReplays.splice(0, forkReplays.length, ...others, ...mine);
  while (forkReplays.length > MAX_FORKS * 2) forkReplays.shift();
}
function parkOversized(stored: ReplayEvidence): void {
  rememberFork(stored);
  retainDisplacedPrefix(stored.origin, stored.commands);
  oversizedReplay = stored;
}
function rememberReplay(origin: string, commands: ReplayEvidence['commands'], state: MatchState, stateText: string): void {
  // stateText proxies the retained graph. The trace roster sits outside it.
  // Both are UTF-16. Short node texts are charged separately, once per origin.
  const frozenBytes = frozenTextUnits(stateText);
  const bytes = 2 * (origin.length + canonicalContent(commands).length + stateText.length + traceRosterChars(state));
  if (bytes + frozenBytes > MAX_REPLAY_BYTES) {
    if (bytes + frozenBytes <= MAX_OVERSIZED_REPLAY_BYTES) parkOversized({origin,commands,state:freezeContent(state),bytes,frozenBytes});
    return;
  }
  const stored = { origin, commands, state: freezeContent(state), bytes, frozenBytes };
  const candidate = { origin, bytes, frozenBytes };
  const exact = replays.findIndex(entry => entry.origin === origin && same(entry.commands, commands));
  if (exact >= 0) {
    const without = replays.filter((_, index) => index !== exact);
    replays.splice(exact, 1);
    if (chargedReplayBytes([...without, candidate]) > MAX_REPLAY_BYTES) parkOversized(stored);
    else replays.push(stored);
    return;
  }
  // Per-tick saves share one slot. Replacing the previous tick keeps the next
  // step O(1) without stacking every tick until another route is evicted.
  const stepped = replays.findIndex(entry => entry.origin === origin && stepCountExtended(entry.commands, commands));
  if (stepped >= 0) {
    const without = replays.filter((_, index) => index !== stepped);
    if (chargedReplayBytes([...without, candidate]) <= MAX_REPLAY_BYTES) {
      replays.splice(stepped, 1);
      replays.push(stored);
    } else parkOversized(stored);
    return;
  }
  if (replays.length < MAX_REPLAYS && chargedReplayBytes([...replays, candidate]) <= MAX_REPLAY_BYTES) {
    replays.push(stored);
    return;
  }
  // A 4-7 prefix is ~4.4MB and a tick-126 checkpoint ~5.4MB. Pushing the checkpoint
  // used to shift the other route's ~2.1MB prefix, so its next serialize replayed
  // ~10k commands (~11s) and missed the 20s case. Keep every shorter proof in the
  // shared budget. The checkpoint stays resumable in the single oversized slot,
  // including for a divergent branch that still needs the shared prefix.
  if (replays.some(entry => entry.origin === origin && commandsExtend(entry.commands, commands))) {
    parkOversized(stored);
    return;
  }
  while (replays.length >= MAX_REPLAYS || chargedReplayBytes([...replays, candidate]) > MAX_REPLAY_BYTES) replays.shift();
  // No private expected state or trace payload can be mutated through a later
  // restored command's proof. Pure commands can resume these frozen prefixes.
  replays.push(stored);
}

export function preflightAugmentHistory(s: MatchState): void {
  validateOverEncumbered(s);
  validateBatch5R6Transforms(s);
  const h = s.augmentHistory;
  if (h === undefined) { historyCheck(!needsAugmentHistory(s), 'missing augment-history-v1; history-dependent augment saves cannot be authenticated'); return; }
  historyCheck(h && typeof h === 'object' && !Array.isArray(h), 'section shape');
  historyCheck(needsAugmentHistory(s), 'history without owner');
  historyCheck(same(Object.keys(h).sort(), ['facts','proof','seatId','version']) && h.version === AUGMENT_HISTORY_VERSION && h.seatId === historySeatId(s), 'version/seat/fields');
  if (typeof s.round === 'number' && !Number.isFinite(s.round)) throw new TypeError('Content must be finite plain JSON data');
  historyCheck(Array.isArray(h.facts) && h.facts.length <= LIMIT.facts && s.round <= LIMIT.rounds, 'fact bounds');
  // Bound arbitrary nested payloads before canonicalization/replay, including an adversarial object entry.
  let bytes = 0, nodes = 0; const stack: [unknown,number][] = [[h,0]];
  while (stack.length) {
    const [v,d] = stack.pop()!;
    historyCheck(++nodes <= 1000000 && d < 64, 'payload bounds');
    if (typeof v === 'number' && !Number.isFinite(v)) throw new TypeError('Content must be finite plain JSON data');
    if (typeof v === 'string') bytes += v.length * 2;
    else if (v && typeof v === 'object') for (const [k,x] of Object.entries(v)) { bytes += k.length * 2 + 8; stack.push([x,d+1]); }
    historyCheck(bytes <= LIMIT.bytes, 'payload bytes');
  }
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
  const origin = canonicalContent(proof.origin);
  const encoded = proof.commands.map(c => ({name:c.name,args:canonicalContent(c.args),count:c.count}));
  // Canonical JSON collapses -0 to 0, so such proofs must use cold replay.
  const cacheable = !containsNegativeZero([proof.origin, ...proof.commands.map(c => c.args)]);
  const prefix = cacheable ? replayPrefix(origin, encoded, h.facts) : undefined;
  // A hit skips validateMatchStructure(proof.origin) and resumes commands from
  // frozen evidence. This is correct only while all SOLO_COMMANDS are pure
  // functions that never mutate their inputs in place.
  let replay = prefix?.state ?? initializeAugmentTrace(validateMatchStructure(proof.origin));
  for (const [index,c] of proof.commands.entries()) {
    const skipped = prefix?.commands[index]?.count ?? 0;
    if (skipped === c.count) continue;
    // A command may retain a location/target object. Private evidence must not
    // retain or freeze any object owned by the candidate save.
    const args = structuredClone(c.args).map((a: unknown) => a === null ? undefined : a);
    for (let i = skipped; i < c.count; i++) {
      const fn = (c.name === 'advanceAugmentPreparationTime' ? advanceAugmentPreparationTime : c.name === 'grantMechanicUnit' ? grantMechanicUnit : (commands as unknown as Record<string, (...a: unknown[]) => unknown>)[c.name]) as (...args: unknown[]) => unknown;
      const result = fn(replay, ...args) as { ok?: boolean; state?: MatchState };
      historyCheck(result && result.ok !== false, `replay command ${c.name}`);
      const next = result.state ?? result as unknown as MatchState;
      historyCheck(next !== replay, 'replay no-op'); replay = next;
    }
  }
  const replayText = canonicalContent(replay);
  historyCheck(replayText === canonicalContent(s), 'replayed facts/state mismatch');
  if (cacheable) rememberReplay(origin, encoded, replay, replayText);
  carryRestoredAugmentTrace(replay,s);
}
export const SOLO_COMMANDS = new Set(['deployMatchUnit','buyUnit','openAnvil','sellUnit','setShopLock','rerollShop','buyXp','startMatchCombat','stepMatch','nextRound','useConsumable','combineItems','equipItem','selectAnomalyTarget','rerollAugment','rerollAnomaly','forfeitPendingChoice','forfeitTerminalOrbs','claimOrb','claimOrDiscardLoot','selectChoice','chooseG23Junker','chooseG23BlackMarket','claimG23Reward','advanceAugmentPreparationTime','grantMechanicUnit']);

