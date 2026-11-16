// node dev/castcmp/ref-pair.cjs <recA> <recB>: may these two v-capture recordings be pixel-compared? (Fable 11-15 pairing rule)
// Compares their reference frames (ref-units.png: units standing, before the recorded cast; written by v-capture with
// render-meta.json). Same state = same clip and a largest channel difference of at most 8 on the unit area; prints the
// render-meta fields that differ (renderer, samples, DPR, sizes, asset load order) either way. Exit 0 paired, 1 not, 2 unusable.
const sharp = require('sharp'); const fs = require('fs'), path = require('path');
const LIMIT = 8;
const read = d => { const f = path.join(d, 'render-meta.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
(async () => {
  const [a, b] = process.argv.slice(2); if (!a || !b) { console.error('usage: ref-pair.cjs <recA> <recB>'); process.exit(2); }
  const ma = read(a), mb = read(b);
  if (!ma?.ref || !mb?.ref) { console.log(JSON.stringify({ paired: false, why: 'no render-meta.json / ref-units.png (recorded before 11-15 meta)' })); process.exit(2); }
  const diffs = {};
  const pick = m => ({ renderer: m.main?.renderer, vendor: m.main?.vendor, samples: m.main?.samples, antialias: m.main?.attributes?.antialias, dpr: m.dpr,
    size: m.main && [m.main.width, m.main.height], drawingBuffer: m.main?.drawingBuffer, quiet: m.quiet ? m.quiet.ok : null });
  const pa = pick(ma), pb = pick(mb);
  for (const k of Object.keys(pa)) if (JSON.stringify(pa[k]) !== JSON.stringify(pb[k])) diffs[k] = [pa[k], pb[k]];
  // Loads compared as sets: the order parallel fetches finish in differs run to run and says nothing about the frame.
  const setA = new Set(ma.loads?.order ?? []), setB = new Set(mb.loads?.order ?? []);
  const onlyA = [...setA].filter(x => !setB.has(x)), onlyB = [...setB].filter(x => !setA.has(x));
  if (onlyA.length || onlyB.length) diffs.loadsOnlyIn = [onlyA, onlyB];
  if (JSON.stringify(ma.ref.clip) !== JSON.stringify(mb.ref.clip)) {
    console.log(JSON.stringify({ paired: false, why: 'reference clips differ (units not on the same spots)', clip: [ma.ref.clip, mb.ref.clip], meta: diffs }, null, 1)); process.exit(1);
  }
  const A = await sharp(path.join(a, 'ref-units.png')).raw().toBuffer({ resolveWithObject: true }), B = await sharp(path.join(b, 'ref-units.png')).raw().toBuffer();
  const c = A.info.channels; let max = 0, over = 0;
  for (let i = 0; i < A.data.length; i += c) { let d = 0; for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[i + k] - B[i + k])); if (d > max) max = d; if (d > LIMIT) over++; }
  const paired = max <= LIMIT;
  // A reference frame taken before the loads settled (render-meta quiet.ok false) may differ only by timing (review 11-16).
  const notQuiet = [['A', ma], ['B', mb]].filter(([, m]) => m.quiet && m.quiet.ok === false).map(([n]) => n);
  const warning = notQuiet.length ? `reference frame ${notQuiet.join(' and ')} was taken before the loads settled (quiet.ok false): re-record before trusting this pairing` : undefined;
  if (warning) console.error(`ref-pair: ${warning}`);
  console.log(JSON.stringify({ paired, maxDiff: max, pixelsOver8: over, limit: LIMIT, sameFingerprint: ma.ref.sha256 === mb.ref.sha256, meta: diffs, ...(warning ? { warning } : {}) }, null, 1));
  process.exit(paired ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
