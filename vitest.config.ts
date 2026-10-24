import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { configDefaults, defineConfig } from 'vitest/config';

// Wall-clock assertions must run without competing test workers. Keep the lists
// complementary so every test is selected exactly once by CI's two commands.
const timing = [
  'tests/b8-resumable-battle-timing.test.ts',
  'tests/m5-replay-cannon.test.ts',
  'tests/server/bot-driver-timing.test.ts',
  'tests/server/round-commit-timing.test.ts',
  // Publishing-watchdog executes a real PvE round within its original 5 s
  // timeout; isolate the existing suite from parallel route CPU contention.
  'tests/server/g3-ops.test.ts',
  // Network replay/resume traverses real battles and has a 5 s wall timeout.
  'tests/server/ws-client.test.ts',
  // The LocalRoomClient full-match case plays a whole room (~47 s alone) and
  // exceeds the fast project's 60 s case limit under 4-worker contention.
  'tests/server/local-room-client-full-match.test.ts',
];
// Tiny route wrappers contain the longest workloads. Start them first even on
// a clean checkout, when Vitest has no duration cache and sorts by source size.
class RouteFirstSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files);
    const weight = (file: TestSpecification): number => {
      if (/m5-replay(?:-mage|-sniper-caitlyn)?\.test\.ts$/.test(file.moduleId)) return 1000;
      if (/m6-integration(?:-[a-z-]+)?\.test\.ts$/.test(file.moduleId)) return 900;
      if (/m5-route\.test\.ts$/.test(file.moduleId)) return 800;
      return 0;
    };
    return sorted.sort((a, b) => weight(b) - weight(a));
  }
  // CI runs the fast project as four `--shard` machines. Vitest's own shard cuts the
  // hash-sorted file list into equal counts, which left one shard with over twice the
  // work of another. Assign files greedily by measured duration instead (longest first,
  // to the least-loaded shard), so every file still lands in exactly one shard.
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { index, count } = this.ctx.config.shard!;
    const root = this.ctx.config.root;
    const path = (file: TestSpecification) => relative(root, file.moduleId).split('\\').join('/');
    const load = Array.from({ length: count }, (_, shard) => shard === 0 && count > 1 ? SHARD_ONE_HEADSTART : 0);
    const mine: TestSpecification[] = [];
    const ordered = [...files].sort((a, b) => shardWeight(path(b)) - shardWeight(path(a)) || (path(a) < path(b) ? -1 : 1));
    for (const file of ordered) {
      const target = load.indexOf(Math.min(...load));
      load[target] += shardWeight(path(file));
      if (target === index - 1) mine.push(file);
    }
    return mine;
  }
}
// Seconds per fast-project file from one full local run (8 workers); refresh with
// `node scripts/update-shard-weights.cjs <vitest json report>`. Files not listed count as
// UNKNOWN_WEIGHT, so a stale table only costs balance, never coverage.
const SHARD_WEIGHTS: Record<string, number> = JSON.parse(readFileSync(new URL('./tests/fixtures/shard-weights.json', import.meta.url), 'utf8'));
const UNKNOWN_WEIGHT = 2;
const shardWeight = (path: string): number => SHARD_WEIGHTS[path] ?? UNKNOWN_WEIGHT;
// Shard 1 also runs the timing project after its fast tests (ci.yml, full tier): 150-250 s
// on CI, which is about 900 of these table seconds (CI shards finish ~4.8 table seconds per second).
const SHARD_ONE_HEADSTART = 900;
export default defineConfig({
  test: {
    sequence: { sequencer: RouteFirstSequencer },
    projects: [
      { test: { name: 'fast', pool: 'threads', isolate: false, setupFiles: ['./tests/fixtures/g4-worker-setup.ts'], globalSetup: ['./tests/fixtures/g4-global-setup.ts'], maxWorkers: '100%', include: configDefaults.include, exclude: [...configDefaults.exclude, ...timing] } },
      // Keep long-route heap/module state out of later wall-clock measurements.
      { test: { name: 'timing', isolate: true, setupFiles: ['./tests/fixtures/g4-worker-setup.ts'], include: timing, maxWorkers: 1, fileParallelism: false } },
    ],
  },
});
