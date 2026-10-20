import { describe, expect, it } from 'vitest';
import { parseParticleDocument, ParticleEffect } from '../src/rendering3d/particles';
// @ts-expect-error Node converter.
import { convertParticles } from '../scripts/assets3d/particles.mjs';
// @ts-expect-error Node writer.
import { writeParticleEffects } from '../scripts/assets3d/build.mjs';

// @ts-expect-error Node preview policy.
import { approximateEmitter } from '../scripts/assets3d/particle-approximate.mjs';

const emitter = (fields = {}) => ({ isSingleParticle: true, particleLifetime: { constantValue: 1 }, ...fields });
const source = (emitters: unknown[], fields = {}) => ({ toy: { __type: 'VfxSystemDefinitionData', complexEmitterDefinitionData: emitters, ...fields } });
const convert = (fields = {}, options = {}, system = {}) => convertParticles(source([emitter(fields)], system), () => undefined, parseParticleDocument, options);

describe('explicit linger approximation policy', () => {
  it.each(['particleLinger', 'emitterLinger'])('requires opt-in for %s and preserves source evidence', field => {
    const original = { [field]: 0.25 };
    expect(convert(original).counts.rejected).toBe(1);
    const result = convert(original, { approximateLinger: true });
    expect(result.counts).toEqual({ mapped: 0, approximated: 1, skipped: 0, rejected: 0 });
    expect(result.reasonsByStatus.approximated).toEqual({ 'omitted-linger-tail': 1 });
    expect(result.systems[0].report[0]).toMatchObject({ mapped: false, status: 'approximated',
      originalFields: original, approximations: [{ field, value: 0.25, handling: 'omit-tail' }] });
    const effect = new ParticleEffect(result.systems[0].document);
    expect(effect.particleCount).toBe(1);
    effect.update(1); expect(effect.finished).toBe(true); effect.dispose();
  });
  it.each([-1, 3601, NaN, Infinity, '1', null, undefined, {}, { constantValue: 1 }])('rejects invalid linger %j', value => {
    for (const field of ['particleLinger', 'emitterLinger']) {
      const result = convert({ [field]: value }, { approximateLinger: true });
      expect(result.counts).toMatchObject({ approximated: 0, rejected: 1 });
      expect(result.systems[0].report[0].reason).toBe(`invalid-source-linger:${field}`);
      expect(result.systems[0].document).toBeUndefined();
    }
  });
  it.each([0, 3600])('accepts bounded duration %s and counts the emitter once for both fields', value => {
    expect(convert({ particleLinger: value, emitterLinger: value }, { approximateLinger: true }).counts.approximated).toBe(1);
  });
  it.each([{ particleLingerType: 1 }, { bindWeight: { constantValue: 1 } }, { mystery: 0 }])('does not hide another unsupported field %j', extra => {
    expect(convert({ particleLinger: 0.5, ...extra }, { approximateLinger: true }).counts).toMatchObject({ approximated: 0, rejected: 1 });
  });
  it('does not hide system flags or a failing whole-document validation', async () => {
    expect(convert({ particleLinger: 0.5 }, { approximateLinger: true }, { flags: 2244 }).counts.rejected).toBe(1);
    const result = convertParticles(source([emitter(), emitter({ particleLinger: 0.5 })]), () => undefined,
      (doc: { emitters: unknown[] }) => { parseParticleDocument(doc); if (doc.emitters.length > 1) throw new Error('combined-budget'); },
      { approximateLinger: true });
    expect(result.counts).toEqual({ mapped: 0, approximated: 0, skipped: 0, rejected: 2 });
    const files: string[] = [];
    const written = await writeParticleEffects('toy', result, { attack: ['toy'] }, {
      write: async (path: string) => files.push(path), remove: async () => {},
    });
    expect(files).toEqual(['effects/toy/toy.report.json']);
    expect(written.effects).toEqual({}); expect(written.actionEffects.attack).toEqual([]);
  });
  it('writes approximated payloads and sidecars, with distinct counts and action suggestions', async () => {
    const result = convert({ particleLinger: 0.5 }, { approximateLinger: true });
    const files = new Map<string, string>();
    const written = await writeParticleEffects('toy', result, { cast: ['toy'] }, {
      write: async (path: string, bytes: string) => files.set(path, bytes), remove: async () => {},
    });
    expect(written.systems[0].counts).toEqual({ mapped: 0, approximated: 1, skipped: 0, rejected: 0 });
    expect(written.actionEffects.cast).toEqual(['toy_toy']);
    expect(parseParticleDocument(JSON.parse(files.get('effects/toy/toy.json')!)).emitters).toHaveLength(1);
    expect(JSON.parse(files.get('effects/toy/toy.report.json')!).emitters[0].status).toBe('approximated');
  });
});

describe('uniform dynamics replacement policy', () => {
  it.each([
    ['birthVelocity', [10, 20, 30], [[3, 4, 5], [6, 7, 8]], false],
    ['rate', 10, [3, 4], false],
    ['particleLifetime', 10, [3, 4], false],
    ['color', [.5, .5, .5, .5], [[1, .5, 0, 1], [0, 0, 0, 0]], true],
  ])('uses %s dynamics instead of multiplying the fallback', (field, constantValue, values, animated) => {
    const input = emitter({ isSingleParticle: false, lifetime: 1, [field as string]: { constantValue, dynamics: { times: [0, 1], values } } });
    const original = structuredClone(input);
    const result = approximateEmitter(input);
    const sampled = result.source[field as string];
    expect(sampled).toEqual(animated ? { dynamics: { times: [0, 1], values } } : { constantValue: values[0] });
    expect(result.approximations).toContainEqual(expect.objectContaining({
      field, handling: 'dynamics-replace-fallback-constant',
    }));
    expect(input).toEqual(original);
  });
  it('keeps fallback constants when no dynamics exist', () => {
    const input = emitter({ birthVelocity: { constantValue: [10, 20, 30] }, color: { constantValue: [.5, .5, .5, .5] } });
    const result = approximateEmitter(input);
    expect(result.source).toEqual(input);
    expect(result.approximations).toEqual([]);
  });
});
