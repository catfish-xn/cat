// node dev/castcmp/v-capture.cjs <unit> <outdir> [--port 5311] [--assetPort 5419] [--dist 3] [--star 3] [--ms 3000 | --times 0,33,...] [--settle MS] [--unbind 1] [--attached off] [--nfoes 1-4] [--foestar 1-3] [--gl gpu|swift]
// Records one cast as 1920x1080 jpg frames on a virtual clock (dev/castcmp/harness.ts). Serve the repo with vite on --port and the asset root on --assetPort (assets.cjs).
const { chromium } = require('playwright');
const { launchOptions, timeline, timer } = require('./common.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const unit = args[0], out = path.resolve(args[1]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(opt('port') ?? 5301), dist = opt('dist') ?? '3', target = opt('target') ?? 'garen';
const assetPort = Number(opt('assetPort') ?? 5390);
const times = opt('times') ? opt('times').split(',').map(Number) : timeline(Number(opt('ms') ?? 3000));
// LOCAL: --unbind 1 replaces the cast with Sion breaking his chains (bindingChanged bound:false), which plays Unleash
// (vfx-ltk batch3/controller.ts); the warm pass chains him again afterwards.
async function unbind(page, tick, rebind) {
  await page.evaluate(t => window.__h.events([{ type: 'bindingChanged', tick: t, eventSeq: t, unitId: 'me', bound: false, reason: 'hp-threshold' }]), tick);
  if (!rebind) return;
  for (let i = 0; i < 8; i++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(300); }
  await page.evaluate(t => window.__h.events([{ type: 'bindingChanged', tick: t, eventSeq: t, unitId: 'me', bound: true, reason: 'combat-start' }]), tick + 100);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const mark = timer(); const launch = launchOptions(opt);
  const browser = await chromium.launch(launch.options); mark('launched (' + launch.gl + ')');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  if (opt('only')) await page.addInitScript(id => { window.__only = id; }, opt('only'));
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?unit=${unit}&dist=${dist}&target=${target}&${opt('one') ? 'one=1&' : ''}${['form','move','outcome','star','real','numbers','attached','nfoes','foestar'].filter(k => opt(k)).map(k => k + '=' + opt(k) + '&').join('')}assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
  await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 120000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  mark('harness ready');
  // let models load: real time passes while the virtual clock idles
  for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(32); }); await page.waitForTimeout(250);
    const ok = await page.evaluate(() => !!window.__render3dLoad); if (ok && i > 8) break; }
  await page.evaluate(() => { window.__h.step(1500); });
  await page.waitForTimeout(1500); // effect files / textures fetch
  // warm pass: load every effect file once, then reset the combat and cast for real
  // LOCAL: --warm N casts N times first (default 1); a multiple of 3 keeps a 3-phase hero on phase 0 for the real cast
  for (let w = 0; w < Number(opt('warm') ?? 1); w++) { if (w) { for (let i = 0; i < 12; i++) await page.evaluate(() => window.__h.step(250)); } await (opt('unbind') ? unbind(page, 700000 + w * 1000, true) : page.evaluate(() => window.__h.cast())); }
  if (opt('slam')) await page.evaluate(() => window.__h.events([{ type: 'packetDamage', tick: 800000, eventSeq: 800000, sourceId: 'me', targetId: 'foe', damageType: 'magic', sourceKind: 'ability', definitionId: 'viktor-ability', delivery: 'ability-direct', amount: 10, mitigated: 10 }]));
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(700); }
  await page.evaluate(() => window.__h.step(3000)); await page.waitForTimeout(300);
  // LOCAL: --settle MS lets a lasting effect of the warm cast (Mordekaiser's 10 s aura) run out before the recorded cast.
  if (opt('settle')) { for (let left = Number(opt('settle')); left > 0; left -= 500) { await page.evaluate(ms => window.__h.step(ms), Math.min(500, left)); await page.waitForTimeout(50); } }
  mark('warm done'); const boxes = await page.evaluate(() => ['me', 'foe', 'foe2', 'foe3', 'foe4'].map(id => window.__h.box(id)).filter(Boolean));
  const L = Math.min(...boxes.map(b => b.left)), R = Math.max(...boxes.map(b => b.right)), T = Math.min(...boxes.map(b => b.top)), B = Math.max(...boxes.map(b => b.bottom));
  const cx = (L + R) / 2, cy = (T + B) / 2, half = Math.max((R - L) * 0.7, (B - T) * 0.7 * 4 / 3, 150);
  const clip = { x: Math.max(0, cx - half), y: Math.max(0, cy - half * 3 / 4), width: Math.min(960, half * 2), height: Math.min(720, half * 1.5) };
  const fullClip = { x: 0, y: 0, width: 1920, height: 1080 }; fs.writeFileSync(path.join(out, 'boxes.json'), JSON.stringify({ boxes, ids: ['me', 'foe', 'foe2', 'foe3', 'foe4'] }));
  await (opt('unbind') ? unbind(page, 900000, false) : page.evaluate(() => window.__h.cast()));
  // LOCAL: Viktor's slam lands on his own ability-direct magic packet after the cast
  if (opt('slam')) await page.evaluate(() => window.__h.events([{ type: 'packetDamage', tick: 900000, eventSeq: 900000, sourceId: 'me', targetId: 'foe', damageType: 'magic', sourceKind: 'ability', definitionId: 'viktor-ability', delivery: 'ability-direct', amount: 10, mitigated: 10 }]));
  let at = 0; const files = [];
  for (const t of times) {
    await page.evaluate(ms => window.__h.step(ms), t - at); at = t;
    await page.waitForTimeout(t === times[0] ? 400 : 40);
    const f = path.join(out, `${unit}-${String(t).padStart(4, '0')}.jpg`); await page.screenshot({ path: f, type: "jpeg", quality: 90, clip: fullClip, timeout: 180000 }); files.push([t, f]);
  }
  fs.writeFileSync(path.join(out, `${unit}-errors.txt`), errors.join('\n'));
  // The overlay counts of the recorded build (vfx-ltk runtime.ts ATTACHED_LAYER_STATS; null on builds before it).
  fs.writeFileSync(path.join(out, 'attached-stats.json'), JSON.stringify(await page.evaluate(async () => {
    const runtime = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
    const attached = await import('/src/rendering/three-mode/vfx-ltk/rendering/components/AttachedMeshes.ts').catch(() => null);
    return runtime?.ATTACHED_LAYER_STATS ? { ...JSON.parse(JSON.stringify(runtime.ATTACHED_LAYER_STATS)), cap: runtime.ATTACHED_LAYER_CAP, ...attached?.ATTACHED_STATS } : null;
  }), null, 2));
  console.log('done', unit, 'errors', errors.length);
  mark('frames ' + times.length);
  // process.exit, not browser.close: closing headless Chrome on Windows/GPU stalls ~30s; Playwright kills the child on exit.
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
