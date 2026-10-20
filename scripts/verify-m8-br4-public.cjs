const { installEquipmentCommands, equipmentCommand, dragEquipment, unitPoint } = require('./equipment-input.cjs');
/* M8 BR4: real dev/preview application, native input plus public equipment callbacks, validated
 * saves. The route policy chooses components and leaves them in inventory; no
 * state injection, debug mutation, accelerated browser combat or changed rules.
 * Linux (after npm run build): run with EQUIPMENT_TAB=visible and EQUIPMENT_TAB=hidden.
 * Each run checks native component-on-unit synthesis in both dev and production preview.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { chromium } = require('playwright');
const h = require('./m8-b10-browser-support.cjs');
const output = path.resolve(process.env.M8_BR4_EVIDENCE_DIR || 'artifacts/m8-br4-public');
const recipes = { 'thiefs-gloves': ['gloves', 'gloves'], 'jeweled-gauntlet': ['rod', 'gloves'], 'last-whisper': ['bow', 'gloves'], 'sunfire-cape': ['vest', 'belt'] };
const combatEvents = events => events.filter(e => e.domain === 'combat');

function routePolicy(recipe) {
  const original = fs.readFileSync(path.join(h.root, 'scripts/generate-m5-route.cjs'), 'utf8');
  const from = original.indexOf(' function components()'), to = original.indexOf(' function choices()', from);
  assert(from >= 0 && to > from);
  let source = original.slice(0, from) + ` function components(){const counts={};for(const item of inventory())counts[item.definitionId]=(counts[item.definitionId]||0)+1;for(const id of ${JSON.stringify(recipe)}){if(counts[id])counts[id]--;else return id;}return 'belt';}\n` + original.slice(to);
  const a = source.indexOf(' function items()'), b = source.indexOf(' function formation()', a);
  assert(a >= 0 && b > a); source = source.slice(0, a) + ' function items(){}\n' + source.slice(b);
  const filename = path.join(h.root, 'scripts/m8-br4-route-policy.cjs'), policy = new Module(filename, module);
  policy.filename = filename; policy.paths = Module._nodeModulePaths(path.dirname(filename)); policy._compile(source, filename);
  return policy.exports;
}
function ingredientIds(state, recipe) {
  const picked = [];
  for (const id of recipe) { const item = state.items.find(i => i.location.kind === 'inventory' && i.definitionId === id && !picked.includes(i.id)); if (!item) return null; picked.push(item.id); }
  return picked;
}
async function fixture(d, id, upgrade = false) {
  const { BattleHistory, validateBattleCollection } = await d.load('/src/replay/index.ts');
  const { validateEnvelope } = await d.load('/src/persistence/format.ts');
  const runId = `br4-${id}${upgrade ? '-upgrade' : ''}`, history = new BattleHistory(runId), stop = new Error('legal prefix captured');
  let match, purchase;
  const api = { ...d.api,
    startMatchCombat(before) {
      if (!upgrade && before.roundDefinitionId === '2-5') { match = before; throw stop; }
      return d.api.startMatchCombat(before);
    },
    buyUnit(before, slot, generation) {
      const definitionId = before.shop.slots[slot]?.definitionId;
      const copies = before.preparation.units.filter(u => u.team === 'player' && u.definitionId === definitionId && u.starLevel === 1);
      if (upgrade && copies.length === 2 && ingredientIds(before, recipes[id]) && before.phase === 'preparation') {
        const expected = d.api.buyUnit(before, slot, generation);
        if (expected.ok && expected.state.preparation.units.some(u => u.team === 'player' && u.definitionId === definitionId && u.starLevel === 2)) {
          match = before; purchase = { slot, generation, definitionId, holderId: copies[0].id }; throw stop;
        }
      }
      return d.api.buyUnit(before, slot, generation);
    }
  };
  const commands = [];
  try { await routePolicy(recipes[id]).run(api, { build: 'cannon', seed: 42, onStep(before, result, command) {
    if (command) commands.push(command);
    history.observe({ before, after: result.state, events: combatEvents(result.events), reason: command ? 'command' : 'tick' });
  } }); } catch (error) { if (error !== stop) throw error; }
  assert(match && ingredientIds(match, recipes[id]), `${runId}: complete recipe through public rewards`);
  const envelope = { kind: 'hex-autobattler-save', saveFormatVersion: 2, replayFormatVersion: 2, runId, createdAt: '2026-10-11T00:00:00.000Z', match, battles: history.completedRecords, currentBattle: null };
  await validateEnvelope(JSON.parse(JSON.stringify(envelope)), validateBattleCollection);
  const file = path.join(output, `${runId}.json`); fs.writeFileSync(file, JSON.stringify(envelope));
  fs.writeFileSync(path.join(output, `${runId}-commands.json`), JSON.stringify(commands, null, 2));
  return { file, runId, match, roundId: match.roundDefinitionId, purchase, completedBattles: envelope.battles.length, commands: commands.length };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { ...h.identity(), equipmentTab: process.env.EQUIPMENT_TAB || 'visible', scope: 'BR4 public-command save scenarios; dev and production preview, 1440x1000; native component synthesis, full native combat and exact state/ledger checks', checks: [], fixtures: [], errors: [], passed: false };
  let d, browser, app, page;
  const accepted = r => { assert(r.ok !== false, r.reason); return r.state; };
  const click = name => page.locator(h.debug(name)).click();
  const state = async () => (await h.read(page)).state;
  const equal = async expected => assert.deepEqual(await state(), expected, 'complete MatchState');
  const check = (name, evidence) => { report.checks.push({ name, passed: true, evidence }); console.log(`PASS ${name}`); };
  try {
    d = await h.domain(); const fixtures = {};
    for (const id of Object.keys(recipes)) fixtures[id] = await fixture(d, id);
    const upgrading = await fixture(d, 'thiefs-gloves', true);
    report.fixtures = [...Object.values(fixtures), upgrading].map(({ match, file, ...f }) => ({ ...f, file: path.basename(file), provenance: 'public Match commands and rewards only; validateEnvelope + validateBattleCollection passed' }));
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] }); report.browser = browser.version();
    async function open(f) {
      page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(15000);
      page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); }); page.on('dialog', v => v.accept());
      await installEquipmentCommands(page); await h.boot(page, app.url); await h.importFixture(page, f);
      await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
      await equal(f.match);
    }
    async function combine(id) {
      const before = await state(), ids = ingredientIds(before, recipes[id]); assert(ids);
      const selectors = await d.load('/src/simulation/item-selectors.ts');
      await equal(before); assert(selectors.previewCombine(before, ...ids).allowed);
      const expected = accepted(d.api.combineItems(before, ...ids)); await equipmentCommand(page, 'combine', ...ids); await equal(expected);
      const item = expected.items.find(i => i.definitionId === id && i.location.kind === 'inventory'); assert(item); return item.id;
    }
    async function equip(item, holder, slot = 0) {
      const before = await state(); await equal(before);
      const expected = accepted(d.api.equipItem(before, item, holder, slot)); await dragEquipment(page, item, holder); await equal(expected); return expected;
    }
    async function nativeSynthesis(mode) {
      await open(fixtures['sunfire-cape']);
      const before = await state(), ids = ingredientIds(before, recipes['sunfire-cape']); assert(ids);
      const holder = before.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'board'
        && !before.items.some(item => item.location.kind === 'unit' && item.location.unitId === unit.id));
      assert(holder, 'native synthesis has a board unit with empty equipment slots');
      const selectors = await d.load('/src/simulation/item-selectors.ts');
      const drops = [];
      let expected = before;
      for (const [index, itemId] of ids.entries()) {
        const preview = selectors.previewEquip(expected, itemId, holder.id, 0);
        assert(preview.allowed, `component ${index + 1} can be dropped on the same unit`);
        if (index === 1) assert.equal(preview.combination?.resultDefinitionId, 'sunfire-cape');
        expected = accepted(d.api.equipItem(expected, itemId, holder.id, 0));
        // Only native mouse input commits either component; no combine/equip callback.
        drops.push(await dragEquipment(page, itemId, holder.id));
        await equal(expected);
        const observed = await state();
        assert(!observed.items.some(item => item.id === itemId && item.location.kind === 'inventory'));
        if (index === 0) {
          assert.deepEqual(observed.items.find(item => item.id === itemId)?.location, { kind: 'unit', unitId: holder.id, slot: 0 });
          assert(observed.items.some(item => item.id === ids[1] && item.location.kind === 'inventory'), 'second component remains in inventory before its drag');
        }
      }
      const observed = await state(), view = selectors.readUnitEquipment(observed, holder.id);
      const finished = observed.items.find(item => item.id === view.slots[0].itemInstanceId);
      assert.equal(finished?.definitionId, 'sunfire-cape', 'expected finished item occupies the unit equipment slot');
      assert.deepEqual(finished.location, { kind: 'unit', unitId: holder.id, slot: 0 });
      for (const id of ids) {
        assert(!observed.items.some(item => item.id === id && item.location.kind === 'inventory'), `component ${id} left inventory`);
        assert(!observed.items.some(item => item.id === id), `component ${id} was consumed by synthesis`);
        assert.equal(await page.locator(h.debug(`item:${id}`)).count(), 0, `component ${id} disappeared from the item bench`);
      }
      const point = unitPoint(await h.read(page), holder.id);
      await page.mouse.click(point.x, point.y);
      const collapsedStats = page.locator('details.stats-details:not([open]) > summary');
      if (await collapsedStats.count()) await collapsedStats.click();
      const detail = page.locator(h.debug(`unit-equipment:${holder.id}`));
      await detail.waitFor({ state: 'visible' });
      assert.equal(await detail.innerText(), '装备槽：1 日炎斗篷 · 2 空 · 3 空');
      await equal(expected);
      await page.screenshot({ path: path.join(output, `${mode}-native-component-synthesis.png`) });
      check(`${mode}-native-component-synthesis`, { components: ids, holder: holder.id, item: finished.id, definitionId: finished.definitionId, drops, exactState: true });
      await page.close(); page = null;
    }
    for (const mode of ['dev', 'preview']) {
      app = await h.appServer(mode);
      await nativeSynthesis(mode);
      for (const [id, f] of Object.entries(fixtures)) {
        await open(f); const item = await combine(id);
        const combined = await state(), spare = combined.items.find(i => i.location.kind === 'inventory' && i.id !== item); assert(spare);
        const selectors = await d.load('/src/simulation/item-selectors.ts');
        assert.equal(selectors.previewCombine(combined, item, spare.id).reason, 'invalid-recipe');
        const refusedCombine = d.api.combineItems(combined, item, spare.id);
        assert.equal(refusedCombine.ok, false); assert.equal(refusedCombine.reason, 'invalid-recipe');
        assert.deepEqual(refusedCombine.state, combined); assert.deepEqual(refusedCombine.events, []); await equal(combined);
        const units = combined.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board');
        const holder = (id === 'jeweled-gauntlet' ? units.find(u => u.definitionId === 'maddie') : units.find(u => u.definitionId === 'rell')) ?? units[0]; assert(holder);
        let equipped = await equip(item, holder.id, id === 'thiefs-gloves' ? 2 : 0);
        if (id === 'thiefs-gloves') {
          assert.equal(equipped.items.find(i => i.id === item).location.slot, 0);
          assert.equal(equipped.temporaryEquipment.filter(t => t.holderId === holder.id).length, 2);
          const view = selectors.readUnitEquipment(equipped, holder.id);
          for (const slot of [1, 2]) assert.equal(view.slots[slot].reservedByItemInstanceId, item);
          assert.equal(selectors.previewEquip(equipped, spare.id, holder.id, 0).reason, 'exclusive-slots');
          const refused = d.api.equipItem(equipped, spare.id, holder.id, 0); assert.equal(refused.reason, 'exclusive-slots');
          await dragEquipment(page, spare.id, holder.id); await equal(equipped);
          assert((await page.locator('.panel-status').innerText()).includes('独占'));
        }
        let expected = d.api.startMatchCombat(equipped), events = combatEvents(expected.events), end = accepted(expected);
        if (id === 'jeweled-gauntlet') assert(end.combat.units.find(u => u.id === holder.id).spellCrit.enabled, 'JG enables ability critical eligibility in the real combat');
        while (end.phase === 'combat') { const step = d.api.stepMatch(end); events.push(...combatEvents(step.events)); end = step.state; }
        const abilityCriticalPackets = events.filter(e => e.type === 'packetDamage' && e.outcome.critical && e.outcome.context.source.sourceKind === 'ability' && e.outcome.context.source.ownerId === holder.id).length;
        if (id === 'jeweled-gauntlet') assert(abilityCriticalPackets > 0, 'real ability critical damage, not merely a displayed item');
        if (id === 'last-whisper' || id === 'sunfire-cape') {
          const kind = id === 'last-whisper' ? 'sunder' : 'burn';
          assert(events.some(e => e.type === 'statusChanged' && e.group.kind === kind && e.group.contributions.some(c => c.source.definitionId === id)), `${id}: real ${kind} event`);
        }
        await click('mobile:start-combat');
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
        await equal(end); const observed = await h.read(page);
        assert.deepEqual(observed.combatEvents, events, 'entire browser combat ledger equals public domain continuation');
        fs.writeFileSync(path.join(output, `${mode}-${id}-combat.json`), JSON.stringify({ fixture: f.runId, holder: holder.id, item, state: observed.state, combatEvents: observed.combatEvents }));
        const evidence = { round: f.roundId, item, holder: holder.id, ticks: end.combat.tick, events: events.length, abilityCriticalPackets, exactStateAndLedger: true };
        if (id === 'thiefs-gloves') {
          assert.equal(end.phase, 'settlement'); const next = accepted(d.api.nextRound(end, end.round));
          await click('mobile:continue'); await equal(next);
          const oldChildren = equipped.temporaryEquipment.map(t => t.temporaryId);
          assert(next.temporaryEquipment.every(t => !oldChildren.includes(t.temporaryId)), 'next round regenerates temporary identities');
          const sold = accepted(d.api.sellUnit(next, holder.id));
          await page.locator('canvas').scrollIntoViewIfNeeded(); await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
          const token = (await h.read(page)).tokens.find(t => t.id === holder.id); assert(token?.visible);
          await page.mouse.move(token.screenX, token.screenY); await page.keyboard.press('e'); await equal(sold);
          assert(sold.items.some(i => i.id === item && i.location.kind === 'inventory'));
          assert(!sold.temporaryEquipment.some(t => t.holderId === holder.id)); evidence.nextRoundAndSale = true;
        }
        await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(output, `${mode}-${id}.png`) });
        check(`${mode}-${id}-public-combine-equip-combat`, evidence); await page.close(); page = null;
      }
      await open(upgrading); const item = await combine('thiefs-gloves'), p = upgrading.purchase;
      const equipped = await equip(item, p.holderId, 2), expected = accepted(d.api.buyUnit(equipped, p.slot, p.generation));
      await click(`mobile:buy-${p.slot}`); await equal(expected);
      const upgraded = expected.preparation.units.find(u => u.team === 'player' && u.definitionId === p.definitionId && u.starLevel === 2); assert(upgraded);
      assert.equal(expected.items.find(i => i.id === item).location.unitId, upgraded.id);
      assert.equal(expected.temporaryEquipment.filter(t => t.holderId === upgraded.id).length, 2);
      check(`${mode}-native-third-copy-upgrade-keeps-tg`, { ...p, upgradedId: upgraded.id, exactState: true });
      await page.close(); page = null; await app.close(); app = null;
    }
    assert.equal(report.errors.length, 0); report.finalIdentity = h.identity();
    assert.equal(report.finalIdentity.sourceFingerprint, report.sourceFingerprint, 'runtime source unchanged');
    report.passed = true;
  } catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); }
  finally { fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2)); await page?.close(); await browser?.close(); await app?.close(); await d?.server.close(); }
})();
