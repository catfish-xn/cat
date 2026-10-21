// Requires the local preview /cast-review handler on :5197, CORS roots :5198, and game server :8799.
// The review page mounts the production 3D chunk with a controlled display feed; no rules are changed.
import { chromium } from 'playwright';
import { join } from 'node:path';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';

if (!process.env.CHROMIUM_PATH) throw new Error('CHROMIUM_PATH-required');
const out = 'assets3d-local/cast-anim/review';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-background-networking', '--disable-component-update', '--no-first-run'] });
const results = [], failures = [];
try {
  for (const root of ['cast-anim', 'cast-anim-compressed']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => {
      // This optional index is absent from these unpacked roots; Chromium can abort its empty 404 body.
      if (new URL(r.url()).pathname.endsWith('/packs.json') && r.failure()?.errorText === 'net::ERR_ABORTED') return;
      errors.push(`${r.url()} ${r.failure()?.errorText}`);
    });
    await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    // Control only the application's RAF. Browser/loader timers and screenshot helpers stay live.
    await page.addInitScript(() => {
      let now = 0, id = 0;
      const callbacks = new Map();
      Object.defineProperty(performance, 'now', { value: () => now });
      window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
      window.cancelAnimationFrame = key => { callbacks.delete(key); };
      window.reviewAdvance = milliseconds => {
        const end = now + milliseconds;
        while (now < end) {
          now = Math.min(end, now + 16);
          const pending = [...callbacks.values()]; callbacks.clear();
          pending.forEach(callback => callback(now));
        }
      };
    });
    await page.goto(`http://127.0.0.1:5197/cast-review?debug3d&root=${root}`);
    await page.waitForFunction(() => window.reviewReady, null, { polling: 50 });
    const mount = await page.evaluate(() => ({ status: window.reviewMount.status, detail: window.reviewMount.detail }));
    if (mount.status !== 'assets') throw new Error(JSON.stringify({ mount, errors }));
    const cases = [
      { id: 'amumu', form: 'front', casts: 1 }, { id: 'tristana', form: 'back', casts: 1 },
      { id: 'irelia', form: 'front', casts: 1 }, { id: 'jinx', form: 'back', casts: 3 },
      { id: 'jayce', form: 'front', casts: 1 }, { id: 'jayce', form: 'back', casts: 1 },
    ];
    for (const c of cases) {
      console.log(`review ${root} ${c.id} ${c.form}`);
      await page.evaluate(c => {
        const radius = 34, row = c.form === 'front' ? 3 : 0, x = 430, y = 146 + radius * 1.5 * row;
        window.reviewFeed.frame({ rows: 8, columns: 7, hexRadius: radius, origin: { x: 242, y: 146 }, bench: [],
          pieces: [{ id: `${c.id}-${c.form}`, definitionId: c.id, team: 'enemy', starLevel: 1, x, y, visible: true, alive: true }],
          fighting: true, dragging: null });
      }, c);
      const key = `${c.id}-${c.form}`;
      let loaded = false;
      for (let attempt = 0; attempt < 300 && !loaded; attempt++) {
        await page.evaluate(() => window.reviewAdvance(16));
        loaded = await page.evaluate(key => !!window.__render3d.pieces.get(key)?.mixer, key);
        if (!loaded) await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (!loaded) throw new Error(JSON.stringify(await page.evaluate(() => ({ status: window.reviewMount.status,
        pieces: [...window.__render3d.pieces].map(([key, v]) => ({ key, lease: !!v.lease, mixer: !!v.mixer, definitionId: v.definitionId })), errors: [] }))));
      await page.evaluate(() => window.reviewAdvance(320));
      await page.evaluate(key => {
        const v = window.__render3d.pieces.get(key), camera = window.__render3d.camera;
        camera.position.set(v.target.x, 150, v.target.z + 300); camera.lookAt(v.target.x, 45, v.target.z);
      }, key);
      for (let castIndex = 0; castIndex < c.casts; castIndex++) {
        const start = await page.evaluate(({ key, castIndex, root }) => {
          const view = window.__render3d.pieces.get(key), before = view.state.output;
          const idleName = view.lease.animationNames.idle, idle = view.lease.animations.find(c => c.name === idleName);
          const idleTime = idle && view.mixer.mixer.clipAction(idle).time;
          window.reviewFeed.events([{ type: 'cast', sourceId: key, targetIds: [], actionSeq: castIndex, tick: castIndex, eventSeq: castIndex, completed: true }]);
          const output = view.state.output;
          const unchanged = output.revision === before.revision && (!idle || view.mixer.mixer.clipAction(idle).time === idleTime);
          document.querySelector('#title').textContent = `${key} | ${root} | cast ${castIndex + 1}`;
          return { output, unchanged, form: view.form, placeholder: view.lease.placeholder };
        }, { key, castIndex, root });
        if (start.placeholder || start.form !== c.form) throw new Error('invalid-review-body');
        if (c.id === 'amumu' ? !start.unchanged : !start.output.playback) throw new Error('invalid-review-selection');
        const duration = start.output.playback?.durationSeconds ?? 1;
        let elapsed = 0;
        for (let frame = 0; frame < 3; frame++) {
          // Sample the middle of entry, middle and final stages, rather than equidistant fractions.
          const sample = await page.evaluate(({ key, frame, duration }) => {
            const view = window.__render3d.pieces.get(key), playback = view.state.output.playback;
            if (!playback) return duration * [0.15, 0.5, 0.9][frame];
            const clips = playback.clips.map(n => view.lease.animations.find(c => c.name === n));
            const index = [0, Math.floor(clips.length / 2), clips.length - 1][frame];
            const raw = clips.reduce((n, c) => n + c.duration, 0);
            return (clips.slice(0, index).reduce((n, c) => n + c.duration, 0) + clips[index].duration * (clips.length === 1 ? [0.15, 0.5, 0.9][frame] : [0.35, 0.5, 0.85][frame])) / raw * duration;
          }, { key, frame, duration });
          await page.evaluate(ms => window.reviewAdvance(ms), Math.max(1, Math.round((sample - elapsed) * 1000))); elapsed = sample;
          const file = `${c.id}-${c.form}-${castIndex + 1}-${frame + 1}${root.endsWith('compressed') ? '-compressed' : ''}.png`;
          await page.screenshot({ path: await safeOutputPath(join(out, file), { force: true }) });
          const active = await page.evaluate(key => {
            const v = window.__render3d.pieces.get(key);
            return v.lease.animations.filter(c => v.mixer.mixer.clipAction(c).isRunning()).map(c => c.name);
          }, key);
          results.push({ root, unitId: c.id, form: c.form, castIndex, frame, sampleSeconds: sample,
            durationSeconds: duration, selected: start.output.playback?.clips ?? [], active, unchanged: start.unchanged, screenshot: file });
        }
        await page.evaluate(ms => window.reviewAdvance(ms), Math.max(1, Math.ceil((duration - elapsed + 0.2) * 1000)));
      }
    }
    failures.push(...errors); await page.close();
  }
  // Smoke-check the actual built application and its preview WebSocket proxy separately from controlled casts.
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const websockets = [];
  page.on('websocket', ws => websockets.push(ws.url()));
  page.on('pageerror', e => failures.push(e.message));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:5197/?mode=online&server=ws&render=3d&debug3d&assets3d=http://127.0.0.1:5198/cast-anim-compressed/');
  await page.locator('[data-debug="render3d-layer"][data-state="assets"]').waitFor();
  await page.screenshot({ path: await safeOutputPath(join(out, 'built-online-preview.png'), { force: true }) });
  const proxyConnected = websockets.some(url => url === 'ws://127.0.0.1:5197/ws');
  const report = { ready: !failures.length && results.length === 48 && proxyConnected, failures, websockets, proxyConnected, results };
  await writeOutputFileAtomic(join(out, 'review-report.json'), JSON.stringify(report, null, 2) + '\n', { force: true });
  console.log(JSON.stringify({ ready: report.ready, frames: results.length, failures, proxyConnected }));
  if (!report.ready) throw new Error('cast-browser-review-failed');
} finally { await browser.close(); }
