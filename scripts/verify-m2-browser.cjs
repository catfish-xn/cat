/* Real Chromium input against one match; observations are copies, never state writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const preview = process.argv.includes('--preview');
const output = process.env.M2_EVIDENCE_DIR || path.join('artifacts', preview ? 'm2-preview' : 'm2-browser');
fs.mkdirSync(output, { recursive: true });
const errors = [], report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), seed: 42, preview, actions: [], rounds: [], errors };
let server, browser, page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const url = process.env.M2_URL || `http://127.0.0.1:${preview ? 4173 : 5173}`;
async function startServer() {
  if (!process.env.M2_URL) {
    server = spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', preview ? '4173' : '5173', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', data => fs.appendFileSync(path.join(output, 'server.log'), data));
    server.stderr.on('data', data => fs.appendFileSync(path.join(output, 'server.log'), data));
  }
  for (let i = 0; i < 150; i++) {
    if (server && server.exitCode !== null) throw new Error(`Server exited ${server.exitCode}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Server did not become ready');
}
async function read() { return page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null); }
async function until(check, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const snapshot = await read(); if (snapshot && check(snapshot)) return snapshot; await delay(75); }
  throw new Error(`Timed out: ${check}`);
}
async function capture(name) {
  const snapshot = await read();
  assertHud(snapshot);
  report.actions.push({ name, state: snapshot.state });
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  return snapshot;
}
function assertHud(snapshot) {
  assert(snapshot.texts.includes(`Round ${snapshot.state.round}`), 'Round HUD matches simulation');
  assert(snapshot.texts.includes(`Gold ${snapshot.state.gold}`), 'Gold HUD matches simulation');
  const names = { sentinel: '盾 守卫', ranger: '弓 游侠', mystic: '星 秘术师' };
  const expected = snapshot.state.shop.slots.map(slot => slot.status === 'purchased' ? '已购买\nPurchased' : `${names[slot.definitionId]}\nBuy · 3 G`);
  for (const text of new Set(expected)) assert.equal(snapshot.texts.filter(item => item === text).length, expected.filter(item => item === text).length, 'shop text and purchased labels match each slot');
  if (snapshot.state.phase === 'settlement') assert(snapshot.texts.includes(`第 ${snapshot.state.round} 回合\n本轮收入 +5 G`));
}
async function click(name) {
  const snapshot = await read(), bounds = snapshot.bounds[name];
  assert(bounds, `Missing UI bounds: ${name}`);
  await page.mouse.click(bounds.centerX, bounds.centerY);
  await delay(100);
}
async function drag(id, destination) {
  const snapshot = await read(), token = snapshot.tokens.find(token => token.id === id);
  assert(token, `Missing token ${id}`);
  await page.mouse.move(token.screenX, token.screenY);
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 12 });
  await page.mouse.up();
  await delay(120);
}
async function deploy(id, col, row) { await drag(id, (await read()).layout.hexes[`${col},${row}`]); }
function expectedShop(rngState) {
  const slots = [];
  for (let i = 0; i < 5; i++) {
    // BigInt modular arithmetic is independent of the implementation's Math.imul.
    rngState = Number((BigInt(rngState) * 1664525n + 1013904223n) % 4294967296n);
    slots.push({ status: 'available', definitionId: ['sentinel', 'ranger', 'mystic'][Number(BigInt(rngState) * 3n / 4294967296n)] });
  }
  return { rngState, slots };
}
function verifyShop(state, previousRng, generation) {
  const expected = expectedShop(previousRng);
  assert.equal(state.rngState, expected.rngState);
  assert.deepEqual(state.shop, { generation, slots: expected.slots });
}
function assertControlsFit(snapshot) {
  for (const name of ['buy-0', 'buy-1', 'buy-2', 'buy-3', 'buy-4', 'reroll', 'sell', 'start-combat']) {
    const b = snapshot.bounds[name];
    assert(b, `Control ${name} exists`);
    assert(b.x >= 0 && b.y >= 0 && b.width > 0 && b.height > 0 && b.x + b.width <= 960.5 && b.y + b.height <= 800.5, `${name} bounds fit viewport`);
  }
}

(async () => {
  try {
    await startServer();
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    report.browser = await browser.version();
    const context = await browser.newContext({ viewport: { width: 960, height: 800 }, hasTouch: true });
    await context.tracing.start({ screenshots: true, snapshots: true });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console.error: ${message.text()} (${message.location().url})`); });
    await page.goto(url);
    const initial = await until(snapshot => snapshot.state.phase === 'preparation');
    assert.equal(initial.state.round, 1); assert.equal(initial.state.gold, 10);
    verifyShop(initial.state, 42, 1); assertControlsFit(initial);
    await capture('initial-shop');
    if (preview) {
      await click('buy-0');
      assert.equal((await read()).state.gold, 7);
      assert((await read()).tokens.some(token => token.id === 'unit-6'));
      await capture('preview-purchase');
      assert.deepEqual(errors, []);
      await context.tracing.stop({ path: path.join(output, 'trace.zip') });
      report.passed = true;
      return;
    }

    await click('start-combat'); assert.deepEqual((await read()).state, initial.state);
    await deploy('unit-1', 0, 0); assert.deepEqual((await read()).state, initial.state);
    await deploy('unit-1', 1, 4);
    await deploy('unit-2', 1, 4); // occupied rejects, no swap
    assert.equal((await read()).state.preparation.units.find(unit => unit.id === 'unit-2').location.kind, 'bench');
    await drag('unit-1', (await read()).layout.bench[0]);
    await click('start-combat'); assert.deepEqual((await read()).state, initial.state);
    await deploy('enemy-1', 0, 4); assert.deepEqual((await read()).state, initial.state);
    report.m1Deployment = true;

    await click('buy-0');
    let snapshot = await read();
    assert.equal(snapshot.state.gold, 7); assert.equal(snapshot.state.shop.slots[0].status, 'purchased');
    assert.deepEqual(snapshot.state.preparation.units.find(unit => unit.id === 'unit-6').location, { kind: 'bench', slot: 5 });
    await click('buy-1'); snapshot = await capture('two-purchases');
    assert.equal(snapshot.state.gold, 4);
    assert.equal(snapshot.state.preparation.units.filter(unit => unit.location.kind === 'bench').length, 7);
    const full = snapshot.state;
    await click('buy-0'); assert.deepEqual((await read()).state, full);
    await click('buy-2'); assert.deepEqual((await read()).state, full);
    await click('unit:unit-6'); await click('sell');
    snapshot = await capture('bench-sale');
    assert.equal(snapshot.state.gold, 6);
    assert(!snapshot.tokens.some(token => token.id === 'unit-6'));
    assert(!snapshot.health.some(bar => bar.id === 'unit-6'));
    const oldRng = snapshot.state.rngState;
    await click('reroll'); snapshot = await capture('reroll');
    assert.equal(snapshot.state.gold, 4); verifyShop(snapshot.state, oldRng, 2);
    await deploy('unit-7', 1, 4); await deploy('unit-2', 3, 4); await deploy('unit-3', 5, 4);
    await deploy('unit-1', 0, 4); await click('unit:unit-1'); await click('sell');
    snapshot = await capture('board-sale-and-deployment');
    assert.equal(snapshot.state.gold, 6); assert(!snapshot.tokens.some(token => token.id === 'unit-1'));
    assert.equal(snapshot.state.preparation.units.find(unit => unit.id === 'unit-7').location.kind, 'board');

    for (let round = 1; round <= 5; round++) {
      const before = await read();
      await click('start-combat');
      const started = await until(snapshot => snapshot.state.phase === 'combat');
      const expected = await page.evaluate(async ({ preparation, tick }) => {
        const api = await import('/src/simulation/combat.ts');
        let state = api.createCombat(preparation);
        for (let i = 0; i < tick; i++) state = api.stepCombat(state).state;
        return state;
      }, { preparation: before.state.preparation, tick: started.state.combat.tick });
      assert.deepEqual(started.state.combat, expected, `round ${round}: fresh HP/death/cooldown/target at observed tick`);
      assert.equal(started.state.combat.units.length, before.state.preparation.units.filter(unit => unit.location.kind === 'board').length);
      await click('start-combat'); await click('buy-0'); await click('reroll'); await click('sell');
      await deploy('unit-4', 6, 7);
      const locked = await read();
      assert.equal(locked.state.phase, 'combat');
      assert.equal(locked.state.gold, before.state.gold); assert.equal(locked.state.rngState, before.state.rngState);
      assert.deepEqual(locked.state.preparation, before.state.preparation);
      assert(locked.state.combat.tick >= started.state.combat.tick);
      const advanced = await until(snapshot => snapshot.state.phase === 'combat' && snapshot.state.combat.tick >= 40);
      await click('start-combat');
      assert((await read()).state.combat.tick >= advanced.state.combat.tick, 'Repeated Start after 40 ticks must not restart combat');
      let lastTick = -1, moved = false, attacked = false, damaged = false, died = false, previousHp = new Map();
      const initialCells = new Map(expected.units.map(unit => [unit.id, before.state.preparation.units.find(owned => owned.id === unit.id).location.cell]));
      const deadline = Date.now() + 75000;
      while (Date.now() < deadline) {
        snapshot = await read();
        assert(snapshot.state.combat.tick >= lastTick); lastTick = snapshot.state.combat.tick;
        assert.deepEqual(snapshot.state.preparation, before.state.preparation);
        assert.equal(snapshot.state.rngState, before.state.rngState);
        assert.deepEqual(snapshot.state.shop, before.state.shop);
        const occupied = new Set();
        for (const unit of snapshot.state.combat.units) {
          moved ||= JSON.stringify(unit.cell) !== JSON.stringify(initialCells.get(unit.id));
          attacked ||= unit.cooldownTicks > 0; damaged ||= unit.hp < unit.maxHp; died ||= !unit.alive;
          if (previousHp.has(unit.id)) assert(unit.hp <= previousHp.get(unit.id)); previousHp.set(unit.id, unit.hp);
          if (unit.alive) { const key = `${unit.cell.col},${unit.cell.row}`; assert(!occupied.has(key)); occupied.add(key); }
        }
        if (snapshot.state.phase === 'settlement') break;
        assert.equal(snapshot.state.gold, before.state.gold);
        await delay(75);
      }
      assert.equal(snapshot.state.phase, 'settlement'); assert(moved && attacked && damaged && died);
      const settled = snapshot.state;
      assert.equal(settled.gold, before.state.gold + 5); assert.equal(settled.roundResults.length, round);
      assert.deepEqual(settled.roundResults.at(-1), { round, result: settled.combat.result, combatTicks: settled.combat.tick, income: 5, goldBefore: before.state.gold, goldAfter: settled.gold });
      assert(snapshot.texts.some(text => text.includes({ playerWin: 'Victory', enemyWin: 'Defeat', draw: 'Draw' }[settled.combat.result])));
      await capture(`round-${round}-result`);
      await delay(300); await click('buy-0'); await click('reroll'); await click('sell');
      assert.deepEqual((await read()).state, settled, 'result frames and rejected input cannot settle twice');
      const continueBounds = (await read()).bounds.continue;
      await page.mouse.click(continueBounds.centerX, continueBounds.centerY, { clickCount: 2, delay: 25 });
      const next = await until(snapshot => snapshot.state.phase === 'preparation');
      assert.equal(next.state.round, round + 1); assert.equal(next.state.gold, settled.gold); assert.equal(next.state.combat, null);
      verifyShop(next.state, settled.rngState, settled.shop.generation + 1);
      assert.deepEqual(next.state.preparation, before.state.preparation);
      assert(!next.state.preparation.units.some(unit => ['unit-1', 'unit-6'].includes(unit.id)));
      assert.equal(next.effects, 0); assert.equal(next.tweens, 0); assert.equal(next.draggingId, null);
      assert(next.health.every(bar => !bar.visible)); assert(next.tokens.every(token => token.visible && token.alpha === 1));
      for (const unit of next.state.preparation.units) {
        const token = next.tokens.find(token => token.id === unit.id);
        const p = unit.location.kind === 'board' ? next.layout.hexes[`${unit.location.cell.col},${unit.location.cell.row}`] : next.layout.bench[unit.location.slot];
        assert(Math.abs(token.screenX - p.x) < 0.1 && Math.abs(token.screenY - p.y) < 0.1);
      }
      await capture(`round-${round}-continued`);
      report.rounds.push({ round, result: settled.combat.result, tick: settled.combat.tick, goldBefore: before.state.gold,
        goldAfter: settled.gold, rngState: next.state.rngState, shopGeneration: next.state.shop.generation, purchasedId: 'unit-7', moved, attacked, damaged, died });
      console.log(JSON.stringify(report.rounds.at(-1)));
      if (round === 1) {
        await deploy('unit-7', 0, 7);
        assert.deepEqual((await read()).state.preparation.units.find(unit => unit.id === 'unit-7').location, { kind: 'board', cell: { col: 0, row: 7 } });
      }
    }
    snapshot = await read();
    assert.equal(snapshot.state.round, 6); assert.equal(snapshot.state.gold, 31); assert.equal(snapshot.state.shop.generation, 7);
    assert.deepEqual(snapshot.state.roundResults.map(item => item.round), [1, 2, 3, 4, 5]);
    report.fiveRoundMatch = true;

    // Extra viewport/input regression uses the same live match after completing the main path.
    await page.setViewportSize({ width: 390, height: 844 }); await delay(300);
    await capture('mobile-layout');
    const cdp = await context.newCDPSession(page);
    const from = (await read()).tokens.find(token => token.id === 'unit-4');
    const to = (await read()).layout.hexes['6,7'];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.screenX, y: from.screenY }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.screenX + (to.x - from.screenX) * i / 12, y: from.screenY + (to.y - from.screenY) * i / 12 }] }); await delay(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(150);
    assert.deepEqual((await read()).state.preparation.units.find(unit => unit.id === 'unit-4').location, { kind: 'board', cell: { col: 6, row: 7 } });
    const reroll = (await read()).bounds.reroll;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: reroll.centerX, y: reroll.centerY }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(150);
    assert.equal((await read()).state.gold, 29);
    report.touchSimulation = true; await capture('mobile-touch-deployed');

    // Separate debug/reset and invalid-income checks after the uninterrupted five-round path.
    await page.setViewportSize({ width: 960, height: 800 }); await delay(250);
    await click('debug-new-match');
    assert.deepEqual((await read()).state, initial.state);
    for (let i = 0; i < 5; i++) await click('reroll');
    const poor = (await read()).state;
    assert.equal(poor.gold, 0);
    await click('reroll'); assert.deepEqual((await read()).state, poor);
    assert((await read()).texts.includes('金币不足'));
    await click('buy-0'); assert.deepEqual((await read()).state, poor);
    await capture('insufficient-gold');
    await click('debug-new-match'); assert.deepEqual((await read()).state, initial.state);
    report.debugNewMatch = true;

    // M1 missing-enemy UI regression: isolated startup fixture, never edits the five-round match.
    await page.route('**/src/simulation/game.ts', async route => {
      const response = await route.fetch(), source = await response.text();
      const body = source.replace(/units: \[\.\.\.playerUnits, \.\.\.enemyUnits\]/, 'units: [...playerUnits]');
      assert.notEqual(body, source, 'startup fixture must omit enemies');
      await route.fulfill({ response, body });
    });
    await page.reload(); await until(snapshot => snapshot.state.phase === 'preparation');
    await click('start-combat');
    assert.equal((await read()).state.combat, null);
    assert((await read()).texts.some(text => text.includes('无法开始：棋盘上双方都至少需要 1 个单位')));
    await capture('missing-both-fixture');
    await deploy('unit-1', 1, 4); await click('start-combat');
    assert.equal((await read()).state.combat, null);
    assert((await read()).texts.some(text => text.includes('无法开始：棋盘上至少需要 1 个敌方单位')));
    await capture('missing-enemy-fixture');
    report.missingEnemyFixture = true;
    assert.deepEqual(errors, []);
    await context.tracing.stop({ path: path.join(output, 'trace.zip') });
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.failure = error.stack || String(error);
    if (page) {
      try { report.lastSnapshot = await read(); await page.screenshot({ path: path.join(output, 'failure.png') }); } catch {}
      try { await page.context().tracing.stop({ path: path.join(output, 'trace.zip') }); } catch {}
    }
    console.error(error); process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    if (report.passed) console.log(`PASS: ${preview ? 'production preview' : 'five-round real-input match'}; evidence: ${output}`);
  }
})();
