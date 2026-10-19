import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';

// Same switch as scripts/wallclock-gate.cjs: the PR gate sets CI_WALLCLOCK_GATES=report and
// only records the measurement; nightly/post-merge runs (and local runs) enforce the budget.
export const WALLCLOCK_ENFORCED = process.env.CI_WALLCLOCK_GATES !== 'report';

/** Wall-clock budget `actualMs < limitMs`; the limit itself is never relaxed in report mode. */
export function expectWallClockBelow(name: string, actualMs: number, limitMs: number): void {
  const passed = actualMs < limitMs;
  const dir = process.env.WALLCLOCK_REPORT_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'vitest.jsonl'), JSON.stringify({ source: 'vitest', enforced: WALLCLOCK_ENFORCED, name, actual: actualMs, limit: limitMs, comparison: '<', passed }) + '\n');
  }
  if (WALLCLOCK_ENFORCED) expect(actualMs, name).toBeLessThan(limitMs);
  else if (!passed) console.warn(`[wall-clock report only] ${name}: ${actualMs} ms, budget < ${limitMs} ms`);
}
