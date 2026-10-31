/* U6 automated UI regression: the live loot panel through the real app (T13 orbs: no PvE loot pick).
 * States come only from public commands: a fresh seed-42 opening driven by native clicks,
 * and the seed-36 3-7 capacity / seed-442 lethal 4-7 routes recorded headlessly with BattleHistory and
 * loaded through the real save-import control. After import every action is a native click.
 * At each checkpoint the DOM rows, statuses, receipts and Continue verdict must equal
 * readLootView() computed independently in Node from the page's own Match state.
 * Run: node scripts/verify-m8-u6-loot.cjs   (CHROMIUM_PATH optional)
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readProcessOutput: execFileSync } = require('./offline-process-output.cjs');
const { chromium } = require('playwright');
const { lootPlan: independentLootPlan } = require('../tests/fixtures/orb-combo-oracle.cjs');
const output = path.resolve(process.env.U6_EVIDENCE_DIR || 'artifacts/m8-u6-loot');
const TERMINAL_SEED = 442;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), checks: [], errors: [], passed: false };
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), ...(process.env.VITE_CONFIG_LOADER ? { configLoader: process.env.VITE_CONFIG_LOADER } : {}), ...(process.env.U6_CACHE_DIR ? { cacheDir: path.resolve(process.env.U6_CACHE_DIR) } : {}), server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { BattleHistory, validateBattleCollection } = await server.ssrLoadModule('/src/replay/index.ts');
    const { validateEnvelope } = await server.ssrLoadModule('/src/persistence/format.ts');
    const { M8_VERSION } = await server.ssrLoadModule('/src/simulation/m8/version.ts');
    const { run } = require('./generate-m5-route.cjs');
    const accepted = result => { if (!result.ok) throw new Error(result.reason); return result.state; };
    const combatOnly = events => events.filter(event => event.domain === 'combat');

    /* ---------- headless public routes recorded as ordinary save envelopes ---------- */
    // T13 orb loot has no PvE pick: the scenarios are the public ones of tests/m8-b8-live-capacity
    // (seed-36 3-7 Nocturne / Ezreal at nine capacity; a lethal 4-7 where Maddie and Loris kill two carriers).
    // v22: seed 38 draws the scuttle-crab opening, whose 4-7 crabs carry the razorbeak orbs; seed 2253 was the
    // crab-free terminal route of tests/fixtures/t13-loot-public.ts (same 3 HP entry after the same losses).
    // v23 (224-card pool): seed 2253's route no longer keeps Maddie, and no lone unit of its roster kills exactly a
    // component carrier and a hero carrier. Seed 2050 (no opening encounter, razorbeak 4-7, the same losses and 3 HP
    // entry) keeps a 2-star Maddie; alone at (2,7) she kills r01 (sword) and r04 (Nocturne + 1G) and the board dies.
    // v25: that Maddie now kills only r01, so the terminal record is no longer the sword / Nocturne / 1G triple.
    // Seed 460 was the first no-opening seed whose public cannon route, with the same loss list, still entered 4-7 at
    // 3 HP, kept a 2-star Maddie, and alone at (2,7) killed exactly r01 (bow) and r04 (Ekko + 4G) before the board died.
    // v26 (568eeea4, 14.24 razorbeaks: small 1450 HP / 180 AD): that same loss list, which still forces the 3-7 wolves
    // empty, eliminates the player at 4-2, so the prefix never reaches 4-7. Dropping only 3-7 (old list included it;
    // stage-3 base 5 + 5 wolves) lets seed 442 enter 4-7 at 3 HP with a 2-star Maddie (deathblade, guardbreaker,
    // infinity edge). Alone at (2,7) she still cannot finish a 1450 HP bird (seed 460's best was r04 at 656). The
    // route's 2-star Loris at (0,4) holds the flock; Maddie stays at (2,7). They kill exactly r02 then r01
    // (vest, and Corki + 4G) and the board still loses. Old heroes were Ziggs / Swain / Ekko.
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
    const heroDrops = state => plan(state).encounterPlan.drops.filter(drop => drop.payload.kind === 'unit');
    // Literal v17 oracle has no production imports: compare every carrier/entry/payload,
    // including additional heroes, tools and forges, rather than trusting the page's plan.
    function oracleDrops(state) {
      const expected = independentLootPlan(state.seed, state.round).rounds.find(round => round.encounterPlan.roundId === state.roundDefinitionId).encounterPlan.drops;
      const entries = drops => drops.map(({ dropId, sourceUnitId, payload }) => ({ dropId, sourceUnitId, payload }));
      assert.deepEqual(entries(plan(state).encounterPlan.drops), entries(expected), `seed-${state.seed} ${state.roundDefinitionId} complete v17 orb combination`);
      return expected;
    }
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
    // Capacity: seed-36 3-7 carries Nocturne, Ezreal and a completed-item forge.
    const capacity = await recordedPrefix('3-7', { seed: 36 }, 'u6-capacity');
    oracleDrops(capacity.prefix);
    const capacityHeroes = heroDrops(capacity.prefix);
    assert.deepEqual(capacityHeroes.map(drop => drop.payload), [
      { kind: 'unit', definitionId: 'nocturne', quantity: 1 },
      { kind: 'unit', definitionId: 'ezreal', quantity: 1 },
    ], 'seed-36 3-7 orbs carry Nocturne and Ezreal');
    const capacityState = fillBench(capacity.prefix, capacityHeroes.map(drop => drop.payload.definitionId));
    assert.equal(bench(capacityState).length, 9);
    const capacityFile = await envelopeFile('u6-capacity-3-7', 'u6-capacity', capacityState, capacity.history);
    // Terminal: seed-442 lethal 4-7 (3 HP after empty-board losses, full bench, Maddie at 2,7 and Loris at 0,4).
    // 3-7 stayed in the list through v25 (seed 460). v26 drops it; see the comment above.
    const losses = ['1-3', '1-4', '2-1', '2-2', '2-3', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '4-1', '4-2', '4-7'];
    const terminal = await recordedPrefix('4-7', { seed: TERMINAL_SEED, emptyBoardRounds: losses, protectedUnitIds: [] }, 'u6-terminal');
    const terminalDrops = oracleDrops(terminal.prefix);
    const terminalHeroes = heroDrops(terminal.prefix);
    assert.deepEqual(terminalHeroes.map(drop => drop.payload), [
      // Read from the independent oracle (lootPlan(442, 24)): r02 Corki, r03 Dr. Mundo, r04 Illaoi.
      // Old seed 460 (lootPlan(460, 24)) was r02 Ziggs, r03 Swain, r04 Ekko.
      { kind: 'unit', definitionId: 'corki', quantity: 1 },
      { kind: 'unit', definitionId: 'drmundo', quantity: 1 },
      { kind: 'unit', definitionId: 'illaoi', quantity: 1 },
    ], 'seed-442 4-7 orbs carry Corki, Dr. Mundo and Illaoi');
    const terminalExcluded = terminalHeroes.map(drop => drop.payload.definitionId);
    let terminalState = fillBench(reserveExcept(terminal.prefix, []), terminalExcluded);
    const maddie = players(terminalState).find(unit => unit.definitionId === 'maddie');
    const loris = players(terminalState).find(unit => unit.definitionId === 'loris');
    assert(maddie, `seed-${TERMINAL_SEED} public terminal roster keeps Maddie`);
    assert(loris, `seed-${TERMINAL_SEED} public terminal roster keeps Loris`);
    terminalState = accepted(api.deployMatchUnit(terminalState, maddie.id, { kind: 'board', cell: { col: 2, row: 7 } }));
    terminalState = accepted(api.deployMatchUnit(terminalState, loris.id, { kind: 'board', cell: { col: 0, row: 4 } }));
    terminalState = fillBench(terminalState, terminalExcluded);
    assert.equal(bench(terminalState).length, 9); assert.equal(terminalState.playerHp, 3);
    const terminalFile = await envelopeFile('u6-terminal-4-7', 'u6-terminal', terminalState, terminal.history);
    report.fixtures = { capacity: capacityFile, terminal: terminalFile };
    // Check the selected public recipes before the browser needs a listening
    // socket. Expanded augment offers must still exercise these exact cases.
    const resolve = prepared => {
      let state = accepted(api.startMatchCombat(structuredClone(prepared)));
      while (state.phase === 'combat') state = api.stepMatch(state).state;
      return state;
    };
    // v22 (docs/MATCH_CONTRACT.md anvil units): the completed-item forge is a bench anvil unit, not an
    // automatic choice. On the full bench it stays in its unclaimed orb while the heroes wait for capacity.
    const capacityForges = plan(capacity.prefix).encounterPlan.drops.filter(drop => drop.payload.kind === 'forge');
    assert.deepEqual(capacityForges.map(drop => drop.payload.definitionId), ['TFT_ArmoryKeyCompleted'], 'seed-36 3-7 orbs carry one completed-item forge');
    const capacityEnded = resolve(capacityState);
    assert.equal(capacityEnded.pendingChoice, null, 'v22 forge opens no automatic choice');
    assert.equal(capacityEnded.phase, 'settlement');
    assert.deepEqual(api.readLootView(capacityEnded).pendingClaims, capacityHeroes.map(drop => drop.dropId));
    const retainedForge = drops => drops.filter(drop => drop.payload.kind === 'forge').map(drop => ({ dropId: drop.dropId, status: drop.status }));
    assert.deepEqual(retainedForge(api.readLootView(capacityEnded).revealedDrops), capacityForges.map(drop => ({ dropId: drop.dropId, status: 'revealed' })), 'full-bench forge stays in its unclaimed orb');
    const terminalEnded = resolve(terminalState);
    assert.equal(terminalEnded.phase, 'gameOver');
    assert.deepEqual(terminalEnded.combat.neutralReceipts.deaths.map(death => death.unitId), [
      // v25 seed 460 order was r01 then r04. v26 seed 442 kills r02 then r01.
      JSON.stringify(['pve', '4-7', 'razorbeaks-v1', 'r02']),
      JSON.stringify(['pve', '4-7', 'razorbeaks-v1', 'r01']),
    ]);
    assert.deepEqual(api.readLootView(terminalEnded).revealedDrops.map(drop => drop.status), ['granted', 'retained-terminal', 'granted']);
    report.publicRoutePreflight = { capacityPendingHeroes: capacityHeroes.length, terminalRetainedHero: 'corki', passed: true };

    /* ---------- the real app ---------- */
    await server.listen();
    const url = server.resolvedUrls.local[0];
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
    oracleDrops(await state());
    const heroes12 = heroDrops(await state());
    assert.deepEqual(heroes12.map(drop => drop.payload.definitionId), ['tristana'], 'seed-42 1-2 orb carries Tristana');
    await checkPanel('1-2 preparation');
    await delay(450); await click('mobile:start-combat');
    assert(await finishCombat('1-2'), '1-2 orb drops are revealed during combat');
    await checkPanel('1-2 settlement', view => assert(view.revealedDrops.some(drop => heroes12.some(hero => hero.dropId === drop.dropId) && drop.status === 'granted' && drop.receiptId), '1-2 hero granted by receipt'));
    await click('mobile:continue'); await delay(450);
    oracleDrops(await state());
    const heroes13 = heroDrops(await state());
    assert.deepEqual(heroes13.map(drop => drop.payload.definitionId), ['singed', 'powder'], 'seed-42 1-3 orb carries Singed and Powder');
    await click('mobile:start-combat');
    assert(await finishCombat('1-3'), '1-3 orb drops are revealed during combat');
    await checkPanel('1-3 settlement', (view, dom, current) => {
      assert.equal(current.phase, 'settlement'); assert.equal(dom.dialogSource, null, 'T13 orbs open no loot pick');
      assert(heroes13.every(hero => view.revealedDrops.some(drop => drop.dropId === hero.dropId && drop.status === 'granted' && drop.receiptId)), 'both 1-3 heroes granted by receipt');
    });

    // 2. Capacity: import, hero waits on a full bench, blocked Continue, sell, granted and Continue.
    await page.locator('[data-debug="m6-import"]').setInputFiles(capacityFile.file); await waitActive('u6-capacity');
    assert.equal((await state()).roundDefinitionId, '3-7');
    await delay(450); await click('mobile:start-combat');
    assert(await finishCombat('3-7 capacity'), '3-7 orb drops are revealed during combat');
    const settled = await state();
    assert.equal(settled.phase, 'settlement', 'v22 completed-item forge is a bench anvil and opens no choice');
    assert.equal(settled.pendingChoice, null);
    const blocked = await checkPanel('3-7 capacity blocks Continue', view => {
      assert.equal(view.reason, 'pending-capacity'); assert.equal(view.canContinue, false); assert.deepEqual(view.pendingClaims, capacityHeroes.map(drop => drop.dropId));
      assert.deepEqual(retainedForge(view.revealedDrops), capacityForges.map(drop => ({ dropId: drop.dropId, status: 'revealed' })), 'full-bench forge waits in its orb');
    });
    // The button is not operable: a native click on it is a no-op (the domain refusal is tested separately).
    const blockedBefore = blocked.state, continueBox = await page.locator('[data-debug="mobile:continue"]').boundingBox();
    assert(await page.locator('[data-debug="mobile:continue"]').isDisabled(), 'Continue disabled while the hero waits');
    await page.mouse.click(continueBox.x + continueBox.width / 2, continueBox.y + continueBox.height / 2); await delay(300);
    assert.deepEqual(await state(), blockedBefore, 'native click on the disabled Continue changes nothing');
    for (let index = 0; index < capacityHeroes.length; index++) {
      const beforeSale = await state();
      const sold = bench(beforeSale).find(unit => !capacityHeroes.some(hero => hero.payload.definitionId === unit.definitionId));
      assert(sold, 'a paid reserve is available for each waiting hero');
      await click('panel:units'); await click(`mobile:unit:${sold.id}`); await click('mobile:sell');
      await checkPanel(`3-7 after real sale ${index + 1}`, view => {
        assert.deepEqual(view.pendingClaims, capacityHeroes.slice(index + 1).map(drop => drop.dropId));
        assert.equal(view.canContinue, index === capacityHeroes.length - 1);
        for (const hero of capacityHeroes.slice(0, index + 1)) {
          assert(view.revealedDrops.some(drop => drop.dropId === hero.dropId && drop.status === 'granted' && drop.receiptId), 'waiting hero granted by receipt after sale');
        }
        // The heroes take the freed slots; the bench is full again, so the forge stays in its orb (v22).
        if (view.canContinue) {
          assert(view.revealedDrops.filter(drop => drop.payload.kind !== 'forge').every(drop => drop.status === 'granted'));
          assert.deepEqual(retainedForge(view.revealedDrops), capacityForges.map(drop => ({ dropId: drop.dropId, status: 'revealed' })), 'refilled bench keeps the forge in its orb');
        }
      });
    }
    const recovered = await state();
    for (const hero of capacityHeroes) {
      const receipts = recovered.m8.loot.receipts.filter(receipt => receipt.dropId === hero.dropId);
      assert.equal(receipts.length, 1, 'each waiting hero has exactly one receipt');
      assert.equal(receipts[0].grantedUnitIds.length, 1);
      assert(players(recovered).some(unit => unit.id === receipts[0].grantedUnitIds[0] && unit.definitionId === hero.payload.definitionId), 'the actual waiting hero joined the bench');
    }
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
      const killed = current.combat.neutralReceipts.deaths.map(death => death.unitId);
      assert.deepEqual(killed, [
        JSON.stringify(['pve', '4-7', 'razorbeaks-v1', 'r02']),
        JSON.stringify(['pve', '4-7', 'razorbeaks-v1', 'r01']),
      ], 'Maddie and Loris kill the Corki and vest carriers');
      const earned = terminalDrops.filter(drop => killed.includes(drop.sourceUnitId));
      assert.deepEqual(view.revealedDrops.map(drop => ({ dropId: drop.dropId, payload: drop.payload, status: drop.status })),
        earned.map(drop => ({ dropId: drop.dropId, payload: drop.payload, status: drop.payload.kind === 'unit' ? 'retained-terminal' : 'granted' })), 'exact v17 terminal drops and statuses');
      assert.deepEqual(view.revealedDrops.map(drop => drop.status), ['granted', 'retained-terminal', 'granted']);
      const component = view.revealedDrops[0];
      const receipts = current.m8.loot.receipts.filter(receipt => receipt.dropId === component.dropId);
      assert.equal(receipts.length, 1, 'earned component has exactly one loot receipt');
      assert.equal(component.receiptId, receipts[0].receiptId);
      assert.equal(receipts[0].grantedItemIds.length, 1);
      assert(current.items.some(item => item.id === receipts[0].grantedItemIds[0] && item.definitionId === 'vest'), 'receipt creates the actual v17 component');
      assert.deepEqual(api.stepMatch(current), { state: current, events: [] }, 'terminal step cannot grant loot again');
      assert(view.revealedDrops.some(drop => drop.status === 'retained-terminal' && drop.receiptId === null && drop.payload.definitionId === 'corki'), 'retained hero shown without receipt');
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
