/** B9 version routing (M8_UI_CONTRACT §6, M8_RULES §10 D2-A): current files are fully validated,
 * M7 format1/schema5 files are recognized for preservation only, everything else is rejected. */
import { describe, expect, it, vi } from 'vitest';
import { load, manifest as readManifest } from './fixtures/m6-saves/load.cjs';
import { readyMatch } from './match-helpers';
import { readCompatibility, routeSaveFile } from '../src/persistence/compatibility';
import { CompatibilityError, validateEnvelope } from '../src/persistence/format';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { MAX_BATTLE_RECORDS, MAX_EVENTS_PER_BATTLE } from '../src/m6/limits';
import { startMatchCombat, stepMatch } from '../src/simulation/match';
import { M8_VERSION } from '../src/simulation/m8/version';
import type { SaveEnvelope } from '../src/m6/contracts';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import type { MatchState } from '../src/simulation/match-types';

const combat = (events: readonly { domain?: string }[]) => events.filter(e => e.domain === 'combat') as LedgerCombatEvent[];
function finishedEnvelope(): SaveEnvelope {
  const initial = readyMatch(42), history = new BattleHistory('compat-run');
  const start = startMatchCombat(initial); if (!start.ok) throw Error(start.reason);
  let match: MatchState = start.state;
  history.observe({ before: initial, after: match, events: combat(start.events), reason: 'command' });
  while (match.phase === 'combat' && match.combat!.status === 'running') {
    const before = match, next = stepMatch(match); match = next.state;
    history.observe({ before, after: match, events: combat(next.events), reason: 'tick' });
  }
  return { kind: 'hex-autobattler-save', saveFormatVersion: 2, replayFormatVersion: 2, runId: 'compat-run', createdAt: '2026-10-10T00:00:00Z',
    match, battles: history.completedRecords, currentBattle: history.capturePrefix() };
}
const fresh = (): SaveEnvelope => ({ kind: 'hex-autobattler-save', saveFormatVersion: 2, replayFormatVersion: 2, runId: 'fresh-run',
  createdAt: '2026-10-10T00:00:00Z', match: readyMatch(42), battles: [], currentBattle: null });
const mutated = (base: SaveEnvelope, change: (file: Record<string, any>) => void) => { const file = structuredClone(base) as Record<string, any>; change(file); return file; };

describe('B9 readCompatibility routing', () => {
  it('a fresh and a finished M8 file are current after full state and history validation', () => {
    const finished = finishedEnvelope();
    expect(finished.battles).toHaveLength(1);
    for (const file of [fresh(), finished]) {
      const before = structuredClone(file);
      expect(readCompatibility(file)).toEqual({ status: 'current', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: M8_VERSION.rulesVersion,
        canResume: true, canReplay: true, canExportOriginal: true, reason: null });
      expect(file).toEqual(before);
    }
  });
  for (const entry of readManifest().saves) it(`${entry.file}: M7 format1/schema5 is legacy-preserved and never reaches restore or history`, async () => {
    const file = load(entry.file), before = structuredClone(file), history = vi.fn();
    expect(readCompatibility(file)).toEqual({ status: 'legacy-preserved', currentRulesVersion: M8_VERSION.rulesVersion, fileRulesVersion: 'm5-14.24b-v1',
      canResume: false, canReplay: false, canExportOriginal: true, reason: 'new-match-required' });
    const error = await validateEnvelope(file, history).catch(e => e);
    expect(error).toBeInstanceOf(CompatibilityError);
    expect((error as CompatibilityError).view.status).toBe('legacy-preserved');
    expect(history).not.toHaveBeenCalled();
    expect(file).toEqual(before);
  });
  it('rejects unknown versions, digest mismatches, capacity overflow and damaged data with the frozen reasons', () => {
    const base = fresh(), finished = finishedEnvelope();
    const reason = (file: unknown) => { const view = readCompatibility(file); expect(view.canResume).toBe(false); expect(view.canReplay).toBe(false); return view.status === 'rejected' ? [view.reason, view.fileRulesVersion, view.canExportOriginal] : view.status; };
    expect(reason(mutated(base, f => { f.saveFormatVersion = 3; }))).toEqual(['unsupported-version', M8_VERSION.rulesVersion, false]);
    expect(reason(mutated(base, f => { f.replayFormatVersion = 1; }))).toEqual(['unsupported-version', M8_VERSION.rulesVersion, false]);
    expect(reason(mutated(base, f => { f.match.schemaVersion = 5; }))).toEqual(['unsupported-version', M8_VERSION.rulesVersion, false]);
    expect(reason(mutated(base, f => { f.match.rulesVersion = 'm9-future'; }))).toEqual(['unsupported-version', 'm9-future', false]);
    // An M7 header inside a format2 wrapper is not an M7 file and is not relabelled.
    expect(reason(mutated(base, f => { f.match.rulesVersion = 'm5-14.24b-v1'; }))).toEqual(['unsupported-version', 'm5-14.24b-v1', false]);
    expect(reason(mutated(base, f => { f.match.contentDigest = 'fnv1a32-utf16:00000000'; }))).toEqual(['digest-mismatch', M8_VERSION.rulesVersion, false]);
    expect(reason(mutated(base, f => { f.battles = Array(MAX_BATTLE_RECORDS + 1).fill({ events: [] }); }))).toEqual(['capacity-exceeded', M8_VERSION.rulesVersion, false]);
    expect(reason(mutated(finished, f => { f.battles[0].events = Array(MAX_EVENTS_PER_BATTLE + 1).fill(0); }))).toEqual(['capacity-exceeded', M8_VERSION.rulesVersion, false]);
    for (const damaged of [null, [], 'save', { ...base, kind: 'other' }, { ...base, extra: 1 }, mutated(base, f => { f.runId = 'bad id'; }),
      mutated(base, f => { f.createdAt = 'never'; }), mutated(base, f => { f.match.gold = -1; }), mutated(finished, f => { f.battles = []; }),
      mutated(finished, f => { f.battles[0].events[0].tick = 999; })]) expect(reason(damaged)[0]).toBe('invalid-data');
    // A recognizable M7 header with a broken wrapper is damaged, not preserved.
    expect(reason(mutated(load(readManifest().saves[0].file) as SaveEnvelope, f => { delete f.currentBattle; }))).toEqual(['invalid-data', 'm5-14.24b-v1', false]);
  });
  it('the async import path gives the same verdict and keeps the history validator behind routing', async () => {
    const history = vi.fn();
    await expect(validateEnvelope(mutated(fresh(), f => { f.match.contentDigest = 'x'; }), history)).rejects.toMatchObject({ view: { status: 'rejected', reason: 'digest-mismatch' } });
    expect(history).not.toHaveBeenCalled();
    const finished = finishedEnvelope();
    await expect(validateEnvelope(finished, validateBattleCollection)).resolves.toEqual(finished);
    await expect(validateEnvelope(mutated(finished, f => { f.battles = []; }), validateBattleCollection)).rejects.toMatchObject({ view: { status: 'rejected', reason: 'invalid-data' } });
    expect(routeSaveFile(fresh()).view).toBeNull();
  });
});
