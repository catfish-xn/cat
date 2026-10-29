import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Browser } from 'playwright';
import { testBrowser } from './fixtures/shared-browser';
import { createServer, type ViteDevServer } from 'vite';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Real StrategyPanel renderer + production CSS, with an authoritative-choice fixture.
// No match simulation, assets or server commands are changed by this browser harness.
let server: ViteDevServer, browser: Browser, origin: string;
// Screenshots are local evidence only; RUMBLE_SHOTS_DIR picks a folder, otherwise the OS temp dir (CI has no home checkout).
const shots = process.env.RUMBLE_SHOTS_DIR ?? join(tmpdir(), 'rumble-shop-layout-shots');
beforeAll(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: ['phaser'] }, cacheDir: '/tmp/rumble-vite-cache', server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw Error('Missing Vite address');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await testBrowser();
  await mkdir(shots, { recursive: true });
  // Pay Vite's first transform of the shell modules and the first page here (60 s budget), not in
  // the first 5 s case: at the start of a busy CI shard that one-off cost alone ran past 5 s.
  const warm = await browser.newPage();
  try {
    await warm.goto(`${origin}/src/style.css`);
    await warm.evaluate(`Promise.all(['/src/rendering/app-shell.ts', '/src/rendering/strategy-panel.ts', '/src/presentation/anvil-display.ts', '/src/simulation/match.ts'].map(path => import(path)))`);
  } finally { await warm.close(); }
}, 60000);

for (const mode of ['2d', '3d']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  it(`${mode} choice rows and anvil/shop/back controls fit the real board shell at ${viewport.width}x${viewport.height}`, async () => {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width === 390 });
    try {
      await page.route('**/shell-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="UTF-8"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/rendering/reference-ui-2d.css"><div id="app"></div>' }));
      await page.route(/\.(png|webp|jpg)(\?.*)?$/, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#685433"/></svg>' }));
      await page.goto(`${origin}/shell-fixture`);
      await page.evaluate(`(async () => {
        const mode = ${JSON.stringify(mode)};
        const load = path => import(path);
        const { createAppShell, mountOnlineBoardFrame } = await load('/src/rendering/app-shell.ts');
        const { StrategyPanel } = await load('/src/rendering/strategy-panel.ts');
        const { noteServerNow } = await load('/src/presentation/anvil-display.ts');
        document.body.dataset.online = 'websocket'; document.body.dataset.m6Mode = 'active';
        if (mode === '3d') {
          document.body.dataset.onlineLeft = 'collapsed';
          const layer = document.createElement('div'); layer.className = 'render3d-layer';
          layer.innerHTML = '<canvas class="render3d-canvas"></canvas><div class="render3d-bar"><button>切回 2D</button><span class="render3d-preload">素材已全部缓存到本地（4 个文件，本次下载 0.2 MB 用时 0.8 秒）</span></div>';
          document.body.prepend(layer);
        }
        createAppShell(document.getElementById('app'));
        if (mode === '3d') {
          const rail = document.getElementById('panels-root'); rail.style.height = '300px';
          rail.insertAdjacentHTML('afterbegin', '<div class="trait-column">炼金男爵</div>');
        }
        const { shopDock } = mountOnlineBoardFrame(); shopDock.className = 'shop-dock';
        const panel = Object.create(StrategyPanel.prototype);
        const rumble = { kind: 'armory', choiceId: 'rumble', generation: 1, step: 'offer', offers: ['repairing-microbots', 'tankbuster', 'spare-parts'], payload: { source: 'junker-king', prices: { 'repairing-microbots': 5, tankbuster: 5, 'spare-parts': 0 } } };
        const anvil = { kind: 'forge', choiceId: 'anvil', generation: 1, step: 'offer', offers: ['bf-sword', 'giants-belt', 'needlessly-large-rod', 'recurve-bow'], payload: { source: 'anvil-unit', timeoutOption: 'bf-sword' } };
        Object.assign(panel, { shopDock, root: shopDock, actions: { choose: (...args) => { window.__shellPick = args; }, state: () => ({ pendingChoice: anvil, choiceDeadline: { choiceId: 'anvil', generation: 1, endsAt: 40000 } }) } });
        noteServerNow(10000);
        window.__showChoice = which => {
          clearInterval(panel.armoryTimer);
          shopDock.innerHTML = '<div class="hud-stats"><span class="hud-chip hud-level">Lv.1</span><span class="hud-chip hud-gold">50</span><span class="hud-chip hud-pop">1/1</span></div><div class="mobile-controls"><button data-debug="mobile:buy-xp">经验</button><button data-debug="mobile:reroll">刷新</button><button data-debug="shop-lock">锁定</button><button data-debug="mobile:sell">出售</button></div>';
          shopDock.toggleAttribute('data-anvil-choice', which === 'anvil');
          const count = which === 'armory-one' ? 1 : which === 'armory-two' ? 2 : 3;
          panel.renderShopChoice(which === 'anvil' ? anvil : { ...rumble, offers: rumble.offers.slice(0, count) }, which);
        };
        window.__showChoice('rumble');
        window.__showAnvilShopFlow = async () => {
          const { createMatch } = await load('/src/simulation/match.ts');
          const state = { ...createMatch(1), pendingChoice: anvil, choiceDeadline: { choiceId: 'anvil', generation: 1, endsAt: 40000 } };
          window.__shopControls = [];
          panel.actions.state = () => state;
          panel.shopChoiceAway = ''; panel.shopChoiceQuietUntil = 0;
          // Keep fixture HUD/command targets; use production renderShop and its real away/back callbacks.
          panel.render = () => {
            shopDock.innerHTML = '<div class="hud-stats"><span class="hud-chip hud-level">Lv.1</span><span class="hud-chip hud-gold">50</span><span class="hud-chip hud-pop">1/1</span></div><div class="mobile-controls"><button data-debug="mobile:buy-xp">经验</button><button data-debug="mobile:reroll">刷新</button><button data-debug="shop-lock">锁定</button><button data-debug="mobile:sell">出售</button></div>';
            for (const button of shopDock.querySelectorAll('button')) button.addEventListener('click', () => window.__shopControls.push(button.dataset.debug));
            panel.renderShop(state, true);
          };
          panel.render();
        };
      })()`);
      if (mode === '3d') {
        const hit = await page.evaluate(() => {
          const rail = document.querySelector('#panels-root')!.getBoundingClientRect();
          const bar = document.querySelector('.render3d-bar')!.getBoundingClientRect();
          return { target: document.elementFromPoint(rail.left + 30, rail.bottom - 10)?.tagName, barHeight: bar.height };
        });
        expect(hit.target).toBe('CANVAS');
        if (viewport.width === 390) expect(hit.barHeight).toBeLessThanOrEqual(80);
      }
      for (const kind of ['armory', 'armory-two', 'armory-one', 'anvil']) {
        if (kind !== 'armory') await page.evaluate(kind => (window as any).__showChoice(kind), kind);
        const result = await page.evaluate(() => {
          const row = document.querySelector('.shop-choice .touch-shop')!, dock = document.querySelector('#shop-dock')!.getBoundingClientRect();
          const rect = row.getBoundingClientRect(), clock = document.querySelector('[data-debug="armory:clock"]')?.getBoundingClientRect();
          return { row: { x: rect.x, right: rect.right }, dock: { left: dock.left, right: dock.right }, floor: dock.bottom, clockBottom: clock?.bottom,
            cards: Array.from(row.children).map(card => { const b = card.getBoundingClientRect(); return { x: b.x, right: b.right, top: b.top, bottom: b.bottom, width: b.width, overflow: card.scrollHeight - card.clientHeight }; }) };
        });
        expect(result.cards).toHaveLength(kind === 'anvil' ? 4 : kind === 'armory-one' ? 1 : kind === 'armory-two' ? 2 : 3);
        for (const card of result.cards) {
          expect(Math.abs(card.width - result.cards[0].width)).toBeLessThan(1);
          expect(card.overflow).toBeLessThanOrEqual(1); expect(card.bottom).toBeLessThanOrEqual(result.floor + 1);
          expect(card.bottom).toBeLessThanOrEqual(viewport.height + 1);
        }
        expect(Math.abs(result.cards[0].x - result.row.x)).toBeLessThan(1);
        expect(Math.abs(result.cards.at(-1)!.right - result.row.right)).toBeLessThan(1);
        if (kind === 'anvil') {
          expect(result.cards[0].x - result.dock.left).toBeLessThan(10);
          expect(result.dock.right - result.cards.at(-1)!.right).toBeLessThan(10);
          expect(result.clockBottom).toBeLessThanOrEqual(result.cards[0].top);
          for (const id of ['mobile:buy-xp', 'mobile:reroll', 'shop-lock', 'mobile:sell']) expect(await page.locator(`[data-debug="${id}"]`).isVisible()).toBe(false);
        }
      }
      await page.evaluate(() => (window as any).__showAnvilShopFlow());
      const activate = async (selector: string) => {
        const button = page.locator(selector);
        if (viewport.width === 390) await button.tap(); else await button.click();
      };
      await activate('[data-debug="shop-choice-away"]');
      expect(await page.locator('.shop-card[data-debug^="mobile:buy-"]').count()).toBe(5);
      expect(await page.locator('.shop-dock .hud-pop').isVisible()).toBe(true);
      const ids = ['mobile:buy-xp', 'mobile:reroll', 'mobile:sell', 'shop-lock'];
      const boxes = [];
      for (const id of ids) {
        const box = await page.locator(`[data-debug="${id}"]`).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
        boxes.push(box!);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
          `${ids[i]} overlaps ${ids[j]}`).toBe(true);
      }
      await page.screenshot({ path: `${shots}/${mode}-${viewport.width}-anvil-shop.png` });
      for (const id of ids) await activate(`[data-debug="${id}"]`);
      expect(await page.evaluate(() => (window as any).__shopControls)).toEqual(ids);
      await activate('[data-debug="shop-choice-back"]');
      expect(await page.locator('[data-armory="anvil"] .shop-card').count()).toBe(4);
      for (const id of ids) expect(await page.locator(`[data-debug="${id}"]`).isVisible()).toBe(false);
      const clock = (await page.locator('[data-debug="armory:clock"]').boundingBox())!;
      const first = (await page.locator('[data-armory="anvil"] .shop-card').first().boundingBox())!;
      expect(clock.y + clock.height).toBeLessThanOrEqual(first.y);
      await page.screenshot({ path: `${shots}/${mode}-${viewport.width}-anvil-back.png` });
      await activate('[data-armory="anvil"] .shop-card:nth-child(2)');
      expect(await page.evaluate(() => (window as any).__shellPick)).toEqual(['anvil', 1, 'giants-belt']);
    } finally { await page.close(); }
  });
}
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
  // Icon, name, description and price fit inside each card (nothing clipped at the top or bottom).
  for (const card of await cards.all()) expect(await card.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/rumble-after-${width}.png` });
  await cards.nth(1).click();
  expect(await page.evaluate(() => (window as any).__picked)).toEqual(['fixture-rumble', 7, 'petricite-rod']);
  // The four-offer armory still uses the original shop grid, outside this fix's scope.
  await cards.last().evaluate(node => node.parentElement!.append(node.cloneNode(true)));
  expect((await row.evaluate(node => getComputedStyle(node).gridTemplateColumns)).split(' ')).toHaveLength(5);
  expect(errors).toEqual([]);
  await page.close();
}, 60000);
