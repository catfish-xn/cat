// node dev/castcmp/board-sheet.cjs <out.jpg> --system <id> --cols "现状=<dir>,不降级=<dir>" [--orig <image>] [--frames f0123,f0150] [--crop x,y,w,h]
// REC BRANCH ONLY. Side-by-side sheet of board-frames.cjs runs: one row per frame number found in every column's <dir>/<system>/
// (or --frames), one column per run, plus an optional original-footage image as the last column of every row. --crop takes
// the same box from every frame (default the whole frame at half size). Node + sharp only.
const sharp = require('sharp'); const fs = require('fs'), path = require('path');
const args = process.argv.slice(2); const out = path.resolve(args[0]);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const system = opt('system'), cols = opt('cols').split(',').map(kv => kv.split('=')), orig = opt('orig');
const crop = opt('crop') ? opt('crop').split(',').map(Number) : null;
(async () => {
  const lists = cols.map(([, dir]) => new Set(fs.readdirSync(path.join(dir, system)).filter(f => f.endsWith('.jpg'))));
  const frames = opt('frames') ? opt('frames').split(',').map(f => f + '.jpg') : [...lists[0]].filter(f => lists.every(l => l.has(f))).sort();
  const cell = async file => { let img = sharp(file); if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] }); else img = img.resize(960, 540); return img.jpeg().toBuffer(); };
  const W = crop ? crop[2] : 960, H = crop ? crop[3] : 540, label = 36;
  const ncol = cols.length + (orig ? 1 : 0);
  const svg = (text, w) => Buffer.from(`<svg width="${w}" height="${label}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="26" font-size="22" fill="#fff" font-family="sans-serif">${text}</text></svg>`);
  const comps = []; let y = 0;
  for (const [i, [name]] of cols.entries()) comps.push({ input: svg(name, W), left: i * W, top: 0 });
  if (orig) comps.push({ input: svg('原版', W), left: cols.length * W, top: 0 });
  y = label;
  const origBuf = orig ? await sharp(orig).resize(W, H, { fit: 'contain', background: '#000' }).jpeg().toBuffer() : null;
  for (const f of frames) {
    for (const [i, [, dir]] of cols.entries()) comps.push({ input: await cell(path.join(dir, system, f)), left: i * W, top: y });
    if (origBuf) comps.push({ input: origBuf, left: cols.length * W, top: y });
    comps.push({ input: svg(`${system} ${f.replace('.jpg', '')}`, 300), left: 0, top: y });
    y += H;
  }
  await sharp({ create: { width: ncol * W, height: y, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
  console.log(out, frames.length, 'rows');
})().catch(e => { console.error(e); process.exit(1); });
