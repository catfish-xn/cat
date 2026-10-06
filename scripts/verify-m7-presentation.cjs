/*
 * M7 presentation gate (G01/G04/G06/G08): public seed-42 game through normal controls.
 *  - help opens/closes, traps focus, blocks D/F/E while open, issues no command;
 *  - the first battle finishes in the same complete state with reduced motion on and off;
 *  - replay board renders official portraits and returning leaves the active Match untouched;
 *  - fixed legal notice is present; zero page/console errors.
 * Usage: node scripts/verify-m7-presentation.cjs --url=http://127.0.0.1:4173 [--out=artifacts/m7-presentation]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const arg = (name, fallback) => (process.argv.find(value => value.startsWith(`--${name}=`)) ?? `=${fallback}`).split('=').slice(1).join('=');
const url = arg('url', 'http://127.0.0.1:4173');
const out = arg('out', 'artifacts/m7-presentation');

async function newGame(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.waitForFunction(() => { const b = document.querySelector('[data-debug="m6-fixed-start"]'); return b && !b.disabled; });
  await page.fill('[data-debug="m6-seed-input"]', '42');
  await page.locator('[data-debug="m6-fixed-start"]').click();
  await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active');
  return { context, page, errors };
}
const read = page => page.evaluate(() => window.__CAT_DEBUG__.read());
async function chooseAll(page) {
  while ((await read(page)).state.phase === 'choice') {
    await page.locator('.choice-overlay [data-debug^="choice:"]').first().click();
    await page.waitForFunction(() => !document.querySelector('[data-debug="choice-dismissal-shield"]'));
  }
}
async function firstBattle(browser, reduced) {
  const game = await newGame(browser);
  const { page } = game;
  await chooseAll(page);
  // Toggle the preference through the public help dialog only.
  await page.locator('[data-debug="help-open"]').click();
  const motion = page.locator('[data-debug="help-reduced-motion"]');
  if ((await motion.getAttribute('aria-pressed')) !== String(reduced)) await motion.click();
  assert.equal(await motion.getAttribute('aria-pressed'), String(reduced));
  await page.locator('[data-debug="help-close"]').click();
  await page.locator('[data-debug="mobile:start-combat"]').click();
  await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
  const snap = await read(page);
  return { game, state: snap.state, events: snap.combatEvents };
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const report = { url, checks: [] };
  const check = (name, details = {}) => { report.checks.push({ name, ...details }); console.log(`ok ${name}`); };
  try {
    // Help dialog: information only, focus handling, shortcuts blocked while open.
    const { context, page, errors } = await newGame(browser);
    await chooseAll(page);
    const before = (await read(page)).state;
    await page.locator('[data-debug="help-open"]').click();
    await page.waitForSelector('[data-debug="help-dialog"]:not([hidden])');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.debug), 'help-close');
    await page.keyboard.press('KeyD'); await page.keyboard.press('KeyF'); await page.keyboard.press('KeyE');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    assert(await page.evaluate(() => document.querySelector('[data-debug="help-dialog"]').contains(document.activeElement)), 'focus stays in help');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-debug="help-dialog"]', { state: 'hidden' });
    assert.deepEqual((await read(page)).state, before, 'help and blocked D/F/E change nothing');
    await page.keyboard.press('KeyD');
    const afterD = (await read(page)).state;
    assert.equal(afterD.gold, before.gold - 2, 'D works again after closing help');
    assert.match(await page.locator('#legal-notice').innerText(), /not endorsed by Riot Games/);
    check('help-dialog', { goldBefore: before.gold, goldAfterD: afterD.gold });
    assert.deepEqual(errors, []); await context.close();

    // Reduced motion is presentation only.
    const normal = await firstBattle(browser, false), reduced = await firstBattle(browser, true);
    assert.deepEqual(reduced.state, normal.state, 'same final Match with reduced motion');
    assert.deepEqual(reduced.events, normal.events, 'same combat ledger with reduced motion');
    check('reduced-motion-equivalence', { result: normal.state.roundResults.at(-1).result, events: normal.events.length });

    // Replay uses the same identity and leaves the active Match untouched.
    const { page: replayPage, errors: replayErrors } = reduced.game;
    await chooseAll(replayPage);
    const active = (await read(replayPage)).state;
    await replayPage.waitForFunction(() => { const s = document.querySelector('#replay-root select'); return s && s.options.length > 1 && !s.disabled; });
    await replayPage.locator('#replay-root select').selectOption({ index: 1 });
    await replayPage.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'replay');
    await replayPage.waitForTimeout(800);
    const portraitPixels = await replayPage.evaluate(() => {
      const canvas = document.querySelector('.replay-canvas'); const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let distinct = new Set();
      for (let i = 0; i < data.length; i += 4 * 97) distinct.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
      return { width: canvas.width, colors: distinct.size };
    });
    assert(portraitPixels.colors > 60, 'replay canvas shows rich portrait pixels, not flat discs');
    await replayPage.screenshot({ path: path.join(out, 'replay.png') });
    await replayPage.locator('#replay-root').getByRole('button', { name: '返回当前局', exact: true }).click();
    await replayPage.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active');
    assert.deepEqual((await read(replayPage)).state, active, 'replay leaves active Match unchanged');
    check('replay-identity', portraitPixels);
    assert.deepEqual([...normal.game.errors, ...replayErrors], [], 'no page or console errors');
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = String(error.stack || error); console.error(error); process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})();
