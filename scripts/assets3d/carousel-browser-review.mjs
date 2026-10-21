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
  await page.goto('http://127.0.0.1:5198/review');
  const vertexColorProbe = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { ParticleEffectV2 } = await import('/src/rendering3d/particles-v2.ts');
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.setAttribute('color', new T.Float32BufferAttribute(Array(4).fill([1, 0, 0, .5]).flat(), 4));
    const fx = new ParticleEffectV2({ schemaVersion: 2, limits: { maxParticles: 1, maxDuration: 1 }, emitters: [{
      kind: 'mesh', mesh: 'synthetic.glb', emission: { mode: 'burst', count: 1 }, lifetime: 1,
    }] }, { scale: 1, mesh: () => geometry });
    const scene = new T.Scene(); scene.background = new T.Color(0, 0, 1); scene.add(fx.object);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 10); camera.position.z = 2;
    const renderer = new T.WebGLRenderer({ preserveDrawingBuffer: true }); renderer.setSize(16, 16);
    renderer.outputColorSpace = T.LinearSRGBColorSpace; renderer.render(scene, camera);
    const gl = renderer.getContext(), pixel = new Uint8Array(4); gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const error = gl.getError(); fx.dispose(); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss();
    if (error || Math.abs(pixel[0] - 128) > 3 || pixel[1] > 3 || Math.abs(pixel[2] - 128) > 3)
      throw new Error('carousel-vertex-RGBA-probe-failed:' + [...pixel]);
    return { synthetic: true, pixel: [...pixel], expected: 'half red vertex alpha over blue, in linear output' };
  });
  const meshTargets = Object.fromEntries((build.particleMeshes ?? []).filter(m => m.status === 'converted')
    .map(m => ['mesh-' + m.path.split('/').at(-1).replace('.glb', ''), m]));
  const targets = ['scene-stage', 'scene-layout', 'scene-full', ...Object.keys(manifest.models), ...Object.keys(manifest.effects), ...Object.keys(meshTargets)];
  for (const id of targets) {
    await page.goto('http://127.0.0.1:5198/review');
    const result = await page.evaluate(async ({ id, manifest, build, meshTarget }) => {
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
      if (manifest.effects[id] || meshTarget) {
        doc = meshTarget ? { schemaVersion: 2, limits: { maxParticles: 1, maxDuration: 30 }, emitters: [{
          // Unreferenced converted meshes intentionally are not in precache.
          kind: 'mesh', mesh: 'build/units/carousel/' + meshTarget.path, emission: { mode: 'burst', count: 1 }, lifetime: 30,
        }] } : await (await fetch(base + manifest.effects[id].path)).json();
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
      const extent = Math.max(...fitBox.getSize(new T.Vector3()).toArray(), meshTarget ? .0001 : cell * 2);
      for (const top of [false, true]) for (const time of times) {
        const box = document.createElement('div');
        box.textContent = `${id} | ${top ? 'top' : 'oblique'} | ${time}s | grid = 1 cell${id === 'scene-layout' ? ' | proposed anchors' : ''}${meshTarget ? ' | geometry + vertex color only' : ''}`;
        document.body.append(box);
        const scene = new T.Scene(); scene.background = new T.Color('#182936'); scene.add(models);
        const camera = new T.PerspectiveCamera(40, 480 / 460, meshTarget ? Math.max(extent / 1000, .000001) : .1, 50000);
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
      return { id, samples, emitters: doc?.emitters.length, textures: textures.size, meshSource: meshTarget?.source,
        proposedLayout: id === 'scene-layout' ? { unitCountExample: 9, unitRadiusCells: 2.5, playerRadiusCells: 7.1,
          unitHeightCells: 1.5, playerHeightCells: .75, feetCells: .25, note: 'Display proposal, not recovered source animation or authoritative slots.' } : undefined,
        materialApproximation: doc ? undefined : build.models.filter(m => id.startsWith('scene-') || m.id === id).map(m => ({ id: m.id, approximation: m.approximation })) };
    }, { id, manifest, build, meshTarget: meshTargets[id] });
    await page.screenshot({ path: await safeOutputPath(join(review, id + '.png'), { force: true }), fullPage: true });
    results.push(result); console.log('review:', id);
  }
  for (const [group, ids] of [['effects', Object.keys(manifest.effects)], ['meshes', Object.keys(meshTargets)]]) {
    for (let start = 0; start < ids.length; start += 6) {
      await page.goto('http://127.0.0.1:5198/review');
      await page.evaluate(async ids => {
        document.body.style.cssText = 'margin:0;background:#182936;display:grid;grid-template-columns:repeat(2,720px)';
        await Promise.all(ids.map(async id => {
          const img = document.createElement('img'); img.style.width = '720px';
          img.src = '/assets3d-local/carousel/review/' + id + '.png'; document.body.append(img); await img.decode();
        }));
      }, ids.slice(start, start + 6));
      await page.screenshot({ path: await safeOutputPath(join(review, `contact-${group}-${start / 6 + 1}.png`), { force: true }), fullPage: true });
    }
  }
  await writeOutputFileAtomic(join(review, 'review-report.json'), JSON.stringify({ offline: true, errors, results,
    vertexColorProbe, precacheVerified: precache.files.length, cellPolicy: 'One grid interval is one board cell; model and particle scale .44.' }, null, 2), { force: true });
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser?.close(); await server.close(); }
