/* U6 automated UI regression: the live loot panel through the real app (T13 orbs: no PvE loot pick).
 * States come only from public commands: a fresh seed-42 opening driven by native clicks,
 * and the seed-36 3-7 capacity / seed-38 lethal 4-7 routes recorded headlessly with BattleHistory and
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
  const server = await createServer({ root: path.resolve(__dirname, '..'), ...(process.env.VITE_CONFIG_LOADER ? { configLoader: process.env.VITE_CONFIG_LOADER } : {}), ...(process.env.U6_CACHE_DIR ? { cacheDir: path.resolve(process.env.U6_CACHE_DIR) } : {}), server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const url = server.resolvedUrls.local[0];
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { BattleHistory, validateBattleCollection } = await server.ssrLoadModule('/src/replay/index.ts');
    const { validateEnvelope } = await server.ssrLoadModule('/src/persistence/format.ts');
    const { M8_VERSION } = await server.ssrLoadModule('/src/simulation/m8/version.ts');
    const { run } = require('./generate-m5-route.cjs');
    const accepted = result => { if (!result.ok) throw new Error(result.reason); return result.state; };
    const combatOnly = events => events.filter(event => event.domain === 'combat');

    /* ---------- headless public routes recorded as ordinary save envelopes ---------- */
    // T13 orb loot has no PvE pick: the scenarios are the public ones of tests/m8-b8-live-capacity
    // (seed-36 3-7 Tristana at nine capacity; seed-38 lethal 4-7 with Loris killing both carriers).
    const players = state => state.preparation.units.filter(unit => unit.team === 'player');
    const bench = state => players(state).filter(unit => unit.location.kind === 'bench');
    function reserveExcept(initial, keep) {
      let state = initial;
      for (const unit of players(state).filter(unit => unit.location.kind === 'board' && !keep.includes(unit.id))) {
        const used = new Set(bench(state).map(unit => unit.location.slot));
        const slot = Array.from({ length: 9 }, (_, index) => index).find(index => !used.has(index));
        assert.notEqual(slot, undefined, 'bench has room to reserve the board');
        state = accepted(api.deployMatchUnit(state, unit.id, { kind: 'bench', slot }));
      }
      return state;
    }
    /** Nine real paid bench births that never merge and never buy the excluded heroes. */
    function fillBench(input, excluded) {
      let state = input;
      for (let budget = 0; bench(state).length < 9; budget++) {
        assert(budget <= 80, 'fill bench budget');
        const slot = state.shop.slots.findIndex(offer => offer.status === 'available' && !excluded.includes(offer.definitionId)
          && players(state).filter(unit => unit.definitionId === offer.definitionId && unit.starLevel === 1).length < 2);
        state = accepted(slot < 0 ? api.rerollShop(state) : api.buyUnit(state, slot, state.shop.generation));
      }
      return state;
    }
    const plan = state => state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === state.roundDefinitionId);
    const heroDrop = state => plan(state).encounterPlan.drops.find(drop => drop.payload.kind === 'unit');
    /** Stop at roundId's preparation. Starts are recorded from the exact state that starts, ticks from the route's own steps. */
    async function recordedPrefix(roundId, options, runId) {
      const history = new BattleHistory(runId), captured = new Error('captured');
      let prefix;
      const driver = { ...api, startMatchCombat(state) {
        if (state.roundDefinitionId === roundId) { prefix = state; throw captured; }
        const result = api.startMatchCombat(state);
        if (result.ok) history.observe({ before: state, after: result.state, events: combatOnly(result.events), reason: 'command' });
        return result;
      } };
      const onStep = (before, result, command) => { if (!command) history.observe({ before, after: result.state, events: combatOnly(result.events), reason: 'tick' }); };
      try { await run(driver, { build: 'cannon', ...options, onStep }); } catch (error) { if (error !== captured) throw error; }
      assert(prefix, `route reached ${roundId}`);
      return { prefix, history };
    }
    async function envelopeFile(name, runId, match, history) {
      const envelope = { kind: 'hex-autobattler-save', saveFormatVersion: M8_VERSION.saveFormatVersion, replayFormatVersion: M8_VERSION.replayFormatVersion, runId,
        createdAt: '2026-10-10T00:00:00.000Z', match, battles: history.completedRecords, currentBattle: null };
      await validateEnvelope(JSON.parse(JSON.stringify(envelope)), validateBattleCollection);
      const file = path.join(output, `${name}.json`); fs.writeFileSync(file, JSON.stringify(envelope));
      return { file, runId, battles: envelope.battles.length };
    }
    // Capacity: seed-36 3-7 whose orb carries a Tristana, bench filled with nine non-merging heroes.
    const capacity = await recordedPrefix('3-7', { seed: 36 }, 'u6-capacity');
    const capacityHero = heroDrop(capacity.prefix);
    assert.deepEqual(capacityHero?.payload, { kind: 'unit', definitionId: 'tristana', quantity: 1 }, 'seed-36 3-7 orb carries Tristana');
    const capacityState = fillBench(capacity.prefix, ['tristana']);
    assert.equal(bench(capacityState).length, 9);
    const capacityFile = await envelopeFile('u6-capacity-3-7', 'u6-capacity', capacityState, capacity.history);
    // Terminal: seed-38 lethal 4-7 (3 HP after empty-board losses, full bench, only Loris fielded at 1,6).
    const losses = ['1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-7', '4-1', '4-2', '4-7'];
    const terminal = await recordedPrefix('4-7', { seed: 38, emptyBoardRounds: losses, protectedUnitIds: ['unit-10', 'unit-15'] }, 'u6-terminal');
    assert.equal(heroDrop(terminal.prefix)?.payload.definitionId, 'ezreal', 'seed-38 4-7 orb carries Ezreal');
    let terminalState = fillBench(reserveExcept(terminal.prefix, []), ['ezreal']);
    const loris = players(terminalState).find(unit => unit.definitionId === 'loris');
    terminalState = fillBench(accepted(api.deployMatchUnit(terminalState, loris.id, { kind: 'board', cell: { col: 1, row: 6 } })), ['ezreal']);
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
    const {lootPanelSnapshot,hasCombatReveal}=require('./u6-panel-snapshot.cjs');
    /** DOM must equal the domain projection of the page's own state (retried while a render is pending). */
    async function checkPanel(label, extra = () => {}, onlyRevealed = false) {
      let last;
      for (let attempt = 0; attempt < 20; attempt++) {
        const {current,dom} = await page.evaluate(lootPanelSnapshot);
        if(onlyRevealed && !hasCombatReveal(current))return null;
        const expectedVisible = current.m8.round.kind === 'pve' && current.phase !== 'preparation';
        try {
          // P2-4: the Continue control follows the authoritative verdict in every phase.
          const verdict = api.readLootView(current);
          assert.equal(dom.continueDisabled, !verdict.canContinue, `${label}: Continue disabled iff canContinue=false`);
          assert.equal(dom.continueReason, verdict.canContinue ? null : verdict.reason, `${label}: Continue carries the blocking reason`);
          if (!expectedVisible) assert.equal(dom.kind, null, `${label}: no loot panel outside PvE combat/settlement`);
          else {
            const view = api.readLootView(current);
            assert(dom.kind, `${label}: loot panel present`);
            assert.equal(dom.kind, current.phase === 'gameOver' ? 'loot-terminal' : view.revealedOrbs.length ? 'orb-loot' : 'loot-panel');
            if (dom.kind === 'orb-loot') assert.deepEqual(dom.orbs, view.revealedOrbs.map(orb => ({ orbId: orb.orbId, tier: orb.tier, status: orb.status })), `${label}: orb cards equal readLootView`);
            const rows = view.revealedDrops.map(drop => ({ dropId: drop.dropId, status: drop.status, receipt: drop.receiptId }));
            const sort = list => [...list].sort((a, b) => a.dropId < b.dropId ? -1 : 1);
            assert.deepEqual(sort(dom.rows), sort(rows), `${label}: rows equal readLootView`);
            // Hidden information: nothing planned or forfeited and no unresolved choice is ever a row.
            const hidden = current.m8.loot.direct.filter(drop => drop.status === 'planned' || drop.status === 'forfeited').map(drop => drop.dropId);
            assert(dom.rows.every(row => !hidden.includes(row.dropId)), `${label}: no hidden drop rendered`);
            assert.equal(dom.buttons, 0, `${label}: loot panel offers no claim action`);
            if (dom.kind !== 'loot-terminal') assert.equal(dom.canContinue, String(view.canContinue));
            assert.equal(dom.block, view.canContinue ? null : view.reason);
            // Approved addendum: the pending loot pick is named by the domain, never inferred by the UI.
            assert.equal(dom.pendingDrop, view.pendingChoice?.dropId ?? null, `${label}: pending pick row`);
            if (view.pendingChoice) {
              assert.equal(dom.dialogSource, 'loot'); assert.equal(dom.dialogDrop, view.pendingChoice.dropId);
              const name = api.readEncounterPreview(current).units.find(unit => unit.unitId === view.pendingChoice.sourceUnitId).name;
              assert(dom.dialogText.includes(`来源：${name}`), `${label}: dialog names the source ${name}`);
            } else if (current.phase === 'choice') assert.notEqual(dom.dialogSource, 'loot', `${label}: non-loot pick is not labelled loot`);
            extra(view, dom, current);
          }
          report.checks.push({ label, phase: current.phase, roundId: current.roundDefinitionId, rows: dom?.rows ?? [], continueDisabled: dom.continueDisabled });
          return { view: expectedVisible ? api.readLootView(current) : null, state: current };
        } catch (error) { last = error; await delay(150); }
      }
      throw last;
    }
    async function finishCombat(label, onRevealed) {
      let sawRevealed = false;
      while ((await state()).phase === 'combat') {
        if (!sawRevealed) {
          const captured=await checkPanel(`${label}: mid-combat reveal`, view => assert(view.revealedDrops.some(drop => drop.status === 'revealed')),true);
          if(captured){sawRevealed = true; onRevealed?.();}
        }
        await delay(100);
      }
      return sawRevealed;
    }

    // 1. Fresh seed-42 opening by native clicks: 1-2 and 1-3 orbs reveal mid-combat and are granted by receipt.
    await page.locator('[data-debug="m6-seed-input"]').fill('42'); await page.locator('[data-debug="m6-fixed-start"]').click();
    await waitActive(); assert.equal((await state()).seed, 42);
    const hero12 = heroDrop(await state());
    assert(hero12, '1-2 orb carries a hero');
    await checkPanel('1-2 preparation');
    await delay(450); await click('mobile:start-combat');
    assert(await finishCombat('1-2'), '1-2 orb drops are revealed during combat');
    await checkPanel('1-2 settlement', view => assert(view.revealedDrops.some(drop => drop.dropId === hero12.dropId && drop.status === 'granted' && drop.receiptId), '1-2 hero granted by receipt'));
    await click('mobile:continue'); await delay(450);
    const hero13 = heroDrop(await state());
    assert(hero13, '1-3 orb carries a hero');
    await click('mobile:start-combat');
    assert(await finishCombat('1-3'), '1-3 orb drops are revealed during combat');
    await checkPanel('1-3 settlement', (view, dom, current) => {
      assert.equal(current.phase, 'settlement'); assert.equal(dom.dialogSource, null, 'T13 orbs open no loot pick');
      assert(view.revealedDrops.some(drop => drop.dropId === hero13.dropId && drop.status === 'granted' && drop.receiptId), '1-3 hero granted by receipt');
    });

    // 2. Capacity: import, hero waits on a full bench, blocked Continue, sell, granted and Continue.
    await page.locator('[data-debug="m6-import"]').setInputFiles(capacityFile.file); await waitActive('u6-capacity');
    assert.equal((await state()).roundDefinitionId, '3-7');
    await delay(450); await click('mobile:start-combat');
    assert(await finishCombat('3-7 capacity'), '3-7 orb drops are revealed during combat');
    const blocked = await checkPanel('3-7 capacity blocks Continue', view => {
      assert.equal(view.reason, 'pending-capacity'); assert.equal(view.canContinue, false); assert.deepEqual(view.pendingClaims, [capacityHero.dropId]);
    });
    // The button is not operable: a native click on it is a no-op (the domain refusal is tested separately).
    const blockedBefore = blocked.state, continueBox = await page.locator('[data-debug="mobile:continue"]').boundingBox();
    assert(await page.locator('[data-debug="mobile:continue"]').isDisabled(), 'Continue disabled while the hero waits');
    await page.mouse.click(continueBox.x + continueBox.width / 2, continueBox.y + continueBox.height / 2); await delay(300);
    assert.deepEqual(await state(), blockedBefore, 'native click on the disabled Continue changes nothing');
    const sold = bench(blockedBefore)[0];
    await click('panel:units'); await click(`mobile:unit:${sold.id}`); await click('mobile:sell');
    await checkPanel('3-7 after real sale', view => {
      assert.equal(view.canContinue, true); assert.equal(view.pendingClaims.length, 0);
      assert(view.revealedDrops.every(drop => drop.status === 'granted'));
    });
    assert(players(await state()).some(unit => unit.definitionId === 'tristana'), 'the waiting Tristana joined the bench');
    assert(await page.locator('[data-debug="mobile:continue"]').isEnabled(), 'Continue usable again after the real sale');
    await click('mobile:continue');
    await checkPanel('4-1 preparation after Continue');
    assert.equal((await state()).roundDefinitionId, '4-1', 'the re-enabled Continue really advanced');

    // 3. Terminal: import 4-7, lethal combat, read-only terminal record with retained hero and component receipts.
    await page.locator('[data-debug="m6-import"]').setInputFiles(terminalFile.file); await waitActive('u6-terminal');
    await delay(450); await click('mobile:start-combat');
    assert(await finishCombat('4-7 terminal'), '4-7 orb drops are revealed during combat');
    await checkPanel('4-7 game over', (view, dom, current) => {
      assert.equal(current.phase, 'gameOver'); assert.equal(view.reason, 'game-over'); assert.equal(dom.block, 'game-over');
      assert.deepEqual(view.revealedDrops.map(drop => drop.status), ['granted', 'granted', 'retained-terminal', 'granted', 'granted'], 'both carriers killed: original drops plus the independent duplicator bonus earned');
      // Scheme A, seed 38 / gray 4-7 slot 1: independent roll 99 appends
      // exactly one lesser duplicator at entry 2, after Ezreal and remover.
      const bonus = view.revealedDrops.at(-1);
      assert.deepEqual(bonus.payload, { kind: 'consumable', definitionId: 'TFT_Consumable_ChampionDuplicator_III', quantity: 1 });
      assert.equal(bonus.entryOrdinal, 2);
      const receipts = current.m8.loot.receipts.filter(receipt => receipt.dropId === bonus.dropId);
      assert.equal(receipts.length, 1, 'bonus has exactly one loot receipt');
      assert.equal(bonus.receiptId, receipts[0].receiptId);
      assert.equal(receipts[0].grantedConsumableIds.length, 1);
      assert.deepEqual(current.consumables.filter(tool => tool.consumableId === receipts[0].grantedConsumableIds[0]),
        [{ consumableId: receipts[0].grantedConsumableIds[0], definitionId: 'TFT_Consumable_ChampionDuplicator_III' }], 'bonus creates exactly one tool');
      assert.deepEqual(api.stepMatch(current), { state: current, events: [] }, 'terminal step cannot grant bonus again');
      assert(view.revealedDrops.some(drop => drop.status === 'retained-terminal' && drop.receiptId === null && drop.payload.definitionId === 'ezreal'), 'retained hero shown without receipt');
      assert(view.revealedDrops.filter(drop => drop.status === 'granted').every(drop => drop.receiptId), 'earned drops shown only via their receipts');
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
