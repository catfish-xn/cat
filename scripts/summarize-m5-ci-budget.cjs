// Input is the unmodified GitHub Actions jobs API response for a three-sample
// profiling run. Full job duration includes setup/install/build/play/upload.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [input, output = 'artifacts/m5-ci-budget.json'] = process.argv.slice(2);
assert(input, 'Usage: summarize-m5-ci-budget.cjs jobs.json [output.json]');
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
assert(Array.isArray(data.jobs), 'Expected GitHub jobs response');
const runIds = [...new Set(data.jobs.map(job=>job.run_id))];
const headShas = [...new Set(data.jobs.map(job=>job.head_sha))];
assert.equal(runIds.length, 1, 'All samples must belong to one workflow run');
assert(Number.isInteger(runIds[0]), 'Workflow run ID required');
assert.equal(headShas.length, 1, 'All samples must use one commit');
assert.match(headShas[0] ?? '', /^[a-f0-9]{40}$/, 'Commit SHA required');
const groups = new Map();
for (const job of data.jobs) {
  const match = /^(browser-(?:dev|preview)-(?:cannon|sniper|mage)|input-(?:dev|preview)|test-and-build|compare-evidence)-sample([123])$/.exec(job.name)
    ?? /^(compare-evidence) \(([123])\)$/.exec(job.name);
  if (!match) continue;
  assert.equal(job.conclusion, 'success', `${job.name} did not pass`);
  const seconds = (Date.parse(job.completed_at)-Date.parse(job.started_at))/1000;
  assert(Number.isFinite(seconds) && seconds>0, `${job.name} missing real timestamps`);
  const values = groups.get(match[1]) ?? [];
  assert(!values.some(v=>v.sample===Number(match[2])), 'Duplicate sample');
  values.push({sample:Number(match[2]), jobId:job.id, seconds, steps:job.steps.map(step=>({
    name:step.name,conclusion:step.conclusion,seconds:(Date.parse(step.completed_at)-Date.parse(step.started_at))/1000}))});
  groups.set(match[1],values);
}
const required = ['test-and-build', 'compare-evidence', ...['dev','preview'].flatMap(mode=>[
  ...['cannon','sniper','mage'].map(build=>`browser-${mode}-${build}`), `input-${mode}`])];
const budgets = required.map(name=>{
  const samples=groups.get(name)??[];
  assert.deepEqual(samples.map(v=>v.sample).sort(),[1,2,3],`${name} requires three successful samples`);
  const maxSeconds=Math.max(...samples.map(v=>v.seconds));
  return {name,samples,maxSeconds,timeoutMinutes:Math.ceil(maxSeconds/60*1.5+5)};
});
fs.mkdirSync(require('node:path').dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({evidence:'GitHub job timestamps, including all steps',
  runIds,headShas,
  formula:'ceil(max of three measured minutes * 1.5 + 5)',budgets,
  workflowTimeoutMinutes:{test:budgets.find(v=>v.name==='test-and-build').timeoutMinutes,
    browser:Math.max(...budgets.filter(v=>v.name.startsWith('browser-')).map(v=>v.timeoutMinutes)),
    input:Math.max(...budgets.filter(v=>v.name.startsWith('input-')).map(v=>v.timeoutMinutes)),
    comparison:budgets.find(v=>v.name==='compare-evidence').timeoutMinutes}},null,2));
console.log(output);
