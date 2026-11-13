// node dev/castcmp/board-load.cjs <out.json> --board a,b,... [--foes c,d,...] [--star 3] [--port 5311] [--assetPort 5419] [--warm 1] [--gl gpu|swift]
// One whole real combat (up to 8 against 8, src/simulation) on the 3D renderer, for the host-body overlay load: per second of
// combat, the wall time of its ~62 frames (GPU synced each second), the overlays on screen, and the cap counters of
// vfx-ltk (runtime.ts ATTACHED_LAYER_STATS; absent on builds before it, which then report frame time only), and the measured
// pass's admission counters (runtime.ts LTK_RUN_STATS: peak systems running, starts and drops by system; batch1-events.ts
// CAITLYN_SHOT_STATS: Caitlyn's shots and centre fallbacks).
// A warm pass plays the combat once first so effect files and shaders are loaded; the measured pass replays it from tick 0.
// Frame times are only comparable between builds on the same machine and --gl; SwiftShader is not a player's GPU.
const { chromium } = require('playwright');
const { launchOptions, timer } = require('./common.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const out = path.resolve(args[0]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(opt('port') ?? 5311), assetPort = Number(opt('assetPort') ?? 5419);
const board = opt('board'); if (!board) throw Error('--board required');
const foes = opt('foes') ?? board, star = opt('star') ?? '3';
(async () => {
  const mark = timer(); const launch = launchOptions(opt);
  const browser = await chromium.launch(launch.options); mark('launched (' + launch.gl + ')');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning' && m.text().startsWith('vfx-ltk')) warnings.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?board=${board}&foes=${foes}&star=${star}&assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
  await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 180000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  const info = await page.evaluate(() => window.__h.board); if (!info.combatStart) throw new Error('board combat without combat start'); mark(`harness ready: ${info.ticks} ticks, ${info.casts} casts`);
  for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(32); }); await page.waitForTimeout(250);
    if (i > 8 && await page.evaluate(() => !!window.__render3dLoad)) break; }
  const seconds = Math.ceil(info.ticks * 50 / 1000) + 2;
  const stats = () => page.evaluate(async () => {
    const runtime = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
    const attached = await import('/src/rendering/three-mode/vfx-ltk/rendering/components/AttachedMeshes.ts').catch(() => null);
    const layer = runtime?.ATTACHED_LAYER_STATS ? JSON.parse(JSON.stringify(runtime.ATTACHED_LAYER_STATS)) : null;
    return layer && { ...layer, cap: runtime.ATTACHED_LAYER_CAP, peakAlive: attached?.ATTACHED_STATS?.peakAlive, overSlotFrames: attached?.ATTACHED_STATS?.overSlotFrames };
  });
  const sync = () => page.evaluate(() => { const c = document.querySelector('#host canvas'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); });
  for (let w = 0; w < Number(opt('warm') ?? 1); w++) {
    await page.evaluate(() => window.__h.reset());
    for (let s = 0; s < seconds * 4; s++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(60); }
    mark('warm pass ' + (w + 1));
  }
  const afterWarm = await stats();
  await page.evaluate(() => window.__h.reset()); await sync();
  // Admission counters (runtime.ts LTK_RUN_STATS) and Caitlyn's shot fallbacks (batch1-events.ts CAITLYN_SHOT_STATS) for the
  // measured pass only; absent on builds before them.
  const admission = (reset = false) => page.evaluate(async clear => {
    const runtime = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
    const events = await import('/src/rendering/three-mode/vfx-ltk/batch1-events.ts').catch(() => null);
    const run = runtime?.LTK_RUN_STATS, shots = events?.CAITLYN_SHOT_STATS;
    if (clear) { if (run) Object.assign(run, { peakRunning: 0, started: {}, dropped: {} }); if (shots) Object.assign(shots, { shots: 0, fallback: 0 }); }
    return { run: run ? JSON.parse(JSON.stringify(run)) : null, caitlynShots: shots ? { ...shots } : null };
  }, reset);
  await admission(true);
  const perSecond = [];
  for (let s = 0; s < seconds; s++) {
    // REC BRANCH ONLY: the shared budget's live particles, peak over this second (runtime.ts rec probe __FX_LIVE; null without it).
    await page.evaluate(() => { if ('__FX_LIVE' in globalThis) globalThis.__FX_LIVE = 0; });
    const t0 = Date.now(); await page.evaluate(() => window.__h.step(1000)); await sync(); const wall = Date.now() - t0;
    const budgetLive = await page.evaluate(() => ('__FX_LIVE' in globalThis) ? globalThis.__FX_LIVE : null);
    const now = await stats();
    perSecond.push({ second: s + 1, tick: await page.evaluate(() => window.__h.tick()), frameMs: +(wall / 62.5).toFixed(1), layers: now?.layers ?? null, peakLayers: now?.peakLayers ?? null, cappedFrames: now?.cappedFrames ?? null , budgetLivePeak: budgetLive });
  }
  mark('measured pass');
  const frame = perSecond.map(r => r.frameMs).sort((a, b) => a - b);
  const final = await stats();
  const counters = await admission();
  const report = { board: board.split(','), foes: foes.split(','), star: Number(star), gl: launch.gl, combat: info,
    budget: { max: await page.evaluate(() => globalThis.__FX_BUDGET ?? 1500), livePeak: perSecond.some(r => r.budgetLivePeak !== null) ? Math.max(...perSecond.map(r => r.budgetLivePeak ?? 0)) : null,
      livePeakPerSecond: perSecond.map(r => r.budgetLivePeak) },
    frameMs: { mean: +(frame.reduce((a, b) => a + b, 0) / frame.length).toFixed(1), median: frame[frame.length >> 1], p95: frame[Math.floor(frame.length * 0.95)], max: frame[frame.length - 1] },
    afterWarm, final, admission: counters, perSecond, warnings: [...new Set(warnings)], errors };
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ frameMs: report.frameMs, peakLayers: final?.peakLayers ?? null, cappedFrames: final?.cappedFrames ?? null, capEvents: final?.capEvents ?? null,
    peakRunning: counters.run?.peakRunning ?? null, caitlynBurst: counters.run ? { started: counters.run.started['8d6e1c2e'] ?? 0, dropped: counters.run.dropped['8d6e1c2e'] ?? 0 } : null,
    caitlynShots: counters.caitlynShots, errors: errors.length }));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
