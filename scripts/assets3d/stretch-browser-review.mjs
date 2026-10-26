// Usage: node scripts/assets3d/stretch-browser-review.mjs [local-root] [shots-dir] [comma-separated-ids]
// Set STRETCH_MODE=transitions for the real BoardFeed event/mixer path, REVIEW_PORT for another local port.
// Uses only the supplied codex-browser Chrome. All screenshots/models stay in ignored local directories.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { ignoredOutput } from './merge-root-output.mjs';
import { safeInputPath, safeOutputPath } from './safe-path.mjs';
const require = createRequire(import.meta.url);
if (!process.env.CODEX_BROWSER_CLIENT) throw Error('Use codex-browser exec to provide Chrome; never launch a browser here.');
const root = resolve(process.argv[2] ?? 'assets3d-local/stretch-root');
const out = await safeOutputPath(process.argv[3] ?? 'assets3d-local/stretch-shots', { directory: true });
await ignoredOutput(out);
await mkdir(out, { recursive: true });
const ids = (process.argv[4] ?? 'akali,jinx,draven,irelia,mordekaiser,pve-rift-herald').split(',');
const manifestBytes = await readFile(join(root, 'manifest.json')), manifest = JSON.parse(manifestBytes);
const hash = b => createHash('sha256').update(b).digest('hex');
const modelSha256 = {};
for (const id of ids) modelSha256[id] = hash(await readFile(await safeInputPath(root, join(root, manifest.models[id].path))));
const provenance = { manifestSha256: hash(manifestBytes), modelSha256 };
const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true },
  optimizeDeps: { noDiscovery: true, entries: [], include: [] }, cacheDir: join(out, 'vite-cache'),
  server: { host: '127.0.0.1', port: Number(process.env.REVIEW_PORT ?? 5276), strictPort: true, hmr: false, watch: null } });
let browser, context;
const errors = [], samples = [];
const port = Number(process.env.REVIEW_PORT ?? 5276);
try {
  await server.listen();
  browser = await require(process.env.CODEX_BROWSER_CLIENT).connect();
  context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.route('**/local-assets/**', async r => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname).slice('/local-assets/'.length);
    try { return r.fulfill({ body: await readFile(await safeInputPath(root, resolve(root, path))) }); }
    catch { return r.fulfill({ status: 404 }); }
  });
  await page.route('**/stretch-review?debug3d', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/src/style.css">
    <script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
    <style>body{margin:0;background:#101923}#board{position:absolute;inset:0}.render3d-fps{display:none}#stamp{position:fixed;top:10px;left:12px;z-index:300;color:white;background:#101923dd;padding:5px;font:15px monospace}</style>
    <body data-m6-mode="active"><div id="board" class="render3d-layer"></div><div id="stamp"></div></body>` }));
  // Only control rendering RAF; network/loading and idle slice timers remain real.
  await page.addInitScript(() => { let id = 0, time = 0; const pending = new Map();
    window.requestAnimationFrame = callback => { pending.set(++id, callback); return id; };
    window.cancelAnimationFrame = id => pending.delete(id);
    window.advance = (dt = 16) => { time += dt; const tasks = [...pending.values()]; pending.clear(); tasks.forEach(f => f(time)); };
  });
  await page.goto(`http://127.0.0.1:${port}/stretch-review?debug3d`);
  await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const renderer = await import('/src/rendering/three-mode/placeholder-renderer.ts');
    let listener;
    renderer.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null });
    const mounted = await renderer.mountRenderer3d(document.querySelector('#board'), { assetBase: location.origin + '/local-assets/' });
    if (mounted.status !== 'assets') throw Error(mounted.detail);
    const frame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 0, y: 0 }, bench: [], fighting: false, dragging: null, pieces: [] };
    const diagnostic = new T.GridHelper(600, 20, 0xffcc44, 0x556677); diagnostic.position.set(3.5 * Math.sqrt(3) * 34, 0, 4 * 51); diagnostic.visible = false; window.__render3d.scene.add(diagnostic);
    window.review = { T, mounted, listener, frame, show(id, starLevel) {
      listener.frame({ ...frame, pieces: [{ id: 'subject', definitionId: id, team: 'enemy', x: 3.5 * Math.sqrt(3) * 34, y: 4 * 51, visible: true, alive: true, starLevel }] }); window.advance();
    }, render(label, side = false) {
      const { scene, camera, renderer, pieces } = window.__render3d, v = pieces.get('subject');
      const x = v.target.x, z = v.target.z, heading = v.root.rotation.y;
      if (window.review.rear && v.definitionId === 'pve-rift-herald') v.root.rotation.y = Math.PI;
      const extent = v.definitionId === 'pve-rift-herald' ? 630 : 300;
      camera.position.set(x + (side ? extent : extent * .35), side ? 25 : extent * .7, z + (side ? 0 : extent));
      camera.lookAt(x, side ? 20 : 30, z); camera.updateMatrixWorld();
      const hidden = side ? scene.children.filter(n => n !== v.root && n !== v.stars?.object && !n.isLight && n !== diagnostic && n.visible) : [];
      hidden.forEach(n => n.visible = false); diagnostic.visible = side;
      document.querySelector('#stamp').textContent = label + (side ? ' | side / floor=0' : ' | board');
      renderer.render(scene, camera);
      hidden.forEach(n => n.visible = true); diagnostic.visible = false; v.root.rotation.y = heading;
    } };
  });
  for (const id of ids) {
    await page.evaluate(id => window.review.show(id, 1), id);
    await page.waitForFunction(id => {
      window.advance(); const v = window.__render3d.pieces.get('subject');
      return v?.definitionId === id && v.mixer && v.lease && !v.lease.placeholder;
    }, id, { polling: 50 });
    await page.waitForFunction(() => { const root = window.__render3d.scene.getObjectByName('render3d-board-arena'); return root?.children.length > 0; }, null, { polling: 50 });
    const names = await page.evaluate(() => window.__render3d.pieces.get('subject').lease.animations.map(c => c.name));
    if (!names.length) throw Error('model-has-no-clips:' + id);
    for (const star of [1, 2, 3]) {
      await page.evaluate(({ id, star }) => window.review.show(id, star), { id, star });
      if (process.env.STRETCH_MODE === 'transitions') {
        await page.evaluate(async () => {
          const { UnitAnimationMixer, UnitActionState } = await import('/src/rendering3d/index.ts');
          const v = window.__render3d.pieces.get('subject'); v.mixer.dispose();
          v.mixer = new UnitAnimationMixer(v.body, v.lease.animations, v.lease.animationNames, v.lease);
          v.state = new UnitActionState('subject');
          v.state.setPlaybackResolver((action, index) => v.mixer.resolvePlayback(action, index, { starLevel: v.starLevel, form: v.form }));
          v.mixer.apply(v.state.output);
          // Rear view matches the reporting screenshot's Herald facing away from the camera.
          window.review.rear = true;
          window.review.step = dt => {
            // Run the production tick/state/mixer/effects at 60Hz. Rasterize the sampled poses only,
            // so a software GPU does not spend minutes drawing frames that are never inspected.
            const renderer = window.__render3d.renderer, draw = renderer.render;
            renderer.render = () => {};
            try { window.advance(dt * 1000); } finally { renderer.render = draw; }
          };
        });
        for (const [phase, kind] of ['idle', 'movement', 'attack', 'cast', 'cast', 'cast', 'idle', 'death'].entries()) {
          const info = await page.evaluate(({ kind, phase }) => {
            const v = window.__render3d.pieces.get('subject');
            if (kind !== 'idle') window.review.listener.events([{ type: kind, unitId: 'subject', attackerId: 'subject', sourceId: 'subject',
              targetIds: [], tick: phase, eventSeq: phase, completed: true }]);
            const output = v.state.output;
            const duration = output.playback?.durationSeconds ?? (kind === 'death' ? v.lease.animations.find(c => c.name === v.lease.animationNames.death).duration : kind === 'movement' ? .2 : .5);
            return { output, duration, modelScale: v.modelScale, rootScale: v.root.scale.toArray(), bodyScale: v.body.scale.toArray() };
          }, { kind, phase });
          const tiles = [], times = [0, .06, .12, info.duration * .35, info.duration * .7, info.duration * .95, info.duration, info.duration + .15].sort((a,b)=>a-b);
          let elapsed = 0;
          for (const [i, t] of times.entries()) {
            const capture = await page.evaluate(({ dt, label, side }) => {
              let left = dt; while (left > 1e-9) { const step = Math.min(left, 1/60); window.review.step(step); left -= step; }
              window.review.render(label, side);
              return window.__render3d.renderer.domElement.toDataURL('image/png').split(',')[1];
            }, { dt: t - elapsed, label: `${id} | ${star} star | runtime ${phase}-${kind} | ${t.toFixed(3)}s`, side: i === 7 });
            elapsed = t; const png = Buffer.from(capture, 'base64');
            const label = `<svg width="500" height="24"><rect width="500" height="24" fill="#101923"/><text x="8" y="16" fill="white" font-size="11">${id} s${star} ${phase}-${kind} ${t.toFixed(3)}s${i === 7 ? ' side' : ''}</text></svg>`;
            tiles.push({ input: await sharp(png).resize(500,380).composite([{input:Buffer.from(label),left:0,top:0}]).png().toBuffer(), left: i%4*500, top: Math.floor(i/4)*380 });
            if (star === 3 && i === 4) await writeFile(join(out, `${id}--s3--runtime-${phase}-${kind}--detail.png`), png);
          }
          const screenshot = `${id}--s${star}--runtime-${phase}-${kind}.png`;
          await sharp({ create: { width: 2000, height: 760, channels: 4, background: '#101923' } }).composite(tiles).png().toFile(join(out, screenshot));
          samples.push({ id, star, phase, kind, screenshot, times, ...info });
          await writeFile(join(out, 'review-report.json'), JSON.stringify({ root, ...provenance, mode: 'transitions', errors, samples }, null, 2));
          console.log(`${id} s${star} runtime ${phase}-${kind}`);
        }
        continue;
      }
      for (const name of names) {
        const info = await page.evaluate(({ name, star }) => {
          const { T } = window.review, v = window.__render3d.pieces.get('subject');
          v.mixer.mixer.stopAllAction();
          const clip = v.lease.animations.find(c => c.name === name), action = v.mixer.mixer.clipAction(clip);
          action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
          window.review.pose = t => { action.paused = false; action.enabled = true; v.mixer.mixer.setTime(t); v.body.updateMatrixWorld(true); v.body.traverse(m => m.skeleton?.update()); };
          const metrics = { minY: Infinity, minTime: 0, maxEdge: 0, edgeTime: 0, frames: 0 };
          // Every frame, including the exact terminal pose, at 30fps. Capture all actions, even unused variants.
          for (let f = 0; f <= Math.ceil(clip.duration * 30); f++) {
            const t = Math.min(f / 30, clip.duration); window.review.pose(t); metrics.frames++;
            v.body.traverse(m => {
              if (!m.isMesh) return;
              const p = m.geometry.attributes.position, vertices = new Float64Array(p.count * 3), point = new T.Vector3();
              for (let i = 0; i < p.count; i++) {
                m.getVertexPosition(i, point).applyMatrix4(m.matrixWorld); point.toArray(vertices, i * 3);
                if (![point.x, point.y, point.z].every(Number.isFinite)) throw Error('non-finite-vertex');
                if (point.y < metrics.minY) { metrics.minY = point.y; metrics.minTime = t; }
              }
              const index = m.geometry.index, count = index?.count ?? p.count;
              for (let i = 0; i < count; i += 3) for (let c = 0; c < 3; c++) {
                const a = (index ? index.getX(i + c) : i + c) * 3, b = (index ? index.getX(i + (c + 1) % 3) : i + (c + 1) % 3) * 3;
                const edge = Math.hypot(vertices[a]-vertices[b], vertices[a+1]-vertices[b+1], vertices[a+2]-vertices[b+2]);
                if (edge > metrics.maxEdge) { metrics.maxEdge = edge; metrics.edgeTime = t; }
              }
            });
          }
          return { duration: clip.duration, modelScale: v.modelScale, rootScale: v.root.scale.toArray(), bodyScale: v.body.scale.toArray(), bodyY: v.body.position.y,
            selectedCast: v.mixer.resolvePlayback('cast', 0, { starLevel: star }), ...metrics };
        }, { name, star });
        const tiles = [], times = [0, .2, .4, .6, .8, 1].map(f => f * info.duration).concat([info.edgeTime, info.minTime]);
        for (const [i, t] of times.entries()) {
          await page.evaluate(({ t, label, side }) => { window.review.pose(t); window.review.render(label, side); },
            { t, label: `${id} | ${star} star | ${name} | ${t.toFixed(3)}s`, side: i === 7 });
          const png = await page.screenshot();
          tiles.push({ input: await sharp(png).resize(500, 380).png().toBuffer(), left: (i % 4) * 500, top: Math.floor(i / 4) * 380 });
          if (star === 3 && i === 6) await writeFile(join(out, `${id}--s3--${name}--peak.png`), png);
        }
        const screenshot = `${id}--s${star}--${name}.png`;
        await sharp({ create: { width: 2000, height: 760, channels: 4, background: '#101923' } }).composite(tiles).png().toFile(join(out, screenshot));
        samples.push({ id, star, name, screenshot, times, ...info });
        await writeFile(join(out, 'review-report.json'), JSON.stringify({ root, ...provenance, mode: 'clips', errors, samples }, null, 2));
        console.log(`${id} s${star} ${name} frames=${info.frames} minY=${info.minY.toFixed(2)} maxEdge=${info.maxEdge.toFixed(2)}`);
      }
    }
  }
  await page.evaluate(() => window.review.mounted.dispose());
  if (errors.length) throw Error(JSON.stringify(errors));
  console.log(JSON.stringify({ models: ids.length, actionsAtStars: samples.length, frames: samples.reduce((n,s)=>n+(s.frames ?? 0),0), errors }));
} finally { await context?.close(); await browser?.close(); await server.close(); }
