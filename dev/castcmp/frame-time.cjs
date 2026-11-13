// node dev/castcmp/frame-time.cjs <out.json> --board a,b,... --foes c,d,... [--star 2] [--caps 12,24,32] [--budgets 1500,2000]
//   [--rounds 2] [--port 5311] [--assetPort 5419] [--gl gpu|swift]
// REC BRANCH ONLY. One real combat (up to 10 against 10) on the 3D renderer, replayed once per (LTK system cap, shared
// particle budget) cell, at 1/60 s frames. Each measured frame is timed on the real clock from the step to a GPU read-back,
// so it covers update + render + GPU. A fresh page per cell (fresh runtime); a warm pass first so files and shaders load.
// Rounds repeat every cell in order cap-major, then reversed, so drift shows up as a round-to-round difference.
const { chromium } = require('playwright');
const { launchOptions, timer } = require('./common.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const out = path.resolve(args[0]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(opt('port') ?? 5311), assetPort = Number(opt('assetPort') ?? 5419);
const board = opt('board'), foes = opt('foes') ?? board, star = opt('star') ?? '2';
if (!board) throw Error('--board required');
const caps = (opt('caps') ?? '12,24,32').split(',').map(Number), budgets = (opt('budgets') ?? '1500,2000').split(',').map(Number);
const rounds = Number(opt('rounds') ?? 2);
const stats = ms => { const s = [...ms].sort((a, b) => a - b), q = p => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2);
  return { frames: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(2),
    over16_7: s.filter(x => x > 1000 / 60).length, over33_3: s.filter(x => x > 2000 / 60).length }; };
(async () => {
  const mark = timer(); const launch = launchOptions(opt);
  const browser = await chromium.launch(launch.options); mark('launched (' + launch.gl + ')');
  const cells = caps.flatMap(cap => budgets.map(budget => ({ cap, budget })));
  const order = []; for (let r = 0; r < rounds; r++) order.push(...(r % 2 ? [...cells].reverse() : cells).map(c => ({ ...c, round: r + 1 })));
  const results = [];
  for (const cell of order) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?board=${board}&foes=${foes}&star=${star}&ltkcap=${cell.cap}&fxbudget=${cell.budget}&assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
    await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 300000, polling: 500 });
    const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
    const info = await page.evaluate(() => window.__h.board);
    const applied = await page.evaluate(() => ({ cap: globalThis.__LTK_CAP, budget: globalThis.__FX_BUDGET }));
    if (applied.cap !== cell.cap || applied.budget !== cell.budget) throw new Error('override not applied: ' + JSON.stringify(applied));
    for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(1000 / 30); }); await page.waitForTimeout(250);
      if (i > 8 && await page.evaluate(() => !!window.__render3dLoad)) break; }
    const seconds = Math.ceil(info.ticks * 50 / 1000) + 2;
    await page.evaluate(() => window.__h.reset());
    for (let s = 0; s < seconds * 4; s++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(60); }
    await page.evaluate(() => window.__h.reset());
    const ms = await page.evaluate(seconds => {
      const c = document.querySelector('#host canvas'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); const px = new Uint8Array(4);
      const out = []; const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) { const t0 = window.__realNow(); window.__h.step(1000 / 60); if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push(window.__realNow() - t0); }
      return out;
    }, seconds);
    const row = { ...cell, combat: info, ...stats(ms), errors: [...new Set(errors)].slice(0, 5), ms: ms.map(x => +x.toFixed(2)) };
    results.push(row); mark(`cap ${cell.cap} budget ${cell.budget} round ${cell.round}: mean ${row.mean} p95 ${row.p95} p99 ${row.p99} >16.7 ${row.over16_7}`);
    await page.close();
  }
  const summary = cells.map(c => { const rs = results.filter(r => r.cap === c.cap && r.budget === c.budget);
    return { ...c, ...stats(rs.flatMap(r => r.ms)), perRound: rs.map(r => ({ round: r.round, mean: r.mean, p95: r.p95, p99: r.p99, over16_7: r.over16_7 })) }; });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ board: board.split(','), foes: foes.split(','), star: Number(star), gl: launch.gl, summary, results }, null, 1));
  console.table(summary.map(({ perRound, ...s }) => s));
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
