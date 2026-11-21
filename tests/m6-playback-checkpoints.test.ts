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
    // #690 (2026-11-16): 4 abilityEffectEnded display events (Vander's brace ends) join the ledger: 4493 -> 4497.
    // #693 (2026-11-16): Zyra's vines land CAST_WINDUP_TICKS after her cast, so the fight runs differently from her first cast
    // on: 4497 -> 4499 events.
    // #739 re-pin (ranged basic attacks settle when the shot lands, as #693): the same preparation (round 32 of the sniper
    // golden, byte-identical) forks at tick 1, where the enemy Lux launches the first ranged shot (it lands at tick 5). Frames
    // and ledger before the fork are byte-identical to the previous trajectory (hashes below, taken from it); from the fork on
    // the fight runs differently: 602 -> 669 ticks, 4499 -> 5422 events (attackLaunched/attackLanded display events included),
    // and 3 Vander brace ends instead of 4. Were (zyra chain) bb37fca6…, 6fd1e5a6…; frames fe8c3d4d…; #690 chain 3c23e8e6…,
    // 11bcd0ff…, 5c334b61…, 588e92b3…, 0b44dbf3…, d123865e…; record bf2635be…, events 2eba6280…, terminal de60ac0e….
    const fork = record.events.find(e => e.type === 'attackLaunched')!.tick;
    expect(fork).toBe(1);
    expect(bytesHash([...expected.hashes].filter(([tick]) => tick < fork))).toBe('a3263291da8568758c0ebd15bf2ed03df524715c25456defc6e933d11e005b86');
    expect(bytesHash(record.events.filter(e => e.tick < fork))).toBe('bea88f0b6a93c12e90c48f3a27b72e0b88e3c65b5db1d251c46fd8bc3d8644e5');
    // Landing batch (re-recorded on a3d6db81): the B9 battle now ends on 657 with 5235 events.
    expect(record.endTick).toBe(657); expect(record.events).toHaveLength(5235); // was 669 and 5422 events
    // Independent native stepping of the v26 input: pin all 603 native frame byte
    // hashes, not just a reference that calls the same optimized step function.
    // v26 re-pin (edaa63dd sniper golden; v25 values: frames cf8c0c91…, record 64fb5f0a…,
    // events c619dab8…, terminal c4c0d27c…, see docs/V25_STARRY_PINS.md).
    // #509 re-pin: dead units stop holding melee attack hexes and walled-off melee retargets, so the B9
    // trajectory changed (was frames 12d0a6ab…, record e5f71f49…, events d060a74f…, terminal 8c601683…).
    // #690 re-pin (2026-11-16): the abilityEffectEnded display events shift every later eventSeq (the state's nextEventSeq
    // and openingDeaths[].eventSeq, the ledger's eventSeq), so frames/record/events/terminal move (was frames f829909b…,
    // record 5dbcbbf5…, events ce06c357…, terminal 004d6c06…). Taking those events out and renumbering every eventSeq and
    // nextEventSeq gives back the previous frames, events and terminal exactly (asserted below).
    // #693 re-pin (2026-11-16, as #509): Zyra's wind-up changes the trajectory from her first cast (was frames 65d2768b…,
    // record b8985888…, events a0dc4509…, terminal 22ed8d9b…; the #690 chain below was ce06c357…, f829909b…, 004d6c06…,
    // cfbb7c9a…, 3386bb98…, 0f637a24…). Up to that cast nothing moved: the frames and ledger before it are byte-identical to
    // #690's (hashes taken from #690's trajectory), and the first cast after them is Zyra's.
    // Landing batch re-pin (2026-11-20, B9 re-recorded on a3d6db81): Darius/Lux/Maddie/Heimerdinger/Mordekaiser now settle on
    // landing, and some of them cast before Zyra here, so every hash of this chain moves, including the frames and ledger
    // before her cast; Zyra's cast tick, the abilityEffectEnded count and every check's structure are unchanged. Were
    // e1a141f2… 62a36320… bac1cf5a… 0904aaee… fc924c0c… dc3fb397… c274a68d… 870a558c… c6f3f0bf… 7779cbcf… fef4eeab… 075622f0….
    const zyraCast = record.events.find(e => e.type === 'cast' && e.receipt.source.definitionId === 'zyra-ability')!.tick;
    expect(zyraCast).toBe(118);
    expect(bytesHash([...expected.hashes].filter(([tick]) => tick < zyraCast))).toBe('2df4d50622a59bb93ca8ab86401cb2aeef79236ea76e89b34339da2754023038');
    expect(bytesHash(record.events.filter(e => e.tick < zyraCast))).toBe('6162d58b4ea7733113783dd4ebd5c99348bdd77aa478775051331a058720e66f');
    expect(bytesHash([...expected.hashes])).toBe('19d2537c6101c59fd985383a1b099babd965b0840d08225995b8c8f80bf1d7bd');
    const ended = record.events.filter(e => e.type === 'abilityEffectEnded');
    expect(ended).toHaveLength(3); // #739: was 4 (see above)
    const shift = (seq: number) => ended.filter(e => e.eventSeq! < seq).length;
    const renumber = (value: any): any => Array.isArray(value) ? value.map(renumber) : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([key, x]) => [key, (key === 'eventSeq' || key === 'nextEventSeq') && typeof x === 'number' ? x - shift(x) : renumber(x)]))
      : value;
    const before690Events = record.events.filter(e => e.type !== 'abilityEffectEnded').map(renumber);
    expect(bytesHash(before690Events)).toBe('bfae10b446d1da60dfd373bf7ded58d55c090893773239fe7581cd7629b33222');
    let replayed = structuredClone(record.initial); const before690Frames: [number, string][] = [[0, bytesHash(renumber(replayed))]];
    while (replayed.tick < record.endTick) { replayed = stepCombat(replayed).state; before690Frames.push([replayed.tick, bytesHash(renumber(replayed))]); }
    expect(bytesHash(before690Frames)).toBe('686389736962e046f29327e76a5495603bf6a314421e2e7a0e7980edfadc5cb6');
    expect(bytesHash(renumber(expected.terminal))).toBe('a21b0ae786f2887992a87a38cd8fa7a3a768bd7a32d80f430050ba003aae8205');
    // The record with #690 undone (its own ledger and nextEventSeq only; record.context belongs to earlier combats).
    const before690 = { ...record, events: before690Events, nextEventSeq: record.nextEventSeq - ended.length,
      eventHash: digestContent(before690Events), stateHash: digestContent(renumber(expected.terminal)) };
    // v26 卯足全力内容变化: content digest 9dc693dd → ed366cad in the record only (frames/events/terminal unchanged; was ccaed15a…).
    // v26 选秀 8 件散件必出: content digest ed366cad → 150d825d in the record only (frames/events/terminal unchanged; was b8cf8acd…).
    // 塞维卡三连/头奖 (2026-11-09): content digest 150d825d → c7f0a2f3 and loot a56b2c4a → b53841c0 in the record only (frames/events/terminal unchanged; was edfa8dc9…).
    // 塞维卡老虎机转完再出手 (2026-11-09): c7f0a2f3 → f37c6970 and loot b53841c0 → 9c98c8ef in the record only (was b73401ac…).
    // 14.24b 七项英雄数值 (2026-11-12): f37c6970 → db6dc9b6 in the record only; loot replay unchanged (was a11426bb…).
    // 回放格式 8→9 (2026-11-12, #628): db6dc9b6 → d94c78f1, version.replayFormatVersion 8 → 9, and every cast event gains
    // castIndex (branch for Jinx/Cassiopeia/Mel/Ambessa), which moves eventHash. Undo exactly those to reach the previous pins.
    const castFields = (_k: string, v: any) => v && typeof v === 'object' && !Array.isArray(v) && 'actionSeq' in v && 'targetIds' in v && 'completed' in v
      ? Object.fromEntries(Object.entries(v).filter(([key]) => key !== 'castIndex' && key !== 'branch')) : v;
    // #690 re-pin of this chain (2026-11-16, review option A, as #509 did here): it now starts from the record with #690
    // undone. Its three pins moved because the sniper golden was re-recorded in #690's epoch and record.context (round 32's
    // preparation, built from earlier combats that also gained abilityEffectEnded events) drifted with it, e.g.
    // roundResults[3].combatEventCount 877 -> 881 and earnedEvidence death.eventSeq. Were b73401ac…, b8cf8acd…, edfa8dc9….
    // Wind-up batch 2 re-pin of this chain (2026-11-16, as #690/#693): B9 itself fields none of batch 2's heroes, so its frames,
    // ledger and terminal are unchanged; the chain's pins and the record moved with record.context (round 32's preparation, built
    // from earlier combats where Tristana, Smeech, Dr. Mundo or Nunu fought). Were 107d51c6…, 9332c2b3…, 4a40a89b…, 5fcc287a….
    const before628 = JSON.parse(JSON.stringify(before690, castFields));
    before628.version = { ...before628.version, replayFormatVersion: 8 }; before628.eventHash = digestContent(before628.events);
    // #739 save/replay 9 -> 10: contentDigest d94c78f1 -> cf212873 in the record only; substitute it back first.
    // Landing batch: contentDigest cf212873 -> 2f642cc0 in the record only; substitute it back first.
    // Heimerdinger's focus: contentDigest 2f642cc0 -> 9ccd5f96 in the record only; substitute it back first.
    // Swain's drain: contentDigest 9ccd5f96 -> eb2d4cee in the record only; substitute it back first.
    // Mel's barrage: contentDigest eb2d4cee -> 74aa81a7 in the record only.
    const newer = JSON.stringify(before628).split('74aa81a7').join('eb2d4cee').split('eb2d4cee').join('9ccd5f96').split('9ccd5f96').join('2f642cc0').split('2f642cc0').join('cf212873').split('cf212873').join('d94c78f1').split('d94c78f1').join('db6dc9b6').split('db6dc9b6').join('f37c6970').split('f37c6970').join('c7f0a2f3').split('9c98c8ef').join('b53841c0');
    expect(bytesHash(JSON.parse(newer))).toBe('aed1abb50ef0355c3c10be7220af546eec1a795b95e380ff5cc35f6e1154d41d');
    const back = newer.split('c7f0a2f3').join('150d825d').split('b53841c0').join('a56b2c4a');
    expect(bytesHash(JSON.parse(back.split('150d825d').join('ed366cad')))).toBe('0c7864258f8aaea4dfb17643ce3af62ab1e9c9e10c75d02d7f4d8662aafccee6');
    expect(bytesHash(JSON.parse(back))).toBe('4855c22c0529a7622d5d6145178390a1c76a8f1d71b2d6c299d64dd298d61a4c');
    // #739 save/replay 9 -> 10: record.version carries replayFormatVersion 10 and contentDigest cf212873 (was d94c78f1), so the
    // record hash moves again (was 4a7302a1… with replay 9 / d94c78f1); the chain above substitutes both back, so its pins hold.
    expect(bytesHash(record)).toBe('bd21423e93d39726cbfe5677a9c03bb4f7dc1d95e0ac469c2d0e6900d6416aca');
    expect(bytesHash(record.events)).toBe('3d9c7fc139b05e5795d4133ffaeff78a9e7084e14912bc9599fa23e69722fa7a');
    expect(bytesHash(expected.terminal)).toBe('fbf3b60ecf7829825848d88d79ade4df4076b05e2cbbc71a8b5ece3b689ee12e');
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
