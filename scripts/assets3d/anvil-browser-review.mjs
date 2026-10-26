// Controlled production-renderer/UI preview. Uses ONLY the Chrome supplied by codex-browser.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
const require = createRequire(import.meta.url);
if (!process.env.CODEX_BROWSER_CLIENT) throw Error('Ask Claude to launch this task through codex-browser exec (no browser launch fallback).');
const report = JSON.parse(await readFile('assets3d-local/anvil-delta/report.json', 'utf8'));
const root = resolve(report.localRoot), out = await safeOutputPath('assets3d-local/anvil-shots', { directory: true });
await mkdir(out, { recursive: true });
const full = JSON.parse(await readFile(join(root, 'manifest.json'))), ids = ['TFT_ArmoryKeyComponent', 'TFT_ArmoryKeyCompleted', 'sett'];
// Limit preview preloading to the two new models and a reference champion. Payloads come from the complete generated root.
const manifest = { schemaVersion: 1, models: Object.fromEntries(ids.map(id => [id, full.models[id]])), effects: {} };
const fullPrecache = JSON.parse(await readFile(join(root, 'precache.json')));
const fullPacks = JSON.parse(await readFile(join(root, 'packs.json')));
const precache = { schemaVersion: 1, files: fullPrecache.files.filter(f => Object.values(manifest.models).some(m => m.path === f.path)) };
const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true },
  optimizeDeps: { noDiscovery: true, entries: [], include: [] }, cacheDir: join(out, 'vite-cache'),
  server: { host: '127.0.0.1', port: 5274, strictPort: true, hmr: false, watch: null } });
let browser, context;
const errors = [], failed = [], samples = [], consoleErrors = [];
try {
  await server.listen();
  browser = await require(process.env.CODEX_BROWSER_CLIENT).connect();
  context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE', e.message); });
  page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.route('**/local-assets/**', async r => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname).slice('/local-assets/'.length);
    if (path === 'manifest.json') return r.fulfill({ json: manifest });
    if (path === 'precache.json') return r.fulfill({ json: precache });
    if (path === 'packs.json') return r.fulfill({ json: { schemaVersion: 1, packs: [] } });
    try { return r.fulfill({ body: await readFile(await safeInputPath(root, resolve(root, path))) }); }
    catch { return r.fulfill({ status: 404 }); }
  });
  await page.route('**/anvil-review?debug3d', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/src/style.css">
    <script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
    <style>body{margin:0;background:#101923}#board{position:absolute;inset:0 0 220px}#shop{position:absolute;bottom:10px;left:180px;right:180px;z-index:4}#hover{position:absolute;top:90px;right:20px;z-index:10;width:270px;background:#0b151fe8;padding:12px;border:1px solid #304653}#stamp{position:absolute;left:20px;top:15px;z-index:10;color:white;font:18px sans-serif}.render3d-fps{display:none}</style>
    <body data-m6-mode="active"><div id="board" class="render3d-layer"></div><div id="shop"></div><div id="hover"></div><div id="stamp"></div></body>` }));
  await page.goto('http://127.0.0.1:5274/anvil-review?debug3d');
  await page.evaluate(async ({ full, fullPrecache, fullPacks }) => {
    const { readPackList, readPrecacheList } = await import('/src/rendering/three-mode/asset-preload.ts');
    const packs = readPackList(fullPacks, readPrecacheList(fullPrecache, full));
    if (!packs.length || packs.flatMap(p => p.files).some(f => f.path === 'ui-assets.json')) throw Error('pack-delta-incompatible');
    const packValidation = { packs: packs.length, files: packs.flatMap(p => p.files).length, oldFiles: fullPacks.packs.flatMap(p => p.files).length };
    const renderer = await import('/src/rendering/three-mode/placeholder-renderer.ts');
    const { loadRootUiAssets } = await import('/src/presentation/s13-assets.ts');
    const { anvilIconUrl, isAnvilUnit } = await import('/src/presentation/anvil-display.ts');
    const { unitCardBody } = await import('/src/presentation/unit-card.ts');
    const { StrategyPanel } = await import('/src/rendering/strategy-panel.ts');
    const { G24_FORGE_POOLS } = await import('/src/simulation/content/g2-4-forges.ts');
    await loadRootUiAssets(location.origin + '/local-assets/');
    renderer.useAnvilTest(isAnvilUnit); renderer.useChampionIcon(anvilIconUrl);
    let listener;
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null });
    const mounted = await renderer.mountRenderer3d(document.querySelector('#board'), { assetBase: location.origin + '/local-assets/' });
    if (mounted.status !== 'assets') throw Error(mounted.detail);
    const piece = (id, col) => ({ id, definitionId: id, team: 'player', x: col * Math.sqrt(3) * 34, y: 4 * 51, visible: true, alive: true, starLevel: 1 });
    listener.frame({ rows: 8, columns: 7, hexRadius: 34, origin: { x: 0, y: 0 }, bench: [], fighting: false, dragging: null,
      pieces: [piece('TFT_ArmoryKeyComponent', 2), piece('TFT_ArmoryKeyCompleted', 3.5), piece('sett', 5)] });
    // Use the real shop renderer and tooltip body; actions are only recorded, never sent to a game or simulation.
    const picks = [], panel = Object.create(StrategyPanel.prototype);
    panel.shopDock = document.querySelector('#shop'); panel.root = panel.shopDock;
    panel.actions = { choose: (...args) => picks.push(args), state: () => ({}) };
    window.review = { mounted, panel, picks, packValidation, show(id) {
      if (panel.armoryTimer != null) clearInterval(panel.armoryTimer);
      panel.shopDock.replaceChildren();
      panel.renderShopChoice({ kind: 'forge', choiceId: 'review-' + id, generation: 1, offers: G24_FORGE_POOLS[id].slice(0, 4), payload: { source: 'anvil-unit' } }, 'review');
      document.querySelector('#hover').replaceChildren(unitCardBody(id, 1));
      document.querySelector('#stamp').textContent = id + ' · original 14.24 · reference: Sett';
    } };
    window.review.show('TFT_ArmoryKeyComponent');
  }, { full, fullPrecache, fullPacks });
  await page.waitForFunction(() => window.__render3d?.pieces.size === 3 && [...window.__render3d.pieces.values()].every(v => v.mixer && v.lease && !v.lease.placeholder), null, { timeout: 60000 });
  console.log('Original models loaded');
  // Freeze time only after network/model setup; advance more than six complete idle loops.
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const before = await page.evaluate(() => {
    const { pieces } = window.__render3d;
    return [...pieces].filter(([id]) => id.startsWith('TFT_')).map(([id, v]) => ({ id, time: v.mixer.mixer.time,
      duration: v.lease.animations.find(c => c.name === v.lease.animationNames.idle).duration }));
  });
  await page.clock.runFor(2200);
  for (const kind of ['Component', 'Completed']) {
    await page.evaluate(kind => window.review.show('TFT_ArmoryKey' + kind), kind);
    await page.waitForFunction(() => [...document.querySelectorAll('#shop img, #hover img')].every(img => img.complete && img.naturalWidth > 0));
    await page.clock.runFor(32);
    const sample = await page.evaluate(() => {
      const d = window.__render3d, camera = d.camera;
      const pieces = [...d.pieces].map(([id, v]) => ({ id, placeholder: v.lease.placeholder, scale: v.modelScale,
        position: v.body.position.toArray(), time: v.mixer.mixer.time,
        active: v.lease.animations.filter(c => v.mixer.mixer.clipAction(c).isRunning()).map(c => ({ name: c.name, time: v.mixer.mixer.clipAction(c).time, loop: v.mixer.mixer.clipAction(c).loop })) }));
      return { pieces, icons: [...document.querySelectorAll('#shop [data-debug="armory:icon"], #hover img')].map(img => ({ src: img.src, width: img.naturalWidth })),
        buttons: [...document.querySelectorAll('#shop button')].map(b => { const r = b.getBoundingClientRect(); return { width: r.width, height: r.height }; }) };
    });
    if (sample.icons.length !== 2 || sample.buttons.length !== 4 || sample.buttons.some(b => b.width < 44 || b.height < 44)) throw Error('invalid-shop-or-icons:' + JSON.stringify(sample));
    if (sample.pieces.filter(p => p.id.startsWith('TFT_')).some(p => !p.active.some(a => a.name === 'idle' && a.loop === 2201))) throw Error('idle-not-looping');
    const screenshot = join(out, `anvil-original-${kind.toLowerCase()}.png`);
    await page.screenshot({ path: screenshot }); samples.push({ kind, screenshot, ...sample });
  }
  // Four-way selection is still the existing command callback with the exact choice token.
  await page.locator('#shop button').first().click();
  const picks = await page.evaluate(() => window.review.picks);
  const packValidation = await page.evaluate(() => window.review.packValidation);
  if (picks.length !== 1 || picks[0][0] !== 'review-TFT_ArmoryKeyCompleted') throw Error('bad-choice-callback');
  const result = { ready: !errors.length && !failed.length, browser: 'codex-browser supplied Chrome', root, previewModels: ids,
    before, samples, picks, packValidation, errors, failed, consoleErrors };
  await writeOutputFileAtomic(join(out, 'review-report.json'), JSON.stringify(result, null, 2) + '\n', { force: true });
  console.log(JSON.stringify(result));
  if (!result.ready) throw Error('browser-review-failed');
  await page.evaluate(() => { clearInterval(window.review.panel.armoryTimer); window.review.mounted.dispose(); });
} finally { await context?.close(); await browser?.close(); await server.close(); }
