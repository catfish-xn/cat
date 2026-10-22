/** Offline visual fixture: real Match commands, real pointer drag and real next tick; no external requests.
 * Fixture inventory is injected only by this harness. The production debug surface remains read-only.
 * Run: node tests/battle-equipment-browser.mjs (Vite must already listen on 5188).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const out = 'artifacts/battle-equip'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const mode of ['2d', '3d']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' && url.protocol !== 'data:') return route.abort();
      if (url.pathname === '/src/main.ts') {
        const response = await route.fetch();
        return route.fulfill({ response, body: (await response.text()).replace('new Phaser.Game(', 'window.__battleGame = new Phaser.Game(') });
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:5188/${mode === '3d' ? '?render=3d' : ''}`);
    await page.waitForFunction(() => window.__CAT_DEBUG__ && window.__battleGame, { timeout: 60000 });
    await page.locator('[data-debug="m6-seed-input"]').fill('42');
    await page.locator('[data-debug="m6-fixed-start"]').click();
    await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6?.mode === 'active');
    await page.evaluate(async () => {
      const { deployMatchUnit } = await import('/src/simulation/match.ts');
      const scene = window.__battleGame.scene.getScene('Board'), session = scene.session;
      const id = session.state.preparation.units.find(unit => unit.team === 'player').id;
      const deployed = deployMatchUnit(session.state, id, { kind: 'board', cell: { col: 3, row: 6 } });
      if (!deployed.ok) throw Error(deployed.reason);
      session.matchState = { ...deployed.state, items: [{ id: 'visual-sword', definitionId: 'sword', location: { kind: 'inventory' } }], nextItemSerial: 2 };
      const result = session.start(); if (!result.ok) throw Error(result.reason);
      const advance = session.advanceDisplay.bind(session);
      session.advanceDisplay = () => []; // hold the logical tick for repeatable before/after screenshots
      window.__battleStep = () => { advance(50); scene.syncCombat(); };
      window.__battleOwner = id;
      scene.sync();
      document.querySelector('[data-debug="panel:items"]')?.click();
    });
    await page.waitForTimeout(1500);
    await page.locator('[data-debug="item:visual-sword"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const start = await page.locator('[data-debug="item:visual-sword"]').boundingBox();
    assert(start, 'inventory item must be visible');
    const target = await page.evaluate(async mode => {
      const scene = window.__battleGame.scene.getScene('Board'), token = scene.tokens.get(window.__battleOwner);
      if (mode === '3d') {
        const { boardFeedScreenBox } = await import('/src/rendering/board-feed.ts');
        return boardFeedScreenBox?.(window.__battleOwner);
      }
      return scene.tokenScreenBox(window.__battleOwner, token);
    }, mode);
    assert(target, `${mode} target box must exist`);
    const x = (target.left + target.right) / 2, y = (target.top + target.bottom) / 2;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
    await page.mouse.move(x, y, { steps: 12 }); await page.mouse.up();
    const before = await page.evaluate(() => window.__CAT_DEBUG__.read());
    writeFileSync(`${out}/${mode}-debug.json`, JSON.stringify({start,target,x,y,before,errors}, null, 2));
    await page.screenshot({path:`${out}/${mode}-debug.png`});
    assert.equal(before.state.items.find(item => item.id === 'visual-sword').location.kind, 'unit', `${mode} drag should commit`);
    assert(before.texts.some(text => text.includes('已提交，下一拍生效')), 'submission notice must be shown');
    assert.deepEqual(before.tokens.find(unit => unit.id === windowOwner(before)).equipped, []);
    assert(before.strategy.combatSourceText.includes('本场装备：无'));
    await page.screenshot({ path: `${out}/${mode}-before-tick.png` });
    await page.evaluate(() => window.__battleStep()); await page.waitForTimeout(100);
    const after = await page.evaluate(() => window.__CAT_DEBUG__.read());
    assert.deepEqual(after.tokens.find(unit => unit.id === windowOwner(after)).equipped, ['sword']);
    assert(after.strategy.combatSourceText.includes('本场装备：暴风大剑'));
    await page.screenshot({ path: `${out}/${mode}-after-tick.png` });
    results.push({ mode, tickBefore: before.state.combat.tick, tickAfter: after.state.combat.tick, status: before.texts.find(text => text.includes('已提交，下一拍生效')), errors });
    await page.close();
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2)); }
function windowOwner(snapshot) { return snapshot.state.items.find(item => item.id === 'visual-sword').location.unitId; }
console.log(JSON.stringify(results, null, 2));
