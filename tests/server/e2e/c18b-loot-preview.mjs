/**
 * Work order C18-B on the real §18.4/§18.8 fields: the R3/R4 orb panel, the consumable shelf and a remover used during a
 * battle, over a real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c18b-loot-preview.mjs
 *
 * (orbs) After my first PvE battle with opened orbs (choice/settlement): one card per server orb in the server's order,
 *   tier and aggregate status as sent, each card listing the entries its entryDropIds reference; no fake-data mark;
 *   forfeited entries (if any) carry their reason. After a page reload (reconnect) in the same round and once the
 *   replayed battle has played out, the server's revealedLoot and the panel's orb cards are identical to before.
 * (refusal) Item tab: the shelf lists my server tools in order; picking the remover shows its hint; a unit the server
 *   does not allow is not outlined, and clicking its slot names the server's refusal and sends nothing.
 * (prep) In a preparation, one real drag puts an inventory item on a board unit of mine (the wearer).
 * (combat) Early in one of my battles in which the wearer fights: the server allows the remover on the wearer; one real
 *   drag of the remover onto the wearer's equipment row (the token moves while the battle plays) sends exactly that
 *   useConsumable, the receipt is `consumable-used`; the
 *   wearer's items are back in the inventory with their ids, the tool is gone, and the token keeps its battle icons.
 * Screenshots and report go to artifacts/c18b/ (not committed). C18B_VITE_PORT (5207) / C18B_WS_PORT (8799).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c18b`;
const VITE_PORT = Number(process.env.C18B_VITE_PORT ?? 5207);
const WS_PORT = Number(process.env.C18B_WS_PORT ?? 8799);
const URL_ = `http://127.0.0.1:${VITE_PORT}/?mode=online&server=ws&ws=ws://127.0.0.1:${WS_PORT}`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const children = [];
function start(command, args, env, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    const timer = setTimeout(() => reject(new Error(`${command} did not become ready`)), 30_000);
    const onData = data => { const text = String(data); if (process.env.VERBOSE) process.stdout.write(text); if (ready.test(text)) { clearTimeout(timer); resolve(child); } };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`${command} exited with ${code}`)); });
  });
}
const stopAll = () => { for (const child of children) child.kill('SIGTERM'); };
const failures = [];
const check = (condition, message) => { if (condition) console.log(`ok  ${message}`); else { console.log(`FAIL ${message}`); failures.push(message); } };
const read = page => page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null);
const click = (page, name) => page.evaluate(debug => { const node = document.querySelector(`[data-debug="${debug}"]`); if (node && !node.disabled) { node.click(); return true; } return false; }, name);
const orbPanel = page => page.evaluate(() => {
  const panel = document.querySelector('[data-debug="orb-loot"]');
  if (!panel) return null;
  return { fake: Boolean(panel.querySelector('.fake-tag')),
    orbs: Array.from(panel.querySelectorAll('[data-debug^="orb:"]')).map(card => ({ id: card.dataset.debug, tier: card.dataset.tier ?? null, status: card.dataset.status ?? null,
      entries: Array.from(card.querySelectorAll('.orb-entry')).map(entry => ({ id: entry.dataset.debug, status: entry.dataset.status, reason: entry.dataset.reason ?? null, title: entry.title })) })) };
});
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state.phase === 'combat';
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && s.state.phase === 'preparation';
const wornBy = (state, unitId) => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId);
const remover = state => (state.consumables ?? []).find(tool => tool.definitionId === 'magnetic-remover');
const answer = (state, toolId, unitId) => state.consumableTargets?.find(row => row.consumableId === toolId)?.targets
  .find(entry => entry.target.kind === 'unit' && entry.target.unitId === unitId);

const report = {};
async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '8', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '20', CAT_BOT_STEP_MS: '150' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [], sent = new Map(), receipts = new Map();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('websocket', socket => {
      socket.on('framesent', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'command') sent.set(m.commandId, m.command); } catch { /* ignore */ } });
      socket.on('framereceived', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'receipt' && sent.has(m.commandId)) receipts.set(m.commandId, m); } catch { /* ignore */ } });
    });
    await page.goto(URL_);
    await page.waitForSelector('[data-debug="online:join"]');
    await page.fill('[data-debug="online:name"]', '宝珠'); await page.click('[data-debug="online:join"]');
    await page.click('[data-debug="online:start"]');
    const status = () => page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');
    async function receiptOf(before, type) {
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const ids = [...sent].filter(([id, command]) => !before.has(id) && command.type === type).map(([id]) => id);
        const receipt = ids.map(id => receipts.get(id)).find(Boolean);
        if (receipt) return { receipt, commands: ids.map(id => sent.get(id)) };
        await page.waitForTimeout(50);
      }
      return { receipt: null, commands: [] };
    }

    const answered = new Set();
    let wearer = null;
    const deadline = Date.now() + 14 * 60_000;
    while (!report.combat) {
      if (Date.now() > deadline) throw new Error(`timed out (${!report.orbs ? 'no PvE settlement with opened orbs' : !report.refusal ? 'no refusal case' : !wearer ? 'no preparation equip' : 'no battle with the wearer and a remover'})`);
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(100); continue; }
      if (s.m6?.phase?.kind === 'ended') throw new Error('match ended before the checks ran');
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`)) {
        answered.add(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`);
        await click(page, `choice:${choice.offers[0]}`);
      }

      // (orbs) The first settlement/choice after a PvE battle with opened orbs, then a reload in the same round.
      if (!report.orbs) {
        const loot = s.state.revealedLoot;
        const panel = (s.state.phase === 'settlement' || s.state.phase === 'choice') && loot?.revealedOrbs?.length ? await orbPanel(page) : null;
        if (!panel) { await page.waitForTimeout(100); continue; }
        await page.screenshot({ path: `${OUT}/orb-panel.png` });
        const drops = new Set(loot.revealedDrops.map(drop => drop.dropId));
        check(!panel.fake, 'the orb panel carries no fake-data mark');
        check(JSON.stringify(panel.orbs.filter(orb => orb.id !== 'orb:other').map(orb => [orb.id, orb.tier, orb.status])) === JSON.stringify(loot.revealedOrbs.map(orb => [`orb:${orb.orbId}`, orb.tier, orb.status])),
          `one card per server orb, in order, tier and status as sent (${panel.orbs.map(orb => `${orb.tier}/${orb.status}`)})`);
        check(panel.orbs.filter(orb => orb.id !== 'orb:other').every((orb, index) => JSON.stringify(orb.entries.map(entry => entry.id)) === JSON.stringify(loot.revealedOrbs[index].entryDropIds.filter(id => drops.has(id)).map(id => `orb-entry:${id}`))),
          'each card lists exactly the visible entries its entryDropIds reference');
        const forfeited = panel.orbs.flatMap(orb => orb.entries).filter(entry => entry.status === 'forfeited');
        check(forfeited.every(entry => entry.reason === 'timeout-forfeited' || entry.reason === 'eliminated-forfeited'), `forfeited entries carry their reason (${forfeited.length})`);
        const round = s.state.round;
        await page.reload();
        let again = null, after = null;
        const reconnect = Date.now() + 25_000;
        while (!again && Date.now() < reconnect) {
          after = await read(page).catch(() => null);
          if (after?.state?.round === round) again = await orbPanel(page);
          if (!again) await page.waitForTimeout(100);
        }
        report.orbs = { round: s.state.roundDefinitionId, loot, panel, again };
        check(JSON.stringify(after?.state?.revealedLoot) === JSON.stringify(loot), `after a reload in ${s.state.roundDefinitionId} the server sends the same revealedLoot`);
        check(JSON.stringify(again?.orbs) === JSON.stringify(panel.orbs), `after a reload the orb cards are identical once the replay has played out (${again?.orbs.length ?? 'none'})`);
        continue;
      }

      // (refusal) A unit the server does not allow the remover on: not outlined, its slot click names the refusal, nothing sent.
      if (!report.refusal) {
        const tool = remover(s.state);
        const refused = tool && mine(s.state).find(unit => answer(s.state, tool.consumableId, unit.id)?.allowed === false);
        if (!tool || !refused || inBattle(s)) { await page.waitForTimeout(100); continue; }
        await click(page, 'panel:items'); await page.waitForTimeout(150);
        const tools = await page.evaluate(() => Array.from(document.querySelectorAll('[data-debug^="consumable:"]')).map(node => node.dataset.debug));
        check(JSON.stringify(tools) === JSON.stringify(s.state.consumables.map(entry => `consumable:${entry.consumableId}`)), `the shelf lists my server tools in order (${tools})`);
        const card = (await read(page)).strategy.bounds[`consumable:${tool.consumableId}`];
        if (!card) { await page.waitForTimeout(100); continue; }
        await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(150);
        const hint = await page.evaluate(() => document.querySelector('[data-debug="consumable-hint"]')?.textContent ?? '');
        const outlined = await page.evaluate(id => document.querySelector(`.equipment-row[data-unit-id="${id}"]`)?.classList.contains('consumable-candidate') ?? null, refused.id);
        const slot = (await read(page)).strategy.bounds[`equipment:${refused.id}:0`];
        const before = new Set(sent.keys());
        if (slot) { await page.mouse.click(slot.centerX, slot.centerY); await page.waitForTimeout(200); }
        const text = await status(), reason = answer(s.state, tool.consumableId, refused.id).reason;
        await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(100); // unpick
        report.refusal = { round: s.state.roundDefinitionId, unit: refused.id, reason, hint, outlined, text };
        console.log(JSON.stringify(report.refusal));
        check(hint.includes('我方单位'), `picking the remover shows its target hint ("${hint}")`);
        check(outlined === false, `${refused.id} (server: ${reason}) is not outlined as a remover target`);
        check(text.includes('拆卸器 →') && !text.includes('将拆下'), `its slot click names the refusal ("${text}")`);
        check([...sent.keys()].every(id => before.has(id)), 'nothing was sent for the refused target');
        continue;
      }

      // (prep) Put an inventory item on a board unit of mine with one real drag.
      if (!wearer) {
        if (!inPreparation(s) || !remover(s.state)) { await page.waitForTimeout(80); continue; }
        await click(page, 'panel:items'); await page.waitForTimeout(150);
        const now = await read(page);
        if (!inPreparation(now)) continue;
        const tokens = new Map(now.tokens.map(token => [token.id, token]));
        const item = now.state.items.find(entry => entry.location.kind === 'inventory' && now.strategy?.bounds[`item:${entry.id}`]);
        const unit = mine(now.state).find(entry => entry.location.kind === 'board' && tokens.get(entry.id)?.visible && wornBy(now.state, entry.id).length < 3);
        const from = item && now.strategy.bounds[`item:${item.id}`], to = unit && tokens.get(unit.id);
        if (!from || !to) { await page.waitForTimeout(80); continue; }
        const before = new Set(sent.keys());
        await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
        await page.mouse.move(to.screenX, to.screenY, { steps: 10 }); await page.mouse.up();
        const { receipt } = await receiptOf(before, 'equip');
        console.log(JSON.stringify({ prep: now.state.roundDefinitionId, item: item.id, unit: unit.id, receipt: receipt?.ok ? receipt.result.kind : receipt?.reason }));
        if (receipt?.ok) { wearer = unit.id; report.prep = { round: now.state.roundDefinitionId, item: item.id, unit: unit.id }; }
        continue;
      }

      // (combat) Early in my battle with the wearer fighting: drag the remover onto its token.
      if (!(inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 80 && (s.replay.tick ?? 0) < 30)) { await page.waitForTimeout(60); continue; }
      await click(page, 'panel:items'); await page.waitForTimeout(150);
      const now = await read(page), fighting = new Set(now.combatView?.units.map(unit => unit.id));
      const tool = remover(now.state), token = now.tokens.find(entry => entry.owner === wearer && entry.visible && fighting.has(entry.id));
      const worn = wornBy(now.state, wearer).map(item => item.id), allowed = tool && answer(now.state, tool.consumableId, wearer);
      const card = tool && now.strategy?.bounds[`consumable:${tool.consumableId}`], row = now.strategy?.bounds[`equipment:${wearer}:0`];
      if (!inBattle(now) || !tool || !token || !worn.length || !card || !row) { await page.waitForTimeout(60); continue; }
      check(allowed?.allowed === true && JSON.stringify([...allowed.affectedItemIds].sort()) === JSON.stringify([...worn].sort()), `the server allows the remover on ${wearer}, affecting ${worn.join(', ')}`);
      const iconsBefore = token.equipped, tools = now.state.consumables.length;
      const before = new Set(sent.keys());
      await page.mouse.move(card.centerX, card.centerY); await page.mouse.down();
      await page.mouse.move(row.centerX, row.centerY, { steps: 10 }); await page.waitForTimeout(80);
      const hover = await status();
      await page.mouse.up();
      const { receipt, commands } = await receiptOf(before, 'useConsumable');
      const target = Date.now() + 5_000;
      let after = await read(page);
      while (Date.now() < target && (after.state.consumables ?? []).some(entry => entry.consumableId === tool.consumableId)) { await page.waitForTimeout(80); after = await read(page); }
      const tokenAfter = after.tokens.find(entry => entry.owner === wearer && entry.visible);
      await page.screenshot({ path: `${OUT}/remover-in-battle.png` });
      report.combat = { round: now.state.roundDefinitionId, tick: now.replay.tick, wearer, worn, hover, commands, receipt, iconsBefore, iconsAfter: tokenAfter?.equipped, inBattleAfter: inBattle(after) };
      console.log(JSON.stringify(report.combat));
      check(hover.includes('拆卸器 →') && hover.includes('将拆下'), `hovering its equipment row names the removal ("${hover}")`);
      check(commands.length === 1 && JSON.stringify(commands[0]) === JSON.stringify({ type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: wearer } }), `one useConsumable for ${wearer} (${JSON.stringify(commands)})`);
      check(receipt?.ok && receipt.result.kind === 'consumable-used' && JSON.stringify(receipt.result.events.map(event => event.type)) === JSON.stringify(['itemsRemoved', 'consumableUsed']),
        `receipt consumable-used with itemsRemoved, consumableUsed (${receipt?.ok ? receipt.result.kind : receipt?.reason})`);
      check(worn.every(id => after.state.items.some(item => item.id === id && item.location.kind === 'inventory')), `${worn.join(', ')} are back in the inventory with their ids`);
      check(after.state.consumables.length === tools - 1 && !after.state.consumables.some(entry => entry.consumableId === tool.consumableId), `the remover is used up (${tools} → ${after.state.consumables.length})`);
      check(inBattle(after) && after.state.round === now.state.round, 'still the same battle');
      check(JSON.stringify(tokenAfter?.equipped) === JSON.stringify(iconsBefore), `the token keeps its battle icons (${iconsBefore} → ${tokenAfter?.equipped})`);
    }
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, failures }, null, 2));
    await browser.close().catch(() => {});
    stopAll();
  }
  if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exitCode = 1; }
  else console.log('\nall C18-B checks passed');
}
main().catch(error => { console.error(error); stopAll(); process.exit(1); });
