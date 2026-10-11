/* B9 D2-A native IndexedDB evidence: the M7 library is read-only, listed once per record, exported in its
 * original format1 shape, never created, never written, and never touched by M8 saves. Module-level
 * evidence (no UI claim); U7 UI wiring is covered by the browser routes. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright'), { sourceFingerprint } = require('./m5-evidence.cjs');
const { load } = require('../tests/fixtures/m6-saves/load.cjs');
const FIXTURES = { active: '04-combat-tick40-with-history.json.gz', settlement: '05-settlement.json.gz', gameOver: '07-game-over.json.gz' };
(async () => {
  const started = performance.now(), output = process.env.M8_LEGACY_EVIDENCE_DIR ?? 'artifacts/m8-b9-legacy';
  fs.mkdirSync(output, { recursive: true });
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    sourceFingerprint: sourceFingerprint(), node: process.version, kind: 'B9 read-only M7 library reader; native IndexedDB; no UI success claim', startedAt: new Date().toISOString(), passed: false };
  let server, browser;
  try {
    const { createServer } = await import('vite');
    server = await createServer({ root: path.resolve(__dirname, '..'), server: { host: '127.0.0.1', port: 5197, strictPort: true }, optimizeDeps: { noDiscovery: true, include: [] },
      plugins: [{ name: 'm8-legacy-page', configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url === '/__m8_legacy') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><link rel="icon" href="data:,"><body></body>'); return; }
        const fixture = req.url?.startsWith('/__fixture/') ? Object.entries(FIXTURES).find(([key]) => req.url === `/__fixture/${key}`) : null;
        if (fixture) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(load(fixture[1]))); return; }
        next();
      }); } }] });
    await server.listen();
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
    report.browser = browser.version();
    const page = await (await browser.newContext()).newPage();
    report.errors = [];
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto('http://127.0.0.1:5197/__m8_legacy');
    report.results = await page.evaluate(async () => {
      const { legacyRecords, LEGACY_NAMESPACE, M8_NAMESPACE } = await import('/src/persistence/legacy-records.ts');
      const { readCompatibility } = await import('/src/persistence/compatibility.ts');
      const { SaveRepository } = await import('/src/persistence/repository.ts');
      const { createMatch } = await import('/src/simulation/match.ts');
      const results = [];
      const check = (condition, name) => { if (!condition) throw Error(name); results.push(name); };
      const fixture = async key => (await fetch(`/__fixture/${key}`)).json();
      const names = async () => (await indexedDB.databases()).map(db => db.name);
      const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      // Original v1 materialize order (repository.ts at M7): ..., match, currentBattle, battles.
      const v1 = e => ({ kind: e.kind, saveFormatVersion: e.saveFormatVersion, replayFormatVersion: e.replayFormatVersion, runId: e.runId, createdAt: e.createdAt, match: e.match, currentBattle: e.currentBattle, battles: e.battles });
      const renamed = (e, runId) => ({ ...e, runId, battles: e.battles.map(b => ({ ...b, runId })), currentBattle: e.currentBattle && { ...e.currentBattle, runId } });
      const exported = async (record, requestId = crypto.randomUUID()) => legacyRecords.exportLegacy({ requestId, recordRef: record.recordRef });

      // 1. No legacy library: success with no records, and the library is not created.
      let list = await legacyRecords.listLegacyRecords();
      check(list.ok && list.records.length === 0, 'missing legacy library lists as empty success');
      const missing = await legacyRecords.exportLegacy({ requestId: 'r0', recordRef: { namespace: LEGACY_NAMESPACE, runId: 'nothing', fingerprint: 'x' } });
      check(!missing.ok && missing.reason === 'not-found' && missing.requestId === 'r0', 'export from a missing library is not-found with the same request identity');
      check(!(await names()).includes(LEGACY_NAMESPACE), 'reading never creates the legacy library');

      // 2. Seed a real M7 v1 library: active run plus two history runs (one is also the active run's id).
      const active = await fixture('active'), settlement = renamed(await fixture('settlement'), 'm7-history-settlement'), gameOver = renamed(await fixture('gameOver'), 'm7-history-over');
      const seeded = await new Promise((resolve, reject) => { const open = indexedDB.open(LEGACY_NAMESPACE, 1); open.onupgradeneeded = () => { for (const s of ['metadata', 'runs', 'battles']) open.result.createObjectStore(s); }; open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
      await new Promise((resolve, reject) => {
        const tx = seeded.transaction(['metadata', 'runs', 'battles'], 'readwrite');
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        for (const e of [active, settlement, gameOver]) {
          tx.objectStore('runs').put({ runId: e.runId, createdAt: e.createdAt, match: e.match, currentBattle: e.currentBattle, battleKeys: e.battles.map(b => b.combatId) }, e.runId);
          for (const b of e.battles) tx.objectStore('battles').put(b, [e.runId, b.combatId]);
        }
        tx.objectStore('metadata').put({ runId: active.runId, activationEpoch: 'm7-epoch', revision: 41 }, 'current');
        tx.objectStore('metadata').put([{ runId: settlement.runId, completedAt: '2026-10-01T00:00:00.000Z' }, { runId: gameOver.runId, completedAt: '2026-10-02T00:00:00.000Z' }, { runId: active.runId, completedAt: '2026-10-03T00:00:00.000Z' }], 'completed');
      });
      seeded.close();
      const snapshot = async () => { const db = await new Promise(r => { const o = indexedDB.open(LEGACY_NAMESPACE); o.onsuccess = () => r(o.result); });
        const tx = db.transaction(['metadata', 'runs', 'battles'], 'readonly'), out = { version: db.version };
        for (const s of ['metadata', 'runs', 'battles']) out[s] = JSON.stringify([await req(tx.objectStore(s).getAllKeys()), await req(tx.objectStore(s).getAll())]);
        db.close(); return out; };
      const before = await snapshot();

      // 3. Read-only: every transaction the reader opens on the legacy library is readonly.
      const nativeTransaction = IDBDatabase.prototype.transaction, modes = [];
      IDBDatabase.prototype.transaction = function (...args) { if (this.name === LEGACY_NAMESPACE) modes.push(args[1] ?? 'readonly'); return nativeTransaction.apply(this, args); };
      try {
        list = await legacyRecords.listLegacyRecords();
        check(list.ok && list.records.length === 3, 'active and history runs each listed exactly once');
        const [a, s, g] = list.records;
        check(a.location === 'active' && a.activeSlotRevision === 41 && a.recordRef.runId === active.runId, 'active record carries the slot revision');
        check(s.location === 'history' && s.activeSlotRevision === null && g.location === 'history' && g.activeSlotRevision === null, 'history records never invent a revision');
        check(list.records.every(r => r.recordRef.namespace === LEGACY_NAMESPACE && /^fnv1a32-utf16:[0-9a-f]{8}$/.test(r.recordRef.fingerprint) && r.canExportOriginal && r.reason === null
          && r.rulesVersion === 'm5-14.24b-v1' && r.schemaVersion === 5 && r.saveFormatVersion === 1 && r.replayFormatVersion === 1), 'records carry M7 versions and a deterministic fingerprint');
        check(new Set(list.records.map(r => r.recordRef.fingerprint)).size === 3, 'fingerprints distinguish different runs');
        for (const [record, original] of [[a, active], [s, settlement], [g, gameOver]]) {
          const result = await exported(record, `export-${record.recordRef.runId}`);
          check(result.ok && result.requestId === `export-${record.recordRef.runId}` && result.recordRef === record.recordRef || result.ok && JSON.stringify(result.recordRef) === JSON.stringify(record.recordRef), `${record.recordRef.runId}: response keeps request identity`);
          check(result.mediaType === 'application/json' && result.fileName === `hex-${original.match.seed}-${original.runId}.json`, `${record.recordRef.runId}: file name and media type`);
          const text = new TextDecoder().decode(result.bytes);
          check(text === JSON.stringify(v1(original)), `${record.recordRef.runId}: bytes are the original v1 envelope with its history`);
          check(readCompatibility(JSON.parse(text)).status === 'legacy-preserved', `${record.recordRef.runId}: exported file routes as legacy-preserved`);
        }
        const stale = await legacyRecords.exportLegacy({ requestId: 'stale', recordRef: { ...a.recordRef, fingerprint: 'fnv1a32-utf16:00000000' } });
        check(!stale.ok && stale.reason === 'stale-reference' && stale.recordRef.runId === active.runId, 'changed fingerprint is a stale reference, not another record');
        const foreign = await legacyRecords.exportLegacy({ requestId: 'foreign', recordRef: { ...a.recordRef, namespace: M8_NAMESPACE } });
        check(!foreign.ok && foreign.reason === 'not-found', 'non-legacy namespace reference is refused');
        const again = await legacyRecords.listLegacyRecords();
        check(JSON.stringify(again) === JSON.stringify(list), 'listing is deterministic');
      } finally { IDBDatabase.prototype.transaction = nativeTransaction; }
      check(modes.length > 0 && modes.every(mode => mode === 'readonly'), 'reader only opens readonly transactions');
      check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'reading leaves the legacy library byte-identical');

      // 4. M8 saves use their own namespace; activation and a completed M8 run never touch the M7 library.
      const repository = new SaveRepository();
      const envelope = { kind: 'hex-autobattler-save', saveFormatVersion: 2, replayFormatVersion: 2, runId: 'm8-run', createdAt: '2026-10-10T00:00:00.000Z', match: createMatch(42), battles: [], currentBattle: null };
      await repository.activate(null, envelope);
      check((await repository.readCurrent()).envelope.runId === 'm8-run', 'M8 repository round-trips in its own namespace');
      repository.close();
      check((await names()).includes(M8_NAMESPACE), 'M8 namespace created');
      check(JSON.stringify(await snapshot()) === JSON.stringify(before), 'M8 activation leaves the legacy library unchanged');

      // 5. Same content moved active -> history keeps its identity; missing history is reported, not exported.
      const writable = await new Promise(r => { const o = indexedDB.open(LEGACY_NAMESPACE); o.onsuccess = () => r(o.result); });
      await new Promise(resolve => { const tx = writable.transaction(['metadata', 'battles'], 'readwrite'); tx.oncomplete = resolve;
        tx.objectStore('metadata').delete('current'); tx.objectStore('battles').delete([settlement.runId, settlement.battles[0].combatId]); });
      writable.close();
      const moved = await legacyRecords.listLegacyRecords();
      const movedActive = moved.records.find(r => r.recordRef.runId === active.runId), broken = moved.records.find(r => r.recordRef.runId === settlement.runId);
      check(movedActive.location === 'history' && movedActive.activeSlotRevision === null && movedActive.recordRef.fingerprint === list.records[0].recordRef.fingerprint, 'active to history move keeps the reference');
      check(broken.reason === 'missing-history' && broken.canExportOriginal === false, 'missing battle is reported as missing-history');
      const brokenExport = await exported(broken);
      check(!brokenExport.ok && brokenExport.reason === 'missing-history', 'missing history is never exported as a partial file');

      // 6. An unavailable library is a failure, never an empty list.
      const nativeOpen = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function () { throw new DOMException('blocked for test', 'SecurityError'); };
      try { const failed = await legacyRecords.listLegacyRecords(); check(!failed.ok && failed.reason === 'unavailable' && failed.namespace === LEGACY_NAMESPACE, 'unavailable storage is not reported as empty'); }
      finally { IDBFactory.prototype.open = nativeOpen; }
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
    console.log(JSON.stringify({ passed: report.passed, checks: report.results?.length, failure: report.failure }));
  }
})();
