// node dev/castcmp/v-capture-attack.cjs <unit> <outdir> [--port 5311] [--assetPort 5419] [--dist 3] [--star 3] [--ms 1500 | --times 0,33,...] [--gl gpu|swift] [--interval ms [--repeat 1]]
// Records one attack as 1920x1080 jpg frames on a virtual clock (dev/castcmp/harness.ts). Serve the repo with vite on --port and the asset root on --assetPort (assets.cjs).
const { chromium } = require('playwright');
const { launchOptions, timeline, timer } = require('./common.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const unit = args[0], out = path.resolve(args[1]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(opt('port') ?? 5301), dist = opt('dist') ?? '3', target = opt('target') ?? 'garen';
const assetPort = Number(opt('assetPort') ?? 5390);
const times = opt('times') ? opt('times').split(',').map(Number) : timeline(Number(opt('ms') ?? 1500));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const mark = timer(); const launch = launchOptions(opt);
  const browser = await chromium.launch(launch.options); mark('launched (' + launch.gl + ')');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  if (opt('only')) await page.addInitScript(id => { window.__only = id; }, opt('only'));
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?unit=${unit}&dist=${dist}&target=${target}&${opt('one') ? 'one=1&' : ''}${['form','move','outcome','star'].filter(k => opt(k)).map(k => k + '=' + opt(k) + '&').join('')}assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
  await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 120000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  mark('harness ready');
  // let models load: real time passes while the virtual clock idles
  for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(32); }); await page.waitForTimeout(250);
    const ok = await page.evaluate(() => !!window.__render3dLoad); if (ok && i > 8) break; }
  await page.evaluate(() => { window.__h.step(1500); });
  await page.waitForTimeout(1500); // effect files / textures fetch
  const isCast = !!opt('cast');
  // --interval <ms>: attack events are spaced that far apart in combat ticks (50 ms each), so the renderer's observed
  // cadence (attack speed) is 1000/interval; without it they are 5 s apart (no compression).
  // --repeat 1: keep attacking every interval during the recording, as in a real fight.
  const intervalMs = Number(opt('interval') ?? 5000), tickStep = Math.max(1, Math.round(intervalMs / 50)), repeat = !!opt('repeat');
  const triggerAction = () => page.evaluate(([asCast, step]) => {
    if (asCast) { window.__h.cast(); return; }
    const s = (window.__atkSeq = (window.__atkSeq || 10) + 1);
    window.__h.events([{ type: 'attack', tick: s * step, eventSeq: s * step, attackerId: 'me', targetId: 'foe' }]);
  }, [isCast, tickStep]);
  for (let w = 0; w < Number(opt('warm') ?? (opt('interval') ? 2 : 1)); w++) { if (w) { for (let i = 0; i < 8; i++) await page.evaluate(() => window.__h.step(250)); } await triggerAction(); }
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(80); }
  await page.evaluate(() => window.__h.step(3000)); await page.waitForTimeout(200);
  mark('warm done'); const boxes = await page.evaluate(() => ['me', 'foe', 'foe2', 'foe3', 'foe4'].map(id => window.__h.box(id)).filter(Boolean));
  const fullClip = { x: 0, y: 0, width: 1920, height: 1080 }; fs.writeFileSync(path.join(out, 'boxes.json'), JSON.stringify({ boxes, ids: ['me', 'foe', 'foe2', 'foe3', 'foe4'] }));
  await triggerAction();
  let at = 0, nextAttack = repeat ? intervalMs : Infinity;
  for (let idx = 0; idx < times.length; idx++) {
    const t = times[idx];
    while (nextAttack <= t) { await page.evaluate(ms => window.__h.step(ms), nextAttack - at); at = nextAttack; await triggerAction(); nextAttack += intervalMs; }
    await page.evaluate(ms => window.__h.step(ms), t - at); at = t;
    await page.waitForTimeout(idx <= 1 ? 300 : 40);
    const f = path.join(out, `${unit}-${String(t).padStart(4, '0')}.jpg`); await page.screenshot({ path: f, type: "jpeg", quality: 90, clip: fullClip, timeout: 180000 });
  }
  fs.writeFileSync(path.join(out, `${unit}-errors.txt`), errors.join('\n'));
  console.log('done', unit, 'errors', errors.length);
  mark('frames ' + times.length);
  // process.exit, not browser.close: closing headless Chrome on Windows/GPU stalls ~30s; Playwright kills the child on exit.
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
