import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const evidence = require('../scripts/m5-evidence.cjs');
const comparator = readFileSync(new URL('../scripts/compare-m6-evidence.cjs', import.meta.url), 'utf8');
const realRequire = createRequire(new URL('../scripts/compare-m6-evidence.cjs', import.meta.url));
const reachedNextCheck = new Error('Reached the next independent evidence check');

function validRoute() {
  return {
    passed: true, sha: 'a'.repeat(40), status: '', sourceFingerprint: 'fp', finalSourceFingerprint: 'fp', errors: [], mode: 'dev',
    m6RoundTrip: { sameRunIdNewEpoch: true }, m6Replay: { isolated: true },
    m6ReplayFailureIsolation: { quotaObserved: true, switchedBattleWithoutWrite: true, durableRevisionUnchanged: true, activeSavingRecovered: true, visibilityCoverage: 'test' },
    m6RejectedImport: { atomic: true },
    m6Seeds: { newIdentity: true, boundaries: [0, 42, 4294967295], invalidPreserved: 6, publicCommandSequence: { accepted: true, rngChanged: true, completeStateAndLedgerEqual: true } },
    m6ReplayReopen: { sameBattle: true, fullStateLedgerRevisionPreserved: true, nativeKeyboard: true, durableRevisionUnchanged: true },
    m6Lifecycle: {
      cycles: 30, heapDiagnostics: false, warmupExperiment: false, warmupCycles: 2, rows: Array(30).fill({}), heapCeilingBytes: 1_572_864,
      beforeHeap: { usedSize: 50_000_000 }, afterHeap: { usedSize: 52_015_536 }, heapDelta: 2_015_536,
      heapGate: { policy: 'warn-only', deltaBytes: 2_015_536, ceilingBytes: 1_572_864, exceeded: true },
      beforeResources: { listeners: 5, pendingRaf: 1 }, afterResources: { listeners: 5, pendingRaf: 1 },
    },
  };
}

function compare(route: ReturnType<typeof validRoute>) {
  const warn = vi.fn();
  const fakeRequire = (name: string) => {
    if (name === 'node:fs') return { readFileSync: (file: string) => {
      if (file === 'src/m6/limits.ts') return readFileSync(new URL('../src/m6/limits.ts', import.meta.url), 'utf8');
      if (file === 'artifacts/m5-dev-cannon/manifest.json') return JSON.stringify(route);
      if (file === 'artifacts/m5-input-dev/manifest.json') throw reachedNextCheck;
      throw new Error(`Unexpected read ${file}`);
    } };
    if (name === 'node:child_process') return { execFileSync: () => 'a'.repeat(40) };
    if (name === './m5-evidence.cjs') return { ...evidence, sourceFingerprint: () => 'fp', warnApplicationHeap: warn };
    return realRequire(name);
  };
  // Execute the entire actual comparator, stopping only at its next artifact.
  try { new Function('require', comparator)(fakeRequire); }
  catch (error) { return { error, warn }; }
  throw new Error('Comparator did not reach any evidence boundary');
}

describe('H1 warning integration in the real evidence comparator', () => {
  it('continues past a real overrun and retains the warning', () => {
    const route = validRoute(), { error, warn } = compare(route);
    expect(error).toBe(reachedNextCheck);
    expect(warn).toHaveBeenCalledWith(route.m6Lifecycle.heapGate);
  });

  it.each([
    ['null reading', (r: ReturnType<typeof validRoute>) => { Object.assign(r.m6Lifecycle.beforeHeap, { usedSize: null }); r.m6Lifecycle.afterHeap.usedSize = 2_015_536; }],
    ['string readings', (r: ReturnType<typeof validRoute>) => { Object.assign(r.m6Lifecycle.beforeHeap, { usedSize: '50000000' }); Object.assign(r.m6Lifecycle.afterHeap, { usedSize: '52015536' }); }],
    ['negative readings', (r: ReturnType<typeof validRoute>) => { r.m6Lifecycle.beforeHeap.usedSize = -3_000_000; r.m6Lifecycle.afterHeap.usedSize = -984_464; }],
    ['forged warning', (r: ReturnType<typeof validRoute>) => { r.m6Lifecycle.heapGate.exceeded = false; }],
    ['missing warning', (r: ReturnType<typeof validRoute>) => { Reflect.deleteProperty(r.m6Lifecycle, 'heapGate'); }],
    ['wrong delta', (r: ReturnType<typeof validRoute>) => { r.m6Lifecycle.heapDelta++; }],
    ['listener retained', (r: ReturnType<typeof validRoute>) => { r.m6Lifecycle.afterResources.listeners++; }],
    ['RAF retained', (r: ReturnType<typeof validRoute>) => { r.m6Lifecycle.afterResources.pendingRaf += 2; }],
    ['wrong SHA', (r: ReturnType<typeof validRoute>) => { r.sha = 'b'.repeat(40); }],
    ['source changed', (r: ReturnType<typeof validRoute>) => { r.finalSourceFingerprint = 'changed'; }],
  ] as const)('still blocks %s', (_name, mutate) => {
    const route = validRoute(); mutate(route);
    const { error } = compare(route);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBe(reachedNextCheck);
  });
});
