/* Real mouse-input verification against the Vite dev server; no game-state writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.M1_EVIDENCE_DIR || '/tmp/m1-browser';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), browser: await browser.version(), rounds: [] };
  async function read() {
    return page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes('/phaser.js?'));
      if (!url) return null;
      const Phaser = (await import(url)).default;
      const scene = Phaser.Display.Canvas.CanvasPool.pool.find(entry => entry.parent?.scene?.sys?.settings?.key === 'Board')?.parent.scene;
      if (!scene?.session) return null;
      return { phase: scene.session.phase, preparation: scene.session.preparation, combat: scene.session.combat,
        tokens: [...scene.tokens].map(([id, token]) => ({ id, x: token.x, y: token.y, visible: token.visible, alpha: token.alpha, draggable: token.input?.draggable })),
        texts: scene.children.list.filter(child => child.type === 'Text').map(child => child.text),
        effects: scene.effects.size, health: [...scene.health.values()].map(bar => bar.visible), tweens: scene.tweens.getTweens().length };
    });
  }
  async function until(check, timeout = 10000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const state = await read(); if (state && check(state)) return state; await page.waitForTimeout(80); }
    throw new Error(`Browser condition timed out: ${check}`);
  }
  async function drag(from, to) {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(120);
  }
  function hex(col, row) { return { x: 242 + Math.sqrt(3) * 36 * (col + (row % 2) / 2), y: 146 + 54 * row }; }
  async function clickText(text) {
    const point = await page.evaluate(async text => {
      const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes('/phaser.js?'));
      const Phaser = (await import(url)).default;
      const scene = Phaser.Display.Canvas.CanvasPool.pool.find(entry => entry.parent?.scene?.sys?.settings?.key === 'Board').parent.scene;
      const label = scene.children.list.find(child => child.type === 'Text' && child.input?.enabled && child.text.includes(text));
      if (!label) throw new Error(`Missing button ${text}`);
      const bounds = label.getBounds(); return { x: bounds.centerX, y: bounds.centerY };
    }, text);
    await page.mouse.click(point.x, point.y);
  }
  try {
    await page.goto(process.env.M1_URL || 'http://127.0.0.1:5173');
    await until(state => state.phase === 'preparation');
    // Existing restrictions: enemy area and occupied cells reject a real drag.
    await drag({ x: 242, y: 660 }, hex(0, 0));
    assert.equal((await read()).preparation.units.find(unit => unit.id === 'unit-1').location.kind, 'bench');
    for (const [slot, col] of [[0, 1], [1, 3], [2, 5]]) await drag({ x: 242 + slot * 80, y: 660 }, hex(col, 4));
    const deployed = await read();
    assert.equal(deployed.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board').length, 3);
    await drag({ x: 482, y: 660 }, hex(1, 4));
    assert.equal((await read()).preparation.units.find(unit => unit.id === 'unit-4').location.kind, 'bench');
    await page.screenshot({ path: path.join(output, 'preparation.png') });
    for (let round = 1; round <= 2; round++) {
      const before = await read();
      await clickText('Start Combat');
      const started = await until(state => state.phase === 'combat');
      assert.equal(started.combat.units.length, 5);
      // Real frames may already have applied tick-one damage by the first observation.
      const expectedStart = await page.evaluate(async ({ preparation, tick }) => {
        const api = await import('/src/simulation/combat.ts');
        let state = api.createCombat(preparation);
        for (let i = 0; i < tick; i++) state = api.stepCombat(state).state;
        return state;
      }, { preparation: before.preparation, tick: started.combat.tick });
      assert.deepEqual(started.combat, expectedStart, 'Each Start must begin with fresh combat, independent of the previous match');
      // Repeated click and bench drag must not restart or deploy during combat.
      await clickText('Start Combat');
      assert((await read()).combat.tick >= started.combat.tick, 'Repeated Start must preserve the current clock');
      await drag({ x: 482, y: 660 }, hex(6, 7));
      assert.deepEqual((await read()).preparation, before.preparation);
      const initialCells = new Map(before.preparation.units.filter(unit => unit.location.kind === 'board').map(unit => [unit.id, unit.location.cell]));
      let moved = false, damaged = false, attacked = false, died = false, lastTick = -1, previousHp = new Map(), capturedCombat = false;
      const end = Date.now() + 75000;
      let state;
      while (Date.now() < end) {
        state = await read();
        assert(state.combat.tick >= lastTick, 'Repeated Start must not reset the logical clock'); lastTick = state.combat.tick;
        assert.deepEqual(state.preparation, before.preparation);
        const occupied = new Set();
        for (const unit of state.combat.units) {
          moved ||= JSON.stringify(unit.cell) !== JSON.stringify(initialCells.get(unit.id));
          damaged ||= unit.hp < unit.maxHp;
          attacked ||= unit.cooldownTicks > 0;
          died ||= !unit.alive;
          if (previousHp.has(unit.id)) assert(unit.hp <= previousHp.get(unit.id));
          previousHp.set(unit.id, unit.hp);
          if (unit.alive) { const key = `${unit.cell.col},${unit.cell.row}`; assert(!occupied.has(key)); occupied.add(key); }
        }
        if (damaged && !capturedCombat) { await page.screenshot({ path: path.join(output, `round-${round}-combat.png`) }); capturedCombat = true; }
        if (state.phase === 'result') break;
        await page.waitForTimeout(100);
      }
      assert.equal(state.phase, 'result');
      assert(moved && damaged && attacked && died, 'Must observe movement, attacks, decreasing HP and death');
      const label = { playerWin: 'Victory', enemyWin: 'Defeat', draw: 'Draw' }[state.combat.result];
      assert(state.texts.some(text => text.includes(label)), 'Rendered result must match simulation');
      await page.screenshot({ path: path.join(output, `round-${round}-result.png`) });
      report.rounds.push({ round, result: state.combat.result, tick: state.combat.tick, moved, damaged, attacked, died });
      await clickText('Reset to');
      const reset = await until(state => state.phase === 'preparation');
      assert.equal(reset.combat, null); assert.deepEqual(reset.preparation, before.preparation); assert.equal(reset.tweens, 0); assert.equal(reset.effects, 0); assert(reset.health.every(visible => !visible));
      assert(reset.tokens.every(token => token.visible && token.alpha === 1));
      for (const unit of reset.preparation.units) {
        const token = reset.tokens.find(token => token.id === unit.id);
        const point = unit.location.kind === 'board' ? hex(unit.location.cell.col, unit.location.cell.row) : { x: 242 + unit.location.slot * 80, y: 660 };
        assert(Math.abs(token.x - point.x) < 0.01 && Math.abs(token.y - point.y) < 0.01);
      }
      await page.screenshot({ path: path.join(output, `round-${round}-reset.png`) });
      if (round === 1) {
        await drag(hex(1, 4), hex(0, 7));
        assert.deepEqual((await read()).preparation.units.find(unit => unit.id === 'unit-1').location.cell, { col: 0, row: 7 });
      }
      console.log(JSON.stringify(report.rounds.at(-1)));
    }
    assert.deepEqual(errors, []);
    report.errors = errors; report.passed = true;
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    console.log(`PASS: real-input two-combat flow; evidence: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
