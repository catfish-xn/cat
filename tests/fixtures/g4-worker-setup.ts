import { readFileSync } from 'node:fs';
import { afterAll, expect, vi } from 'vitest';

// Pure simulation modules can keep their compiled code and bounded immutable
// caches in a worker. Files that intercept imports get a fresh module graph both
// before and after their suite, so their mocked dependencies never reach peers.
const testPath = expect.getState().testPath;
const interceptsImports = !!testPath && /\bvi\.(?:mock|doMock)\s*\(/.test(readFileSync(testPath, 'utf8'));
if (interceptsImports) vi.resetModules();
// 2D bundle split (11-19): the G2-3 item names and icons are their own chunk, loaded after the first screen. Display tests
// read them loaded, as a player does after the prefetch; files that reset modules load them in their own graph
// (tests/ui-chunk-split.test.ts covers the time before they arrive).
if (!interceptsImports) await (await import('../../src/presentation/g23-display')).loadG23Items();
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  if (interceptsImports) vi.resetModules();
});
