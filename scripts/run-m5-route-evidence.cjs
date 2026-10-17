const {spawn} = require('node:child_process');

/** Independent route generators have separate evidence folders and no wall-clock
 * assertions. Start both after serial timing tests; wait for both even on failure
 * so CI retains each workload's existing ci-m5-step timing and evidence. */
async function runRouteEvidence(launch = spawn, env = process.env) {
  const workloads = [
    {step:'headless', script:'test:headless', env},
    {step:'performance', script:'test:performance', env:{...env,M5_EVIDENCE_DIR:'artifacts/m5-performance'}},
  ];
  const codes = await Promise.all(workloads.map(workload => new Promise(resolve => {
    let child;
    try {
      child = launch(process.execPath, ['scripts/ci-m5-step.cjs',workload.step,'npm','run',workload.script],
        {stdio:'inherit',env:workload.env});
    } catch (error) { console.error(error); resolve(1); return; }
    child.once('error', error => { console.error(error); resolve(1); });
    child.once('exit', (code,signal) => resolve(signal || code === null ? 1 : code));
  })));
  return codes.every(code => code === 0) ? 0 : 1;
}
module.exports = {runRouteEvidence};
if (require.main === module) runRouteEvidence().then(code => {process.exitCode=code;},error => {console.error(error);process.exitCode=1;});
