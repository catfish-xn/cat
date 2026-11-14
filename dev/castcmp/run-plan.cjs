// node dev/castcmp/run-plan.cjs <plan.json> --before-tree <dir> --after-tree <dir> --out <dir> --root <asset root>
//   [--tools <commit>] [--only <batch,batch>] [--port 5311] [--assetPort 5419]
// Runs a recording plan (dev/castcmp/jobs/plan-*.json): for each batch and column (before, after),
//   1. git checkout -f <the batch's src commit> in that column's tree,
//   2. git checkout <tools> -- dev/castcmp (tools default: this checkout's HEAD),
//   (a commit a tree lacks is fetched from its origin first),
//   3. node dev/castcmp/batch.cjs <jobs> <out>/<batch>/<column> --serve --root <asset root> (in that tree),
// then keyframes.cjs for each of the batch's sheets into <out>/keyframes/, and copies every job's gate.json, overhead.json
// and log to <out>/keyframes/gates/<batch>-<column>-<job>.*.
// A job that fails does not stop the run. The first job of a batch runs alone first: if it fails at tool level (no
// gate.json written: the page did not come up, a probe could not be read, the harness threw) the batch is skipped.
// A gate FAIL is not a tool failure. The end prints each batch's passed / failed jobs and sheets, and writes summary.json.
// --regate: no checkout and no recording. Every job's existing <out>/<batch>/<column>/<job>/gate.json is judged again by
// this checkout's gate.cjs (regate(): the recorded frames under today's rules, e.g. covering now a warning unless a foe
// nearer the camera covers over 60%); the recording's own judgement is kept as gate.orig.json, <job>.ok follows the new verdict,
// the gates/ copies are refreshed and the sheets are composed again (keyframes.cjs from this checkout). The jobs files
// are read from this checkout too; --before-tree / --after-tree are not needed.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const planFile = argv[0];
const regateOnly = argv.includes('--regate');
for (const k of regateOnly ? ['out'] : ['before-tree', 'after-tree', 'out', 'root']) if (!planFile || !opt(k)) { console.error(`usage: run-plan.cjs <plan.json> --before-tree D --after-tree D --out D --root D (missing ${planFile ? '--' + k : 'plan'})`); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(path.resolve(planFile), 'utf8'));
const here = path.resolve(__dirname, '../..');
const run = (cmd, args, cwd, quiet) => { const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 << 20, stdio: quiet ? 'pipe' : ['ignore', 'inherit', 'inherit'] }); return { code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') }; };
const tools = opt('tools') ?? run('git', ['rev-parse', 'HEAD'], here, true).out.trim();
const trees = regateOnly ? { before: here, after: here } : { before: path.resolve(opt('before-tree')), after: path.resolve(opt('after-tree')) };
const out = path.resolve(opt('out')), kfOut = path.join(out, 'keyframes'), gatesOut = path.join(kfOut, 'gates');
fs.mkdirSync(gatesOut, { recursive: true });
const only = opt('only')?.split(',');
const jobLines = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const passThrough = ['port', 'assetPort'].flatMap(k => opt(k) ? ['--' + k, opt(k)] : []);

/** --regate: judge one column's written gate.json files again (gate.cjs regate()). */
function regateColumn(spec, dir, batchName, column) {
  const { regate } = require(path.join(here, 'dev/castcmp/gate.cjs'));
  const names = jobLines(path.join(here, spec.jobs)).map(l => l.split(/\s+/)[2]);
  const r = { src: spec.src, passed: [], failed: [], missing: [], changed: [] };
  for (const n of names) {
    const gf = path.join(dir, n, 'gate.json'), orig = path.join(dir, n, 'gate.orig.json'), ok = path.join(dir, n + '.ok');
    if (!fs.existsSync(gf)) { r.missing.push(n); r.failed.push(n); continue; }
    const was = JSON.parse(fs.readFileSync(gf, 'utf8'));
    if (!was.regated) fs.copyFileSync(gf, orig); // a fresh recording's own judgement
    const g = regate(was);
    fs.writeFileSync(gf, JSON.stringify(g, null, 2));
    if (g.ok) { fs.writeFileSync(ok, ''); r.passed.push(n); } else { fs.rmSync(ok, { force: true }); r.failed.push(n); }
    if (g.ok !== g.regated.was.ok) r.changed.push(`${n} ${g.regated.was.ok ? 'PASS' : 'FAIL'}->${g.ok ? 'PASS' : 'FAIL'}`);
    console.log(`regate ${batchName}/${column}/${n}: ${g.ok ? 'PASS' : 'FAIL ' + g.fails.join(' | ')}${g.warnings?.length ? '  (' + g.warnings.join('; ') + ')' : ''}`);
    fs.copyFileSync(gf, path.join(gatesOut, `${batchName}-${column}-${n}.gate.json`));
  }
  return r;
}

const summary = { tools, plan: planFile, at: new Date().toISOString(), batches: [] };
for (const batch of plan.batches) {
  if (only && !only.includes(batch.name)) continue;
  const result = { name: batch.name, columns: {}, sheets: [], skipped: null };
  summary.batches.push(result);
  console.log(`\n=== ${batch.name}`);
  for (const column of ['before', 'after']) {
    const spec = batch[column]; if (!spec) continue;
    const tree = trees[column], dir = path.join(out, batch.name, column);
    if (regateOnly) { result.columns[column] = regateColumn(spec, dir, batch.name, column); continue; }
    // A commit the tree lacks is fetched from its origin first (GitHub serves any commit reachable from a branch or PR).
    // Short ids cannot be fetched by name, so a miss fetches every branch and PR head.
    if ([spec.src, tools].some(c => run('git', ['cat-file', '-e', c + '^{commit}'], tree, true).code))
      run('git', ['fetch', '-q', 'origin', '+refs/heads/*:refs/remotes/origin/*', '+refs/pull/*/head:refs/remotes/origin/pr/*'], tree, true);
    const prep = [['checkout', '-f', spec.src], ['checkout', tools, '--', 'dev/castcmp']];
    let failed = null;
    for (const a of prep) { const r = run('git', a, tree, true); if (r.code) { failed = `git ${a.join(' ')}: ${r.out.trim().split('\n').pop()}`; break; } }
    if (failed) { result.skipped = `${column}: ${failed}`; console.log(`skip ${batch.name}: ${result.skipped}`); break; }
    const jobs = path.join(tree, spec.jobs), lines = jobLines(jobs);
    fs.mkdirSync(dir, { recursive: true });
    const batchArgs = extra => ['dev/castcmp/batch.cjs', extra, dir, '--serve', '--root', path.resolve(opt('root')), ...passThrough];
    // The first job alone: a tool-level failure there skips the batch.
    const first = lines[0].split(/\s+/)[2], firstJobs = path.join(dir, '_first.txt');
    fs.writeFileSync(firstJobs, lines[0] + '\n');
    run(process.execPath, batchArgs(firstJobs), tree);
    if (!fs.existsSync(path.join(dir, first + '.ok')) && !fs.existsSync(path.join(dir, first, 'gate.json'))) {
      result.skipped = `${column}: first job ${first} failed before writing gate.json (tool level; see ${path.join(dir, first + '.log')})`;
      console.log(`skip ${batch.name}: ${result.skipped}`); break;
    }
    // The rest of the batch (the first job is not run twice).
    if (lines.length > 1) { const restJobs = path.join(dir, '_rest.txt'); fs.writeFileSync(restJobs, lines.slice(1).join('\n') + '\n'); run(process.execPath, batchArgs(restJobs), tree); }
    const names = lines.map(l => l.split(/\s+/)[2]);
    result.columns[column] = { src: spec.src, passed: names.filter(n => fs.existsSync(path.join(dir, n + '.ok'))), failed: names.filter(n => !fs.existsSync(path.join(dir, n + '.ok'))) };
    for (const n of names) for (const [from, to] of [[path.join(dir, n, 'gate.json'), 'gate.json'], [path.join(dir, n, 'overhead.json'), 'overhead.json'], [path.join(dir, n, 'attached.json'), 'attached.json'], [path.join(dir, n, 'emitters.json'), 'emitters.json'], [path.join(dir, n + '.log'), 'log']])
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(gatesOut, `${batch.name}-${column}-${n}.${to}`));
  }
  if (result.skipped) continue;
  // Sheets.
  for (const sheet of batch.keyframes ?? []) {
    const args = sheet.split(/\s+/);
    // --before names a job folder of the before column; --after, --off and --debug of the after column (the after jobs file
    // holds the after, off and debug lines).
    for (const [flag, column] of [['before', 'before'], ['after', 'after'], ['off', 'after'], ['debug', 'after']]) { const i = args.indexOf('--' + flag); if (i >= 0) args[i + 1] = path.join(out, batch.name, column, args[i + 1]); }
    const r = run(process.execPath, [path.join(trees.after, 'dev/castcmp/keyframes.cjs'), ...args, '--out', kfOut, '--prefix', batch.prefix ?? 'e138w'], trees.after, true);
    result.sheets.push({ sheet, ok: r.code === 0, out: r.out.trim().split('\n').pop() });
  }
}
for (const b of summary.batches) {
  console.log(`\n${b.name}${b.skipped ? `  SKIPPED: ${b.skipped}` : ''}`);
  for (const [c, r] of Object.entries(b.columns)) console.log(`  ${c} @ ${r.src.slice(0, 8)}: ${r.passed.length} passed${r.failed.length ? `, failed: ${r.failed.join(' ')}` : ''}${r.missing?.length ? `, no gate.json: ${r.missing.join(' ')}` : ''}${r.changed?.length ? `, regate changed: ${r.changed.join(' ')}` : ''}`);
  if (b.sheets.length) console.log(`  sheets: ${b.sheets.filter(s => s.ok).length}/${b.sheets.length}${b.sheets.filter(s => !s.ok).map(s => `\n    FAIL ${s.sheet.split(' ').slice(0, 4).join(' ')}: ${s.out}`).join('')}`);
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
process.exit(summary.batches.some(b => b.skipped || Object.values(b.columns).some(c => c.failed.length) || b.sheets.some(s => !s.ok)) ? 1 : 0);
