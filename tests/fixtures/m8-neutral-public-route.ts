import ionicRaw from './v22-online-rules-herald-raw/ionic-spark.json?raw';
import evenshroudRaw from './v22-online-rules-herald-raw/evenshroud.json?raw';
import dualRaw from './v22-online-rules-herald-raw/ionic-spark--evenshroud.json?raw';
import quicksilverRaw from './v22-online-rules-herald-raw/quicksilver.json?raw';
import edgeRaw from './v22-online-rules-herald-raw/edge-of-night.json?raw';
import * as api from '../../src/simulation/match';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { buildRawHeraldEquipment, fieldHeraldTarget, HERALD_RAW_CASES } from './v22-online-rules-herald-support/generate';
import { run } from '../../scripts/generate-m5-route.cjs';

const preparations = new Map<string, api.MatchState>();
let equipmentFork: api.MatchState | undefined;
// Execute the command-only driver once, retaining only the actual preparation
// prefixes. No golden, injected result, resource, birth, star or receipt is used.
// Generate once per test module; consumers restore independent graphs before use.
const route = await run(api, { build: 'sniper', seed: 42,  onStep(before, result, command) {
  if (command?.type === 'start' || command?.type === 'continue' && before.m8.round.kind === 'supply')
    preparations.set(before.roundDefinitionId, before);
  if (before.roundDefinitionId === '4-4' && before.phase === 'choice') equipmentFork ??= before;
  if (result.state.phase === 'preparation') preparations.set(result.state.roundDefinitionId, result.state);
} });
if (route.final.phase !== 'gameOver' || route.final.roundDefinitionId !== '6-7' || route.final.outcome !== 'victory')
  throw new Error('Public neutral fixture did not complete the actual 33-battle route');

// v22: seed 42 drew the scuttle-crab opening (v23 fmix32: golden-gala), which replaced every authored PvE encounter with crabs.
// Consumers that exercise the authored minion/monster encounters take prefixes from this second
// command-only route; seed 7298 has no opening encounter under the v23 fmix32 selection (v22 used 7296;
// 1-2 is Irelia against minions-a-v1).
const AUTHORED_ENCOUNTER_SEED = 7298;
const authoredPreparations = new Map<string, api.MatchState>();
await run(api, { build: 'sniper', seed: AUTHORED_ENCOUNTER_SEED, onStep(before, result, command) {
  if (command?.type === 'start' || command?.type === 'continue' && before.m8.round.kind === 'supply')
    authoredPreparations.set(before.roundDefinitionId, before);
  if (result.state.phase === 'preparation') authoredPreparations.set(result.state.roundDefinitionId, result.state);
} });

/** A restored prefix of the crab-free route, for authored PvE encounter checks. */
export function publicAuthoredPreparation(roundId: string): api.MatchState {
  const state = authoredPreparations.get(roundId);
  if (!state) throw new Error(`Missing authored-encounter route preparation: ${roundId}`);
  if (state.openingEncounter && 'mode' in state.openingEncounter && state.openingEncounter.mode === 'solo'
    && state.openingEncounter.context.selection.encounterId !== 'none') throw new Error('Authored-encounter route drew an opening encounter');
  return restoreMatch(serializeMatch(state));
}

/** Each consumer receives a provenance-complete, restored independent prefix. */
export function publicNeutralPreparation(roundId: string): api.MatchState {
  const state = preparations.get(roundId);
  if (!state) throw new Error(`Missing public route preparation: ${roundId}`);
  return restoreMatch(serializeMatch(state));
}

/** A genuine unresolved 4-4 supply choice, before reserving any late items. */
export function publicNeutralEquipmentChoice(): api.MatchState {
  if (!equipmentFork) throw new Error('Missing public 4-4 equipment prefix');
  return restoreMatch(serializeMatch(equipmentFork));
}

/** The unmodified live public target route remains in use outside five raw-save cases. */
export function publicHeraldTarget(initial = publicNeutralPreparation('6-7')): api.MatchState {
  return fieldHeraldTarget(initial);
}

const equipmentPreparations = new Map<string, api.MatchState>();
/** Retain the live command-only builder. The independent source verifier uses
 * its raw counterpart before importing the production serialization module. */
export function publicHeraldEquipment(definitions: readonly string[]): api.MatchState {
  if (!definitions.length) return publicHeraldTarget();
  const key = JSON.stringify(definitions);
  if (!equipmentPreparations.has(key))
    equipmentPreparations.set(key, buildRawHeraldEquipment(publicNeutralEquipmentChoice(), definitions, undefined, true));
  return restoreMatch(serializeMatch(equipmentPreparations.get(key)!));
}

const heraldRawText: Readonly<Record<string, string>> = {
  'ionic-spark': ionicRaw, evenshroud: evenshroudRaw, 'ionic-spark--evenshroud': dualRaw,
  quicksilver: quicksilverRaw, 'edge-of-night': edgeRaw,
};
/** Parse afresh inside the calling test's timer. This returns untrusted
 * raw input, never a cached restored graph. Only the five approved cases exist. */
export function publicHeraldRawInput(definitions: readonly string[]): unknown {
  const entry = HERALD_RAW_CASES.find(entry => JSON.stringify(entry.definitions) === JSON.stringify(definitions));
  if (!entry) throw new Error('No approved raw Herald fixture for requested equipment');
  return JSON.parse(heraldRawText[entry.name]);
}
