// Real-asset component preview through the production BoardFeed consumer. Inputs are served read-only.
// Usage: CHROMIUM_PATH=/usr/bin/google-chrome node scripts/assets3d/renata-mel-browser-review.mjs <asset-root> <review-dir> <reference-dir>
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { safeInputPath } from './safe-path.mjs';
const [assetArg, outArg, refArg] = process.argv.slice(2);
if (!assetArg || !outArg || !refArg) throw Error('asset-root, review-dir and reference-dir required');
const root = resolve(assetArg), out = resolve(outArg), refs = resolve(refArg);
if (out === root || out.startsWith(root + '/')) throw Error('review output must be outside the read-only asset root');
await mkdir(out, { recursive: true });
const full = JSON.parse(await readFile(await safeInputPath(root, join(root, 'manifest.json')), 'utf8'));
// Only the preview's real models/effects are exposed in its transient manifest; the source manifest is never written.
const ids = ['renata', 'mel', 'sett', 'board-default', 'little-legend-default'];
const manifest = { ...full, models: Object.fromEntries(Object.entries(full.models).filter(([id]) => ids.includes(id))),
  effects: Object.fromEntries(Object.entries(full.effects).filter(([id]) => id.startsWith('renata_') || id === 'global_tft_global_ba_hit' || id === 'mel_tft13_missmage_base_p_damageredirect_cas')),
  actionEffects: { renata: full.actionEffects.renata } };
const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true },
  optimizeDeps: { noDiscovery: true, entries: [], include: [] }, cacheDir: join(out, 'browser-cache'),
  server: { host: '127.0.0.1', port: 5270, hmr: false, watch: null } });
let browser;
const errors = [], samples = [];
try {
  await server.listen(); console.log('Vite ready');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-background-networking', '--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets'] });
  console.log('Chrome ready');
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
  page.on('console', m => { console.log('BROWSER', m.type(), m.text()); if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.route('**/local-assets/**', async route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname).slice('/local-assets/'.length);
    if (path === 'manifest.json') return route.fulfill({ json: manifest });
    if (path === 'precache.json') return route.fulfill({ json: { schemaVersion: 1, files: [] } });
    if (path === 'packs.json') return route.fulfill({ json: { schemaVersion: 1, packs: [] } });
    try { return route.fulfill({ body: await readFile(await safeInputPath(root, resolve(root, path))) }); }
    catch { return route.fulfill({ status: 404 }); }
  });
  await page.route('**/review?debug3d', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/src/style.css"><style>
    body {margin:0;background:#101923} #preview {position:absolute;inset:0} .render3d-layer {position:absolute;inset:0} canvas {display:block} .render3d-fps {display:none}
    #stamp {position:fixed;top:12px;left:16px;z-index:300;font:16px sans-serif;color:white;background:#101923c0;padding:8px}
    </style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body data-m6-mode="active"><div id="preview"><div class="render3d-layer"></div></div><div id="stamp"></div></body>` }));
  await page.goto(server.resolvedUrls.local[0] + 'review?debug3d');
  console.log('Page ready');
  await page.evaluate(async () => {
    console.log('Importing renderer');
    const renderer = await import('/src/rendering/three-mode/placeholder-renderer.ts');
    const { createMelSaveFeedback } = await import('/src/rendering/mel-save-feedback.ts');
    const { setReducedMotion } = await import('/src/presentation/preferences.ts');
    console.log('Imports ready');
    let listener, reduced = false;
    renderer.useReducedMotion(() => reduced);
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null });
    const mounted = await renderer.mountRenderer3d(document.querySelector('.render3d-layer'), { assetBase: location.origin + '/local-assets/' });
    console.log('Mounted', mounted.status, mounted.detail); if (mounted.status !== 'assets') throw Error(mounted.detail);
    const piece = (id, definitionId, team, col, row) => ({ id, definitionId, team, x: (col + (row % 2) / 2) * Math.sqrt(3) * 34,
      y: row * 51, visible: true, alive: true, starLevel: 1, meters: { hp: 100, maxHp: 100, mana: 0, maxMana: 100, shield: 0 } });
    const frame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 0, y: 0 }, bench: [], fighting: false, dragging: null,
      pieces: [piece('caster', 'renata', 'player', 2, 6), piece('ally', 'sett', 'player', 2, 4), piece('target', 'sett', 'enemy', 2, 2),
        piece('mel', 'mel', 'player', 4, 5), piece('other', 'sett', 'enemy', 4, 2)] };
    listener.frame(frame);
    const feedback = createMelSaveFeedback(document.body, event => { if (!window.review.mode2d) listener.playerSaved(event); });
    window.review = { mounted, frame, listener, feedback, setReduced(value) { reduced = value; setReducedMotion(value); },
      cast() { listener.frame({ ...frame, fighting: true }); listener.events([
        { type: 'cast', tick: 1, eventSeq: 1, sourceId: 'caster', targetIds: ['target'], actionSeq: 1, completed: true, actualManaSpent: 0, refundedMana: 0, completionCell: { col: 2, row: 6 } },
        { type: 'shieldLayerChanged', tick: 1, eventSeq: 2, reason: 'granted', remaining: 100, targetId: 'ally', key: JSON.stringify(['review', 'caster', 'ability', 'renata-ability', 'caster', 0, null, 'ally', 'source']) },
      ]); },
      reset() { feedback.reset(); listener.frame({ ...frame, fighting: false }); },
      save() { feedback.push([{ type: 'playerSaved', source: 'mel', battleId: 'review' }]); } };
  });
  await page.waitForFunction(() => [...window.__render3d.pieces.values()].every(v => v.lease && !v.lease.placeholder), null, { timeout: 60000 });
  console.log('Real models loaded');
  // Warm the actual action effects once, then freeze browser time for exact, reproducible captures.
  await page.evaluate(() => window.review.cast());
  await page.waitForTimeout(2300);
  await page.evaluate(() => window.review.reset());
  const clockTime = Date.now();
  await page.clock.install({ time: clockTime });
  await page.clock.pauseAt(clockTime + 1000);
  for (const kind of ['renata', 'mel', 'mel-reduced', 'mel-2d']) {
    await page.evaluate(kind => {
      window.review.reset(); window.review.mode2d = kind === 'mel-2d'; window.review.setReduced(kind === 'mel-reduced');
      document.querySelector('.render3d-layer').classList.toggle('render3d-layer', kind !== 'mel-2d');
      if (kind === 'renata') window.review.cast(); else window.review.save();
      for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 0; }
    }, kind);
    let at = 0;
    const times = kind === 'renata' ? [.2, .6, 1.05, 1.55] : kind === 'mel' ? [.2, .5, 1.15, 1.7] : [1];
    for (const t of times) {
      await page.clock.runFor((t - at) * 1000); at = t;
      await page.evaluate(({kind, t}) => { for (const a of document.getAnimations()) a.currentTime = t * 1000;
        document.getElementById('stamp').textContent = `${kind} / ${t.toFixed(2)} s / real 14.24 assets`; }, {kind, t});
      const filename = `${kind}-${Math.round(t*1000)}.png`;
      await page.screenshot({ path: join(out, filename) });
      const state = await page.evaluate(() => ({ models: [...window.__render3d.pieces.values()].filter(v => v.lease && !v.lease.placeholder).length,
        particles: [...window.__render3d.live].map(e => ({ particles: e.fx.particleCount, skipped: e.fx.skipped })),
        bursts: window.__render3d.scene.children.filter(o => o.name.endsWith('reference-burst')).map(o => o.name),
        overlay: !!document.querySelector('.mel-save-feedback') }));
      samples.push({ kind, t, filename, ...state }); console.log(kind, t, JSON.stringify(state));
    }
    await page.clock.runFor((2.1-at)*1000);
    if (kind !== 'renata' && await page.locator('.mel-save-feedback').count()) throw Error('Mel overlay outlived 2s');
  }
  await page.evaluate(() => { window.review.feedback.dispose(); window.review.mounted.dispose(); });
  // Side by side: user's untouched 12-frame reference sheet on the left, four actual renderer captures on the right.
  for (const kind of ['renata','mel']) {
    const selected = samples.filter(s => s.kind === kind), width = 1200;
    const reference = await sharp(join(refs, kind + '-sheet.png')).resize(width, 800, {fit:'contain',background:'#101923'}).png().toBuffer();
    const shots = await Promise.all(selected.map(s => sharp(join(out,s.filename)).resize(600,400).png().toBuffer()));
    await sharp({create:{width:2400,height:840,channels:3,background:'#101923'}}).composite([
      {input:Buffer.from(`<svg width="2400" height="40"><text x="20" y="27" fill="white" font-size="20">${kind}: Original reference (left) | Production renderer, four moments (right)</text></svg>`),left:0,top:0},
      {input:reference,left:0,top:40},...shots.map((input,i)=>({input,left:1200+(i%2)*600,top:40+Math.floor(i/2)*400}))
    ]).png().toFile(join(out,kind+'-comparison.png'));
  }
  await writeFile(join(out,'review-report.json'), JSON.stringify({browser:browser.version(), assetRoot:root, offline:true, errors, samples},null,2));
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser?.close(); await server.close(); }
