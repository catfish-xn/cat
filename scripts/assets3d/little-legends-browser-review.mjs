// Offline Chrome review: one idle screenshot per unique appearance, alongside height 92.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { resolve, join } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';

const root = resolve('assets3d-local/little-legends');
const review = await safeOutputPath(join(root, 'review'), { directory: true });
await mkdir(review, { recursive: true });
const report = JSON.parse(await readFile(await safeInputPath(root, join(root, 'build-report.json')), 'utf8'));
if (!report.ready) throw new Error('legend-build-not-ready');
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, entries: [], include: [] },
  cacheDir: join(review, 'browser-cache'), server: { host: '127.0.0.1', port: 5198, strictPort: true } });
let browser;
try {
  await server.listen();
  if (!process.env.CHROMIUM_PATH) throw new Error('CHROMIUM_PATH-required');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } }), results = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(r.url()));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.route('http://127.0.0.1:5198/review', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body></body>' }));
  for (const model of report.models) {
    await page.goto('http://127.0.0.1:5198/review');
    const result = await page.evaluate(async model => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const id = model.ids[0], assetRoot = '/assets3d-local/little-legends/' + (id === 'little-legend-default' ? 'river-sprite-supplement/runtime/' : 'runtime/'), manifest = await (await fetch(assetRoot + 'manifest.json')).json();
      const gltf = await new GLTFLoader().loadAsync(assetRoot + manifest.models[id].path);
      const object = gltf.scene, mixer = new T.AnimationMixer(object);
      const clip = gltf.animations.find(c => c.name === manifest.models[id].animations.idle);
      if (!clip) throw new Error('missing-idle-clip');
      mixer.clipAction(clip).play(); mixer.update(.5);
      object.scale.setScalar(model.suggestedScale); object.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(object, true), size = box.getSize(new T.Vector3());
      object.position.y -= box.min.y;
      const textures = []; object.traverse(o => {
        if (o.isMesh) for (const material of (Array.isArray(o.material) ? o.material : [o.material]))
          textures.push({ name: material.name, mapped: !!material.map, width: material.map?.image?.width, height: material.map?.image?.height });
      });
      if (!textures.length || textures.some(t => !t.mapped || !t.width || !t.height)) throw new Error('legend-texture-review-failed');
      document.body.style.cssText = 'margin:0;background:#17212c;color:white;font:18px sans-serif';
      const label = document.createElement('div'); label.textContent = `${id} | idle 0.5s | target ${model.suggestedHeight} | hero reference 92`; document.body.append(label);
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(1000, 760); document.body.append(renderer.domElement);
      const scene = new T.Scene(); scene.background = new T.Color('#17212c'); scene.add(object);
      scene.add(new T.AmbientLight(0xffffff, 2)); const light = new T.DirectionalLight(0xffffff, 2); light.position.set(100, 200, 150); scene.add(light);
      const reference = new T.Mesh(new T.BoxGeometry(22, 92, 22), new T.MeshStandardMaterial({ color: 0x66bbcc, wireframe: true }));
      reference.position.set(size.x / 2 + 40, 46, 0); scene.add(reference);
      scene.add(new T.GridHelper(500, 10, 0x667788, 0x334455));
      const extent = Math.max(190, size.x + 100, size.z + 50, size.y + 50);
      const camera = new T.OrthographicCamera(-extent / 2 * 1000 / 760, extent / 2 * 1000 / 760, extent / 2, -extent / 2, 1, 3000);
      camera.position.set(extent * .5, extent * .7, extent); camera.lookAt(15, size.y * .35, 0);
      renderer.render(scene, camera);
      return { id, sourceName: model.sourceName, idle: clip.name, animationCount: gltf.animations.length, textures,
        suggestedHeight: model.suggestedHeight, scale: model.suggestedScale, idleSize: size.toArray(), idleFloorOffset: -box.min.y };
    }, model);
    await page.screenshot({ path: await safeOutputPath(join(review, result.id + '.png'), { force: true }) });
    results.push(result); console.log(JSON.stringify(result));
  }
  await writeOutputFileAtomic(join(review, 'review-report.json'), JSON.stringify({ ready: !errors.length, errors, results }, null, 2) + '\n', { force: true });
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser?.close(); await server.close(); }
