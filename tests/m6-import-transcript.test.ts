import { describe, expect, it } from 'vitest';
import { M8_VERSION } from '../src/simulation/m8/version';
import { createMatch, nextRound, rerollAugment, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';
import type { BattleRecord, SaveEnvelope } from '../src/m6/contracts';
import { BattleHistory, validateBattleCollection } from '../src/replay';
import { exportFile, validateFile } from '../src/persistence/format';
import { coldBattleReplayCount, transcriptBattleReuseCount } from '../src/simulation/battle-record-validation';
import { augmentHistoryReplaySteps } from '../src/simulation/augment-history-restore';
import { validateMatchStructure } from '../src/simulation/serialization-structure';
import { augmentNeedsHistory } from '../src/simulation/augment-history-owners';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { accepted, resolveM5Choices } from './match-helpers';

function envelopeOf(seed: number): SaveEnvelope {
  const runId = `transcript-${seed}`;
  const history = new BattleHistory(runId);
  let match = createMatch(seed);
  const combatEvents = (events: readonly { domain?: string }[]) => events.filter((event): event is LedgerCombatEvent => event.domain === 'combat');
  const resolve = (state: MatchState) => {
    let guard = 0;
    while (state.phase === 'choice' && guard++ < 12) {
      const choice = state.pendingChoice;
      if (choice?.kind === 'augment') {
        const owned = choice.offers.find(id => augmentNeedsHistory(id));
        if (owned) { state = accepted(selectChoice(state, choice.choiceId, choice.generation, owned)); continue; }
        const slot = choice.rerolledSlots?.findIndex(used => !used) ?? -1;
        if (slot >= 0) { state = accepted(rerollAugment(state, choice.choiceId, choice.generation, slot)); continue; }
      }
      state = resolveM5Choices(state);
    }
    return state;
  };
  const stop = getCatalogRoundById('4-2').ordinal;
  for (let guard = 0; guard < 80 && match.round <= stop && (!match.augmentHistory || history.completedRecords.length < 1); guard++) {
    if (match.phase === 'gameOver') break;
    if (match.phase === 'choice') { match = resolve(match); continue; }
    if (match.phase === 'settlement') {
      const before = match;
      const advanced = nextRound(match, match.round);
      if (!advanced.ok) break;
      match = advanced.state;
      history.observe({ before, after: match, events: combatEvents(advanced.events), reason: 'command' });
      continue;
    }
    if (match.phase !== 'preparation') break;
    const before = match;
    const started = startMatchCombat(match);
    if (!started.ok) break;
    match = started.state;
    history.observe({ before, after: match, events: combatEvents(started.events), reason: 'command' });
    while (match.phase === 'combat') {
      const tickBefore = match;
      const stepped = stepMatch(match);
      match = stepped.state;
      history.observe({ before: tickBefore, after: match, events: combatEvents(stepped.events), reason: 'tick' });
    }
  }
  if (!match.augmentHistory || history.completedRecords.length < 1) {
    throw new Error(`seed ${seed} stopped at ${match.roundDefinitionId}/${match.phase} battles=${history.completedRecords.length} history=${Boolean(match.augmentHistory)}`);
  }
  return {
    kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion,
    runId, createdAt: '2026-10-06T00:00:00.000Z', match, battles: history.completedRecords, currentBattle: null,
  };
}

describe('import reuses the match-proof combat replay', () => {
  it('does not simulate battles whose commands the match proof already ran', async () => {
    const envelope = envelopeOf(902431);
    const cold = coldBattleReplayCount();
    const reused = transcriptBattleReuseCount();
    const admitted = await validateFile(exportFile(envelope), validateBattleCollection);
    expect(admitted.battles).toHaveLength(envelope.battles.length);
    expect(transcriptBattleReuseCount() - reused).toBe(envelope.battles.length);
    expect(coldBattleReplayCount() - cold).toBe(0);
  });

  it('still rejects a battle whose events disagree with that proof', async () => {
    const envelope = envelopeOf(902432);
    const record = envelope.battles[0];
    const tampered: BattleRecord = { ...record, eventHash: `${record.eventHash}ff` };
    const cold = coldBattleReplayCount();
    const reused = transcriptBattleReuseCount();
    await expect(validateFile(exportFile({ ...envelope, battles: [tampered, ...envelope.battles.slice(1)] }), validateBattleCollection)).rejects.toThrow();
    expect(transcriptBattleReuseCount()).toBe(reused);
    expect(coldBattleReplayCount() - cold).toBeGreaterThan(0);
  });

  it('does not trust a transcript when the record carries combat equipment commands', async () => {
    const envelope = envelopeOf(902433);
    const record = envelope.battles[0];
    const forged: BattleRecord = { ...record, equipmentCommands: [{ tick: 0, itemId: 'missing-item', unitId: 'missing-unit', slot: 0 }] };
    const reused = transcriptBattleReuseCount();
    await expect(validateFile(exportFile({ ...envelope, battles: [forged, ...envelope.battles.slice(1)] }), validateBattleCollection)).rejects.toThrow();
    expect(transcriptBattleReuseCount()).toBe(reused);
  });

  it('keeps each battle context prefix so playback does not replay the match', async () => {
    const envelope = envelopeOf(902435);
    const admitted = await validateFile(exportFile(envelope), validateBattleCollection);
    const steps = augmentHistoryReplaySteps();
    for (const record of admitted.battles) validateMatchStructure(record.context);
    expect(augmentHistoryReplaySteps()).toBe(steps);
  });

  it('simulates when the caller did not open the match-proof capture', async () => {
    const envelope = envelopeOf(902434);
    const cold = coldBattleReplayCount();
    const reused = transcriptBattleReuseCount();
    await expect(validateBattleCollection(envelope)).resolves.toBeUndefined();
    expect(transcriptBattleReuseCount()).toBe(reused);
    expect(coldBattleReplayCount() - cold).toBe(envelope.battles.length);
  });
});
