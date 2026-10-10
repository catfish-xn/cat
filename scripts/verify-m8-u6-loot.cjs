/* U6 automated UI regression: the live loot panel and loot choice through the real app.
 * States come only from public commands: a fresh seed-42 opening driven by native clicks,
 * and the seed-230 capacity / lethal 4-7 routes recorded headlessly with BattleHistory and
 * loaded through the real save-import control. After import every action is a native click.
 * At each checkpoint the DOM rows, statuses, receipts and Continue verdict must equal
 * readLootView() computed independently in Node from the page's own Match state.
 * Run: node scripts/verify-m8-u6-loot.cjs   (CHROMIUM_PATH optional)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const output = path.resolve(process.env.U6_EVIDENCE_DIR || 'artifacts/m8-u6-loot');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), checks: [], errors: [], passed: false };
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const url = server.resolvedUrls.local[0];
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { BattleHistory, validateBattleCollection } = await server.ssrLoadModule('/src/replay/index.ts');
    const { validateEnvelope } = await server.ssrLoadModule('/src/persistence/format.ts');
    const { run } = require('./generate-m5-route.cjs');
    const accepted = result => { if (!result.ok) throw new Error(result.reason); return result.state; };
    const combatOnly = events => events.filter(event => event.domain === 'combat');

    /* ---------- headless public routes recorded as ordinary save envelopes ---------- */
    const players = state => state.preparation.units.filter(unit => unit.team === 'player');
    const bench = state => players(state).filter(unit => unit.location.kind === 'bench');
    function reserveExcept(initial, keep) {
      let state = initial;
      for (const unit of players(state).filter(unit => unit.location.kind === 'board' && !keep.includes(unit.id))) {
        const used = new Set(bench(state).map(unit => unit.location.slot));
        const slot = Array.from({ length: 9 }, (_, index) => index).find(index => !used.has(index));
        state = accepted(api.deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
      }
      return state;
    }
    const emptyRounds = new Set(['1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-7', '4-1', '4-2']);
    /** Same command route as tests/m8-b8-live-capacity: stop at roundId's preparation. Starts are recorded
     * from the exact state that starts (after any bench deployment), ticks from the route's own steps. */
    async function recordedPrefix(roundId, accumulateLosses, runId) {
      const history = new BattleHistory(runId), captured = new Error('captured');
      let prefix;
      const driver = { ...api, startMatchCombat(state) {
        if (state.roundDefinitionId === roundId) { prefix = state; throw captured; }
        const ready = accumulateLosses && emptyRounds.has(state.roundDefinitionId) ? reserveExcept(state, []) : state;
        const result = api.startMatchCombat(ready);
        if (result.ok) history.observe({ before: ready, after: result.state, events: combatOnly(result.events), reason: 'command' });
        return result;
      } };
      const onStep = (before, result, command) => { if (!command) history.observe({ before, after: result.state, events: combatOnly(result.events), reason: 'tick' }); };
      try { await run(driver, { build: 'cannon', seed: 230, onStep }); } catch (error) { if (error !== captured) throw error; }
      assert(prefix, `route reached ${roundId}`);
      return { prefix, history };
    }
    async function envelopeFile(name, runId, match, history) {
      const envelope = { kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1, runId,
        createdAt: '2026-10-10T00:00:00.000Z', match, battles: history.completedRecords, currentBattle: null };
      await validateEnvelope(JSON.parse(JSON.stringify(envelope)), validateBattleCollection);
      const file = path.join(output, `${name}.json`); fs.writeFileSync(file, JSON.stringify(envelope));
      return { file, runId, battles: envelope.battles.length };
    }
    // Capacity: seed-230 2-7 with nine real paid non-merging bench births (live-capacity fixture).
    const capacity = await recordedPrefix('2-7', false, 'u6-capacity');
    let capacityState = capacity.prefix;
    for (const [generation, slots] of [[9, [1, 3]], [10, [1, 4]], [11, [3]], [12, [1, 3, 4]], [13, [1]]]) {
      if (capacityState.shop.generation < generation) capacityState = accepted(api.rerollShop(capacityState));
      for (const slot of slots) capacityState = accepted(api.buyUnit(capacityState, slot, generation));
    }
    assert.equal(bench(capacityState).length, 9);
    const capacityFile = await envelopeFile('u6-capacity-2-7', 'u6-capacity', capacityState, capacity.history);
    // Terminal: seed-230 lethal 4-7 "both sources" (3 HP, full bench, units 11 and 6 fielded).
    const terminal = await recordedPrefix('4-7', true, 'u6-terminal');
    let terminalState = reserveExcept(terminal.prefix, ['unit-11', 'unit-6']);
    for (const slot of [2, 3]) terminalState = accepted(api.buyUnit(terminalState, slot, 43));
    assert.equal(bench(terminalState).length, 9); assert.equal(terminalState.playerHp, 3);
    const terminalFile = await envelopeFile('u6-terminal-4-7', 'u6-terminal', terminalState, terminal.history);
    report.fixtures = { capacity: capacityFile, terminal: terminalFile };

    /* ---------- the real app ---------- */
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    report.browser = browser.version();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', event => { if (event.type() === 'error') report.errors.push(event.text()); });
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url); await page.waitForFunction(() => window.__CAT_DEBUG__);
    const read = () => page.evaluate(() => window.__CAT_DEBUG__.read());
    const state = async () => (await read()).state;
    const quiet = () => page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
    const click = async name => { await quiet(); await page.locator(`[data-debug="${name}"]`).first().click(); };
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function waitActive(runId) {
      await page.waitForFunction(id => { const s = window.__CAT_DEBUG__.read(); return s.m6?.mode === 'active' && (!id || s.m6.runId === id); }, runId, { timeout: 60000 });
    }
    async function domPanel() {
      return page.evaluate(() => {
        const panel = document.querySelector('[data-debug="loot-panel"],[data-debug="loot-terminal"]');
        if (!panel) return null;
        return { kind: panel.dataset.debug, canContinue: panel.dataset.canContinue ?? null,
          block: panel.querySelector('.loot-blocked')?.dataset.reason ?? null,
          buttons: panel.querySelectorAll('button').length,
          rows: [...panel.querySelectorAll('[data-debug^="loot-drop:"]')].map(row => ({ dropId: row.dataset.debug.slice('loot-drop:'.length), status: row.dataset.status, receipt: row.dataset.receipt ?? null })) };
      });
    }
    /** DOM must equal the domain projection of the page's own state (retried while a render is pending). */
    async function checkPanel(label, extra = () => {}) {
      let last;
      for (let attempt = 0; attempt < 20; attempt++) {
        const current = await state(), dom = await domPanel();
        const expectedVisible = current.m8.round.kind === 'pve' && current.phase !== 'preparation';
        try {
          if (!expectedVisible) assert.equal(dom, null, `${label}: no loot panel outside PvE combat/settlement`);
          else {
            const view = api.readLootView(current);
            assert(dom, `${label}: loot panel present`);
            assert.equal(dom.kind, current.phase === 'gameOver' ? 'loot-terminal' : 'loot-panel');
            const rows = view.revealedDrops.map(drop => ({ dropId: drop.dropId, status: drop.status, receipt: drop.receiptId }));
            const sort = list => [...list].sort((a, b) => a.dropId < b.dropId ? -1 : 1);
            assert.deepEqual(sort(dom.rows), sort(rows), `${label}: rows equal readLootView`);
            // Hidden information: nothing planned or forfeited and no unresolved choice is ever a row.
            const hidden = current.m8.loot.direct.filter(drop => drop.status === 'planned' || drop.status === 'forfeited').map(drop => drop.dropId);
            assert(dom.rows.every(row => !hidden.includes(row.dropId)), `${label}: no hidden drop rendered`);
            assert.equal(dom.buttons, 0, `${label}: loot panel offers no claim action`);
            if (dom.kind === 'loot-panel') assert.equal(dom.canContinue, String(view.canContinue));
            assert.equal(dom.block, view.canContinue ? null : view.reason);
            extra(view, dom, current);
          }
          report.checks.push({ label, phase: current.phase, roundId: current.roundDefinitionId, rows: dom?.rows ?? [] });
          return { view: expectedVisible ? api.readLootView(current) : null, state: current };
        } catch (error) { last = error; await delay(150); }
      }
      throw last;
    }
    async function finishCombat(label, onRevealed) {
      let sawRevealed = false;
      while ((await state()).phase === 'combat') {
        const current = await state();
        if (!sawRevealed && current.m8.loot.direct.some(drop => drop.status === 'revealed')) {
          await checkPanel(`${label}: mid-combat reveal`, view => assert(view.revealedDrops.some(drop => drop.status === 'revealed')));
          sawRevealed = true; onRevealed?.();
        }
        await delay(100);
      }
      return sawRevealed;
    }

    // 1. Fresh seed-42 opening by native clicks: 1-2 reveal/grant, 1-3 loot choice.
    await page.locator('[data-debug="m6-seed-input"]').fill('42'); await page.locator('[data-debug="m6-fixed-start"]').click();
    await waitActive(); assert.equal((await state()).seed, 42);
    await checkPanel('1-2 preparation');
    await delay(450); await click('mobile:start-combat');
    assert(await finishCombat('1-2'), '1-2 Maddie drop is revealed during combat');
    await checkPanel('1-2 settlement', view => assert(view.revealedDrops.some(drop => drop.status === 'granted' && drop.payload.definitionId === 'maddie')));
    await click('mobile:continue'); await delay(450); await click('mobile:start-combat');
    await finishCombat('1-3');
    const loot13 = await checkPanel('1-3 loot choice pending', view => assert.equal(view.reason, 'unsettled-round'));
    assert.equal(loot13.state.phase, 'choice');
    assert.equal(await page.locator('.choice-dialog').getAttribute('data-choice-source'), 'loot');
    assert.equal(await page.locator('.choice-dialog [data-debug^="choice:"]').count(), 8);
    const pick = loot13.state.pendingChoice.offers[2];
    await click(`choice:${pick}`); await quiet();
    await checkPanel('1-3 after real choice', view => assert(view.revealedDrops.some(drop => drop.status === 'granted' && drop.payload.definitionId === pick)));

    // 2. Capacity: import, choose, blocked Continue, sell, granted and Continue.
    await page.locator('[data-debug="m6-import"]').setInputFiles(capacityFile.file); await waitActive('u6-capacity');
    assert.equal((await state()).roundDefinitionId, '2-7');
    await delay(450); await click('mobile:start-combat'); await finishCombat('2-7 capacity');
    const waitingChoice = await checkPanel('2-7 choice with full bench', view => assert.equal(view.reason, 'unsettled-round'));
    assert(waitingChoice.view.revealedDrops.some(drop => drop.status === 'pending-capacity'), 'hero waits for capacity');
    await click(`choice:${waitingChoice.state.pendingChoice.offers[0]}`); await quiet();
    const blocked = await checkPanel('2-7 capacity blocks Continue', view => {
      assert.equal(view.reason, 'pending-capacity'); assert.equal(view.canContinue, false); assert.equal(view.pendingClaims.length, 1);
    });
    const blockedBefore = blocked.state; await click('mobile:continue'); await delay(300);
    assert.deepEqual(await state(), blockedBefore, 'Continue refused while the hero waits');
    const zoe = bench(blockedBefore).find(unit => unit.definitionId === 'zoe');
    await click('panel:units'); await click(`mobile:unit:${zoe.id}`); await click('mobile:sell');
    await checkPanel('2-7 after real sale', view => {
      assert.equal(view.canContinue, true); assert.equal(view.pendingClaims.length, 0);
      assert(view.revealedDrops.every(drop => drop.status === 'granted'));
    });
    await click('mobile:continue');
    await checkPanel('3-1 preparation after Continue');

    // 3. Terminal: import 4-7, lethal combat, read-only terminal record with retained hero and fallback receipt.
    await page.locator('[data-debug="m6-import"]').setInputFiles(terminalFile.file); await waitActive('u6-terminal');
    await delay(450); await click('mobile:start-combat'); await finishCombat('4-7 terminal');
    await checkPanel('4-7 game over', (view, dom, current) => {
      assert.equal(current.phase, 'gameOver'); assert.equal(view.reason, 'game-over'); assert.equal(dom.block, 'game-over');
      assert(view.revealedDrops.some(drop => drop.status === 'retained-terminal' && drop.receiptId === null), 'retained hero shown without receipt');
      const choice = current.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === '4-7').choices[0];
      assert(view.revealedDrops.some(drop => drop.dropId === choice.dropId && drop.status === 'granted' && drop.payload.definitionId === 'tear'), 'earned fallback shown only via its receipt');
    });
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack; process.exitCode = 1; console.error(error);
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await server.close();
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, errors: report.errors.length }));
  }
})();
