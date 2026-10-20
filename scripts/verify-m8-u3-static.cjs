const { installEquipmentCommands } = require('./equipment-input.cjs');
/* UR-U3-07: production preview, real app, native inputs, authoritative catalogue.
 * Inventory/equipped popovers use a public seed-42 route imported through the save UI.
 * Run after npm run build. CHROMIUM_PATH and U3_STATIC_EVIDENCE_DIR are optional.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const h = require('./m8-b10-browser-support.cjs');
const output = path.resolve(process.env.U3_STATIC_EVIDENCE_DIR || 'artifacts/m8-u3-static');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { ...h.identity(), mode: 'production preview', viewport: [1440, 1000], checks: [], errors: [], expected404: [], passed: false };
  let d, app, browser;
  try {
    d = await h.domain();
    const catalog = (await d.load('/src/simulation/item-catalog.ts')).readItemCatalog();
    const assets = (await d.load('/src/presentation/s13-asset-manifest.ts')).S13_ASSETS;
    const fixture = await h.prefixFixture(d, output);
    report.fixture = { runId: fixture.runId, roundId: fixture.roundId, battles: fixture.battles, provenance: 'public commands only, validated production save' };
    await d.server.close(); d = null;
    app = await h.appServer();
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    report.browser = browser.version();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    page.on('dialog', dialog => dialog.accept());
    await installEquipmentCommands(page); await h.boot(page, app.url); await h.importFixture(page, fixture);

    const before = await h.read(page);
    const unchanged = async () => { const after = await h.read(page); assert.deepEqual(after.state, before.state); assert.deepEqual(after.combatEvents, before.combatEvents); };
    async function check(name, fn) {
      const evidence = await fn(); await unchanged(); report.checks.push({ name, passed: true, evidence }); console.log(`PASS ${name}`);
    }
    await page.locator(h.debug('item-codex-toggle')).click();
    await check('catalog-count-and-filters', async () => {
      const expected = { all: catalog, component: catalog.filter(e => e.kind === 'component'), completed: catalog.filter(e => e.kind === 'completed'),
        unique: catalog.filter(e => e.unique), slots: catalog.filter(e => e.slotCost > 1), provisional: catalog.filter(e => e.evidenceStatus === 'approved-provisional') };
      assert.deepEqual(Object.values(expected).map(items => items.length), [44, 8, 36, 6, 1, 2]);
      assert.deepEqual(expected.unique.map(e => e.id).sort(), ['blue-buff', 'edge-of-night', 'last-whisper', 'morellonomicon', 'quicksilver', 'sunfire-cape']);
      for (const [filter, entries] of Object.entries(expected)) {
        const button = page.locator(h.debug(`codex-filter:${filter}`)); assert.match(await button.innerText(), new RegExp(` ${entries.length}$`)); await button.click();
        assert.deepEqual((await page.locator('[data-codex-item]:not([hidden])').evaluateAll(nodes => nodes.map(n => n.dataset.codexItem))).sort(), entries.map(e => e.id).sort());
      }
      await page.locator(h.debug('codex-filter:all')).click();
      return Object.fromEntries(Object.entries(expected).map(([key, entries]) => [key, entries.length]));
    });
    await check('recipe-matrix-64-cells-36-results', async () => {
      const cells = await page.locator('[data-recipe-cell]').evaluateAll(nodes => nodes.map(n => ({ pair: n.dataset.recipeCell, id: n.dataset.itemDef, provisional: n.classList.contains('provisional') })));
      assert.equal(cells.length, 64); assert.equal(new Set(cells.map(c => c.id)).size, 36);
      for (const cell of cells) { const e = catalog.find(e => e.id === cell.id); assert.deepEqual(cell.pair.split('+').sort(), [...e.recipe].sort()); assert.equal(cell.provisional, e.evidenceStatus === 'approved-provisional'); }
      return { cells: cells.length, results: 36 };
    });
    const pop = page.locator('#item-popover');
    async function description(anchor, id, via = 'focus') {
      const entry = catalog.find(e => e.id === id);
      await anchor.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Scrolling a new anchor under a stationary pointer can show then dismiss
      // its hover popover. Enter it afresh, as an actual mouse inspection does.
      if (via === 'hover') { await page.mouse.move(0, 0); await anchor.hover(); } else await anchor.focus();
      try { await page.waitForFunction(id => { const p = document.querySelector('#item-popover'); return p && !p.hidden && p.dataset.itemDef === id; }, id); }
      catch (error) { await page.screenshot({ path: path.join(output, `popover-failure-${id}-${via}.png`), fullPage: true }); throw new Error(`${id}/${via}: ${error.message}; ${await anchor.evaluate(n => n.outerHTML)}`); }
      assert.deepEqual(await pop.locator('.item-pop-effects li').allTextContents(), entry.effectDescriptions);
      assert.match(await pop.innerText(), new RegExp(`占用装备槽 ${entry.slotCost}`));
      assert((await pop.innerText()).includes(entry.unique ? '声明：唯一' : '声明：非唯一'));
      assert((await pop.innerText()).includes(entry.evidenceStatus === 'approved-provisional' ? '批准暂行，待历史核验' : '来源已核对'));
      assert((await pop.innerText()).includes('临时译名（待核实）'));
    }
    await check('all-44-verbatim-popovers-and-dismissal', async () => {
      for (const entry of catalog) {
        console.log(`  popover ${entry.id}`);
        const tile = page.locator(`[data-codex-item="${entry.id}"]`);
        await description(tile, entry.id);
        await page.keyboard.press('Escape'); assert(await pop.isHidden());
      }
      const tile = page.locator('[data-codex-item="red-buff"]');
      await description(tile, 'red-buff', 'hover'); await page.mouse.move(0, 0); assert(await pop.isHidden());
      await description(tile, 'red-buff'); await page.locator(h.debug('codex-search')).focus(); assert(await pop.isHidden());
      for (const id of ['red-buff', 'runaans-hurricane']) assert((await page.locator(`[data-codex-item="${id}"]`).innerText()).includes('暂定'));
      assert((await page.locator('[data-codex-item="thiefs-gloves"]').innerText()).includes('占3槽'));
      return { definitions: 44, dismiss: ['Escape', 'pointer leave', 'blur'] };
    });
    await check('matrix-native-keyboard-and-popover', async () => {
      const first = page.locator('[data-recipe-cell]').first(); await first.scrollIntoViewIfNeeded(); await first.focus();
      await page.keyboard.press('ArrowRight');
      const active = await page.evaluate(() => ({ id: document.activeElement.dataset.itemDef, pair: document.activeElement.dataset.recipeCell }));
      assert.equal(active.pair, await page.locator('[data-recipe-cell]').nth(1).getAttribute('data-recipe-cell'));
      await description(page.locator(`[data-recipe-cell="${active.pair}"]`), active.id);
      assert.equal(await page.locator('.recipe-matrix [tabindex="0"]').count(), 1);
      await page.keyboard.press('Control+End'); assert.equal(await page.evaluate(() => document.activeElement.dataset.recipeCell), await page.locator('[data-recipe-cell]').last().getAttribute('data-recipe-cell'));
    });
    await check('inventory-and-equipped-popovers', async () => {
      const inventory = page.locator('.item-inventory [data-item-def]').first();
      const worn = before.state.items.find(item => item.location.kind === 'unit');
      assert(worn, 'public fixture has equipment');
      const equipped = page.locator(`[data-codex-item="${worn.definitionId}"]`);
      assert(await inventory.count(), 'public fixture has inventory'); assert(await equipped.count(), 'equipped definition has a catalogue anchor');
      for (const anchor of [inventory, equipped]) { const id = await anchor.getAttribute('data-item-def'); await description(anchor, id, 'hover'); await description(anchor, id); }
    });
    await check('search-shortcuts-are-read-only', async () => {
      const search = page.locator(h.debug('codex-search')); await search.fill(''); await search.pressSequentially('dfe'); assert.equal(await search.inputValue(), 'dfe'); await search.fill('');
    });
    await check('28-missing-icons-use-identifiable-placeholders', async () => {
      const known = new Set(assets.filter(a => a.kind === 'item').map(a => a.id));
      const missing = catalog.filter(e => !known.has(e.id)); assert.equal(missing.length, 28);
      for (const e of missing) { const tile = page.locator(`[data-codex-item="${e.id}"]`); assert.equal(await tile.locator('img').count(), 0); assert.equal(await tile.locator('.item-glyph').innerText(), [...e.name].slice(0, 2).join('')); assert.equal(await tile.locator(`.item-mark.kind-${e.kind}`).count(), 1); }
      return missing.map(e => e.id);
    });
    assert.deepEqual(report.errors, []);
    await page.close();
    // A separate context forces a real request instead of a warm-cache image.
    const broken = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    broken.setDefaultTimeout(15000);
    broken.on('pageerror', error => report.errors.push(error.message));
    const sword = assets.find(a => a.kind === 'item' && a.id === 'sword'); let intercepted = 0;
    await broken.route(`**/${sword.path}`, route => { intercepted++; report.expected404.push(route.request().url()); return route.fulfill({ status: 404, body: 'B10 controlled icon failure' }); });
    await installEquipmentCommands(broken); await h.boot(broken, app.url);  await broken.locator(h.debug('item-codex-toggle')).click();
    const swordTile = broken.locator('[data-codex-item="sword"]'); await swordTile.scrollIntoViewIfNeeded();
    await broken.waitForFunction(() => { const tile = document.querySelector('[data-codex-item="sword"]'); return tile && !tile.querySelector('img') && tile.querySelector('.item-glyph'); });
    assert(intercepted > 0); assert.equal(await swordTile.locator('.item-glyph').innerText(), [...catalog.find(e => e.id === 'sword').name].slice(0, 2).join(''));
    report.checks.push({ name: 'controlled-404-fallback', passed: true, intercepted });
    await broken.screenshot({ path: path.join(output, 'controlled-404.png') });
    assert.deepEqual(report.errors, []); report.passed = true;
  } catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
  finally { await browser?.close(); await app?.close(); await d?.server.close(); fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2)); console.log(`${report.passed ? 'PASSED' : 'FAILED'} ${output}`); }
})();
