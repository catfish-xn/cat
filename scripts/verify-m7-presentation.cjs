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
const LIFECYCLE_QUIET_MS = 450;
async function touchGame(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.waitForFunction(() => { const b = document.querySelector('[data-debug="m6-fixed-start"]'); return b && !b.disabled; });
  await page.fill('[data-debug="m6-seed-input"]', '42');
  await page.locator('[data-debug="m6-fixed-start"]').tap();
  await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active');
  while ((await read(page)).state.phase === 'choice') {
    await page.locator('.choice-overlay [data-debug^="choice:"]').first().tap();
    await page.waitForFunction(() => !document.querySelector('[data-debug="choice-dismissal-shield"]'));
  }
  return { context, page, errors };
}
/** Empty-board concessions settle at tick 0, reaching later rounds quickly through public controls only. */
async function benchEveryone(page) {
  await page.locator('[data-debug="panel:units"]').click();
  const units = (await read(page)).state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board');
  let slot = 0;
  for (const unit of units) {
    await page.locator(`[data-debug="mobile:unit:${unit.id}"]`).click();
    while ((await read(page)).state.preparation.units.some(other => other.location.kind === 'bench' && other.location.slot === slot)) slot++;
    await page.locator(`[data-debug="mobile:bench:${slot}"]`).click();
  }
}
async function advanceTo(page, round) {
  for (let guard = 0; guard < 80; guard++) {
    const state = (await read(page)).state;
    if (state.phase === 'preparation' && state.round === round) return;
    if (state.phase === 'choice') await chooseAll(page);
    else if (state.phase === 'preparation') { await page.waitForTimeout(LIFECYCLE_QUIET_MS); await page.locator('[data-debug="mobile:start-combat"]').click(); }
    else if (state.phase === 'settlement') await page.locator('[data-debug="mobile:continue"]').click();
    else await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
  }
  throw new Error(`did not reach round ${round}`);
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

    // Audit F01: a double click/tap on 继续 advances exactly one phase and never starts the next battle.
    {
      const page = normal.game.page;
      assert.equal((await read(page)).state.phase, 'settlement');
      const round = (await read(page)).state.round;
      await page.locator('[data-debug="mobile:continue"]').dblclick();
      await page.waitForTimeout(700);
      const after = (await read(page)).state;
      assert.notEqual(after.phase, 'combat', 'double click on 继续 must not start combat');
      assert.equal(after.round, round + 1);
      const touch = await touchGame(browser);
      await touch.page.locator('[data-debug="mobile:start-combat"]').tap();
      await touch.page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase === 'settlement', null, { timeout: 120000 });
      const box = await touch.page.locator('[data-debug="mobile:continue"]').boundingBox();
      // Queue the second native touch without waiting for the first release acknowledgement.
      // Driver round trips must not turn the intended 40ms burst into deliberate clicks.
      const touchInput = await touch.context.newCDPSession(touch.page);
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      try {
        await touchInput.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        const firstRelease = touchInput.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await new Promise(resolve => setTimeout(resolve, 40));
        const secondPress = touchInput.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        const secondRelease = touchInput.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await Promise.all([firstRelease, secondPress, secondRelease]);
      } finally { await touchInput.detach(); }
      await touch.page.waitForTimeout(700);
      const touched = (await read(touch.page)).state;
      assert.notEqual(touched.phase, 'combat', 'double tap on 继续 must not start combat');
      assert.equal(touched.round, 2);
      // A deliberate start after the quiet window still works.
      await touch.page.locator('[data-debug="mobile:start-combat"]').tap();
      await touch.page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'preparation', null, { timeout: 10000 });
      assert.deepEqual(touch.errors, []); await touch.context.close();
      check('continue-double-activation', { mouseRound: after.round, mousePhase: after.phase, touchPhase: touched.phase });
    }

    // Replay uses the same identity and leaves the active Match untouched.
    const { page: replayPage, errors: replayErrors } = reduced.game;
    await chooseAll(replayPage);
    const active = (await read(replayPage)).state;
    await replayPage.waitForFunction(() => { const s = document.querySelector('#replay-root select'); return s && s.options.length > 1 && !s.disabled; });
    await replayPage.locator('#replay-root select').selectOption({ index: 1 });
    await replayPage.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'replay');
    await replayPage.waitForTimeout(800);
    const replayPortraitShot = path.join(out, 'replay-tick0.png'); await replayPage.screenshot({ path: replayPortraitShot });
    const portraitPixels = await replayPage.evaluate(() => {
      const canvas = document.querySelector('.replay-canvas'); const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let distinct = new Set();
      for (let i = 0; i < data.length; i += 4 * 97) distinct.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
      return { width: canvas.width, colors: distinct.size };
    });
    assert(portraitPixels.colors > 60, 'replay canvas shows rich portrait pixels, not flat discs');
    // Audit F04: continuous playback shows the same event feedback as live combat.
    const expected = { attacks: normal.events.filter(event => event.type === 'attack').length, casts: normal.events.filter(event => event.type === 'cast').length };
    await replayPage.locator('#replay-root').getByRole('button', { name: '4×', exact: true }).click();
    await replayPage.locator('#replay-root').getByRole('button', { name: '播放', exact: true }).click();
    let floats = 0, shot = false;
    for (let i = 0; i < 600; i++) {
      const sample = await replayPage.evaluate(() => ({ replay: window.__CAT_DEBUG__.read().m6.replay, floats: document.querySelectorAll('.m6-combat-feedback span:not([hidden])').length }));
      floats = Math.max(floats, sample.floats);
      if (!shot && (sample.replay.fx?.casts ?? 0) > 0) { await replayPage.screenshot({ path: path.join(out, 'replay-cast.png') }); shot = true; }
      if (sample.replay.tick >= sample.replay.endTick) break;
      await replayPage.waitForTimeout(50);
    }
    const replayEnd = (await read(replayPage)).m6.replay;
    assert.equal(replayEnd.tick, replayEnd.endTick, 'replay reached its recorded end');
    // Old builds have no fx diagnostics: fail on missing visible feedback,
    // rather than a TypeError that masks whether this regression was exercised.
    assert(floats > 0, 'replay shows numeric damage floats');
    const fx = replayEnd.fx ?? { attacks: 0, casts: 0, specs: 0 };
    assert.equal(fx.attacks, expected.attacks, 'every replayed attack produced feedback once');
    assert.equal(fx.casts, expected.casts, 'every replayed cast produced feedback once');
    check('replay-feedback', { ...fx, expected, maxFloats: floats });
    await replayPage.screenshot({ path: path.join(out, 'replay.png') });
    await replayPage.locator('#replay-root').getByRole('button', { name: '返回当前局', exact: true }).click();
    await replayPage.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active');
    assert.deepEqual((await read(replayPage)).state, active, 'replay leaves active Match unchanged');
    check('replay-identity', portraitPixels);
    assert.deepEqual([...normal.game.errors, ...replayErrors], [], 'no page or console errors');

    // Audit F02: help stays on top when a post-combat reward choice appears underneath.
    {
      const { context: ctx, page, errors: helpErrors } = await newGame(browser);
      await chooseAll(page);
      await benchEveryone(page);
      await advanceTo(page, 7);
      await page.locator('[data-debug="panel:units"]').click();
      await page.locator('[data-debug="mobile:unit:unit-1"]').click();
      await page.locator('[data-debug="deploy:3,5"]').click();
      await page.waitForTimeout(LIFECYCLE_QUIET_MS);
      await page.locator('[data-debug="mobile:start-combat"]').click();
      await page.locator('[data-debug="help-open"]').click();
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
      await page.waitForTimeout(300);
      const pending = (await read(page)).state;
      assert.equal(pending.phase, 'choice', '2-7 PvE offers a reward choice');
      const focusIn = () => page.evaluate(() => ({ help: Boolean(document.querySelector('[data-debug="help-dialog"]').contains(document.activeElement)),
        choice: Boolean(document.activeElement?.closest('.choice-overlay')), debug: document.activeElement?.dataset.debug ?? null }));
      assert.deepEqual(await focusIn(), { help: true, choice: false, debug: 'help-close' }, 'the new reward does not steal focus from help');
      // Tab cycles inside help only; Enter/Space then act on help's own toggle (twice, restoring it), never on the reward.
      for (let i = 0; i < 4 && (await focusIn()).debug !== 'help-reduced-motion'; i++) await page.keyboard.press('Tab');
      assert.deepEqual(await focusIn(), { help: true, choice: false, debug: 'help-reduced-motion' });
      for (const key of ['Enter', 'Enter', 'Space', 'Space']) await page.keyboard.press(key);
      assert.equal((await focusIn()).help, true, 'focus stays in help');
      assert.equal(await page.evaluate(() => document.querySelector('.choice-overlay').inert), true, 'reward layer is inert under help');
      assert.deepEqual((await read(page)).state.pendingChoice, pending.pendingChoice, 'hidden reward was not selected');
      assert.equal((await read(page)).state.items.length, pending.items.length);
      await page.locator('[data-debug="help-close"]').click();
      await page.waitForFunction(() => document.activeElement?.closest('.choice-overlay'));
      await chooseAll(page);
      assert.equal((await read(page)).state.items.length, pending.items.length + 1, 'reward chosen after help closes');
      assert.deepEqual(helpErrors, []); await ctx.close();
      check('help-over-reward-choice', { round: pending.round, offers: pending.pendingChoice.offers });
    }

    // Audit F07: a bundled portrait that fails to load falls back to the code-drawn emblem.
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.route('**/assets/s13/champions/darius.png', route => route.fulfill({ status: 404, body: 'missing' }));
      const page = await context.newPage();
      await page.goto(url);
      await page.waitForFunction(() => { const b = document.querySelector('[data-debug="m6-fixed-start"]'); return b && !b.disabled; });
      await page.fill('[data-debug="m6-seed-input"]', '42');
      await page.locator('[data-debug="m6-fixed-start"]').click();
      await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active');
      await chooseAll(page);
      await page.waitForTimeout(500);
      const shop = await page.evaluate(() => ({
        broken: [...document.querySelectorAll('img.hero-portrait')].filter(img => img.complete && img.naturalWidth === 0).length,
        fallbacks: document.querySelectorAll('.shop-card .hero-fallback svg').length,
        darius: [...document.querySelectorAll('.shop-card')].filter(card => card.textContent.includes('德莱厄斯')).length,
      }));
      assert(shop.darius > 0, 'the seeded shop actually exercises the missing Darius portrait');
      assert.equal(shop.broken, 0, 'no broken portrait images remain');
      assert.equal(shop.fallbacks, shop.darius, 'every 德莱厄斯 card shows the emblem fallback');
      await context.close();
      check('portrait-404-fallback', shop);
    }
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = String(error.stack || error); console.error(error); process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})();
