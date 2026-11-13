// node dev/castcmp/passdiff-table.cjs <onRoot> <offRoot> <outDir> [--jobs dev/castcmp/jobs/passdiff-on.txt] [--flag 2]
// REC BRANCH ONLY. For every job of the pass on/off pair (batch.cjs output roots, same job names), runs keyframes.cjs with the
// pass-on run as "before" and the pass-off run as "after" (--pick-diff: the frame where they differ most inside the caster's
// area), then writes <outDir>/passdiff.tsv: hero, system, the largest per-frame mean grey difference (0-255) and its time,
// both gates, and the sheet. Rows with a difference of at least --flag are marked FLAG, sorted first: those are the
// systems whose pictures go to Fable.
const { spawnSync } = require('child_process'); const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const [onRoot, offRoot, outDir] = argv.map(a => a && path.resolve(a));
const jobs = fs.readFileSync(opt('jobs') ?? path.join(__dirname, 'jobs/passdiff-on.txt'), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/\s+/));
const flag = Number(opt('flag') ?? 2); fs.mkdirSync(outDir, { recursive: true });
const rows = [];
for (const [, hero, name, ...rest] of jobs) {
  const sys = rest[rest.indexOf('--systems') + 1], on = path.join(onRoot, name), off = path.join(offRoot, name);
  const okOn = fs.existsSync(on + '.ok'), okOff = fs.existsSync(off + '.ok');
  if (!fs.existsSync(on) || !fs.existsSync(off)) { rows.push({ hero, sys, diff: null, at: null, okOn, okOff, note: 'missing run' }); continue; }
  const r = spawnSync(process.execPath, [path.join(__dirname, 'keyframes.cjs'), '--hero', hero, '--system', sys, '--before', on, '--after', off, '--out', outDir, '--prefix', 'pd', '--pick-diff'], { encoding: 'utf8' });
  const meta = path.join(outDir, 'meta', `pd-${hero}-${sys}.json`);
  if (r.status !== 0 || !fs.existsSync(meta)) { rows.push({ hero, sys, diff: null, at: null, okOn, okOff, note: 'keyframes failed: ' + (r.stderr || '').split('\n')[0] }); continue; }
  const m = JSON.parse(fs.readFileSync(meta, 'utf8')), ds = m.diffs.map((d, i) => [d, i]).filter(([d]) => d !== null);
  const [best, at] = ds.reduce((b, x) => x[0] > b[0] ? x : b, [0, -1]);
  rows.push({ hero, sys, diff: best, at: m.peak, okOn, okOff, note: '' });
}
rows.sort((a, b) => (b.diff ?? -1) - (a.diff ?? -1));
fs.writeFileSync(path.join(outDir, 'passdiff.tsv'), ['flag\thero\tsystem\tmaxMeanGreyDiff\tpeakMs\tgateOn\tgateOff\tsheet\tnote',
  ...rows.map(r => [r.diff !== null && r.diff >= flag ? 'FLAG' : '', r.hero, r.sys, r.diff ?? '', r.at ?? '', r.okOn ? 'ok' : 'FAIL', r.okOff ? 'ok' : 'FAIL', `pd-${r.hero}-${r.sys}.jpg`, r.note].join('\t'))].join('\n') + '\n');
console.log(rows.filter(r => r.diff !== null && r.diff >= flag).length, 'flagged of', rows.length, '->', path.join(outDir, 'passdiff.tsv'));
