// node dev/castcmp/board-sheet.cjs <out.jpg> --system <id> --cols "现状=<dir>,不降级=<dir>" [--orig <image>] [--frames f0123,f0150]
//   [--crop auto|x,y,w,h] [--width 960]
// REC BRANCH ONLY. Side-by-side sheet of board-frames.cjs runs: one row per frame number found in every column's <dir>/<system>/
// (or --frames), one column per run, plus an optional original-footage image as the last column of every row.
// --crop auto (default): the box board-frames.cjs recorded for that system on that frame in the first column's frames.json
// (casters and targets of its runs, padded, 16:9), the same box for every column; x,y,w,h fixes one box for all rows.
// Every cell carries a caption from its own column's frames.json: systems running on that frame and each optional pass on/off.
// Node + sharp only.
const sharp = require('sharp'); const fs = require('fs'), path = require('path');
const args = process.argv.slice(2); const out = path.resolve(args[0]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const system = opt('system'), cols = opt('cols').split(',').map(kv => kv.split('=')), orig = opt('orig');
const cropOpt = opt('crop') ?? 'auto', W = Number(opt('width') ?? 960), H = Math.round(W * 9 / 16), label = 40;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
(async () => {
  const logs = cols.map(([, dir]) => { const j = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8')); return new Map(j.frames.map(f => [`f${String(f.frame).padStart(4, '0')}.jpg`, f])); });
  const lists = cols.map(([, dir]) => new Set(fs.readdirSync(path.join(dir, system)).filter(f => f.endsWith('.jpg'))));
  const frames = opt('frames') ? opt('frames').split(',').map(f => f + '.jpg') : [...lists[0]].filter(f => lists.every(l => l.has(f))).sort();
  const boxOf = f => cropOpt === 'auto' ? logs[0].get(f)?.crop?.[system] ?? null : cropOpt.split(',').map(Number);
  const cell = async (file, box) => { let img = sharp(file); if (box) img = img.extract({ left: box[0], top: box[1], width: box[2], height: box[3] }); return img.resize(W, H).jpeg().toBuffer(); };
  const svg = (text, w, h = label, size = 22) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="${Math.round(h * 0.68)}" font-size="${size}" fill="#fff" font-family="sans-serif">${esc(text)}</text></svg>`);
  const ncol = cols.length + (orig ? 1 : 0), rowH = H + label;
  const comps = [];
  for (const [i, [name]] of cols.entries()) comps.push({ input: svg(name, W), left: i * W, top: 0 });
  if (orig) comps.push({ input: svg('原版', W), left: cols.length * W, top: 0 });
  const origBuf = orig ? await sharp(orig).resize(W, H, { fit: 'contain', background: '#000' }).jpeg().toBuffer() : null;
  let y = label;
  for (const f of frames) {
    const box = boxOf(f);
    for (const [i, [, dir]] of cols.entries()) {
      const at = logs[i].get(f), p = at?.passes ?? {};
      const on = k => p[k] ? '开' : '关';
      comps.push({ input: svg(`${system} ${f.replace('.jpg', '')} · 在播 ${at?.live ?? '?'} · early ${on('early')} late ${on('late')} soft ${on('soft')}`, W, label, 20), left: i * W, top: y });
      comps.push({ input: await cell(path.join(dir, system, f), box), left: i * W, top: y + label });
    }
    if (origBuf) { comps.push({ input: svg('原版', W, label, 20), left: cols.length * W, top: y }); comps.push({ input: origBuf, left: cols.length * W, top: y + label }); }
    y += rowH;
  }
  await sharp({ create: { width: ncol * W, height: y, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(out);
  console.log(out, frames.length, 'rows', cropOpt === 'auto' ? 'auto crop' : 'crop ' + cropOpt);
})().catch(e => { console.error(e); process.exit(1); });
