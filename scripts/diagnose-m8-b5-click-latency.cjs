/* Read-only B5 investigation, not an acceptance gate. Runs the unchanged M7
 * prelude through the double tap, preserving its inputs/assertions/background
 * contexts. Alternates immutable production builds; every outcome is retained.
 * Usage: node scripts/diagnose-m8-b5-click-latency.cjs --base=/path/dist
 *   --b5=/path/dist --out=artifacts/m8-b5-click-study --pairs=5 --profile-pairs=1
 * Source maps permit mapping the separate CPU profiles back to original TS.
 */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const os = require('node:os'), crypto = require('node:crypto'), { spawn } = require('node:child_process');
const arg = (name, fallback) => (process.argv.find(a => a.startsWith(`--${name}=`)) ?? `=${fallback}`).split('=').slice(1).join('=');
const out = path.resolve(arg('out', 'artifacts/m8-b5-click-study'));
const pairs = Number(arg('pairs', '5')), profilePairs = Number(arg('profile-pairs', '1'));
const builds = { base: path.resolve(arg('base', '')), b5: path.resolve(arg('b5', '')) };
const shas = { base: '97f38a0e787a4edcb35df4a59823bb1d106def67', b5: arg('b5-sha', 'e10c2541e57797b38bbd62a98b600739a94eb0b7') };
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const original = fs.readFileSync(path.join(__dirname, 'verify-m7-presentation.cjs'), 'utf8');

function installProbe({ profile }) {
  const events = [], tasks = [], timers = [], animations = [];
  const ids = new WeakMap(); let serial = 0;
  const target = e => e.target?.closest?.('[data-debug]')?.dataset.debug;
  const take = (e, phase) => {
    const name = target(e); if (!name?.startsWith('mobile:')) return;
    if (!ids.has(e)) ids.set(e, serial++);
    const id = ids.get(e), at = performance.now();
    events.push({ id, type: e.type, phase, name, at, eventTimeStamp: e.timeStamp, trusted: e.isTrusted });
    if (profile && e.type === 'click') performance.mark(`click-study:${id}:${phase}:${name}`);
    if (e.type === 'click' && phase === 'bubble') setTimeout(() => timers.push({ id, at: performance.now() }), 0);
  };
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) {
    window.addEventListener(type, e => take(e, 'capture'), true);
    window.addEventListener(type, e => take(e, 'bubble'));
  }
  const observer = new PerformanceObserver(list => {
    for (const e of list.getEntries()) tasks.push({ startTime: e.startTime, duration: e.duration });
  });
  observer.observe({ type: 'longtask', buffered: true });
  if (profile && PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) animations.push({ startTime: e.startTime, duration: e.duration,
        blockingDuration: e.blockingDuration, renderStart: e.renderStart, styleAndLayoutStart: e.styleAndLayoutStart,
        scripts: e.scripts.map(s => ({ duration: s.duration, executionStart: s.executionStart, invoker: s.invoker,
          invokerType: s.invokerType, sourceURL: s.sourceURL, sourceFunctionName: s.sourceFunctionName,
          sourceCharPosition: s.sourceCharPosition, forcedStyleAndLayoutDuration: s.forcedStyleAndLayoutDuration })) });
    }).observe({ type: 'long-animation-frame', buffered: true });
  }
  window.__CLICK_STUDY__ = { events, tasks, timers, animations, timeOrigin: performance.timeOrigin };
}

function workerSource() {
  let s = original.slice(0, original.indexOf('    // Replay uses the same identity'));
  if (!s.endsWith('\n\n')) throw Error('M7 prelude marker changed');
  s = s.replace("require('playwright')", `require(${JSON.stringify(require.resolve('playwright'))})`);
  s = s.replace('async function touchGame(browser) {', `const installProbe = ${installProbe.toString()};\nasync function touchGame(browser) {`);
  const begin = s.indexOf('async function touchGame(browser) {'), go = s.indexOf('  await page.goto(url);', begin);
  s = s.slice(0, go) + `  await page.addInitScript(installProbe, { profile: process.argv.includes('--profile') });\n` + s.slice(go);
  s = s.replace('const report = { url, checks: [] };', `const report = { url, checks: [], browser: browser.version(), node: process.version,
    profile: process.argv.includes('--profile'), startedAt: new Date().toISOString(), loadAtStart: require('node:os').loadavg() };`);
  const marker = "      await touch.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);\n      await touch.page.waitForTimeout(40);\n      await touch.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);";
  if (!s.includes(marker)) throw Error('Original tap sequence changed');
  s = s.replace(marker, `      let profiler, tracer;
      if (report.profile) {
        profiler = await touch.context.newCDPSession(touch.page);
        await profiler.send('Profiler.enable'); await profiler.send('Profiler.setSamplingInterval', { interval: 1000 });
        tracer = await browser.newBrowserCDPSession();
        await tracer.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,toplevel,blink.user_timing', transferMode: 'ReturnAsStream' });
        await profiler.send('Profiler.start');
        report.beforeState = (await read(touch.page)).state;
      }
      const driver = { timeOrigin: performance.timeOrigin, firstStart: performance.now() };
      await touch.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      driver.firstEnd = performance.now();
      await touch.page.waitForTimeout(40);
      driver.secondStart = performance.now();
      await touch.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      driver.secondEnd = performance.now();
      report.driver = driver;`);
  s = s.replace('      const touched = (await read(touch.page)).state;', `      const touched = (await read(touch.page)).state;
      report.probe = await touch.page.evaluate(() => window.__CLICK_STUDY__);
      const clicks = report.probe.events.filter(e => e.type === 'click' && e.phase === 'capture');
      const first = clicks.find(e => e.name === 'mobile:continue'), second = clicks.find(e => first && e.id > first.id);
      report.measurement = { phase: touched.phase, round: touched.round, clickGapMs: second.at - first.at,
        handlers: [first, second].map(e => ({ name: e.name, at: e.at,
          duration: report.probe.events.find(b => b.id === e.id && b.phase === 'bubble').at - e.at,
          eventQueueMs: e.at - e.eventTimeStamp })),
        pointerEvents: report.probe.events.filter(e => e.at >= first.at - 1500 && e.at <= second.at + 1000),
        longTasks: report.probe.tasks.filter(e => e.startTime + e.duration >= first.at - 1000 && e.startTime <= second.at + 700),
        firstTapApiMs: driver.firstEnd - driver.firstStart, waitApiMs: driver.secondStart - driver.firstEnd,
        secondTapApiMs: driver.secondEnd - driver.secondStart };
      if (profiler) {
        const { profile } = await profiler.send('Profiler.stop'); fs.writeFileSync(path.join(out, 'cpu-profile.json'), JSON.stringify(profile));
        const done = new Promise(resolve => tracer.once('Tracing.tracingComplete', resolve));
        await tracer.send('Tracing.end'); const { stream } = await done;
        let trace = ''; for (;;) { const part = await tracer.send('IO.read', { handle: stream }); trace += part.data; if (part.eof) break; }
        await tracer.send('IO.close', { handle: stream }); fs.writeFileSync(path.join(out, 'trace.json'), trace);
        await profiler.detach(); await tracer.detach();
      }
      console.log(JSON.stringify({ measurement: report.measurement }));`);
  s += `    report.passed = true;
  } catch (error) { report.passed = false; report.error = String(error.stack || error); process.exitCode = 1;
    console.error(String(error));
  } finally { report.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
})();\n`;
  return s;
}
function serve(dir) {
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(dir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.map': 'application/json' };
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const dir of Object.values(builds)) if (!fs.existsSync(path.join(dir, 'index.html'))) throw Error(`Missing build ${dir}`);
  const worker = path.join(out, 'worker.cjs'), source = workerSource(); fs.writeFileSync(worker, source);
  const metadata = { shas, builds, gateHash: hash(original), workerHash: hash(source), node: process.version,
    cpu: os.cpus()[0]?.model, cpuCount: os.cpus().length, memory: os.totalmem(), pairs, profilePairs,
    assets: Object.fromEntries(Object.entries(builds).map(([label,dir]) => [label, Object.fromEntries(fs.readdirSync(path.join(dir,'assets')).filter(f => f.endsWith('.js')).map(f => [f,hash(fs.readFileSync(path.join(dir,'assets',f)))]))])) };
  fs.writeFileSync(path.join(out, 'metadata.json'), JSON.stringify(metadata, null, 2));
  const servers = { base: await serve(builds.base), b5: await serve(builds.b5) }, results = [];
  const schedule = [];
  for (const [profile, count] of [[false,pairs],[true,profilePairs]]) for(let i=1;i<=count;i++) for(const label of i%2?['base','b5']:['b5','base']) schedule.push({profile,index:i,label});
  try {
    for (const spec of schedule) {
      const name = `${spec.profile?'profile':'timing'}-${spec.index}-${spec.label}`, folder = path.join(out,name);
      fs.mkdirSync(folder,{recursive:true}); const url = `http://127.0.0.1:${servers[spec.label].address().port}`;
      fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({active:name,completed:results.length,total:schedule.length}));
      console.log(`START ${name}`);
      const code = await new Promise((resolve,reject) => {
        const child = spawn(process.execPath,[worker,`--url=${url}`,`--out=${folder}`,...(spec.profile?['--profile']:[])],{stdio:['ignore','pipe','pipe']});
        child.on('error',reject); child.on('exit',resolve);
        for(const stream of [child.stdout,child.stderr]) stream.on('data',data=>{fs.appendFileSync(path.join(folder,'worker.log'),data); if(!data.toString().includes('measurement')) process.stdout.write(`${name}: ${data}`);});
      });
      const report = JSON.parse(fs.readFileSync(path.join(folder,'report.json')));
      const summary = { ...spec,name,exitCode:code,passed:report.passed,measurement:report.measurement,error:report.error };
      results.push(summary); fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
      console.log(`END ${name} ${JSON.stringify({passed:summary.passed,gap:summary.measurement?.clickGapMs,handlers:summary.measurement?.handlers.map(x=>x.duration),firstApi:summary.measurement?.firstTapApiMs,secondApi:summary.measurement?.secondTapApiMs})}`);
    }
  } finally { for(const server of Object.values(servers)) server.close(); }
  fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({completed:results.length,total:schedule.length,done:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
