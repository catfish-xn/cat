// Focused Chromium check of real trait hover-card DOM. No battle, remote requests, or state injection.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
async function main() {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), configLoader: 'runner',
    server: { host: '127.0.0.1', port: 0, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
  let browser;
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const { TRAIT_DEFINITIONS: definitions } = await server.ssrLoadModule('/src/simulation/content/traits.ts');
    const { traitSummary, traitTierText } = await server.ssrLoadModule('/src/presentation/trait-text.ts');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // A minimal harness loads the actual component through Vite, without starting a game.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/trait-official-test') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' });
      return route.continue();
    });
    await page.goto(origin + '/trait-official-test');
    const checks = [];
    for (const [id, definition] of Object.entries(definitions)) {
      for (const count of [0, definition.tiers.at(-1).threshold]) {
        const observed = await page.evaluate(async ({ id, count }) => {
          const { traitCardBody } = await import('/src/rendering/trait-column.ts');
          const card = traitCardBody(id, count, []);
          document.body.replaceChildren(card);
          return { summary: card.querySelector('[data-debug="trait-card:summary"]').textContent,
            rows: [...card.querySelector('[data-debug="trait-card:tiers"]').children].map(row => row.textContent) };
        }, { id, count });
        assert.equal(observed.summary, traitSummary(id, count), `${id}/${count} summary`);
        assert.deepEqual(observed.rows, definition.tiers.map(tier => traitTierText(definition, tier)), `${id}/${count} all tiers`);
        checks.push({ id, count, tiers: observed.rows.length });
      }
    }
    assert.deepEqual(errors, []);
    const report = { passed: true, browser: browser.version(), traits: Object.keys(definitions).length,
      tiers: Object.values(definitions).reduce((n, d) => n + d.tiers.length, 0), cards: checks.length, checks };
    const directory = path.resolve(__dirname, '../artifacts/trait-official-text');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ...report, checks: undefined }));
  } finally { await browser?.close(); await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
