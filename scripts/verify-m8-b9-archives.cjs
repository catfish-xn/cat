/* N2-P2-5 native IndexedDB evidence: one unreadable or incompatible completed archive is quarantined by runId and never
 * hides the good archives around it; a storage-wide read failure stays an explicit save failure, never an empty list.
 * Real SaveRepository, real MatchApplication, complete archives from the public cannon seed-42 route generated under the current rules
 * (the recorded docs/evidence/m8-b9 golden is a legacy schema-6 route that current startMatchCombat cannot replay). */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright'), { sourceFingerprint } = require('./m5-evidence.cjs');
(async () => {
  const started = performance.now(), output = process.env.M8_ARCHIVES_EVIDENCE_DIR ?? 'artifacts/m8-b9-archives', root = path.resolve(__dirname, '..');
  fs.mkdirSync(output, { recursive: true });
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    sourceFingerprint: sourceFingerprint(), node: process.version, kind: 'N2-P2-5 per-archive read isolation; native IndexedDB; real MatchApplication', startedAt: new Date().toISOString(), passed: false };
  let server, browser, envelope;
  try {
    const { createServer } = await import('vite');
    server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
      plugins: [{ name: 'm8-archives-page', configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url === '/__m8_archives') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><link rel="icon" href="data:,"><body><div id="save-root"></div><div id="replay-root"></div></body>'); return; }
        if (req.url === '/__m8_archives/envelope') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(envelope)); return; }
        next();
      }); } }] });
    await server.listen();
    const api = await server.ssrLoadModule('/src/simulation/match.ts'), { digestContent } = await server.ssrLoadModule('/src/simulation/content/index.ts'), { M8_VERSION } = await server.ssrLoadModule('/src/simulation/m8/version.ts');
    const { recordVersion } = await server.ssrLoadModule('/src/replay/history.ts');
    const route = await require('./generate-m5-route.cjs').run(api, { build: 'cannon', seed: 42, retainStates: true });
    const battles = route.rounds.map(r => { const events = r.events.filter(e => e.domain === 'combat');
      return { version: recordVersion(r.before), roundId: r.before.m8.round.roundId, runId: 'good-a', combatId: r.after.combat.combatId, context: r.before,
        initial: api.startMatchCombat(r.before).state.combat, events, endTick: r.after.combat.tick, nextEventSeq: r.after.combat.nextEventSeq, result: r.after.combat.result,
        stateHash: digestContent(r.after.combat), eventHash: digestContent(events) }; });
    envelope = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion, runId: 'good-a', createdAt: '2026-10-11T00:00:00Z', match: route.final, battles, currentBattle: null };
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
    report.browser = browser.version();
    const page = await (await browser.newContext()).newPage();
    report.errors = [];
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto(new URL('__m8_archives', server.resolvedUrls.local[0]).href);
    report.results = await page.evaluate(async () => {
      const { SaveRepository, SaveError } = await import('/src/persistence/repository.ts'), { M8_NAMESPACE } = await import('/src/persistence/legacy-records.ts');
      const { createMatch } = await import('/src/simulation/match.ts'), { MatchApplication } = await import('/src/m6/application.ts'), { MatchSession } = await import('/src/rendering/match-session.ts');
      const results = [];
      const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
      const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const template = await (await fetch('/__m8_archives/envelope')).json(), battles = template.battles.length;
      const named = (runId, change) => { const file = structuredClone({ ...template, runId, battles: template.battles.map(b => ({ ...b, runId })) }); change?.(file); return file; };
      const reset = () => new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase(M8_NAMESPACE); r.onsuccess = resolve; r.onerror = () => reject(r.error); r.onblocked = () => reject(Error('reset blocked')); });
      const raw = async (stores, mode, body) => { const db = await new Promise((resolve, reject) => { const o = indexedDB.open(M8_NAMESPACE, 1); o.onsuccess = () => resolve(o.result); o.onerror = () => reject(o.error); });
        try { const tx = db.transaction(stores, mode), done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); const value = await body(tx); await done; return value; } finally { db.close(); } };
      // Seeds completed archives in this exact list order plus an unrelated active slot; returns the current slot for the preservation check.
      const seed = async (files, damage) => {
        await reset();
        const repo = new SaveRepository(); let token = null;
        try {
          for (const file of files) token = await repo.activate(token, file);
          token = await repo.activate(token, { ...template, runId: 'active', match: createMatch(42), battles: [], currentBattle: null });
          await raw(['metadata'], 'readwrite', async tx => { const rows = await req(tx.objectStore('metadata').get('completed'));
            if (rows.length !== files.length) throw Error('seed retention'); tx.objectStore('metadata').put(files.map(f => rows.find(r => r.runId === f.runId)), 'completed'); });
          if (damage) await raw(['runs', 'battles'], 'readwrite', async tx => damage(tx));
          return JSON.stringify(await repo.readCurrent());
        } finally { repo.close(); }
      };
      const load = async () => {
        const statuses = [], app = new MatchApplication(new MatchSession(createMatch(42)), { replace() {}, clearInput() {}, status: s => statuses.push(s) });
        try { while (app.busy) await new Promise(r => setTimeout(r, 10));
          const options = [...document.querySelectorAll('#replay-root select option')].filter(o => o.value !== '').map(o => o.textContent);
          return { options, quarantined: app.debug().quarantinedArchives, status: app.debug().status?.kind ?? null, statuses };
        } finally { app.dispose(); }
      };
      const shows = (options, runId) => options.filter(t => t.includes(runId.slice(-8))).length;
      const after = async (current, good) => { const repo = new SaveRepository();
        try { const kept = await Promise.all(good.map(async id => (await repo.readCompleted(id)).battles.length)); return { preserved: JSON.stringify(await repo.readCurrent()) === current, kept }; }
        finally { repo.close(); } };
      const isolated = async (name, files, damage, good) => {
        const current = await seed(files, damage), view = await load(), stored = await after(current, good);
        check(view.options.length === good.length * battles && good.every(id => shows(view.options, id) === battles), `${name}: every good archive listed whole`);
        check(view.quarantined === files.length - good.length && view.status !== 'failed', `${name}: bad archive quarantined, load not failed`);
        check(view.statuses.length === 1 && view.statuses[0].startsWith(`已隔离 ${files.length - good.length} 个`) && !view.statuses.some(s => s.includes('保存失败')), `${name}: quarantine notice, no save failure`);
        check(stored.preserved && stored.kept.every(n => n === battles), `${name}: current slot and good archives untouched`);
      };
      const goodA = named('good-a'), goodB = named('good-b'), bad = named('bad');
      // Positive control: two complete archives give every battle of both.
      { const current = await seed([goodA, goodB]), view = await load(), stored = await after(current, ['good-a', 'good-b']);
        check(view.options.length === 2 * battles && view.quarantined === 0 && view.statuses.length === 0 && stored.preserved, `positive: two good archives list ${2 * battles} choices`); }
      // Missing run row (metadata still references it) and missing battle row, before, after and between good archives.
      const missingRun = tx => tx.objectStore('runs').delete('bad');
      const missingBattle = tx => tx.objectStore('battles').delete(['bad', template.battles[17].combatId]);
      for (const [kind, damage] of [['missing run', missingRun], ['missing battle', missingBattle]]) {
        await isolated(`${kind} before good`, [bad, goodA], damage, ['good-a']);
        await isolated(`${kind} after good`, [goodA, bad], damage, ['good-a']);
        await isolated(`${kind} between good`, [goodA, bad, goodB], damage, ['good-a', 'good-b']);
      }
      // The eight version/hash negative controls of tests/m8-b9-compatibility.test.ts, through the stored application path.
      const controls = [
        ['context schema', f => { f.battles[0].context.schemaVersion = 5; }],
        ['context content version', f => { f.battles[0].context.contentVersion = 's13-14.24b-slice-v1'; }],
        ['context digest', f => { f.battles[0].context.contentDigest = 'fnv1a32-utf16:00000000'; }],
        ['record version digest', f => { f.battles[0].version.contentDigest = 'fnv1a32-utf16:00000000'; }],
        ['record rules version', f => { f.battles[0].version.rulesVersion = 'm5-14.24b-v1'; }],
        ['match digest', f => { f.match.contentDigest = 'fnv1a32-utf16:00000000'; }],
        ['event hash', f => { f.battles[0].eventHash = 'fnv1a32-utf16:00000000'; }],
        ['round id', f => { f.battles[0].roundId = 'x-x'; }],
      ];
      for (const [name, change] of controls) await isolated(`incompatible ${name}`, [named('bad', change), goodA], null, ['good-a']);
      // A validation failure that arrives after a newer activation never quarantines anything or changes that activation.
      {
        await seed([goodA, goodB]);
        const nativeRead = SaveRepository.prototype.readCompleted, statuses = [], held = {};
        const app = new MatchApplication(new MatchSession(createMatch(42)), { replace() {}, clearInput() {}, status: s => statuses.push(s) });
        const nativeConfirm = window.confirm; window.confirm = () => true;
        try {
          while (app.busy) await new Promise(r => setTimeout(r, 10));
          SaveRepository.prototype.readCompleted = async function (runId) {
            const actual = await nativeRead.call(this, runId);
            if (runId === 'good-b' && !held.started) { held.started = true; await new Promise((_, reject) => { held.release = () => reject(new SaveError('validation', '档案已丢失')); }); }
            return actual;
          };
          // The same refresh a terminal save starts (void loadArchives); it reads good-a, then holds good-b.
          const stale = app.loadArchives();
          while (!held.release) await new Promise(r => setTimeout(r, 10));
          const input = document.querySelector('[data-debug=m6-import]'), transfer = new DataTransfer();
          transfer.items.add(new File([JSON.stringify({ ...template, runId: 'fresh', match: createMatch(7), battles: [], currentBattle: null })], 'fresh.json', { type: 'application/json' }));
          input.files = transfer.files; input.dispatchEvent(new Event('change'));
          while (app.debug().runId !== 'fresh' || app.busy) await new Promise(r => setTimeout(r, 10));
          const snapshot = () => ({ token: app.debug().token, status: app.debug().status, quarantined: app.debug().quarantinedArchives, statuses: [...statuses],
            options: [...document.querySelectorAll('#replay-root select option')].filter(o => o.value !== '').map(o => o.textContent) });
          const before = snapshot();
          check(before.quarantined === 0 && before.options.length === 2 * battles && before.status?.kind === 'saved', 'late failure: new activation lists both good archives');
          SaveRepository.prototype.readCompleted = nativeRead; held.release(); await stale;
          check(JSON.stringify(snapshot()) === JSON.stringify(before), 'late failure: stale validation error leaves list, quarantine, status and token unchanged');
        } finally { SaveRepository.prototype.readCompleted = nativeRead; window.confirm = nativeConfirm; app.dispose(); }
      }
      // Storage-wide failure while reading an archive is an explicit save failure, not an empty or partial library.
      const nativeRead = SaveRepository.prototype.readCompleted;
      for (const [name, failure] of [['unavailable', () => new DOMException('controlled storage failure', 'InvalidStateError')], ['abort', () => new DOMException('controlled abort', 'AbortError')]]) {
        await seed([goodA, goodB]);
        SaveRepository.prototype.readCompleted = async function (runId) { if (runId === 'good-b') throw failure(); return nativeRead.call(this, runId); };
        let view; try { view = await load(); } finally { SaveRepository.prototype.readCompleted = nativeRead; }
        check(view.status === 'failed' && view.options.length === 0 && view.quarantined === 0 && view.statuses.length === 1 && view.statuses[0].startsWith('保存失败'), `storage ${name}: explicit failure, never read as quarantine or empty success`);
      }
      await reset();
      return results;
    });
    assert.deepEqual(report.errors, [], 'no unexpected browser errors');
    assert.equal(sourceFingerprint(), report.sourceFingerprint, 'source changed during evidence');
    report.passed = true;
  } catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    report.endedAt = new Date().toISOString(); report.durationMs = performance.now() - started; report.finalSourceFingerprint = sourceFingerprint();
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await server?.close();
    console.log(JSON.stringify({ passed: report.passed, checks: report.results?.length, durationMs: Math.round(report.durationMs), failure: report.failure }));
  }
})();
