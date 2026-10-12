/**
 * Work order C7 investigation/acceptance against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c7-playtest.mjs
 *
 * Plays 1-2 → 2-1 like a person: buy, deploy through the 部署 tab, take loot picks; records for every round
 * whether the preparation board shows monsters, whether the battle is against them and what the settlement
 * says was obtained; then selects two components in 装备 and presses 合成, logging the server receipt.
 * C8: in the first 1-x preparation with a full board and two bench units, runs the SR-C7-01 mouse-drag swap
 * checks of swap-checks.mjs against the server (screenshots swap-*.png).
 * Screenshots go to artifacts/c7/ (not committed). CHROMIUM overrides the browser path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { runSwapChecks, swapReady } from './swap-checks.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c7`;
const VITE_PORT = 5197;
const WS_PORT = 8789;
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
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
const check = (condition, message) => { if (!condition) throw new Error(`check failed: ${message}`); console.log(`ok  ${message}`); };
const read = page => page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null);
async function waitRead(page, predicate, what, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(snapshot?.m6?.phase ?? null)} ${snapshot?.state?.phase}`);
    await page.waitForTimeout(100);
  }
}
const click = (page, name) => page.evaluate(debug => { const node = document.querySelector(`[data-debug="${debug}"]`); if (node && !node.disabled) { node.click(); return true; } return false; }, name);
const text = (page, selector) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, selector);

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '15', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '4', CAT_BOT_STEP_MS: '200' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  const receipts = [];
  const report = { rounds: [], combine: null, swap: null };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('websocket', socket => {
      socket.on('framesent', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'command') receipts.push({ sent: m.commandId, command: m.command }); } catch { /* binary */ } });
      socket.on('framereceived', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'receipt') receipts.push({ receipt: m.commandId, ok: m.ok, reason: m.reason ?? null, kind: m.result?.kind ?? null }); } catch { /* binary */ } });
    });
    await page.goto(`${BASE}?mode=online&server=ws&ws=ws://127.0.0.1:${WS_PORT}`);
    await page.waitForSelector('[data-debug="online:join"]');
    await page.fill('[data-debug="online:name"]', '测试'); await page.click('[data-debug="online:join"]');
    await page.click('[data-debug="online:start"]');
    await waitRead(page, s => s.m6.mode === 'active', 'match start');

    let lastRound = 0;
    for (;;) {
      const s = await waitRead(page, s => s.m6.phase?.kind === 'preparation' && s.m6.phase.round > lastRound, 'next preparation', 120_000);
      const round = s.m6.phase.round, roundId = s.state.roundDefinitionId, kind = s.state.m8.round.kind;
      lastRound = round;
      if (roundId === '2-1') break;
      // Buy what gold allows, then deploy bench units up to the level through the 部署 tab.
      let state = s.state;
      for (let slot = 0; slot < 5; slot++) if (state.shop.slots[slot]?.status === 'available' && state.gold >= 1) { await click(page, `mobile:buy-${slot}`); await page.waitForTimeout(250); state = (await read(page)).state; }
      await click(page, 'panel:units');
      for (let i = 0; i < 4; i++) {
        state = (await read(page)).state;
        const mine = state.preparation.units.filter(u => u.team === 'player');
        const onBoard = mine.filter(u => u.location.kind === 'board').length;
        const bench = mine.filter(u => u.location.kind === 'bench');
        if (!bench.length || onBoard >= state.level) break;
        const occupied = new Set(state.preparation.units.filter(u => u.location.kind === 'board').map(u => `${u.location.cell.col},${u.location.cell.row}`));
        const zone = state.preparation.board.deploymentZones.player;
        let cell = null;
        for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 2; col < state.preparation.board.columns && !cell; col++) if (!occupied.has(`${col},${row}`)) cell = `${col},${row}`;
        await click(page, `mobile:unit:${bench[0].id}`); await click(page, `deploy:${cell}`); await page.waitForTimeout(300);
      }
      // C8: unit swap on the real server, once, while the board is full at level ≥ 2.
      if (!report.swap && swapReady((await read(page)).state)) {
        await runSwapChecks(page, { check, shot: name => page.screenshot({ path: `${OUT}/${name}.png` }) });
        report.swap = roundId;
      }
      const prep = await read(page);
      const enemiesOnBoard = prep.state.preparation.units.filter(u => u.team === 'enemy').map(u => u.definitionId);
      const enemyTokens = prep.tokens.filter(t => t.visible && prep.state.preparation.units.some(u => u.id === t.id && u.team === 'enemy')).length;
      const preview = await text(page, '[data-debug="encounter-preview"]');
      await page.screenshot({ path: `${OUT}/${roundId}-1-preparation.png` });
      const entry = { round, roundId, kind, roomRoundKind: prep.m6.phase.roundName, enemiesOnBoard, enemyTokens, preview: preview?.slice(0, 80) ?? null,
        mine: prep.state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length };
      // Battle: what is on the board while the replay plays.
      const battle = await waitRead(page, s => s.replay?.playingBack, `${roundId} battle`, 60_000).catch(() => null);
      if (battle) {
        await page.waitForTimeout(600);
        const mid = await read(page);
        entry.battleTeams = [...new Set((mid.combatView?.units ?? []).map(u => `${u.team}:${u.definitionId}`))];
        await page.screenshot({ path: `${OUT}/${roundId}-2-battle.png` });
      } else entry.battleTeams = null;
      // Loot pick (choice) or settlement.
      const after = await waitRead(page, s => !s.replay?.playingBack && ['choice', 'settlement', 'preparation'].includes(s.m6.phase?.kind) && s.state.round === round && s.state.phase !== 'combat', `${roundId} after battle`, 60_000).catch(() => null);
      if (after?.state.phase === 'choice' && after.state.pendingChoice) {
        entry.choice = { kind: after.state.pendingChoice.kind, offers: after.state.pendingChoice.offers };
        await page.screenshot({ path: `${OUT}/${roundId}-3-choice.png` });
        await click(page, `choice:${after.state.pendingChoice.offers[0]}`);
      }
      const settle = await waitRead(page, s => s.m6.phase?.kind === 'settlement' && s.state.phase === 'settlement', `${roundId} settlement`, 60_000).catch(() => null);
      if (settle) {
        await page.waitForTimeout(300);
        const last = settle.state.roundResults.at(-1);
        entry.result = last ? { result: last.result, hp: `${last.hpBefore}->${last.hpAfter}`, gold: `${last.goldBefore}->${last.goldAfter}`, income: last.income } : null;
        entry.inventory = settle.state.items.filter(i => i.location.kind === 'inventory').map(i => i.definitionId);
        entry.bench = settle.state.preparation.units.filter(u => u.team === 'player').map(u => u.definitionId);
        entry.lootPanel = await text(page, '[data-debug="loot-panel"]');
        entry.roundLoot = await text(page, '[data-debug="online:round-loot"]');
        await page.screenshot({ path: `${OUT}/${roundId}-4-settlement.png` });
      }
      report.rounds.push(entry);
      console.log(JSON.stringify(entry));
    }

    /* ---------------- combine in 2-1 ---------------- */
    await click(page, 'panel:items');
    await page.waitForTimeout(200);
    let s = await read(page);
    const inventory = s.state.items.filter(i => i.location.kind === 'inventory');
    console.log(`2-1 inventory: ${inventory.map(i => `${i.id}:${i.definitionId}`).join(', ')}`);
    if (inventory.length >= 2) {
      for (const item of inventory.slice(0, 2)) {
        const box = await page.locator(`[data-debug="item:${item.id}"]`).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.up();
        await page.waitForTimeout(150);
      }
      const label = await text(page, '[data-debug="combine-items"]');
      const disabled = await page.evaluate(() => document.querySelector('[data-debug="combine-items"]')?.disabled ?? null);
      const selection = await text(page, '.combine-selection');
      await page.screenshot({ path: `${OUT}/2-1-5-combine-selected.png` });
      const before = receipts.length;
      await click(page, 'combine-items');
      await page.waitForTimeout(1500);
      s = await read(page);
      report.combine = { label, disabled, selection, receipts: receipts.slice(before), inventoryAfter: s.state.items.filter(i => i.location.kind === 'inventory').map(i => i.definitionId), status: await text(page, '.panel-status') };
      await page.screenshot({ path: `${OUT}/2-1-6-combine-after.png` });
    } else report.combine = { skipped: `inventory ${inventory.length}` };
    console.log(JSON.stringify(report.combine));
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
    // Item 4: 1-2, 1-3, 1-4 are monster rounds on the real server: monsters on the preparation board, fought in battle.
    const pve = report.rounds.filter(entry => ['1-2', '1-3', '1-4'].includes(entry.roundId));
    check(pve.length === 3 && pve.every(entry => entry.kind === 'pve' && entry.enemiesOnBoard.length > 0 && entry.enemyTokens === entry.enemiesOnBoard.length),
      `1-2/1-3/1-4 preparation boards show monsters: ${pve.map(entry => `${entry.roundId}×${entry.enemyTokens}`).join(' ')}`);
    check(pve.every(entry => entry.battleTeams?.some(team => team.startsWith('enemy:pve-'))), 'every 1-x battle is fought against those monsters');
    // Item 2: the settlement says what was obtained; the placeholder "本回合没有已揭示的奖励" is gone online.
    check(pve.every(entry => entry.roundLoot?.startsWith('本轮获得：') && !entry.lootPanel), `settlement shows 本轮获得: ${pve.map(entry => `${entry.roundId} ${entry.roundLoot}`).join(' | ')}`);
    const r13 = pve.find(entry => entry.roundId === '1-3');
    check(r13.roundLoot.includes('拉克丝') && r13.choice?.kind === 'component', '1-3 lists the loot hero 拉克丝 and offered a component pick');
    // Item 3: two components in inventory combine on the real server.
    check(report.combine.receipts?.some(entry => entry.receipt !== undefined && entry.ok && entry.kind === 'applied') && report.combine.inventoryAfter.length === 1,
      `combine accepted by the server: ${JSON.stringify(report.combine.receipts)} → ${report.combine.inventoryAfter}`);
    check(report.swap, `swap checks ran online (round ${report.swap})`);
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  } finally { await browser.close(); }
}
main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
