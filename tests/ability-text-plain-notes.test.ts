/** Project-defined units without a client ability read a plain Chinese note: no project jargon, no English. */
import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { loadTooltipText } from '../src/presentation/tooltip-text-loader';
import { abilityText } from '../src/presentation/ability-text';

beforeAll(async () => { await loadTooltipText(); });

it('describes anomaly summons, the dummies and Sion in plain Chinese', () => {
  for (const id of ['s13-crab', 's13-wolf', 's13-mini', 'training-dummy', 'tower-dummy', 'g23-sion']) {
    const text = abilityText(id, 1)!.text;
    expect(text).not.toMatch(/魔改|项目约定|执行约定/);
    expect(text).not.toMatch(/[A-Za-z]{2}/);
  }
});

it('keeps the generated client table current', () => {
  expect(() => execFileSync(process.execPath, ['src/presentation/client-tables/generate.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
}, 30_000);
