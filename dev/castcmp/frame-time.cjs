// node dev/castcmp/frame-time.cjs <out.json> --board a,b,... --foes c,d,... [--star 2] [--caps 12,16,20,24] [--budgets 1500]
//   [--variants before=5311,after=5312,...] [--variantCaps after=24,pool=24] [--degrades 4,8,off] [--variantDegrades after=4]
//   [--passSync] [--rounds 3] [--assetPort 5419] [--gl gpu|swift] [--size 1920x1080]
// --degrades: LTK_PASS_DEGRADE_AT per cell (off = never degrade). --passSync fences each optional pass (soft/early/late) with a
// read-back and reports its own ms; the fences slow every frame, so use it in its own run, never mixed with plain cells.
// With --passSync, passByNeed buckets each pass's ms by how many live systems needed that pass on the frame (1, 2, 3, 4+):
// run it with --degrades off so the pass runs whenever someone needs it.
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
const degrades = (opt('degrades') ?? '4').split(',');
const variantDegrades = Object.fromEntries((opt('variantDegrades') ?? '').split(',').filter(Boolean).map(kv => kv.split('=')).map(([k, v]) => [k, v.split('/')]));
const passSync = args.includes('--passSync');
// Champion/action pairs whose LTK rows are counted (asked / started / dropped, and runs that gave way as tails or were evicted).
const track = (opt('track') ?? 'viktor:attack,vi:cast').split(',').map(t => t.split(':'));
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
  const cells = Object.keys(variants).flatMap(variant => (variantCaps[variant] ?? caps).flatMap(cap => budgets.flatMap(budget => (variantDegrades[variant] ?? degrades).map(degrade => ({ variant, cap, budget, degrade })))));
  const order = []; for (let r = 0; r < rounds; r++) { const k = r % cells.length; order.push(...[...cells.slice(k), ...cells.slice(0, k)].map(c => ({ ...c, round: r + 1 }))); }
  mark(`${cells.length} cells × ${rounds} rounds`);
  const results = [];
  for (const cell of order) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.addInitScript(countDraws);
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${variants[cell.variant]}/dev/castcmp/index.html?w=${W}&h=${H}&board=${board}&foes=${foes}&star=${star}&ltkcap=${cell.cap}&fxbudget=${cell.budget}&degrade=${cell.degrade}${passSync ? '&passsync=1' : ''}&assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
    await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 300000, polling: 500 });
    const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
    const info = await page.evaluate(() => window.__h.board);
    const applied = await page.evaluate(() => ({ cap: globalThis.__LTK_CAP, budget: globalThis.__FX_BUDGET, degrade: String(globalThis.__LTK_DEGRADE), probe: typeof globalThis.__realNow === 'function', sync: !!globalThis.__PASS_SYNC }));
    if (applied.cap !== cell.cap || applied.budget !== cell.budget || applied.degrade !== (cell.degrade === 'off' ? 'Infinity' : cell.degrade) || !applied.probe || applied.sync !== passSync) throw new Error('override not applied: ' + JSON.stringify(applied));
    for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(1000 / 30); }); await page.waitForTimeout(250);
      if (i > 8 && await page.evaluate(() => !!window.__render3dLoad)) break; }
    const seconds = Math.ceil(info.ticks * 50 / 1000) + 2;
    await page.evaluate(() => window.__h.reset());
    for (let s = 0; s < seconds * 4; s++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(60); }
    await page.evaluate(() => { window.__h.reset(); globalThis.__LTK_STATS = {}; globalThis.__LTK_BUDGET_REFUSED = 0; globalThis.__LTK_BUDGET_ROWS = 0; });
    const per = await page.evaluate(seconds => {
      const c = document.querySelector('#host canvas'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); const px = new Uint8Array(4);
      const sync = () => { if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      // The first frame after reset rebuilds the board; it is stepped untimed.
      window.__h.step(1000 / 60); sync();
      const ms = [], ltk = [], draws = [], live = [], particles = [], pass = { soft: [], early: [], late: [] }, need = { soft: [], early: [], late: [] }; const n = Math.round(seconds * 60); globalThis.__LTK_PASSES_ON = { early: 0, late: 0, soft: 0 };
      for (let i = 0; i < n; i++) {
        globalThis.__LTK_UPD_MS = 0; globalThis.__LTK_ACTIVE = 0; globalThis.__FX_LIVE = 0; globalThis.__PASS_MS = { soft: 0, early: 0, late: 0 }; globalThis.__LTK_PASS_NEED = { early: 0, late: 0, soft: 0 }; window.__draws = 0;
        const t0 = window.__realNow(); window.__h.step(1000 / 60); sync(); ms.push(window.__realNow() - t0);
        ltk.push(globalThis.__LTK_UPD_MS ?? 0); draws.push(window.__draws); live.push(globalThis.__LTK_ACTIVE ?? 0); particles.push(globalThis.__FX_LIVE ?? 0); for (const k of ['soft', 'early', 'late']) { pass[k].push(globalThis.__PASS_MS[k]); need[k].push(globalThis.__LTK_PASS_NEED?.[k] ?? 0); }
      }
      return { ms, ltk, draws, live, particles, pass, need, passFrames: globalThis.__LTK_PASSES_ON, budgetRefusedRowFrames: globalThis.__LTK_BUDGET_REFUSED ?? 0, budgetRefusedRows: globalThis.__LTK_BUDGET_ROWS ?? 0 };
    }, seconds);
    const admit = await page.evaluate(() => globalThis.__LTK_STATS ?? {});
    const F = ['asked', 'started', 'dropped', 'gaveWay', 'evicted'];
    const sum = pick => Object.entries(admit).filter(([k]) => pick(k)).reduce((t, [, v]) => Object.fromEntries(F.map(f => [f, t[f] + (v[f] ?? 0)])), Object.fromEntries(F.map(f => [f, 0])));
    const of = (champion, action) => k => k.split('|')[0].endsWith('-' + champion) && k.split('|')[1] === action;
    const admission = { all: sum(() => true), tracked: Object.fromEntries(track.map(([c, a]) => { const pick = of(c, a);
      return [`${c}:${a}`, { total: sum(pick), bySystem: Object.fromEntries([...new Set(Object.keys(admit).filter(pick).map(k => k.split('|')[2]))].map(sys => [sys, sum(k => pick(k) && k.split('|')[2] === sys)])) }]; })) };
    admission.viktorAttack = admission.tracked['viktor:attack']?.total ?? null;
    const row = { ...cell, combat: info, ...frameStats(per.ms, per.ltk, per.draws), livePeak: Math.max(...per.live), liveMean: r2(per.live.reduce((a, b) => a + b, 0) / per.live.length),
      passFrames: per.passFrames, passMs: Object.fromEntries(['soft', 'early', 'late'].map(k => { const on = per.pass[k].filter(x => x > 0).sort((a, b) => a - b);
        return [k, { framesOn: on.length, meanWhenOn: on.length ? r2(on.reduce((a, b) => a + b, 0) / on.length) : 0, p95WhenOn: on.length ? r2(on[Math.floor(on.length * 0.95)]) : 0, meanPerFrame: r2(per.pass[k].reduce((a, b) => a + b, 0) / per.pass[k].length) }]; })),
      passByNeed: Object.fromEntries(['soft', 'early', 'late'].map(k => [k, Object.fromEntries(['1', '2', '3', '4+'].map(b => {
        const xs = per.pass[k].filter((ms, i) => ms > 0 && (b === '4+' ? per.need[k][i] >= 4 : per.need[k][i] === Number(b))).sort((a, b) => a - b);
        return [b, { frames: xs.length, mean: xs.length ? r2(xs.reduce((a, c) => a + c, 0) / xs.length) : null, p95: xs.length ? r2(xs[Math.floor(xs.length * 0.95)]) : null }]; }))])),
      needFrames: Object.fromEntries(['soft', 'early', 'late'].map(k => [k, Object.fromEntries(['0', '1', '2', '3', '4+'].map(b => [b, per.need[k].filter(x => b === '4+' ? x >= 4 : x === Number(b)).length]))])),
      particlePeak: Math.max(...per.particles), particleP95: [...per.particles].sort((a, b) => a - b)[Math.floor(per.particles.length * 0.95)], budgetRefusedRows: per.budgetRefusedRows, budgetRefusedRowFrames: per.budgetRefusedRowFrames,
      admission, errors: [...new Set(errors)].slice(0, 5), ms: per.ms.map(r2), ltkMs: per.ltk.map(r2), draws: per.draws, live: per.live };
    results.push(row);
    mark(`${cell.variant} cap ${cell.cap}/${cell.budget} degrade ${cell.degrade} round ${cell.round}: passOn ${JSON.stringify(per.passFrames)}${passSync ? ' passMs ' + JSON.stringify(row.passMs) : ''} mean ${row.mean} p95 ${row.p95} >33 ${row.over33_3} ltk ${row.ltkMean} draws ${row.drawsMean} live ${row.livePeak} particles ${row.particlePeak} budgetRefused ${row.budgetRefusedRows} tracked ${JSON.stringify(Object.fromEntries(Object.entries(admission.tracked).map(([k, v]) => [k, v.total])))}`);
    await page.close();
  }
  const passKeys = ['soft', 'early', 'late'];
  const keys = ['mean', 'p95', 'p99', 'over33_3', 'over16_7', 'ltkMean', 'ltkP95', 'drawsMean', 'drawsMax', 'livePeak', 'liveMean', 'particlePeak', 'particleP95', 'budgetRefusedRows', 'budgetRefusedRowFrames'];
  const summary = cells.map(c => { const rs = results.filter(r => r.variant === c.variant && r.cap === c.cap && r.budget === c.budget && r.degrade === c.degrade);
    return { ...c, rounds: rs.length, ...Object.fromEntries(keys.map(k => [k, median(rs.map(r => r[k]))])),
      range: Object.fromEntries(['mean', 'p95', 'over33_3', 'ltkMean', 'drawsMean'].map(k => [k, [Math.min(...rs.map(r => r[k])), Math.max(...rs.map(r => r[k]))]])),
      passFramesOn: Object.fromEntries(passKeys.map(k => [k, median(rs.map(r => r.passFrames?.[k] ?? 0))])),
      passByNeed: passSync ? Object.fromEntries(['soft', 'early', 'late'].map(k => [k, Object.fromEntries(['1', '2', '3', '4+'].map(b => {
        const fr = rs.reduce((t, r) => t + r.passByNeed[k][b].frames, 0), sum = rs.reduce((t, r) => t + (r.passByNeed[k][b].mean ?? 0) * r.passByNeed[k][b].frames, 0);
        return [b, { frames: fr, mean: fr ? r2(sum / fr) : null, p95Median: median(rs.map(r => r.passByNeed[k][b].p95 ?? 0)) }]; }))])) : null,
      passMs: passSync ? Object.fromEntries(passKeys.map(k => [k, { meanWhenOn: median(rs.map(r => r.passMs[k].meanWhenOn)), p95WhenOn: median(rs.map(r => r.passMs[k].p95WhenOn)), meanPerFrame: median(rs.map(r => r.passMs[k].meanPerFrame)) }])) : null,
      viktorAttack: rs.map(r => r.admission.viktorAttack), tracked: Object.fromEntries(track.map(([c, a]) => [`${c}:${a}`, rs.map(r => r.admission.tracked[`${c}:${a}`].total)])) }; });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ board: board.split(','), foes: foes.split(','), star: Number(star), gl: launch.gl, variants, passSync, order: order.map(o => `${o.variant}/${o.cap}/${o.budget}/d${o.degrade}#${o.round}`), summary, results }, null, 1));
  console.table(summary.map(s => ({ variant: s.variant, cap: s.cap, budget: s.budget, degrade: s.degrade, passOn: passKeys.map(k => s.passFramesOn[k]).join('/'), ...(s.passMs ? { passMs: passKeys.map(k => s.passMs[k].meanWhenOn).join('/') } : {}), mean: s.mean, meanRange: s.range.mean.join('–'), p95: s.p95, p95Range: s.range.p95.join('–'),
    over33: s.over33_3, over33Range: s.range.over33_3.join('–'), ltkMs: s.ltkMean, draws: s.drawsMean, livePeak: s.livePeak, particlePeak: s.particlePeak, budgetRefused: s.budgetRefusedRows, vkDropped: s.viktorAttack.map(v => v?.dropped).join('/'), viStarted: (s.tracked['vi:cast'] ?? []).map(v => v.started).join('/'), viCut: (s.tracked['vi:cast'] ?? []).map(v => v.gaveWay + v.evicted).join('/') })));
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
