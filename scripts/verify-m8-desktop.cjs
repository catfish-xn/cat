/* B10 supplemental desktop acceptance. Real app, public clicks/keys and validated
 * public-route imports only. Full 33-battle/three-build journeys stay in existing CI.
 * Run after npm run build. No mobile/touch cases or logic-time acceleration.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const h = require('./m8-b10-browser-support.cjs');
const output = path.resolve(process.env.M8_DESKTOP_EVIDENCE_DIR || 'artifacts/m8-desktop');
const viewports = [{ width: 1440, height: 1000 }, { width: 1440, height: 600 }, { width: 1920, height: 1080 }];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { ...h.identity(), checks: [], errors: [], passed: false, scope: 'six desktop mode/viewport combinations; supplemental, not replacement for 33-battle CI journeys' };
  let d, browser, app, strict;
  try {
    d = await h.domain(); const fixture = await h.prefixFixture(d, output);
    const assets = (await d.load('/src/presentation/s13-asset-manifest.ts')).S13_ASSETS;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    report.browser = browser.version();
    const check = (name, evidence = {}) => { report.checks.push({ name, passed: true, evidence }); console.log(`PASS ${name}`); };
    const click = (page, name) => page.locator(h.debug(name)).click();
    const saved = page => page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.status?.kind === 'saved', null, { timeout: 60000 });
    async function accessible(locator, page) {
      await locator.scrollIntoViewIfNeeded(); assert(await locator.isVisible()); const b = await locator.boundingBox(), v = page.viewportSize();
      assert(b.width > 0 && b.height > 0 && b.x >= -1 && b.x + b.width <= v.width + 1 && b.y < v.height && b.y + b.height > 0, JSON.stringify(b));
    }
    async function firstBattle(page, reduced) {
      await click(page, 'help-open');
      const motion = page.locator(h.debug('help-reduced-motion'));
      if (await motion.getAttribute('aria-pressed') !== String(reduced)) await motion.click();
      await click(page, 'help-close'); await click(page, 'mobile:start-combat');
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
      return h.read(page);
    }
    for (const mode of ['dev', 'preview']) {
      app = await h.appServer(mode);
      let normal;
      for (const viewport of viewports) {
        const label = `${mode}-${viewport.width}x${viewport.height}`;
        const page = await browser.newPage({ viewport }); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('dialog', dialog => dialog.accept());
        await h.boot(page, app.url);
        for (const name of ['help-open', 'mobile:start-combat', 'panel:items', 'm6-import']) await accessible(page.locator(h.debug(name)), page);
        await click(page, 'panel:items'); await click(page, 'item-codex-toggle');
        await accessible(page.locator(h.debug('codex-search')), page);
        const beforeSearch = (await h.read(page)).state;
        await page.locator(h.debug('codex-search')).pressSequentially('dfe');
        assert.deepEqual((await h.read(page)).state, beforeSearch);
        await page.locator(h.debug('codex-search')).fill('');
        await click(page, 'help-open');
        const help = await page.locator(h.debug('help-dialog')).innerText();
        assert(!help.includes('野怪掉落尚未开放')); assert(help.includes('M7 旧档独立保留'));
        await accessible(page.locator(h.debug('help-close')), page);
        await page.keyboard.press('Escape');
        const settled = await firstBattle(page, false);
        assert.equal(settled.state.roundDefinitionId, '1-2'); assert.equal(settled.state.phase, 'settlement');
        assert(settled.state.m8.loot.receipts.length > 0, 'actual first-battle loot');
        if (viewport.height === 1000) normal = { state: settled.state, events: settled.combatEvents };
        // The lifecycle control changes identity after Continue; native double click must not start 1-3.
        await page.locator(h.debug('mobile:continue')).dblclick();
        await page.waitForTimeout(350);
        assert.equal((await h.read(page)).state.phase, 'preparation'); assert.equal((await h.read(page)).state.roundDefinitionId, '1-3');
        check(`${label}-opening-layout-search-and-double-continue`);
        await click(page, 'mobile:start-combat'); await click(page, 'help-open');
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
        const pending = (await h.read(page)).state;
        assert.equal(pending.phase, 'choice'); assert.equal(pending.pendingChoice.kind, 'component');
        assert(await page.evaluate(() => document.querySelector('.choice-overlay').inert));
        assert(await page.evaluate(() => document.querySelector('[data-debug="help-dialog"]').contains(document.activeElement)));
        const rewardBox = await page.locator('.choice-overlay [data-debug^="choice:"]').first().boundingBox();
        assert(rewardBox); await page.mouse.click(rewardBox.x + rewardBox.width / 2, rewardBox.y + rewardBox.height / 2);
        assert.deepEqual((await h.read(page)).state, pending, 'covered reward ignores pointer');
        if (await page.locator(h.debug('help-dialog')).isHidden()) await click(page, 'help-open');
        for (const key of ['d', 'f', 'e', 'Tab']) await page.keyboard.press(key);
        assert(await page.evaluate(() => document.querySelector('[data-debug="help-dialog"]').contains(document.activeElement)));
        await page.locator(h.debug('help-reduced-motion')).focus();
        for (const key of ['Enter', 'Enter', 'Space', 'Space']) await page.keyboard.press(key);
        assert.deepEqual((await h.read(page)).state, pending, 'covered reward ignores keyboard');
        await click(page, 'help-close');
        await page.locator('.choice-overlay [data-debug^="choice:"]').first().click();
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'choice');
        assert.equal((await h.read(page)).state.items.length, pending.items.length + 1);
        check(`${label}-help-over-live-reward-pointer-and-keyboard`);
        await h.importFixture(page, fixture);
        await click(page, 'help-open'); const beforeHelp = (await h.read(page)).state;
        for (const key of ['d', 'f', 'e']) await page.keyboard.press(key);
        await page.keyboard.press('Tab'); assert(await page.evaluate(() => document.querySelector('[data-debug="help-dialog"]').contains(document.activeElement)));
        await page.keyboard.press('Escape'); assert.deepEqual((await h.read(page)).state, beforeHelp);
        // A real input field must isolate shortcuts even when both purchases can be afforded.
        const input = page.locator(h.debug('m6-seed-input')); await input.fill(''); await input.pressSequentially('dfe');
        assert.deepEqual((await h.read(page)).state, beforeHelp); await input.fill('42');
        await click(page, 'help-open'); await click(page, 'help-close');
        for (const [key, command] of [['d', d.api.rerollShop], ['f', d.api.buyXp]]) {
          const before = (await h.read(page)).state, first = command(before); assert(first.ok, `${label}: funded ${key}`);
          const expected = command(first.state); assert(expected.ok, `${label}: funded ${key} repeat`);
          await page.keyboard.down(key); await page.keyboard.down(key); await page.keyboard.up(key);
          assert.deepEqual((await h.read(page)).state, expected.state, `${key} native repeat must commit both commands in order`);
        }
        await page.locator('canvas').scrollIntoViewIfNeeded();
        let snapshot = await h.read(page), token = snapshot.tokens.find(t => t.visible && snapshot.state.preparation.units.some(u => u.id === t.id && u.team === 'player' && u.location.kind === 'board'));
        assert(token, 'visible player token');
        await page.mouse.move(token.screenX, token.screenY); await page.mouse.down(); await page.mouse.move(token.screenX + 30, token.screenY + 30, { steps: 5 });
        await page.waitForFunction(id => window.__CAT_DEBUG__.read().gesture?.id === id, token.id);
        // The product cancels a mouse drag released outside a valid cell. Escape
        // dismisses dialogs/popovers; it is not a board-drag cancellation key.
        const canvasBox = await page.locator('canvas').boundingBox(); assert(canvasBox);
        assert(canvasBox.x > 4, 'visible gutter beside desktop canvas');
        await page.mouse.move(canvasBox.x - 2, Math.max(2, Math.min(viewport.height - 2, token.screenY)), { steps: 5 });
        await page.mouse.up(); assert.deepEqual((await h.read(page)).state, snapshot.state); assert.equal((await h.read(page)).gesture, null);
        const expectedSale = d.api.sellUnit(snapshot.state, token.id); assert(expectedSale.ok);
        await page.mouse.move(token.screenX, token.screenY); await page.keyboard.down('e'); await page.keyboard.down('e'); await page.keyboard.up('e');
        assert.deepEqual((await h.read(page)).state, expectedSale.state, 'E repeats do not sell another unit');
        await saved(page); const stored = await h.read(page);
        await page.reload(); await page.waitForFunction(() => { const b = document.querySelector('[data-debug="m6-continue"]'); return b && !b.disabled; });
        await click(page, 'm6-continue'); await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active');
        assert.deepEqual((await h.read(page)).state, stored.state);
        check(`${label}-shortcuts-repeat-help-drag-cancel-and-refresh`);
        await saved(page); const live = await h.read(page);
        const choices = page.getByLabel('选择已完成战斗'); await accessible(choices, page); await choices.selectOption('0');
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'replay');
        const slider = page.getByLabel('按 tick 跳转'); await accessible(slider, page); await slider.focus(); await page.keyboard.press('End');
        await page.waitForFunction(() => { const r = window.__CAT_DEBUG__.read().m6.replay; return r.tick === r.endTick; });
        for (const speed of ['1×', '2×', '4×']) await page.getByRole('button', { name: speed, exact: true }).click();
        await page.getByRole('button', { name: '返回当前局', exact: true }).click();
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active');
        const returned = await h.read(page); assert.deepEqual(returned.state, live.state); assert.deepEqual(returned.m6.token, live.m6.token);
        assert.deepEqual(errors, []); await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true });
        check(`${label}-replay-seek-speed-return-read-only`, { battles: live.m6.completedCount }); await page.close();
      }
      const reducedPage = await browser.newPage({ viewport: viewports[0] }); reducedPage.setDefaultTimeout(30000);
      await h.boot(reducedPage, app.url); const reduced = await firstBattle(reducedPage, true);
      assert.deepEqual(reduced.state, normal.state); assert.deepEqual(reduced.combatEvents, normal.events);
      check(`${mode}-normal-reduced-identical-full-first-battle`, { events: normal.events.length }); await reducedPage.close();
      await app.close(); app = null;
    }
    await d.server.close(); d = null;
    // Build the actual Pages base; strict host has no root fallback.
    const pagesDist = path.join(output, 'pages-dist');
    await (await import('vite')).build({ root: h.root, mode: 'pages', logLevel: 'error', build: { outDir: pagesDist } });
    const requests = [], types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    strict = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]), file = path.resolve(pagesDist, url.slice('/cat/'.length) || 'index.html');
      if (!url.startsWith('/cat/') || !file.startsWith(`${pagesDist}/`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { requests.push([url, 404]); res.writeHead(404); res.end(); return; }
      requests.push([url, 200]); res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => strict.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${strict.address().port}/cat/`, page = await browser.newPage({ viewport: viewports[0] }); page.setDefaultTimeout(30000);
    page.on('pageerror', e => report.errors.push(e.message)); await h.boot(page, url); await saved(page); const before = (await h.read(page)).state;
    const assetStatuses = await page.evaluate(async paths => Promise.all(paths.map(async p => [p, (await fetch(p)).status])), assets.map(a => a.path));
    assert(assetStatuses.every(([, status]) => status === 200));
    await page.reload(); await page.waitForFunction(() => !document.querySelector('[data-debug="m6-continue"]').disabled); await click(page, 'm6-continue');
    await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active'); assert.deepEqual((await h.read(page)).state, before);
    await click(page, 'panel:units');
    const neutrals = (await h.read(page)).tokens.filter(t => t.visible && t.id.startsWith('["pve"'));
    assert.equal(neutrals.length, 2); assert(neutrals.every(t => t.name && t.symbol), 'identifiable neutral placeholders');
    assert(requests.every(([request, status]) => request.startsWith('/cat/') && status === 200), JSON.stringify(requests.filter(([, s]) => s !== 200)));
    check('strict-pages-subpath-resources-refresh-neutral-placeholders', { assets: assetStatuses.length, requests: requests.length });
    assert.deepEqual(report.errors, []); report.passed = true;
  } catch (error) { report.errors.push(error.stack); console.error(error); process.exitCode = 1; }
  finally { await browser?.close(); await app?.close(); await d?.server.close(); if (strict) await new Promise(resolve => strict.close(resolve)); fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2)); console.log(`${report.passed ? 'PASSED' : 'FAILED'} ${output}`); }
})();
