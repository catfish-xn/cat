import { describe, expect, it } from 'vitest';
import { readyMatch } from './match-helpers';
import { envelopeWithInCombatEquip } from './m6-import-save-security.test';
import { routeSaveFile, readCompatibility } from '../src/persistence/compatibility';
import { exportFile, validateEnvelope, validateFile } from '../src/persistence/format';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { startMatchCombat, stepMatch } from '../src/simulation/match';
import { M8_VERSION, PRIOR_M8_SAVE_FORMAT_VERSION } from '../src/simulation/m8/version';
import { hasSaveCompressionMarkers } from '../src/persistence/fact-prefix';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import type { MatchState } from '../src/simulation/match-types';
import type { SaveEnvelope } from '../src/m6/contracts';

/** 63372316 routeSaveFile: only save/replay 8 pass the version gate (before compact save 9). */
function v26EarlyRouteReason(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input) || (input as { kind?: unknown }).kind !== 'hex-autobattler-save') return 'invalid-data';
  const file = input as { saveFormatVersion?: unknown; replayFormatVersion?: unknown };
  if (file.saveFormatVersion !== PRIOR_M8_SAVE_FORMAT_VERSION || file.replayFormatVersion !== M8_VERSION.replayFormatVersion) return 'unsupported-version';
  return null;
}

async function compactSaveEnvelope(): Promise<SaveEnvelope> {
  const envelope = envelopeWithInCombatEquip(902431);
  const parsed = JSON.parse(await exportFile(envelope).text()) as SaveEnvelope;
  expect(hasSaveCompressionMarkers(parsed)).toBe(true);
  return parsed;
}

const combat = (events: readonly { domain?: string }[]) => events.filter(e => e.domain === 'combat') as LedgerCombatEvent[];

function finishedEnvelope(): SaveEnvelope {
  const initial = readyMatch(42), history = new BattleHistory('save-format-v9-plain');
  const start = startMatchCombat(initial);
  if (!start.ok) throw Error(start.reason);
  let match: MatchState = start.state;
  history.observe({ before: initial, after: match, events: combat(start.events), reason: 'command' });
  while (match.phase === 'combat' && match.combat!.status === 'running') {
    const before = match, next = stepMatch(match);
    match = next.state;
    history.observe({ before, after: match, events: combat(next.events), reason: 'tick' });
  }
  return {
    kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
    runId: 'save-format-v9-plain', createdAt: '2026-10-10T00:00:00Z', match, battles: history.completedRecords, currentBattle: history.capturePrefix(),
  };
}

describe('save format 9 compact export routing', () => {
  it('63372316 version gate rejects new v9 exports as unsupported-version, not invalid-data', async () => {
    const parsed = await compactSaveEnvelope();
    expect(parsed.saveFormatVersion).toBe(9);
    expect(parsed.replayFormatVersion).toBe(8);
    expect(v26EarlyRouteReason(parsed)).toBe('unsupported-version');
    expect(routeSaveFile(parsed).view).toBeNull();
  });

  it('imports a genuine save 8 non-compressed archive for the current identity', async () => {
    const finished = finishedEnvelope();
    const legacy = JSON.parse(JSON.stringify(finished)) as Omit<SaveEnvelope, 'saveFormatVersion'> & { saveFormatVersion: number };
    legacy.saveFormatVersion = PRIOR_M8_SAVE_FORMAT_VERSION;
    expect(hasSaveCompressionMarkers(legacy)).toBe(false);
    await expect(validateEnvelope(legacy, validateBattleCollection)).resolves.toMatchObject({ saveFormatVersion: PRIOR_M8_SAVE_FORMAT_VERSION });
    expect(readCompatibility(legacy).canResume).toBe(true);
  });

  it('rejects save 8 files that carry compact on-disk markers', async () => {
    const tampered = JSON.parse(JSON.stringify(await compactSaveEnvelope())) as Omit<SaveEnvelope, 'saveFormatVersion'> & { saveFormatVersion: number };
    tampered.saveFormatVersion = PRIOR_M8_SAVE_FORMAT_VERSION;
    expect(routeSaveFile(tampered).view).toMatchObject({ status: 'rejected', reason: 'invalid-data' });
    await expect(validateFile(new Blob([JSON.stringify(tampered)], { type: 'application/json' }), validateBattleCollection))
      .rejects.toThrow('save 8');
  });
});
