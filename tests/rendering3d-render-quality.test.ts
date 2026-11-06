import { describe, expect, it } from 'vitest';
import { createRenderQuality, LOW_READINGS, pixelRatioFor, QUALITY_STORAGE_KEY, readQualityChoice, SETTLE_MS, WARMUP_MS } from '../src/rendering/three-mode/render-quality';

const memory = (initial?: string) => {
  const values = new Map<string, string>(initial ? [[QUALITY_STORAGE_KEY, initial]] : []);
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, values };
};

describe('3D 画质档位', () => {
  it('scales the device pixel ratio (capped at 2) and never draws below half a CSS pixel', () => {
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('medium', 1)).toBe(0.75);
    expect(pixelRatioFor('low', 1)).toBe(0.5);
    expect(pixelRatioFor('high', 3)).toBe(2);
    expect(pixelRatioFor('medium', 2)).toBe(1.5);
    expect(pixelRatioFor('low', 0.5)).toBe(0.5);
    expect(pixelRatioFor('high', Number.NaN)).toBe(1);
  });

  it('reads the kept choice, falling back to auto on anything unknown or a throwing storage', () => {
    expect(readQualityChoice(memory('low'))).toBe('low');
    expect(readQualityChoice(memory('ultra'))).toBe('auto');
    expect(readQualityChoice(null)).toBe('auto');
    expect(readQualityChoice({ getItem: () => { throw new Error('blocked'); } })).toBe('auto');
  });

  it('auto steps down one level after five low seconds in a row, only after the warm-up, and never below low', () => {
    const quality = createRenderQuality({ storage: memory(), start: 0 });
    expect(quality.level).toBe('high');
    // Loading: slow readings during the warm-up do not count.
    for (let i = 0; i < 10; i++) expect(quality.reading(10, 1000, 1000 + i * 500)).toBe(false);
    let now = WARMUP_MS;
    const second = (fps: number) => { now += 1000; return quality.reading(fps, 1000, now); };
    for (let i = 0; i < LOW_READINGS - 1; i++) expect(second(20)).toBe(false);
    expect(second(45)).toBe(false); // a good second resets the run
    for (let i = 0; i < LOW_READINGS - 1; i++) expect(second(20)).toBe(false);
    expect(second(20)).toBe(true);
    expect(quality.level).toBe('medium');
    // Settling after a change: readings right after it are ignored.
    now += SETTLE_MS;
    for (let i = 0; i < LOW_READINGS - 1; i++) expect(second(20)).toBe(false);
    expect(second(20)).toBe(true);
    expect(quality.level).toBe('low');
    now += SETTLE_MS;
    for (let i = 0; i < LOW_READINGS * 2; i++) expect(second(5)).toBe(false);
    expect(quality.level).toBe('low');
    expect(quality.choice).toBe('auto');
  });

  it('a paused page (hidden tab, a long reading) is not a slow one', () => {
    let hidden = true;
    const quality = createRenderQuality({ storage: memory(), start: 0, hidden: () => hidden });
    let now = WARMUP_MS;
    for (let i = 0; i < LOW_READINGS * 2; i++) { now += 1000; expect(quality.reading(1, 1000, now)).toBe(false); }
    hidden = false;
    for (let i = 0; i < LOW_READINGS * 2; i++) { now += 5000; expect(quality.reading(1, 5000, now)).toBe(false); }
    expect(quality.level).toBe('high');
  });

  it('cycles 自动 → 高 → 中 → 低 → 自动, keeps the choice, and a fixed choice is never lowered', () => {
    const storage = memory();
    const quality = createRenderQuality({ storage, start: 0 });
    expect(quality.label()).toBe('画质 自动');
    quality.cycle(0); expect([quality.choice, quality.level, quality.label()]).toEqual(['high', 'high', '画质 高']);
    expect(storage.values.get(QUALITY_STORAGE_KEY)).toBe('high');
    let now = WARMUP_MS;
    for (let i = 0; i < LOW_READINGS * 2; i++) { now += 1000; expect(quality.reading(5, 1000, now)).toBe(false); }
    expect(quality.level).toBe('high');
    quality.cycle(now); expect(quality.level).toBe('medium');
    quality.cycle(now); expect(quality.level).toBe('low');
    quality.cycle(now); expect([quality.choice, quality.level]).toEqual(['auto', 'high']);
    expect(storage.values.get(QUALITY_STORAGE_KEY)).toBe('auto');
    expect(createRenderQuality({ storage: memory('medium'), start: 0 }).level).toBe('medium');
    // A storage that refuses writes still switches for this visit.
    const refusing = createRenderQuality({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } }, start: 0 });
    refusing.cycle(0); expect(refusing.level).toBe('high');
  });
});
