// node dev/castcmp/regate-dir.cjs --out <batch.cjs output folder> [--sheets <sheets.txt>] [--kf <folder>] [--prefix e138w]
// Judges a batch.cjs output folder again and composes its keyframe sheets again, with no recording (run-plan --regate is
// the same for run-plan's folders). For every <out>/<job>/gate.json:
//   - gate.cjs regate(): today's rules on what was recorded (covering is a warning unless a foe nearer the camera covers over
//     60%); a gate.json from before the running-system probe (78b6adfc and older) is judged on layers, covering, checkout
//     and the rules audit only;
//   - the recording's own judgement is kept once as gate.orig.json; <out>/<job>.ok follows the new verdict.
// Then each line of --sheets (keyframes.cjs arguments; --before/--after/--off/--debug name job folders in <out>) is
// composed into --kf (default <out>/keyframes-regate). keyframes.cjs picks the frame from the after gate.json's layer
// timeline (the frame with the most layers of --system), else the pixel difference. Summary: <kf>/regate-summary.json.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const { regate } = require('./gate.cjs');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
if (!opt('out')) { console.error('usage: regate-dir.cjs --out <folder> [--sheets <sheets.txt>] [--kf <folder>] [--prefix e138w]'); process.exit(2); }
const out = path.resolve(opt('out')), kf = path.resolve(opt('kf') ?? path.join(out, 'keyframes-regate'));
fs.mkdirSync(kf, { recursive: true });

const jobs = [];
for (const name of fs.readdirSync(out).sort()) {
  const gf = path.join(out, name, 'gate.json'), orig = path.join(out, name, 'gate.orig.json'), ok = path.join(out, name + '.ok');
  if (!fs.existsSync(gf)) continue;
  const was = JSON.parse(fs.readFileSync(gf, 'utf8'));
  if (!was.regated) fs.copyFileSync(gf, orig); // a fresh recording's own judgement
  const g = regate(was);
  fs.writeFileSync(gf, JSON.stringify(g, null, 2));
  if (g.ok) fs.writeFileSync(ok, ''); else fs.rmSync(ok, { force: true });
  jobs.push({ job: name, was: g.regated.was.ok, ok: g.ok, fails: g.fails, warnings: g.warnings, oldFormat: !!g.oldFormat });
  console.log(`${g.ok ? 'PASS' : 'FAIL'} ${name}${g.regated.was.ok !== g.ok ? ` (was ${g.regated.was.ok ? 'PASS' : 'FAIL'})` : ''}${g.fails.length ? ' | ' + g.fails.join(' | ') : ''}${g.warnings.length ? '  WARN ' + g.warnings.join('; ') : ''}`);
}

const sheets = [];
if (opt('sheets')) {
  const lines = fs.readFileSync(path.resolve(opt('sheets')), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  for (const line of lines) {
    const args = line.split(/\s+/);
    for (const k of ['before', 'after', 'off', 'debug']) { const i = args.indexOf('--' + k); if (i >= 0) args[i + 1] = path.join(out, args[i + 1]); }
    const missing = ['before', 'after', 'off', 'debug'].filter(k => args.includes('--' + k) && !fs.existsSync(args[args.indexOf('--' + k) + 1]));
    if (missing.length) { sheets.push({ sheet: line, ok: false, out: `missing folders: ${missing.join(',')}` }); continue; }
    const r = spawnSync(process.execPath, [path.join(__dirname, 'keyframes.cjs'), ...args, '--out', kf, '--prefix', opt('prefix') ?? 'e138w'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const said = ((r.stdout ?? '') + (r.stderr ?? '')).trim().split('\n').pop();
    sheets.push({ sheet: line, ok: r.status === 0, out: said });
    console.log(`${r.status === 0 ? 'sheet' : 'SHEET FAIL'} ${line.split(/\s+/).slice(0, 4).join(' ')}: ${said}`);
  }
}
fs.writeFileSync(path.join(kf, 'regate-summary.json'), JSON.stringify({ out, at: new Date().toISOString(), jobs, sheets }, null, 2));
const failed = jobs.filter(j => !j.ok);
console.log(`\n${jobs.length - failed.length}/${jobs.length} passed${failed.length ? '; failed: ' + failed.map(j => j.job).join(' ') : ''}${sheets.length ? `; sheets ${sheets.filter(s => s.ok).length}/${sheets.length}` : ''}`);
process.exit(failed.length || sheets.some(s => !s.ok) ? 1 : 0);
