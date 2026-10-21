import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve, join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { safeOutputPath, safeInputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { SPECIAL_ORB_EFFECTS } from './tft-extras.mjs';

const specialOnly = process.argv.slice(2).includes('--special-orbs');
const root = resolve('assets3d-local/tft-extras'), review = await safeOutputPath(join(root, 'review'), { directory: true });
await mkdir(review, { recursive: true });
const manifest = JSON.parse(await readFile(await safeInputPath(root, join(root, 'manifest.json')), 'utf8'));
const build = JSON.parse(await readFile(await safeInputPath(root, join(root, 'build-report.json')), 'utf8'));
console.log('review: create server');
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, entries: [], include: [] },
  cacheDir: join(review, 'browser-cache'), server: { host: '127.0.0.1', port: 5199, strictPort: true, watch: null } });
let browser;
try {
  await server.listen(); console.log('review: server listening');
  if (!process.env.CHROMIUM_PATH) throw new Error('CHROMIUM_PATH-required');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  console.log('review: Chrome launched');
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }), errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url()));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.route('http://127.0.0.1:5199/review', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body></body>' }));
  const targets = specialOnly ? SPECIAL_ORB_EFFECTS.map(({ id }) => ({ id })) : [...Object.entries(manifest.models).flatMap(([id, m]) =>
    [...new Set(['idle', ...['move', 'cast', 'attack'].filter(a => m.animations?.[a]).slice(0, 2)])].map(action => ({ id, action }))),
    ...Object.keys(manifest.effects).map(id => ({ id }))];
  for (const { id, action } of targets) {
    console.log('review: loading', id);
    await page.goto('http://127.0.0.1:5199/review');
    const result = await page.evaluate(async ({ id, action, build }) => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const { ParticleEffectV2 } = await import('/src/rendering3d/particles-v2.ts');
      const base = '/assets3d-local/tft-extras/', manifest = await (await fetch(base + 'manifest.json')).json();
      const bindings = await (await fetch(base + 'action-bindings.json')).json();
      document.body.style.cssText = 'margin:0;background:#182936;color:white;font:17px sans-serif;display:grid;grid-template-columns:repeat(3,480px)';
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(480, 460);
      const textures = new Map(), meshes = new Map(), samples = [];
      let doc, gltf;
      if (manifest.effects[id]) {
        doc = await (await fetch(base + manifest.effects[id].path)).json();
        for (const e of doc.emitters) {
          if (e.texture && !textures.has(e.texture)) textures.set(e.texture, await new T.TextureLoader().loadAsync(base + e.texture));
          if (e.mesh && !meshes.has(e.mesh)) {
            const g = await new GLTFLoader().loadAsync(base + e.mesh); g.scene.traverse(o => { if (o.isMesh) meshes.set(e.mesh, o.geometry); });
          }
        }
      } else gltf = await new GLTFLoader().loadAsync(base + manifest.models[id].path);
      const travel = bindings.playback[id]?.phase === 'travel';
      const times = id.startsWith('orb-prismatic') || ['orb-warband', 'orb-crime'].includes(id) ? [.5, 8, 60] : travel ? [.15, .45, .8] : id.includes('open') || id.includes('damage') ? [.08, .25, .6] : [.1, .5, 2];
      for (const top of [false, true]) for (const time of times) {
        const box = document.createElement('div'); box.textContent = `${id} ${action ?? ''} | ${top ? 'top' : 'oblique'} | ${time}s | grid=1 cell`; document.body.append(box);
        const scene = new T.Scene(); scene.background = new T.Color('#182936');
        const camera = new T.PerspectiveCamera(40, 480 / 460, 1, 5000);
        camera.position.set(top ? 0 : 190, top ? 540 : 330, top ? .01 : 450); camera.lookAt(0, 20, 0);
        if (gltf) { camera.position.set(top ? 0 : 120, top ? 320 : 140, top ? .01 : 220); camera.lookAt(30, 30, 0); }
        scene.add(new T.GridHelper(624, 10, 0x718795, 0x354c59));
        const fx = doc ? new ParticleEffectV2(doc, { scale: .44, maxDuration: bindings.playback[id].maxDuration, texture: p => textures.get(p), mesh: p => meshes.get(p) }) : null;
        if (fx) {
          scene.add(fx.object); fx.update(0, camera);
          for (let elapsed = 0; elapsed < time - 1e-8;) { const dt = Math.min(.05, time - elapsed); elapsed += dt;
            if (travel) fx.object.position.set(-93.6 + 187.2 * elapsed, 35, 0);
            fx.update(dt, camera);
          }
        } else {
          const object = gltf.scene, model = build.models.find(m => m.ids.includes(id));
          object.scale.setScalar(model.suggestedScale); const mixer = new T.AnimationMixer(object);
          const clip = gltf.animations.find(c => c.name === manifest.models[id].animations[action]);
          if (!clip) throw new Error('missing-review-clip:' + action);
          mixer.clipAction(clip).play(); mixer.update(time);
          object.position.set(0, 0, 0);
          object.updateMatrixWorld(true);
          object.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); o.computeBoundingSphere(); } });
          object.updateMatrixWorld(true); object.position.y -= new T.Box3().setFromObject(object, true).min.y; scene.add(object);
          scene.add(new T.AmbientLight(0xffffff, 2));
          const reference = new T.Mesh(new T.BoxGeometry(30, 92, 30), new T.MeshBasicMaterial({ color: 0x779aaa, wireframe: true }));
          reference.position.set(93.6, 46, 0); scene.add(reference);
        }
        if (travel) for (const x of [-93.6, 93.6]) { const marker = new T.Mesh(new T.SphereGeometry(8), new T.MeshBasicMaterial({ color: 0x779aaa, wireframe: true })); marker.position.set(x, 35, 0); scene.add(marker); }
        renderer.render(scene, camera);
        const img = document.createElement('img'); img.src = renderer.domElement.toDataURL(); box.append(img);
        const bounds = fx ? new T.Box3().setFromObject(fx.object) : new T.Box3().setFromObject(gltf.scene);
        samples.push({ time, top, particles: fx?.particleCount, finished: fx?.finished,
          sizeCells: bounds.getSize(new T.Vector3()).divideScalar(62.4).toArray() });
        fx?.dispose();
      }
      renderer.dispose(); renderer.forceContextLoss(); textures.forEach(t => t.dispose()); meshes.forEach(m => m.dispose());
      return { id, action, samples, emitters: doc?.emitters.length, travel, textures: textures.size };
    }, { id, action, build });
    await page.screenshot({ path: await safeOutputPath(join(review, id + (action && action !== 'idle' ? '-' + action : '') + '.png'), { force: true }), fullPage: true });
    results.push(result); console.log(id);
  }
  await writeOutputFileAtomic(join(review, specialOnly ? 'special-orbs-review-report.json' : 'review-report.json'), JSON.stringify({ browser: 'local Chrome', offline: true, errors, results,
    unavailableModels: manifest.models['little-legend-default'] ? [] : build.petDependencies ?? build.failures.filter(f => f.stage === 'little-legend') }, null, 2), { force: true });
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser?.close(); await server.close(); }
