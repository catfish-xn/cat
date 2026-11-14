/* Persist auditable ordinary-route evidence; no browser results are claimed here. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const readline = require('node:readline');
const {execFileSync, spawn} = require('node:child_process');
const {run} = require('./generate-m5-route.cjs');
const {routeOptions} = require('./v26-neutrals-1424-route.cjs');
/* v26: a history-owner augment (or a prismatic 4-2 offer) appends a deaths fact on
 * every later combat tick. Seed 42 keeps the recorded public rerolls. Every seed
 * also refuses a history owner when another offer or an unused reroll exists.
 * run() without avoidAugments still takes the historical pick (browser goldens, m8).
 * The prismatic-offer journal itself is not rerolled away; the H3 ledger reuses a
 * reference-stable fact prefix instead of cloning it on every tick.
 * Public ubuntu-24.04 runners have 4 vCPUs. Two independent routes overlap so the
 * unchanged per-route assertions finish inside the existing 22-minute job. */
const {hash} = require('./m4-evidence.cjs');
const {sourceFingerprint} = require('./m5-evidence.cjs');
const SEEDS = [0, 1, 42, 0xffffffff, 7, 13, 23, 31, 64, 99, 123, 256, 777, 1024, 2048, 4096, 8192, 12345, 32768, 65535, 424242, 0xdeadbeef, 0x80000000, 0x9e3779b9];

function evidenceDir() {
  return process.env.M5_EVIDENCE_DIR ?? (process.argv.includes('--multi-seed') ? 'artifacts/m5-headless-seeds' : 'artifacts/m5-headless');
}
function plannedJobs() {
  const repeat = Number((process.argv.find(arg => arg.startsWith('--repeat=')) ?? '--repeat=1').split('=')[1]);
  assert(Number.isInteger(repeat) && repeat >= 1 && repeat <= 3);
  const builds = ['cannon', 'sniper', 'mage'];
  const runs = process.argv.includes('--multi-seed') ? SEEDS.map((seed, index) => ({build: builds[index % 3], seed})) : [...builds, 'sniper-caitlyn'].map(build => ({build, seed: 42}));
  const jobs = [];
  for (let repetition = 1; repetition <= repeat; repetition++) for (const options of runs) jobs.push({...options, repetition, repeat});
  return jobs;
}
async function loadApi() {
  const {createServer} = await import('vite');
  const server = await createServer({root: path.resolve(__dirname, '..'), ...(process.env.VITE_CONFIG_LOADER ? {configLoader: process.env.VITE_CONFIG_LOADER} : {}), server: {middlewareMode: true, ws: false}, optimizeDeps: {noDiscovery: true, include: []}, appType: 'custom'});
  const api = await server.ssrLoadModule('/src/simulation/match.ts');
  const {ROUND_CATALOG} = await server.ssrLoadModule('/src/simulation/content/round-catalog.ts');
  const {AUGMENT_HISTORY_OWNERS} = await server.ssrLoadModule('/src/simulation/augment-history-owners.ts');
  return {server, api, finalRound: ROUND_CATALOG.at(-1).ordinal, avoidAugments: Object.keys(AUGMENT_HISTORY_OWNERS)};
}
async function executeJob(api, job, finalRound, avoidAugments, output) {
  const route = await run(api, {build: job.build, seed: job.seed, ...routeOptions(job.build, job.seed), avoidAugments});
  assert.equal(route.final.phase, 'gameOver');
  if (job.seed === 42) {
    assert.equal(route.summary.round, finalRound);
    assert.equal(route.summary.outcome, 'victory');
    assert(route.summary.formedBattles >= 3, `${job.build}-${job.seed}: complete-build threshold (restored after B8 loot)`);
    assert(route.summary.boundBattles >= 2);
  }
  const name = `${job.build}-${job.seed}${job.repeat > 1 ? `-repeat${job.repetition}` : ''}`;
  const ledgerBytes = Math.max(...route.rounds.map(round => Buffer.byteLength(JSON.stringify(round.events))));
  const summary = {repetition: job.repetition, ...route.summary, maxCombatLedgerBytes: ledgerBytes, rssBytesAfterRoute: process.memoryUsage().rss, peakProcessRssBytes: process.resourceUsage().maxRSS * 1024, finalHash: hash(route.final)};
  fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(route));
  return summary;
}
function blankManifest() {
  return {sha: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), status: execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim(), diffHash: hash(execFileSync('git', ['diff', 'HEAD'], {encoding: 'utf8'})), node: process.version, platform: process.platform, cpu: os.cpus()[0]?.model, memoryBytes: os.totalmem(), cpuCount: os.cpus().length, loadAtStart: os.loadavg(), startedAt: new Date().toISOString(), sourceFingerprint: sourceFingerprint(), routes: [], passed: false};
}

async function workerMain() {
  const loaded = await loadApi();
  const output = process.env.M5_EVIDENCE_DIR;
  assert(output, 'worker evidence directory');
  const lines = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const summary = await executeJob(loaded.api, JSON.parse(line), loaded.finalRound, loaded.avoidAugments, output);
      console.log(JSON.stringify(summary));
    }
  } finally {
    lines.close();
    await loaded.server.close();
  }
}

async function runSerial(jobs, output, manifest) {
  const loaded = await loadApi();
  try {
    for (const job of jobs) {
      const summary = await executeJob(loaded.api, job, loaded.finalRound, loaded.avoidAugments, output);
      manifest.routes.push(summary);
      console.log(JSON.stringify(summary));
    }
  } finally {
    await loaded.server.close();
  }
}

function runPool(jobs, output, manifest) {
  const concurrency = Math.min(2, jobs.length);
  return new Promise((resolve, reject) => {
    let next = 0, exited = 0, failed = null;
    const slots = new Array(jobs.length);
    const workers = [];
    const fail = error => {
      if (!failed) failed = error;
      for (const child of workers) child.kill();
    };
    const finish = () => {
      manifest.routes = slots.filter(Boolean);
      if (failed) reject(failed);
      else if (manifest.routes.length !== jobs.length) reject(new Error('headless pool lost a route summary'));
      else resolve();
    };
    for (let index = 0; index < concurrency; index++) {
      const child = spawn(process.execPath, [__filename], {env: {...process.env, M5_HEADLESS_WORKER: '1', M5_EVIDENCE_DIR: output}, stdio: ['pipe', 'pipe', 'inherit']});
      child.stdin.on('error', () => {});
      let inflight = 0, closed = false;
      const assign = () => {
        if (closed || failed || inflight > 0) return;
        if (next >= jobs.length) { closed = true; child.stdin.end(); return; }
        inflight++;
        child.stdin.write(`${JSON.stringify(jobs[next++])}\n`);
      };
      readline.createInterface({input: child.stdout, crlfDelay: Infinity}).on('line', line => {
        if (!line) return;
        let summary;
        try { summary = JSON.parse(line); }
        catch (error) { fail(error); return; }
        const slot = jobs.findIndex(job => job.build === summary.build && job.seed === summary.seed && job.repetition === summary.repetition);
        if (slot < 0 || slots[slot]) { fail(new Error(`unexpected headless summary ${line}`)); return; }
        slots[slot] = summary;
        console.log(line);
        inflight--;
        assign();
      });
      child.on('close', (code, signal) => {
        exited++;
        if (!failed && code !== 0) failed = new Error(`headless worker exited ${code ?? signal}`);
        if (exited === concurrency) finish();
      });
      workers.push(child);
      assign();
    }
  });
}

if (process.env.M5_HEADLESS_WORKER === '1') {
  workerMain().catch(error => { console.error(error); process.exit(1); });
} else {
  (async () => {
    const output = evidenceDir();
    fs.mkdirSync(output, {recursive: true});
    const manifest = blankManifest();
    const jobs = plannedJobs();
    try {
      if (os.cpus().length < 2 || jobs.length < 2) await runSerial(jobs, output, manifest);
      else await runPool(jobs, output, manifest);
      assert.equal(sourceFingerprint(), manifest.sourceFingerprint, 'source changed during acceptance');
      manifest.passed = true;
    } finally {
      manifest.endedAt = new Date().toISOString();
      manifest.finalSourceFingerprint = sourceFingerprint();
      manifest.loadAtEnd = os.loadavg();
      fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
