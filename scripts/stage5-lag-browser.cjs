/** Recorded NET6 stream -> real WsGameClient/RemoteSession/BoardScene, one connected Chrome tab at a time. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { WebSocketServer } = require('ws');
const { connect } = require(process.env.CODEX_BROWSER_CLIENT);
const out = process.env.STAGE5_OUT || 'artifacts/stage5-lag';
const assets = process.env.STAGE5_ASSETS;
const vitePort = Number(process.env.STAGE5_VITE_PORT || 53147);
const base = `http://127.0.0.1:${vitePort}`, origin = 'http://127.0.0.1:8796';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sockets = new Set();
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!assets || !req.url.startsWith('/assets/')) { res.writeHead(404).end(); return; }
  const relative = decodeURIComponent(req.url.slice('/assets/'.length).split('?')[0]);
  if (relative.split('/').includes('..')) { res.writeHead(400).end(); return; }
  const file = path.join(assets, relative);
  res.setHeader('Content-Type', relative.endsWith('.json') ? 'application/json' : relative.endsWith('.png') ? 'image/png' : 'application/octet-stream');
  const stream = fs.createReadStream(file); stream.on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); }); stream.pipe(res);
});
const wss = new WebSocketServer({ server });
let current, timer;
const send = (ws, message) => ws.readyState === 1 && ws.send(JSON.stringify(message));
function snapshot(ws, phase) {
  const f = current, s = f[phase], view = structuredClone(s.view);
  view.phase.serverNow = Date.now(); view.phase.endsAt = Date.now() + 60000;
  send(ws, { type: 'view', roomId: f.roomId, roomRevision: s.roomRevision, view });
  send(ws, { type: 'state', roomId: f.roomId, round: f.round, seatRevision: s.seatRevision, state: s.state });
}
wss.on('connection', ws => {
  sockets.add(ws); ws.on('close', () => sockets.delete(ws));
  send(ws, { type: 'receipt', commandId: 1, ok: true, result: { kind: 'resumed', seatId: current.seatId, roomId: current.roomId, connectionEpoch: 1, lastCommandId: 1 } });
  snapshot(ws, 'prep');
});
function combat() {
  const f = current, s = f.stream, envelope = { roomId: f.roomId, round: f.round, battleId: s.battleId, revision: s.revision, seatId: f.seatId, watch: false };
  for (const ws of sockets) { snapshot(ws, 'battle'); send(ws, { ...envelope, type: 'combat-open', initial: s.initial, frame: s.ticks[0], unitIds: s.unitIds }); }
  const start = performance.now(); let next = 1;
  timer = setInterval(() => {
    const through = Math.min(s.ticks.length - 1, Math.floor((performance.now() - start) / 50));
    if (through >= next) {
      for (const ws of sockets) send(ws, { type: 'combat-chunk', chunks: [{ ...envelope, fromTick: next, throughTick: through, ticks: s.ticks.slice(next, through + 1) }] });
      next = through + 1;
    }
    if (next >= s.ticks.length) { clearInterval(timer); for (const ws of sockets) send(ws, { ...envelope, type: 'combat-end', throughTick: s.terminal.tick, terminal: s.terminal }); }
  }, 25);
}
async function traceStart(cdp) {
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.gc,blink.user_timing', transferMode: 'ReturnAsStream' });
}
async function traceStop(cdp, key) {
  const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(`${out}/${key}.cpuprofile`, JSON.stringify(profile));
  const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve)); await cdp.send('Tracing.end');
  const { stream } = await complete; let data = '';
  for (;;) { const part = await cdp.send('IO.read', { handle: stream }); data += part.data; if (part.eof) break; }
  await cdp.send('IO.close', { handle: stream }); fs.writeFileSync(`${out}/${key}.trace.json`, data);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(resolve => server.listen(8796, '127.0.0.1', resolve));
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(`${out}/vite.log`); vite.stdout.pipe(log); vite.stderr.pipe(log);
  let browser;
  try {
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(Error('Vite startup failed')), 10000);
      vite.stdout.on('data', data => { if (String(data).includes('Local:')) { clearTimeout(deadline); resolve(); } });
      vite.once('exit', code => { clearTimeout(deadline); reject(Error(`Vite exited ${code}`)); });
    });
    browser = await connect();
    const modes = (process.env.STAGE5_MODES || '2d,3d').split(',');
    const rounds = (process.env.STAGE5_ROUNDS || '2-5,5-1').split(',');
    const repeats = Number(process.env.STAGE5_REPEATS || 2);
    for (let rep = 1; rep <= repeats; rep++) for (const mode of modes) for (const round of rounds) {
      current = JSON.parse(fs.readFileSync(`${out}/fixture-42-${round}.json`, 'utf8'));
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      try {
        const page = await context.newPage(), errors = [], failed = [];
        page.on('pageerror', e => { errors.push(e.stack || String(e)); console.error('pageerror', e.stack || String(e)); }); page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
        page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));
        if (assets) await page.route(`${origin}/assets/**`, async route => {
          const relative = decodeURIComponent(new URL(route.request().url()).pathname.slice('/assets/'.length));
          if (relative.split('/').includes('..')) throw Error('Invalid asset path');
          try { await route.fulfill({ status: 200, contentType: relative.endsWith('.json') ? 'application/json' : 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(path.join(assets, relative)) }); }
          catch (e) { console.error('asset', relative, e.message); await route.fulfill({ status: 404, body: '' }); }
        });
        await page.routeWebSocket('ws://127.0.0.1:8796/', ws => {
          const socket = { readyState: 1, send: text => ws.send(text) }; sockets.add(socket);
          ws.onClose(() => { socket.readyState = 3; sockets.delete(socket); });
          send(socket, { type: 'receipt', commandId: 1, ok: true, result: { kind: 'resumed', seatId: current.seatId, roomId: current.roomId, connectionEpoch: 1, lastCommandId: 1 } });
          snapshot(socket, 'prep');
        });
        // Diagnostic A/B only: avoid assigning identical float text, without changing a product file.
        if (process.env.STAGE5_TEXT_CACHE === '1') await page.route(/\/src\/stats\/combat-feedback-renderer\.ts(?:\?|$)/, async route => {
          const response = await route.fetch(), code = await response.text();
          const changed = code.replace(/item\.label\.textContent = ([^;]+);/, 'const nextLabelText = $1; if (item.label.textContent !== nextLabelText) item.label.textContent = nextLabelText;');
          if (changed === code) throw Error('Feedback diagnostic replacement did not match');
          await route.fulfill({ response, body: changed });
        });
        await page.route(/\/stage5-lag\.html(?:\?|$)/, route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta charset="UTF-8"></head><body><div id="app"></div><script type="module">await import("/scripts/stage5-lag-browser-probe.ts"); await import("/src/main.ts");</script></body></html>' }));
        await page.goto(`${base}/stage5-lag.html?mode=online&server=ws&ws=ws://127.0.0.1:8796&render=${mode}&debug3d${mode === '3d' && assets ? `&assets3d=${origin}/assets/` : ''}`);
        try { await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active'); }
        catch (e) { console.error('boot', await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 1000), probe: !!window.__stage5, debug: window.__CAT_DEBUG__?.read(), resources: performance.getEntriesByType('resource').slice(-8).map(r => r.name) })), failed); throw e; }
        if (mode === '3d') await page.waitForFunction(() => window.__render3d?.renderer);
        await sleep(Number(process.env.STAGE5_WARMUP || (mode === '3d' && assets ? 15000 : 3000)));
        const cdp = await context.newCDPSession(page);
        for (const phase of ['prep', 'combat']) {
          const key = `client-${mode}-${round}-${phase}-${rep}${assets ? '-assets' : '-placeholder'}${process.env.STAGE5_TEXT_CACHE === '1' ? '-textcache' : ''}`;
          console.log(key);
          await traceStart(cdp); await page.evaluate(() => window.__stage5.start());
          if (phase === 'combat') combat();
          const duration = phase === 'prep' ? 8000 : Math.min(Number(process.env.STAGE5_COMBAT_MS || 25000), current.stream.terminal.tick * 50 + 1000);
          await sleep(duration);
          const result = await page.evaluate(() => window.__stage5.stop());
          await traceStop(cdp, key);
          result.meta = { mode, round, phase, rep, duration, version: browser.version(), assets: assets || null, errors, failed,
            unitCount: current.stream.initial.units.length, terminalTick: current.stream.terminal.tick };
          result.assetStatus = await page.evaluate(() => ({ state: document.querySelector('[data-debug="render3d-layer"]')?.getAttribute('data-state'),
            detail: document.querySelector('[data-debug="render3d-status"]')?.textContent, load: window.__render3dLoad }));
          fs.writeFileSync(`${out}/${key}.json`, JSON.stringify(result));
          await page.screenshot({ path: `${out}/${key}.png` });
        }
        clearInterval(timer);
      } finally { clearInterval(timer); await context.close(); }
    }
  } finally {
    clearInterval(timer); if (browser) await browser.close();
    wss.close(); server.close(); vite.kill('SIGTERM'); log.end();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
