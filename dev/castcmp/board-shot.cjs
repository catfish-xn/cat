// node dev/castcmp/board-shot.cjs <unit> <outdir> --board a,b,... --foes c,d,... [--star 3] [--anchor SYSTEM --at 0,350,...]
//   [--abs MS,MS,...] [--port 5311] [--assetPort 5419] [--gl gpu|swift]
// One whole real combat of up to 8 against 8 (the board-load harness), a warm pass, then the measured pass stepped 50 ms at
// a time. Shots: --at MS after the anchor system first starts (LTK_RUN_STATS.started), and --abs MS after the measured
// pass began. Writes <outdir>/shots/*.jpg and stats.json: the admission counters of the measured pass (runtime.ts
// LTK_RUN_STATS: peak running, started, dropped, place rows, runs that gave way to a newcomer) and `yields`, the time of
// each step a run gave way (for --abs). <unit> is only the job's label. Dev tool: it decides nothing.
const { chromium } = require('playwright');
const { launchOptions, timer } = require('./common.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const out = path.resolve(args[1]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(opt('port') ?? 5311), assetPort = Number(opt('assetPort') ?? 5419);
const board = opt('board'), foes = opt('foes') ?? board, star = opt('star') ?? '3', anchor = opt('anchor');
const at = (opt('at') ?? '300,600,900,1300,1800').split(',').map(Number);
(async () => {
  const mark = timer(); const launch = launchOptions(opt);
  const browser = await chromium.launch(launch.options);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?board=${board}&foes=${foes}&star=${star}&assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
  await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 180000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  const info = await page.evaluate(() => window.__h.board); mark(`ready ${info.ticks} ticks`);
  for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(32); }); await page.waitForTimeout(250);
    if (i > 8 && await page.evaluate(() => !!window.__render3dLoad)) break; }
  const seconds = Math.ceil(info.ticks * 50 / 1000) + 2;
  await page.evaluate(() => window.__h.reset());
  for (let s = 0; s < seconds * 4; s++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(60); }
  mark('warm');
  const run = (clear = false) => page.evaluate(async c => { const r = (await import('/src/rendering/three-mode/vfx-ltk/runtime.ts')).LTK_RUN_STATS;
    if (c) Object.assign(r, { peakRunning: 0, started: {}, dropped: {}, placeStarted: {}, placeDropped: {}, yielded: {}, yieldTimes: [] }); return JSON.parse(JSON.stringify(r)); }, clear);
  await page.evaluate(() => window.__h.reset()); await run(true);
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
  let t = 0, t0 = null; const shots = []; const todo = [...at]; const yields = []; let yieldN = 0;
  const abs = (opt('abs') ?? '').split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
  while (t < seconds * 1000) {
    await page.evaluate(() => window.__h.step(50)); t += 50;
    { const r = await run(); const n = Object.values(r.yielded ?? {}).reduce((a, b) => a + b, 0); if (n > yieldN) { yields.push({ t, n: n - yieldN, systems: r.yielded }); yieldN = n; } }
    while (abs.length && t >= abs[0]) { const d = abs.shift(); await page.waitForTimeout(100); await page.screenshot({ path: path.join(out, 'shots', `abs-${String(d).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 }); }
    if (t0 === null) { const r = await run(); if ((r.started[anchor] ?? 0) > 0) { t0 = t; mark(`anchor ${anchor} at ${t} ms, tick ${await page.evaluate(() => window.__h.tick())}`); } }
    while (t0 !== null && todo.length && t - t0 >= todo[0]) {
      const d = todo.shift(); await page.waitForTimeout(100);
      const f = path.join(out, 'shots', `${String(d).padStart(4, '0')}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 88 });
      shots.push({ after: d, t, running: (await run()).peakRunning });
    }
  }

  const stats = await run();
  fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify({ board, foes, star, anchorAt: t0, shots, yields, stats, errors }, null, 2));
  console.log(JSON.stringify({ anchorAt: t0, peakRunning: stats.peakRunning, dropped: stats.dropped, errors: errors.length }));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
