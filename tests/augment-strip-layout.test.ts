import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Browser } from 'playwright';
import { testBrowser } from './fixtures/shared-browser';
import { createServer, type ViteDevServer } from 'vite';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readAugmentFrame } from '../src/rendering/three-mode/augment-strip-skin';

let server: ViteDevServer, browser: Browser, origin: string, image: Buffer, manifest: unknown;
const shots = process.env.AUGSTRIP_SHOTS_DIR ?? join(tmpdir(), 'augment-strip-shots');
beforeAll(async () => {
  // CI uses a hand-authored frame, never proprietary images or copied atlas-coordinate fixtures.
  image = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="2" y="2" width="60" height="60" fill="none" stroke="#c8aa6e" stroke-width="4"/></svg>')).png().toBuffer();
  manifest = { schemaVersion: 1, textures: { frame: { path: 'textures/frame.png', width: 64, height: 64, bytes: image.length, sha256: createHash('sha256').update(image).digest('hex') } }, sprites: { 'augment.frame': { texture: 'frame', rect: [0, 0, 64, 64], slice: [6, 6, 6, 6] } } };
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: ['phaser'] }, cacheDir: '/tmp/augment-strip-vite-cache', server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw Error('Missing Vite address');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await testBrowser(); await mkdir(shots, { recursive: true });
  const warmup = await browser.newPage();
  try {
    await warmup.route('**/warmup', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="stylesheet" href="/src/style.css">' }));
    await warmup.goto(`${origin}/warmup`);
    await warmup.evaluate(`Promise.all([
      import('/src/rendering/strategy-panel.ts'), import('/src/rendering/app-shell.ts'),
      import('/src/rendering/input-router.ts'), import('/src/simulation/match.ts'),
      import('/src/rendering/three-mode/hud-style.ts'), import('/src/rendering/three-mode/augment-strip-skin.ts'),
      import('/src/rendering/online/players-sidebar.ts'),
    ]).then(() => undefined)`);
  } finally { await warmup.close(); }
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

it('accepts only bounded, verified frame metadata and local texture paths', () => {
  expect(readAugmentFrame(manifest)).toMatchObject({ path: 'ui/textures/frame.png', rect: [0, 0, 64, 64] });
  const alter = (change: (m: any) => void) => { const m = structuredClone(manifest); change(m); return readAugmentFrame(m); };
  for (const change of [
    (m: any) => { m.schemaVersion = 2; }, (m: any) => { m.textures.frame.path = '../outside.png'; },
    (m: any) => { m.textures.frame.sha256 = 'unverified'; }, (m: any) => { m.textures.frame.bytes = 0; },
    (m: any) => { m.sprites['augment.frame'].rect = [1, 0, 64, 64]; },
    (m: any) => { m.sprites['augment.frame'].slice = [32, 32, 32, 32]; },
    (m: any) => { m.sprites['augment.frame'] = null; }, (m: any) => { delete m.sprites['augment.frame']; },
  ]) expect(alter(change)).toBeNull();
});

for (const mode of ['2d', '3d']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  it(`${mode} owns a 44px row above traits without covering shop/board controls at ${viewport.width}x${viewport.height}`, async () => {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width === 390 });
    const page = await context.newPage(), errors: string[] = [], skinRequests: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.route('**/strip-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><div id="app"></div>' }));
      await page.route('**/skin/**', async route => {
        const path = new URL(route.request().url()).pathname.slice('/skin/'.length); skinRequests.push(path);
        if (process.env.AUGSTRIP_LOCAL_UI && (path === 'ui/manifest.json' || /^ui\/textures\/[a-f0-9]+\.png$/.test(path))) {
          const body = await readFile(join(process.env.AUGSTRIP_LOCAL_UI, path.slice(3)));
          return route.fulfill({ contentType: path.endsWith('.json') ? 'application/json' : 'image/png', body });
        }
        return route.fulfill({ contentType: path.endsWith('.json') ? 'application/json' : 'image/png', body: path.endsWith('.json') ? JSON.stringify(manifest) : image });
      });
      await page.goto(`${origin}/strip-fixture`);
      await page.evaluate(`(async () => {
        const { createAppShell, mountOnlineBoardFrame } = await import('/src/rendering/app-shell.ts');
        const { StrategyPanel } = await import('/src/rendering/strategy-panel.ts');
        const { InputRouter } = await import('/src/rendering/input-router.ts');
        const { createMatch } = await import('/src/simulation/match.ts');
        document.body.dataset.m6Mode = 'active'; document.body.dataset.onlineLeft = 'collapsed';
        createAppShell(document.getElementById('app'));
        const { shopDock, itemDock } = mountOnlineBoardFrame();
        const base = createMatch(7);
        let state = { ...base, gold: 50, augments: ['pumping-up-i', 'pumping-up-ii', 'pumping-up-iii'].map((definitionId, index) => ({definitionId, acquiredRound:0, choiceId:'fixture-'+index})), anomalyBinding: {definitionId:'bulwark',unitId:'none'} };
        const router = new InputRouter(); window.__controls = [];
        const actions = { state:()=>state, combat:()=>({view:null,runtime:null}), battleItems:()=>null, selectedUnit:()=>null,
          cancelGesture:()=>router.cancel(), highlight:()=>{}, status:()=>{}, unitAt:()=>undefined, control:name=>window.__controls.push(name), shopLock:()=>window.__controls.push('lock'), buy:()=>{}, help:()=>{} };
        // Match BoardScene's real order: construct the panel, then OnlineApplication marks the body online.
        const panel = new StrategyPanel(actions, router, shopDock, itemDock);
        document.body.dataset.online = 'websocket'; panel.render();
        const { PlayersSidebar } = await import('/src/rendering/online/players-sidebar.ts');
        const sidebar = new PlayersSidebar(document.getElementById('app'), null, () => {});
        sidebar.render({ phase:{kind:'preparation',round:3,roundName:'2-1',endsAt:null,serverNow:0}, mySeatId:'s0',
          seats:Array.from({length:8}, (_,i)=>({seatId:'s'+i,name:'玩家 '+i,kind:i?'bot':'human',connected:true,controller:'human',hp:100,level:4,alive:true,publicBoard:[]})) });
        const board = document.getElementById('board-root');
        board.innerHTML = '<button data-debug="board-key" style="position:absolute;right:8px;bottom:8px">查看棋盘</button>';
        if (${JSON.stringify(mode)} === '3d') {
          const layer = document.createElement('div'); layer.className = 'render3d-layer';
          layer.innerHTML = '<canvas class="render3d-canvas"></canvas><div class="render3d-bar"><button data-debug="board-exit">切回 2D</button></div>';
          document.body.prepend(layer);
          const { installHudStyle } = await import('/src/rendering/three-mode/hud-style.ts'); installHudStyle();
          const { startAugmentStripSkin } = await import('/src/rendering/three-mode/augment-strip-skin.ts');
          window.__skin = startAugmentStripSkin(location.origin + '/skin/'); await window.__skin.ready;
        }
        window.__clear = () => { state = {...state, augments:[], anomalyBinding:null}; panel.render(); };
        window.__dispose = () => { window.__skin?.dispose(); panel.destroy(); sidebar.dispose(); };
      })()`);
      const row = page.locator('.augment-strip'), chips = row.locator('.augment-chip');
      expect(await chips.count()).toBe(4);
      expect(await row.getAttribute('aria-label')).toBe('已选强化与异常');
      const boxes = await Promise.all((await chips.all()).map(chip => chip.boundingBox()));
      const strip = (await row.boundingBox())!, traits = (await page.locator('.trait-column').boundingBox())!;
      const columns = mode === '3d' && viewport.width === 390 ? 2 : 4;
      expect(strip.width).toBe(columns * 44 + (columns - 1) * 4); expect(strip.height).toBe(columns === 2 ? 92 : 44);
      expect(traits.y - strip.y - strip.height).toBeGreaterThanOrEqual(8);
      for (const [i, box] of boxes.entries()) {
        expect(box!.width).toBe(44); expect(box!.height).toBe(44);
        expect(box!.x).toBe(strip.x + i % columns * 48); expect(box!.y).toBe(strip.y + Math.floor(i / columns) * 48);
      }
      const disjoint = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      for (const selector of ['#shop-dock', '[data-debug="board-key"]', ...(mode === '3d' ? ['[data-debug="board-exit"]'] : [])]) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(disjoint(strip, box), selector).toBe(true);
      }
      for (const player of await page.locator('.online-seat').all()) expect(disjoint(strip, (await player.boundingBox())!), 'player control').toBe(true);
      for (const chip of await chips.all()) {
        await chip.click();
        expect(await chip.evaluate(el => { const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); })).toBe(true);
        expect(await page.locator('[data-debug="hover:text"]:not([hidden])').count()).toBe(1);
        await page.keyboard.press('Escape');
      }
      // Tab-focus remains on the actual described icon; refreshes preserve a pinned target until its inventory changes.
      await chips.first().focus(); expect(await chips.first().getAttribute('aria-label')).toContain('打气');
      for (const id of ['mobile:buy-xp', 'mobile:reroll', 'mobile:sell', 'shop-lock']) {
        const button = page.locator('[data-debug="' + id + '"]');
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
        await button.click();
      }
      expect(await page.evaluate(() => (window as any).__controls)).toEqual(['buy-xp', 'reroll', 'sell', 'lock']);
      await page.mouse.move(viewport.width - 4, viewport.height - 4); await page.keyboard.press('Escape'); await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(shots, `${mode}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      if (mode === '3d') {
        expect(await page.evaluate(() => (window as any).__skin.issues)).toEqual([]);
        expect(skinRequests).toHaveLength(2);
        expect(await chips.first().evaluate(el => getComputedStyle(el, '::before').backgroundImage)).toContain('blob:');
        // Returning to 2D revokes the optional frame and restores exactly the fallback dimensions.
        await page.evaluate(() => (window as any).__skin.dispose());
        expect(await page.locator('style[data-owner="render3d-augment-strip"]').count()).toBe(0);
        expect((await chips.first().boundingBox())!.width).toBe(44);
      } else expect(skinRequests).toEqual([]);
      await page.evaluate(() => (window as any).__clear()); expect(await row.isVisible()).toBe(false);
      expect(errors).toEqual([]);
    } finally { await page.evaluate(() => (window as any).__dispose?.()); await context.close(); }
  });
}

it('keeps fallback styles after missing/corrupt sidecars and releases a pending fetch on disposal', async () => {
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.route('**/fallback-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
    await page.goto(`${origin}/fallback-fixture`);
    await page.route('**/missing/ui/manifest.json', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.route('**/corrupt/ui/manifest.json', route => route.fulfill({ json: manifest }));
    await page.route('**/corrupt/ui/textures/frame.png', route => route.fulfill({ body: Buffer.alloc(image.length) }));
    const result = await page.evaluate(`(async () => {
      const { startAugmentStripSkin } = await import('/src/rendering/three-mode/augment-strip-skin.ts');
      const issues = [];
      for (const root of [null, location.origin+'/missing/', location.origin+'/corrupt/']) {
        const skin = startAugmentStripSkin(root); await skin.ready; issues.push([...skin.issues]); skin.dispose();
      }
      const original = window.fetch;
      let aborted = false;
      window.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }));
      const pending = startAugmentStripSkin(location.origin+'/pending/'); pending.dispose(); await pending.ready;
      window.fetch = original;
      return { issues, aborted, styles:document.querySelectorAll('style[data-owner="render3d-augment-strip"]').length };
    })()`);
    expect(result).toEqual({ issues: [[], ['http-404'], ['sha256']], aborted: true, styles: 0 });
  } finally { await context.close(); }
});
