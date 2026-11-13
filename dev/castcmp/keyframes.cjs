// node dev/castcmp/keyframes.cjs --hero <name> --system <id> --before <dir> --after <dir> [--off <dir>] [--debug <dir>] --out <folder> [--prefix e138w]
//   [--from MS --to MS] pick the peak only inside this span; [--times a,b,c] use these frames instead of the peak (then
//   --before may be left out: an after-only sheet);
//   [--crop me,foe,...] crop the union of these units' boxes (default me; hit systems, whose effect sits on the target: me,foe)
//   [--note text] where --times came from, in the caption and the meta (underscores print as spaces: one shell word)
//   [--pick-diff] pick by pixel difference even when the after gate.json has a layer timeline for --system
// The peak frame: by default the frame of the after run's gate.json where --system has an attached layer on screen and
// the most layers are up; without such frames, the frame where before and after differ most inside the area.
// One recorded job's before / after / off (and optional debug) frame folders (v-capture.cjs output) to two jpgs in --out:
//   <prefix>-<hero>-<system>.jpg       the caster's area at native resolution, 3 rows (the frame where before and after
//                                       differ most inside that area, and the frames either side) x one column per folder;
//   <prefix>-<hero>-<system>-full.jpg  the whole screen of each folder at that frame, half size, 2 per row.
// Each image carries a caption from the folders' gate.json (commit, asset snapshot, machine, time, system, foe and stars)
// and is kept under 2 MB; the numbers behind the pick go to <out>/meta/<prefix>-<hero>-<system>.json. Node + sharp only (a repo dependency): no ffmpeg, no python.
const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
for (const k of ['hero', 'system', 'after', 'out', ...(opt('times') ? [] : ['before'])]) if (!opt(k)) { console.error(`--${k} required`); process.exit(2); }
const MAX_BYTES = 2 * 1024 * 1024;
const columns = ['before', 'after', 'off', 'debug'].filter(k => opt(k)).map(k => ({ key: k, dir: path.resolve(opt(k)) }));

const { frames } = require('./frames.cjs');
const gateOf = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'gate.json'), 'utf8')); } catch { return null; } };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
// A caption with CJK text (the --pin-foe / --hide-units labels) names CJK fallback fonts too; plain ASCII captions are unchanged.
const captionFont = lines => lines.some(l => /[^\x00-\x7f]/.test(l)) ? 'DejaVu Sans Mono, Consolas, Noto Sans CJK SC, Microsoft YaHei, monospace' : 'DejaVu Sans Mono, Consolas, monospace';
const caption = (w, lines) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${lines.length * 22 + 10}">
  <rect width="100%" height="100%" fill="#111"/>${lines.map((l, i) => `<text x="8" y="${22 * i + 22}" font-family="${captionFont(lines)}" font-size="16" fill="#eee">${esc(l)}</text>`).join('')}</svg>`);

async function grey(file, box) {
  return sharp(file).extract(box).greyscale().raw().toBuffer();
}
async function encode(base, name) {
  for (const quality of [88, 80, 72, 64, 56, 48]) {
    const buf = await base.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (buf.length <= MAX_BYTES) { fs.writeFileSync(name, buf); return { name, bytes: buf.length, quality }; }
  }
  throw new Error(`${name}: over 2 MB even at quality 48`);
}

(async () => {
  const sets = columns.map(c => ({ ...c, frames: frames(c.dir), gate: gateOf(c.dir) }));
  const n = Math.min(...sets.map(s => s.frames.length));
  if (!n) throw new Error('no frames');
  const meta = await sharp(sets[0].frames[0].file).metadata();
  // The area: the union of the --crop units' boxes (default the caster), from the after run's gate.json frames when it has
  // them (keyed by unit, at the first frame), else boxes.json (whose list skips missing units, so only `me`, first, is sure).
  const afterDir = columns.find(c => c.key === 'after').dir, afterGate = gateOf(afterDir);
  const ids = (opt('crop') ?? 'me').split(',');
  const keyed = afterGate?.frames?.find(f => f.boxes)?.boxes;
  const picked = keyed ? ids.map(id => keyed[id]).filter(Boolean) : [JSON.parse(fs.readFileSync(path.join(afterDir, 'boxes.json'), 'utf8')).boxes[0]];
  const me = { left: Math.min(...picked.map(b => b.left)), right: Math.max(...picked.map(b => b.right)), top: Math.min(...picked.map(b => b.top)), bottom: Math.max(...picked.map(b => b.bottom)) };
  // At least 400 px a side, at most 640 (960 wide for a union), centred on the caster and kept inside the frame.
  const side = (lo, hi, pad, limit) => { const size = Math.max(400, Math.min(ids.length > 1 ? 960 : 640, Math.ceil(hi - lo + 2 * pad))), start = Math.round((lo + hi) / 2 - size / 2);
    return [Math.max(0, Math.min(limit - size, start)), Math.min(size, limit)]; };
  const [left, width] = side(me.left, me.right, Math.max(60, (me.right - me.left) * 0.6), meta.width);
  const [top, height] = side(me.top, me.bottom, Math.max(60, (me.bottom - me.top) * 0.4), meta.height);
  const area = { left, top, width, height };
  // The frame where before and after differ most inside that area (mean absolute difference).
  const before = sets.find(s => s.key === 'before'), after = sets.find(s => s.key === 'after');
  const from = Number(opt('from') ?? -Infinity), to = Number(opt('to') ?? Infinity);
  let peak = -1, best = -1; const diffs = [];
  for (let i = 0; i < n; i++) {
    if (!before || after.frames[i].t < from || after.frames[i].t > to) { diffs.push(null); if (!before && peak < 0) peak = i; continue; }
    const [a, b] = await Promise.all([grey(before.frames[i].file, area), grey(after.frames[i].file, area)]);
    let sum = 0; for (let p = 0; p < a.length; p++) sum += Math.abs(a[p] - b[p]);
    const d = sum / a.length; diffs.push(+d.toFixed(2)); if (d > best) { best = d; peak = i; }
  }
  // Preferred pick: the after run's gate.json layer timeline. Among the frames where --system has an attached layer on
  // screen (frames[].layerSystems), the one with the most layers (frames[].layers); the pixel difference is the fallback
  // (systems without layers, builds without ATTACHED_LAYER_STATS, hit systems whose effect sits on the target).
  let pickedBy = 'pixel-diff';
  const timeline = (afterGate?.frames ?? []).filter(f => f.t >= from && f.t <= to && (f.layerSystems ?? []).includes(opt('system')));
  if (timeline.length && !opt('pick-diff')) {
    const top = timeline.reduce((w, f) => (f.layers ?? 0) > (w.layers ?? 0) ? f : w);
    const i = after.frames.findIndex(f => f.t === top.t);
    if (i >= 0 && i < n) { peak = i; pickedBy = `layers (${top.layers} at ${top.t}ms; ${timeline.length} frames with ${opt('system')} on screen)`; }
  }
  if (peak < 0) throw new Error('no frame inside --from/--to');
  const fixed = opt('times') ? opt('times').split(',').map(Number).map(t => after.frames.findIndex(f => f.t >= t)).filter(i => i >= 0 && i < n) : null;
  const rows = fixed?.length ? fixed : [peak - 1, peak, peak + 1].filter(i => i >= 0 && i < n);
  if (fixed?.length) peak = fixed[Math.floor(fixed.length / 2)];
  // Overhead bar against the body (--probe overhead runs): drift from the standing pose at t=0 (gate.cjs overheadDrift),
  // dx and dy per frame, before and after. The pick and the caption use |ddx|; the meta has both.
  const { overheadDrift } = require('./gate.cjs');
  const drift = dir => { try { return overheadDrift(JSON.parse(fs.readFileSync(path.join(dir, 'overhead.json'), 'utf8'))); } catch { return null; } };
  const ohOf = dir => { const d = drift(dir); return d ? Object.fromEntries(d.points.map(o => [o.t, o.ddx])) : null; };
  const dyOf = dir => { const d = drift(dir); return d ? Object.fromEntries(d.points.map(o => [o.t, o.ddy])) : null; };
  const ohBefore = before ? ohOf(before.dir) : null, ohAfter = ohOf(after.dir);
  const ohAt = (oh, t) => oh && Number.isFinite(oh[t]) ? Math.abs(oh[t]).toFixed(0) : '?';
  const ohMax = oh => { let m = null; for (const f of after.frames) if (f.t >= from && f.t <= to && oh && Number.isFinite(oh[f.t]) && (m === null || Math.abs(oh[f.t]) > m.dx)) m = { t: f.t, dx: Math.abs(oh[f.t]) }; return m; };
  const dyBefore = before ? dyOf(before.dir) : null, dyAfter = dyOf(after.dir);
  const overhead = ohBefore || ohAfter ? { measure: 'drift from t=0 (ddx; ddy alongside)', before: ohMax(ohBefore), after: ohMax(ohAfter), dyBefore: ohMax(dyBefore), dyAfter: ohMax(dyAfter),
    baseline: { before: before ? drift(before.dir)?.baseline ?? null : null, after: drift(after.dir)?.baseline ?? null } } : null;
  const g = after.gate ?? {};
  const commit = c => (c.gate?.checkout?.head ?? '?').slice(0, 8);
  const head = [
    `${opt('hero')}  system ${opt('system')}  t=${rows.map(i => after.frames[i].t).join('/')}ms (peak ${after.frames[peak].t}ms by ${fixed?.length ? 'times' : pickedBy.split(' ')[0]}, mean |before-after| ${best.toFixed(1)})`,
    ...(opt('note') ? [`times: ${opt('note').replace(/_/g, ' ')}`] : []),
    `${sets.map(s => `${s.key}:${commit(s)}`).join('  ')}  assets ${g.snapshot ?? '?'}  ${g.machine ?? '?'} ${g.gl ?? ''}`,
    ...(overhead ? [`overhead drift from t=0 max |dx| / |dy|: before ${overhead.before?.dx ?? '?'}px@${overhead.before?.t ?? '?'}ms / ${overhead.dyBefore?.dx ?? '?'}px  after ${overhead.after?.dx ?? '?'}px@${overhead.after?.t ?? '?'}ms / ${overhead.dyAfter?.dx ?? '?'}px`] : []),
    `vs ${g.foe ? `${g.foe.n}x ${g.foe.model} ${g.foe.star}*` : '?'}  caster ${g.star ?? '?'}*  dist ${g.dist ?? '?'}  ${g.real ? 'real combat' : g.pinFoe ? `pinned dummy ${g.pinFoe} hex${g.pinFoe2 ? ` + ${g.pinFoe2} hex in line` : ''} (假人, not real combat)` : 'dummies (not real combat)'}${g.hideUnits ? '  units hidden (单位已隐藏)' : ''}  gate ${sets.map(s => `${s.key}:${s.gate ? (s.gate.ok ? 'pass' : 'FAIL') : 'none'}`).join(' ')}`,
  ];
  const out = path.resolve(opt('out')); fs.mkdirSync(out, { recursive: true });
  const base = `${opt('prefix') ?? 'e138w'}-${opt('hero')}-${opt('system')}`;
  const label = (w, text) => ({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24"><rect width="100%" height="100%" fill="#000" fill-opacity="0.6"/><text x="6" y="18" font-family="DejaVu Sans Mono, Consolas, monospace" font-size="15" fill="#fff">${esc(text)}</text></svg>`) });

  // 1) Crops: rows x columns at native resolution.
  const capH = head.length * 22 + 10, W = Math.max(area.width * sets.length, 1280), H = capH + area.height * rows.length;
  const tiles = [{ input: caption(W, head), left: 0, top: 0 }];
  for (const [r, i] of rows.entries()) for (const [c, s] of sets.entries()) {
    tiles.push({ input: await sharp(s.frames[i].file).extract(area).toBuffer(), left: c * area.width, top: capH + r * area.height });
    const oh = s.key === 'before' ? ohBefore : s.key === 'after' ? ohAfter : null, dy = s.key === 'before' ? dyBefore : s.key === 'after' ? dyAfter : null;
    tiles.push({ ...label(area.width, `${s.key} ${s.frames[i].t}ms${oh ? ` drift dx ${ohAt(oh, s.frames[i].t)} dy ${ohAt(dy, s.frames[i].t)}px` : ''}`), left: c * area.width, top: capH + r * area.height });
  }
  const crop = await encode(sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(tiles), path.join(out, base + '.jpg'));
  // 2) Whole screen at the peak frame, half size, two per row.
  const hw = Math.round(meta.width / 2), hh = Math.round(meta.height / 2), per = 2, fr = Math.ceil(sets.length / per);
  const full = [{ input: caption(hw * per, head), left: 0, top: 0 }];
  for (const [c, s] of sets.entries()) {
    const x = (c % per) * hw, y = capH + Math.floor(c / per) * hh;
    full.push({ input: await sharp(s.frames[peak].file).resize(hw, hh).toBuffer(), left: x, top: y }, { ...label(hw, `${s.key} ${s.frames[peak].t}ms`), left: x, top: y });
  }
  const whole = await encode(sharp({ create: { width: hw * per, height: capH + hh * fr, channels: 3, background: '#000' } }).composite(full), path.join(out, base + '-full.jpg'));
  fs.mkdirSync(path.join(out, 'meta'), { recursive: true });
  fs.writeFileSync(path.join(out, 'meta', base + '.json'), JSON.stringify({ hero: opt('hero'), system: opt('system'), area, crop: ids, window: [opt('from') ?? null, opt('to') ?? null], overhead, peak: after.frames[peak].t, pickedBy: fixed?.length ? `--times${opt('note') ? ': ' + opt('note').replace(/_/g, ' ') : ''}` : pickedBy, rows: rows.map(i => after.frames[i].t), diffs, crop, whole, columns: sets.map(s => ({ key: s.key, dir: s.dir, gate: s.gate ? { ok: s.gate.ok, head: s.gate.checkout?.head } : null })) }, null, 2));
  console.log(JSON.stringify({ crop: crop.name, cropBytes: crop.bytes, full: whole.name, fullBytes: whole.bytes, peakMs: after.frames[peak].t }));
})().catch(e => { console.error(e); process.exit(1); });
