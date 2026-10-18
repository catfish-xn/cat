import ionicRaw from './g2-3-herald-raw/ionic-spark.json?raw';
import evenshroudRaw from './g2-3-herald-raw/evenshroud.json?raw';
import dualRaw from './g2-3-herald-raw/ionic-spark--evenshroud.json?raw';
import quicksilverRaw from './g2-3-herald-raw/quicksilver.json?raw';
import edgeRaw from './g2-3-herald-raw/edge-of-night.json?raw';
import * as api from './recorded-match';
import { restoreWithEvidence as restoreMatch, serializeWithEvidence as serializeMatch, registerHistory, historyFor } from './history-evidence';
import { fieldHeraldTarget, HERALD_RAW_CASES } from './m8-herald-raw/generate';

import { readRecordedFixture } from './recorded-fixture';
const route = readRecordedFixture<{ preparations: Record<string, api.MatchState>; equipmentFork: api.MatchState; battles: import('../../src/m6/contracts').BattleRecord[] }>('neutral');
const preparations = new Map(Object.entries(route.preparations));
const equipmentFork = route.equipmentFork;
function publish(state: api.MatchState): void {
  registerHistory(state, route.battles.filter(record => record.context.round < state.round));
}
/** Each consumer receives a provenance-complete, restored independent prefix. */
export function publicNeutralPreparation(roundId: string): api.MatchState {
  const state = preparations.get(roundId);
  if (!state) throw new Error(`Missing public route preparation: ${roundId}`);
  publish(state);
  return restoreMatch(serializeMatch(state));
}

/** A genuine unresolved 4-4 supply choice, before reserving any late items. */
export function publicNeutralEquipmentChoice(): api.MatchState {
  if (!equipmentFork) throw new Error('Missing public 4-4 equipment prefix');
  publish(equipmentFork);
  return restoreMatch(serializeMatch(equipmentFork));
}

/** The unmodified live public target route remains in use outside five raw-save cases. */
export function publicHeraldTarget(initial = publicNeutralPreparation('6-7')): api.MatchState {
  return fieldHeraldTarget(initial);
}

const equipmentPreparations = new Map<string, api.MatchState>();
/** Load raw branches recorded by the unchanged command-only builder.
 * The source verifier independently regenerates them before importing serialization. */
export function registerHeraldHistory(definitions: readonly string[]): api.MatchState {
  const key = JSON.stringify(definitions);
  if (!equipmentPreparations.has(key)) {
    const entry = HERALD_RAW_CASES.find(entry => JSON.stringify(entry.definitions) === key);
    if (!entry) throw new Error('No recorded Herald equipment branch');
    const fixture = readRecordedFixture<{ state: api.MatchState; battles: import('../../src/m6/contracts').BattleRecord[] }>(`herald-${entry.name}`);
    registerHistory(fixture.state, fixture.battles);
    equipmentPreparations.set(key, fixture.state);
  }
  const prepared=equipmentPreparations.get(key)!;
  registerHistory(prepared,historyFor(prepared));
  return prepared;
}
export function publicHeraldEquipment(definitions: readonly string[]): api.MatchState {
  if (!definitions.length) return publicHeraldTarget();
  return restoreMatch(serializeMatch(registerHeraldHistory(definitions)));
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
