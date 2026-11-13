// RECORDING ONLY (never merged): how much of an effect's ground mark the units cover, from two recordings of the same
// deterministic replay, one with --hide-units 1 and one without.
//   node dev/castcmp/occlusion.cjs <hiddenDir> <drawnDir> (--ref MS | --ref-dir DIR) --from MS --to MS [--max 0.5] [--dark 15] [--cover 25]
// The mark is what the hidden run shows darker than a reference by more than --dark (0-255 luma): with --ref-dir, the
// same instant of a third run, hidden too, that leaves the effect out (v-capture --mute <system>), so only the effect
// differs; else the hidden run's own frame at --ref (before the cast). A mark pixel counts as covered where the drawn run differs from the hidden run there by more than --cover: the
// only thing the two runs differ by is the unit models and their contact shadows. Writes occlusion.json beside the drawn
// run; exits 1 when any frame in [--from, --to] has more than --max of its mark covered, or has no mark at all.
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const args = process.argv.slice(2), [hidden, drawn] = args;
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
const refDir = (() => { const i = args.indexOf('--ref-dir'); return i >= 0 ? args[i + 1] : null; })();
const ref = opt('ref', 0), from = opt('from', 0), to = opt('to', 0), max = opt('max', 0.5), dark = opt('dark', 15), cover = opt('cover', 25);
const frameAt = (dir, ms) => {
  const name = fs.readdirSync(dir).find(f => f.endsWith('.jpg') && Number(f.match(/-(\d+)\.jpg$/)?.[1]) === ms);
  if (!name) throw new Error(`no frame at ${ms} ms in ${dir}`);
  return path.join(dir, name);
};
const times = dir => fs.readdirSync(dir).map(f => Number(f.match(/-(\d+)\.jpg$/)?.[1])).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
const luma = async file => { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(info.width * info.height); for (let i = 0; i < out.length; i++) out[i] = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2]; return out; };
(async () => {
  const fixedBase = refDir ? null : await luma(frameAt(hidden, ref));
  const rows = []; let failed = false;
  for (const t of times(hidden).filter(t => t >= from && t <= to)) {
    const h = await luma(frameAt(hidden, t)), d = await luma(frameAt(drawn, t)), base = fixedBase ?? await luma(frameAt(refDir, t));
    let mark = 0, covered = 0;
    for (let i = 0; i < h.length; i++) if (base[i] - h[i] > dark) { mark++; if (Math.abs(d[i] - h[i]) > cover) covered++; }
    const share = mark ? covered / mark : null;
    const ok = share !== null && share <= max; if (!ok) failed = true;
    rows.push({ t, markPixels: mark, coveredPixels: covered, coveredShare: share === null ? null : +share.toFixed(3), ok });
  }
  const report = { hidden, drawn, ref: refDir ?? ref, from, to, max, dark, cover, ok: !failed, frames: rows,
    worst: rows.reduce((w, r) => (r.coveredShare ?? 1) > (w?.coveredShare ?? -1) ? r : w, null) };
  fs.writeFileSync(path.join(drawn, 'occlusion.json'), JSON.stringify(report, null, 2));
  console.log(`occlusion ${failed ? 'FAIL' : 'PASS'}: worst ${report.worst ? `${report.worst.t} ms ${report.worst.coveredShare}` : 'none'} (max ${max}), ${rows.length} frames`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(2); });
