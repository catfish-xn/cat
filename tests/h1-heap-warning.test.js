import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { applicationHeapGate, warnApplicationHeap } = createRequire(import.meta.url)('../scripts/m5-evidence.cjs');
afterEach(() => vi.restoreAllMocks());

describe('H1 full-application heap warning', () => {
  it('keeps an observed preview overrun visible without throwing or changing its bytes', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gate = applicationHeapGate('preview', { usedSize: 14_138_968 }, { usedSize: 16_154_504 });
    expect(gate).toEqual({ policy: 'warn-only', deltaBytes: 2_015_536, ceilingBytes: 1_048_576, exceeded: true });
    expect(() => warnApplicationHeap(gate)).not.toThrow();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('::warning title=H1 application heap::post-GC growth 2015536 B exceeds 1048576 B'));
  });

  it('keeps the separate preview/dev ceilings and permits post-GC shrinkage', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const [mode, ceiling] of [['preview', 1_048_576], ['dev', 1_572_864]]) {
      expect(applicationHeapGate(mode, { usedSize: 0 }, { usedSize: ceiling + 1 }).exceeded).toBe(true);
      expect(applicationHeapGate(mode, { usedSize: 0 }, { usedSize: ceiling }).exceeded).toBe(false);
      warnApplicationHeap(applicationHeapGate(mode, { usedSize: 0 }, { usedSize: ceiling }));
      warnApplicationHeap(applicationHeapGate(mode, { usedSize: 15_524_796 }, { usedSize: 14_923_400 }));
    }
    expect(warning).not.toHaveBeenCalled();
  });

  it.each([undefined, null, NaN, Infinity, -Infinity, '2015536', -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid evidence %s instead of silently warning', value => {
    expect(() => applicationHeapGate('preview', { usedSize: value }, { usedSize: 100 })).toThrow('Invalid full-application heap reading');
    expect(() => applicationHeapGate('preview', { usedSize: 100 }, { usedSize: value })).toThrow('Invalid full-application heap reading');
  });

  it('rejects an unknown measurement mode', () => {
    expect(() => applicationHeapGate('unknown', { usedSize: 0 }, { usedSize: 0 })).toThrow('Unknown application measurement mode');
  });
});
