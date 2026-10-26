import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdir, readFile } from 'node:fs/promises';

// Real StrategyPanel renderer + production CSS, with an authoritative-choice fixture.
// No match simulation, assets or server commands are changed by this browser harness.
let server: ViteDevServer, browser: Browser, origin: string;
const shots = '/home/aiapps/workspcae/codex-briefs/shots';
beforeAll(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: ['phaser'] }, cacheDir: '/tmp/rumble-vite-cache', server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw Error('Missing Vite address');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  await mkdir(shots, { recursive: true });
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

for (const width of [1440, 1920]) it(`distributes online 3D Rumble choices at ${width}px and keeps commands clickable`, async () => {
  const page = await browser.newPage({ viewport: { width, height: 1080 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rumble-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/rendering/reference-ui-2d.css"></head><body data-online><div class="render3d-layer"></div><div id="app"><main id="board-frame"><div id="board-root"></div><section id="shop-dock" class="shop-dock"></section></main></div></body></html>' }));
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  const originalCss = css.replace(/\/\* Online three-offer armories[\s\S]*?(?=\.shop-offer :is)/, '');
  await page.route('**/src/style.css', route => route.fulfill({ contentType: 'text/css', body: originalCss }));
  // Fixtures use synthetic artwork; no copyrighted asset downloads.
  await page.route(/\.(png|webp|jpg)(\?.*)?$/, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="4" fill="#685433"/><path d="M10 20h20M20 10v20" stroke="#e8c25a" stroke-width="3"/></svg>' }));
  await page.goto(`${origin}/rumble-fixture`);
  await page.evaluate(`(async () => {
    const { StrategyPanel } = await import('/src/rendering/strategy-panel.ts');
    const dock = document.querySelector('#shop-dock');
    dock.innerHTML = '<div class="mobile-controls"><button data-debug="mobile:buy-xp">购买经验</button><button data-debug="mobile:reroll">刷新</button><button data-debug="shop-lock">锁定</button><button data-debug="mobile:sell">出售</button></div>';
    const panel = Object.create(StrategyPanel.prototype);
    Object.assign(panel, { shopDock: dock, actions: { choose: (...args) => { window.__picked = args; } } });
    panel.renderShopChoice({ kind: 'armory', choiceId: 'fixture-rumble', generation: 7, step: 0, offers: ['flamethrower', 'petricite-rod', 'spare-parts'], payload: { source: 'junker-king', prices: { flamethrower: 5, 'petricite-rod': 5, 'spare-parts': 0 } } }, 'fixture-rumble:7:0');
  })()`);
  // The before image uses the exact stylesheet with this patch removed.
  const row = page.locator('.shop-choice .touch-shop'), cards = row.locator('button');
  const beforeRow = (await row.boundingBox())!, beforeLast = (await cards.last().boundingBox())!;
  expect(beforeLast.x + beforeLast.width).toBeLessThan(beforeRow.x + beforeRow.width - 44);
  await page.screenshot({ path: `${shots}/rumble-before-${width}.png` });
  await page.addStyleTag({ content: css });
  const rowBox = (await row.boundingBox())!;
  const boxes = await Promise.all((await cards.all()).map(card => card.boundingBox()));
  expect(boxes).toHaveLength(3);
  const [a, b, c] = boxes.map(box => box!);
  expect(Math.abs(a.width - b.width)).toBeLessThan(1);
  expect(Math.abs(b.width - c.width)).toBeLessThan(1);
  expect(Math.abs(a.x - rowBox.x)).toBeLessThan(1);
  expect(Math.abs(c.x + c.width - rowBox.x - rowBox.width)).toBeLessThan(1);
  expect(Math.abs((b.x - a.x) - (c.x - b.x))).toBeLessThan(1);
  for (const button of await page.locator('#shop-dock button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: `${shots}/rumble-after-${width}.png` });
  await cards.nth(1).click();
  expect(await page.evaluate(() => (window as any).__picked)).toEqual(['fixture-rumble', 7, 'petricite-rod']);
  // The four-offer armory still uses the original shop grid, outside this fix's scope.
  await cards.last().evaluate(node => node.parentElement!.append(node.cloneNode(true)));
  expect((await row.evaluate(node => getComputedStyle(node).gridTemplateColumns)).split(' ')).toHaveLength(5);
  expect(errors).toEqual([]);
  await page.close();
}, 60000);
