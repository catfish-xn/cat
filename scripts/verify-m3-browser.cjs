/* Real Chromium inputs only. Node expectations never write to the running game. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const createFixtures = require('./generate-m3-fixture.cjs');
const { expectedCommand, expectedRound, expectedShop, COST, XP, ODDS } = require('../tests/fixtures/m3/oracle.cjs');
const preview = process.argv.includes('--preview');
const output = process.env.M3_EVIDENCE_DIR || path.join('artifacts', preview ? 'm3-preview' : 'm3-browser');
fs.mkdirSync(output, { recursive: true });
const errors = [], report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  gitStatus: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(),
  schemaVersion: 3, rulesVersion: 'm3-v1', contentVersion: 'm3-content-v1', seed: 42,
  node: process.version, preview, actions: [], growth: [], terminal: [], screenshots: [], errors };
const names = { sentinel: ['盾','守卫'], ranger: ['弓','游侠'], mystic: ['星','秘术师'], bulwark: ['壁','壁垒'], archer: ['箭','神射手'], arcanist: ['术','奥术师'], duelist: ['刃','决斗者'], warden: ['卫','守望者'], tempest: ['岚','风暴使'], colossus: ['巨','巨像'], oracle: ['谕','先知'] };
let server, browser, page, context;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const url = process.env.M3_URL || `http://127.0.0.1:${preview ? 4173 : 5173}`;
async function startServer() {
  if (!process.env.M3_URL) {
    server = spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', preview ? '4173' : '5173', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    for (const pipe of [server.stdout, server.stderr]) pipe.on('data', data => fs.appendFileSync(path.join(output, 'server.log'), data));
  }
  for (let i = 0; i < 150; i++) { if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error(`Vite exited ${server.exitCode}`); try { if ((await fetch(url)).ok) return; } catch {} await delay(100); }
  throw Error('Vite did not become ready');
}
async function read() { return page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null); }
async function until(check, timeout = 10000) { const end = Date.now() + timeout; while (Date.now() < end) { const s = await read(); if (s && check(s)) return s; await delay(50); } throw Error(`Timed out: ${check}`); }
function assertHud(snapshot) {
  const s = snapshot.state, h = snapshot.hud;
  assert.equal(h.round, `Round ${s.round}`); assert.equal(h.gold, `Gold ${s.gold}`); assert.equal(h.playerHp, `HP ${s.playerHp}`);
  assert.equal(h.level, `Level ${s.level}`); assert.equal(h.xp, s.level === 9 ? 'XP MAX' : `XP ${s.xp} / ${XP[s.level]}`);
  assert.equal(h.population, `我方人口 ${s.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length} / ${s.level}`);
  for (let tier = 1; tier <= 5; tier++) assert(h.odds.includes(`${tier}费 ${ODDS[s.level][tier - 1]}%`));
  const expected = s.shop.slots.map(o => o.status === 'purchased' ? '已购买\nPurchased' : `${names[o.definitionId][0]} ${names[o.definitionId][1]}\nBuy · ${COST[o.definitionId]} G`);
  for (const text of new Set(expected)) assert.equal(snapshot.texts.filter(x => x === text).length, expected.filter(x => x === text).length, `visible shop ${text}`);
  assert.equal(snapshot.tokens.length, s.preparation.units.length, 'no stale token');
  for (const unit of s.preparation.units) {
    const token = snapshot.tokens.find(t => t.id === unit.id); assert(token);
    assert.equal(token.definitionId, unit.definitionId); assert.equal(token.starLevel, unit.starLevel);
    assert.equal(token.starLabel, '★'.repeat(unit.starLevel)); assert.equal(token.name, names[unit.definitionId][1]); assert.equal(token.symbol, names[unit.definitionId][0]); assert.equal(token.cost, COST[unit.definitionId]);
    if (s.phase === 'preparation' && snapshot.draggingId !== unit.id) {
      const p = unit.location.kind === 'board' ? snapshot.layout.hexes[`${unit.location.cell.col},${unit.location.cell.row}`] : snapshot.layout.bench[unit.location.slot];
      assert(Math.abs(token.screenX - p.x) < .1 && Math.abs(token.screenY - p.y) < .1, `${unit.id} exact preparation coordinates`);
      assert(token.visible && token.alpha === 1);
    }
  }
  if (s.combat) for (const unit of s.combat.units) {
    for (const [key, value, maximum] of [['health', unit.hp, unit.maxHp], ['mana', unit.mana, unit.maxMana], ['shields', unit.shield, unit.maxHp]]) {
      const meter = snapshot[key].find(m => m.id === unit.id); assert(meter);
      assert.equal(meter.value, value); assert.equal(meter.maxValue, maximum);
      const ratio = key === 'shields' ? Math.min(1, value / maximum) : value / maximum;
      assert.equal(meter.ratio, ratio); assert.equal(meter.width, 52 * ratio);
      assert.equal(meter.visible, unit.alive && (key !== 'shields' || unit.shield > 0));
      if (key === 'shields' && unit.shield > 0 && unit.alive) { assert(meter.labelVisible); assert.equal(meter.text, `盾 ${unit.shield}`); }
    }
  }
  if (s.phase === 'settlement' || s.phase === 'gameOver') {
    const result = s.roundResults.at(-1), label = { playerWin: 'Victory', enemyWin: 'Defeat', draw: 'Draw' }[result.result];
    assert.equal(h.result, s.phase === 'gameOver' ? 'Game Over' : label);
    assert(h.settlement.includes(`HP ${result.hpBefore} → ${result.hpAfter} (-${result.hpLost})`));
    assert(h.settlement.includes(`收入 +5 G / XP +${result.xpAwarded}`));
  }
}
async function capture(name) {
  const snapshot = await read(); assertHud(snapshot);
  const file = `${name}.png`; await page.screenshot({ path: path.join(output, file) }); report.screenshots.push(file); return snapshot;
}
async function click(name) { const b = (await read()).bounds[name]; assert(b, `Missing ${name}`); await page.mouse.click(b.centerX, b.centerY); }
async function drag(id, destination) { const token = (await read()).tokens.find(t => t.id === id); assert(token, `Missing ${id}`); await page.mouse.move(token.screenX, token.screenY); await page.mouse.down(); await page.mouse.move(destination.x, destination.y, { steps: 4 }); await page.mouse.up(); }
async function ledgerStep(name, command, input) {
  const before = (await read()).state, prediction = expectedCommand(before, command);
  const keyCount = await page.evaluate(() => window.__m3Keys?.length ?? 0);
  await input(); const snapshot = await read();
  assert.deepEqual(snapshot.state, prediction.state, name); assertHud(snapshot);
  report.actions.push({ name, command, accepted: prediction.ok, ...(prediction.ok ? { events: prediction.events } : { reason: prediction.reason }), state: snapshot.state });
  if (['reroll', 'buyXp', 'sell'].includes(command.type)) {
    const key = { reroll: 'KeyD', buyXp: 'KeyF', sell: 'KeyE' }[command.type];
    const observed = await page.evaluate(count => (window.__m3Keys?.length ?? 0) > count ? window.__m3Keys.at(-1) : null, keyCount);
    if (observed?.code === key) { assert(observed.trusted); assert.deepEqual(observed.state, snapshot.state, `${name}: committed during native keydown`); }
  }
  return snapshot;
}
async function input(command) {
  if (command.type === 'reroll') await page.keyboard.press('d');
  else if (command.type === 'buyXp') await page.keyboard.press('f');
  else if (command.type === 'buy') await click(`buy-${command.slot}`);
  else if (command.type === 'sell') { const token = (await read()).tokens.find(t => t.id === command.id); assert(token); await page.mouse.move(token.screenX, token.screenY); await page.keyboard.press('e'); }
  else if (command.type === 'deploy') { const snap = await read(), p = command.target.kind === 'board' ? snap.layout.hexes[`${command.target.cell.col},${command.target.cell.row}`] : snap.layout.bench[command.target.slot]; await drag(command.id, p); }
}
function observePageErrors(target) {
  target.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  target.on('console', e => { if (e.type() === 'error') errors.push(`console.error: ${e.text()} (${e.location().url})`); });
}
async function attachObservers() {
  await page.evaluate(() => {
    window.__m3Keys = [];
    window.addEventListener('keydown', event => {
      if (['KeyD','KeyF','KeyE'].includes(event.code)) window.__m3Keys.push({ code: event.code, repeat: event.repeat, trusted: event.isTrusted, state: window.__CAT_DEBUG__.read().state });
    });
  });
}
async function play(run) {
  const evidence = report[run.name], flags = { mana: false, shield: false, physical: false, magic: false, cast: false, absorbed: false };
  assert.deepEqual((await read()).state, run.initial);
  for (const round of run.rounds) {
    let inFastChain = false;
    for (const entry of round.preparationActions) {
      if (entry.annotation?.match(/^fast-chain-\d+-start$/)) inFastChain = true;
      assert.deepEqual((await read()).state, entry.before);
      await ledgerStep(`${run.name}-r${round.round}-${entry.annotation || entry.command.type}`, entry.command, () => input(entry.command));
      if (entry.annotation?.match(/^fast-chain-\d+-end$/)) {
        inFastChain = false;
        await capture(`${run.name}-r${round.round}-${entry.annotation}`);
      } else if (!inFastChain && entry.annotation && !entry.annotation.startsWith('fast-')) await capture(`${run.name}-r${round.round}-${entry.annotation}`);
    }
    assert.deepEqual((await read()).state, round.before);
    await click('start-combat');
    const seen = [], seenKeys = new Set(); let lastTick = -1;
    function check(snapshot) {
      const tick = snapshot.state.combat.tick;
      assert(tick >= lastTick); lastTick = tick;
      assert.deepEqual(snapshot.state, round.atTick.get(tick), `${run.name} round ${round.round} exact tick ${tick}`);
      assertHud(snapshot);
      for (const event of snapshot.recentCombatEvents) {
        const key = JSON.stringify(event); if (!seenKeys.has(key)) { seenKeys.add(key); seen.push(event); }
        flags.cast ||= event.type === 'cast'; flags.absorbed ||= event.type === 'damage' && event.absorbed > 0;
        flags.physical ||= event.type === 'damage' && event.physicalAmount > 0; flags.magic ||= event.type === 'damage' && event.magicAmount > 0;
      }
      flags.mana ||= snapshot.mana.some(m => m.visible && m.value > 0);
      flags.shield ||= snapshot.shields.some(m => m.visible && m.value > 0);
    }
    let snapshot = await read(); check(snapshot);
    if (round.round === 1 && snapshot.state.phase === 'combat') {
      for (const name of ['start-combat','buy-0','reroll','buy-xp','sell']) { await click(name); check(await read()); }
      for (const key of ['d','f','e']) { await page.keyboard.press(key); check(await read()); }
    }
    const deadline = Date.now() + 75000; let capturedCast = false;
    while (Date.now() < deadline) {
      snapshot = await read(); check(snapshot);
      if (!capturedCast && run.name === 'growth' && snapshot.recentCombatEvents.some(e => e.type === 'cast')) { await capture(`growth-r${round.round}-cast-shield`); capturedCast = true; }
      if (snapshot.state.phase !== 'combat') break;
      await delay(60);
    }
    assert.deepEqual(snapshot.state, round.settled, `${run.name} round ${round.round} terminal`);
    assert.deepEqual(seen, round.events, 'every real emitted event observed in canonical order');
    assert.deepEqual(snapshot.state.roundResults.at(-1), expectedRound(round.before, snapshot.state.combat));
    await capture(`${run.name}-round-${round.round}-result`);
    for (const key of ['d','f','e']) await page.keyboard.press(key);
    await click('start-combat'); await click('buy-0'); await click('buy-xp');
    assert.deepEqual((await read()).state, round.settled, 'result-page input cannot settle twice');
    const result = round.settled.roundResults.at(-1);
    evidence.push({ ...result, rngState: round.settled.rngState, shopGeneration: round.settled.shop.generation, eventCount: seen.length });
    console.log(JSON.stringify({ path: run.name, round: round.round, result: result.result, tick: result.combatTicks, hp: result.hpAfter, gold: result.goldAfter }));
    if (round.settled.phase === 'settlement') {
      const b = (await read()).bounds.continue;
      await page.mouse.click(b.centerX, b.centerY, { clickCount: 2, delay: 15 });
      const next = await read(); assert.deepEqual(next.state, round.continued, 'double Continue commits once'); assertHud(next);
      assert.equal(next.effects, 0); assert.equal(next.tweens, 0); assert.equal(next.draggingId, null);
      assert(next.health.every(m => !m.visible)); assert(next.mana.every(m => !m.visible)); assert(next.shields.every(m => !m.visible));
      assert.deepEqual(next.recentCombatEvents, []);
    }
  }
  assert.deepEqual((await read()).state, run.final);
  if (run.name === 'growth') { assert(Object.values(flags).every(Boolean), JSON.stringify(flags)); report.growthVisuals = flags; report.growthKeydowns = await page.evaluate(() => window.__m3Keys); }
}
(async () => {
  try {
    const fixtures = await createFixtures();
    report.fixture = { growth: fixtures.growth.commands.map(c => ({ command: c.command, annotation: c.annotation })), terminal: fixtures.terminal.commands.map(c => c.command) };
    await startServer();
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
    report.browser = await browser.version();
    context = await browser.newContext({ viewport: { width: 960, height: 800 }, hasTouch: true });
    await context.tracing.start({ screenshots: true, snapshots: true }); page = await context.newPage(); observePageErrors(page);
    await page.goto(url); await until(s => s.state.phase === 'preparation'); await attachObservers();
    for (const name of ['buy-0','buy-1','buy-2','buy-3','buy-4','reroll','buy-xp','sell','start-combat','continue']) {
      const b = (await read()).bounds[name]; assert(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 960.5 && b.y + b.height <= 800.5, `${name} fits viewport`);
    }
    await capture('initial'); await play(fixtures.growth); await capture('growth-round-9-continued');
    await require('./verify-m3-desktop.cjs')({ page, read, click, drag, assertHud, capture, report, ledgerStep, context, preview, initial: fixtures.growth.initial });
    await context.tracing.stop({ path: path.join(output, 'growth-desktop-trace.zip') });
    await page.close();
    await context.tracing.start({ screenshots: true, snapshots: true }); page = await context.newPage(); observePageErrors(page);
    await page.goto(url); await until(s => s.state.phase === 'preparation'); await attachObservers();
    await play(fixtures.terminal);
    const terminal = (await read()).state;
    for (const name of ['continue','start-combat','buy-0','reroll','buy-xp','sell']) await click(name);
    for (const key of ['d','f','e']) await page.keyboard.press(key);
    const p = (await read()).layout.hexes['1,5']; await drag('unit-1', p); await delay(150);
    assert.deepEqual((await read()).state, terminal); await capture('game-over-locked');
    await click('debug-new-match'); const reset = await read(); assert.deepEqual(reset.state, fixtures.terminal.initial);
    assert.equal(reset.renderedCastCount, 0); assert.equal(reset.renderedUpgradeCount, 0); assert.equal(reset.effects, 0); assert.equal(reset.tweens, 0); assert.deepEqual(reset.recentCombatEvents, []);
    await capture('new-match');
    await page.setViewportSize({ width: 390, height: 844 }); await delay(150); await capture('mobile-layout');
    const cdp = await context.newCDPSession(page);
    async function tap(name) { const b = (await read()).bounds[name]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.centerX, y: b.centerY }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    await ledgerStep('touch-buy', { type: 'buy', slot: 0, generation: 1 }, () => tap('buy-0'));
    await ledgerStep('touch-F', { type: 'buyXp' }, () => tap('buy-xp'));
    await ledgerStep('touch-F-level-up', { type: 'buyXp' }, () => tap('buy-xp'));
    assert.equal((await read()).state.level, 4);
    const from = (await read()).tokens.find(t => t.id === 'unit-1'), to = (await read()).layout.hexes['1,4'];
    await ledgerStep('touch-exact-deploy', { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 1, row: 4 } } }, async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.screenX, y: from.screenY }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.screenX + (to.x - from.screenX) * i / 8, y: from.screenY + (to.y - from.screenY) * i / 8 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
    await capture('mobile-touch-growth');
    const touchBefore = (await read()).state;
    await tap('start-combat');
    const touchSettled = await until(s => s.state.phase === 'settlement', 75000);
    assert.deepEqual(touchSettled.state.roundResults.at(-1), expectedRound(touchBefore, touchSettled.state.combat));
    await capture('mobile-touch-battle-result');
    await tap('continue');
    const touchNext = await read(); assertHud(touchNext);
    assert.equal(touchNext.state.round, 2); assert.equal(touchNext.state.combat, null);
    assert.deepEqual(touchNext.state.preparation.units.filter(u => u.team === 'player'), touchBefore.preparation.units.filter(u => u.team === 'player'));
    for (const field of ['gold','level','xp','playerHp']) assert.equal(touchNext.state[field], touchSettled.state[field]);
    assert.deepEqual({ shop: touchNext.state.shop, rngState: touchNext.state.rngState }, expectedShop(touchSettled.state.rngState, touchSettled.state.shop.generation + 1, touchSettled.state.level));
    await capture('mobile-touch-continued'); report.touch = { level: touchBefore.level, result: touchSettled.state.roundResults.at(-1), continuedRound: touchNext.state.round };
    assert.deepEqual(errors, []);
    await context.tracing.stop({ path: path.join(output, 'terminal-mobile-trace.zip') });
    report.passed = true;
  } catch (error) {
    report.passed = false; report.failure = error.stack || String(error); process.exitCode = 1; console.error(error);
    if (page) { try { report.lastSnapshot = await read(); await page.screenshot({ path: path.join(output, 'failure.png') }); } catch {} }
    if (context) try { await context.tracing.stop({ path: path.join(output, 'failure-trace.zip') }); } catch {}
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close(); if (server) server.kill('SIGTERM');
    if (report.passed) console.log(`PASS M3 ${preview ? 'production preview' : 'dev'} growth + Game Over + desktop/touch; ${output}`);
  }
})();
