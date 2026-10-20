// Localhost-only Chrome capture at exactly 50% of each selected clip. No network assets.
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { safeInputPath, safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';

const root = resolve('assets3d-local/cast-picks');
const review = await safeOutputPath(join(root, 'review'), { directory: true });
await mkdir(review, { recursive: true });
const manifest = JSON.parse(await readFile(join(root, 'manifest.json')));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--unit' || !Object.hasOwn(manifest.models, args[1]))) {
  throw new Error('usage: cast-picks-browser-review.mjs [--unit <model-id>]');
}
const selected = Object.entries(manifest.models).filter(([id]) => !args.length || id === args[1]);
// Serve only local Three modules and this output root; no Vite transforms or dependency scans.
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1:5199').pathname);
    const prefix = '/node_modules/three/';
    const assets = '/assets3d-local/cast-picks/';
    const base = path.startsWith(prefix) ? resolve('node_modules/three') : root;
    const relative = path.startsWith(prefix) ? path.slice(prefix.length) :
      path.startsWith(assets) ? path.slice(assets.length) : null;
    if (relative === null) { response.writeHead(404).end(); return; }
    const bytes = await readFile(await safeInputPath(base, resolve(base, relative)));
    response.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
let browser;
try {
  if (!process.env.CHROMIUM_PATH) throw new Error('CHROMIUM_PATH-required');
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5199, '127.0.0.1', resolve); });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(r.url()));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:5199' ? route.continue() : route.abort();
  });
  await page.route('http://127.0.0.1:5199/review', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body></body>' }));
  for (const [id, pick] of selected) {
    console.log(`Reviewing ${id}`);
    await page.goto('http://127.0.0.1:5199/review');
    const result = await page.evaluate(async ({ id, pick }) => {
      const T = await import('/node_modules/three/build/three.module.js');
      const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(`/assets3d-local/cast-picks/${pick.path}`);
      const object = gltf.scene, clip = gltf.animations.find(c => c.name === pick.animations.cast);
      if (!clip || !clip.tracks.length || !(clip.duration > 0)) throw new Error('cast-clip-unplayable');
      const mixer = new T.AnimationMixer(object), action = mixer.clipAction(clip);
      action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play(); mixer.setTime(clip.duration / 2);
      object.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(object, true), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
      if (!(size.y > 0) || !size.toArray().every(Number.isFinite)) throw new Error('invalid-cast-bounds');
      let meshes = 0, textured = 0;
      object.traverse(o => { if (o.isMesh) { meshes++; for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m.map?.image?.width && m.map?.image?.height) textured++;
      } } });
      if (!meshes || !textured) throw new Error('cast-textures-missing');
      document.body.style.cssText = 'margin:0;background:#17212c;color:white;font:16px sans-serif';
      const label = document.createElement('div'); label.textContent = `${id} | ${clip.name} | approximated | 50%`;
      label.style.height = '40px'; document.body.append(label);
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(1000, 760); document.body.append(renderer.domElement);
      const scene = new T.Scene(); scene.background = new T.Color('#17212c'); scene.add(object);
      scene.add(new T.AmbientLight(0xffffff, 2)); const light = new T.DirectionalLight(0xffffff, 2); light.position.set(150, 250, 200); scene.add(light);
      const extent = Math.max(size.x, size.y, size.z) * 2;
      const grid = new T.GridHelper(extent * 2, 12, 0x667788, 0x334455);
      grid.position.set(center.x, box.min.y, center.z); scene.add(grid);
      const camera = new T.OrthographicCamera(-extent / 2 * 1000 / 760, extent / 2 * 1000 / 760, extent / 2, -extent / 2, .1, extent * 20);
      camera.position.copy(center).add(new T.Vector3(extent * .65, extent * .55, extent)); camera.lookAt(center);
      renderer.render(scene, camera);
      const context = renderer.getContext(), pixels = new Uint8Array(64 * 64 * 4);
      context.readPixels(468, 348, 64, 64, context.RGBA, context.UNSIGNED_BYTE, pixels);
      if (new Set(pixels).size < 8) throw new Error('blank-cast-frame');
      return { id, clip: clip.name, approximated: true, sampleRatio: .5, sampleSeconds: clip.duration / 2,
        durationSeconds: clip.duration, meshes, textured, size: size.toArray(), screenshot: `${id}.png` };
    }, { id, pick });
    await page.screenshot({ path: await safeOutputPath(join(review, result.screenshot), { force: true }) });
    results.push(result); console.log(JSON.stringify(result));
  }
  const report = args.length ? `${args[1]}-report.json` : 'review-report.json';
  await writeOutputFileAtomic(join(review, report), JSON.stringify({ ready: !errors.length && results.length === selected.length, errors, results }, null, 2) + '\n', { force: true });
  if (errors.length || results.length !== selected.length) throw new Error('cast-browser-review-failed:' + errors.join(','));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
