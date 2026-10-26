import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import * as combat from '../src/simulation/combat';
import { BattleHistory, PlaybackSession, validateBattleRecord } from '../src/replay';
import { deepFreeze } from '../src/replay/history';
import { stepCombat, type CombatState, type LedgerCombatEvent } from '../src/simulation/combat';
import { startMatchCombat, stepMatch } from '../src/simulation/match';
import { digestContent } from '../src/simulation/content';
import type { MatchState } from '../src/simulation/match-types';
import type { BattleRecord } from '../src/m6/contracts';
import { goldenStates } from './fixtures/m8-golden-states.cjs';

// The B9 capacity selector's largest v23 battle: real public-route preparation,
// Long Distance Pals + Share Your Energy, 741 ticks and 7240 ledger events.
function fixture(): BattleRecord {
  const before = (goldenStates('sniper') as MatchState[]).find(s => s.round === 32 && s.phase === 'preparation') as MatchState;
  const history = new BattleHistory('performance-sniper'), start = startMatchCombat(before);
  if (!start.ok) throw Error(start.reason);
  let state = start.state;
  history.observe({ before, after: state, events: start.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat'), reason: 'command' });
  while (state.phase === 'combat') {
    const before = state, next = stepMatch(state); state = next.state;
    history.observe({ before, after: state, events: next.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat'), reason: 'tick' });
  }
  return history.completedRecords[0];
}
const bytesHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Reference is the pre-fix path: detached record.initial, then stepCombat and
// exact event checks on every tick, independent of the validation checkpoints.
function reference(record: BattleRecord) {
  let state = structuredClone(record.initial);
  const hashes = new Map<number, string>();
  hashes.set(0, bytesHash(state));
  while (state.tick < record.endTick) {
    const next = stepCombat(state), from = state.nextEventSeq!;
    expect(next.events).toEqual(record.events.slice(from, from + next.events.length));
    state = next.state;
    hashes.set(state.tick, bytesHash(state));
  }
  expect(digestContent(state)).toBe(record.stateHash);
  return { hashes, terminal: state };
}

describe('validated playback checkpoints preserve the unoptimized trajectory', () => {
  it('keeps every frame, terminal, ledger and record byte-identical on the B9 fixture', () => {
    const record = fixture(), originalBytes = JSON.stringify(record), expected = reference(record);
    expect(record.endTick).toBe(741); expect(record.events).toHaveLength(7240);
    // An external JSON record is cold on each constructor, like browser fixtures.
    const imported = JSON.parse(originalBytes) as BattleRecord;
    const playback = new PlaybackSession(imported);
    const stepping = vi.spyOn(combat, 'stepCombat');
    expect(JSON.stringify(playback.seek(record.endTick).combat)).toBe(JSON.stringify(expected.terminal));
    expect(stepping).not.toHaveBeenCalled(); // cold validation already produced this authenticated state
    stepping.mockRestore();
    playback.seek(0); playback.play();
    for (let tick = 0; tick <= record.endTick; tick++) {
      const frame = tick === 0 ? playback.read() : playback.advance(50);
      expect(bytesHash(frame.combat), `frame ${tick}`).toBe(expected.hashes.get(tick));
      expect(frame.nextEventSeq).toBe(frame.combat.nextEventSeq);
    }
    for (const tick of [record.endTick, 40, 39, 41, 0, 280, record.endTick - 1]) {
      const frame = playback.seek(tick);
      expect(bytesHash(frame.combat)).toBe(expected.hashes.get(tick));
      expect(JSON.stringify(frame.events)).toBe(JSON.stringify(record.events.filter(e => e.tick <= tick)));
      expect(Object.isFrozen(frame.combat.units)).toBe(true);
    }
    playback.seek(0); playback.play();
    expect(playback.seek(record.endTick).playing).toBe(false);
    expect(JSON.stringify(imported)).toBe(originalBytes);
    expect(JSON.stringify(record)).toBe(originalBytes);
    expect(digestContent(expected.terminal)).toBe(record.stateHash);
    expect(digestContent(record.events)).toBe(record.eventHash);
    playback.seek(39); playback.play(); playback.setSpeed(4);
    const advanced = playback.advance(50);
    expect(advanced.tick).toBe(43); expect(bytesHash(advanced.combat)).toBe(expected.hashes.get(43));
    // Caller mutations cannot reach the retained proof/checkpoints.
    Object.assign(imported.initial, { tick: 999 });
    Object.assign(imported.events[0], { tick: 999 });
    expect(bytesHash(playback.seek(0).combat)).toBe(expected.hashes.get(0));
    expect(playback.seek(40).events[0].tick).toBe(0);
    playback.dispose();

    // A cached, recorder-owned proof follows the original stepping fallback.
    validateBattleRecord(record);
    const cached = new PlaybackSession(record);
    expect(JSON.stringify(cached.seek(record.endTick).combat)).toBe(JSON.stringify(expected.terminal));
    cached.dispose();
  }, 60_000);

  it('still performs complete event/hash/result validation and never trusts external freezing', () => {
    const record = fixture();
    const forged = structuredClone(record), events = forged.events as LedgerCombatEvent[];
    events[10] = { ...events[10], type: 'forged' } as unknown as LedgerCombatEvent;
    Object.assign(forged, { eventHash: digestContent(events) });
    expect(() => new PlaybackSession(deepFreeze(forged))).toThrow('事件缺失或内容错误');
    expect(() => new PlaybackSession({ ...record, stateHash: 'forged' })).toThrow('内容校验');
    expect(() => new PlaybackSession({ ...record, result: 'draw' })).toThrow('终点结果');
  }, 30_000);

  it('preserves native byte order for a canonically valid reordered opening', () => {
    const record = fixture();
    const initial = Object.fromEntries(Object.entries(record.initial).reverse()) as unknown as CombatState;
    const imported = structuredClone({ ...record, initial });
    const expected = stepCombat(structuredClone(initial)).state;
    const playback = new PlaybackSession(imported);
    expect(JSON.stringify(playback.seek(1).combat)).toBe(JSON.stringify(expected));
    playback.dispose();
  }, 30_000);
});
