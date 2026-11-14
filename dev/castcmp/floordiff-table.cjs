// node dev/castcmp/floordiff-table.cjs <beforeRoot> <afterRoot> <outDir> [--jobs dev/castcmp/jobs/floordiff.txt] [--flag 1]
// REC BRANCH ONLY (11-14, floor-depth PR). For every job of the before/after pair (batch.cjs or run-plan output roots, same
// job names), runs keyframes.cjs with --pick-diff over the caster and its target (me,foe), then writes <outDir>/floordiff.tsv:
// hero, job, the largest per-frame mean grey difference (0-255) and its time, both gates, and the sheet. Rows with a
// difference of at least --flag are marked FLAG and sorted first: those are the pictures to look at.
const { spawnSync } = require('child_process'); const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const [beforeRoot, afterRoot, outDir] = argv.map(a => a && path.resolve(a));
const jobs = fs.readFileSync(opt('jobs') ?? path.join(__dirname, 'jobs/floordiff.txt'), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split(/\s+/));
const flag = Number(opt('flag') ?? 1); fs.mkdirSync(outDir, { recursive: true });
const rows = [];
for (const [, hero, name] of jobs) {
  const before = path.join(beforeRoot, name), after = path.join(afterRoot, name);
  const okB = fs.existsSync(before + '.ok'), okA = fs.existsSync(after + '.ok');
  if (!fs.existsSync(before) || !fs.existsSync(after)) { rows.push({ hero, name, diff: null, at: null, okB, okA, note: 'missing run' }); continue; }
  const r = spawnSync(process.execPath, [path.join(__dirname, 'keyframes.cjs'), '--hero', hero, '--system', name, '--before', before, '--after', after, '--out', outDir, '--prefix', 'fd', '--pick-diff', '--crop', 'me,foe'], { encoding: 'utf8' });
  const meta = path.join(outDir, 'meta', `fd-${hero}-${name}.json`);
  if (r.status !== 0 || !fs.existsSync(meta)) { rows.push({ hero, name, diff: null, at: null, okB, okA, note: 'keyframes failed: ' + (r.stderr || '').split('\n')[0] }); continue; }
  const m = JSON.parse(fs.readFileSync(meta, 'utf8')), best = Math.max(0, ...m.diffs.filter(d => d !== null));
  rows.push({ hero, name, diff: best, at: m.peak, okB, okA, note: '' });
}
rows.sort((a, b) => (b.diff ?? -1) - (a.diff ?? -1));
fs.writeFileSync(path.join(outDir, 'floordiff.tsv'), ['flag\thero\tjob\tmaxMeanGreyDiff\tpeakMs\tgateBefore\tgateAfter\tsheet\tnote',
  ...rows.map(r => [r.diff !== null && r.diff >= flag ? 'FLAG' : '', r.hero, r.name, r.diff ?? '', r.at ?? '', r.okB ? 'ok' : 'FAIL', r.okA ? 'ok' : 'FAIL', `fd-${r.hero}-${r.name}.jpg`, r.note].join('\t'))].join('\n') + '\n');
console.log(rows.filter(r => r.diff !== null && r.diff >= flag).length, 'flagged of', rows.length, '->', path.join(outDir, 'floordiff.tsv'));
