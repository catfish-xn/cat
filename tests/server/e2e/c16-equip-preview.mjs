/**
 * Work order C16: the equipment UI follows previewEquip in every phase, against the real game server (`?server=ws`),
 * one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c16-equip-preview.mjs
 *
 * During my battle (replay playing back), with an item in my inventory and one of my board units visible on the canvas:
 *   1. the item card is selectable and the native drag preview names previewEquip's reason;
 *   2. one real mouse drag carries the item from its card onto the board token;
 *   3. the expected answer is computed here, independently, by previewEquip(state, item, unit, slot) for slots 0–2 on the
 *      page's own state (src/simulation/item-selectors.ts bundled with esbuild):
 *      - no slot allowed → the status shows the EQUIPMENT_FAILURE_TEXT wording of that reason (the generic text for an
 *        unknown code), no equip command is sent and the item stays in the inventory;
 *      - a slot allowed (rules that open combat equipping) → one equip command is sent and applied, the item lands on the unit.
 * Screenshots and report go to artifacts/c16/ (not committed). CHROMIUM overrides the browser path; C16_VITE_PORT
 * (default 5203) and C16_WS_PORT (default 8795) override the ports.
 */
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { ROOT, click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, onWire, outDir, read, startGameServer, startVite, stopAll } from './harness.mjs';

const OUT = outDir('c16');
const VITE_PORT = Number(process.env.C16_VITE_PORT ?? 5203);
const WS_PORT = Number(process.env.C16_WS_PORT ?? 8795);

const { check, failures, finish } = createChecks();
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state.phase === 'combat';

/** The domain preview and the wording table, bundled straight from the sources (never re-implemented here). */
async function loadRules() {
  const outfile = `${OUT}/rules.mjs`;
  await build({
    stdin: { contents: "export { previewEquip } from './src/simulation/item-selectors.ts';\nexport { equipmentFailureText, allowedPreviewText, pickUnitDropSlot } from './src/presentation/equipment-feedback.ts';\nexport { itemDisplayName } from './src/presentation/g23-display.ts';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'warning',
  });
  return import(`${outfile}?${Date.now()}`);
}

const report = { case: null };

async function main() {
  const rules = await loadRules();
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '5', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '4', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  const sent = new Map(), applied = new Map();
  try {
    // Tall enough that the item card (left column, below the shop/units sections) and the board token are on screen
    // together: a panel re-render resets the document scroll, so the drag cannot rely on scrolling.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
    const page = await context.newPage();
    collectErrors(page, errors);
    onWire(page, {
      sent: m => { if (m.type === 'command') sent.set(m.commandId, m.command); },
      received: m => { if (m.type === 'receipt' && sent.has(m.commandId)) applied.set(m.commandId, m.ok ? m.result.kind : `refused:${m.reason}`); },
    });
    await joinOnline(page, onlineUrl(base, wsPort), '战中装备');

    const answered = new Set();
    const deadline = Date.now() + 10 * 60_000;
    while (!report.case) {
      if (Date.now() > deadline) throw new Error('timed out before a battle with an inventory item and a visible board unit');
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(100); continue; }
      if (s.m6?.phase?.kind === 'ended') throw new Error('match ended before the check ran');
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`)) {
        answered.add(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`);
        await click(page, `choice:${choice.offers[0]}`);
      }
      // Early in a long-enough battle replay, so the board token is still standing when the drag ends.
      if (!(inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 80 && (s.replay.tick ?? 0) < 30)) { await page.waitForTimeout(60); continue; }
      if (!s.state.items.some(item => item.location.kind === 'inventory')) { await page.waitForTimeout(60); continue; }
      await page.waitForTimeout(150);
      const now = await read(page);
      const item = now.state.items.find(entry => entry.location.kind === 'inventory');
      const tokens = new Map(now.tokens.map(token => [token.id, token]));
      // The healthiest unit still alive in the battle, so it is still standing when the drag ends (a unit that dies
      // meanwhile hides its token and the drop finds no target).
      const hp = new Map(now.combatView?.units.filter(entry => entry.alive).map(entry => [entry.id, entry.hp]));
      const unit = mine(now.state).filter(entry => entry.location.kind === 'board' && tokens.get(entry.id)?.visible && hp.has(entry.id))
        .sort((a, b) => hp.get(b.id) - hp.get(a.id))[0];
      const card = item && now.strategy?.bounds[`item:${item.id}`];
      if (!inBattle(now) || !item || !unit || !card) { await page.waitForTimeout(60); continue; }

      // Independent expectation: previewEquip on the page's own state for every slot.
      const previews = [0, 1, 2].map(slot => rules.previewEquip(now.state, item.id, unit.id, slot));
      const allowedSlot = previews.findIndex(preview => preview.allowed);
      const expectedSlot = rules.pickUnitDropSlot(previews);
      const main = previews.find(preview => !preview.allowed && preview.reason !== 'item-slot-occupied') ?? previews[0];
      const expectedText = allowedSlot >= 0 ? null : main.reason === 'item-slot-occupied' ? '该单位的 3 个装备槽已满' : rules.equipmentFailureText(main.reason);

      // 1. Selecting the persistent card is read-only; the hover preview is checked during the drag below.
      await page.mouse.click(card.centerX, card.centerY);
      await page.waitForTimeout(120);
      const selected = (await read(page)).strategy?.selectedItemIds ?? [];
      check(selected.includes(item.id), `selecting ${item.id} during the battle works (selected: ${selected.join(', ') || 'none'})`);
      // Unselect again so the drag starts from a clean selection.
      await page.mouse.click(card.centerX, card.centerY);
      await page.waitForTimeout(120);

      // 2. Drag the item card onto the board token.
      const fresh = await read(page);
      const from = fresh.strategy.bounds[`item:${item.id}`], to = fresh.tokens.find(token => token.id === unit.id);
      const onScreen = point => point && point.x >= 0 && point.y >= 0 && point.x < 1440 && point.y < 1600;
      check(onScreen({ x: from.centerX, y: from.centerY }) && onScreen({ x: to.screenX, y: to.screenY }),
        `precondition: item card (${Math.round(from.centerX)},${Math.round(from.centerY)}) and token (${Math.round(to.screenX)},${Math.round(to.screenY)}) are on screen`);
      const sentBefore = new Set(sent.keys());
      await page.mouse.move(from.centerX, from.centerY);
      await page.mouse.down();
      await page.mouse.move(to.screenX, to.screenY, { steps: 10 });
      // The token walks during the battle: aim at where it stands now until two reads agree, then release at once
      // (the select/deselect clicks above take long enough for the replay to start moving it).
      let standing = to;
      for (let attempt = 0; attempt < 10; attempt++) {
        const now = (await read(page)).tokens.find(token => token.id === unit.id) ?? standing;
        await page.mouse.move(now.screenX, now.screenY);
        const moved = Math.hypot(now.screenX - standing.screenX, now.screenY - standing.screenY) > 2;
        standing = now;
        if (!moved && attempt > 0) break;
      }
      const hover = await page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');
      const expectedHover = expectedSlot >= 0 ? rules.allowedPreviewText(previews[expectedSlot], expectedSlot, rules.itemDisplayName) : expectedText;
      check(hover === expectedHover,
        `drag preview of ${unit.id} shows previewEquip's answer: ${hover}`);
      await page.mouse.up();
      const status = await page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');
      const after = await read(page);
      await page.screenshot({ path: `${OUT}/combat-equip-drop.png` });
      const equipSent = [...sent].filter(([id, command]) => !sentBefore.has(id) && command.type === 'equip');
      report.case = { round: now.state.roundDefinitionId, tick: now.replay.tick, item: item.id, definitionId: item.definitionId, unit: unit.id,
        previews, expectedText, status, boardStatus: after.texts, equipSent: equipSent.map(([, command]) => command), stillInBattle: inBattle(after) };
      check(inBattle(after), `the drop happened during the battle (${after.m6?.phase?.kind}/${after.state.phase})`);
      if (expectedText !== null) {
        check(status === expectedText && after.texts.includes(expectedText),
          `drop on board unit ${unit.id}: status "${status}" is the wording of previewEquip's ${main.reason} ("${expectedText}")`);
        await page.waitForTimeout(500);
        const later = await read(page);
        check(equipSent.length === 0 && [...sent].every(([id, command]) => sentBefore.has(id) || command.type !== 'equip'), 'no equip command was sent for a refused target');
        check(later.state.items.some(entry => entry.id === item.id && entry.location.kind === 'inventory'), `${item.id} stays in the inventory`);
      } else {
        const deadlineEquip = Date.now() + 5_000;
        let receipt = null;
        while (!receipt && Date.now() < deadlineEquip) { receipt = equipSent.map(([id]) => applied.get(id)).find(Boolean) ?? null; if (!receipt) { await page.waitForTimeout(50); equipSent.splice(0, equipSent.length, ...[...sent].filter(([id, command]) => !sentBefore.has(id) && command.type === 'equip')); } }
        check(receipt === 'applied', `drop on board unit ${unit.id} with previewEquip allowing slot ${allowedSlot}: equip applied (${receipt})`);
        check(equipSent.length === 1 && equipSent[0][1].itemId === item.id && equipSent[0][1].unitId === unit.id
          && equipSent[0][1].slot === expectedSlot, `one equip for the expected item, unit and slot ${expectedSlot}`);
      }
      console.log(JSON.stringify({ ...report.case, boardStatus: undefined }));
    }
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, failures }, null, 2));
    await browser.close().catch(() => {});
    stopAll();
  }
  finish('C16');
}

main().catch(error => { console.error(error); stopAll(); process.exit(1); });
