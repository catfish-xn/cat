/* Actual index.html/main.ts/BoardScene/MatchApplication; no release-function calls. */
const assert = require('node:assert/strict');
module.exports = async function applicationRetention(browser, nativeSnapshot, { url, fixture, progress }) {
  const result = { arm: 'public-application', cycles: [], rejected: [], errors: [], passed: false };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const page = await context.newPage();
    let cancel = false;
    page.on('dialog', dialog => cancel ? dialog.dismiss() : dialog.accept());
    page.on('pageerror', error => result.errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__CAT_DEBUG__ && window.__M6_RETENTION_GAME__);
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    const read = () => page.evaluate(() => { const s = window.__CAT_DEBUG__.read(); return { state: s.state, events: s.combatEvents, m6: s.m6 }; });
    const ready = () => page.waitForFunction(() => !document.querySelector('[data-debug="m6-fixed-start"]').disabled);
    const edit = async (value = '42') => { for (let i = 0; i < 3; i++) await page.locator('[data-debug="m6-seed-input"]').fill(value); };
    const rememberOwner = () => page.evaluate(() => { window.__retentionOwner = new WeakRef(document.querySelector('[data-debug="m6-seed-input"]')); });
    const sameOwner = () => page.evaluate(() => window.__retentionOwner.deref() === document.querySelector('[data-debug="m6-seed-input"]'));
    const snapshot = async (label, keep = false) => { const counts = await nativeSnapshot(cdp, `application-${label}`, keep); console.log(JSON.stringify({ nativeProgress: label, ...counts })); return counts; };
    const resolveChoices = async () => {
      while ((await read()).state.phase === 'choice') {
        await page.locator('.choice-overlay:not([hidden]) button[data-debug^="choice:"]').first().click();
      }
      await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
    };
    const start = async (random = false) => {
      await ready(); await edit(); await rememberOwner();
      const previous = (await read()).m6.runId;
      await page.locator(`[data-debug="m6-${random ? 'random' : 'fixed'}-start"]`).click();
      await page.waitForFunction(previous => { const s = window.__CAT_DEBUG__.read(); return s.m6.mode === 'active' && s.m6.runId !== previous; }, previous);
      await ready(); assert.equal(await sameOwner(), false, 'successful new run renews its editing owner');
      await resolveChoices(); await ready();
    };
    const importSave = async () => {
      await ready(); await edit('73'); await rememberOwner();
      const epoch = (await read()).m6.token?.activationEpoch;
      await page.locator('[data-debug="m6-import"]').setInputFiles({ name: 'public-route.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
      await page.waitForFunction(epoch => { const s = window.__CAT_DEBUG__.read(); return s.m6.mode === 'active' && s.m6.token?.activationEpoch !== epoch; }, epoch);
      await ready(); assert.equal(await sameOwner(), false, 'valid import renews its editing owner');
      const s = await read(); assert.deepEqual(s.state, fixture.match); assert.deepEqual(s.m6.lifecycle, { applications: 1, sessions: 1, observers: 1 });
    };
    const replayReturn = async () => {
      const before = await read();
      await page.getByLabel('选择已完成战斗').selectOption('0');
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'replay');
      await page.locator('#replay-root').getByRole('button', { name: '返回当前局', exact: true }).click();
      await ready(); const after = await read();
      assert.deepEqual(after.state, before.state, 'replay return preserves the whole match');
      assert.deepEqual(after.events, before.events, 'replay return preserves the complete event ledger');
      assert.deepEqual(after.m6.token, before.m6.token, 'replay return does not write a revision');
      assert.equal(after.m6.paused, false);
      assert.deepEqual(after.m6.lifecycle, { applications: 1, sessions: 1, observers: 1 });
    };
    // One independent native baseline cycle, not a modification of the formal heap warmup.
    await start(true); result.randomStart = await snapshot('random-start'); assert.equal(result.randomStart.UndoStep, 0);
    await importSave(); await replayReturn();
    result.before = await snapshot('before', true);
    assert.equal(result.before.UndoStep, 0); assert.equal(result.before.MediaQueryList, 1);
    for (let cycle = 1; cycle <= 30; cycle++) {
      const row = { cycle };
      await start(); row.newRun = await snapshot(`${cycle}-new`);
      assert.equal(row.newRun.UndoStep, 0, `cycle ${cycle}: new run releases undo`);
      await importSave(); row.import = await snapshot(`${cycle}-import`);
      assert.equal(row.import.UndoStep, 0, `cycle ${cycle}: import releases undo`);
      await replayReturn(); row.return = await snapshot(`${cycle}-return`, cycle === 30);
      assert.equal(row.return.UndoStep, 0, `cycle ${cycle}: replay return has no stale run undo`);
      for (const [stage, counts] of Object.entries(row).filter(([key]) => key !== 'cycle')) {
        assert.equal(counts.MediaQueryFeatureExpNode, result.before.MediaQueryFeatureExpNode, `cycle ${cycle}/${stage}: media nodes do not grow`);
        assert.equal(counts.MediaQueryList, 1, `cycle ${cycle}/${stage}: exactly one owned media query`);
      }
      result.cycles.push(row); progress(result);
    }
    result.after = result.cycles.at(-1).return;
    // Same-run ordinary autosave must preserve both the owner and functioning Ctrl+Z.
    await page.locator('[data-debug="m6-seed-input"]').fill('7');
    await page.locator('[data-debug="m6-seed-input"]').fill('9'); await rememberOwner();
    const revision = (await read()).m6.token.revision;
    await page.locator('[data-debug="mobile:reroll"]').click();
    await page.waitForFunction(revision => { const s = window.__CAT_DEBUG__.read(); return s.m6.status?.kind === 'saved' && s.m6.token.revision > revision; }, revision);
    await page.locator('[data-debug="m6-seed-input"]').press('Control+z');
    assert.equal(await page.locator('[data-debug="m6-seed-input"]').inputValue(), '7');
    assert.equal(await sameOwner(), true);
    result.sameRunUndo = { ordinaryAutosave: true, undoAndOwnerPreserved: true };
    await importSave();
    // Each rejection retains a positive, measured undo history, the owner, and active state/ledger/token.
    for (const kind of ['cancel-new', 'cancel-import', 'invalid-seed', 'invalid-json', 'activation-failure', 'pending-activation-failure']) {
      await edit(kind === 'invalid-seed' ? '-1' : '42'); await rememberOwner();
      const before = await read(), counts = await snapshot(`${kind}-before`);
      assert(counts.UndoStep > 0, `${kind}: positive undo history is required`);
      cancel = kind.startsWith('cancel-');
      if (kind === 'activation-failure') await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        window.__restoreRetentionStorage = () => { IDBObjectStore.prototype.put = put; delete window.__restoreRetentionStorage; };
        IDBObjectStore.prototype.put = function (...args) { if (this.name === 'runs') throw new DOMException('retention test activation failure', 'QuotaExceededError'); return put.apply(this, args); };
      });
      if (kind === 'pending-activation-failure') await page.evaluate(() => {
        const transaction = IDBDatabase.prototype.transaction;
        window.__retentionHeld = false;
        window.__restoreRetentionStorage = () => { IDBDatabase.prototype.transaction = transaction; delete window.__restoreRetentionStorage; };
        IDBDatabase.prototype.transaction = function (...args) {
          const tx = transaction.apply(this, args);
          if (args[1] === 'readwrite' && !window.__retentionHeld) {
            window.__retentionHeld = true;
            window.__abortRetentionTransaction = () => { tx.abort(); delete window.__abortRetentionTransaction; };
            const pump = () => { const request = tx.objectStore('metadata').get('current'); request.onsuccess = pump; };
            pump();
          }
          return tx;
        };
      });
      if (kind.endsWith('import') || kind === 'invalid-json') {
        await page.locator('[data-debug="m6-import"]').setInputFiles({ name: 'rejected.json', mimeType: 'application/json', buffer: Buffer.from(kind === 'invalid-json' ? '{' : JSON.stringify(fixture)) });
      } else await page.locator('[data-debug="m6-fixed-start"]').click();
      let pending;
      if (kind === 'pending-activation-failure') {
        await page.waitForFunction(() => window.__retentionHeld);
        assert.equal(await sameOwner(), true, 'in-flight activation must not release owner before commit');
        const held = await read(); assert.deepEqual(held.state, before.state); assert.deepEqual(held.events, before.events); assert.deepEqual(held.m6.token, before.m6.token);
        pending = await snapshot(`${kind}-pending`); assert.equal(pending.UndoStep, counts.UndoStep, 'in-flight activation preserves undo');
        await page.evaluate(() => { window.__restoreRetentionStorage(); window.__abortRetentionTransaction(); });
      }
      await ready(); cancel = false;
      if (!kind.startsWith('cancel-')) assert(await page.locator('#save-root [role="alert"]').textContent(), `${kind}: validation/storage rejection observed`);
      if (kind === 'activation-failure') await page.evaluate(() => window.__restoreRetentionStorage());
      assert.equal(await sameOwner(), true, `${kind}: no premature owner release`);
      const after = await read(); assert.deepEqual(after.state, before.state); assert.deepEqual(after.events, before.events); assert.deepEqual(after.m6.token, before.m6.token); assert.equal(after.m6.mode, 'active'); assert.equal(after.m6.paused, false);
      const retained = await snapshot(`${kind}-after`); assert.equal(retained.UndoStep, counts.UndoStep, `${kind}: undo history survives rejection`);
      result.rejected.push({ kind, before: counts, pending, after: retained, ownerAndActiveStatePreserved: true }); progress(result);
    }
    // Scene shutdown is the actual application's disposal entry, including the stats owner.
    const dispose = async () => {
      await page.evaluate(() => { const game = window.__M6_RETENTION_GAME__; for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key); });
      await page.waitForFunction(() => !window.__CAT_DEBUG__ && !document.querySelector('[data-debug="m6-seed-input"]'));
    };
    await dispose(); result.disposed = await snapshot('disposed', true);
    assert.equal(result.disposed.UndoStep, 0); assert.equal(result.disposed.MediaQueryList, 0);
    result.disposedLifecycle = await page.evaluate(async () => {
      const { MatchSession } = await import('/src/rendering/match-session.ts');
      const { MatchApplication } = await import('/src/m6/application.ts');
      return { applications: MatchApplication.instances, sessions: MatchSession.liveCount, observers: window.__M6_RETENTION_GAME__.scene.getScenes(false)[0].session.observerCount };
    });
    assert.deepEqual(result.disposedLifecycle, { applications: 0, sessions: 0, observers: 0 });
    // Reopen the actual product against the native current slot; Continue uses install(), too.
    await page.reload();
    await page.waitForFunction(() => window.__CAT_DEBUG__); await ready();
    await edit(); await rememberOwner(); result.continueBefore = await snapshot('continue-before'); assert(result.continueBefore.UndoStep > 0);
    await page.locator('[data-debug="m6-continue"]').click();
    await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active'); await ready();
    assert.equal(await sameOwner(), false, 'Continue renews owner after successful activation');
    assert.deepEqual((await read()).state, fixture.match);
    assert.deepEqual((await read()).m6.lifecycle, { applications: 1, sessions: 1, observers: 1 });
    result.continued = await snapshot('continued', true); assert.equal(result.continued.UndoStep, 0); assert.equal(result.continued.MediaQueryList, 1);
    await edit(); await dispose(); result.finalDisposed = await snapshot('final-disposed', true);
    assert.equal(result.finalDisposed.UndoStep, 0); assert.equal(result.finalDisposed.MediaQueryList, 0);
    assert.deepEqual(result.errors, []); result.passed = true;
  } catch (error) { result.failure = error.stack; }
  finally { await context.close(); }
  return result;
};
