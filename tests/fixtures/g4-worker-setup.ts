import { readFileSync } from 'node:fs';
import { afterAll, expect, vi } from 'vitest';
import { clearHistoryScope } from './history-evidence';
Reflect.set(globalThis,Symbol.for('cat.fixture.history.scope'),()=>expect.getState().testPath??'script');

// Pure simulation modules can keep their compiled code and bounded immutable
// caches in a worker. Files that intercept imports get a fresh module graph both
// before and after their suite, so their mocked dependencies never reach peers.
const testPath = expect.getState().testPath;
const interceptsImports = !!testPath && /\bvi\.(?:mock|doMock)\s*\(/.test(readFileSync(testPath, 'utf8'));
if (interceptsImports) vi.resetModules();
afterAll(() => {
  clearHistoryScope(testPath??'script');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  if (interceptsImports) vi.resetModules();
});
