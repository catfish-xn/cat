import { existsSync } from 'node:fs';
import { inject } from 'vitest';
import { chromium, type Browser } from 'playwright';

declare module 'vitest' {
  export interface ProvidedContext { playwrightEndpoint?: string }
}

/** Launch options shared by the in-process browser tests (local google-chrome when present). */
export const BROWSER_OPTIONS = { headless: true, ...(existsSync('/usr/bin/google-chrome') ? { channel: 'chrome' } : {}), args: ['--no-sandbox'] };

/**
 * Connect to the one browser server started by the fast project's global setup, so each test file only
 * opens a connection instead of starting Chrome under full-suite load. Falls back to a private launch
 * when no server is available (e.g. a sandbox that cannot listen on localhost).
 */
export async function testBrowser(): Promise<Browser> {
  const endpoint = inject('playwrightEndpoint');
  if (endpoint) {
    try { return await chromium.connect(endpoint); } catch { /* fall back to a private browser */ }
  }
  return chromium.launch(BROWSER_OPTIONS);
}
