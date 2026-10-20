/* Independent native vest + belt -> Sunfire gate, using a validated public-reward save.
 * Linux, after npm run build: EQUIPMENT_TAB=visible (then hidden) node scripts/verify-equipment-synthesis.cjs
 * Each invocation runs dev and production preview; no BR4 fixture dependency.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const h = require('./m8-b10-browser-support.cjs');
const { installEquipmentCommands, dragEquipment, unitPoint } = require('./equipment-input.cjs');
const output = path.resolve(process.env.SYNTHESIS_EVIDENCE_DIR || `artifacts/equipment-synthesis-${process.env.EQUIPMENT_TAB || 'visible'}`);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { ...h.identity(), equipmentTab: process.env.EQUIPMENT_TAB || 'visible', checks: [], errors: [], passed: false };
  let d, browser, app, page;
  try {
    d = await h.domain();
    const { equipmentSynthesisFixture } = await d.load('/tests/fixtures/equipment-synthesis.ts');
    const { envelope, componentIds, holderId } = await equipmentSynthesisFixture();
    const file = path.join(output, 'fixture.json');
    fs.writeFileSync(file, JSON.stringify(envelope));
    report.fixture = { file: path.basename(file), runId: envelope.runId, round: envelope.match.roundDefinitionId,
      completedBattles: envelope.battles.length, components: componentIds, holderId,
      provenance: 'public Match commands and rewards; validateEnvelope + validateBattleCollection passed' };
    const selectors = await d.load('/src/simulation/item-selectors.ts');
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    report.browser = browser.version();
    for (const mode of ['dev', 'preview']) {
      app = await h.appServer(mode);
      page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => report.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
      page.on('dialog', dialog => dialog.accept());
      await installEquipmentCommands(page);
      await h.boot(page, app.url);
      await h.importFixture(page, { file, runId: envelope.runId });
      await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
      const state = async () => (await h.read(page)).state;
      const equal = async expected => assert.deepEqual(await state(), expected, 'complete MatchState');
      await equal(envelope.match);
      assert.equal(await page.locator(h.debug('panel:items')).isVisible(), report.equipmentTab !== 'hidden', 'requested equipment tab mode');
      assert(!envelope.match.items.some(item => item.location.kind === 'unit' && item.location.unitId === holderId), 'holder starts with empty slots');
      const drops = [];
      let expected = envelope.match;
      for (const [index, itemId] of componentIds.entries()) {
        const preview = selectors.previewEquip(expected, itemId, holderId, 0);
        assert(preview.allowed, `component ${index + 1} can be dropped on the same unit`);
        if (index === 1) assert.equal(preview.combination?.resultDefinitionId, 'sunfire-cape');
        const result = d.api.equipItem(expected, itemId, holderId, 0);
        assert(result.ok, result.reason);
        expected = result.state;
        // Domain calls above compute the oracle only. These native drags alone commit browser state.
        drops.push(await dragEquipment(page, itemId, holderId));
        await equal(expected);
        if (index === 0) {
          assert.deepEqual(expected.items.find(item => item.id === itemId)?.location, { kind: 'unit', unitId: holderId, slot: 0 });
          assert(expected.items.some(item => item.id === componentIds[1] && item.location.kind === 'inventory'), 'second component remains in inventory before its drag');
        }
      }
      const observed = await state(), view = selectors.readUnitEquipment(observed, holderId);
      const finished = observed.items.find(item => item.id === view?.slots[0].itemInstanceId);
      assert.equal(finished?.definitionId, 'sunfire-cape', 'expected finished item occupies the unit equipment slot');
      assert.deepEqual(finished.location, { kind: 'unit', unitId: holderId, slot: 0 });
      for (const id of componentIds) {
        assert(!observed.items.some(item => item.id === id && item.location.kind === 'inventory'), `component ${id} left inventory`);
        assert(!observed.items.some(item => item.id === id), `component ${id} was consumed by synthesis`);
        assert.equal(await page.locator(h.debug(`item:${id}`)).count(), 0, `component ${id} disappeared from the item bench`);
      }
      const point = unitPoint(await h.read(page), holderId);
      await page.mouse.click(point.x, point.y);
      const collapsedStats = page.locator('details.stats-details:not([open]) > summary');
      if (await collapsedStats.count()) await collapsedStats.click();
      const detail = page.locator(h.debug(`unit-equipment:${holderId}`));
      await detail.waitFor({ state: 'visible' });
      assert.equal(await detail.innerText(), '装备槽：1 日炎斗篷 · 2 空 · 3 空');
      await equal(expected);
      fs.writeFileSync(path.join(output, `${mode}-state.json`), JSON.stringify(observed, null, 2));
      await page.screenshot({ path: path.join(output, `${mode}-native-component-synthesis.png`) });
      report.checks.push({ name: `${mode}-native-component-synthesis`, passed: true,
        evidence: { components: componentIds, holderId, item: finished.id, definitionId: finished.definitionId, drops, exactState: true } });
      console.log(`PASS ${mode}-native-component-synthesis`);
      await page.close(); page = null;
      await app.close(); app = null;
    }
    assert.deepEqual(report.errors, [], 'no browser errors');
    report.finalIdentity = h.identity();
    assert.equal(report.finalIdentity.sourceFingerprint, report.sourceFingerprint, 'runtime source unchanged');
    assert.equal(report.checks.length, 2, 'both dev and preview reached native synthesis');
    report.passed = true;
  } catch (error) {
    report.failure = error.stack; console.error(error); process.exitCode = 1;
    if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
    await page?.close(); await browser?.close(); await app?.close(); await d?.server.close();
  }
})();
