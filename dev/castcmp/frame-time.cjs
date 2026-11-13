// node dev/castcmp/frame-time.cjs <out.json> --board a,b,... --foes c,d,... [--star 2] [--caps 12,16,20,24] [--budgets 1500]
//   [--variants before=5311,after=5312,...] [--variantCaps after=24,pool=24] [--rounds 3] [--assetPort 5419] [--gl gpu|swift] [--size 1920x1080]
// REC BRANCH ONLY. One real combat (up to 10 against 10) on the 3D renderer, replayed once per cell and round at 1/60 s
// frames. A cell is (variant, LTK system cap, shared particle budget). A variant is a page origin: one vite per checkout
// (before / after a branch, any number of them); --variantCaps limits a variant to some caps (several as 20/24). Every
// round runs every cell in one browser, the cell order rotated each round, so drift lands on all cells alike.
// Each frame is timed on the real clock from the step to a GPU read-back (update + render + GPU), and split into the LTK
// effect update (runtime.ts rec probe, summed over runtimes) and WebGL draw calls (counted by wrapping the context).
// It also reports the LTK systems live at once (max over runtimes) and Viktor's basic-attack rows asked / started /
// dropped. A fresh page per cell and round (fresh runtime); a warm pass first so files and shaders load; the first frame
// after reset (board rebuild) is stepped untimed. Summary: per cell, the median over rounds and the range (min–max).
const { chromium } = require('playwright');
const { launchOptions, timer } = require('./common.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const out = path.resolve(args[0]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const assetPort = Number(opt('assetPort') ?? 5419);
const board = opt('board'), foes = opt('foes') ?? board, star = opt('star') ?? '2';
if (!board) throw Error('--board required');
const caps = (opt('caps') ?? '12,16,20,24').split(',').map(Number), budgets = (opt('budgets') ?? '1500').split(',').map(Number);
const rounds = Number(opt('rounds') ?? 3);
const [W, H] = (opt('size') ?? '1920x1080').split('x').map(Number); // smaller only for smoke tests
const variants = Object.fromEntries((opt('variants') ?? `before=${opt('port') ?? 5311}`).split(',').map(kv => kv.split('=')).map(([k, v]) => [k, Number(v)]));
const variantCaps = Object.fromEntries((opt('variantCaps') ?? '').split(',').filter(Boolean).map(kv => kv.split('=')).map(([k, v]) => [k, v.split('/').map(Number)]));
const q = (s, p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
const r2 = x => +x.toFixed(2);
const frameStats = (ms, ltk, draws) => { const s = [...ms].sort((a, b) => a - b), l = [...ltk].sort((a, b) => a - b), d = [...draws].sort((a, b) => a - b);
  return { frames: s.length, mean: r2(s.reduce((a, b) => a + b, 0) / s.length), p50: r2(q(s, 0.5)), p95: r2(q(s, 0.95)), p99: r2(q(s, 0.99)), max: r2(s[s.length - 1]),
    over16_7: s.filter(x => x > 1000 / 60).length, over33_3: s.filter(x => x > 2000 / 60).length,
    ltkMean: r2(l.reduce((a, b) => a + b, 0) / l.length), ltkP95: r2(q(l, 0.95)), drawsMean: r2(d.reduce((a, b) => a + b, 0) / d.length), drawsP95: q(d, 0.95), drawsMax: d[d.length - 1] }; };
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[s.length >> 1] : r2((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
// Counts every WebGL draw call; installed before the renderer gets its context.
const countDraws = () => {
  window.__draws = 0;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) if (C) for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
    const fn = C.prototype[name]; if (fn) C.prototype[name] = function (...a) { window.__draws++; return fn.apply(this, a); };
  }
};
(async () => {
  const mark = timer(); const launch = launchOptions(opt);
  const browser = await chromium.launch(launch.options); mark('launched (' + launch.gl + ')');
  const cells = Object.keys(variants).flatMap(variant => (variantCaps[variant] ?? caps).flatMap(cap => budgets.map(budget => ({ variant, cap, budget }))));
  const order = []; for (let r = 0; r < rounds; r++) { const k = r % cells.length; order.push(...[...cells.slice(k), ...cells.slice(0, k)].map(c => ({ ...c, round: r + 1 }))); }
  mark(`${cells.length} cells × ${rounds} rounds`);
  const results = [];
  for (const cell of order) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.addInitScript(countDraws);
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${variants[cell.variant]}/dev/castcmp/index.html?w=${W}&h=${H}&board=${board}&foes=${foes}&star=${star}&ltkcap=${cell.cap}&fxbudget=${cell.budget}&assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
    await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 300000, polling: 500 });
    const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
    const info = await page.evaluate(() => window.__h.board);
    const applied = await page.evaluate(() => ({ cap: globalThis.__LTK_CAP, budget: globalThis.__FX_BUDGET, probe: typeof globalThis.__realNow === 'function' }));
    if (applied.cap !== cell.cap || applied.budget !== cell.budget || !applied.probe) throw new Error('override not applied: ' + JSON.stringify(applied));
    for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(1000 / 30); }); await page.waitForTimeout(250);
      if (i > 8 && await page.evaluate(() => !!window.__render3dLoad)) break; }
    const seconds = Math.ceil(info.ticks * 50 / 1000) + 2;
    await page.evaluate(() => window.__h.reset());
    for (let s = 0; s < seconds * 4; s++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(60); }
    await page.evaluate(() => { window.__h.reset(); globalThis.__LTK_STATS = {}; });
    const per = await page.evaluate(seconds => {
      const c = document.querySelector('#host canvas'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); const px = new Uint8Array(4);
      const sync = () => { if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      // The first frame after reset rebuilds the board; it is stepped untimed.
      window.__h.step(1000 / 60); sync();
      const ms = [], ltk = [], draws = [], live = []; const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) {
        globalThis.__LTK_UPD_MS = 0; globalThis.__LTK_ACTIVE = 0; window.__draws = 0;
        const t0 = window.__realNow(); window.__h.step(1000 / 60); sync(); ms.push(window.__realNow() - t0);
        ltk.push(globalThis.__LTK_UPD_MS ?? 0); draws.push(window.__draws); live.push(globalThis.__LTK_ACTIVE ?? 0);
      }
      return { ms, ltk, draws, live };
    }, seconds);
    const admit = await page.evaluate(() => globalThis.__LTK_STATS ?? {});
    const sum = pick => Object.entries(admit).filter(([k]) => pick(k)).reduce((t, [, v]) => ({ asked: t.asked + v.asked, started: t.started + v.started, dropped: t.dropped + v.dropped }), { asked: 0, started: 0, dropped: 0 });
    const vk = k => /-viktor\|attack\|/.test(k);
    const admission = { all: sum(() => true), viktorAttack: sum(vk),
      viktorAttackBySystem: Object.fromEntries([...new Set(Object.keys(admit).filter(vk).map(k => k.split('|')[2]))].map(sys => [sys, sum(k => vk(k) && k.split('|')[2] === sys)])) };
    const row = { ...cell, combat: info, ...frameStats(per.ms, per.ltk, per.draws), livePeak: Math.max(...per.live), liveMean: r2(per.live.reduce((a, b) => a + b, 0) / per.live.length),
      admission, errors: [...new Set(errors)].slice(0, 5), ms: per.ms.map(r2), ltkMs: per.ltk.map(r2), draws: per.draws, live: per.live };
    results.push(row);
    mark(`${cell.variant} cap ${cell.cap}/${cell.budget} round ${cell.round}: mean ${row.mean} p95 ${row.p95} >33 ${row.over33_3} ltk ${row.ltkMean} draws ${row.drawsMean} live ${row.livePeak} vk ${JSON.stringify(admission.viktorAttack)}`);
    await page.close();
  }
  const keys = ['mean', 'p95', 'p99', 'over33_3', 'over16_7', 'ltkMean', 'ltkP95', 'drawsMean', 'drawsMax', 'livePeak', 'liveMean'];
  const summary = cells.map(c => { const rs = results.filter(r => r.variant === c.variant && r.cap === c.cap && r.budget === c.budget);
    return { ...c, rounds: rs.length, ...Object.fromEntries(keys.map(k => [k, median(rs.map(r => r[k]))])),
      range: Object.fromEntries(['mean', 'p95', 'over33_3', 'ltkMean', 'drawsMean'].map(k => [k, [Math.min(...rs.map(r => r[k])), Math.max(...rs.map(r => r[k]))]])),
      viktorAttack: rs.map(r => r.admission.viktorAttack) }; });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ board: board.split(','), foes: foes.split(','), star: Number(star), gl: launch.gl, variants, order: order.map(o => `${o.variant}/${o.cap}/${o.budget}#${o.round}`), summary, results }, null, 1));
  console.table(summary.map(s => ({ variant: s.variant, cap: s.cap, budget: s.budget, mean: s.mean, meanRange: s.range.mean.join('–'), p95: s.p95, p95Range: s.range.p95.join('–'),
    over33: s.over33_3, over33Range: s.range.over33_3.join('–'), ltkMs: s.ltkMean, draws: s.drawsMean, livePeak: s.livePeak, vkDropped: s.viktorAttack.map(v => v.dropped).join('/') })));
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
