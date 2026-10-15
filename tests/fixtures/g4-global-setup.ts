import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'g4-fixtures-'));
  process.env.G4_FIXTURE_CACHE = directory;
  return () => { delete process.env.G4_FIXTURE_CACHE; rmSync(directory, { recursive: true, force: true }); };
}
