import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { g23Laboratories } from '../src/simulation/g2-3-experiment';
import { G2_ABILITY_DATA } from '../src/simulation/content/g2-abilities';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { admitArchives } from '../src/replay';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { M8_VERSION } from '../src/simulation/m8/version';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import { readyMatch } from './match-helpers';

// Twitch's Experiment bonus (user 11-25, decision card: "only Twitch's value"): every few attacks his Experiment team hits the
// nearest enemy for a share of its max HP. The share now comes from the 14.24 client data (Twitch's ability, its experiment
// variable, the same at every star) instead of the agreed guide-site value; the attack count and everything else are unchanged.
const share = Math.round(G2_ABILITY_DATA['twitch-ability']!.variables.ExperimentMaxHealthDamage![0]! * 10000);
function experimentWithTwitch(): MatchState {
  const s = createMatch(42), labs = g23Laboratories(42, 'player', 3);
  const natives = Object.values(UNIT_DEFINITIONS).filter(d => d.traits.includes('experiment') && SHOP_CATALOG.includes(d.id) && d.id !== 'twitch').map(d => d.id).sort();
  const used = new Set(labs.map(c => `${c.col}:${c.row}`));
  const free = Array.from({ length: 28 }, (_, i) => ({ col: i % 7, row: 4 + Math.floor(i / 7) })).filter(c => !used.has(`${c.col}:${c.row}`));
  const units: Unit[] = [
    { id: 'tw', definitionId: 'twitch', team: 'player', starLevel: 1, location: { kind: 'board', cell: labs[0]! } },
    { id: 'n1', definitionId: natives[0]!, team: 'player', starLevel: 1, location: { kind: 'board', cell: labs[1]! } },
    { id: 'n2', definitionId: natives[1]!, team: 'player', starLevel: 1, location: { kind: 'board', cell: free[0]! } },
    { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 6, row: 0 } } },
  ];
  return { ...s, preparation: { ...s.preparation, units } } as MatchState;
}

describe('Twitch Experiment bonus share', () => {
  it('a unit on a Laboratory carries the max-HP share taken from the client data', () => {
    expect(new Set(G2_ABILITY_DATA['twitch-ability']!.variables.ExperimentMaxHealthDamage).size).toBe(1); // the same at every star
    const s = experimentWithTwitch();
    const combat = createCombatWithEvents(s.preparation, buildStrategySnapshot(s), 'tw-ex', 42).state;
    const carried = combat.units.flatMap(u => (u.mechanics ?? []).filter(m => m.mechanic === 'g23Experiment').map(m => m.values.twitch));
    expect(carried.length).toBeGreaterThan(0);
    expect(new Set(carried)).toEqual(new Set([share]));
  });
});

// The share changes battle results, so its rule identifier is part of the content digest: a save written under the digest just
// before it (Smeech's re-leap) is turned away as another version, never replayed under the new rule.
const BEFORE_DIGEST = 'fnv1a32-utf16:8ba38fcc';
describe('Twitch Experiment share: files written before it', () => {
  it('the rule has its own identifier and the digest moved', () => {
    expect(S13_COMBAT_RULES.twitchExperimentShare).toBe('twitch-experiment-max-hp-share-from-client-data-v1');
    expect(CONTENT_DIGEST).not.toBe(BEFORE_DIGEST);
  });
  it('a save carrying the earlier digest is rejected as another version, cannot resume or replay, and its archive is quarantined', () => {
    const file = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
      runId: 'before-twitch-experiment', createdAt: '2026-11-28T00:00:00Z', match: { ...readyMatch(42), contentDigest: BEFORE_DIGEST }, battles: [], currentBattle: null };
    expect(readCompatibility(file)).toEqual({ status: 'rejected', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
      canResume: false, canReplay: false, canExportOriginal: false, reason: 'digest-mismatch' });
    expect(routeSaveFile(file).envelope).toBeNull();
    const admission = admitArchives([file], routeSaveFile);
    expect(admission.records).toEqual([]);
    expect(admission.quarantined.map(q => q.runId)).toEqual(['before-twitch-experiment']);
    const state = JSON.parse(serializeMatch(readyMatch(42)));
    expect(() => restoreMatch(JSON.stringify({ ...state, contentDigest: BEFORE_DIGEST }))).toThrow('content-digest');
  });
});
