/* UR-U3-08: desktop native input through the real BoardScene / StrategyPanel.
 * Test-only main-module instrumentation captures the scene; fixture setup injects
 * permanent inventory after public opening choices, then uses public commands.
 * No hit-test, preview, event handler, CSS or rule is stubbed. This fixture suite
 * supplements (does not replace) the uninjected full-match CI input gate.
 * Run from the reviewed checkout: node scripts/verify-m8-u3-dynamic.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const output = path.resolve(process.env.U3_EVIDENCE_DIR || 'artifacts/m8-u3-dynamic');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    runnerHash: createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    viewport: [1440, 1000], fixture: 'public opening choices + permanent inventory; real BoardScene callbacks',
    checks: [], errors: [], passed: false };
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser, page;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    report.browser = browser.version();
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route('**/src/main.ts', async route => {
      const response = await route.fetch();
      const source = await response.text();
      assert(source.includes('new Phaser.Game('), 'main instrumentation anchor');
      await route.fulfill({ response, body: source.replace('new Phaser.Game(', `
        const originalCreate = BoardScene.prototype.create;
        BoardScene.prototype.create = function (...args) {
          window.__U3_SCENE__ = this;
          return originalCreate.apply(this, args);
        };
        new Phaser.Game(`) });
    });
    await page.addInitScript(() => {
      window.__U3_INPUTS__ = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'keydown']) {
        window.addEventListener(type, event => window.__U3_INPUTS__.push({ type, trusted: event.isTrusted,
          x: event.clientX, y: event.clientY, target: event.target?.tagName }), true);
      }
    });
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => window.__CAT_DEBUG__ && window.__U3_SCENE__);
    await page.locator('[data-debug="m6-seed-input"]').fill('42');
    await page.locator('[data-debug="m6-fixed-start"]').click();
    await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active');

    async function setup(kind = 'empty') {
      await page.evaluate(async kind => {
        const api = await import('/src/simulation/match.ts');
        const selectors = await import('/src/simulation/item-selectors.ts');
        const feedback = await import('/src/presentation/equipment-feedback.ts');
        const accepted = result => { if (!result.ok) throw Error(result.reason); return result.state; };
        let state = api.createMatch(42);
        while (state.phase === 'choice') {
          const c = state.pendingChoice;
          state = accepted(api.selectChoice(state, c.choiceId, c.generation, c.offers[0]));
        }
        for (const [index, id] of ['unit-1', 'unit-2', 'unit-3'].entries())
          state = accepted(api.deployMatchUnit(state, id, { kind: 'board', cell: { col: 1 + 2 * index, row: 4 } }));
        const definitions = ['sword', 'thiefs-gloves', 'blue-buff', 'blue-buff', 'vest', 'cloak', 'sword'];
        state = { ...state, nextItemSerial: 107, items: definitions.map((definitionId, index) => ({
          id: `item-${100 + index}`, definitionId, location: { kind: 'inventory' },
        })) };
        const equip = (item, slot = 0) => { state = accepted(api.equipItem(state, item, 'unit-1', slot)); };
        if (kind === 'tg') equip('item-101');
        if (kind === 'occupied') equip('item-104');
        if (kind === 'full') { equip('item-104'); equip('item-105', 1); equip('item-106', 2); }
        if (kind === 'unique') equip('item-102');
        const scene = window.__U3_SCENE__;
        scene.clearCombatEffects();
        scene.session.matchState = state; // Explicit fixture boundary, never used during the interaction.
        scene.selectedId = null;
        scene.strategyPanel.reset();
        scene.sync();
        window.__U3_CALLS__ = [];
        if (!scene.session.__u3Observed) {
          for (const method of ['equip', 'combine']) {
            const original = scene.session[method].bind(scene.session);
            scene.session[method] = (...args) => {
              const result = original(...args);
              window.__U3_CALLS__.push({ method, args, ok: result.ok, reason: result.reason, events: result.events });
              return result;
            };
          }
          scene.session.__u3Observed = true;
        }
        window.__U3_API__ = { api, selectors, feedback };
        window.__U3_INPUTS__ = [];
      }, kind);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
      return read();
    }
    const read = () => page.evaluate(() => ({ state: window.__CAT_DEBUG__.read().state,
      combatEvents: window.__CAT_DEBUG__.read().combatEvents, calls: window.__U3_CALLS__,
      status: document.querySelector('.panel-status').textContent, inputs: window.__U3_INPUTS__,
      gesture: window.__CAT_DEBUG__.read().gesture }));
    const click = name => page.locator(`[data-debug="${name}"]`).click();
    async function check(name, fn) {
      try { const evidence = await fn(); report.checks.push({ name, passed: true, evidence }); }
      catch (error) {
        report.checks.push({ name, passed: false, failure: error.stack });
        await page.screenshot({ path: path.join(output, `${name}.png`) });
      }
      const observation = await read();
      fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(observation, null, 2));
      Object.assign(report.checks.at(-1), { artifact: `${name}.json`,
        trustedInputs: observation.inputs.filter(input => input.trusted).length });
      console.log(`${report.checks.at(-1).passed ? 'PASS' : 'FAIL'} ${name}`);
    }
    function unchanged(before, after) {
      assert.deepEqual(after.state, before.state, 'complete MatchState including RNG and equipment state');
      assert.deepEqual(after.combatEvents, before.combatEvents, 'combat event ledger');
    }
    async function drag(item, unit) {
      const source = page.locator(`[data-debug="item:${item}"]`);
      await source.scrollIntoViewIfNeeded();
      const box = await source.boundingBox();
      const token = await page.evaluate(id => window.__CAT_DEBUG__.read().tokens.find(t => t.id === id), unit);
      assert(token?.visible, 'visible target token');
      assert(token.screenX > 0 && token.screenX < 1440 && token.screenY > 0 && token.screenY < 1000,
        `target on screen: ${JSON.stringify(token)}`);
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName,
        { x: token.screenX, y: token.screenY }), 'CANVAS', 'native destination really hits canvas');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(token.screenX, token.screenY, { steps: 16 });
      await page.mouse.up();
      const after = await read();
      assert(after.inputs.some(e => e.type === 'pointerdown') && after.inputs.some(e => e.type === 'pointerup'));
      assert(after.inputs.every(e => e.trusted), 'native trusted input');
      assert.equal(after.gesture, null, 'gesture released');
      return after;
    }

    await check('drag-tg-holder', async () => {
      const before = await setup('tg'), after = await drag('item-100', 'unit-1');
      unchanged(before, after); assert.equal(after.calls.length, 0);
      assert.equal(after.status, await page.evaluate(() => window.__U3_API__.feedback.EQUIPMENT_FAILURE_TEXT['exclusive-slots']));
      return { status: after.status, commands: after.calls.length };
    });
    await check('drag-first-allowed-slot', async () => {
      await setup('occupied'); const after = await drag('item-100', 'unit-1');
      assert.equal(after.calls.length, 1); assert.equal(after.calls[0].ok, true);
      assert.deepEqual(after.calls[0].args, ['item-100', 'unit-1', 1]);
      assert(after.calls[0].events.some(e => e.type === 'itemEquipped' && e.slot === 1));
      return after.calls;
    });
    await check('drag-full-holder', async () => {
      const before = await setup('full'), after = await drag('item-100', 'unit-1');
      unchanged(before, after); assert.equal(after.calls.length, 0);
      assert.equal(after.status, '该单位的 3 个装备槽已满'); return { status: after.status };
    });
    await check('drag-enemy', async () => {
      const before = await setup();
      const enemy = before.state.preparation.units.find(u => u.team === 'enemy');
      const after = await drag('item-100', enemy.id);
      unchanged(before, after); assert.equal(after.calls.length, 0);
      assert.equal(after.status, await page.evaluate(() => window.__U3_API__.feedback.EQUIPMENT_FAILURE_TEXT['unknown-unit']));
      return { status: after.status };
    });
    await check('drag-tg-empty-holder', async () => {
      await setup(); const after = await drag('item-101', 'unit-1');
      assert.equal(after.calls.length, 1); assert.equal(after.calls[0].ok, true);
      assert.deepEqual(after.state.items.find(i => i.id === 'item-101').location, { kind: 'unit', unitId: 'unit-1', slot: 0 });
      assert.equal(after.state.temporaryEquipment.filter(i => i.holderId === 'unit-1').length, 2);
      assert(after.calls[0].events.some(e => e.type === 'itemEquipped' && e.slot === 0));
      return after.calls;
    });
    await check('unique-preview-click-atomic', async () => {
      const before = await setup('unique'); await click('item:item-103');
      unchanged(before, await read());
      for (let slot = 0; slot < 3; slot++) assert.equal(await page.locator(`[data-debug="equipment:unit-1:${slot}"]`).getAttribute('data-preview'), 'unique-conflict');
      assert.match(await page.locator('[data-debug="equipment:unit-1:0"]').getAttribute('class'), /equip-conflict/);
      assert.match(await page.locator('.equipment-row').first().innerText(), /冲突：蓝霸符/);
      await click('equipment:unit-1:1'); const after = await read(); unchanged(before, after);
      assert.equal(after.calls.length, 1); assert.equal(after.calls[0].reason, 'unique-conflict');
      assert.equal(after.status, await page.evaluate(() => window.__U3_API__.feedback.EQUIPMENT_FAILURE_TEXT['unique-conflict']));
      return { status: after.status, calls: after.calls };
    });
    await check('tg-preview-slot3-temporary-readonly', async () => {
      const before = await setup('occupied'); await click('item:item-101'); unchanged(before, await read());
      for (let slot = 0; slot < 3; slot++) assert.equal(await page.locator(`[data-debug="equipment:unit-1:${slot}"]`).getAttribute('data-preview'), 'exclusive-slots');
      assert.match(await page.locator('.equipment-row').nth(1).innerText(), /将占用槽 1、2、3/);
      await click('equipment:unit-2:2'); const after = await read();
      assert.equal(after.calls[0].ok, true);
      assert.equal(after.state.items.find(i => i.id === 'item-101').location.slot, 0);
      for (const slot of [1, 2]) assert.equal(await page.locator(`[data-debug="equipment:unit-2:${slot}"]`).isDisabled(), true);
      const text = await page.locator('.equipment-row').nth(1).innerText();
      assert.equal((text.match(/来自 窃贼手套/g) || []).length, 2);
      assert.equal((text.match(/仅 2-1 本轮有效 · 不可操作/g) || []).length, 2);
      return { text };
    });
    await check('combine-invalid-and-success', async () => {
      const before = await setup(); await click('item:item-100'); await click('item:item-102'); unchanged(before, await read());
      assert.equal(await page.locator('[data-debug="combine-preview"]').getAttribute('data-reason'), 'invalid-recipe');
      assert.equal(await page.locator('[data-debug="combine-items"]').isDisabled(), true);
      await click('item:item-102'); await click('item:item-106');
      assert.match(await page.locator('[data-debug="combine-items"]').innerText(), /合成 死亡之刃/);
      unchanged(before, await read()); await click('combine-items'); const after = await read();
      assert.equal(after.calls.length, 1); assert.equal(after.calls[0].ok, true);
      assert(after.state.items.some(i => i.definitionId === 'deathblade')); return after.calls;
    });
    await check('tg-holder-preview-and-detail', async () => {
      const before = await setup('tg');
      const token = await page.evaluate(() => window.__CAT_DEBUG__.read().tokens.find(t => t.id === 'unit-1'));
      await page.mouse.click(token.screenX, token.screenY);
      const detail = await page.locator('.combat-sources').innerText();
      assert.equal((detail.match(/来自 窃贼手套/g) || []).length, 2);
      assert.equal((detail.match(/仅 2-1 本轮有效 · 不可操作/g) || []).length, 2);
      await click('item:item-100'); unchanged(before, await read());
      assert.equal(await page.locator('[data-debug="equipment:unit-1:0"]').getAttribute('data-preview'), 'exclusive-slots');
      assert.match(await page.locator('[data-debug="equipment:unit-1:0"]').getAttribute('class'), /equip-conflict/);
      assert.match(await page.locator('.equipment-row').first().innerText(), /冲突：窃贼手套/);
      assert.equal(await page.locator('.item-inventory [data-temporary-id]').count(), 0);
      return { detail, unchanged: true };
    });
    await check('same-item-and-temporary-domain-copy', async () => {
      await setup('tg');
      return page.evaluate(() => {
        const { api, selectors, feedback } = window.__U3_API__, scene = window.__U3_SCENE__;
        const state = scene.session.state, before = JSON.stringify(state);
        const check = (ok, message) => { if (!ok) throw Error(message); };
        const id = state.temporaryEquipment[0].temporaryId;
        for (const result of [selectors.previewEquip(state, id, 'unit-2', 0), selectors.previewCombine(state, id, 'item-100'),
          api.equipItem(state, id, 'unit-2', 0), api.combineItems(state, id, 'item-100')]) check(result.reason === 'temporary-item', 'temporary-item reason');
        for (const result of [selectors.previewCombine(state, 'item-100', 'item-100'), api.combineItems(state, 'item-100', 'item-100')])
          check(result.reason === 'same-item', 'same-item reason');
        // This selection is intentionally unreachable by ordinary clicks; copy-only check.
        scene.strategyPanel.selectedItems = ['item-100', 'item-100']; scene.strategyPanel.render();
        check(document.querySelector('[data-debug="combine-preview"]').textContent.includes(feedback.EQUIPMENT_FAILURE_TEXT['same-item']), 'same-item copy');
        check(document.querySelector('[data-debug="combine-items"]').disabled, 'same-item disabled');
        check(JSON.stringify(state) === before, 'preview and rejected commands are read-only');
        return { temporaryId: id, sameItem: true, unchanged: true };
      });
    });
    assert.deepEqual(report.errors, [], 'no page errors');
    report.passed = report.checks.every(check => check.passed);
  } catch (error) { report.failure = error.stack; }
  finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
  }
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, output, failure: report.failure }));
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
