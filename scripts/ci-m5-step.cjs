// Record actual CI command timing. No estimates are labeled measurements.
const fs = require('node:fs');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const [step, command, ...args] = process.argv.slice(2);
if (!step || !command) throw Error('Usage: ci-m5-step.cjs STEP COMMAND [ARGS...]');
const folder = `artifacts/m5-ci-timing-${process.env.M5_JOB_KEY ?? 'local'}`;
fs.mkdirSync(folder, {recursive:true});
const began = Date.now();
const result = spawnSync(command, args, {stdio:'inherit', env:process.env});
const ended = Date.now();
fs.writeFileSync(`${folder}/${step}.json`, JSON.stringify({step, command, args,
  sha:process.env.M5_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null, runId:process.env.GITHUB_RUN_ID ?? null,
  attempt:process.env.GITHUB_RUN_ATTEMPT ?? null, job:process.env.M5_JOB_KEY ?? 'local',
  node:process.version, platform:process.platform, arch:process.arch,
  cpuCount:os.cpus().length, cpu:os.cpus()[0]?.model, memoryBytes:os.totalmem(),
  runnerOs:process.env.RUNNER_OS ?? null, runnerImage:process.env.ImageOS ?? null,
  startedAt:new Date(began).toISOString(), endedAt:new Date(ended).toISOString(),
  durationSeconds:(ended-began)/1000, exitCode:result.status, signal:result.signal,
  error:result.error?.message ?? null}, null, 2));
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
