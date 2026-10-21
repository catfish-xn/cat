import { createServer } from 'vite';
import { chromium } from 'playwright';
import { join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { CONQUEROR_SHIMMER_IDS } from './conqueror-shimmer.mjs';

const review = await safeOutputPath('assets3d-local/conqueror-shimmer/review', { directory: true });
await mkdir(review, { recursive: true });
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, entries: [], include: [] },
  cacheDir: join(review, 'browser-cache'), server: { host: '127.0.0.1', port: 5198, strictPort: true, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(r.url()));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.route('http://127.0.0.1:5198/review', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body></body>' }));
  for (const id of CONQUEROR_SHIMMER_IDS) {
    await page.goto('http://127.0.0.1:5198/review');
    const result = await page.evaluate(async id => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const { ParticleEffectV2 } = await import('/src/rendering3d/particles-v2.ts');
      const base = '/assets3d-local/conqueror-shimmer/root/', m = await (await fetch(base + 'manifest.json')).json();
      const binding = await (await fetch(base + 'action-bindings.json')).json();
      document.body.style.cssText = 'margin:0;background:#182936;color:white;font:17px sans-serif;display:grid;grid-template-columns:repeat(3,480px)';
      const loader = new GLTFLoader(), renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(480, 460);
      let doc, gltf; const textures = new Map(), meshes = new Map(), samples = [];
      if (m.models[id]) gltf = await loader.loadAsync(base + m.models[id].path);
      else {
        doc = await (await fetch(base + m.effects[id].path)).json();
        for (const e of doc.emitters) {
          if (e.texture && !textures.has(e.texture)) textures.set(e.texture, await new T.TextureLoader().loadAsync(base + e.texture));
          if (e.mesh && !meshes.has(e.mesh)) { const g = await loader.loadAsync(base + e.mesh); g.scene.traverse(o => { if (o.isMesh) meshes.set(e.mesh, o.geometry); }); }
        }
      }
      for (const top of [false, true]) for (const time of [.1, .6, 1.8]) {
        const box = document.createElement('div'); box.textContent = `${id} | ${top ? 'top' : 'oblique'} | ${time}s`; document.body.append(box);
        const scene = new T.Scene(); scene.background = new T.Color('#182936');
        const camera = new T.PerspectiveCamera(40, 480/460, .1, 5000); camera.position.set(top ? 0 : 160, top ? 450 : 230, top ? .01 : 340); camera.lookAt(0, 45, 0);
        scene.add(new T.GridHelper(400, 10, 0x718795, 0x354c59), new T.AmbientLight(0xffffff, 2));
        let fx;
        if (gltf) {
          const object = gltf.scene; object.scale.setScalar(1); object.position.set(0, 0, 0); object.updateMatrixWorld(true);
          const initial = new T.Box3().setFromObject(object, true); object.scale.setScalar(110 / initial.getSize(new T.Vector3()).y);
          const mixer = new T.AnimationMixer(object), action = binding.models[id].open ?? binding.models[id].idle;
          mixer.clipAction(gltf.animations.find(c => c.name === action)).play(); mixer.update(time);
          object.updateMatrixWorld(true); object.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); o.computeBoundingSphere(); } });
          const bounds = new T.Box3().setFromObject(object, true); object.position.y -= bounds.min.y; scene.add(object);
          const main = id === 'shimmer-flask' ? object.getObjectByName('Main') : undefined;
          const up = main ? new T.Vector3(0, 1, 0).transformDirection(main.matrixWorld).toArray() : undefined;
          if (up && Math.hypot(up[0], up[2]) > 1e-5) throw Error('shimmer-review-not-upright');
          samples.push({ time, top, clip: action, height: bounds.getSize(new T.Vector3()).y, ...(up ? { mainWorldUp: up } : {}) });
        } else {
          fx = new ParticleEffectV2(doc, { scale: .5, maxDuration: 6, texture: p => textures.get(p), mesh: p => meshes.get(p) });
          scene.add(fx.object); fx.update(0, camera);
          for (let t = 0; t < time - 1e-8;) { const dt = Math.min(.05, time-t); t += dt; fx.update(dt, camera); }
          samples.push({ time, top, particles: fx.particleCount });
        }
        renderer.render(scene, camera); const img = document.createElement('img'); img.src = renderer.domElement.toDataURL(); box.append(img); fx?.dispose();
      }
      renderer.dispose(); renderer.forceContextLoss(); textures.forEach(t => t.dispose()); meshes.forEach(m => m.dispose());
      return { id, samples, emitters: doc?.emitters.length, animationCount: gltf?.animations.length };
    }, id);
    await page.screenshot({ path: await safeOutputPath(join(review, id + '.png'), { force: true }), fullPage: true });
    results.push(result); console.log(id);
  }
  await writeOutputFileAtomic(join(review, 'review-report.json'), JSON.stringify({ browser: 'local Chrome', version: browser.version(), offline: true, errors, results }, null, 2) + '\n', { force: true });
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser?.close(); await server.close(); }
