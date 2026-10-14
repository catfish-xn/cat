/**
 * Work order C18-A: equipment put on a fighting unit during a battle is visibly "worn, takes effect next battle", and a
 * component clicked onto any slot button of a unit that wears a loose component goes to the combining slot (Bug 1 UI
 * side until T13-A). Real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c18-pending-equipment.mjs
 *
 * (prep) Early in a preparation with an inventory component and a board unit of mine wearing no component, one real
 *    mouse drag puts the component on that unit (the wearer).
 * (combat) Early in one of my battles (replay playing back) in which the wearer fights, with another component in the
 *    inventory: the component card is clicked (selected), then an EMPTY slot button of the wearer is clicked. The expected
 *    slot is computed here, independently, from previewEquip(state, item, wearer, slot) for slots 0–2
 *    (src/simulation/item-selectors.ts bundled with esbuild): the slot whose preview carries `combination`, else the
 *    clicked slot. Then:
 *      - exactly one equip command is sent, for that slot, and it is applied;
 *      - the panel slot holding the new item is marked pending ("下场生效", data-pending="next-battle") and its hover
 *        title lists "本场：… / 下场：…";
 *      - the wearer's token keeps the icons it fights with, and shows the new item as pending (pendingEquipped);
 *      - hovering the token shows the "本场：X / 下场：Y" tip.
 * (next) At the next preparation: no slot is marked pending any more, the token's icons include the new item and it
 *    shows nothing pending.
 * Screenshots and report go to artifacts/c18/ (not committed). CHROMIUM overrides the browser path; C18_VITE_PORT
 * (default 5206) and C18_WS_PORT (default 8798) override the ports.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c18`;
const VITE_PORT = Number(process.env.C18_VITE_PORT ?? 5206);
const WS_PORT = Number(process.env.C18_WS_PORT ?? 8798);
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const NEXT_BATTLE = '下场生效';
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
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state.phase === 'combat';
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && s.state.phase === 'preparation';
const inventory = state => state.items.filter(item => item.location.kind === 'inventory');
const wornBy = (state, unitId) => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId);
/** Every equipment slot button of the panel: pending mark, text and hover title. */
const slotMarks = page => page.evaluate(() => Array.from(document.querySelectorAll('[data-equip-unit]')).map(node => ({
  unit: node.dataset.equipUnit, slot: Number(node.dataset.equipSlot), pending: node.dataset.pending ?? null, text: node.textContent, title: node.title })));

/** The domain preview and the content table, bundled straight from the sources (never re-implemented here). */
async function loadRules() {
  const outfile = `${OUT}/rules.mjs`;
  await build({
    stdin: { contents: "export { previewEquip } from './src/simulation/item-selectors.ts';\nexport { ITEM_DEFINITIONS } from './src/simulation/content/items.ts';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'warning',
  });
  return import(`${outfile}?${Date.now()}`);
}

const report = { preparation: null, combat: null, next: null };

async function main() {
  const rules = await loadRules();
  const isComponent = item => rules.ITEM_DEFINITIONS[item.definitionId]?.kind === 'component';
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '8', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '4', CAT_BOT_STEP_MS: '150' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  const sent = new Map(), applied = new Map();
  try {
    // Tall enough that the item card, the equipment rows and the board token are on screen together (see c16).
    const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('websocket', socket => {
      socket.on('framesent', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'command') sent.set(m.commandId, m.command); } catch { /* ignore */ } });
      socket.on('framereceived', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'receipt' && sent.has(m.commandId)) applied.set(m.commandId, m.ok ? m.result.kind : `refused:${m.reason}`); } catch { /* ignore */ } });
    });
    await page.goto(`${BASE}?mode=online&server=ws&ws=ws://127.0.0.1:${WS_PORT}`);
    await page.waitForSelector('[data-debug="online:join"]');
    await page.fill('[data-debug="online:name"]', '下场生效'); await page.click('[data-debug="online:join"]');
    await page.click('[data-debug="online:start"]');

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
    const tokenOf = (s, owner) => s.tokens.find(token => token.owner === owner && token.visible);

    let wearer = null, pending = null;
    const prepSeen = new Map();
    const answered = new Set();
    const deadline = Date.now() + 14 * 60_000;
    while (!report.next) {
      if (Date.now() > deadline) throw new Error(`timed out (${!wearer ? 'no preparation with a component and a board unit' : !pending ? 'no battle with the wearer and a component' : 'no next preparation'})`);
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(100); continue; }
      if (s.m6?.phase?.kind === 'ended') throw new Error('match ended before the checks ran');
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`)) {
        answered.add(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`);
        await click(page, `choice:${choice.offers[0]}`);
      }

      // (next) The first preparation after the pending equip: marks gone, icons updated.
      if (pending) {
        if (!inPreparation(s) || s.state.round === pending.round) { await page.waitForTimeout(80); continue; }
        await click(page, 'panel:items'); await page.waitForTimeout(250);
        const now = await read(page), marks = await slotMarks(page), token = tokenOf(now, wearer);
        await page.screenshot({ path: `${OUT}/next-preparation.png` });
        const worn = now.state.items.find(item => item.id === pending.itemId);
        report.next = { round: now.state.roundDefinitionId, worn, token: token && { equipped: token.equipped, pendingEquipped: token.pendingEquipped },
          pendingMarks: marks.filter(mark => mark.pending), loadoutTip: now.loadoutTip };
        console.log(JSON.stringify(report.next));
        check(worn?.location.kind === 'unit' && worn.location.unitId === wearer, `${pending.itemId} is still worn by ${wearer} (${JSON.stringify(worn?.location)})`);
        check(report.next.pendingMarks.length === 0 && !marks.some(mark => mark.text.includes(NEXT_BATTLE)), `no slot is marked ${NEXT_BATTLE} in the next preparation (${JSON.stringify(report.next.pendingMarks)})`);
        check(token && token.equipped.includes(pending.definitionId), `the token's icons now include ${pending.definitionId} (${token?.equipped})`);
        check(token && token.pendingEquipped.length === 0, `the token shows nothing pending (${token?.pendingEquipped})`);
        check(now.loadoutTip === '', `no loadout tip outside a battle ("${now.loadoutTip}")`);
        continue;
      }

      const components = inventory(s.state).filter(isComponent);
      if (!components.length) { await page.waitForTimeout(60); continue; }

      // (prep) Put a first component on a board unit that wears none yet.
      if (!wearer) {
        if (inPreparation(s) && !prepSeen.has(s.state.round)) prepSeen.set(s.state.round, Date.now());
        if (!inPreparation(s) || Date.now() - prepSeen.get(s.state.round) > 3_000) { await page.waitForTimeout(60); continue; }
        await click(page, 'panel:items'); await page.waitForTimeout(150);
        const now = await read(page);
        if (!inPreparation(now)) continue;
        const tokens = new Map(now.tokens.map(token => [token.id, token]));
        const item = inventory(now.state).find(isComponent);
        const unit = mine(now.state).find(entry => entry.location.kind === 'board' && tokens.get(entry.id)?.visible
          && !wornBy(now.state, entry.id).some(isComponent) && [0, 1, 2].some(slot => rules.previewEquip(now.state, item.id, entry.id, slot).allowed));
        const from = item && now.strategy?.bounds[`item:${item.id}`], to = unit && tokens.get(unit.id);
        if (!from || !to) { await page.waitForTimeout(60); continue; }
        const before = new Set(sent.keys());
        await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
        await page.mouse.move(to.screenX, to.screenY, { steps: 10 }); await page.mouse.up();
        const { receipt } = await equipReceipt(before);
        report.preparation = { round: now.state.roundDefinitionId, item: item.id, definitionId: item.definitionId, unit: unit.id, receipt };
        console.log(JSON.stringify(report.preparation));
        check(receipt === 'applied', `preparation: ${item.id} equipped on ${unit.id} (${receipt})`);
        if (receipt !== 'applied') throw new Error('preparation equip failed; the combat case needs a wearer');
        wearer = unit.id;
        continue;
      }

      // (combat) Early in a long-enough battle in which the wearer fights.
      if (!(inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 80 && (s.replay.tick ?? 0) < 30)) { await page.waitForTimeout(60); continue; }
      await click(page, 'panel:items'); await page.waitForTimeout(150);
      const now = await read(page), fighting = new Set(now.combatView?.units.map(unit => unit.id));
      const token = now.tokens.find(entry => entry.owner === wearer && entry.visible && fighting.has(entry.id));
      const empty = [0, 1, 2].find(slot => !wornBy(now.state, wearer).some(item => item.location.slot === slot));
      const item = inventory(now.state).filter(isComponent).find(entry => now.strategy?.bounds[`item:${entry.id}`]);
      if (!inBattle(now) || !token || empty === undefined || !item || !now.strategy?.bounds[`equipment:${wearer}:${empty}`]) { await page.waitForTimeout(60); continue; }
      const previews = [0, 1, 2].map(slot => rules.previewEquip(now.state, item.id, wearer, slot));
      const combining = previews.findIndex(preview => preview.allowed && preview.combination);
      const expectedSlot = combining >= 0 ? combining : empty;
      if (!previews[expectedSlot].allowed) { await page.waitForTimeout(60); continue; }
      const resultDefinition = combining >= 0 ? previews[combining].combination.resultDefinitionId : item.definitionId;
      const iconsBefore = token.equipped, replayBefore = now.replay;

      const before = new Set(sent.keys());
      const card = now.strategy.bounds[`item:${item.id}`];
      await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(100);
      const slotButton = (await read(page)).strategy.bounds[`equipment:${wearer}:${empty}`];
      await page.mouse.click(slotButton.centerX, slotButton.centerY);
      const { receipt, commands } = await equipReceipt(before);
      await page.waitForTimeout(200);
      const after = await read(page), marks = await slotMarks(page);
      const newItem = after.state.items.find(entry => entry.location.kind === 'unit' && entry.location.unitId === wearer && entry.location.slot === expectedSlot);
      const mark = marks.find(entry => entry.unit === wearer && entry.slot === expectedSlot);
      const tokenAfter = tokenOf(after, wearer);
      // Hover the token where it stands now and read the tip.
      if (tokenAfter) { await page.mouse.move(tokenAfter.screenX, tokenAfter.screenY); await page.waitForTimeout(120); }
      const hovered = await read(page), tip = hovered.loadoutTip;
      await page.screenshot({ path: `${OUT}/combat-pending.png` });
      report.combat = { round: now.state.roundDefinitionId, tick: replayBefore.tick, item: item.id, wearer, clickedSlot: empty, combining, expectedSlot,
        resultDefinition, receipt, commands, newItem, mark, iconsBefore, iconsAfter: tokenAfter?.equipped, pendingEquipped: tokenAfter?.pendingEquipped, tip, inBattleAfter: inBattle(after) };
      console.log(JSON.stringify(report.combat));
      check(inBattle(after), `the equip happened during the battle (${after.m6?.phase?.kind}/${after.state.phase})`);
      check(commands.length === 1 && commands[0].itemId === item.id && commands[0].unitId === wearer && commands[0].slot === expectedSlot,
        `clicking empty slot ${empty} sends one equip for slot ${expectedSlot}${combining >= 0 ? ' (the combining slot)' : ''} (${JSON.stringify(commands)})`);
      check(receipt === 'applied', `combat: equip of ${item.id} on ${wearer} applied (${receipt})`);
      check(newItem?.definitionId === resultDefinition, `slot ${expectedSlot} now holds ${resultDefinition} (${newItem?.definitionId})`);
      check(mark?.pending === 'next-battle' && mark.text.includes(NEXT_BATTLE), `panel slot ${expectedSlot} is marked ${NEXT_BATTLE} (${JSON.stringify(mark)})`);
      check(Boolean(mark?.title.includes('本场：') && mark.title.includes('下场：')), `the slot's hover title lists both loadouts ("${mark?.title}")`);
      check(JSON.stringify(tokenAfter?.equipped) === JSON.stringify(iconsBefore), `the token keeps its battle icons (${iconsBefore} → ${tokenAfter?.equipped})`);
      check(Boolean(tokenAfter?.pendingEquipped.includes(resultDefinition)), `the token shows ${resultDefinition} as pending (${tokenAfter?.pendingEquipped})`);
      check(tip.includes('本场：') && tip.includes('下场：') && tip.includes(rules.ITEM_DEFINITIONS[resultDefinition].name), `hovering the token shows "${tip}"`);
      if (receipt !== 'applied' || !newItem) throw new Error('combat equip failed; nothing to follow into the next preparation');
      pending = { round: now.state.round, itemId: newItem.id, definitionId: newItem.definitionId };
    }
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, failures }, null, 2));
    await browser.close().catch(() => {});
    stopAll();
  }
  if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exitCode = 1; }
  else console.log('\nall C18 checks passed');
}

main().catch(error => { console.error(error); stopAll(); process.exit(1); });
