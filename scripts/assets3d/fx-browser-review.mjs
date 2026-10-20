// Offline, isolated-emitter review. Read-only linked inputs may use a separate evidence directory.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve, basename } from 'node:path';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { argumentsFor } from './plan-fetch.mjs';
import { batchOutputRoot } from './fx-batch.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFile } from './safe-path.mjs';

const args = argumentsFor(process.argv.slice(2), ['--out', '--effect', '--screenshots']);
const root = args.screenshots
 ? withinRoot(resolve('assets3d-local'), resolve(args.out ?? 'assets3d-local/fx-batch3'))
 : await batchOutputRoot(args.out ?? 'assets3d-local/fx-batch3');
await safeInputPath(root, resolve(root, 'manifest.json'));
const sizes = await readFile(await safeInputPath(root, resolve(root, 'size-report.json')), 'utf8').then(JSON.parse);
const evidence = [];
const screenshots = await safeOutputPath(args.screenshots ?? root, { directory: true });
await mkdir(screenshots, { recursive: true });
const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, optimizeDeps: { noDiscovery: true, entries: [], include: [] }, cacheDir: resolve(screenshots, 'browser-cache'), server: { host: '127.0.0.1', port: 5197, fs: { allow: [resolve('.'), await realpath(root)] } } });
let browser;
try {
 await server.listen();
 browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
 const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
 page.on('console', m => console.log(m.text()));
 page.on('pageerror', e => console.log(e.message));
 page.on('requestfailed', r => console.log('failed', r.url(), r.failure()));
 await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
 await page.route('http://127.0.0.1:*/review', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body></body>' }));
 await page.goto(server.resolvedUrls.local[0] + 'review', { waitUntil: 'domcontentloaded' });
 const effects = args.effect === 'all'
  ? await page.evaluate(async base => Object.keys((await (await fetch(base + '/manifest.json')).json()).effects), '/' + resolve(root).split(/[\\/]/).slice(-2).join('/'))
  : (args.effect ?? 'garen_tft13_garen_base_r_aoe_impact').split(',');
 for (const effect of effects) {
 await page.goto(server.resolvedUrls.local[0] + 'review', { waitUntil: 'domcontentloaded' });
 console.log('review-effect', effect);
 const samples = sizes.results.find(r => r.effectId === effect)?.emitters.map(e => ({ index: e.index, time: e.opacityVisibleAt ?? e.at })) ?? [];
 const result = await page.evaluate(async ({ base, effect, samples }) => {
  const T = await import('/node_modules/three/build/three.module.js');
  const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const { ParticleEffectV2 } = await import('/src/rendering3d/particles-v2.ts');
  const manifest = await (await fetch(base + '/manifest.json')).json();
  const id = Object.keys(manifest.effects).find(id => id === effect || (!effect && /garen.*aoe_impact/.test(id)));
  const doc = await (await fetch(base + '/' + manifest.effects[id].path)).json();
  document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:#15202b;color:white;display:grid;grid-template-columns:repeat(4,300px)';
  const textures = new Map(), meshes = new Map(), errors = [];
  for (const e of doc.emitters) {
   if (e.texture && !textures.has(e.texture)) {
    try { const t = await new T.TextureLoader().loadAsync(base + '/' + e.texture); textures.set(e.texture, t); }
    catch { errors.push(e.texture); }
   }
   if (e.mesh && !meshes.has(e.mesh)) {
    const g = await new GLTFLoader().loadAsync(base + '/' + e.mesh); g.scene.traverse(o => { if (o.isMesh) meshes.set(e.mesh, o.geometry); });
   }
  }
  const renderer = new T.WebGLRenderer({ preserveDrawingBuffer: true }); renderer.setSize(300, 220);
  for (let i = 0; i < doc.emitters.length; i++) {
   const time = Math.max(.001, samples.find(s => s.index === i)?.time ?? .3);
   const box = document.createElement('div'); box.textContent = i + ' ' + doc.emitters[i].kind + ' t=' + time.toFixed(3); document.body.append(box);
   const scene = new T.Scene(); scene.background = new T.Color('#15202b');
   const camera = new T.PerspectiveCamera(45,300/220,1,10000); camera.position.set(0,500,600); camera.lookAt(0,0,0);
   const grid = new T.GridHelper(624,10,0x667788,0x334455); scene.add(grid);
   const fx = new ParticleEffectV2({ ...doc, emitters: [doc.emitters[i]] }, { scale: .44, texture: p => textures.get(p), mesh: p => meshes.get(p) });
   scene.add(fx.object);
   // Match the size audit's 50ms integration, including the initial spawn.
   fx.update(0, camera);
   let elapsed = 0;
   while (elapsed < time - 1e-8) { const dt = Math.min(.05, time - elapsed); fx.update(dt, camera); elapsed += dt; }
   renderer.render(scene,camera);
   const img = document.createElement('img'); img.src = renderer.domElement.toDataURL(); box.append(img);
   fx.dispose(); grid.geometry.dispose(); grid.material.dispose();
  }
  renderer.dispose(); renderer.forceContextLoss();
  textures.forEach(t => t.dispose()); meshes.forEach(g => g.dispose());
  return { id, emitters: doc.emitters.length, errors };
 }, { base: '/' + resolve(root).split(/[\\/]/).at(-2) + '/' + resolve(root).split(/[\\/]/).at(-1), effect, samples });
 await page.screenshot({ path: await safeOutputPath(resolve(screenshots, (args.screenshots ? basename(root) + '-' : '') + 'browser-review-' + result.id + '.png'), { force: true }), fullPage: true });
 console.log(JSON.stringify(result));
 evidence.push({ ...result, samples });
 }
 await writeOutputFile(resolve(screenshots, 'browser-review-report.json'), JSON.stringify(evidence, null, 2) + '\n', { force: true });
} finally { await browser?.close(); await server.close(); }



