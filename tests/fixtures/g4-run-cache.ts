import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

// One freshly created directory per Vitest invocation. This is generated fixture
// reuse across isolated workers, never a checked-in oracle or a restore cache.
let sequence = 0;
function location(namespace: string, key: string): string | undefined {
  const directory = process.env.G4_FIXTURE_CACHE;
  return directory && join(directory, `${namespace}-${createHash('sha256').update(key).digest('hex')}.json`);
}
export function readRunFixture<T>(namespace: string, key: string): T | undefined {
  const path = location(namespace, key);
  if (!path) return;
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
export function writeRunFixture(namespace: string, key: string, value: unknown): void {
  const path = location(namespace, key);
  if (!path) return;
  const temporary = `${path}.${process.pid}.${sequence++}.tmp`;
  writeFileSync(temporary, JSON.stringify(value));
  renameSync(temporary, path); // Atomic publication; concurrent identical builds are harmless.
}
