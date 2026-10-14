/**
 * M7 G07: files exported by the signed-off M6 code (tests/fixtures/m6-saves, generated once
 * from the 631c131 tree) must still import, continue one legal step and replay.
 */
import { describe, expect, it } from 'vitest';
import { load, manifest as readManifest } from './fixtures/m6-saves/load.cjs';
import { validateEnvelope } from '../src/persistence/format';
import { BattleHistory, PlaybackSession, validateBattleCollection } from '../src/replay';
import { MatchSession } from '../src/rendering/match-session';
import type { SaveEnvelope } from '../src/m6/contracts';

const manifest = readManifest();

describe('M6 save files remain compatible', () => {
  it('covers every required phase', () => {
    expect(new Set(manifest.saves.map(save => save.phase))).toEqual(new Set(['choice', 'preparation', 'combat', 'settlement', 'gameOver']));
  });
  for (const entry of manifest.saves) it(`${entry.file}: import, continue one step, replay`, async () => {
    const envelope: SaveEnvelope = await validateEnvelope(load(entry.file), validateBattleCollection);
    expect(envelope.match.phase).toBe(entry.phase);
    expect(envelope.battles).toHaveLength(entry.battles);
    // Same construction as MatchApplication.replaceCandidate.
    const ledger = envelope.currentBattle?.events ?? envelope.battles.find(record => record.combatId === envelope.match.combat?.combatId)?.events ?? [];
    const session = new MatchSession(envelope.match, ledger);
    const history = new BattleHistory(envelope.runId, envelope.battles, envelope.currentBattle);
    expect(history.completedRecords).toHaveLength(entry.battles);
    const before = structuredClone(session.state);
    const state = session.state;
    if (state.phase === 'choice') {
      const choice = state.pendingChoice!;
      const result = choice.step === 'target'
        ? session.anomalyTarget(choice.choiceId, choice.generation, state.preparation.units.find(unit => unit.team === 'player')!.id)
        : session.choose(choice.choiceId, choice.generation, choice.offers[0]);
      expect(result.ok).toBe(true);
    } else if (state.phase === 'preparation') {
      expect(session.start().ok).toBe(true);
      expect(session.state.phase).not.toBe('preparation');
    } else if (state.phase === 'combat') {
      const tick = state.combat!.tick;
      session.advance(50);
      expect(session.state.combat!.tick).toBe(tick + 1);
      expect(session.combatEvents.length).toBeGreaterThanOrEqual(ledger.length);
    } else if (state.phase === 'settlement') {
      expect(session.continue(state.round).ok).toBe(true);
      expect(session.state.round).toBe(state.round + 1);
    } else {
      expect(session.reroll().ok).toBe(false);
      expect(session.state).toEqual(before);
    }
    const record = envelope.battles[0];
    if (record) {
      const playback = new PlaybackSession(record);
      playback.seek(record.endTick);
      expect(playback.read().tick).toBe(record.endTick);
      expect(playback.read().events).toHaveLength(record.events.length);
      playback.dispose();
    }
    session.dispose();
  }, 120_000);
});
