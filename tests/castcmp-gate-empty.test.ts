import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

// castcmp's gate: a named system whose definition draws nothing (the runtime skips it when due, LTK_RUN_STATS.emptySkipped)
// is not applicable rather than missing (11-20: Mel's e75b9fe8, an original empty definition, failed every recording).
const require = createRequire(import.meta.url);
const { verdict } = require('../dev/castcmp/gate.cjs');
const box = { left: 0, right: 10, top: 0, bottom: 10 };
const judge = (empty: string[]) => verdict({ systems: ['shown', 'blank'], absent: [], layerIds: [], column: 'after', real: false, ckout: { ok: true },
  audit: null, pre: { running: [], layers: [] }, frames: [{ t: 0, boxes: { me: box }, running: ['shown'] }], from: 0, to: 1000, actionAtMs: 0,
  sampleLayers: false, probeOverhead: false, empty });

describe('castcmp gate: empty systems', () => {
  it('a named system that never ran fails, unless the runtime skipped it as empty: then it is listed as not applicable', () => {
    expect(judge([]).fails).toContain('systems: blank never ran in the judged window');
    const v = judge(['blank']);
    expect(v.fails.some((f: string) => f.includes('blank'))).toBe(false);
    expect(v.exempt).toContain('systems: blank not applicable (empty system: its definition draws nothing)');
  });
  it('an empty system that is not named, or one that did run, changes nothing', () => {
    expect(judge(['other']).fails).toContain('systems: blank never ran in the judged window');
    expect(judge(['shown', 'blank']).exempt.some((e: string) => e.includes('shown'))).toBe(false);
  });
});
