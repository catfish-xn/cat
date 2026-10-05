/* Native Chromium regressions for the canvas/DOM input boundary. The separate
 * model calculates expected results; browser state is only read, never injected. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { hash } = require('./m4-evidence.cjs');
const { resizeViewport } = require('./verify-m4-interactions.cjs');

module.exports = async function verifyInputBoundaries({ browser, url, report, output }) {
  const { createServer } = await import('vite');
  const model = await createServer({ root: path.resolve(__dirname, '..'), server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  let context;
  try {
    const api = await model.ssrLoadModule('/src/simulation/match.ts');
    // hasTouch without isMobile reproduces the touchscreen desktop's native
    // compatibility mouse stream, which the normal mobile controls don't test.
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true, deviceScaleFactor: 1 });
    await context.tracing.start({ screenshots: false, snapshots: true });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`input-boundary pageerror:${error.message}`));
    page.on('console', event => {
      report.console.push({ type: event.type(), text: event.text(), scope: 'input-boundary' });
      if (event.type() === 'error') report.errors.push(`input-boundary console:${event.text()}`);
    });
    await page.goto(url); await page.waitForFunction(() => window.__CAT_DEBUG__);
    await page.evaluate(() => {
      window.__M4_BOUNDARY_INPUTS__ = [];
      for (const type of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'])
        window.addEventListener(type, event => window.__M4_BOUNDARY_INPUTS__.push({ type, trusted: event.isTrusted,
          target: event.target?.closest?.('[data-debug]')?.dataset.debug ?? event.target?.tagName,
          firesTouchEvents: event.sourceCapabilities?.firesTouchEvents ?? null, code: event.code, repeat: event.repeat }), true);
    });
    const cdp = await context.newCDPSession(page);
    const read = () => page.evaluate(() => window.__CAT_DEBUG__.read());
    const state = async () => (await read()).state;
    const accepted = result => { assert(result.ok, result.reason); return structuredClone(result.state); };
    async function tap(point) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 21, x: point.x, y: point.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    async function canvasClick(name, method = 'mouse') {
      const bounds = (await read()).bounds[name]; assert(bounds, name);
      const point = { x: bounds.centerX, y: bounds.centerY };
      if (method === 'touch') await tap(point); else await page.mouse.click(point.x, point.y);
    }
    async function reset() {
      await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
      await canvasClick('debug-new-match');
      const initial = structuredClone(api.createMatch(42));
      assert.deepEqual(await state(), initial);
      return initial;
    }
    const offset = () => page.evaluate(() => window.__M4_BOUNDARY_INPUTS__.length);
    async function record(name, before, expected, inputOffset, extra = {}) {
      const actual = await state(); assert.deepEqual(actual, expected, name);
      const inputs = await page.evaluate(start => window.__M4_BOUNDARY_INPUTS__.slice(start), inputOffset);
      assert(inputs.length > 0); assert(inputs.every(input => input.trusted));
      report.interactions.push({ name, touch: true, viewport: page.viewportSize(), beforeHash: hash(before),
        afterHash: hash(actual), expectedHash: hash(expected), phase: actual.phase, gold: actual.gold,
        generation: actual.shop.generation, inputs, ...extra });
      return inputs;
    }
    for (const [name, command] of [['reroll', api.rerollShop], ['buy-xp', api.buyXp]]) {
      const before = await reset(), inputOffset = await offset();
      const expected = accepted(command(before));
      await canvasClick(name, 'touch');
      const inputs = await record(`canvas-${name}-one-native-touch-one-command`, before, expected, inputOffset);
      assert.equal(inputs.filter(input => input.type === 'touchstart').length, 1);
      // Require the exact formerly duplicated event to have really occurred,
      // then prove it did not issue a second command by full-state comparison.
      assert.equal(inputs.filter(input => input.type === 'mousedown' && input.firesTouchEvents).length, 1);
    }
    // Three distinct quick taps and three real mouse clicks must all execute.
    // No timing gate or blanket suppression of mouse input can satisfy these.
    for (const method of ['touch', 'mouse']) {
      const before = await reset(), inputOffset = await offset(), bounds = (await read()).bounds.reroll;
      let expected = before;
      for (let i = 0; i < 3; i++) {
        if (method === 'touch') await tap({ x: bounds.centerX, y: bounds.centerY });
        else await page.mouse.click(bounds.centerX, bounds.centerY);
        expected = accepted(api.rerollShop(expected));
      }
      const inputs = await record(`canvas-three-fast-${method}-rerolls-all-commit`, before, expected, inputOffset);
      assert.equal(inputs.filter(input => input.type === (method === 'touch' ? 'touchstart' : 'mousedown')).length, 3);
    }
    // Native OS-style repeat plus D/F/E in one rapid input sequence. An actual
    // canvas unit is hovered for E; each key must appear in the trusted log.
    {
      const before = await reset(), token = (await read()).tokens.find(unit => unit.id === 'unit-1');
      await page.mouse.move(token.screenX, token.screenY);
      const inputOffset = await offset();
      for (const [type, key, code, windowsVirtualKeyCode, autoRepeat = false] of [
        ['keyDown', 'd', 'KeyD', 68], ['keyDown', 'd', 'KeyD', 68, true], ['keyUp', 'd', 'KeyD', 68],
        ['keyDown', 'f', 'KeyF', 70], ['keyUp', 'f', 'KeyF', 70], ['keyDown', 'e', 'KeyE', 69], ['keyUp', 'e', 'KeyE', 69]])
        await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, autoRepeat });
      let expected = accepted(api.rerollShop(before)); expected = accepted(api.rerollShop(expected));
      expected = accepted(api.buyXp(expected)); expected = accepted(api.sellUnit(expected, 'unit-1'));
      const inputs = await record('canvas-native-repeat-and-fast-DFE-remain-immediate', before, expected, inputOffset);
      const keys = inputs.filter(input => input.type === 'keydown');
      assert.deepEqual(keys.map(input => input.code), ['KeyD', 'KeyD', 'KeyF', 'KeyE']); assert(keys[1].repeat);
    }
    await resizeViewport(page, { width: 390, height: 650 });
    for (const method of ['touch', 'mouse']) {
      let before = await reset();
      await page.keyboard.press('Control+Home'); await page.waitForFunction(() => window.scrollY === 0);
      await canvasClick('start-combat');
      let expected = accepted(api.startMatchCombat(before));
      while (expected.phase === 'combat') expected = structuredClone(api.stepMatch(expected).state);
      assert.deepEqual(await state(), expected);
      await canvasClick('continue'); expected = accepted(api.nextRound(expected, 1));
      assert.deepEqual(await state(), expected); before = expected;
      const snapshot = await read(), choice = before.pendingChoice;
      assert.equal(choice.offers[0], 'study-circle');
      const card = snapshot.bounds['choice:study-circle'], reroll = snapshot.bounds.reroll;
      const point = { x: Math.max(card.x, reroll.x) + 8, y: Math.max(card.y, reroll.y) + 8 };
      assert(point.x < Math.min(card.x + card.width, reroll.x + reroll.width)
        && point.y < Math.min(card.y + card.height, reroll.y + reroll.height), 'card must really overlap canvas Reroll');
      const inputOffset = await offset();
      expected = accepted(api.selectChoice(before, choice.choiceId, choice.generation, choice.offers[0]));
      if (method === 'touch') { await tap(point); await tap(point); }
      else await page.mouse.dblclick(point.x, point.y, { delay: 40 });
      const inputs = await record(`choice-canvas-overlap-${method}-double-only-selects`, before, expected, inputOffset, { point });
      const downs = inputs.filter(input => input.type === 'pointerdown');
      assert.equal(downs.length, 2); assert.equal(downs[1].target, 'choice-dismissal-shield');
      assert(inputs.some(input => input.type === (method === 'touch' ? 'touchstart' : 'mousedown') && input.target === 'choice-dismissal-shield'));
      await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
      // Exactly the same canvas coordinate becomes an intentional reroll once
      // the choice burst ends. This catches a shield or input listener left stuck.
      const freshOffset = await offset();
      if (method === 'touch') await tap(point); else await page.mouse.click(point.x, point.y);
      await record(`choice-shield-ended-fresh-${method}-canvas-click-works`, expected,
        accepted(api.rerollShop(expected)), freshOffset, { point });
    }
    await cdp.detach();
  } finally {
    if (context) {
      try { await context.tracing.stop({ path: path.join(output, 'input-boundary-trace.zip') }); }
      finally { await context.close(); }
    }
    await model.close();
  }
};
