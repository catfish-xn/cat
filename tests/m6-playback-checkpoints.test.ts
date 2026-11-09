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

// The B9 capacity selector uses v26's recorded public-route preparation (round 32 of the
// sniper golden, re-recorded by edaa63dd after the D5 2-1 reroll; was v25's 684 ticks /
// 6760 events; 610 ticks / 4729 events before #509). Native stepping yields 602 ticks and 4493 ledger events; its terminal must also
// equal the recorded v26 settlement. The v24 method is documented in
// docs/CI_V24_INTEGRATION_FIX.md.
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
    // This terminal was already recorded in the v26 public-route fixture.
    const archivedTerminal = (goldenStates('sniper') as MatchState[]).find(s => s.round === 32 && s.phase === 'settlement')!.combat;
    expect(expected.terminal).toEqual(archivedTerminal);
    expect(record.endTick).toBe(602); expect(record.events).toHaveLength(4493);
    // Independent native stepping of the v26 input: pin all 603 native frame byte
    // hashes, not just a reference that calls the same optimized step function.
    // v26 re-pin (edaa63dd sniper golden; v25 values: frames cf8c0c91…, record 64fb5f0a…,
    // events c619dab8…, terminal c4c0d27c…, see docs/V25_STARRY_PINS.md).
    // #509 re-pin: dead units stop holding melee attack hexes and walled-off melee retargets, so the B9
    // trajectory changed (was frames 12d0a6ab…, record e5f71f49…, events d060a74f…, terminal 8c601683…).
    expect(bytesHash([...expected.hashes])).toBe('f829909b825f48471b9ffa771c2a52725c50315619f92143d38d7605b7943821');
    // v26 卯足全力内容变化: content digest 9dc693dd → ed366cad in the record only (frames/events/terminal unchanged; was ccaed15a…).
    // v26 选秀 8 件散件必出: content digest ed366cad → 150d825d in the record only (frames/events/terminal unchanged; was b8cf8acd…).
    // 塞维卡三连/头奖 (2026-11-09): content digest 150d825d → c7f0a2f3 and loot a56b2c4a → b53841c0 in the record only (frames/events/terminal unchanged; was edfa8dc9…).
    // 塞维卡老虎机转完再出手 (2026-11-09): c7f0a2f3 → f37c6970 and loot b53841c0 → 9c98c8ef in the record only (was b73401ac…).
    const newer = JSON.stringify(record).split('f37c6970').join('c7f0a2f3').split('9c98c8ef').join('b53841c0');
    expect(bytesHash(JSON.parse(newer))).toBe('b73401accdc212c638a52b6144b26069263254e9687d53c8648823599868efda');
    const back = newer.split('c7f0a2f3').join('150d825d').split('b53841c0').join('a56b2c4a');
    expect(bytesHash(JSON.parse(back.split('150d825d').join('ed366cad')))).toBe('b8cf8acdbe9f19fa36ba427146c5bd776af97b42415717f82fd5770b69ea5389');
    expect(bytesHash(JSON.parse(back))).toBe('edfa8dc9731e2f878ffa22c1392acbdc03da0c3e526cd2907043751f9901f3fd');
    expect(bytesHash(record)).toBe('a11426bb1405f768be4c6754e97160d726e77303aab1162f9066cb5f4d504b0c');
    expect(bytesHash(record.events)).toBe('26280de8df6c851839c04015c748150e84a2c9efc28b1014ad0f5f774e37d683');
    expect(bytesHash(expected.terminal)).toBe('004d6c06b1d5f8491412f5a2ee55a64a4c9d2f2ba5d5da31faa003527d72ff23');
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
    // v26 fixture (edaa63dd): this round-32 board holds the Protective Shielding anomaly, whose
    // combat-start shields are emitted by the first step but labelled tick 0 ("initial programs finish
    // at tick 0", combat-s13.ts). The tick-0 frame is the pre-step state, so its ledger is the opening
    // prefix; the remaining tick-0 events must be exactly the first step's tick-0 events.
    const opening = record.initial.nextEventSeq!;
    expect(record.events.filter(e => e.tick === 0).slice(opening))
      .toEqual(stepCombat(structuredClone(record.initial)).events.filter(e => e.tick === 0));
    for (const tick of [record.endTick, 40, 39, 41, 0, 280, record.endTick - 1]) {
      const frame = playback.seek(tick);
      expect(bytesHash(frame.combat)).toBe(expected.hashes.get(tick));
      expect(JSON.stringify(frame.events)).toBe(JSON.stringify(tick === 0 ? record.events.slice(0, opening) : record.events.filter(e => e.tick <= tick)));
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
