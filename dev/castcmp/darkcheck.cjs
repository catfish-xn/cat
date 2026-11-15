// REC ONLY (11-15, Blitzcrank dark layers): node dev/castcmp/darkcheck.cjs <litDir> <baseDir> <unit> <system> [offsets ms, default 100,200,300]
// For each offset after <system> first starts in <litDir> (its gate.json frames[].starts), compares the same frame of <litDir>
// (the layers drawn) and <baseDir> (nothing drawn): the mean luminance (0-255) of 9x9 patches at the caster's feet and at
// half / one / one and a half box widths to each side, and lit / base as the share of the light the layers leave.
const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const [lit, base, unit, system, offs] = process.argv.slice(2);
if (!system) { console.error('usage: darkcheck.cjs <litDir> <baseDir> <unit> <system> [100,200,300]'); process.exit(2); }
const gate = JSON.parse(fs.readFileSync(path.join(lit, 'gate.json'), 'utf8'));
const start = gate.frames.find(f => (f.starts ?? []).some(s => String(s).split('@')[0] === system));
if (!start) { console.error(`${system} never starts in ${lit}`); process.exit(1); }
const times = gate.frames.map(f => f.t);
const nearest = t => times.reduce((b, x) => Math.abs(x - t) < Math.abs(b - t) ? x : b, times[0]);
(async () => {
  const rows = [];
  for (const off of (offs ?? '100,200,300').split(',').map(Number)) {
    const t = nearest(start.t + off), frame = gate.frames.find(f => f.t === t), me = frame.boxes?.me;
    if (!me) { rows.push({ off, t, error: 'no caster box' }); continue; }
    const cx = (me.left + me.right) / 2, cy = me.bottom - (me.bottom - me.top) * 0.1, w = me.right - me.left;
    const file = dir => path.join(dir, `${unit}-${String(t).padStart(4, '0')}.jpg`);
    const read = async f => sharp(f).raw().toBuffer({ resolveWithObject: true });
    const [a, b] = await Promise.all([read(file(lit)), read(file(base))]);
    const lum = (img, x, y) => { let s = 0, n = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const px = Math.round(x + dx), py = Math.round(y + dy); if (px < 0 || py < 0 || px >= img.info.width || py >= img.info.height) continue;
      const i = (py * img.info.width + px) * img.info.channels; s += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]; n++; }
      return n ? s / n : null; };
    const at = { feet: [cx, cy] };
    for (const k of [0.5, 1, 1.5]) { at[`L${k}`] = [cx - k * w, cy]; at[`R${k}`] = [cx + k * w, cy]; }
    const patch = Object.fromEntries(Object.entries(at).map(([k, [x, y]]) => { const l = lum(a, x, y), bb = lum(b, x, y);
      return [k, { lit: Math.round(l), base: Math.round(bb), share: bb ? Math.round(l / bb * 100) / 100 : null }]; }));
    rows.push({ off, t, patch });
  }
  console.log(JSON.stringify({ lit, base, system, startT: start.t, rows }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
