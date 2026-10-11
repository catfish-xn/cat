/* Fixed-load diagnostic/paired runner. Budget acceptance still uses verify-m8-performance.cjs.
 * Same Vite SSR loader, fixture, seeds 0 warmup then 1..30, hrtime stepCombat boundary,
 * nearest-rank percentiles, no per-combat GC; no samples removed. Profile is diagnostic only.
 */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const arg = (key, fallback) => process.argv.find(x => x.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = path.resolve(arg('root', path.join(__dirname, '..'))), mode = arg('mode', 'measure');
const out = path.resolve(arg('out', path.join(root, 'artifacts/node3-pressure')));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read = p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
function distribution(values) {
  const sorted = Float64Array.from(values).sort(), at = p => sorted[Math.ceil(sorted.length * p) - 1];
  return { count: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99), max: at(1) };
}
function summarize(profiles) {
  const self = new Map(), inclusive = new Map(), categories = new Map(); let total = 0;
  for (const profile of profiles) {
    const nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map();
    for (const n of nodes.values()) for (const c of n.children ?? []) parents.set(c, n.id);
    const key = n => `${n.callFrame.functionName || '(anonymous)'} @ ${n.callFrame.url}:${n.callFrame.lineNumber + 1}`;
    for (let i = 0; i < profile.samples.length; i++) {
      const us = profile.timeDeltas[i], leaf = nodes.get(profile.samples[i]), stack = []; let n = leaf;
      total += us; self.set(key(leaf), (self.get(key(leaf)) ?? 0) + us);
      while (n) { stack.push(n); n = nodes.get(parents.get(n.id)); }
      for (const k of new Set(stack.map(key))) inclusive.set(k, (inclusive.get(k) ?? 0) + us);
      const frames = stack.map(n => n.callFrame);
      let category = 'combat/other';
      if (leaf.callFrame.functionName === '(garbage collector)') category = 'GC';
      else if (frames.some(f => f.functionName === 'structuredClone' || /canonicalContent|canonicalSource|counterIdentity|sourceKey/.test(f.functionName))) category = 'copy/serialization';
      else if (frames.some(f => /^(validate|assert|integer)/.test(f.functionName))) category = 'validation';
      else if (frames.some(f => /triggers\.ts$|combat-effects\.ts$/.test(f.url))) category = 'events/triggers';
      else if (frames.some(f => /node:inspector/.test(f.url))) category = 'profiler overhead';
      categories.set(category, (categories.get(category) ?? 0) + us);
    }
  }
  const rows = map => [...map].sort((a,b) => b[1]-a[1]).map(([name,us]) => ({ name, ms: us / 1000, percent: us / total * 100 }));
  return { sampledMs: total / 1000, categories: rows(categories), self: rows(self).slice(0,40), inclusive: rows(inclusive).slice(0,40), rendering: '0: no renderer loaded; categories use sampled stack attribution, not separate timers' };
}
(async () => {
  if (!['measure','profile'].includes(mode)) throw Error('mode must be measure or profile');
  fs.mkdirSync(out, { recursive: true });
  const fixture = require(path.join(root, 'tests/fixtures/m8/pressure-9v9.cjs'));
  const { createServer } = await import(require.resolve('vite', { paths: [root] }));
  const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  const report = { mode, startedAt: new Date().toISOString(), root, sha: git('rev-parse','HEAD'), srcTree: git('rev-parse','HEAD:src'), dirty: git('status','--porcelain'), node: process.version,
    cpuModel: os.cpus()[0]?.model, cpuQuota: read('/sys/fs/cgroup/cpu.max'), memoryLimit: read('/sys/fs/cgroup/memory.max'), specSha256: hash(fixture.SPEC),
    timing: 'hrtime.bigint immediately around stepCombat only; Vite SSR source, no rendering; seeds 0 warmup then 1..30 per variant; GC only after warmup; nearest rank; all samples retained',
    threshold: { p95: 5, p99: 10 }, variants: {} };
  try {
    const m = await fixture.loadModules(server);
    const run = (built, measured) => {
      let state = built.step.state, events = built.step.events.length; const ticks = [];
      while (state.status !== 'finished') {
        const start = process.hrtime.bigint(), next = m.combat.stepCombat(state), ms = Number(process.hrtime.bigint() - start) / 1e6;
        state = next.state; events += next.events.length; if (measured) ticks.push(ms);
      }
      return { ticks, events, result: state.result, endTick: state.tick, state };
    };
    for (const variant of ['distinct','mirror']) {
      run(fixture.build(m,0,variant),false); global.gc?.();
      const combats = [], samples = [], profiles = [];
      let session;
      if (mode === 'profile') { const { Session } = require('node:inspector/promises'); session = new Session(); session.connect(); await session.post('Profiler.enable'); }
      for (let seed = 1; seed <= 30; seed++) {
        const built = fixture.build(m,seed,variant);
        if (session) await session.post('Profiler.start');
        const result = run(built,true);
        if (session) { const { profile } = await session.post('Profiler.stop'); profiles.push(profile); }
        samples.push(...result.ticks);
        combats.push({ seed, fixture: built.summary, events: result.events, result: result.result, endTick: result.endTick, stateHash: hash(result.state), tickMs: distribution(result.ticks) });
      }
      session?.disconnect();
      const stats = distribution(samples);
      report.variants[variant] = { tickMs: stats, pass: mode === 'measure' && stats.p95 <= 5 && stats.p99 <= 10, combats, samples };
      if (profiles.length) { fs.writeFileSync(path.join(out,`${variant}.profiles.json`),JSON.stringify(profiles)); report.variants[variant].profile = summarize(profiles); }
      fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
      console.log(JSON.stringify({ variant, tickMs: stats, categories: report.variants[variant].profile?.categories, topSelf: report.variants[variant].profile?.self.slice(0,12) }));
    }
    report.finishedAt = new Date().toISOString(); report.dirtyAfter = git('status','--porcelain');
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  } finally { await server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
