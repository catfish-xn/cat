import type { MatchState } from './match-types';
import { canonicalContent } from './content';
import { AUGMENT_HISTORY_LIMITS as LIMIT } from './augment-history-types';
import { validateAugmentAuthority, advanceAugmentPreparationTime, type AugmentHistoryAuthority } from './augment-history';
import { SOLO_COMMANDS } from './augment-history-restore';
import { validateMatchStructure } from './serialization-structure';
import * as commands from './match';

const check = (ok: unknown, reason: string): void => { if (!ok) throw new RangeError(`Invalid anomaly history: ${reason}`); };
// Only independently replayed canonical evidence strings are retained, bounded by UTF-16 text bytes.
interface Evidence { readonly state: string; readonly resolved: boolean; readonly receipts: string; readonly prefix: string; readonly prefixLength: number; readonly selection: string; readonly bytes: number }
const replayed = new Map<string, Evidence>();
const MAX_BYTES = 4 * 1024 * 1024;
let retainedBytes = 0;
export function validateAnomalyHistoryProof(state: MatchState, authority?: AugmentHistoryAuthority): void {
  const h = state.anomalyOfferHistory;
  if (!h) return; // Missing required quotes/receipts are rejected by validateAnomalyOfferHistory.
  check(h.version === 'anomaly-offer-history-v1' && Object.keys(h).sort().join(',') === 'facts,proof,version', 'section');
  check(Array.isArray(h.facts) && h.facts.length > 0 && h.facts.length <= LIMIT.facts, 'fact bounds');
  let prefix = 0;
  for (const [i,f] of h.facts.entries()) {
    check(Object.keys(f).sort().join(',') === 'choiceId,definitionId,kind,resourcePrefix,round,roundId,seatId,sequence'
      && f.kind === 'anomaly-offer' && f.sequence === i && f.seatId === (state.multiplayer?.seatId ?? 'solo')
      && f.round === 23 && f.roundId === '4-6' && f.choiceId === 'round:4-6:anomaly'
      && Number.isSafeInteger(f.resourcePrefix) && f.resourcePrefix >= prefix && f.resourcePrefix <= state.resourceProvenance.entries.length, 'fact identity/prefix');
    prefix = f.resourcePrefix;
  }
  const proof = h.proof;
  if (state.multiplayer) {
    check(proof?.kind === 'server', 'online proof');
    validateAugmentAuthority(state,authority,true); return;
  }
  check(proof?.kind === 'solo', 'solo proof');
  if (proof.kind !== 'solo') return;
  check(Object.keys(proof).sort().join(',') === 'commands,kind,origin' && proof.origin && !proof.origin.anomalyOfferHistory
    && !proof.origin.multiplayer && proof.origin.roundDefinitionId === '4-6'
    && proof.origin.pendingChoice?.kind === 'anomaly' && !proof.origin.pendingChoice.offers.length, 'origin');
  check(Array.isArray(proof.commands) && proof.commands.length > 0 && proof.commands.length <= LIMIT.commands, 'command bounds');
  for (const c of proof.commands) check(c && Object.keys(c).sort().join(',') === 'args,count,name'
    && SOLO_COMMANDS.has(c.name)
    && c.count === 1 && Array.isArray(c.args) && c.args.length <= 5, 'command shape');
  const key = canonicalContent(h);
  check(key.length * 2 <= LIMIT.bytes, 'payload bytes');
  // Do not collapse negative zero in command arguments into cached zero evidence.
  const stack: unknown[] = [proof]; let cacheable = true;
  while (stack.length) { const v = stack.pop(); if (Object.is(v,-0)) cacheable = false;
    if (v && typeof v === 'object') stack.push(...Object.values(v)); }
  let evidence = cacheable ? replayed.get(key) : undefined;
  if (!evidence) {
    let replay = validateMatchStructure(proof.origin);
    for (const c of proof.commands) {
      check(!replay.anomalyOfferHistory || replay.pendingChoice?.kind === 'anomaly', 'command after resolution');
      const fn = (c.name === 'advanceAugmentPreparationTime' ? advanceAugmentPreparationTime
        : (commands as unknown as Record<string, (...args: unknown[]) => unknown>)[c.name]) as (...args: unknown[]) => unknown;
      const result = fn(replay,...structuredClone(c.args).map(a => a === null ? undefined : a)) as {ok?:boolean;state?:MatchState};
      const next = result.state ?? result as unknown as MatchState;
      check(result && result.ok !== false && next && 'augments' in next && next !== replay, `replay command ${c.name}`);
      replay = next;
    }
    check(canonicalContent(replay.anomalyOfferHistory) === key, 'replayed quotes mismatch');
    const texts = {
      state: canonicalContent(replay), receipts: canonicalContent(replay.scheduleReceipts.filter(r=>r.kind==='anomaly')),
      prefix: canonicalContent(replay.resourceProvenance.entries), selection: canonicalContent(replay.anomalySelection),
    };
    const bytes = 2 * (key.length + Object.values(texts).reduce((n,t)=>n+t.length,0));
    evidence = { ...texts, resolved:replay.pendingChoice?.kind !== 'anomaly', prefixLength:replay.resourceProvenance.entries.length, bytes };
    if (cacheable && bytes <= MAX_BYTES) {
      while (replayed.size >= 4 || retainedBytes + bytes > MAX_BYTES) {
        const [oldKey,old] = replayed.entries().next().value!;
        retainedBytes -= old.bytes; replayed.delete(oldKey);
      }
      // Store only private canonical strings, never a graph shared with candidate data or global node-text caches.
      replayed.set(key,evidence); retainedBytes += bytes;
    }
  }
  if (state.pendingChoice?.kind === 'anomaly') check(evidence.state === canonicalContent(state), 'replayed choice/state mismatch');
  else {
    check(evidence.resolved, 'unfinished proof');
    check(canonicalContent(state.resourceProvenance.entries.slice(0,evidence.prefixLength))
      === evidence.prefix, 'resource prefix');
    // The quote proof seals the seat entitlement, not its original physical holder.
    // Before this check, validateB8Resources has independently folded all ordered
    // births/sales/upgrades and authenticated the current binding (including the
    // acquisitions that emit anomalyRestored). A sold ID cannot be resurrected by
    // editing the binding, while a real same-champion acquisition retains selection.
    check(canonicalContent(state.anomalySelection) === evidence.selection, 'selected entitlement');
    check(evidence.receipts
      === canonicalContent(state.scheduleReceipts.filter(r=>r.kind==='anomaly')), 'selection receipt');
  }
}
