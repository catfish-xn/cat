/**
 * Work order C18-B: the R3/R4 orb panel and the consumable shelf on real data (MULTIPLAYER_CONTRACT §18.4/§18.8).
 * Real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c18b-loot-preview.mjs
 *
 * 1. Orbs: after my first PvE battle has played out, the orb panel shows one card per `revealedLoot.revealedOrbs` entry
 *    of my private state, in its order, with the server's tier and aggregate status and one row per referenced entry.
 * 2. Reconnect: a reload in the same round shows the same cards again once the replayed battle has played out.
 * 3. Forfeited entries: the page's own presenter (src/presentation/orb-loot.ts, loaded through Vite) renders a summary
 *    with both forfeit reasons as struck-through rows with their reason (no live match can force a forfeit on demand).
 * 4. Tools: in a preparation with a magnetic remover and an inventory item, the item is put on a board unit; during my
 *    next battle the remover is dragged onto that unit's equipment row (the token moves while the battle plays). Then: one useConsumable is sent and confirmed
 *    (`consumable-used`), the unit's items are back in the inventory with their ids, the tool is gone, the token keeps
 *    the icons it fights with, and the record page has a "拆卸：" line. Picking a tool outlines only the targets the
 *    server's consumableTargets allow.
 * Screenshots and report go to artifacts/c18b/ (not committed). C18B_VITE_PORT (5207) / C18B_WS_PORT (8799).
 */
import { writeFileSync } from 'node:fs';
import { click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, onWire, outDir, read, startGameServer, startVite, stopAll } from './harness.mjs';

const OUT = outDir('c18b');
const VITE_PORT = Number(process.env.C18B_VITE_PORT ?? 5207);
const WS_PORT = Number(process.env.C18B_WS_PORT ?? 8799);

const { check, failures, finish } = createChecks();
const status = page => page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const inventory = state => state.items.filter(item => item.location.kind === 'inventory');
const wornBy = (state, unitId) => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId);
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state.phase === 'combat';
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && s.state.phase === 'preparation';
const orbPanel = page => page.evaluate(() => {
  const panel = document.querySelector('[data-debug="orb-loot"]');
  if (!panel) return null;
  return Array.from(panel.querySelectorAll('[data-debug^="orb:"]')).map(card => ({ orbId: card.dataset.debug.slice(4), tier: card.dataset.tier ?? null, status: card.dataset.status ?? null,
    entries: Array.from(card.querySelectorAll('.orb-entry')).map(entry => ({ dropId: entry.dataset.debug.slice(10), status: entry.dataset.status, reason: entry.dataset.reason ?? null, title: entry.title })) }));
});
const expectedCards = loot => loot.revealedOrbs.map(orb => ({ orbId: orb.orbId, tier: orb.tier, status: orb.status, entries: orb.entryDropIds.filter(id => loot.revealedDrops.some(drop => drop.dropId === id)) }));
const sameCards = (shown, loot) => JSON.stringify(shown?.filter(card => card.orbId !== 'other').map(card => ({ ...card, entries: card.entries.map(entry => entry.dropId) }))) === JSON.stringify(expectedCards(loot));

const report = {};
async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '8', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '20', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [], sent = new Map(), receipts = new Map();
  try {
    // Tall enough for the item bench, the equipment rows and the board together (see c16).
    const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
    const page = await context.newPage();
    collectErrors(page, errors);
    onWire(page, {
      sent: m => { if (m.type === 'command') sent.set(m.commandId, m.command); },
      received: m => { if (m.type === 'receipt' && sent.has(m.commandId)) receipts.set(m.commandId, m.ok ? m.result.kind : `refused:${m.reason}`); },
    });
    await joinOnline(page, onlineUrl(base, wsPort), '宝珠');
    const answered = new Set();
    async function answerChoice(s) {
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation ?? 0}`)) { answered.add(`${choice.choiceId}:${choice.generation ?? 0}`); await click(page, `choice:${choice.offers[0]}`); }
    }

    // 1. The first PvE round whose orbs are shown after the battle has played out.
    let deadline = Date.now() + 5 * 60_000, shown = null, loot = null, round = null;
    while (!shown) {
      if (Date.now() > deadline) throw new Error('no PvE round with revealed orbs');
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(100); continue; }
      await answerChoice(s);
      const candidate = s.state.revealedLoot;
      const played = !s.replay?.playingBack && !inPreparation(s);
      if (played && candidate?.revealedOrbs?.length) { const panel = await orbPanel(page); if (panel?.length) { shown = panel; loot = candidate; round = s.state.round; } }
      if (!shown) await page.waitForTimeout(100);
    }
    await page.screenshot({ path: `${OUT}/orb-panel.png` });
    report.orbs = { round, loot, shown };
    check(sameCards(shown, loot), `round ${loot.roundId}: one card per revealed orb, in order, with the server's tier/status and entries (${shown.map(card => `${card.tier}:${card.status}:${card.entries.length}`).join(' ')})`);

    // 2. Reconnect in the same round: the same cards come back once the replayed battle has played out.
    await page.reload();
    let again = null;
    deadline = Date.now() + 25_000;
    while (!again && Date.now() < deadline) {
      const s = await read(page).catch(() => null);
      if (s?.state?.round === round && !s.replay?.playingBack && s.state.revealedLoot?.revealedOrbs?.length) again = await orbPanel(page);
      if (!again) await page.waitForTimeout(100);
    }
    report.reconnect = again;
    check(again !== null && JSON.stringify(again) === JSON.stringify(shown), `after a reload in round ${round} the same orb cards are back (${again?.length ?? 'none'})`);

    // 3. Forfeited rows from the page's own presenter.
    const forfeited = await page.evaluate(async () => {
      const { orbLootSection } = await import('/src/presentation/orb-loot.ts');
      const drop = (entryOrdinal, payload, status, reason) => ({ orbId: 'o', entryOrdinal, dropId: `o:${entryOrdinal}`, encounterId: 'e', sourceUnitId: 's', roundId: '2-7', payload, status,
        receiptId: status === 'granted' ? 'r' : null, allowedActions: [], ...(reason ? { reason } : {}) });
      const loot = { roundId: '2-7', revealedDrops: [drop(0, { kind: 'gold', quantity: 4 }, 'granted'), drop(1, { kind: 'unit', definitionId: 'irelia', quantity: 1 }, 'forfeited', 'timeout-forfeited'),
        drop(2, { kind: 'consumable', definitionId: 'completed-reforger', quantity: 1 }, 'forfeited', 'eliminated-forfeited')],
        revealedOrbs: [{ orbId: 'o', tier: 'prismatic', status: 'partially-claimed', entryDropIds: ['o:0', 'o:1', 'o:2'] }] };
      const section = orbLootSection(loot, { sourceName: () => '野怪' });
      return Array.from(section.querySelectorAll('.orb-entry')).map(row => ({ status: row.dataset.status, reason: row.dataset.reason ?? null, title: row.title, text: row.textContent }));
    });
    report.forfeited = forfeited;
    check(forfeited.length === 3 && forfeited[1].reason === 'timeout-forfeited' && forfeited[1].title.includes('超时') && forfeited[2].reason === 'eliminated-forfeited' && forfeited[2].title.includes('淘汰')
      && forfeited[2].text.includes('成装重铸器'), `forfeited rows carry both reasons and the content table's tool name (${JSON.stringify(forfeited)})`);

    // 4. Remover during my battle on a unit wearing an item.
    let wearer = null, used = null;
    deadline = Date.now() + 10 * 60_000;
    while (!used) {
      if (Date.now() > deadline) throw new Error(`timed out (${wearer ? 'no battle with the wearer standing' : 'no preparation with a remover and an inventory item'})`);
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(100); continue; }
      await answerChoice(s);
      const remover = (s.state.consumables ?? []).find(tool => tool.definitionId === 'magnetic-remover');
      if (!remover) { await page.waitForTimeout(100); continue; }
      if (!wearer || !s.state.items.some(item => item.location.kind === 'unit' && item.location.unitId === wearer)) {
        if (!inPreparation(s)) { await page.waitForTimeout(100); continue; }
        await click(page, 'panel:items'); await page.waitForTimeout(150);
        const now = await read(page), item = inventory(now.state)[0];
        const unit = mine(now.state).find(entry => entry.location.kind === 'board' && now.tokens.some(token => token.id === entry.id && token.visible));
        if (!item || !unit || !now.strategy.bounds[`item:${item.id}`]) { await page.waitForTimeout(100); continue; }
        // A click on the card selects it, a click on a slot equips it (C16 path).
        const card = now.strategy.bounds[`item:${item.id}`]; await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(100);
        const slot = (await read(page)).strategy.bounds[`equipment:${unit.id}:0`]; if (!slot) continue;
        await page.mouse.click(slot.centerX, slot.centerY); await page.waitForTimeout(400);
        if ((await read(page)).state.items.some(entry => entry.location.kind === 'unit' && entry.location.unitId === unit.id)) wearer = unit.id;
        continue;
      }
      // My battle, early enough that the token still stands when the drag ends.
      if (!(inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 80 && (s.replay.tick ?? 0) < 30)) { await page.waitForTimeout(60); continue; }
      await click(page, 'panel:items'); await page.waitForTimeout(150);
      const now = await read(page), fighting = new Set(now.combatView?.units.map(unit => unit.id));
      const token = now.tokens.find(entry => entry.owner === wearer && entry.visible && fighting.has(entry.id));
      const card = now.strategy.bounds[`consumable:${remover.consumableId}`], row = now.strategy.bounds[`equipment:${wearer}:0`];
      if (!token || !card || !row) { await page.waitForTimeout(60); continue; }
      // Picking the tool outlines exactly the units the server's consumableTargets allow.
      await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(120);
      const outlined = await page.evaluate(() => Array.from(document.querySelectorAll('.equipment-row.consumable-candidate')).map(row => row.dataset.unitId));
      const allowed = now.state.consumableTargets.find(row => row.consumableId === remover.consumableId).targets.filter(entry => entry.allowed && entry.target.kind === 'unit').map(entry => entry.target.unitId);
      await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(120); // unpick
      const iconsBefore = token.equipped, items = wornBy(now.state, wearer).map(item => item.id), tools = now.state.consumables.length, before = new Set(sent.keys());
      const from = (await read(page)).strategy.bounds[`consumable:${remover.consumableId}`];
      await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
      await page.mouse.move(row.centerX, row.centerY, { steps: 8 }); await page.waitForTimeout(80);
      const hover = await status(page);
      await page.mouse.up();
      let receipt = null; const until = Date.now() + 5_000;
      while (!receipt && Date.now() < until) { receipt = [...sent].filter(([id, command]) => !before.has(id) && command.type === 'useConsumable').map(([id]) => receipts.get(id)).find(Boolean) ?? null; if (!receipt) await page.waitForTimeout(50); }
      await page.waitForTimeout(300);
      const after = await read(page), tokenAfter = after.tokens.find(entry => entry.id === token.id);
      await click(page, 'panel:events'); await page.waitForTimeout(150);
      const record = await page.evaluate(() => document.querySelector('[data-debug="battle-record"]')?.textContent ?? '');
      await page.screenshot({ path: `${OUT}/remover-in-battle.png` });
      const commands = [...sent].filter(([id, command]) => !before.has(id) && command.type === 'useConsumable').map(([, command]) => command);
      used = { round: now.state.roundDefinitionId, wearer, items, hover, receipt, commands, outlined, allowed, iconsBefore, iconsAfter: tokenAfter?.equipped, tools, toolsAfter: after.state.consumables.length, record: record.slice(0, 200) };
      report.remover = used;
      console.log(JSON.stringify(used));
      check(JSON.stringify([...outlined].sort()) === JSON.stringify([...allowed].sort()), `picking the remover outlines exactly the allowed units (${outlined} vs ${allowed})`);
      check(hover.includes('拆卸器 →') && hover.includes('将拆下') && !items.some(id => hover.includes(id)), `hovering its equipment row names what will be removed, by item name ("${hover}")`);
      check(commands.length === 1 && commands[0].consumableId === remover.consumableId && commands[0].target.kind === 'unit' && commands[0].target.unitId === wearer, `one useConsumable for ${wearer} (${JSON.stringify(commands)})`);
      check(receipt === 'consumable-used', `the receipt is consumable-used (${receipt})`);
      check(items.length > 0 && items.every(id => after.state.items.some(item => item.id === id && item.location.kind === 'inventory')), `the unit's items ${items.join(', ')} are back in the inventory with their ids`);
      check(after.state.consumables.length === tools - 1, `the remover is used up (${tools} → ${after.state.consumables.length})`);
      check(inBattle(after) && JSON.stringify(tokenAfter?.equipped) === JSON.stringify(iconsBefore), `the token keeps the icons it fights with (${iconsBefore} → ${tokenAfter?.equipped})`);
      check(record.includes('拆卸：'), `the record page has a removal line ("${record.slice(0, 80)}")`);
    }
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, failures }, null, 2));
    await browser.close().catch(() => {});
    stopAll();
  }
  finish('C18-B');
}
main().catch(error => { console.error(error); stopAll(); process.exit(1); });
