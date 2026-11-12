// node dev/castcmp/keyframes.cjs --hero <name> --system <id> --before <dir> --after <dir> --off <dir> [--debug <dir>] --out <folder> [--prefix e138w]
// One recorded job's before / after / off (and optional debug) frame folders (v-capture.cjs output) to two jpgs in --out:
//   <prefix>-<hero>-<system>.jpg       the caster's area at native resolution, 3 rows (the frame where before and after
//                                       differ most inside that area, and the frames either side) x one column per folder;
//   <prefix>-<hero>-<system>-full.jpg  the whole screen of each folder at that frame, half size, 2 per row.
// Each image carries a caption from the folders' gate.json (commit, asset snapshot, machine, time, system, foe and stars)
// and is kept under 2 MB; the numbers behind the pick go to <out>/meta/<prefix>-<hero>-<system>.json. Node + sharp only (a repo dependency): no ffmpeg, no python.
const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
for (const k of ['hero', 'system', 'before', 'after', 'off', 'out']) if (!opt(k)) { console.error(`--${k} required`); process.exit(2); }
const MAX_BYTES = 2 * 1024 * 1024;
const columns = ['before', 'after', 'off', 'debug'].filter(k => opt(k)).map(k => ({ key: k, dir: path.resolve(opt(k)) }));

const frames = dir => fs.readdirSync(dir).filter(f => /-\d{4}\.jpg$/.test(f)).sort().map(f => ({ t: Number(f.match(/-(\d{4})\.jpg$/)[1]), file: path.join(dir, f) }));
const gateOf = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'gate.json'), 'utf8')); } catch { return null; } };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const caption = (w, lines) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${lines.length * 22 + 10}">
  <rect width="100%" height="100%" fill="#111"/>${lines.map((l, i) => `<text x="8" y="${22 * i + 22}" font-family="DejaVu Sans Mono, Consolas, monospace" font-size="16" fill="#eee">${esc(l)}</text>`).join('')}</svg>`);

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
  // The caster's area: `me`'s box from the after run's boxes.json, padded, inside the frame.
  const boxes = JSON.parse(fs.readFileSync(path.join(columns.find(c => c.key === 'after').dir, 'boxes.json'), 'utf8'));
  const me = boxes.boxes[boxes.ids.indexOf('me')] ?? boxes.boxes[0];
  // At least 400 px a side, at most 640, centred on the caster and kept inside the frame.
  const side = (lo, hi, pad, limit) => { const size = Math.max(400, Math.min(640, Math.ceil(hi - lo + 2 * pad))), start = Math.round((lo + hi) / 2 - size / 2);
    return [Math.max(0, Math.min(limit - size, start)), Math.min(size, limit)]; };
  const [left, width] = side(me.left, me.right, Math.max(60, (me.right - me.left) * 0.6), meta.width);
  const [top, height] = side(me.top, me.bottom, Math.max(60, (me.bottom - me.top) * 0.4), meta.height);
  const area = { left, top, width, height };
  // The frame where before and after differ most inside that area (mean absolute difference).
  const before = sets.find(s => s.key === 'before'), after = sets.find(s => s.key === 'after');
  let peak = 0, best = -1; const diffs = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = await Promise.all([grey(before.frames[i].file, area), grey(after.frames[i].file, area)]);
    let sum = 0; for (let p = 0; p < a.length; p++) sum += Math.abs(a[p] - b[p]);
    const d = sum / a.length; diffs.push(+d.toFixed(2)); if (d > best) { best = d; peak = i; }
  }
  const rows = [peak - 1, peak, peak + 1].filter(i => i >= 0 && i < n);
  const g = after.gate ?? {};
  const commit = c => (c.gate?.checkout?.head ?? '?').slice(0, 8);
  const head = [
    `${opt('hero')}  system ${opt('system')}  t=${rows.map(i => after.frames[i].t).join('/')}ms (peak ${after.frames[peak].t}ms, mean |before-after| ${best.toFixed(1)})`,
    `${sets.map(s => `${s.key}:${commit(s)}`).join('  ')}  assets ${g.snapshot ?? '?'}  ${g.machine ?? '?'} ${g.gl ?? ''}`,
    `vs ${g.foe ? `${g.foe.n}x ${g.foe.model} ${g.foe.star}*` : '?'}  caster ${g.star ?? '?'}*  dist ${g.dist ?? '?'}  ${g.real ? 'real combat' : 'dummies (not real combat)'}  gate ${sets.map(s => `${s.key}:${s.gate ? (s.gate.ok ? 'pass' : 'FAIL') : 'none'}`).join(' ')}`,
  ];
  const out = path.resolve(opt('out')); fs.mkdirSync(out, { recursive: true });
  const base = `${opt('prefix') ?? 'e138w'}-${opt('hero')}-${opt('system')}`;
  const label = (w, text) => ({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24"><rect width="100%" height="100%" fill="#000" fill-opacity="0.6"/><text x="6" y="18" font-family="DejaVu Sans Mono, Consolas, monospace" font-size="15" fill="#fff">${esc(text)}</text></svg>`) });

  // 1) Crops: rows x columns at native resolution.
  const capH = head.length * 22 + 10, W = Math.max(area.width * sets.length, 1280), H = capH + area.height * rows.length;
  const tiles = [{ input: caption(W, head), left: 0, top: 0 }];
  for (const [r, i] of rows.entries()) for (const [c, s] of sets.entries()) {
    tiles.push({ input: await sharp(s.frames[i].file).extract(area).toBuffer(), left: c * area.width, top: capH + r * area.height });
    tiles.push({ ...label(area.width, `${s.key} ${s.frames[i].t}ms`), left: c * area.width, top: capH + r * area.height });
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
  fs.writeFileSync(path.join(out, 'meta', base + '.json'), JSON.stringify({ hero: opt('hero'), system: opt('system'), area, peak: after.frames[peak].t, rows: rows.map(i => after.frames[i].t), diffs, crop, whole, columns: sets.map(s => ({ key: s.key, dir: s.dir, gate: s.gate ? { ok: s.gate.ok, head: s.gate.checkout?.head } : null })) }, null, 2));
  console.log(JSON.stringify({ crop: crop.name, cropBytes: crop.bytes, full: whole.name, fullBytes: whole.bytes, peakMs: after.frames[peak].t }));
})().catch(e => { console.error(e); process.exit(1); });
