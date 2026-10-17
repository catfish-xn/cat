import { VerifiedRestoreCache, verifiedRestoreKey } from './verified-restore-cache';
import type { MatchEvent, MatchState, MatchCommandResult, MatchStep } from './match-types';
import type { UnitLocation } from './units';
import type { ConsumableTarget } from './consumable-types';
import { MAX_COMBAT_TICKS } from './combat-types';
import { canonicalContent } from './content';
import * as match from './match';

/** Inputs, never caller-supplied balances or grants. A replay starts at the seed. */
export interface PreparationCommandArguments {
  deployMatchUnit: [string, UnitLocation]; buyUnit: [number, number]; sellUnit: [string];
  setShopLock: [boolean, number]; rerollShop: []; buyXp: []; startMatchCombat: []; stepMatch: [];
  nextRound: [number]; useConsumable: [string, ConsumableTarget]; combineItems: [string, string];
  equipItem: [string, string, number]; selectAnomalyTarget: [string, number, string];
  rerollAnomaly: [string, number]; selectChoice: [string, number, string]; claimG23Reward: [string, string];
}
export type PreparationCommandName = keyof PreparationCommandArguments;
export type PreparationCommand = { [K in PreparationCommandName]: {
  readonly name: K; readonly args: PreparationCommandArguments[K];
  /** Only consecutive combat ticks are compressed; bounded by the combat rule. */
  readonly repeats: number;
} }[PreparationCommandName];
export interface PreparationLedger {
  readonly version: 'preparation-command-ledger-v1';
  readonly commands: readonly PreparationCommand[];
  /** Complete Match-domain history, including initialization and settlement hooks. */
  readonly events: readonly MatchEvent[];
}
export function emptyPreparationLedger(): PreparationLedger {
  return { version: 'preparation-command-ledger-v1', commands: [], events: [] };
}
export function appendPreparationEvents(state: MatchState, events: readonly MatchEvent[]): MatchState {
  if (state.multiplayer) return state;
  const emitted = events.filter(event => !('tick' in event));
  if (!emitted.length) return state;
  return { ...state, preparationLedger: { ...state.preparationLedger,
    events: [...state.preparationLedger.events, ...emitted] } };
}
export function recordPreparationCommand<K extends PreparationCommandName, T extends MatchCommandResult | MatchStep>(
  before: MatchState, result: T, name: K, args: PreparationCommandArguments[K],
): T {
  if (before.multiplayer || result.state === before || 'ok' in result && !result.ok) return result;
  const commands = before.preparationLedger.commands;
  const previous = commands.at(-1);
  const command = { name, args: structuredClone(args), repeats: 1 } as PreparationCommand;
  const next = name === 'stepMatch' && previous?.name === 'stepMatch'
    ? [...commands.slice(0, -1), { ...previous, repeats: previous.repeats + 1 }]
    : [...commands, command];
  return { ...result, state: { ...result.state, preparationLedger: { ...result.state.preparationLedger, commands: next } } };
}
function requireLedger(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(`Invalid Match save: preparation-ledger-${reason}`);
}
/** Exact process-cache reuse is authorized; cold verification still starts at the seed. */
const verifiedPreparations = new VerifiedRestoreCache<MatchState>();
// Exact completed history, not arbitrary prefix reuse. The command key only locates
// an entry; its independently replayed event/result lengths bind the full history.
// The sole boundary is successful nextRound; all preparation/current combat is replayed.
const verifiedHistories = new VerifiedRestoreCache<MatchState>();
export function validatePreparationLedger(state: MatchState): void {
  const key = verifiedRestoreKey(state);
  const verified = verifiedPreparations.get(key);
  if (verified) { comparePreparationState(state, verified); return; }
  const commands = state.preparationLedger?.commands;
  const boundary = Array.isArray(commands) ? commands.reduce((last, command, index) => command?.name === 'nextRound' ? index + 1 : last, -1) : -1;
  const historyKey = boundary >= 0
    ? verifiedRestoreKey({ seed: state.seed, commands: commands.slice(0, boundary) }) : undefined;
  const candidate = historyKey === undefined ? undefined : verifiedHistories.get(historyKey);
  const sameHistory = candidate && candidate.round === state.round
    && Array.isArray(state.preparationLedger.events) && Array.isArray(state.roundResults)
    && canonicalContent(state.preparationLedger.events.slice(0, candidate.preparationLedger.events.length))
      === canonicalContent(candidate.preparationLedger.events)
    && canonicalContent(state.roundResults.slice(0, candidate.roundResults.length))
      === canonicalContent(candidate.roundResults);
  const validate = preparationLedgerValidator(false, sameHistory ? candidate : undefined);
  const rebuilt = validate(state);
  // Only a fully validated candidate admits the independently generated history boundary.
  const history = validate.history(boundary);
  if (historyKey !== undefined && history) verifiedHistories.put(historyKey, history);
  verifiedPreparations.put(key, rebuilt);
}
/** Explicit call-local scope: only states produced here by public commands are reusable.
 * Keep opening boundaries (not every tick) so archived short prefixes remain checkable. */
export interface PreparationBattleProof {
  readonly context: MatchState; readonly initial: NonNullable<MatchState['combat']>;
  readonly events: readonly MatchEvent[]; readonly settledMatch: MatchState;
}
export type PreparationLedgerValidator = ((state: MatchState) => MatchState) & {
  battleProof(context: MatchState, endTick: number): PreparationBattleProof | undefined;
  /** Internal only: a production replay whose complete opening was verified by this session. */
  acceptReplayedBattle(state: MatchState): void;
};
export function createPreparationLedgerValidator(captureBattles = false): PreparationLedgerValidator {
  return preparationLedgerValidator(captureBattles);
}
function preparationLedgerValidator(captureBattles: boolean, trustedHistory?: MatchState) {
  const openings: MatchState[] = trustedHistory ? [trustedHistory] : [];
  let latest: MatchState | undefined = trustedHistory;
  const proofs: PreparationBattleProof[] = [];
  const histories: MatchState[] = trustedHistory ? [trustedHistory] : [];
  const validate = (state: MatchState): MatchState => {
    const ledger = state.preparationLedger;
    requireLedger(ledger && typeof ledger === 'object', 'missing');
    requireLedger(Object.keys(ledger).sort().join('|') === 'commands|events|version'
      && ledger.version === 'preparation-command-ledger-v1'
      && Array.isArray(ledger.commands) && Array.isArray(ledger.events), 'shape');

    const arities: Record<PreparationCommandName, number> = {
      deployMatchUnit: 2, buyUnit: 2, sellUnit: 1, setShopLock: 2, rerollShop: 0, buyXp: 0,
      startMatchCombat: 0, stepMatch: 0, nextRound: 1, useConsumable: 2, combineItems: 2,
      equipItem: 3, selectAnomalyTarget: 3, rerollAnomaly: 2, selectChoice: 3, claimG23Reward: 2,
    };
    for (const command of ledger.commands as readonly PreparationCommand[]) {
      requireLedger(command && Object.keys(command).sort().join('|') === 'args|name|repeats'
        && Object.hasOwn(arities, command.name) && Array.isArray(command.args)
        && command.args.length === arities[command.name], 'command');
      requireLedger(Number.isSafeInteger(command.repeats) && command.repeats >= 1
        && command.repeats <= (command.name === 'stepMatch' ? MAX_COMBAT_TICKS : 1), 'repeat-bound');
    }
    const prefix = (candidate: MatchState) => candidate.seed === state.seed
      && candidate.preparationLedger.commands.length <= ledger.commands.length
      && candidate.preparationLedger.commands.every((command, index) =>
        canonicalContent(command) === canonicalContent(ledger.commands[index]));
    const candidates = latest ? [...openings, latest] : openings;
    let rebuilt = candidates.filter(prefix).sort((a, b) =>
      b.preparationLedger.commands.length - a.preparationLedger.commands.length)[0] ?? match.createMatch(state.seed);
    const offset = rebuilt.preparationLedger.commands.length;
    for (const command of ledger.commands.slice(offset) as readonly PreparationCommand[]) {
      if (command.name === 'startMatchCombat' && !openings.some(value => value === rebuilt)) openings.push(rebuilt);
      for (let count = 0; count < command.repeats; count++) {
        const before = rebuilt;
        let result: MatchCommandResult | MatchStep;
        try {
          // Arity and allowlist are checked before selecting an actual public command.
          const run = match[command.name] as (state: MatchState, ...args: unknown[]) => MatchCommandResult | MatchStep;
          result = run(rebuilt, ...command.args);
        } catch { throw new Error('Invalid Match save: preparation-ledger-command'); }
        if ('ok' in result && !result.ok) throw new Error('Invalid Match save: preparation-ledger-command-rejected');
        requireLedger(result.state !== rebuilt, 'command-noop');
        rebuilt = result.state;
        if (command.name === 'nextRound') histories.push(rebuilt);
        if (captureBattles && command.name === 'startMatchCombat' && rebuilt.combat) {
          proofs.push({ context: before, initial: rebuilt.combat,
            events: result.events.filter(event => event.domain === 'combat'), settledMatch: rebuilt });
        } else if (captureBattles && (command.name === 'stepMatch'
          || before.phase === 'combat' && before.combat !== null && rebuilt.combat === before.combat)) {
          const index = proofs.findIndex(proof => proof.settledMatch === before);
          if (index !== -1) {
            const proof = proofs[index];
            proofs[index] = { ...proof, events: [...proof.events,
              ...result.events.filter(event => event.domain === 'combat')], settledMatch: rebuilt };
          }
        }
      }
    }
    comparePreparationState(state, rebuilt);
    latest = rebuilt;
    return structuredClone(rebuilt);
  };
  return Object.assign(validate, { acceptReplayedBattle(state: MatchState) {
    latest = structuredClone(state);
  }, history(length: number) {
    const state = histories.find(value => value.preparationLedger.commands.length === length);
    return state ? structuredClone(state) : undefined;
  }, battleProof(context: MatchState, endTick: number) {
    const proof = proofs.find(value => value.settledMatch.combat?.tick === endTick
      && value.context.seed === context.seed && value.context.round === context.round
      && canonicalContent(value.context) === canonicalContent(context));
    return proof ? structuredClone(proof) : undefined;
  } });
}

/** Always run on cache hits too: current economics and every ledger projection remain checked. */
export function comparePreparationState(state: MatchState, rebuilt: MatchState): void {
  const ledger = state.preparationLedger;
  const equal = (a: unknown, b: unknown) => a === undefined || b === undefined
    ? a === b : canonicalContent(a) === canonicalContent(b);
  requireLedger(state.gold === rebuilt.gold, 'gold');
  requireLedger(state.level === rebuilt.level && state.xp === rebuilt.xp, 'experience');
  requireLedger(equal(state.shop, rebuilt.shop), 'shop');
  for (const key of ['rngState', 'choiceRngState', 'rewardRngState', 'battleSeedRngState'] as const)
    requireLedger(state[key] === rebuilt[key], `rng-${key}`);
  requireLedger(equal(ledger.events, rebuilt.preparationLedger.events)
    && state.nextMatchEventSeq === rebuilt.nextMatchEventSeq
    && rebuilt.nextMatchEventSeq === rebuilt.preparationLedger.events.length, 'event-history');
  requireLedger(equal(ledger.commands, rebuilt.preparationLedger.commands), 'command-canonical');
  const combatPosition = (match: MatchState) => match.combat === null ? null : {
    combatId: match.combat.combatId, tick: match.combat.tick, status: match.combat.status, result: match.combat.result,
  };
  requireLedger(equal(combatPosition(state), combatPosition(rebuilt)), 'combat-position');
  for (const key of ['round', 'phase', 'roundResults', 'combatInputBasis', 'scheduleReceipts',
    'resourceProvenance', 'preparation', 'items', 'augments', 'anomalyBinding', 'pendingChoice',
    'persistentGrowth', 'augmentProgress', 'nextUnitSerial', 'nextItemSerial', 'playerHp',
    'seatMechanics', 'consumables', 'nextConsumableSerial', 'reforgeState',
    'equipmentState', 'temporaryEquipment', 'm8'] as const)
    requireLedger(equal(state[key], rebuilt[key]), `state-${key}`);
}
