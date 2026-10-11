/* U7 browser evidence through the real application page: version-routed import notices, the read-only M7
 * library list and per-record original-format export, and that no rejected file replaces the active match.
 * Run: node scripts/verify-m8-u7-compat.cjs   (CHROMIUM_PATH optional) */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright'), { sourceFingerprint } = require('./m5-evidence.cjs');
const { load } = require('../tests/fixtures/m6-saves/load.cjs');
const output = path.resolve(process.env.U7_EVIDENCE_DIR || 'artifacts/m8-u7-compat');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const started = performance.now();
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    sourceFingerprint: sourceFingerprint(), kind: 'U7 compatibility notice and legacy export through the real page', results: [], errors: [], passed: false };
  const check = (condition, name) => { assert(condition, name); report.results.push(name); };
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const url = server.resolvedUrls.local[0];
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('dialog', dialog => dialog.accept());
    const v1 = e => ({ kind: e.kind, saveFormatVersion: e.saveFormatVersion, replayFormatVersion: e.replayFormatVersion, runId: e.runId, createdAt: e.createdAt, match: e.match, currentBattle: e.currentBattle, battles: e.battles });
    const active = load('02-preparation.json.gz'), history = { ...load('05-settlement.json.gz'), runId: 'm7-history-settlement' };
    history.battles = history.battles.map(b => ({ ...b, runId: history.runId }));
    const read = () => page.evaluate(() => window.__CAT_DEBUG__.read());

    // Seed a real M7 v1 library at this origin, then load the application against it.
    await page.goto(url); await page.waitForFunction(() => window.__CAT_DEBUG__);
    await page.waitForFunction(() => !document.querySelector('[data-debug="m8-legacy-status"]')?.textContent.includes('正在读取'), null, { timeout: 30000 });
    check(await page.locator('[data-debug="m8-legacy-records"]').isHidden(), 'without an M7 library the legacy section stays hidden');
    check(!(await page.evaluate(() => indexedDB.databases())).some(db => db.name === 'hex-autobattler-m6'), 'listing at startup never creates the M7 library');
    await page.evaluate(async ([a, h]) => {
      const db = await new Promise((resolve, reject) => { const open = indexedDB.open('hex-autobattler-m6', 1); open.onupgradeneeded = () => { for (const s of ['metadata', 'runs', 'battles']) open.result.createObjectStore(s); }; open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
      await new Promise((resolve, reject) => { const tx = db.transaction(['metadata', 'runs', 'battles'], 'readwrite'); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
        for (const e of [a, h]) { tx.objectStore('runs').put({ runId: e.runId, createdAt: e.createdAt, match: e.match, currentBattle: e.currentBattle, battleKeys: e.battles.map(b => b.combatId) }, e.runId); for (const b of e.battles) tx.objectStore('battles').put(b, [e.runId, b.combatId]); }
        tx.objectStore('metadata').put({ runId: a.runId, activationEpoch: 'm7', revision: 7 }, 'current'); tx.objectStore('metadata').put([{ runId: h.runId, completedAt: '2026-10-01T00:00:00.000Z' }], 'completed'); });
      db.close();
    }, [active, history]);
    await page.reload(); await page.waitForFunction(() => window.__CAT_DEBUG__);
    const rows = page.locator('[data-debug="m8-legacy-list"] li');
    await page.waitForFunction(() => document.querySelectorAll('[data-debug="m8-legacy-list"] li').length === 2, null, { timeout: 30000 });
    check((await rows.count()) === 2, 'legacy list shows the active and the history record once each');
    check((await page.locator('[data-debug="m8-legacy-status"]').textContent()).includes('共 2 条旧版记录'), 'legacy status names the record count');
    check((await rows.nth(0).textContent()).includes('旧版当前局') && (await rows.nth(1).textContent()).includes('旧版历史局'), 'location labels');
    for (const button of await page.locator('[data-debug="m8-legacy-export"]').all()) {
      const box = await button.boundingBox(); check(box && box.width >= 44 && box.height >= 44, 'legacy export control is at least 44px');
    }
    // A fresh M8 match; the M7 library stays untouched and is never offered as resumable.
    await page.locator('[data-debug="m6-random-start"]').click();
    await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6?.mode === 'active', null, { timeout: 60000 });
    const before = await read();
    check(before.state.rulesVersion === 'm8-14.24b-v1' && before.state.schemaVersion === 6, 'new match runs the M8 version');
    for (const [index, original] of [[0, active], [1, history]]) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-debug="m8-legacy-export"]').nth(index).click()]);
      const bytes = fs.readFileSync(await download.path(), 'utf8');
      check(download.suggestedFilename() === `hex-${original.match.seed}-${original.runId}.json`, `legacy export ${index} file name`);
      check(bytes === JSON.stringify(v1(original)), `legacy export ${index} is the original format1 envelope`);
    }
    check((await page.locator('[data-debug="m8-legacy-status"]').textContent()).includes('已原样导出'), 'export feedback');
    check(JSON.stringify((await read()).m6.token) === JSON.stringify(before.m6.token), 'legacy export leaves the active slot token unchanged');

    // Importing the M7 file: preserved-only notice, active match untouched.
    const legacyFile = path.join(output, 'm7-preparation.json'); fs.writeFileSync(legacyFile, JSON.stringify(active));
    await page.locator('[data-debug="m6-import"]').setInputFiles(legacyFile);
    await page.waitForFunction(() => document.querySelector('[data-debug="m8-compatibility"]')?.textContent.includes('旧版'), null, { timeout: 30000 });
    check((await page.locator('[data-debug="m8-compatibility"]').textContent()).includes('只能原样保全导出，不能继续或回放'), 'M7 import shows legacy-preserved notice');
    let after = await read();
    check(after.m6.runId === before.m6.runId && after.m6.mode === 'active' && JSON.stringify(after.state) === JSON.stringify(before.state), 'M7 import does not replace the active match');

    // A current-format export with a changed digest: rejected with the frozen reason, match untouched.
    const [current] = await Promise.all([page.waitForEvent('download'), page.locator('[data-debug="m6-export"]').click()]);
    const exported = JSON.parse(fs.readFileSync(await current.path(), 'utf8'));
    check(exported.saveFormatVersion === 2 && exported.replayFormatVersion === 2, 'current export is format 2');
    const forgedFile = path.join(output, 'm8-forged-digest.json'); fs.writeFileSync(forgedFile, JSON.stringify({ ...exported, match: { ...exported.match, contentDigest: 'fnv1a32-utf16:00000000' } }));
    await page.locator('[data-debug="m6-import"]').setInputFiles(forgedFile);
    await page.waitForFunction(() => document.querySelector('[data-debug="m8-compatibility"]')?.textContent.includes('内容摘要'), null, { timeout: 30000 });
    check((await page.locator('[data-debug="m8-compatibility"]').textContent()).includes('当前对局保持不变'), 'digest mismatch notice');
    after = await read();
    check(after.m6.runId === before.m6.runId && JSON.stringify(after.state) === JSON.stringify(before.state), 'rejected import does not replace the active match');

    // P3: a bad-JSON file replaces the previous notice instead of leaving it stale.
    const brokenFile = path.join(output, 'broken.json'); fs.writeFileSync(brokenFile, '{not json');
    await page.locator('[data-debug="m6-import"]').setInputFiles(brokenFile);
    await page.waitForFunction(() => document.querySelector('[data-debug="m8-compatibility"]')?.textContent.includes('文件数据损坏'), null, { timeout: 30000 });
    check(!(await page.locator('[data-debug="m8-compatibility"]').textContent()).includes('内容摘要'), 'bad JSON replaces the previous notice');
    check(JSON.stringify((await read()).state) === JSON.stringify(before.state), 'bad JSON does not replace the active match');

    // The unmodified export imports as current.
    const currentFile = path.join(output, 'm8-current.json'); fs.writeFileSync(currentFile, JSON.stringify(exported));
    const epoch = after.m6.token.activationEpoch;
    await page.locator('[data-debug="m6-import"]').setInputFiles(currentFile);
    await page.waitForFunction(epoch => { const s = window.__CAT_DEBUG__.read(); return s.m6.mode === 'active' && s.m6.token?.activationEpoch !== epoch; }, epoch, { timeout: 60000 });
    // Activation installs the session before the controls re-sync after archive loading; wait for the notice itself.
    await page.waitForFunction(() => document.querySelector('[data-debug="m8-compatibility"]')?.textContent.includes('可继续对局与回放'), null, { timeout: 30000 });
    check((await page.locator('[data-debug="m8-compatibility"]').textContent()).includes('可继续对局与回放'), 'current import shows the current notice');
    check((await page.locator('.m6-save-controls p').allTextContents()).some(text => text.includes('将替换当前自动存档（') && text.includes('旧版（M7）记录不受影响')), 'replacement impact names the round and battles');
    check((await rows.count()) === 2, 'legacy library still lists both records after M8 activity');
    assert.deepEqual(report.errors, [], 'no unexpected browser errors');
    assert.equal(sourceFingerprint(), report.sourceFingerprint, 'source changed during evidence');
    report.passed = true;
  } catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    report.durationMs = performance.now() - started; report.finalSourceFingerprint = sourceFingerprint();
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
    console.log(JSON.stringify({ passed: report.passed, checks: report.results.length, failure: report.failure?.split('\n')[0] }));
  }
})();
