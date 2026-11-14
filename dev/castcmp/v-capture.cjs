// node dev/castcmp/v-capture.cjs <unit> <outdir> [--port 5311] [--assetPort 5419] [--dist 3] [--star 3] [--ms 3000 | --times 0,33,...] [--settle MS] [--fresh 1] [--cold 1] [--unbind 1] [--attached off|debug] [--nfoes 1-4] [--foestar 1-3] [--gl gpu|swift]
//   [--systems id,id|none --absent id,id --layers id,id|none --from MS --to MS --column before|after|off|debug --snapshot <asset snapshot>]:
//     self-check (gate.cjs), written to gate.json; a failed gate exits 1
//   [--probe overhead]: the caster's overhead bar and body on screen per frame, to overhead.json (and gate.json)
//   [--kill foe,foe2 --killlead MS]: dummies only; these drop dead (still drawn) MS before the recorded action
//   [--gone foe,foe2 --gonelead MS]: dummies only; these leave the board (their units removed) MS before the recorded action
//   [--foe-offset K] on dummies: the dummies K columns to the side (the target ahead and to the side; --nfoes 1 past ±1)
//   [--hide-units 1]: unit models are not drawn (bars, stars, shadows and effects are); every frame and the keyframes caption say so
//   [--pin-foe N]: dummies only; one dummy N hexes straight ahead of the caster (overrides --dist/--nfoes; casts target it), labelled 'pinned dummy'
//   [--cast-index N] [--from-start 1 | --lead-ms MS]: --real only; one window choice (real-combat.ts leadTicksFor): the anchor
//     cast is the N-th cast of the unit (default 1st); the recorded window starts at combat start / MS before the anchor
//     (default: 500 ms before it). --times must start at 0 for --real (jobs-check.mjs fails it otherwise).
//   [--ally X --allystar N]: --real only; one front-liner of the caster's team a row ahead of it (default star 2).
//   [--ally-cell R,C] [--foe-cell R,C] [--foe2 X --foe2star N --foe2-cell R,C]: --real only; the ally / the target / the second
//     foe on these cells (the caster stands on 5,3; rows 0-7, columns 0-6), the second foe another hero of its own star (needs
//     --nfoes 2 or more): e.g. a tank ahead and one column aside, off the caster's line, and a melee foe far off for it to fight.
//   [--only SYSTEM] [--mute E,..] [--solo E,..] [--nocolor E,..] [--noerode E,..]: draw one system alone, leave emitters
//     out, draw emitters alone, take their colour writes out (stencil/depth stay), or their erosion out (probes.ts DrawFilter;
//     E is an emitter name or system:emitter).
//   [--foe-offset K]: --real only; every foe K columns to the side (+ right; all must stay on columns 0-6), so the target
//     stands ahead and to the side of the caster (e.g. a beam crossing the screen instead of foreshortened straight ahead)
//   [--pin-foe2 M]: with --pin-foe N (M > N, at most 5): a second still dummy on the line from the caster through the first, about M hexes out
// Records one cast as 1920x1080 jpg frames on a virtual clock (dev/castcmp/harness.ts). Serve the repo with vite on --port and the asset root on --assetPort (assets.cjs).
const { chromium } = require('playwright');
const { launchOptions, timeline, timer, formProblem } = require('./common.cjs');
const gate = require('./gate.cjs');
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2); const unit = args[0], out = path.resolve(args[1]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
{ const why = formProblem(opt('form')); if (why) throw new Error(why); }
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
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/index.html?unit=${unit}&dist=${dist}&target=${target}&${opt('one') ? 'one=1&' : ''}${['form','move','outcome','star','real','numbers','attached','nfoes','foestar','ally','allystar','mute','solo','nocolor','noerode'].filter(k => opt(k)).map(k => k + '=' + opt(k) + '&').join('')}${opt('hide-units') === '1' ? 'hideunits=1&debug3d=1&' : (opt('probe') ?? '').includes('emitters') ? 'debug3d=1&' : ''}${opt('pin-foe') ? `pinfoe=${opt('pin-foe')}&` : ''}${opt('pin-foe2') ? `pinfoe2=${opt('pin-foe2')}&` : ''}${opt('from-start') === '1' ? 'fromstart=1&' : ''}${opt('lead-ms') !== undefined ? `leadms=${opt('lead-ms')}&` : ''}${opt('cast-index') !== undefined ? `castindex=${opt('cast-index')}&` : ''}${opt('foe-offset') !== undefined ? `foeoffset=${opt('foe-offset')}&` : ''}${[['ally-cell', 'allycell'], ['foe-cell', 'foecell'], ['foe2', 'foe2'], ['foe2star', 'foe2star'], ['foe2-cell', 'foe2cell']].filter(([k]) => opt(k) !== undefined).map(([k, q]) => `${q}=${opt(k)}&`).join('')}window=${times[times.length - 1]}&assets=${encodeURIComponent(`http://127.0.0.1:${assetPort}/`)}`);
  await page.waitForFunction(() => window.__h || window.__err, null, { timeout: 120000, polling: 500 });
  const err = await page.evaluate(() => window.__err); if (err) throw new Error(err);
  // --real 1 must replay a combat that went through combat start (harness.ts startRealCombat); refuse to record otherwise.
  if (opt('real') && !(await page.evaluate(() => window.__h.real?.combatStart))) throw new Error('real combat without combat start: refusing to record');
  mark('harness ready');
  // LOCAL: --cold 1 (real only) records the unit's first cast cold: the replay is held short of the cast's lead-in while
  // the page loads, no warm cast is made (--warm is taken as 0), and fresh() then plays from the lead-in. Without it the
  // loading steps alone replay the cast, so even --warm 0 recorded a warm second cast.
  const cold = !!opt('cold');
  if (cold && !opt('real')) throw new Error('--cold is for --real only: a dummy casts only when told to (use --warm 0)');
  if (cold) { const h = await page.evaluate(() => window.__h.hold()); mark(`cold: held at tick ${h.at} of ${h.limit}`); }
  if (opt('kill') && opt('real')) throw new Error('--kill is for dummies only: a real combat decides who dies');
  if (opt('pin-foe') && opt('real')) throw new Error('--pin-foe is for dummies only: a real combat moves the foes and they hit back');
  if (opt('pin-foe') && opt('nfoes') && Number(opt('nfoes')) !== 1) throw new Error('--pin-foe places exactly one dummy: drop --nfoes');
  const customStart = opt('from-start') === '1' || opt('lead-ms') !== undefined || opt('cast-index') !== undefined;
  if (customStart && !opt('real')) throw new Error('--from-start / --lead-ms / --cast-index are for --real only: a dummy cast has no combat before it');
  if (['ally', 'ally-cell', 'foe-cell', 'foe2', 'foe2star', 'foe2-cell'].some(k => opt(k) !== undefined) && !opt('real')) throw new Error('--ally / --ally-cell / --foe-cell / --foe2 / --foe2star / --foe2-cell are for --real only');
  if (opt('foe-offset') !== undefined && !opt('real')) throw new Error('--foe-offset is for --real only (dummies: use --pin-foe / --dist)');
  if (opt('foe-offset') !== undefined && !/^-?[0-9]+$/.test(opt('foe-offset'))) throw new Error(`--foe-offset must be a whole number of columns, got ${opt('foe-offset')}`);
  if (opt('cast-index') !== undefined && !/^[1-9][0-9]*$/.test(opt('cast-index'))) throw new Error(`--cast-index must be 1, 2, ..., got ${opt('cast-index')}`);
  if (opt('from-start') === '1' && opt('lead-ms') !== undefined) throw new Error('--from-start and --lead-ms: give one');
  if (opt('lead-ms') !== undefined && !(Number(opt('lead-ms')) >= 0)) throw new Error(`--lead-ms must be a number of ms >= 0, got ${opt('lead-ms')}`);
  // Where the (anchor) cast falls on the recorded clock: 500 ms in by default; with an asked-for window, (cast - start) ticks of 50 ms.
  const actionAtMs = !opt('real') ? 0 : customStart ? await page.evaluate(() => (window.__h.real.castTick - window.__h.real.startTick) * 50) : 500;
  const g = gate.createGate(opt, { page, repo: path.resolve(__dirname, '../..'), unit, real: !!opt('real'), times, actionAtMs });
  await g.start();
  // let models load: real time passes while the virtual clock idles
  for (let i = 0; i < 60; i++) { await page.evaluate(() => { window.__h.frame(); window.__h.step(32); }); await page.waitForTimeout(250);
    const ok = await page.evaluate(() => !!window.__render3dLoad); if (ok && i > 8) break; }
  await page.evaluate(() => { window.__h.step(1500); });
  await page.waitForTimeout(1500); // effect files / textures fetch
  // warm pass: load every effect file once, then reset the combat and cast for real
  // LOCAL: --warm N casts N times first (default 1); a multiple of 3 keeps a 3-phase hero on phase 0 for the real cast
  for (let w = 0; w < (cold ? 0 : Number(opt('warm') ?? 1)); w++) { if (w) { for (let i = 0; i < 12; i++) await page.evaluate(() => window.__h.step(250)); } await (opt('unbind') ? unbind(page, 700000 + w * 1000, true) : page.evaluate(() => window.__h.cast())); }
  if (opt('slam')) await page.evaluate(() => window.__h.events([{ type: 'packetDamage', tick: 800000, eventSeq: 800000, sourceId: 'me', targetId: 'foe', damageType: 'magic', sourceKind: 'ability', definitionId: 'viktor-ability', delivery: 'ability-direct', amount: 10, mitigated: 10 }]));
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__h.step(250)); await page.waitForTimeout(700); }
  await page.evaluate(() => window.__h.step(3000)); await page.waitForTimeout(300);
  // LOCAL: --settle MS lets a lasting effect of the warm cast (Mordekaiser's 10 s aura) run out before the recorded cast.
  if (opt('settle')) { for (let left = Number(opt('settle')); left > 0; left -= 500) { await page.evaluate(ms => window.__h.step(ms), Math.min(500, left)); await page.waitForTimeout(50); } }
  // A fresh combat before the recorded cast (harness fresh(): what the warm pass left is cleared and cast counts restart,
  // as a game combat starts): always for --real, with --fresh 1 for dummies. Loaded effect files stay loaded.
  if (opt('real') || opt('fresh')) { await page.evaluate(() => window.__h.fresh()); await page.waitForTimeout(200); }
  mark('warm done'); const boxes = await page.evaluate(() => ['me', 'foe', 'foe2', 'foe3', 'foe4'].map(id => window.__h.box(id)).filter(Boolean));
  const L = Math.min(...boxes.map(b => b.left)), R = Math.max(...boxes.map(b => b.right)), T = Math.min(...boxes.map(b => b.top)), B = Math.max(...boxes.map(b => b.bottom));
  const cx = (L + R) / 2, cy = (T + B) / 2, half = Math.max((R - L) * 0.7, (B - T) * 0.7 * 4 / 3, 150);
  const clip = { x: Math.max(0, cx - half), y: Math.max(0, cy - half * 3 / 4), width: Math.min(960, half * 2), height: Math.min(720, half * 1.5) };
  const fullClip = { x: 0, y: 0, width: 1920, height: 1080 }; fs.writeFileSync(path.join(out, 'boxes.json'), JSON.stringify({ boxes, ids: ['me', 'foe', 'foe2', 'foe3', 'foe4'] }));
  // The overlay counts below cover the recorded window only: peaks and counters the warm pass left are cleared here.
  await page.evaluate(async () => {
    const runtime = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
    const attached = await import('/src/rendering/three-mode/vfx-ltk/rendering/components/AttachedMeshes.ts').catch(() => null);
    const s = runtime?.ATTACHED_LAYER_STATS;
    if (s) Object.assign(s, { layers: 0, draws: 0, peakDraws: 0, peakLayers: 0, peakSystems: {}, capEvents: 0, cappedFrames: 0 });
    attached?.resetAttachedStats?.();
  });
  // What runs just before the recorded cast: anything already there is left over from the warm pass.
  await g.pre();
  // --kill: these dummies drop dead (alive false, still drawn) --killlead ms before the cast.
  if (opt('kill')) { await page.evaluate(ids => window.__h.kill(ids), opt('kill').split(',')); await page.evaluate(ms => window.__h.step(ms), Number(opt('killlead') ?? 500)); }
  // --gone: these dummies leave the board (their units removed) --gonelead ms before the action.
  if (opt('gone')) { if (opt('real')) throw new Error('--gone is for dummies only'); await page.evaluate(ids => window.__h.gone(ids), opt('gone').split(',')); await page.evaluate(ms => window.__h.step(ms), Number(opt('gonelead') ?? 500)); }
  await (opt('unbind') ? unbind(page, 900000, false) : page.evaluate(() => window.__h.cast()));
  // LOCAL: Viktor's slam lands on his own ability-direct magic packet after the cast
  if (opt('slam')) await page.evaluate(() => window.__h.events([{ type: 'packetDamage', tick: 900000, eventSeq: 900000, sourceId: 'me', targetId: 'foe', damageType: 'magic', sourceKind: 'ability', definitionId: 'viktor-ability', delivery: 'ability-direct', amount: 10, mitigated: 10 }]));
  let at = 0; const files = [];
  for (const t of times) {
    await g.beforeStep();
    await page.evaluate(ms => window.__h.step(ms), t - at); at = t;
    await g.frame(t);
    await page.waitForTimeout(t === times[0] ? 400 : 40);
    const f = path.join(out, `${unit}-${String(t).padStart(4, '0')}.jpg`); await page.screenshot({ path: f, type: "jpeg", quality: 90, clip: fullClip, timeout: 180000 }); files.push([t, f]);
  }
  // Which in-repo cue overrides the page applied / skipped (vfx-ltk cue-overrides.ts, dev builds): proof a code-side cue fix played.
  fs.writeFileSync(path.join(out, 'cue-overrides.json'), JSON.stringify(await page.evaluate(() => globalThis.__vfxCueOverrides ?? null)));
  fs.writeFileSync(path.join(out, `${unit}-errors.txt`), errors.join('\n'));
  // The overlay counts of the recorded window (vfx-ltk runtime.ts ATTACHED_LAYER_STATS, cleared before the recorded cast; null on builds before it).
  fs.writeFileSync(path.join(out, 'attached-stats.json'), JSON.stringify(await page.evaluate(async () => {
    const runtime = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
    const attached = await import('/src/rendering/three-mode/vfx-ltk/rendering/components/AttachedMeshes.ts').catch(() => null);
    return runtime?.ATTACHED_LAYER_STATS ? { ...JSON.parse(JSON.stringify(runtime.ATTACHED_LAYER_STATS)), cap: runtime.ATTACHED_LAYER_CAP, ...attached?.ATTACHED_STATS } : null;
  }), null, 2));
  const passed = await g.finish({ out, meta: { gl: launch.gl, foe: { model: target, n: opt('pin-foe') ? (opt('pin-foe2') ? 2 : 1) : Number(opt('nfoes') ?? 4), star: Number(opt('foestar') ?? 1) },
    star: Number(opt('star') ?? 3), dist: Number(opt('pin-foe') ?? dist), ms: times[times.length - 1], real: !!opt('real'), kill: opt('kill') ?? null, ...(opt('gone') ? { gone: opt('gone') } : {}), ...(opt('pin-foe') ? { pinFoe: Number(opt('pin-foe')) } : {}), ...(opt('pin-foe2') ? { pinFoe2: Number(opt('pin-foe2')) } : {}), ...(opt('hide-units') === '1' ? { hideUnits: true } : {}), ...(opt('foe-offset') !== undefined ? { foeOffset: Number(opt('foe-offset')) } : {}), ...(customStart ? { window: { anchorCast: Number(opt('cast-index') ?? 1), start: opt('from-start') === '1' ? 'combat start' : `${opt('lead-ms') ?? 500} ms before the anchor cast` } } : {}), args: args.slice(2), errors: errors.length } });
  if (!passed) process.exit(1);
  console.log('done', unit, 'errors', errors.length);
  mark('frames ' + times.length);
  // process.exit, not browser.close: closing headless Chrome on Windows/GPU stalls ~30s; Playwright kills the child on exit.
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
