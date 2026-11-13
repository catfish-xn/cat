// node dev/castcmp/v-capture-attack.cjs <unit> <outdir> [--port 5311] [--assetPort 5419] [--dist 3] [--star 3] [--ms 1500 | --times 0,33,...] [--gl gpu|swift]
//   [--systems/--absent/--layers/--from/--to/--column/--snapshot, --probe overhead, --kill/--killlead, --hide-units, --pin-foe N]: as v-capture.cjs
// Records one attack as 1920x1080 jpg frames on a virtual clock (dev/castcmp/harness.ts). Serve the repo with vite on --port and the asset root on --assetPort (assets.cjs).
const { chromium } = require('playwright');
const { launchOptions, timeline, timer } = require('./common.cjs');
const gate = require('./gate.cjs');
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
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?unit=${unit}&dist=${dist}&target=${target}&${opt('one') ? 'one=1&' : ''}${['form','move','outcome','star','real','numbers','attached','nfoes','foestar','ally','allystar'].filter(k => opt(k)).map(k => k + '=' + opt(k) + '&').join('')}${opt('hide-units') === '1' ? 'hideunits=1&debug3d=1&' : (opt('probe') ?? '').includes('emitters') ? 'debug3d=1&' : ''}${opt('pin-foe') ? `pinfoe=${opt('pin-foe')}&` : ''}${opt('pin-foe2') ? `pinfoe2=${opt('pin-foe2')}&` : ''}assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
  await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 120000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  mark('harness ready');
  if (opt('real')) throw new Error('v-capture-attack records on dummies only');
  if (opt('pin-foe') && opt('nfoes') && Number(opt('nfoes')) !== 1) throw new Error('--pin-foe places exactly one dummy: drop --nfoes');
  const g = gate.createGate(opt, { page, repo: path.resolve(__dirname, '../..'), unit, real: false, times, actionAtMs: 0 });
  await g.start();
  // let models load: real time passes while the virtual clock idles
  for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(32); }); await page.waitForTimeout(250);
    const ok = await page.evaluate(() => !!window.__render3dLoad); if (ok && i > 8) break; }
  await page.evaluate(() => { window.__h.step(1500); });
  await page.waitForTimeout(1500); // effect files / textures fetch
  const isCast = !!opt('cast');
  const triggerAction = () => page.evaluate((asCast) => {
    if (asCast) { window.__h.cast(); return; }
    const s = (window.__atkSeq = (window.__atkSeq || 10) + 1);
    if (window.__h.attack) window.__h.attack();
    else window.__h.events([{ type: 'attack', tick: s * 100, eventSeq: s * 100, attackerId: 'me', targetId: 'foe' }]);
  }, isCast);
  for (let w = 0; w < Number(opt('warm') ?? 1); w++) { if (w) { for (let i = 0; i < 8; i++) await page.evaluate(() => window.__h.step(250)); } await triggerAction(); }
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(80); }
  await page.evaluate(() => window.__h.step(3000)); await page.waitForTimeout(200);
  mark('warm done'); const boxes = await page.evaluate(() => ['me', 'foe', 'foe2', 'foe3', 'foe4'].map(id => window.__h.box(id)).filter(Boolean));
  const fullClip = { x: 0, y: 0, width: 1920, height: 1080 }; fs.writeFileSync(path.join(out, 'boxes.json'), JSON.stringify({ boxes, ids: ['me', 'foe', 'foe2', 'foe3', 'foe4'] }));
  // What runs just before the recorded attack: anything already there is left over from the warm pass.
  await g.pre();
  if (opt('kill')) { await page.evaluate(ids => window.__h.kill(ids), opt('kill').split(',')); await page.evaluate(ms => window.__h.step(ms), Number(opt('killlead') ?? 500)); }
  await triggerAction();
  let at = 0;
  for (let idx = 0; idx < times.length; idx++) {
    const t = times[idx];
    await g.beforeStep();
    await page.evaluate(ms => window.__h.step(ms), t - at); at = t;
    await g.frame(t);
    await page.waitForTimeout(idx <= 1 ? 300 : 40);
    const f = path.join(out, `${unit}-${String(t).padStart(4, '0')}.jpg`); await page.screenshot({ path: f, type: "jpeg", quality: 90, clip: fullClip, timeout: 180000 });
  }
  // Which in-repo cue overrides the page applied / skipped (vfx-ltk cue-overrides.ts, dev builds): proof a code-side cue fix played.
  fs.writeFileSync(path.join(out, 'cue-overrides.json'), JSON.stringify(await page.evaluate(() => globalThis.__vfxCueOverrides ?? null)));
  fs.writeFileSync(path.join(out, `${unit}-errors.txt`), errors.join('\n'));
  const passed = await g.finish({ out, meta: { gl: launch.gl, foe: { model: target, n: opt('pin-foe') ? (opt('pin-foe2') ? 2 : 1) : Number(opt('nfoes') ?? 4), star: Number(opt('foestar') ?? 1) },
    star: Number(opt('star') ?? 3), dist: Number(opt('pin-foe') ?? dist), ms: times[times.length - 1], real: false, kill: opt('kill') ?? null, ...(opt('pin-foe') ? { pinFoe: Number(opt('pin-foe')) } : {}), ...(opt('pin-foe2') ? { pinFoe2: Number(opt('pin-foe2')) } : {}), ...(opt('hide-units') === '1' ? { hideUnits: true } : {}), action: opt('cast') ? 'cast' : 'attack', args: args.slice(2), errors: errors.length } });
  if (!passed) process.exit(1);
  console.log('done', unit, 'errors', errors.length);
  mark('frames ' + times.length);
  // process.exit, not browser.close: closing headless Chrome on Windows/GPU stalls ~30s; Playwright kills the child on exit.
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
