import type { G23MatchProgress } from './g2-3-match-progress';
import { equalOrderedJson } from './immutable-json';

// Exactly one synchronous restore of its own JSON.parse graph. No caller can
// mutate that graph or execute getters, and the validators only read it.
// Object restores/serialization disable this scope, including nested calls.
interface Scope {
  owner?: object;
  basis?: object;
  reader?: G23MatchProgress;
  checked?: { value: G23MatchProgress; seed: number; round: number };
  sources?: { keys: string[]; values: unknown[] };
  receipts: WeakSet<object>;
  replays: WeakMap<object, { seed: number; value: G23MatchProgress }>;
}
var scope: Scope | undefined;
export function withG23RestoreReuse<T>(enabled: boolean, run: () => T): T {
  const previous = scope;
  scope = enabled ? { receipts: new WeakSet(), replays: new WeakMap() } : undefined;
  try { return run(); } finally { scope = previous; }
}
export function registerG23RestoreOwner(owner: object): void {
  if (!scope) return;
  scope.owner = owner;
  const state = owner as { seatMechanics?: { hidden?: { progress?: { economyReceipts?: unknown } } }; combatInputBasis?: { inputs?: { g23?: G23MatchProgress } } };
  const basis = state.combatInputBasis?.inputs?.g23;
  if (basis !== null && typeof basis === 'object' && !Array.isArray(basis)) scope.basis = basis;
  for (const receipts of [state.seatMechanics?.hidden?.progress?.economyReceipts, basis?.economyReceipts])
    if (Array.isArray(receipts)) scope.receipts.add(receipts);
}
export function readRestoreG23Progress(owner: object): G23MatchProgress | undefined {
  return scope?.owner === owner ? scope.reader : undefined;
}
export function rememberReadG23Progress(owner: object, value: G23MatchProgress): G23MatchProgress {
  if (scope?.owner === owner) scope.reader = value;
  return value;
}
export function reusedG23Sources(owner: object): boolean {
  if (scope?.owner !== owner || !scope.sources) return false;
  const record = owner as Record<string, unknown>, keys = Object.keys(owner);
  return keys.length === scope.sources.keys.length && keys.every((key, i) => key === scope!.sources!.keys[i] && record[key] === scope!.sources!.values[i]);
}
export function rememberG23Sources(owner: object): void {
  if (scope?.owner !== owner) return;
  const record = owner as Record<string, unknown>, keys = Object.keys(owner);
  scope.sources = { keys, values: keys.map(key => record[key]) };
}
export function reusedG23Validation(value: G23MatchProgress, seed: number, round: number): boolean {
  const known = scope?.checked;
  // Compare the WHOLE other private DTO, including property order, every key,
  // array entry and number, before reusing this call's successful validation.
  return !!known && scope?.basis === value && known.seed === seed && known.round === round
    && equalOrderedJson(value, known.value);
}
export function rememberG23Validation(value: G23MatchProgress, seed: number, round: number): void {
  if (scope?.reader === value) scope.checked = { value, seed, round };
}
export function readRestoreG23Replay(receipts: object, seed: number): G23MatchProgress | undefined {
  if (!scope?.receipts.has(receipts)) return undefined;
  const known = scope.replays.get(receipts);
  return known?.seed === seed ? known.value : undefined;
}
export function rememberRestoreG23Replay(receipts: object, seed: number, value: G23MatchProgress): void {
  if (scope?.receipts.has(receipts)) scope.replays.set(receipts, { seed, value });
}
