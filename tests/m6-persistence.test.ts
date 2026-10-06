import { describe, expect, it, vi } from 'vitest';
import { parseSeed, createSeed, createRunId } from '../src/persistence/seed';
import { validateEnvelope, validateFile, exportFile } from '../src/persistence/format';
import { SaveCoordinator } from '../src/persistence/coordinator';
import { SaveError } from '../src/persistence/repository';
import { createMatch } from '../src/simulation/match';
import { MAX_SAVE_BYTES } from '../src/m6/limits';
import type { CapturedSave, SaveEnvelope, SaveStatus, SlotToken } from '../src/m6/contracts';
const envelope = (): SaveEnvelope => ({ kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1, runId: 'test-run', createdAt: '2026-10-06T00:00:00.000Z', match: createMatch(42), battles: [], currentBattle: null });
const captured = (): CapturedSave => ({ match: createMatch(42), currentBattle: null, battleKeys: [], addedBattles: [] });
const token: SlotToken = { runId: 'test-run', activationEpoch: 'test-epoch', revision: 1 };
describe('M6 seed and file boundaries', () => {
  it.each(['0', '42', '4294967295', ' 00042 '])('accepts full uint32 input %s', text => { const result = parseSeed(text); expect(result).toEqual({ ok: true, seed: Number(text) }); });
  it.each(['', ' ', '-1', '+1', '1.0', '1e2', 'NaN', '42abc', '4294967296', 'Infinity', '1 2'])('rejects partial/invalid seed %s', text => { expect(parseSeed(text).ok).toBe(false); });
  it('uses one domain-external random word and a separate identity', () => {
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { (array as Uint32Array)[0] = 0; return array; });
    expect(createSeed()).toBe(0); expect(random).toHaveBeenCalledTimes(1); random.mockRestore();
    expect(createRunId()).not.toBe(createRunId());
  });
  it('round-trips UTF8 and invokes isolated history validation after current validation', async () => {
    const history = vi.fn(); const original = envelope(); const copy = await validateFile(exportFile(original), history);
    expect(copy).toEqual(original); expect(copy).not.toBe(original); expect(copy.match).not.toBe(original.match); expect(history).toHaveBeenCalledTimes(1);
  });
  it.each([{ extra: true }, { kind: 'wrong' }, { saveFormatVersion: 2 }, { replayFormatVersion: 2 }, { runId: '' }, { createdAt: 'bad' }, { currentBattle: [] }])('rejects outer corruption before history %j', async patch => {
    const history = vi.fn(); await expect(validateEnvelope({ ...envelope(), ...patch }, history)).rejects.toThrow(); expect(history).not.toHaveBeenCalled();
  });
  it('checks file byte size before reading and bad JSON before history', async () => {
    const text = vi.fn(); const fake = { size: MAX_SAVE_BYTES + 1, text } as unknown as Blob;
    await expect(validateFile(fake, vi.fn())).rejects.toThrow('体积'); expect(text).not.toHaveBeenCalled();
    await expect(validateFile(new Blob(['{']), vi.fn())).rejects.toMatchObject({ reason: 'validation', message: expect.stringContaining('JSON') });
  });
  it('rejects old domain digest and propagates historical validation failure without touching source', async () => {
    const original = envelope(); const before = JSON.stringify(original); const history = vi.fn(() => { throw new Error('missing-event-prefix'); });
    await expect(validateEnvelope(original, history)).rejects.toMatchObject({ reason: 'validation', message: expect.stringContaining('missing-event-prefix') }); expect(JSON.stringify(original)).toBe(before);
    const wrong = { ...original, match: { ...original.match, contentDigest: 'old' } }; history.mockClear();
    await expect(validateEnvelope(wrong, history)).rejects.toThrow(); expect(history).not.toHaveBeenCalled();
  });
  it('rejects a bare M5 state and record/event overflow before history', async () => {
    await expect(validateEnvelope(createMatch(42), vi.fn())).rejects.toThrow();
    await expect(validateEnvelope({ ...envelope(), battles: Array(31).fill({ events: [] }) }, vi.fn())).rejects.toThrow('数量');
    await expect(validateEnvelope({ ...envelope(), battles: [{ events: Array(100001).fill(null) }] }, vi.fn())).rejects.toThrow('边界');
  });
});
describe('M6 serial snapshot coordinator', () => {
  it('fixes the queued snapshot and uses only prior committed revision', async () => {
    const seen: { expected: SlotToken; snapshot: CapturedSave }[] = [];
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const writer = { commit: vi.fn(async (expected: SlotToken, snapshot: CapturedSave) => { seen.push({ expected, snapshot }); if (seen.length === 1) await wait; return { ...expected, revision: expected.revision + 1 }; }) };
    const statuses: SaveStatus[] = []; const c = new SaveCoordinator(writer, token, status => statuses.push(status));
    const first = captured(); c.enqueue(first); c.enqueue(captured()); (first.match as { gold: number }).gold = 999;
    expect(writer.commit).toHaveBeenCalledTimes(1); expect(statuses.some(s => s.kind === 'saved')).toBe(false);
    release(); await c.flush(); expect(seen[0].snapshot.match.gold).not.toBe(999); expect(seen.map(s => s.expected.revision)).toEqual([1, 2]); expect(c.token.revision).toBe(3);
  });
  it('stops forever on conflict and preserves token/local capture', async () => {
    const writer = { commit: vi.fn(async () => { throw new SaveError('conflict', 'conflict'); }) }; const c = new SaveCoordinator(writer, token, () => {});
    c.enqueue(captured()); await expect(c.flush()).rejects.toThrow('conflict'); c.enqueue(captured()); await expect(c.flush()).rejects.toThrow('conflict'); expect(writer.commit).toHaveBeenCalledTimes(1); expect(c.token).toEqual(token);
  });
  it('retains failed snapshot for retry after quota failure', async () => {
    const writer = { commit: vi.fn().mockRejectedValueOnce(new SaveError('quota', 'quota')).mockImplementation(async (expected: SlotToken) => ({ ...expected, revision: expected.revision + 1 })) };
    const c = new SaveCoordinator(writer, token, () => {}); c.enqueue(captured()); await expect(c.flush()).rejects.toThrow('quota'); await c.flush(); expect(c.token.revision).toBe(2);
  });
  it.each(['quota', 'abort'] as const)('bounds repeated %s failures to one latest fixed pending snapshot', async reason => {
    let failing = true;
    const writer = { commit: vi.fn(async (expected: SlotToken) => { if (failing) throw new SaveError(reason, reason); return { ...expected, revision: expected.revision + 1 }; }) };
    const c = new SaveCoordinator(writer, token, () => {});
    c.enqueue(captured()); await expect(c.flush()).rejects.toThrow(reason);
    for (let i = 0; i < 100; i++) { const next = captured(); (next.match as { gold: number }).gold = i; c.enqueue(next); expect(c.pendingCount).toBeLessThanOrEqual(1); }
    await expect(c.flush()).rejects.toThrow(reason); expect(c.pendingCount).toBe(1); expect(c.token).toEqual(token);
    failing = false; await c.flush(); expect(c.pendingCount).toBe(0); expect(c.token.revision).toBe(2);
    const last = writer.commit.mock.calls.at(-1)! as unknown as [SlotToken, CapturedSave]; expect(last[1].match.gold).toBe(99);
  });
  it('fences notification and later queued writes after dispose', async () => {
    let release!: (value: SlotToken) => void; const writer = { commit: vi.fn(() => new Promise<SlotToken>(resolve => { release = resolve; })) }; const notify = vi.fn();
    const c = new SaveCoordinator(writer, token, notify); c.enqueue(captured()); c.enqueue(captured()); c.dispose(); release({ ...token, revision: 2 }); await Promise.resolve(); await Promise.resolve();
    expect(writer.commit).toHaveBeenCalledTimes(1); expect(notify).toHaveBeenCalledTimes(1);
  });
});
