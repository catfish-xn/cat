/* Supplemental interaction regression after full-match. Only trusted native input;
 * observer/DOM reads never invoke simulation commands or replace Match state. */
const assert = require('node:assert/strict');
const { hash } = require('./m4-evidence.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Wait for Phaser's automatic FIT refresh, without reaching into Phaser or
 * changing a game clock. A viewport resize updates the parent CSS before the
 * ScaleManager's next step updates the canvas and its input coordinate scale. */
async function resizeViewport(page, viewport) {
  await page.setViewportSize(viewport);
  const inspect = () => page.evaluate(() => {
    const parent = document.getElementById('board-root'), canvas = parent?.querySelector('canvas');
    const rectangle = node => {
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return { viewport: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: window.visualViewport && { width: visualViewport.width, height: visualViewport.height,
        scale: visualViewport.scale, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop },
      orientation: { type: screen.orientation?.type, angle: screen.orientation?.angle },
      parent: rectangle(parent), canvas: rectangle(canvas), canvasStyle: canvas?.getAttribute('style') ?? null };
  });
  const matchesFit = ({ width, height }) => {
    const parent = document.getElementById('board-root'), canvas = parent?.querySelector('canvas');
    if (!parent || !canvas || window.innerWidth !== width || window.innerHeight !== height) return false;
    const box = parent.getBoundingClientRect(), rect = canvas.getBoundingClientRect();
    if (!box.width || !box.height || !canvas.width || !canvas.height) return false;
    const scale = Math.min(box.width / canvas.width, box.height / canvas.height);
    const expectedWidth = canvas.width * scale, expectedHeight = canvas.height * scale;
    const close = (a, b) => Math.abs(a - b) < 1;
    return close(rect.width, expectedWidth) && close(rect.height, expectedHeight)
      && close(rect.x, box.x + (box.width - expectedWidth) / 2)
      && close(rect.y, box.y + (box.height - expectedHeight) / 2);
  };
  try {
    await page.waitForFunction(matchesFit, viewport, { polling: 'raf', timeout: 10000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.waitForFunction(matchesFit, viewport, { polling: 'raf', timeout: 10000 });
  } catch (error) {
    throw new Error(`Viewport FIT did not settle for ${JSON.stringify(viewport)}: ${JSON.stringify(await inspect())}`, { cause: error });
  }
  return inspect();
}

module.exports = async function verifyInteractions({ page, context, read, click, report, touch = false }) {
  report.interactions ??= [];
  let resetCount = 0;
  await page.evaluate(() => {
    window.__M4_INTERACTION_INPUTS__ = [];
    window.__M4_RECORD_INTERACTION__ = event => {
      window.__M4_INTERACTION_INPUTS__.push({ type: event.type, trusted: event.isTrusted,
        code: event.code, repeat: event.repeat, pointerId: event.pointerId, pointerType: event.pointerType, detail: event.detail, deltaY: event.deltaY });
    };
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'click', 'wheel'])
      window.addEventListener(type, window.__M4_RECORD_INTERACTION__, true);
  });
  const state = async () => (await read()).state;
  const sameState = async (before, message) => assert.deepEqual(await state(), before, message);
  async function record(name, before, extra = {}) {
    const after = await read();
    report.interactions.push({ name, touch, beforeHash: hash(before), afterHash: hash(after.state),
      round: after.state.round, phase: after.state.phase, gold: after.state.gold,
      gesture: after.gesture, gestureEpoch: after.gestureEpoch, ...extra });
  }
  async function until(check, timeout = 75000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const snapshot = await read(); if (check(snapshot)) return snapshot; await delay(60); }
    throw Error(`interaction timeout: ${check}`);
  }
  async function reset() {
    await click(touch ? 'mobile:new-match' : 'debug-new-match');
    resetCount++;
    const snapshot = await read();
    assert.equal(snapshot.state.round, 1); assert.equal(snapshot.state.phase, 'preparation');
    assert.equal(snapshot.state.gold, 10); assert.equal(snapshot.gesture, null);
    assert.equal(snapshot.state.augments.length, 0); assert.equal(snapshot.state.items.length, 2);
    return snapshot.state;
  }
  async function itemPoint(id = 'item-1') {
    await click('panel:items');
    await page.locator(`[data-debug="item:${id}"]`).scrollIntoViewIfNeeded();
    return (await read()).bounds[`item:${id}`];
  }
  async function startUnitDrag(id) {
    const snapshot = await read(), token = snapshot.tokens.find(unit => unit.id === id);
    assert(token, `unit ${id}`);
    await page.mouse.move(token.screenX, token.screenY); await page.mouse.down();
    await page.mouse.move(token.screenX + 18, token.screenY - 18, { steps: 4 });
    const dragging = await read(); assert.equal(dragging.draggingId, id); assert.equal(dragging.gesture?.kind, 'unit');
    return dragging;
  }
  async function deploy(id, col) {
    if (touch) {
      await click('panel:units'); await click(`mobile:unit:${id}`); await click(`deploy:${col},4`);
    } else {
      const snapshot = await read(), token = snapshot.tokens.find(unit => unit.id === id), target = snapshot.layout.hexes[`${col},4`];
      await page.mouse.move(token.screenX, token.screenY); await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 6 }); await page.mouse.up();
    }
    assert.deepEqual((await state()).preparation.units.find(unit => unit.id === id).location, { kind: 'board', cell: { col, row: 4 } });
  }
  async function ordinaryAugment() {
    await reset();
    for (const [id, col] of [['unit-1', 1], ['unit-2', 3], ['unit-3', 5]]) await deploy(id, col);
    await click(touch ? 'mobile:start-combat' : 'start-combat');
    await until(snapshot => snapshot.state.phase === 'settlement');
    const complete = await read();
    assert(complete.state.combat.tick > 0); assert(complete.combatEvents.some(event => event.type === 'cast'));
    await click(touch ? 'mobile:continue' : 'continue');
    const before = await state(); assert.equal(before.pendingChoice.kind, 'augment'); assert.equal(before.phase, 'choice');
    return before;
  }

  try {
    if (!touch) {
      await reset();
      // Each resize must settle before reading the one and only New Match
      // click coordinate. Perturb gold first so a missed click cannot pass.
      const originalViewport = page.viewportSize();
      const resizeCases = [{ width: 1440, height: 600 }, originalViewport,
        { width: 390, height: 844 }, originalViewport, { width: 844, height: 390 }, originalViewport];
      for (let pass = 0; pass < 2; pass++) for (const viewport of resizeCases) {
        const beforeResize = await state();
        await page.keyboard.press('d'); assert.equal((await state()).gold, beforeResize.gold - 2);
        const geometry = await resizeViewport(page, viewport);
        const clickBounds = (await read()).bounds['debug-new-match'];
        await reset();
        await record('viewport-fit-New-Match-one-click', beforeResize, { pass, geometry, clickBounds, clicks: 1 });
      }
      // Successful D and F synchronously cancel a unit drag; its release is stale.
      for (const [key, cost] of [['d', 2], ['f', 4]]) {
        const before = await state(); await startUnitDrag('unit-1');
        await page.keyboard.press(key);
        const committed = await read(); assert.equal(committed.state.gold, before.gold - cost);
        assert.equal(committed.gesture, null); assert.equal(committed.draggingId, null);
        assert.deepEqual(committed.state.preparation.units, before.preparation.units);
        await page.mouse.up(); await sameState(committed.state, `late release after successful ${key}`);
        await record(`unit-drag-${key}-success-cancels`, before);
      }
      while ((await state()).gold >= 2) await page.keyboard.press('d');
      const dragging = await startUnitDrag('unit-1'), beforeFailure = dragging.state;
      for (const key of ['d', 'f']) {
        await page.keyboard.press(key); await sameState(beforeFailure, `unit drag failed ${key} is atomic`);
        assert.deepEqual((await read()).gesture, dragging.gesture, `failed ${key} keeps gesture`);
      }
      await record('unit-drag-rejected-DF-preserves-owner', beforeFailure, { retainedGesture: dragging.gesture });
      await page.keyboard.press('e');
      const sold = await state(); assert(!sold.preparation.units.some(unit => unit.id === 'unit-1'));
      assert.equal(sold.gold, beforeFailure.gold + 1); assert.equal((await read()).gesture, null);
      await page.mouse.up(); await sameState(sold, 'late release cannot resurrect a sold unit');
      await record('unit-drag-E-sale-late-release', beforeFailure);

      // Real keyboard activation can buy a shop card while a mouse owns a
      // dragged unit. The second Mystic purchase consumes the dragged copy.
      await reset(); await click('panel:units');
      assert.equal((await state()).shop.slots[0].definitionId, 'mystic');
      assert.equal((await state()).shop.slots[2].definitionId, 'mystic');
      await click('mobile:buy-0');
      await page.locator('[data-debug="mobile:buy-2"]').scrollIntoViewIfNeeded();
      const mergeDrag = await startUnitDrag('unit-6');
      let focusedShop = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        await page.keyboard.press('Tab');
        focusedShop = await page.evaluate(() => document.activeElement?.getAttribute('data-debug') === 'mobile:buy-2');
        assert.deepEqual((await read()).gesture, mergeDrag.gesture, 'keyboard shop navigation preserves the unit owner');
        if (focusedShop) break;
      }
      assert(focusedShop, 'ordinary Tab navigation reaches the second Mystic offer');
      await page.keyboard.press('Enter');
      const merged = await state();
      assert(!merged.preparation.units.some(unit => unit.id === 'unit-6'));
      assert.equal(merged.preparation.units.find(unit => unit.id === 'unit-3').starLevel, 2);
      assert.equal((await read()).gesture, null); assert.equal((await read()).draggingId, null);
      await page.mouse.up(); await sameState(merged, 'late release cannot recreate a merge-consumed unit');
      await record('unit-drag-shop-buy-merge-removes-owner', mergeDrag.state, { consumedId: 'unit-6', survivorId: 'unit-3', input: 'native Tab / Enter with mouse held' });

      await reset();
      let snapshot = await read(), token = snapshot.tokens.find(unit => unit.id === 'unit-1');
      await page.mouse.click(token.screenX, token.screenY);
      let point = await itemPoint();
      await page.mouse.move(point.centerX, point.centerY); await page.mouse.down();
      await page.mouse.move(point.centerX + 8, point.centerY + 8, { steps: 3 });
      assert.equal((await read()).gesture?.kind, 'item');
      const itemBefore = await state(); await page.keyboard.press('e'); await sameState(itemBefore, 'E during item drag has no sale target');
      await page.keyboard.press('d');
      const afterD = await state(); assert.equal(afterD.gold, itemBefore.gold - 2); assert.equal((await read()).gesture, null);
      // Do not move the mouse. D rebuilt the item panel underneath this point.
      assert.equal((await read()).strategy.itemPointer, true);
      await page.keyboard.press('e'); await sameState(afterD, 'stationary item hover after D cannot sell background selection');
      await page.mouse.up(); await sameState(afterD, 'late item release after D cannot equip');
      await record('item-drag-E-blocked-D-cancel-stationary-E', itemBefore);

      while ((await state()).gold >= 2) await page.keyboard.press('d');
      point = await itemPoint(); snapshot = await read(); token = snapshot.tokens.find(unit => unit.id === 'unit-1');
      await page.mouse.move(point.centerX, point.centerY); await page.mouse.down();
      await page.mouse.move(token.screenX, token.screenY, { steps: 6 });
      const retained = await read(); assert.equal(retained.gesture?.kind, 'item');
      await page.keyboard.press('f'); await sameState(retained.state, 'failed F during item drag is atomic');
      assert.deepEqual((await read()).gesture, retained.gesture);
      await page.keyboard.press('e'); await sameState(retained.state, 'item over a unit still blocks E');
      await page.mouse.up();
      const equipped = await state();
      assert.deepEqual(equipped.items.find(item => item.id === 'item-1').location, { kind: 'unit', unitId: 'unit-1', slot: 0 });
      await page.mouse.up(); await sameState(equipped, 'duplicate item release commits once');
      await record('item-drag-failed-F-preserves-and-equips-once', retained.state, { retainedGesture: retained.gesture });

      // A real wheel scroll of the inventory cancels its active drag. Scrolling
      // cannot turn the later release into an equipment transaction.
      const viewport = page.viewportSize(); await resizeViewport(page, { width: 1440, height: 600 });
      const scrollingItem = await itemPoint('item-2');
      await page.mouse.move(scrollingItem.centerX, scrollingItem.centerY); await page.mouse.down();
      await page.mouse.move(scrollingItem.centerX + 8, scrollingItem.centerY, { steps: 3 });
      assert.equal((await read()).gesture?.kind, 'item');
      const beforeScroll = await state();
      const scrollTop = await page.locator('#strategy-root').evaluate(node => node.scrollTop);
      await page.mouse.wheel(0, 260);
      await page.waitForFunction(previous => document.getElementById('strategy-root').scrollTop > previous, scrollTop);
      await until(current => current.gesture === null, 10000);
      await page.mouse.up(); await sameState(beforeScroll, 'inventory wheel scrolling cannot equip the item');
      await record('item-panel-wheel-scroll-cancels-drag-without-equip', beforeScroll, {
        scrollBefore: scrollTop, scrollAfter: await page.locator('#strategy-root').evaluate(node => node.scrollTop), input: 'trusted mouse wheel',
      });
      await resizeViewport(page, viewport);

      // Enter is a real activation while the pointer still owns the old choice
      // card. Releasing that now-detached card must not activate anything below.
      const beforeChoice = await ordinaryAugment();
      for (const key of ['d', 'f', 'e']) { await page.keyboard.press(key); await sameState(beforeChoice, `modal rejects ${key}`); }
      await click('start-combat'); await sameState(beforeChoice, 'modal backdrop blocks the underlying Start button');
      await page.keyboard.down('d'); await sameState(beforeChoice, 'held D during choice is rejected without a queued command');
      const definitionId = beforeChoice.pendingChoice.offers[0];
      const bounds = (await read()).bounds[`choice:${definitionId}`];
      await page.mouse.move(bounds.centerX, bounds.centerY); await page.mouse.down();
      await page.keyboard.press('Enter');
      const chosen = await state(); assert.equal(chosen.phase, 'preparation'); assert.equal(chosen.pendingChoice, null);
      assert.equal(chosen.augments.length, 1); assert.equal(chosen.augments[0].definitionId, definitionId);
      await page.mouse.up(); await sameState(chosen, 'stale choice pointer release cannot click through');
      await record('natural-R2-choice-stale-pointer-no-passthrough', beforeChoice, { choiceId: beforeChoice.pendingChoice.choiceId, definitionId });
      assert.equal(chosen.gold, beforeChoice.gold, 'choice completion does not replay the rejected held key');
      await page.keyboard.down('d');
      const repeated = await state();
      assert.equal(repeated.gold, chosen.gold - 2); assert.equal(repeated.shop.generation, chosen.shop.generation + 1);
      assert.deepEqual(repeated.preparation, chosen.preparation); assert.deepEqual(repeated.items, chosen.items);
      assert.deepEqual(repeated.augments, chosen.augments); assert.equal(repeated.choiceRngState, chosen.choiceRngState);
      assert.equal(repeated.nextUnitSerial, chosen.nextUnitSerial); assert.equal(repeated.nextMatchEventSeq, chosen.nextMatchEventSeq);
      const nativeRepeat = await page.evaluate(() => window.__M4_INTERACTION_INPUTS__.filter(event => event.type === 'keydown' && event.code === 'KeyD').at(-1));
      assert(nativeRepeat.trusted && nativeRepeat.repeat); await page.keyboard.up('d');
      await record('held-D-across-choice-only-new-native-repeat-commits', chosen, { rejectedChoiceHash: hash(beforeChoice), repeat: nativeRepeat });
      await record('multiple-New-Match-native-listener-commits-once', chosen, { resetCount, successfulKeydowns: 1, chargedGold: chosen.gold - repeated.gold });
    } else {
      await resizeViewport(page, { width: 390, height: 844 }); await reset();
      const cdp = await context.newCDPSession(page);
      await itemPoint(); let snapshot = await read();
      const firstBounds = snapshot.bounds['item:item-1'], secondBounds = snapshot.bounds['item:item-2'];
      const first = { id: 1, x: firstBounds.centerX, y: firstBounds.centerY };
      const second = { id: 2, x: secondBounds.centerX, y: secondBounds.centerY };
      const before = snapshot.state;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
      const owner = (await read()).gesture; assert.equal(owner?.id, 'item-1');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
      assert.deepEqual((await read()).gesture, owner, 'second finger cannot replace the first item owner');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [first, { ...second, x: second.x + 8 }] });
      assert.deepEqual((await read()).gesture, owner);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal((await read()).gesture, null); await sameState(before, 'touchCancel does not consume or equip items');
      await record('touch-second-pointer-and-touchCancel', before, { owner, method: 'CDP Input.dispatchTouchEvent' });

      // A touchscreen laptop can produce touch and mouse concurrently. The
      // second input must not equip/combine a selection owned by the first.
      await resizeViewport(page, { width: 1440, height: 1000 });
      await click('panel:items'); await click('item:item-1'); await click('item:item-2');
      snapshot = await read();
      const mixedBounds = snapshot.bounds['item:item-1'];
      const mixed = { id: 5, x: mixedBounds.centerX, y: mixedBounds.centerY };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [mixed] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...mixed, x: mixed.x - 10 }] });
      const mixedOwner = (await read()).gesture; assert.equal(mixedOwner?.id, 'item-1');
      for (const name of ['equipment:unit-1:0', 'combine-items']) {
        const bounds = (await read()).bounds[name];
        await page.mouse.click(bounds.centerX, bounds.centerY);
        await sameState(before, `mixed pointer ${name} must not take the active item`);
        assert.deepEqual((await read()).gesture, mixedOwner);
        await page.keyboard.press('Enter');
        await sameState(before, `keyboard ${name} must not take the active item`);
        assert.deepEqual((await read()).gesture, mixedOwner);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await record('touch-mouse-keyboard-cannot-steal-item-for-equip-or-combine', before, { owner: mixedOwner });

      await resizeViewport(page, { width: 390, height: 844 });
      const resizeBounds = await itemPoint();
      const resizeTouch = { id: 6, x: resizeBounds.centerX, y: resizeBounds.centerY };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [resizeTouch] });
      assert.equal((await read()).gesture?.kind, 'item');
      await resizeViewport(page, { width: 844, height: 390 });
      await until(current => current.gesture === null, 10000);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sameState(before, 'viewport change cancels item gesture without consuming it');
      await record('touch-viewport-cancel-late-release', before, { viewport: { width: 844, height: 390 } });

      await resizeViewport(page, { width: 390, height: 844 });
      await click('panel:items');
      const heading = page.locator('.item-panel > h3').first(); await heading.scrollIntoViewIfNeeded();
      const headingBounds = await heading.boundingBox();
      const bodyScroll = await page.evaluate(() => window.scrollY), scrollState = await state();
      const scrollPoint = { id: 7, x: headingBounds.x + headingBounds.width / 2, y: headingBounds.y + headingBounds.height / 2 };
      const scrollDistance = bodyScroll > 100 ? 160 : -160;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [scrollPoint] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...scrollPoint, y: scrollPoint.y + scrollDistance * step / 8 }] });
        await delay(25);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(previous => Math.abs(window.scrollY - previous) > 1, bodyScroll, { timeout: 10000 });
      const bodyAfter = await page.evaluate(() => window.scrollY);
      assert(Math.abs(bodyAfter - bodyScroll) > 1, 'native touch gesture actually scrolls the item panel');
      await sameState(scrollState, 'touch scrolling the inventory heading does not equip or combine');
      await record('touch-item-panel-scroll-without-equip', scrollState, {
        scrollBefore: bodyScroll, scrollAfter: bodyAfter, origin: 'inventory heading', input: 'CDP Input.dispatchTouchEvent native pan',
      });
      const beforeChoice = await ordinaryAugment(); snapshot = await read();
      const firstChoice = snapshot.bounds[`choice:${beforeChoice.pendingChoice.offers[0]}`];
      const secondChoice = snapshot.bounds[`choice:${beforeChoice.pendingChoice.offers[1]}`];
      assert(firstChoice.width >= 44 && firstChoice.height >= 44 && secondChoice.width >= 44 && secondChoice.height >= 44);
      const a = { id: 3, x: firstChoice.centerX, y: firstChoice.centerY }, b = { id: 4, x: secondChoice.centerX, y: secondChoice.centerY };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const simultaneous = await state();
      const simultaneousConfirmations = simultaneous.augments.length - beforeChoice.augments.length;
      assert(simultaneousConfirmations >= 0 && simultaneousConfirmations <= 1, 'two fingers never confirm twice');
      // Chromium can classify a two-finger contact as a gesture and suppress
      // both clicks. Record that result explicitly, then complete with one tap.
      if (simultaneous.phase === 'choice') {
        assert.deepEqual(simultaneous, beforeChoice, 'suppressed multi-touch clicks leave the choice atomic');
        await click(`choice:${beforeChoice.pendingChoice.offers[0]}`);
      }
      const chosen = await state(); assert.equal(chosen.phase, 'preparation'); assert.equal(chosen.pendingChoice, null);
      assert.equal(chosen.augments.length, 1); assert(beforeChoice.pendingChoice.offers.includes(chosen.augments[0].definitionId));
      assert.deepEqual(chosen.preparation, beforeChoice.preparation); assert.deepEqual(chosen.items, beforeChoice.items);
      assert.equal(chosen.gold, beforeChoice.gold);
      await record('touch-natural-R2-choice-two-fingers-at-most-one', beforeChoice, { simultaneousConfirmations, definitionId: chosen.augments[0].definitionId, method: 'CDP Input.dispatchTouchEvent' });
      await cdp.detach();
    }
  } finally {
    const inputs = await page.evaluate(() => {
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'click', 'wheel'])
        window.removeEventListener(type, window.__M4_RECORD_INTERACTION__, true);
      return window.__M4_INTERACTION_INPUTS__;
    });
    report.interactions.push({ name: 'native-interaction-inputs', touch, inputs });
    assert(inputs.length > 0); assert(inputs.every(input => input.trusted), 'all interaction input must be trusted');
  }
};
module.exports.resizeViewport = resizeViewport;
