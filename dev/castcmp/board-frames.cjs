// node dev/castcmp/board-frames.cjs <outdir> --board a,b,... --foes c,d,... [--star 2] [--cap 12] [--budget 1500] [--degrade 4|8|off]
//   --systems id,id,... [--every 3] [--max 12] [--pad 2.2] [--port 5311] [--assetPort 5419] [--gl gpu|swift]
// REC BRANCH ONLY. One real combat (up to 10 against 10) on the 3D renderer at 1/60 s frames, with the LTK system cap,
// shared budget and pass-degrade threshold set by URL. Every --every-th frame on which one of --systems is running is saved
// as <outdir>/<system>/f<frame>.jpg (at most --max per system), with frames.json: per saved frame its time, the systems
// running and how many, and which optional passes (early/late/soft) that frame drew. The replay is deterministic, so two
// runs that differ only in --degrade save the same frame numbers: board-sheet.cjs puts them side by side.
const { chromium } = require('playwright');
const { launchOptions, timer } = require('./common.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const out = path.resolve(args[0]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(opt('port') ?? 5311), assetPort = Number(opt('assetPort') ?? 5419);
const board = opt('board'), foes = opt('foes') ?? board, star = opt('star') ?? '2';
const cap = opt('cap') ?? '12', budget = opt('budget') ?? '1500', degrade = opt('degrade') ?? '4';
const systems = (opt('systems') ?? '').split(',').filter(Boolean), every = Number(opt('every') ?? 3), max = Number(opt('max') ?? 12), pad = Number(opt('pad') ?? 2.2);
if (!board || !systems.length) throw Error('--board and --systems required');
(async () => {
  const mark = timer(); const launch = launchOptions(opt);
  const browser = await chromium.launch(launch.options);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?board=${board}&foes=${foes}&star=${star}&ltkcap=${cap}&fxbudget=${budget}&degrade=${degrade}&assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
  await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 300000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  const info = await page.evaluate(() => window.__h.board);
  for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(1000 / 30); }); await page.waitForTimeout(250);
    if (i > 8 && await page.evaluate(() => !!window.__render3dLoad)) break; }
  const seconds = Math.ceil(info.ticks * 50 / 1000) + 2;
  await page.evaluate(() => window.__h.reset());
  for (let s = 0; s < seconds * 4; s++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(60); }
  await page.evaluate(() => window.__h.reset()); await page.evaluate(() => window.__h.step(1000 / 60));
  const saved = {}, log = []; for (const s of systems) { saved[s] = 0; fs.mkdirSync(path.join(out, s), { recursive: true }); }
  const n = Math.round(seconds * 60);
  for (let f = 1; f <= n; f++) {
    const now = await page.evaluate(() => { const before = { ...(globalThis.__LTK_PASSES_ON ?? { early: 0, late: 0, soft: 0 }) }; globalThis.__LTK_SYSTEMS_NOW = [];
      window.__h.step(1000 / 60); const after = globalThis.__LTK_PASSES_ON ?? { early: 0, late: 0, soft: 0 };
      const running = globalThis.__LTK_SYSTEMS_NOW ?? [], ids = [...new Set(running.flatMap(r => [r.source, r.target]).filter(Boolean))];
      return { running, boxes: Object.fromEntries(ids.map(id => [id, window.__h.box?.(id) ?? null])), passes: { early: after.early > before.early, late: after.late > before.late, soft: after.soft > before.soft } }; });
    const hits = systems.filter(s => now.running.some(r => r.system === s) && saved[s] < max);
    if (!hits.length || f % every) continue;
    const shot = await page.screenshot({ type: 'jpeg', quality: 90 });
    for (const s of hits) { fs.writeFileSync(path.join(out, s, `f${String(f).padStart(4, '0')}.jpg`), shot); saved[s]++; }
    // Per system: the screen box around its runs' casters and targets, grown by --pad and widened to 16:9 (board-sheet crops to it).
    const crop = Object.fromEntries(hits.map(s => { const bs = now.running.filter(r => r.system === s).flatMap(r => [r.source, r.target]).map(id => id && now.boxes[id]).filter(Boolean);
      if (!bs.length) return [s, null];
      const l = Math.min(...bs.map(b => b.left)), t = Math.min(...bs.map(b => b.top)), r = Math.max(...bs.map(b => b.right)), b = Math.max(...bs.map(b => b.bottom));
      let w = (r - l) * pad, h = (b - t) * pad; if (w / h < 16 / 9) w = h * 16 / 9; else h = w * 9 / 16; w = Math.min(1920, Math.max(480, w)); h = Math.min(1080, Math.max(270, h));
      const x = Math.min(1920 - w, Math.max(0, (l + r) / 2 - w / 2)), y = Math.min(1080 - h, Math.max(0, (t + b) / 2 - h / 2));
      return [s, [Math.round(x), Math.round(y), Math.round(w), Math.round(h)]]; }));
    log.push({ frame: f, ms: Math.round(f * 1000 / 60), systems: hits, live: now.running.length, running: now.running, boxes: now.boxes, crop, passes: now.passes });
  }
  fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify({ board: board.split(','), foes: foes.split(','), star: Number(star), cap: Number(cap), budget: Number(budget), degrade, gl: launch.gl, combat: info, saved, frames: log, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
  mark(`saved ${JSON.stringify(saved)}`); await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
