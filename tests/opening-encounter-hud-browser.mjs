/** Online 3D regression. Run against Vite: node tests/opening-encounter-hud-browser.mjs [before|after]. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const phase = process.argv[2] ?? 'after';
const output = '/home/aiapps/workspcae/codex-briefs/shots';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'data:') return route.abort();
    if (url.pathname === '/src/main.ts') {
      const r = await route.fetch();
      return route.fulfill({ response: r, body: (await r.text()).replace('new Phaser.Game(', 'window.__hudGame = new Phaser.Game(') });
    }
    return route.continue();
  });
  await page.goto('http://127.0.0.1:5188/?mode=online&render=3d&seed=42&carousel=0&prep=1');
  await page.waitForFunction(() => window.__CAT_DEBUG__ && document.querySelector('body > .render3d-layer'), { timeout: 60000 });
  await page.locator('[data-debug="online:name"]').fill('HUD测试');
  await page.locator('[data-debug="online:join"]').click();
  await page.locator('[data-debug="online:start"]').click();
  await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6?.mode === 'active');
  await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6?.phase?.kind === 'combat', { timeout: 60000 });
  // Hold a real projected multiplayer view in combat; inject only display inventory to stress the left rail.
  await page.evaluate(async () => {
    const scene = window.__hudGame.scene.getScene('Board'), app = scene.application;
    app.client.dispose();
    app.sidebar.render(app.view); app.syncOpening(); app.opening.closeCard();
    scene.session.advanceDisplay = () => [];
    const strip = document.querySelector('.augment-strip');
    strip.innerHTML = '<span class="augment-chip"><span class="augment-badge" style="width:28px;height:28px">Ⅰ</span></span>'.repeat(3);
    const dock = document.querySelector('#item-dock');
    dock.innerHTML = '<span style="width:44px;height:44px;background:#234e77;border:1px solid #8bd;display:grid;place-items:center">◉</span>'.repeat(2)
      + '<span style="width:44px;height:44px;background:#593c7b;display:grid;place-items:center">◆</span><span style="width:44px;height:44px;background:#443c27;display:grid;place-items:center">×3</span>';
  });
  if (phase === 'before') await page.evaluate(() => {
    const style = [...document.querySelectorAll('style')].find(el => el.textContent.includes('Online 3D encounter: a reserved'));
    if (style) style.textContent = style.textContent.split('/* Online 3D encounter: a reserved')[0];
    document.querySelector('.opening-chip-icon')?.remove();
  });
  await page.screenshot({ path: `${output}/hud-${phase}.png` });
  console.log('Screenshot saved:', phase);
  if (phase === 'before') {
    console.log('Before:', await page.locator('.opening-chip').boundingBox());
  } else {
    for (const size of [{width:1440,height:900},{width:1280,height:720},{width:1920,height:1080}]) {
      await page.setViewportSize(size);
      const chip = page.locator('.opening-chip');
      const box = await chip.boundingBox();
      assert(box && box.x < 300 && box.width >= 44 && box.height >= 44);
      assert.equal(await chip.locator('.opening-chip-name').textContent(), '金金金之旅');
      for (const selector of ['.augment-strip', '.trait-column', '#item-dock']) {
        const other = await page.locator(selector).boundingBox();
        assert(other && box.y + box.height <= other.y, `${selector} overlaps encounter at ${size.width}`);
      }
      await chip.hover();
      const tooltip = page.locator('[data-debug="opening:tooltip"]');
      await tooltip.waitFor({ state: 'visible' });
      assert((await tooltip.textContent()).includes('三次强化选择均为黄金阶'));
      assert.equal(await chip.evaluate(el => { const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), true);
      await page.mouse.move(size.width / 2, size.height / 2);
      await chip.focus();
      await tooltip.waitFor({state:'visible'});
      await chip.click();
      await page.locator('[data-debug="opening:card"]').waitFor({state:'visible'});
      await page.locator('[data-debug="opening:close"]').click();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: online 3D geometry, hover/focus tooltip, click details; 3 desktop sizes');
  }
} finally { await browser.close(); }
