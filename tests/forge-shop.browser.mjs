/** Focused real-Chromium shop component check; no game build or parallel browsers.
 * node tests/forge-shop.browser.mjs [before|after]
 * The fixture supplies an online private-seat choice; deadlines are tested separately in server tests.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const stage = process.argv[2] ?? 'after';
const shots = '/home/aiapps/workspcae/codex-briefs/shots';
await mkdir(shots, { recursive: true });
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, cacheDir: '/tmp/forge-vite-cache', server: { host: '127.0.0.1', port: 5192, strictPort: true }, plugins: [{ name: 'forge-test-page', enforce: 'pre', transform(_code, id) { if (stage === 'before' && /src\/(rendering\/strategy-panel.ts|style.css)$/.test(id)) return execFileSync('git', ['show', `HEAD:${id.slice(id.lastIndexOf('/src/') + 1)}`], { encoding: 'utf8' }); }, configureServer(server) {
  server.middlewares.use('/forge-fixture', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta charset="utf-8"></head><body data-online="true"><div id="strategy-root"></div><div id="shop-dock"></div></body></html>'); });
} }] });
let browser;
try {
 await server.listen();
 browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
 page.on('pageerror', e => console.error(e.message));
 await page.goto('http://127.0.0.1:5192/forge-fixture');
 await page.evaluate(async () => {
  await import('/src/style.css');
  const [{ StrategyPanel }, { createMatch }, { G24_FORGE_POOLS }, { noteServerNow }] = await Promise.all([
   import('/src/rendering/strategy-panel.ts'), import('/src/simulation/match.ts'), import('/src/simulation/content/g2-4-forges.ts'), import('/src/presentation/anvil-display.ts')]);
  const dock = document.querySelector('#shop-dock'); dock.className = 'shop-dock';
  // Use the product's real shop rendering and callbacks; other panels do not belong to this fixture.
  const panel = Object.create(StrategyPanel.prototype);
  Object.assign(panel, { shopDock: dock, root: document.querySelector('#strategy-root'), armoryTimer: null, shopChoiceAway: '', shopChoiceQuietUntil: 0 });
  window.commands = [];
  window.showForge = (kind, mode) => {
   if (panel.armoryTimer !== null) clearInterval(panel.armoryTimer);
   document.querySelector('.render3d-layer')?.remove();
   if (mode === '3d') { const layer = document.createElement('div'); layer.className = 'render3d-layer'; document.body.prepend(layer); }
   const offers = G24_FORGE_POOLS[kind].slice(0, 4), choice = { kind: 'forge', choiceId: `forge:${kind}`, generation: 3, offers, payload: { kind: 'forge', source: 'anvil-unit', timeoutMs: 30000, timeoutOption: offers[0] } };
   const state = { ...createMatch(42), pendingChoice: choice, phase: 'choice', choiceDeadline: { choiceId: choice.choiceId, generation: choice.generation, endsAt: 30000 } };
   noteServerNow(0); panel.actions = { state: () => state, choose: (...args) => window.commands.push(args) };
   panel.render = () => { dock.replaceChildren(); panel.renderShop(state, true); };
   panel.render();
   window.forgeState = state;
  };
  window.showForge('TFT_ArmoryKeyComponent', '3d');
 });
 for (const width of [1440, 1920]) for (const mode of ['3d', '2d']) for (const kind of ['Component', 'Completed']) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(({ kind, mode }) => window.showForge(`TFT_ArmoryKey${kind}`, mode), { kind, mode });
  const cards = page.locator('#shop-dock .shop-offer');
  assert.equal(await cards.count(), 4);
  assert.match(await page.locator('[data-debug="armory:clock"]').textContent(), /剩余 30 秒/);
  const rects = await cards.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, width: r.width, height: r.height, title: node.title, name: node.querySelector('.offer-name')?.textContent, icon: !!node.querySelector('img, svg') }; }));
  if (stage === 'after') {
   const row = await page.locator('#shop-dock .touch-shop').boundingBox();
   for (const card of rects) { assert(card.width >= 44 && card.height >= 44); assert(card.title.includes('\n')); assert(card.name && card.icon); assert(Math.abs(card.width - rects[0].width) < 1); }
   assert(Math.abs(rects.at(-1).x + rects.at(-1).width - (row.x + row.width)) < 2, 'four offers fill the shop row');
   assert.equal(await page.locator('#shop-dock .offer-icon').count(), 0, 'no duplicate item icon');
   const toggles = page.locator('#shop-dock .shop-choice-toggle');
   const dock = await page.locator('#shop-dock').boundingBox();
   for (const rect of await toggles.evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }))) {
    assert(rect.width >= 44 && rect.height >= 44); assert(rect.y >= dock.y && rect.y + rect.height <= dock.y + dock.height);
   }
  }
  await page.locator('#shop-dock').screenshot({ path: `${shots}/forge-${stage}-${kind.toLowerCase()}-${mode}-${width}.png` });
  if (stage === 'after') {
   await page.locator('[data-debug="shop-choice-away"]').click();
   assert.equal(await page.locator('#shop-dock .shop-offer').count(), 0);
   const back = page.locator('[data-debug="shop-choice-back"]'); assert((await back.boundingBox()).height >= 44);
   await back.click(); assert.equal(await cards.count(), 4);
  }
  await cards.nth(2).click();
  assert.deepEqual(await page.evaluate(() => window.commands.at(-1)), await page.evaluate(() => [window.forgeState.pendingChoice.choiceId, 3, window.forgeState.pendingChoice.offers[2]]));
 }
 console.log(`forge shop ${stage}: 8 fixtures passed; screenshots: ${shots}/forge-${stage}-*.png`);
} finally { await browser?.close(); await server.close(); }
