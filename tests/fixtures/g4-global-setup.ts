import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { chromium, type BrowserServer } from 'playwright';
import { BROWSER_OPTIONS } from './shared-browser';

export default async function setup(project: TestProject) {
  const directory = mkdtempSync(join(tmpdir(), 'g4-fixtures-'));
  process.env.G4_FIXTURE_CACHE = directory;
  // One shared browser server for the in-process browser tests (tests/fixtures/shared-browser.ts);
  // An externally supplied browser is owned by the caller; otherwise retain the local launch/fallback.
  let server: BrowserServer | undefined;
  if (!process.env.PLAYWRIGHT_WS_ENDPOINT) {
    try { server = await chromium.launchServer(BROWSER_OPTIONS); project.provide('playwrightEndpoint', server.wsEndpoint()); } catch { server = undefined; }
  }
  return async () => { await server?.close(); delete process.env.G4_FIXTURE_CACHE; rmSync(directory, { recursive: true, force: true }); };
}
