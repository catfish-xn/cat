import { describe, expect, it } from 'vitest';
import { CommandDedupe } from '../../../src/server/net/dedupe';
import { SessionRegistry, digestOf } from '../../../src/server/net/session';

describe('net/dedupe', () => {
  it('replays the original receipt for the same id and content, refuses the same id with other content', () => {
    const dedupe = new CommandDedupe<string>(4);
    expect(dedupe.check(1, 'a')).toEqual({ kind: 'new' });
    dedupe.record(1, 'a', 'receipt-1');
    expect(dedupe.check(1, 'a')).toEqual({ kind: 'replay', receipt: 'receipt-1' });
    expect(dedupe.check(1, 'b')).toEqual({ kind: 'conflict' });
  });
  it('treats ids older than the window as expired and forgets the lowest id first', () => {
    const dedupe = new CommandDedupe<string>(3);
    for (const id of [10, 11, 12]) dedupe.record(id, `d${id}`, `r${id}`);
    expect(dedupe.check(9, 'x')).toEqual({ kind: 'expired' });
    expect(dedupe.check(5, 'x')).toEqual({ kind: 'expired' });
    expect(dedupe.check(13, 'x')).toEqual({ kind: 'new' });
    dedupe.record(13, 'd13', 'r13');
    expect(dedupe.size).toBe(3);
    expect(dedupe.check(10, 'd10')).toEqual({ kind: 'expired' }); // evicted: never replayed, never re-executed
    expect(dedupe.check(11, 'd11')).toEqual({ kind: 'replay', receipt: 'r11' });
    expect(dedupe.highestSeen).toBe(13);
  });
  it('accepts an unseen id below the highest while it is still inside the window', () => {
    const dedupe = new CommandDedupe<string>(256);
    dedupe.record(5, 'a', 'r5');
    expect(dedupe.check(3, 'x')).toEqual({ kind: 'new' });
  });
  it('rejects a non-positive window', () => { expect(() => new CommandDedupe(0)).toThrow(RangeError); });
});

describe('net/session', () => {
  it('issues unguessable tokens, keeps only digests and resumes by token with a new epoch', () => {
    const registry = new SessionRegistry();
    const first = registry.issue('seat-1'), second = registry.issue('seat-2');
    expect(first.token).not.toBe(second.token);
    expect(first.token.length).toBeGreaterThanOrEqual(32);
    expect(first.session).toMatchObject({ seatId: 'seat-1', connectionEpoch: 1, roomId: null, connection: null });
    expect(JSON.stringify([...registry])).not.toContain(first.token);
    const resumed = registry.resume(first.token);
    expect(resumed).toEqual({ ok: true, session: first.session });
    expect(first.session.connectionEpoch).toBe(2);
    expect(registry.resume('not-a-token')).toEqual({ ok: false, reason: 'invalid-token' });
    expect(registry.resume(digestOf(first.token))).toEqual({ ok: false, reason: 'invalid-token' });
  });
  it('re-issuing or revoking a seat invalidates the previous token', () => {
    const registry = new SessionRegistry();
    const first = registry.issue('seat-1');
    const second = registry.issue('seat-1');
    expect(registry.resume(first.token)).toEqual({ ok: false, reason: 'invalid-token' });
    expect(registry.resume(second.token).ok).toBe(true);
    registry.revoke('seat-1');
    expect(registry.resume(second.token)).toEqual({ ok: false, reason: 'invalid-token' });
    expect(registry.size).toBe(0);
  });
});
