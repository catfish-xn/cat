/**
 * Work order C5 acceptance in a real browser.
 *
 *   npm run build:game && node tests/server/e2e/c5-spectate.mjs
 *
 * 1. Real server (`?server=ws`), two browser contexts: A opens B's board from the right column; the panel
 *    matches B's own `__CAT_DEBUG__` deployed and bench units and shows no streak; every `view` frame A received
 *    carries public boards without shop/gold/streak/ids. Esc and a second click close it.
 * 2. A empties its board and is eliminated while the match goes on: spectate banner, every command control
 *    disabled, no command frame leaves the page, opponent boards still open; the ranking appears at the end.
 * 3. Local room (`?mode=online`): the panel opens and matches my own deployed units.
 * Screenshots go to artifacts/c5/ (not committed). CHROMIUM overrides the browser path.
 */
import { spawn } from 'node:child_process';
import { watchServerReplayErrors } from '../../../scripts/replay-error-guard.cjs';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c5`;
const VITE_PORT = 5198;
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const children = [];
function start(command, args, env, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    watchServerReplayErrors(child, stopAll);
    const timer = setTimeout(() => reject(new Error(`${command} did not become ready`)), 30_000);
    const onData = data => { const text = String(data); if (process.env.VERBOSE) process.stdout.write(text); if (ready.test(text)) { clearTimeout(timer); resolve(child); } };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`${command} exited with ${code}`)); });
  });
}
const stopAll = () => { for (const child of children) child.kill('SIGTERM'); };
const check = (condition, message) => { if (!condition) throw new Error(`check failed: ${message}`); console.log(`ok  ${message}`); };
const read = page => page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null);
async function waitRead(page, predicate, what, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(snapshot?.m6 ?? null)}`);
    await page.waitForTimeout(100);
  }
}
/** Deployed units of a MatchState in the public shape (definition, star, cell, item definitions in slot order). */
function deployed(state) {
  return state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board').map(unit => ({
    definitionId: unit.definitionId, starLevel: unit.starLevel, cell: `${unit.location.cell.col},${unit.location.cell.row}`,
    items: state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unit.id).sort((a, b) => a.location.slot - b.location.slot).length,
  })).sort((a, b) => a.cell.localeCompare(b.cell));
}
/** Bench units of a MatchState in the panel's shape (definition, star, `bench-<slot>`, item count). */
function benched(state) {
  return state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'bench').map(unit => ({
    definitionId: unit.definitionId, starLevel: unit.starLevel, cell: `bench-${unit.location.slot}`,
    items: state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unit.id).length,
  })).sort((a, b) => a.cell.localeCompare(b.cell));
}
const panelBench = page => page.evaluate(() => [...document.querySelectorAll('#opponent-board .opponent-bench .opponent-unit')].map(node => ({
  definitionId: node.dataset.definition, starLevel: Number(node.dataset.star), cell: node.dataset.debug.replace('online:opponent-unit:', ''),
  items: node.querySelectorAll('.item-mark').length,
})).sort((a, b) => a.cell.localeCompare(b.cell)));
const panelUnits = page => page.evaluate(() => [...document.querySelectorAll('#opponent-board .opponent-grid .opponent-unit')].map(node => ({
  definitionId: node.dataset.definition, starLevel: Number(node.dataset.star), cell: node.dataset.debug.replace('online:opponent-unit:', ''),
  items: node.querySelectorAll('.item-mark').length,
})).sort((a, b) => a.cell.localeCompare(b.cell)));
const seatOf = page => page.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: '8787', CAT_PREP_SEC: '6', CAT_CHOICE_SEC: '1', CAT_SETTLE_SEC: '1' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  const open = async (label, query, before = () => {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    before(page);
    page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`); });
    await page.goto(`${BASE}?${query}`);
    await page.waitForSelector('[data-debug="online:join"]');
    return page;
  };
  try {
    /* ---------------- 1. real server, two contexts ---------------- */
    const viewsA = [], sentA = [];
    const a = await open('A', 'mode=online&server=ws', page => page.on('websocket', socket => {
      socket.on('framereceived', frame => { try { const message = JSON.parse(String(frame.payload)); if (message.type === 'view') viewsA.push(message); } catch { /* binary */ } });
      socket.on('framesent', frame => { try { sentA.push(JSON.parse(String(frame.payload))); } catch { /* ignore */ } });
    }));
    const b = await open('B', 'mode=online&server=ws');
    await a.fill('[data-debug="online:name"]', '甲'); await a.click('[data-debug="online:join"]');
    await b.fill('[data-debug="online:name"]', '乙'); await b.click('[data-debug="online:join"]');
    await a.waitForFunction(() => document.querySelectorAll('[data-debug="online:queue-entry"]').length === 2);
    await a.click('[data-debug="online:start"]');
    await Promise.all([a, b].map(page => waitRead(page, s => s.m6.mode === 'active' && s.m6.phase?.kind === 'preparation' && s.state.phase === 'preparation', 'match start')));
    const seatA = await seatOf(a), seatB = await seatOf(b);
    check(seatA && seatB && seatA !== seatB, `A at ${seatA}, B at ${seatB}`);
    const avatar = await a.evaluate(seat => document.querySelector(`[data-debug="online:avatar:${seat}"]`)?.dataset.definition ?? null, seatB);
    const bState = (await read(b)).state;
    check(avatar === deployed(bState)[0]?.definitionId, `B's avatar in A's sidebar is its deployed unit (${avatar})`);

    await a.click(`[data-debug="online:seat:${seatB}"]`);
    await a.waitForSelector('#opponent-board:not([hidden])');
    const shownB = await panelUnits(a), ownB = deployed((await read(b)).state);
    check(JSON.stringify(shownB) === JSON.stringify(ownB), `A's panel of B matches B's deployed units ${JSON.stringify(ownB)}`);
    const panelText = await a.textContent('#opponent-board');
    const shownBench = await panelBench(a), ownBench = benched((await read(b)).state);
    check(JSON.stringify(shownBench) === JSON.stringify(ownBench), `A's panel of B matches B's bench units ${JSON.stringify(ownBench)}`);
    check(!/金币|商店|连胜|连败/.test(panelText.replace('不含商店、金币、连胜', '')), 'panel shows no gold, shop or streak');
    check((await read(a)).m6.viewingSeatId === seatB && await a.evaluate(seat => document.querySelector(`[data-debug="online:seat:${seat}"]`).classList.contains('viewing'), seatB), 'B is marked as the seat being viewed');
    await a.screenshot({ path: `${OUT}/1-a-views-b.png` });
    await a.keyboard.press('Escape');
    check(await a.isHidden('#opponent-board'), 'Esc closes the panel');
    await a.click(`[data-debug="online:seat:${seatB}"]`); await a.click(`[data-debug="online:seat:${seatB}"]`);
    check(await a.isHidden('#opponent-board'), 'a second click on the same seat closes it');
    check(sentA.every(message => message.type !== 'command'), 'opening and closing the panel sent no command');

    const forbidden = ['gold', 'shop', 'streak', 'xp', 'seed', 'rngState', 'id', 'location', 'choiceId'];
    const leaks = viewsA.flatMap(message => message.view.seats.flatMap(seat => {
      const keys = new Set(); const walk = value => { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) { keys.add(key); walk(inner); } };
      walk(seat.publicBoard); return forbidden.filter(key => keys.has(key)).map(key => `${seat.seatId}.${key}`);
    }));
    check(viewsA.length > 0 && viewsA.every(message => message.view.seats.every(seat => seat.publicBoard && Array.isArray(seat.publicBoard.units))) && leaks.length === 0,
      `${viewsA.length} view frames: every seat has publicBoard, no ${forbidden.join('/')} keys`);

    // B keeps a unit; A sells every unit it owns so it loses every round. Bench units are sold too: the deadline
    // auto-deployment (contract §15.4) would otherwise move them onto the empty board.
    const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
    const sellAll = async () => {
      let sold = 0;
      for (;;) {
        const snapshot = await read(a);
        if (snapshot.state.phase !== 'preparation' || snapshot.m6.phase?.kind !== 'preparation' || snapshot.m6.spectating) return sold;
        const unit = mine(snapshot.state)[0];
        if (!unit) return sold;
        // Use the existing UI callbacks, as harness.click does. Pointer actionability/scrolling on the
        // rerendered left panel can outlast the short preparation; never swallow a failed sale.
        await a.evaluate(id => {
          const click = debug => {
            const button = document.querySelector(`[data-debug="${debug}"]`);
            if (!button || button.disabled || button.closest('[inert]')) throw new Error(`unavailable sale control: ${debug}`);
            button.click();
          };
          click('panel:units');
          click(`mobile:unit:${id}`);
          if (window.__CAT_DEBUG__.read().selectedId !== id) throw new Error(`unit not selected: ${id}`);
          click('mobile:sell');
        }, unit.id);
        await waitRead(a, s => !mine(s.state).some(entry => entry.id === unit.id), `sale of ${unit.id}`, 5_000);
        sold++;
      }
    };
    await waitRead(a, s => s.state.phase === 'preparation' && s.m6.phase?.kind === 'preparation', 'preparation to empty A', 60_000);
    let sold = await sellAll();
    check(mine((await read(a)).state).length === 0, `A sold its ${sold} unit(s); board and bench are empty`);

    // During carousel the private state can still say preparation; only the server preparation allows sales.
    // Rewards and carousel picks may add units later. Keep selling them every preparation until A is
    // eliminated, so deadline auto-deployment cannot repopulate its board from the bench.
    const deadline = Date.now() + 900_000;
    let spectating, emptyCombat = false;
    for (;;) {
      const snapshot = await read(a);
      if (snapshot.m6.spectating === true || snapshot.m6.phase?.kind === 'ended') { spectating = snapshot; break; }
      if (snapshot.state.phase === 'preparation' && snapshot.m6.phase?.kind === 'preparation') sold += await sellAll();
      else if (snapshot.state.phase === 'combat') {
        check(mine(snapshot.state).length === 0, `A fights with an empty board and bench (${snapshot.state.roundDefinitionId})`);
        emptyCombat = true;
        // Wait for a new phase rather than checking the same combat on every poll.
        await waitRead(a, s => s.state.phase !== 'combat' || s.m6.spectating === true || s.m6.phase?.kind === 'ended', 'combat to finish', 60_000);
      }
      if (Date.now() > deadline) throw new Error('timed out waiting for A eliminated');
      await a.waitForTimeout(100);
    }
    check(emptyCombat && sold > 0, `A sold its ${sold} unit(s) and fought with an empty board`);
    if (spectating.m6.spectating) {
      const me = spectating.m6.seats.find(seat => seat.seatId === seatA);
      const banner = await a.textContent('[data-debug="online:spectate"]');
      check(banner.includes('已淘汰') && banner.includes(`第 ${me.rank} 名`) && banner.includes('观战中'), `spectate banner "${banner}"`);
      const countdown = await a.textContent('#online-countdown');
      check(countdown.includes('观战中'), `top line "${countdown.trim()}"`);
      const controls = await a.evaluate(() => [...document.querySelectorAll('#shop-dock button, #strategy-root .action-bar button')].map(button => ({ name: button.dataset.debug, disabled: button.disabled })));
      check(controls.length > 0 && controls.every(control => control.disabled), `all ${controls.length} dock/action buttons disabled`);
      check(await a.evaluate(() => document.getElementById('shop-dock').inert && document.getElementById('strategy-root').inert), 'shop dock and left panel are inert');
      const before = sentA.length;
      await a.keyboard.press('d'); await a.keyboard.press('f');
      const forced = await a.evaluate(() => { const button = document.querySelector('[data-debug="mobile:reroll"]'); button.disabled = false; button.click(); return document.querySelector('.panel-status')?.textContent ?? ''; });
      await a.waitForTimeout(300);
      check(sentA.slice(before).every(message => message.type !== 'command'), `no command left the page after D/F and a forced click (status "${forced}")`);
      await a.click(`[data-debug="online:seat:${seatB}"]`);
      await a.waitForSelector('#opponent-board:not([hidden])');
      check(JSON.stringify(await panelUnits(a)) === JSON.stringify(deployed((await read(b)).state)), 'a spectator still opens B\'s board and it matches B');
      await a.screenshot({ path: `${OUT}/2-a-spectating.png` });
      await a.keyboard.press('Escape');
    } else console.log('note: the match ended before A was eliminated alone; spectate checks skipped this run');
    const ended = await Promise.all([a, b].map(page => waitRead(page, s => s.m6.phase?.kind === 'ended' && s.m6.ranking !== null, 'ranking', 900_000)));
    check(await a.isVisible('.ranking-overlay') && ended[0].m6.ranking.length === 8, 'ranking overlay pops up for the eliminated player at the end');
    check(JSON.stringify(ended[0].m6.ranking.map(seat => seat.seatId)) === JSON.stringify(ended[1].m6.ranking.map(seat => seat.seatId)), 'both pages agree on the ranking');
    await a.screenshot({ path: `${OUT}/3-a-ranking.png` });

    /* ---------------- 3. local room ---------------- */
    const local = await open('local', 'mode=online&prep=30');
    await local.click('[data-debug="online:join"]'); await local.click('[data-debug="online:start"]');
    await waitRead(local, s => s.m6.mode === 'active' && s.m6.phase?.kind === 'preparation', 'local start');
    check((await read(local)).m6.transport === 'local-room', 'local room transport');
    const seatLocal = await seatOf(local);
    const status = await local.textContent('.panel-status');
    check(!/开始战斗|点击 ?继续|新局/.test(status), `local status has no single-player call to action ("${status}")`);
    await local.click(`[data-debug="online:seat:${seatLocal}"]`);
    await local.waitForSelector('#opponent-board:not([hidden])');
    check(JSON.stringify(await panelUnits(local)) === JSON.stringify(deployed((await read(local)).state)), 'local room: my own public board matches my deployed units');
    const bot = await local.evaluate(() => [...document.querySelectorAll('.online-seat')].map(node => node.dataset.debug.replace('online:seat:', '')).find(id => id.startsWith('bot')));
    await local.click(`[data-debug="online:seat:${bot}"]`);
    const botBoard = (await read(local)).m6.seats.find(seat => seat.seatId === bot).publicBoard.units
      .map(unit => ({ definitionId: unit.definitionId, starLevel: unit.starLevel, cell: `${unit.cell.col},${unit.cell.row}`, items: unit.items.length })).sort((x, y) => x.cell.localeCompare(y.cell));
    check(await local.getAttribute('#opponent-board', 'data-seat') === bot && JSON.stringify(await panelUnits(local)) === JSON.stringify(botBoard),
      `local room: switching to ${bot} shows its published board ${JSON.stringify(botBoard)}`);
    await local.screenshot({ path: `${OUT}/4-local-panel.png` });
    check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  } finally {
    await browser.close();
    stopAll();
  }
}
main().then(() => { console.log('C5 run passed'); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
