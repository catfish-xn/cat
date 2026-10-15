import { configDefaults, defineConfig } from 'vitest/config';

// Wall-clock assertions must run without competing test workers. Keep the lists
// complementary so every test is selected exactly once by CI's two commands.
const timing = [
  'tests/b8-resumable-battle.test.ts',
  'tests/m5-replay-cannon.test.ts',
  'tests/server/bot-driver.test.ts',
  'tests/server/round-commit.test.ts',
];
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'fast', maxWorkers: '100%', include: configDefaults.include, exclude: [...configDefaults.exclude, ...timing] } },
      { test: { name: 'timing', include: timing, maxWorkers: 1, fileParallelism: false } },
    ],
  },
});
