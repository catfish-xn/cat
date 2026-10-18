// Runs intact cases, without overriding their 20 s timeout. Each concurrent
// process owns exactly one Vitest worker; all four execute all three cases.
const { spawn } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const cwd = resolve(process.argv[2] || '.');
const output = resolve(process.argv[3] || 'artifacts/m8-b7-restore');
mkdirSync(output, { recursive: true });
const cases = ['3-7', '4-7', '5-7'];
async function run(name, pattern) {
  const start = performance.now();
  const args = [resolve(cwd, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'fast',
    'tests/m8-b7-audit-vectors.test.ts', '-t', pattern, '--maxWorkers=1',
    '--reporter=json', `--outputFile=${resolve(output, name + '.json')}`];
  let log = '';
  const child = spawn(process.execPath, args, { cwd, env: process.env });
  child.stdout.on('data', data => { log += data; });
  child.stderr.on('data', data => { log += data; });
  const code = await new Promise((done, reject) => { child.on('error', reject); child.on('exit', code => done(code ?? 1)); });
  writeFileSync(resolve(output, name + '.log'), log);
  const report = JSON.parse(readFileSync(resolve(output, name + '.json'), 'utf8'));
  const result = { name, exitCode: code, processMs: performance.now() - start,
    passed: report.numPassedTests, failed: report.numFailedTests,
    cases: report.testResults.flatMap(file => file.assertionResults)
      .filter(test => test.status !== 'skipped' && test.status !== 'pending')
      .map(test => ({ title: test.title, status: test.status, ms: test.duration })) };
  console.log(JSON.stringify(result));
  return result;
}
(async () => {
  const results = [];
  for (const round of cases) results.push(await run('single-' + round, round + ': restoring'));
  results.push(...await Promise.all([1, 2, 3, 4].map(worker => run('worker-' + worker, '[345]-7: restoring'))));
  writeFileSync(resolve(output, 'summary.json'), JSON.stringify({ node: process.version,
    vitest: require(resolve(cwd, 'node_modules/vitest/package.json')).version, results }, null, 2) + '\n');
  if (results.some(result => result.exitCode || result.failed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
