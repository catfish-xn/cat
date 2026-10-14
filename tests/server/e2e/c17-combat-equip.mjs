/**
 * Work order C17: dropping a component on a unit that already wears one combines it (previewEquip's `combination`),
 * and equipment changed outside preparation says it takes effect next battle. Real game server (`?server=ws`),
 * one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c17-combat-equip.mjs
 *
 * (b, preparation) In a preparation with an inventory component and a board unit of mine without a permanent component,
 *    one real mouse drag carries the component onto the board token: the equip is applied and the status line does not
 *    say "下场生效".
 * (a, combat) Later, during one of my battles (replay playing back) with a component in the inventory and the unit that
 *    wears the first component standing on the board, the expected answer is computed here, independently, by
 *    previewEquip(state, item, unit, slot) for slots 0–2 (src/simulation/item-selectors.ts bundled with esbuild). When a
 *    slot answers with `combination`:
 *      - hovering the token during the drag shows "将合成 ⟨成装名⟩" (the name from ITEM_DEFINITIONS);
 *      - the drop sends one equip command for that slot, it is applied, and the slot now holds the finished item while
 *        the inventory holds one item less;
 *      - the status line says "下场生效";
 *      - the battle on the board is untouched: same replay (no new replay, none superseded), the token keeps the icons
 *        it was fought with, and the unit's maxHp/armor/magicResist in the combat view are unchanged.
 * Screenshots and report go to artifacts/c17/ (not committed). CHROMIUM overrides the browser path; C17_VITE_PORT
 * (default 5205) and C17_WS_PORT (default 8797) override the ports.
 */
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { ROOT, click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, onWire, outDir, read, startGameServer, startVite, stopAll } from './harness.mjs';

const OUT = outDir('c17');
const VITE_PORT = Number(process.env.C17_VITE_PORT ?? 5205);
const WS_PORT = Number(process.env.C17_WS_PORT ?? 8797);
const NEXT_BATTLE = '下场生效';

const { check, failures, finish } = createChecks();
const panelStatus = page => page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state.phase === 'combat';
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && s.state.phase === 'preparation';
const inventory = state => state.items.filter(item => item.location.kind === 'inventory');
const wornBy = (state, unitId) => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId);

/** The domain preview and the content table, bundled straight from the sources (never re-implemented here). */
async function loadRules() {
  const outfile = `${OUT}/rules.mjs`;
  await build({
    stdin: { contents: "export { previewEquip } from './src/simulation/item-selectors.ts';\nexport { ITEM_DEFINITIONS } from './src/simulation/content/items.ts';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'warning',
  });
  return import(`${outfile}?${Date.now()}`);
}

const report = { preparation: null, combat: null };

async function main() {
  const rules = await loadRules();
  const isComponent = item => rules.ITEM_DEFINITIONS[item.definitionId]?.kind === 'component';
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '8', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '4', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  const sent = new Map(), applied = new Map();
  try {
    // Tall enough that the item card and the board token are on screen together (see c16).
    const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
    const page = await context.newPage();
    collectErrors(page, errors);
    onWire(page, {
      sent: m => { if (m.type === 'command') sent.set(m.commandId, m.command); },
      received: m => { if (m.type === 'receipt' && sent.has(m.commandId)) applied.set(m.commandId, m.ok ? m.result.kind : `refused:${m.reason}`); },
    });
    await joinOnline(page, onlineUrl(base, wsPort), '战中合成');

    /** One real mouse drag from the item card to the token; returns the status shown while hovering the token. */
    async function drag(itemId, tokenId) {
      const fresh = await read(page);
      const from = fresh.strategy.bounds[`item:${itemId}`], to = fresh.tokens.find(token => token.id === tokenId);
      await page.mouse.move(from.centerX, from.centerY);
      await page.mouse.down();
      await page.mouse.move(to.screenX, to.screenY, { steps: 10 });
      // The token may walk during a battle: aim at where it stands now, then read the hover preview and release.
      const standing = (await read(page)).tokens.find(token => token.id === tokenId) ?? to;
      await page.mouse.move(standing.screenX, standing.screenY);
      const hover = await panelStatus(page);
      await page.mouse.up();
      return hover;
    }
    /** The receipt of the equip command(s) sent since `before`. */
    async function equipReceipt(before) {
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const ids = [...sent].filter(([id, command]) => !before.has(id) && command.type === 'equip').map(([id]) => id);
        const receipt = ids.map(id => applied.get(id)).find(Boolean);
        if (receipt) return { receipt, commands: ids.map(id => sent.get(id)) };
        await page.waitForTimeout(50);
      }
      return { receipt: null, commands: [] };
    }

    let wearer = null;
    const prepSeen = new Map();
    const answered = new Set();
    const deadline = Date.now() + 12 * 60_000;
    while (!report.combat) {
      if (Date.now() > deadline) throw new Error(`timed out (${wearer ? 'no battle with a combinable component' : 'no preparation with a component and a board unit'})`);
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(100); continue; }
      if (s.m6?.phase?.kind === 'ended') throw new Error('match ended before the checks ran');
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`)) {
        answered.add(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`);
        await click(page, `choice:${choice.offers[0]}`);
      }
      const components = inventory(s.state).filter(isComponent);
      if (!components.length) { await page.waitForTimeout(60); continue; }

      // (b) Preparation: put a first component on a board unit that wears no permanent component yet.
      if (!wearer) {
        // Only early in an 8 s preparation, so the drop and its receipt land before the deadline.
        if (inPreparation(s) && !prepSeen.has(s.state.round)) prepSeen.set(s.state.round, Date.now());
        if (!inPreparation(s) || Date.now() - prepSeen.get(s.state.round) > 3_000) { await page.waitForTimeout(60); continue; }
        await click(page, 'panel:items'); await page.waitForTimeout(150);
        const now = await read(page);
        if (!inPreparation(now)) continue;
        const tokens = new Map(now.tokens.map(token => [token.id, token]));
        const item = inventory(now.state).find(isComponent);
        const unit = mine(now.state).find(entry => entry.location.kind === 'board' && tokens.get(entry.id)?.visible
          && !wornBy(now.state, entry.id).some(isComponent) && [0, 1, 2].some(slot => rules.previewEquip(now.state, item.id, entry.id, slot).allowed));
        if (!item || !unit || !now.strategy?.bounds[`item:${item.id}`]) { await page.waitForTimeout(60); continue; }
        const before = new Set(sent.keys());
        const hover = await drag(item.id, unit.id);
        const { receipt, commands } = await equipReceipt(before);
        await page.waitForTimeout(150);
        const after = await read(page), status = await panelStatus(page);
        await page.screenshot({ path: `${OUT}/preparation-equip.png` });
        report.preparation = { round: now.state.roundDefinitionId, item: item.id, definitionId: item.definitionId, unit: unit.id, hover, status, receipt, commands };
        console.log(JSON.stringify(report.preparation));
        check(inPreparation(after), `the preparation drop was confirmed within preparation (${after.m6?.phase?.kind}/${after.state.phase})`);
        check(receipt === 'applied', `preparation: equip of ${item.id} on ${unit.id} applied (${receipt})`);
        check(after.state.items.some(entry => entry.id === item.id && entry.location.kind === 'unit' && entry.location.unitId === unit.id), `${item.id} is worn by ${unit.id}`);
        check(status !== '' && !status.includes(NEXT_BATTLE) && !after.texts.some(text => text.includes(NEXT_BATTLE)),
          `preparation: success status "${status}" does not say ${NEXT_BATTLE}`);
        if (receipt !== 'applied') throw new Error('preparation equip failed; the combat case needs a worn component');
        wearer = unit.id;
        continue;
      }

      // (a) Combat: early in a long-enough battle replay, so the token is still standing when the drag ends.
      if (!(inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 80 && (s.replay.tick ?? 0) < 30)) { await page.waitForTimeout(60); continue; }
      await click(page, 'panel:items'); await page.waitForTimeout(150);
      const now = await read(page);
      const token = now.tokens.find(entry => entry.id === wearer && entry.visible);
      const options = inventory(now.state).filter(isComponent).map(item => {
        const previews = [0, 1, 2].map(slot => rules.previewEquip(now.state, item.id, wearer, slot));
        const slot = previews.findIndex(preview => preview.allowed && preview.combination);
        return { item, previews, slot };
      }).filter(option => option.slot >= 0 && now.strategy?.bounds[`item:${option.item.id}`]);
      if (!inBattle(now) || !token || !options.length) { await page.waitForTimeout(60); continue; }
      const { item, previews, slot } = options[0];
      const combination = previews[slot].combination, resultName = rules.ITEM_DEFINITIONS[combination.resultDefinitionId].name;
      const combatUnit = now.combatView?.units.find(unit => unit.id === wearer);
      const stats = unit => unit && { maxHp: unit.maxHp, armor: unit.armor, magicResist: unit.magicResist };
      const replayBefore = now.replay, iconsBefore = token.equipped, inventoryBefore = inventory(now.state).length;

      const before = new Set(sent.keys());
      const hover = await drag(item.id, wearer);
      const { receipt, commands } = await equipReceipt(before);
      await page.waitForTimeout(150);
      const after = await read(page), status = await panelStatus(page);
      await page.screenshot({ path: `${OUT}/combat-combine-drop.png` });
      const worn = after.state.items.find(entry => entry.location.kind === 'unit' && entry.location.unitId === wearer && entry.location.slot === slot);
      const tokenAfter = after.tokens.find(entry => entry.id === wearer);
      report.combat = { round: now.state.roundDefinitionId, tick: now.replay.tick, item: item.id, definitionId: item.definitionId, unit: wearer, slot,
        combination, resultName, hover, status, receipt, commands, worn, inventoryBefore, inventoryAfter: inventory(after.state).length,
        statsBefore: stats(combatUnit), statsAfter: stats(after.combatView?.units.find(unit => unit.id === wearer)),
        iconsBefore, iconsAfter: tokenAfter?.equipped, replayBefore, replayAfter: after.replay };
      console.log(JSON.stringify(report.combat));
      check(inBattle(after), `the combat drop happened during the battle (${after.m6?.phase?.kind}/${after.state.phase})`);
      check(hover.includes(`将合成 ${resultName}`), `hovering ${wearer} shows the combine preview: "${hover}"`);
      check(commands.length === 1 && commands[0].itemId === item.id && commands[0].unitId === wearer && commands[0].slot === slot,
        `one equip command for the combining slot ${slot} (${JSON.stringify(commands)})`);
      check(receipt === 'applied', `combat: equip of ${item.id} on ${wearer} applied (${receipt})`);
      check(worn?.definitionId === combination.resultDefinitionId, `slot ${slot} of ${wearer} now holds ${combination.resultDefinitionId} (${worn?.definitionId})`);
      check(!after.state.items.some(entry => combination.consumedItemIds.includes(entry.id)), `both components ${combination.consumedItemIds.join(' + ')} are consumed`);
      check(inventory(after.state).length === inventoryBefore - 1, `inventory holds one item less (${inventoryBefore} → ${inventory(after.state).length})`);
      check(status.includes(NEXT_BATTLE) && after.texts.some(text => text.includes(NEXT_BATTLE)), `combat: success status "${status}" says ${NEXT_BATTLE}`);
      check(after.replay?.terminalTick === replayBefore.terminalTick && after.replay?.superseded === replayBefore.superseded && after.replay?.played >= replayBefore.played,
        `the battle on the board is the same replay (terminal ${replayBefore.terminalTick}, superseded ${replayBefore.superseded} → ${after.replay?.superseded})`);
      check(JSON.stringify(tokenAfter?.equipped) === JSON.stringify(iconsBefore), `the token keeps the icons it is fighting with (${iconsBefore} → ${tokenAfter?.equipped})`);
      check(combatUnit && JSON.stringify(report.combat.statsAfter) === JSON.stringify(report.combat.statsBefore),
        `the unit's battle stats are unchanged (${JSON.stringify(report.combat.statsBefore)} → ${JSON.stringify(report.combat.statsAfter)})`);
    }
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, failures }, null, 2));
    await browser.close().catch(() => {});
    stopAll();
  }
  finish('C17');
}

main().catch(error => { console.error(error); stopAll(); process.exit(1); });
