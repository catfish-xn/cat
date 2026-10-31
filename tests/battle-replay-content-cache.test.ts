import { expect, it } from 'vitest';
import { createMatch, startMatchCombat, stepMatch, type MatchEvent } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import { digestContent } from '../src/simulation/content';
import { coldBattleReplayCount, recordVersion, replayBattleRecord, validateBattlePlayback } from '../src/simulation/battle-record-validation';
import type { BattleRecord } from '../src/m6/contracts';

// One real public 1-2. The unit starts on the board, so the fight is not the empty-board shortcut.
function battle(runId: string, seed = 42): BattleRecord {
  const context = createMatch(seed);
  const started = startMatchCombat(context);
  if (!started.ok || !started.state.combat) throw new Error(started.ok ? 'no combat' : started.reason);
  let state: MatchState = started.state;
  const initial = state.combat;
  const events: MatchEvent[] = [...started.events];
  while (state.phase === 'combat') {
    const step = stepMatch(state);
    state = step.state;
    events.push(...step.events);
  }
  const terminal = state.combat;
  if (!terminal || !initial || !terminal.combatId || terminal.nextEventSeq === undefined) throw new Error('missing combat');
  const ledger = events.filter((event): event is BattleRecord['events'][number] => event.domain === 'combat');
  return {
    version: recordVersion(context), roundId: context.m8.round.roundId, runId, combatId: terminal.combatId,
    context, initial, events: ledger, endTick: terminal.tick, nextEventSeq: terminal.nextEventSeq,
    result: terminal.result, stateHash: digestContent(terminal), eventHash: digestContent(ledger),
  };
}

function retitled(record: BattleRecord, runId: string, events: BattleRecord['events'] = record.events): BattleRecord {
  return { ...structuredClone(record), runId, events };
}

it('reuses one verified replay for an equal unowned record with a different run id', () => {
  const record = battle('replay-cache-a');
  const copy = retitled(record, 'replay-cache-b');
  const before = coldBattleReplayCount();
  const first = replayBattleRecord(record);
  const second = replayBattleRecord(copy);
  expect(coldBattleReplayCount() - before).toBe(1);
  expect(second).toEqual(first);
});

it('replays again when the copied record does not match, even if the hashes were left in place', () => {
  const record = battle('replay-cache-c', 43);
  const event = record.events[0];
  if (!event) throw new Error('battle produced no combat events');
  const copy = retitled(record, 'replay-cache-d', record.events.map((item, index) => index === 0 ? { ...item, tick: item.tick + 1 } : item));
  const before = coldBattleReplayCount();
  replayBattleRecord(record);
  expect(() => replayBattleRecord(copy)).toThrow();
  expect(coldBattleReplayCount() - before).toBe(2);
});

it('walks the ticks again when playback asks for checkpoints', () => {
  const record = battle('replay-cache-e', 44);
  const before = coldBattleReplayCount();
  replayBattleRecord(record);
  const played = validateBattlePlayback(retitled(record, 'replay-cache-f'));
  expect(coldBattleReplayCount() - before).toBe(2);
  expect(played.terminal).toEqual(replayBattleRecord(record).terminal);
  expect(coldBattleReplayCount() - before).toBe(2);
});
