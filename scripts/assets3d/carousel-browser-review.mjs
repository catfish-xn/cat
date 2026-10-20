import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';

// Local HTTP only. No source-cache writes, dependency discovery or downloads.
const root = resolve('assets3d-local/carousel');
const review = await safeOutputPath(join(root, 'review'), { directory: true });
await mkdir(review, { recursive: true });
const read = p => safeInputPath(root, join(root, p)).then(readFile);
const manifest = JSON.parse(await read('manifest.json'));
const build = JSON.parse(await read('build-report.json'));
const precache = JSON.parse(await read('precache.json'));
for (const f of precache.files) {
  const bytes = await read(f.path);
  if (bytes.length !== f.bytes || createHash('sha256').update(bytes).digest('hex') !== f.sha256)
    throw new Error('carousel-precache-mismatch:' + f.path);
}
const server = await createServer({ configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [], include: [] },
  cacheDir: join(review, 'browser-cache'),
  server: { host: '127.0.0.1', port: 5198, strictPort: true, watch: null } });
let browser;
try {
  await server.listen();
  if (!process.env.CHROMIUM_PATH) throw new Error('CHROMIUM_PATH-required');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.route('http://127.0.0.1:5198/review', r => r.fulfill({ contentType: 'text/html',
    body: '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body></body>' }));
  const targets = ['scene-stage', 'scene-layout', 'scene-full', ...Object.keys(manifest.models), ...Object.keys(manifest.effects)];
  for (const id of targets) {
    await page.goto('http://127.0.0.1:5198/review');
    const result = await page.evaluate(async ({ id, manifest, build }) => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const { ParticleEffectV2 } = await import('/src/rendering3d/particles-v2.ts');
      const base = '/assets3d-local/carousel/', cell = 62.4, scale = .44;
      document.body.style.cssText = 'margin:0;background:#182936;color:white;font:16px sans-serif;display:grid;grid-template-columns:repeat(3,480px)';
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(480, 460);
      const textures = new Map(), meshes = new Map(), models = new T.Group(), samples = [];
      const loader = new GLTFLoader();
      let doc;
      if (manifest.effects[id]) {
        doc = await (await fetch(base + manifest.effects[id].path)).json();
        for (const e of doc.emitters) {
          if (e.texture && !textures.has(e.texture)) textures.set(e.texture, await new T.TextureLoader().loadAsync(base + e.texture));
          if (e.mesh && !meshes.has(e.mesh)) {
            const g = await loader.loadAsync(base + e.mesh);
            g.scene.traverse(o => { if (o.isMesh) meshes.set(e.mesh, o.geometry); });
          }
        }
      } else {
        const selected = id === 'scene-full' ? Object.keys(manifest.models) : ['scene-stage', 'scene-layout'].includes(id)
          ? ['carousel-center', 'carousel-center-b', 'carousel-llplatforms', 'carousel-reflectionplane', 'carousel-glassdome-a'] : [id];
        for (const key of selected) {
          const g = await loader.loadAsync(base + manifest.models[key].path);
          g.scene.scale.setScalar(scale); models.add(g.scene);
        }
      }
      if (id === 'scene-layout') {
        for (const [count, radius, height, color] of [[9, 2.5, 1.5, 0x58ddff], [8, 7.1, .75, 0xffb45c]]) {
          for (let i = 0; i < count; i++) {
            const a = i * Math.PI * 2 / count;
            const marker = new T.Mesh(new T.BoxGeometry(cell * .55, cell * height, cell * .55),
              new T.MeshBasicMaterial({ color, wireframe: true }));
            marker.position.set(Math.sin(a) * radius * cell, (height / 2 + .25) * cell, -Math.cos(a) * radius * cell);
            marker.rotation.y = -a; models.add(marker);
          }
        }
      }
      const times = [0.1, 0.5, id.includes('6s') ? 6 : 2];
      const modelBox = new T.Box3().setFromObject(models), effectBox = new T.Box3();
      if (doc) {
        // Fit all sampled lifetimes before taking screenshots, so large walls
        // remain visible while local selection flashes retain useful detail.
        const probeCamera = new T.PerspectiveCamera(); probeCamera.position.set(cell * 5, cell * 8, cell * 8); probeCamera.lookAt(0, 0, 0);
        for (const time of times) {
          const probe = new ParticleEffectV2(doc, { scale, maxDuration: 30,
            texture: p => textures.get(p), mesh: p => meshes.get(p) });
          probe.update(0, probeCamera);
          for (let elapsed = 0; elapsed < time - 1e-8;) {
            const dt = Math.min(.05, time - elapsed); elapsed += dt; probe.update(dt, probeCamera);
          }
          effectBox.union(new T.Box3().setFromObject(probe.object)); probe.dispose();
        }
      }
      const fitBox = doc ? effectBox : modelBox;
      const center = fitBox.getCenter(new T.Vector3());
      const extent = Math.max(...fitBox.getSize(new T.Vector3()).toArray(), cell * 2);
      for (const top of [false, true]) for (const time of times) {
        const box = document.createElement('div');
        box.textContent = `${id} | ${top ? 'top' : 'oblique'} | ${time}s | grid = 1 cell${id === 'scene-layout' ? ' | proposed anchors' : ''}`;
        document.body.append(box);
        const scene = new T.Scene(); scene.background = new T.Color('#182936'); scene.add(models);
        const camera = new T.PerspectiveCamera(40, 480 / 460, .1, 50000);
        camera.position.copy(center).add(new T.Vector3(top ? 0 : .7, top ? 1.75 : 1.2, top ? .0001 : 1.65).multiplyScalar(extent));
        camera.lookAt(center);
        const grid = new T.GridHelper(cell * 24, 24, 0x9ab5c4, 0x354c59);
        grid.position.y = doc ? -.1 : Math.min(0, modelBox.max.y + .5);
        scene.add(grid);
        // A 7 x 8-cell rectangular size reference, not a board-layout replacement.
        if (id === 'scene-stage') {
          const guide = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(cell * 7, .2, cell * 8)),
            new T.LineBasicMaterial({ color: 0xffb45c }));
          guide.position.y = 18; scene.add(guide);
        }
        const fx = doc ? new ParticleEffectV2(doc, { scale, maxDuration: 30,
          texture: p => textures.get(p), mesh: p => meshes.get(p) }) : null;
        if (fx) {
          scene.add(fx.object); fx.update(0, camera);
          for (let elapsed = 0; elapsed < time - 1e-8;) {
            const dt = Math.min(.05, time - elapsed); elapsed += dt; fx.update(dt, camera);
          }
        }
        renderer.render(scene, camera);
        if (renderer.getContext().getError() !== 0) throw new Error('carousel-webgl-error:' + id);
        const img = document.createElement('img'); img.src = renderer.domElement.toDataURL(); box.append(img);
        const bounds = fx ? new T.Box3().setFromObject(fx.object) : modelBox;
        const sizeCells = bounds.getSize(new T.Vector3()).divideScalar(cell).toArray();
        if (!sizeCells.every(Number.isFinite)) throw new Error('nonfinite-carousel-review-bounds');
        samples.push({ top, time, sizeCells, particles: fx?.particleCount, finished: fx?.finished,
          skipped: fx?.skipped, skippedReasons: fx?.skippedReasons });
        fx?.dispose(); grid.geometry.dispose(); grid.material.dispose();
      }
      models.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { m.map?.dispose(); m.dispose(); } } });
      renderer.dispose(); renderer.forceContextLoss();
      textures.forEach(t => t.dispose()); meshes.forEach(m => m.dispose());
      return { id, samples, emitters: doc?.emitters.length, textures: textures.size,
        proposedLayout: id === 'scene-layout' ? { unitCountExample: 9, unitRadiusCells: 2.5, playerRadiusCells: 7.1,
          unitHeightCells: 1.5, playerHeightCells: .75, feetCells: .25, note: 'Display proposal, not recovered source animation or authoritative slots.' } : undefined,
        materialApproximation: doc ? undefined : build.models.filter(m => id.startsWith('scene-') || m.id === id).map(m => ({ id: m.id, approximation: m.approximation })) };
    }, { id, manifest, build });
    await page.screenshot({ path: await safeOutputPath(join(review, id + '.png'), { force: true }), fullPage: true });
    results.push(result); console.log('review:', id);
  }
  await writeOutputFileAtomic(join(review, 'review-report.json'), JSON.stringify({ offline: true, errors, results,
    precacheVerified: precache.files.length, cellPolicy: 'One grid interval is one board cell; model and particle scale .44.' }, null, 2), { force: true });
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser?.close(); await server.close(); }
