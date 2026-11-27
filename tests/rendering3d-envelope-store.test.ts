import { describe, expect, it, vi } from 'vitest';
import { ENVELOPE_STORE_TIMEOUT_MS, createEnvelopeStore, envelopeKey, envelopeSource, openEnvelopeStore, readStoredEnvelope, type EnvelopeBackend } from '../src/rendering/three-mode/envelope-store';
import { ENVELOPE_VERSION, type Envelope } from '../src/rendering/three-mode/model-fit';

// The browser's own store of measured envelopes (envelope-store.ts): keyed by model id, file sha256 and measurement
// version; anything unavailable or unreadable is a miss, never an error.
const SHA = 'a'.repeat(64), OTHER = 'b'.repeat(64);
const envelope: Envelope = { radius: 12, ground: -1, feet: 0.5, support: {
  center: [1, 0, 2], floor: 0, normal: [0, 1, 0], tiltDegrees: 0, tiltDeviation: 0, soleDeviation: 0, stableFeet: 2,
  soleSpread: Infinity, soleTiltDelta: Infinity, soleTilt: 0, soleMean: [0, 1, 0], contacts: [{ mesh: 0, vertex: 3 }], meshContacts: [],
  meshFloor: 0, height: 90, method: 'feet' } } as Envelope;
const mapBackend = () => {
  const values = new Map<string, unknown>();
  const backend: EnvelopeBackend = { getMany: async keys => keys.map(key => values.get(key)), put: async (key, value) => { values.set(key, structuredClone(value)); } };
  return { values, backend };
};
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('envelope store', () => {
  it('returns what was kept for the same model file and measurement version only', async () => {
    const { values, backend } = mapBackend(), store = createEnvelopeStore(backend);
    store.keep('twitch', SHA, envelope); await flush();
    expect([...values.keys()]).toEqual([envelopeKey('twitch', SHA)]);
    expect(envelopeKey('twitch', SHA)).toContain(`v${ENVELOPE_VERSION}`);
    const found = await store.load(new Map([['twitch', SHA], ['zoe', SHA]]));
    expect([...found.keys()]).toEqual(['twitch']);
    expect(found.get('twitch')).toEqual(envelope); // Infinity survives the structured clone
    // A new model file (another sha256) is a miss: measured again.
    expect((await store.load(new Map([['twitch', OTHER]]))).size).toBe(0);
  });

  it('ignores stored values that are not an envelope', async () => {
    expect(readStoredEnvelope({ radius: 'x' })).toBeUndefined();
    expect(readStoredEnvelope({ radius: 1, ground: null, feet: null, support: { center: [0, 0] } })).toBeUndefined();
    expect(readStoredEnvelope(null)).toBeUndefined();
    expect(readStoredEnvelope({ radius: 1, ground: null, feet: null })).toEqual({ radius: 1, ground: null, feet: null });
    const { values, backend } = mapBackend(); values.set(envelopeKey('mel', SHA), { radius: NaN });
    expect((await createEnvelopeStore(backend).load(new Map([['mel', SHA]]))).size).toBe(0);
  });

  it('a failing or missing store holds nothing and never throws', async () => {
    const failing: EnvelopeBackend = { getMany: vi.fn(async () => { throw new Error('quota'); }), put: vi.fn(async () => { throw new Error('quota'); }) };
    const store = createEnvelopeStore(failing);
    expect((await store.load(new Map([['twitch', SHA]]))).size).toBe(0);
    expect(() => store.keep('twitch', SHA, envelope)).not.toThrow();
    const none = await openEnvelopeStore(async () => { throw new Error('indexeddb-unavailable'); });
    expect((await none.load(new Map([['twitch', SHA]]))).size).toBe(0);
    expect(() => none.keep('twitch', SHA, envelope)).not.toThrow();
    const synchronous: EnvelopeBackend = { getMany: () => { throw new Error('closed'); }, put: () => { throw new Error('closed'); } };
    expect((await createEnvelopeStore(synchronous).load(new Map([['zoe', SHA]]))).size).toBe(0);
    expect(() => createEnvelopeStore(synchronous).keep('zoe', SHA, envelope)).not.toThrow();
  });

  it('the key covers the manifest clip settings: same file, re-cut clips is a miss', async () => {
    const entry = { path: 'models/twitch/model.glb', animations: { idle: 'idle1', attack: 'attack1' }, clipRanges: { idle1: [0, 1.5] as const } };
    const recut = { ...entry, clipRanges: { idle1: [0.2, 1.5] as const } };
    const renamed = { ...entry, animations: { idle: 'idle2', attack: 'attack1' } };
    const segmented = { ...entry, clipSegments: { spell_a: ['spell', 0, 0.5] as const } };
    const sources = [entry, recut, renamed, segmented].map(e => envelopeSource(SHA, e));
    expect(new Set(sources).size).toBe(4);
    // The same settings in another key order are the same source.
    expect(envelopeSource(SHA, { clipRanges: entry.clipRanges, animations: { attack: 'attack1', idle: 'idle1' }, path: entry.path })).toBe(sources[0]);
    const { backend } = mapBackend(), store = createEnvelopeStore(backend);
    store.keep('twitch', sources[0]!, envelope); await flush();
    expect((await store.load(new Map([['twitch', sources[0]!]]))).size).toBe(1);
    expect((await store.load(new Map([['twitch', sources[1]!]]))).size).toBe(0);
  });

  it('a read or an open that never answers counts as an empty store after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const hanging: EnvelopeBackend = { getMany: () => new Promise(() => {}), put: () => new Promise(() => {}) };
      const store = createEnvelopeStore(hanging);
      let found: Map<string, unknown> | undefined;
      void store.load(new Map([['twitch', SHA]])).then(result => { found = result; });
      await vi.advanceTimersByTimeAsync(ENVELOPE_STORE_TIMEOUT_MS - 1); expect(found).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1); expect(found?.size).toBe(0);
      let opened: Awaited<ReturnType<typeof openEnvelopeStore>> | undefined;
      let answer!: (backend: EnvelopeBackend) => void;
      const late: EnvelopeBackend = { getMany: vi.fn(async () => []), put: vi.fn(async () => {}), close: vi.fn() };
      void openEnvelopeStore(() => new Promise(resolve => { answer = resolve; })).then(result => { opened = result; });
      await vi.advanceTimersByTimeAsync(ENVELOPE_STORE_TIMEOUT_MS);
      expect(opened).toBeDefined();
      // The open answers after the timeout: that connection is closed, never used.
      answer(late); await vi.advanceTimersByTimeAsync(0);
      expect(late.close).toHaveBeenCalledTimes(1); expect(late.getMany).not.toHaveBeenCalled();
      let none: Map<string, unknown> | undefined;
      void opened!.load(new Map([['twitch', SHA]])).then(result => { none = result; });
      await vi.advanceTimersByTimeAsync(0); expect(none?.size).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
