import { describe, expect, it, vi } from 'vitest';
import { createEnvelopeStore, envelopeKey, openEnvelopeStore, readStoredEnvelope, type EnvelopeBackend } from '../src/rendering/three-mode/envelope-store';
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
});
