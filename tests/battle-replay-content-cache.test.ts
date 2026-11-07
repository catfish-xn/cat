import { expect, it } from 'vitest';
import { createMatch, startMatchCombat, stepMatch, type MatchEvent } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import { digestContent } from '../src/simulation/content';
import { coldBattleReplayCount, recordVersion, replayBattleRecord, validateBattlePlayback } from '../src/simulation/battle-record-validation';
import type { BattleRecord } from '../src/m6/contracts';

// One real public 1-2. The unit starts on the board, so the fight is not the empty-board shortcut.
// These seeds are private to this file. vitest isolate:false keeps one content-replay map per
// worker, and another file's seed-42 opening fight already occupies that key. Hitting it makes
// the first call free (delta 0); a same-key different body is not stored and both calls are cold
// (delta 2). Either result depends on who ran first. The cold-count delta is taken around the
// calls in this case, and the record body itself does not collide.
const REUSE_SEED = 902421;
const MISMATCH_SEED = 902422;
const CHECKPOINT_SEED = 902423;
function battle(runId: string, seed: number): BattleRecord {
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
  const record = battle('replay-cache-a', REUSE_SEED);
  const copy = retitled(record, 'replay-cache-b');
  const before = coldBattleReplayCount();
  const first = replayBattleRecord(record);
  expect(coldBattleReplayCount() - before).toBe(1);
  const second = replayBattleRecord(copy);
  expect(coldBattleReplayCount() - before).toBe(1);
  expect(second).toEqual(first);
});

it('replays again when the copied record does not match, even if the hashes were left in place', () => {
  const record = battle('replay-cache-c', MISMATCH_SEED);
  const event = record.events[0];
  if (!event) throw new Error('battle produced no combat events');
  const copy = retitled(record, 'replay-cache-d', record.events.map((item, index) => index === 0 ? { ...item, tick: item.tick + 1 } : item));
  const before = coldBattleReplayCount();
  replayBattleRecord(record);
  expect(() => replayBattleRecord(copy)).toThrow();
  expect(coldBattleReplayCount() - before).toBe(2);
});

it('walks the ticks again when playback asks for checkpoints', () => {
  const record = battle('replay-cache-e', CHECKPOINT_SEED);
  const before = coldBattleReplayCount();
  replayBattleRecord(record);
  const played = validateBattlePlayback(retitled(record, 'replay-cache-f'));
  expect(coldBattleReplayCount() - before).toBe(2);
  expect(played.terminal).toEqual(replayBattleRecord(record).terminal);
  expect(coldBattleReplayCount() - before).toBe(2);
});
