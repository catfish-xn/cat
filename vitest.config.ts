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
}
export default defineConfig({
  test: {
    sequence: { sequencer: RouteFirstSequencer },
    projects: [
      { test: { name: 'fast', pool: 'threads', isolate: false, setupFiles: ['./tests/fixtures/g4-worker-setup.ts'], globalSetup: ['./tests/fixtures/g4-global-setup.ts'], maxWorkers: '100%', include: configDefaults.include, exclude: [...configDefaults.exclude, ...timing] } },
      { test: { name: 'timing', isolate: false, setupFiles: ['./tests/fixtures/g4-worker-setup.ts'], include: timing, maxWorkers: 1, fileParallelism: false } },
    ],
  },
});
