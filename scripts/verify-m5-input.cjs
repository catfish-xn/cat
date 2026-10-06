/* Native Chromium input gate. Browser state is read-only. Production Match is a
 * consistency model, never an independent mathematical oracle. No combat clock
 * is accelerated and no resources, fixtures, or restored states are injected. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { hash } = require('./m4-evidence.cjs');
const { sourceFingerprint } = require('./m5-evidence.cjs');
const { resizeViewport } = require('./verify-m4-interactions.cjs');
const preview = process.argv.includes('--preview');
const mode = preview ? 'preview' : 'dev';
const metricsOnly = process.argv.includes('--metrics-only');
const port = Number(process.env.M5_PORT ?? (preview ? 4189 : 5189));
const url = `http://127.0.0.1:${port}`;
const output = process.env.M5_EVIDENCE_DIR ?? `artifacts/m5-${metricsOnly ? 'observation' : 'input'}-${mode}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const started = Date.now();
  const report = { mode, coverage: metricsOnly ? 'observation-only' : 'full-input-gate', sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), node: process.version,
    sourceFingerprint: sourceFingerprint(), runnerHash: hash(fs.readFileSync(__filename, 'utf8')), context: { hasTouch: true, isMobile: false }, evidenceKind: 'production-model browser consistency; not independent rule answers',
    interactions: [], errors: [], passed: false };
  let server, model, browser, context, page;
  try {
    const { createServer } = await import('vite');
    model = await createServer({ root: path.resolve(__dirname, '..'), server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
    const api = await model.ssrLoadModule('/src/simulation/match.ts');
    const { readCombatStats } = await model.ssrLoadModule('/src/simulation/combat-s13.ts');
    const accepted = result => { assert(result.ok, result.reason); return structuredClone(result.state); };
    server = spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'),
      ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', data => fs.appendFileSync(path.join(output, 'server.log'), data));
    for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {}
      assert(server.exitCode === null, 'server exited'); if (i === 99) throw Error('server not ready'); await delay(100); }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    report.browser = browser.version();
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, isMobile: false });
    await context.tracing.start({ screenshots: false, snapshots: true });
    await context.addInitScript(() => {
      window.__M5_INPUTS__ = [];
      window.__M5_FRAME_LABEL__ = 'preparation-input'; window.__M5_FRAME_SAMPLES__ = [];
      let previous;
      function sample(now) {
        if (previous !== undefined && window.__M5_FRAME_SAMPLES__.length < 100000)
          window.__M5_FRAME_SAMPLES__.push({ ms: now - previous, label: window.__M5_FRAME_LABEL__ });
        previous = now; requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click', 'keydown'])
        window.addEventListener(type, event => window.__M5_INPUTS__.push({ type, time: performance.now(), trusted: event.isTrusted, code: event.code ?? null,
          repeat: event.repeat ?? false, shieldActive: Boolean(document.querySelector('.choice-overlay.dismissal-shield')), pointerType: event.pointerType ?? null, pointerId: event.pointerId ?? null,
          firesTouchEvents: event.sourceCapabilities?.firesTouchEvents ?? null,
          target: event.target?.closest?.('[data-debug]')?.dataset.debug ?? event.target?.tagName ?? null }), true);
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', event => { if (event.type() === 'error') report.errors.push(event.text()); });
    await page.goto(url); await page.waitForFunction(() => window.__CAT_DEBUG__);
    const cdp = await context.newCDPSession(page);
    const read = () => page.evaluate(() => window.__CAT_DEBUG__.read());
    const state = async () => (await read()).state;
    const initial = await state(); assert.deepEqual(initial, structuredClone(api.createMatch(42)));
    report.versions = Object.fromEntries(['schemaVersion', 'rulesVersion', 'contentVersion', 'contentDigest', 'commandProtocolVersion', 'rngAlgorithm', 'tickMs'].map(key => [key, initial[key]]));
    async function sampleObserver(label) {
      const measured = await page.evaluate(() => {
        const durations = []; let snapshot;
        for (let i = 0; i < 20; i++) { const start = performance.now(); snapshot = window.__CAT_DEBUG__.read(); durations.push(performance.now() - start); }
        const memory = performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null;
        return { durationsMs: durations, memory, ledgerLength: snapshot.combatEvents.length, effects: snapshot.effects, tweens: snapshot.tweens, combatTick: snapshot.state.combat?.tick ?? null };
      });
      return { label, ...measured, cdpHeap: await cdp.send('Runtime.getHeapUsage') };
    }
    function distribution(values) {
      const sorted = [...values].sort((a, b) => a - b), at = p => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] : null;
      return { count: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99), maximum: sorted.at(-1) ?? null };
    }
    const offset = () => page.evaluate(() => window.__M5_INPUTS__.length);
    const quiet = () => page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
    async function click(name, touch = false) {
      await quiet(); const node = page.locator(`[data-debug="${name}"]`);
      // Native locator actions scroll and hit-test the actual DOM target. A
      // raw bounding-box tap can hit the sticky shop covering a panel tab.
      if (await node.count()) { if (touch) await node.tap(); else await node.click(); return; }
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const bounds = (await read()).bounds[name]; assert(bounds, name);
      if (touch) await page.touchscreen.tap(bounds.centerX, bounds.centerY); else await page.mouse.click(bounds.centerX, bounds.centerY);
    }
    async function record(name, before, expected, start, extra = {}) {
      const snap = await read(); assert.deepEqual(snap.state, expected, name);
      const inputs = await page.evaluate(index => window.__M5_INPUTS__.slice(index), start);
      assert(inputs.length && inputs.every(input => input.trusted), `${name}: trusted native input`);
      const index = report.interactions.length;
      const artifact = `input-${String(index).padStart(2, '0')}.json`;
      fs.writeFileSync(path.join(output, artifact), JSON.stringify({ name, before, expected, actual: snap, inputs, ...extra }));
      report.interactions.push({ name, viewport: page.viewportSize(), beforeHash: hash(before), stateHash: hash(snap.state), artifact, ...extra });
      fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ name, count: report.interactions.length, elapsedSeconds: (Date.now() - started) / 1000 }));
      return { snap, inputs };
    }
    async function chooseAll(preferredComponents = []) {
      let componentIndex = 0;
      while ((await state()).phase === 'choice') {
        const before = await state(), choice = before.pendingChoice;
        assert.equal(choice.step, 'offer'); const start = await offset();
        const definition = choice.kind === 'component' ? (preferredComponents[componentIndex++] ?? choice.offers[0]) : choice.offers[0];
        assert(choice.offers.includes(definition)); await click(`choice:${definition}`);
        await record(`ordinary-${choice.kind}-${choice.choiceId}`, before,
          accepted(api.selectChoice(before, choice.choiceId, choice.generation, definition)), start);
      }
      await quiet();
    }
    async function reset() {
      await chooseAll(); await click('mobile:new-match');
      assert.deepEqual(await state(), structuredClone(api.createMatch(42))); await chooseAll();
      return state();
    }
    if (!metricsOnly) {
    // Every modal transition, including back-to-back component choices, protects
    // the remaining confirming pointer burst. It does not suppress keyboard D/F.
    for (const method of ['mouse', 'touch']) {
      if (method === 'touch') { await chooseAll(); await click('mobile:new-match'); }
      while ((await state()).phase === 'choice') {
        await quiet(); const before = await state(), choice = before.pendingChoice;
        const node = page.locator(`[data-debug="choice:${choice.offers[0]}"]`); await node.scrollIntoViewIfNeeded();
        const box = await node.boundingBox(), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }, start = await offset();
        let expected = accepted(api.selectChoice(before, choice.choiceId, choice.generation, choice.offers[0]));
        if (method === 'mouse') await page.mouse.dblclick(point.x, point.y, { delay: 40 });
        else {
          for (let tap = 0; tap < 2; tap++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 21, x: point.x, y: point.y }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          }
        }
        const finishedChoices = !expected.pendingChoice;
        if (finishedChoices) {
          // Dispatch before serializing the evidence; serialization can itself
          // take longer than the intentional 400ms pointer-only shield.
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
          expected = accepted(api.rerollShop(expected)); expected = accepted(api.buyXp(expected));
        }
        const result = await record(`${method}-${choice.kind}-burst-single-confirmation${finishedChoices ? '-and-fast-DF' : ''}`, before, expected, start);
        const downs = result.inputs.filter(input => input.type === 'pointerdown');
        assert.equal(downs.length, 2); assert.equal(downs[1].target, 'choice-dismissal-shield');
        if (finishedChoices) {
          const keys = result.inputs.filter(input => input.type === 'keydown');
          assert.deepEqual(keys.map(input => input.code), ['KeyD', 'KeyF']);
          assert(keys.every(input => input.shieldActive), 'native D/F really dispatched during pointer protection');
        }
      }
    }
    await quiet();
    // Explicitly exercise the Chromium compatibility-mouse stream on a hybrid
    // laptop; native mouse immediately afterwards remains a distinct command.
    {
      const before = await reset(), start = await offset(); await click('reroll', true);
      const expected = accepted(api.rerollShop(before)); const { inputs } = await record('one-native-canvas-touch-one-command', before, expected, start);
      assert.equal(inputs.filter(input => input.type === 'touchstart').length, 1);
      assert(inputs.some(input => input.type === 'mousedown' && input.firesTouchEvents === true), 'actual compatibility mouse event');
      const mouseStart = await offset(); await click('reroll'); await record('immediate-real-mouse-after-touch', expected, accepted(api.rerollShop(expected)), mouseStart);
    }
    {
      const before = await reset(); await page.locator('canvas').scrollIntoViewIfNeeded();
      const token = (await read()).tokens.find(unit => unit.id === 'unit-1'); await page.mouse.move(token.screenX, token.screenY);
      const start = await offset();
      for (const [type, key, code, windowsVirtualKeyCode, autoRepeat = false] of [
        ['keyDown', 'd', 'KeyD', 68], ['keyDown', 'd', 'KeyD', 68, true], ['keyUp', 'd', 'KeyD', 68],
        ['keyDown', 'f', 'KeyF', 70], ['keyUp', 'f', 'KeyF', 70], ['keyDown', 'e', 'KeyE', 69], ['keyUp', 'e', 'KeyE', 69]])
        await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, autoRepeat });
      let expected = accepted(api.rerollShop(before)); expected = accepted(api.rerollShop(expected)); expected = accepted(api.buyXp(expected)); expected = accepted(api.sellUnit(expected, 'unit-1'));
      const { inputs } = await record('native-repeat-fast-DDFE', before, expected, start);
      assert.deepEqual(inputs.filter(input => input.type === 'keydown').map(input => input.code), ['KeyD', 'KeyD', 'KeyF', 'KeyE']);
      assert(inputs.some(input => input.type === 'keydown' && input.repeat));
      const rejectStart = await offset(); await page.keyboard.press('f'); await record('failed-F-preserves-complete-state', expected, expected, rejectStart);
    }
    async function touch(type, points = []) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points }); }
    // Cancellation and normal release use precisely the same native drag path.
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await resizeViewport(page, viewport); const before = await reset(); await page.locator('canvas').scrollIntoViewIfNeeded();
      const snap = await read(), original = snap.tokens.find(unit => unit.id === 'unit-1');
      const row = before.preparation.board.deploymentZones.player.lastRow;
      const cell = { col: 0, row }, target = snap.layout.hexes[`0,${row}`];
      async function dragUnit() {
        const unit = (await read()).tokens.find(unit => unit.id === 'unit-1');
        await touch('touchStart', [{ id: 11, x: unit.screenX, y: unit.screenY }]);
        await touch('touchMove', [{ id: 11, x: unit.screenX + 18, y: unit.screenY - 18 }]);
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().draggingId === 'unit-1');
        await touch('touchMove', [{ id: 11, x: target.x, y: target.y }]);
      }
      let start = await offset(); await dragUnit(); await touch('touchCancel');
      let result = await record('native-unit-touchcancel-full-state', before, before, start);
      assert.equal(result.snap.gesture, null); assert.equal(result.snap.draggingId, null);
      const restored = result.snap.tokens.find(unit => unit.id === 'unit-1'); assert.equal(restored.x, original.x); assert.equal(restored.y, original.y);
      assert(result.inputs.some(input => input.type === 'touchcancel')); assert(result.inputs.some(input => input.type === 'pointercancel'));
      start = await offset(); await dragUnit(); await touch('touchEnd');
      await record('native-unit-same-path-release-commits', before, accepted(api.deployMatchUnit(before, 'unit-1', { kind: 'board', cell })), start);
    }
    await resizeViewport(page, { width: 1440, height: 1000 });
    {
      const before = await reset(); await click('panel:items');
      await page.locator('[data-debug="equipment:unit-1:0"]').scrollIntoViewIfNeeded();
      let snap = await read(); const item = snap.bounds['item:item-1'], equip = snap.bounds['equipment:unit-1:0'];
      async function dragItem() {
        await touch('touchStart', [{ id: 12, x: item.centerX, y: item.centerY }]);
        await touch('touchMove', [{ id: 12, x: item.centerX - 12, y: item.centerY }]);
        assert.equal((await read()).gesture?.id, 'item-1');
        await touch('touchMove', [{ id: 12, x: equip.centerX, y: equip.centerY }]);
      }
      let start = await offset(); await dragItem(); await touch('touchCancel');
      const canceled = await record('native-item-pointercancel-does-not-equip', before, before, start); assert.equal(canceled.snap.gesture, null);
      start = await offset(); await dragItem(); await touch('touchEnd');
      await record('native-item-same-path-release-equips', before, accepted(api.equipItem(before, 'item-1', 'unit-1', 0)), start);
    }
    // Layout/rotation gates are read against actual CSS bounds, not game pixels.
    for (const viewport of [{ width: 1440, height: 600 }, { width: 390, height: 650 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 360, height: 640 }]) {
      await resizeViewport(page, viewport); await reset(); const before = await state(), start = await offset();
      await click('panel:builds', true); await click('shop-lock', true);
      const expected = accepted(api.setShopLock(before, true, before.shop.generation));
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
        targets: [...document.querySelectorAll('#strategy-root button')].filter(node => node.getBoundingClientRect().width).map(node => ({ id: node.dataset.debug, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })) }));
      assert(geometry.document <= geometry.viewport, 'no horizontal overflow'); assert(geometry.targets.every(node => node.width >= 43.9 && node.height >= 43.9), '44 CSS px controls');
      await record('layout-touch-lock-and-build-guide', before, expected, start, { geometry }); await page.screenshot({ path: path.join(output, `layout-${viewport.width}-${viewport.height}.png`) });
    }
    await resizeViewport(page, { width: 390, height: 844 });
    {
      const before = await reset(); await click('panel:items'); await page.locator('[data-debug="item:item-1"]').scrollIntoViewIfNeeded();
      const bounds = (await read()).bounds['item:item-1'], start = await offset();
      await touch('touchStart', [{ id: 13, x: bounds.centerX, y: bounds.centerY }]); assert.equal((await read()).gesture?.kind, 'item');
      await resizeViewport(page, { width: 844, height: 390 }); await touch('touchEnd');
      const result = await record('orientation-cancels-item-late-release', before, before, start); assert.equal(result.snap.gesture, null);
    }
    // A tab geometrically in the viewport can be covered by the sticky shop.
    // Use native actionability, never blindly tap its covered center coordinate.
    await resizeViewport(page, { width: 390, height: 844 });
    {
      const traitBefore = await reset(), traitStart = await offset();
      await click('panel:traits', true);
      for (const [id, totals] of [['sorcerer', [20, 50]], ['sentinel', [36, 75]]]) {
        const text = await page.locator(`[data-debug="trait:${id}"]`).innerText();
        assert(text.includes('全队收益') && text.includes('职业成员额外收益'));
        for (const total of totals) assert(text.includes(`+${total}`), `visible ${id} member total ${total}`);
      }
      await record('trait-team-member-and-combined-benefits-visible', traitBefore, traitBefore, traitStart);
      await page.screenshot({ path: path.join(output, 'trait-audit-benefits.png') });
      const before = await reset(); await click('panel:builds', true);
      const tab = page.locator('[data-debug="panel:units"]');
      await tab.evaluate(node => node.scrollIntoView({ block: 'start' }));
      await tab.scrollIntoViewIfNeeded();
      const coveredBy = await tab.evaluate(node => {
        const box = node.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('[data-debug]')?.getAttribute('data-debug');
      });
      assert.equal(coveredBy, 'mobile:buy-2', 'regression starts with a genuinely occluded tab');
      const start = await offset(); await click('panel:units', true);
      const result = await record('sticky-shop-occluded-tab-native-tap-does-not-buy', before, before, start, { coveredBy });
      assert.deepEqual(result.inputs.filter(input => input.type === 'pointerdown').map(input => input.target), ['panel:units']);
    }
    // New Match resets listeners as well as domain state. Two resets then one D
    // must still produce exactly one accepted command.
    await resizeViewport(page, { width: 1440, height: 1000 }); await reset();
    const before = await reset(), start = await offset(); await page.keyboard.press('d');
    await record('repeated-new-match-does-not-duplicate-listeners', before, accepted(api.rerollShop(before)), start);
    await click('mobile:new-match'); await chooseAll(['bow', 'rod']);
    } else { await chooseAll(['bow', 'rod']); }
    // One ordinary first-round combat supplies a labeled wall-time sample and
    // proves that New Match releases a nonempty combat ledger and visual work.
    // The separate headless run below predicts consistency; it never changes
    // the browser state or clock.
    // Normal opening components produce Rageblade on Lux, so dynamic AS is
    // exercised by actual attacks rather than a synthetic stat fixture.
    let buildBefore = await state(), buildStart = await offset();
    await click('panel:items'); await click('item:item-1'); await click('item:item-2'); await click('combine-items');
    let buildExpected = accepted(api.combineItems(buildBefore, 'item-1', 'item-2'));
    await record('normal-opening-rageblade-recipe', buildBefore, buildExpected, buildStart);
    const rageblade = buildExpected.items.find(item => item.definitionId === 'rageblade'); assert(rageblade);
    buildBefore = buildExpected; buildStart = await offset(); await click(`item:${rageblade.id}`); await click('equipment:unit-3:0');
    buildExpected = accepted(api.equipItem(buildBefore, rageblade.id, 'unit-3', 0));
    await record('normal-opening-rageblade-equipped', buildBefore, buildExpected, buildStart);
    await click('panel:units'); await click('mobile:unit:unit-3');
    const combatBefore = await state();
    let result = api.startMatchCombat(combatBefore), expectedCombat = accepted(result);
    const expectedEvents = result.events.filter(event => 'tick' in event);
    while (expectedCombat.phase === 'combat') {
      const next = api.stepMatch(expectedCombat); expectedCombat = structuredClone(next.state);
      expectedEvents.push(...next.events.filter(event => 'tick' in event));
    }
    const beforeCombatMetrics = await sampleObserver('before-normal-combat');
    const combatInputStart = await offset(); await click('start-combat');
    await page.evaluate(() => { window.__M5_FRAME_LABEL__ = 'normal-combat'; });
    const combatDeadline = Date.now() + 90000;
    while ((await state()).phase === 'combat') { assert(Date.now() < combatDeadline, 'normal combat observation timeout'); await delay(250); }
    await page.evaluate(() => { window.__M5_FRAME_LABEL__ = 'post-combat'; });
    const combatRecord = await record('normal-wall-time-combat-for-observation', combatBefore, expectedCombat, combatInputStart);
    assert.deepEqual(combatRecord.snap.combatEvents, expectedEvents); assert(expectedEvents.length > 0);
    assert(expectedEvents.some(event => event.type === 'statChanged' && event.source.definitionId === 'rageblade'));
    const lux = expectedCombat.combat.units.find(unit => unit.id === 'unit-3');
    const stats = readCombatStats(lux, expectedCombat.combat);
    const currentDisplayed = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-debug^="combat-stat:"]')].map(node => [node.dataset.debug, Number(node.dataset.current)])));
    assert.deepEqual(currentDisplayed, { 'combat-stat:ad': stats.attackDamage, 'combat-stat:ap': stats.abilityPower,
      'combat-stat:attack-interval': stats.attackIntervalTicks * initial.tickMs, 'combat-stat:armor': stats.armor,
      'combat-stat:magic-resist': stats.magicResist, 'combat-stat:range': stats.attackRange });
    assert(stats.attackIntervalTicks < lux.attackIntervalTicks, 'normal Rageblade attacks change current AS beyond frozen stat');
    fs.writeFileSync(path.join(output, 'dynamic-stats.json'), JSON.stringify({ unit: lux, expectedProjection: stats, currentDisplayed, evidenceKind: 'production selector to UI consistency' }));
    await page.screenshot({ path: path.join(output, 'dynamic-stats.png') });
    const afterCombatMetrics = await sampleObserver('after-normal-combat');
    const resetStart = await offset(); await click('mobile:new-match');
    const resetRecord = await record('new-match-clears-ledger-effects-and-tweens', expectedCombat, initial, resetStart);
    assert.equal(resetRecord.snap.combatEvents.length, 0); assert.equal(resetRecord.snap.effects, 0); assert.equal(resetRecord.snap.tweens, 0);
    const afterResetMetrics = await sampleObserver('after-new-match');
    const frameSamples = await page.evaluate(() => window.__M5_FRAME_SAMPLES__);
    const frameIntervalsMs = Object.fromEntries(['preparation-input', 'normal-combat', 'post-combat'].map(label => [label, distribution(frameSamples.filter(sample => sample.label === label).map(sample => sample.ms))]));
    assert(frameIntervalsMs['normal-combat'].count > 0);
    report.performance = { frameIntervalsMs, windows: 'preparation-input includes idle/modal/layout interaction; normal-combat spans one normal first-round battle after Start returns, with readonly observer polling at 4Hz; post-combat includes observer/settlement/New Match. Browser tracing and concurrent machine load can affect these measurements.',
      observer: [beforeCombatMetrics, afterCombatMetrics, afterResetMetrics].map(sample => ({ ...sample, distributionMs: distribution(sample.durationsMs) })),
      heapNote: 'Heap measurements are observations without forced GC; zero ledger/effects/tweens is asserted, heap reduction is not inferred.' };
    fs.writeFileSync(path.join(output, 'performance.json'), JSON.stringify(report.performance, null, 2));
    fs.writeFileSync(path.join(output, 'frame-intervals.json'), JSON.stringify(frameSamples));
    const inputs = await page.evaluate(() => window.__M5_INPUTS__); fs.writeFileSync(path.join(output, 'native-inputs.json'), JSON.stringify(inputs));
    assert.deepEqual(report.errors, []); assert.equal(sourceFingerprint(), report.sourceFingerprint, 'production source changed during gate');
    report.passed = true; await cdp.detach();
  } catch (error) {
    report.failure = error.stack; process.exitCode = 1; console.error(error);
    if (page) { try { fs.writeFileSync(path.join(output, 'failure-state.json'), JSON.stringify(await page.evaluate(() => window.__CAT_DEBUG__?.read()))); await page.screenshot({ path: path.join(output, 'failure.png') }); } catch {} }
  } finally {
    report.durationSeconds = (Date.now() - started) / 1000; report.finalSourceFingerprint = sourceFingerprint();
    if (context) await context.tracing.stop({ path: path.join(output, 'trace.zip') }).catch(() => {});
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await model?.close(); server?.kill(); console.log(JSON.stringify({ mode, passed: report.passed, cases: report.interactions.length, durationSeconds: report.durationSeconds }));
  }
})();
