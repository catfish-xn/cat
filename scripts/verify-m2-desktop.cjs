const assert = require('node:assert/strict');

// Independent ledger, not a live-state setter or a call into product commands.
function expectedAfter(before, command) {
  const state = structuredClone(before);
  if (command.type === 'reject') return state;
  assert.equal(state.phase, 'preparation');
  const units = state.preparation.units;
  if (command.type === 'reroll') {
    assert(state.gold >= 2);
    state.gold -= 2;
    state.shop = { generation: state.shop.generation + 1, slots: [] };
    for (let i = 0; i < 5; i++) {
      state.rngState = Number((BigInt(state.rngState) * 1664525n + 1013904223n) % 4294967296n);
      state.shop.slots.push({ status: 'available', definitionId: ['sentinel', 'ranger', 'mystic'][Number(BigInt(state.rngState) * 3n / 4294967296n)] });
    }
  } else if (command.type === 'buy') {
    assert(state.gold >= 3);
    const occupied = new Set(units.filter(unit => unit.location.kind === 'bench').map(unit => unit.location.slot));
    const slot = Array.from({ length: state.preparation.benchSize }, (_, i) => i).find(i => !occupied.has(i));
    assert.notEqual(slot, undefined);
    const offer = state.shop.slots[command.slot];
    assert.equal(offer.status, 'available');
    units.push({ id: `unit-${state.nextUnitSerial++}`, team: 'player', definitionId: offer.definitionId, location: { kind: 'bench', slot } });
    state.shop.slots[command.slot] = { status: 'purchased' };
    state.gold -= 3;
  } else if (command.type === 'deploy') {
    units.find(unit => unit.id === command.id).location = { kind: 'board', cell: command.cell };
  } else if (command.type === 'sell') {
    assert.equal(units.find(unit => unit.id === command.id).team, 'player');
    state.preparation.units = units.filter(unit => unit.id !== command.id);
    state.gold += 2;
  } else throw new Error(`Unknown desktop oracle command ${command.type}`);
  return state;
}

module.exports = async function verifyDesktop({ page, read, assertHud, report, capture }) {
  const evidence = report.desktop = { cycles: 0, steps: [], noArtificialInputDelays: true };
  // Observe after the application's native listener. This records trusted repeat
  // flags and the state already committed within the same keydown dispatch.
  await page.evaluate(() => {
    window.__desktopKeys = [];
    window.__desktopKeyObserver = event => {
      if (!['KeyD', 'KeyE'].includes(event.code)) return;
      const { gold, rngState, shop } = window.__CAT_DEBUG__.read().state;
      window.__desktopKeys.push({ code: event.code, repeat: event.repeat, trusted: event.isTrusted,
        gold, rngState, generation: shop.generation });
    };
    window.addEventListener('keydown', window.__desktopKeyObserver);
  });
  async function click(name) {
    const b = (await read()).bounds[name];
    await page.mouse.click(b.centerX, b.centerY);
  }
  async function hover(id) {
    const token = (await read()).tokens.find(token => token.id === id);
    assert(token, `Missing hover target ${id}`);
    await page.mouse.move(token.screenX, token.screenY);
  }
  async function dragTo(id, cell, release = true) {
    await hover(id);
    await page.mouse.down();
    const point = (await read()).layout.hexes[`${cell.col},${cell.row}`];
    await page.mouse.move(point.x, point.y, { steps: 2 });
    if (release) await page.mouse.up();
  }
  async function step(name, command, input) {
    const before = (await read()).state;
    const expected = expectedAfter(before, command);
    await input();
    const snapshot = await read(); // No polling, frame wait or animation delay.
    assert.deepEqual(snapshot.state, expected, name);
    assertHud(snapshot);
    if (command.type === 'reroll' || command.type === 'sell') {
      const event = await page.evaluate(() => window.__desktopKeys.at(-1));
      assert.equal(event.gold, expected.gold, `${name}: gold committed during keydown`);
      assert.equal(event.rngState, expected.rngState, `${name}: RNG committed during keydown`);
      assert.equal(event.generation, expected.shop.generation, `${name}: shop committed during keydown`);
    }
    const units = snapshot.state.preparation.units;
    assert.equal(snapshot.tokens.length, units.length, `${name}: no stale/missing token`);
    for (const unit of units) {
      const token = snapshot.tokens.find(token => token.id === unit.id);
      const p = unit.location.kind === 'bench' ? snapshot.layout.bench[unit.location.slot]
        : snapshot.layout.hexes[`${unit.location.cell.col},${unit.location.cell.row}`];
      assert(token?.visible && token.alpha === 1, `${name}: unit visible`);
      assert(Math.abs(token.screenX - p.x) < 0.1 && Math.abs(token.screenY - p.y) < 0.1, `${name}: view matches exact location`);
    }
    evidence.steps.push({ name, command, state: snapshot.state });
    return snapshot;
  }
  for (let cycle = 1; cycle <= 3; cycle++) {
    await step(`cycle-${cycle}-D`, { type: 'reroll' }, () => page.keyboard.press('d'));
    const id = `unit-${(await read()).state.nextUnitSerial}`;
    await step(`cycle-${cycle}-buy`, { type: 'buy', slot: 0 }, () => click('buy-0'));
    await step(`cycle-${cycle}-deploy`, { type: 'deploy', id, cell: { col: 6, row: 6 } }, () => dragTo(id, { col: 6, row: 6 }));
    await step(`cycle-${cycle}-E`, { type: 'sell', id }, () => page.keyboard.press('e'));
    await step(`cycle-${cycle}-repeat-E`, { type: 'reject' }, () => page.keyboard.press('e'));
    await step(`cycle-${cycle}-D-again`, { type: 'reroll' }, () => page.keyboard.press('d'));
    await step(`cycle-${cycle}-buy-again`, { type: 'buy', slot: 1 }, () => click('buy-1'));
    evidence.cycles++;
  }
  await capture('desktop-three-fast-cycles');

  await click('unit:unit-2');
  await hover('unit-5');
  await step('hover-bench-over-selected-board', { type: 'sell', id: 'unit-5' }, () => page.keyboard.down('e'));
  assert.equal((await read()).selectedId, null);
  await step('held-E-does-not-sell-old-selection', { type: 'reject' }, () => page.keyboard.down('e'));
  await page.keyboard.up('e');
  await click('unit:unit-2');
  await hover('enemy-1');
  await step('enemy-hover-blocks-selected-player-fallback', { type: 'reject' }, () => page.keyboard.press('e'));
  assert.equal((await read()).selectedId, 'unit-2');
  await page.mouse.move(30, 30);
  await step('blank-hover-uses-explicit-selection', { type: 'sell', id: 'unit-2' }, () => page.keyboard.press('e'));

  const dragged = (await read()).state.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'bench').id;
  // Capture the formal state before dragging; E must commit without waiting for release.
  await step('E-during-drag', { type: 'sell', id: dragged }, async () => {
    await dragTo(dragged, { col: 6, row: 6 }, false);
    assert.equal((await read()).draggingId, dragged);
    await page.keyboard.press('e');
  });
  assert.equal((await read()).draggingId, null);
  await step('late-release-after-sale', { type: 'reject' }, () => page.mouse.up());

  const overlapping = (await read()).state.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'bench').id;
  await step('deploy-adjacent-overlapping-hitboxes', { type: 'deploy', id: overlapping, cell: { col: 5, row: 5 } }, () => dragTo(overlapping, { col: 5, row: 5 }));
  const overlapSnapshot = await read();
  const oldToken = overlapSnapshot.tokens.find(token => token.id === 'unit-3');
  const newToken = overlapSnapshot.tokens.find(token => token.id === overlapping);
  await page.mouse.click((oldToken.screenX + newToken.screenX) / 2, (oldToken.screenY + newToken.screenY) / 2);
  assert.equal((await read()).selectedId, overlapping, 'Phaser click chooses later drawn token');
  await step('E-agrees-with-click-in-overlapping-hitboxes', { type: 'sell', id: overlapping }, () => page.keyboard.press('e'));

  const interrupted = (await read()).state.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'bench').id;
  await step('D-during-drag', { type: 'reroll' }, async () => {
    await dragTo(interrupted, { col: 6, row: 6 }, false);
    await page.keyboard.press('d');
  });
  assert.equal((await read()).draggingId, null);
  await step('late-release-after-reroll', { type: 'reject' }, () => page.mouse.up());

  await hover('unit-3');
  for (const chord of ['Control+d', 'Meta+d', 'Alt+d', 'Control+e', 'Meta+e', 'Alt+e', 'f']) {
    await step(`ignore-${chord}`, { type: 'reject' }, () => page.keyboard.press(chord));
  }
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'keyboard-focus-fixture'; document.body.append(input); input.focus();
  });
  await step('text-input-not-a-game-command', { type: 'reject' }, () => page.keyboard.type('dedef'));
  assert.equal(await page.locator('#keyboard-focus-fixture').inputValue(), 'dedef');
  await page.locator('#keyboard-focus-fixture').evaluate(element => element.remove());

  // Failure fixtures occur only after the uninterrupted five-round match and cycles.
  await click('debug-new-match');
  await step('full-bench-buy-1', { type: 'buy', slot: 0 }, () => click('buy-0'));
  await step('full-bench-buy-2', { type: 'buy', slot: 1 }, () => click('buy-1'));
  assert.equal((await read()).state.gold, 4);
  await step('bench-full-with-enough-gold', { type: 'reject' }, () => click('buy-2'));
  assert((await read()).texts.some(text => text.startsWith('备战席已满')));
  await step('purchased-slot-again', { type: 'reject' }, () => click('buy-0'));
  await click('debug-new-match');
  // Consecutive downs are Chromium autoRepeat events, not synthetic DOM dispatches.
  for (let i = 0; i < 8; i++) await step(`D-keydown-${i}`, { type: i < 5 ? 'reroll' : 'reject' }, () => page.keyboard.down('d'));
  await page.keyboard.up('d');
  assert.equal((await read()).state.gold, 0);
  await step('insufficient-buy', { type: 'reject' }, () => click('buy-0'));
  await click('debug-new-match');
  for (let i = 0; i < 8; i++) await step(`D-fast-press-${i}`, { type: i < 5 ? 'reroll' : 'reject' }, () => page.keyboard.press('d'));
  await capture('desktop-repeat-and-failures');
  evidence.keydowns = await page.evaluate(() => {
    window.removeEventListener('keydown', window.__desktopKeyObserver);
    const events = window.__desktopKeys;
    delete window.__desktopKeyObserver; delete window.__desktopKeys;
    return events;
  });
  assert(evidence.keydowns.every(event => event.trusted), 'all keyboard input comes from Chromium input dispatch');
  assert.equal(evidence.keydowns.filter(event => event.code === 'KeyD' && event.repeat).length, 7);
  assert.equal(evidence.keydowns.filter(event => event.code === 'KeyE' && event.repeat).length, 1);
  evidence.passed = true;
};
