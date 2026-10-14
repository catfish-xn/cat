/**
 * Work order C18-B (pre-wiring, fake data): the R3/R4 orb panel and the consumable shelf, driven by the local sample
 * behind `?fakeLoot=1` until T13-B projects the real §18.4 fields. Real game server (`?server=ws`), one human + bots.
 *
 *   npm run build:game && node tests/server/e2e/c18b-loot-preview.mjs
 *
 * Checks: after my first PvE battle (choice/settlement) the orb panel shows one card per tier (gray/blue/gold/prismatic)
 * with their entries, forfeited entries carry their reason (timeout-forfeited / eliminated-forfeited), and the panel is
 * marked as fake data; after a page reload (reconnect) in the same settlement it is still there; on the item tab the
 * consumable shelf lists the three tools, picking one shows its target hint and clicking a slot sends no command.
 * Screenshots and report go to artifacts/c18b/ (not committed). C18B_VITE_PORT (5207) / C18B_WS_PORT (8799).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c18b`;
const VITE_PORT = Number(process.env.C18B_VITE_PORT ?? 5207);
const WS_PORT = Number(process.env.C18B_WS_PORT ?? 8799);
const URL_ = `http://127.0.0.1:${VITE_PORT}/?mode=online&server=ws&ws=ws://127.0.0.1:${WS_PORT}&fakeLoot=1`;
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
    orbs: Array.from(panel.querySelectorAll('[data-debug^="orb:"]')).map(card => ({ tier: card.dataset.tier ?? null, status: card.dataset.status ?? null,
      entries: Array.from(card.querySelectorAll('.orb-entry')).map(entry => ({ status: entry.dataset.status, reason: entry.dataset.reason ?? null, title: entry.title })) })) };
});

const report = {};
async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '6', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '30', CAT_BOT_STEP_MS: '150' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [], sent = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('websocket', socket => socket.on('framesent', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'command') sent.push(m.command); } catch { /* ignore */ } }));
    await page.goto(URL_);
    await page.waitForSelector('[data-debug="online:join"]');
    await page.fill('[data-debug="online:name"]', '宝珠预览'); await page.click('[data-debug="online:join"]');
    await page.click('[data-debug="online:start"]');

    // 1. The first settlement (or choice) after a PvE battle shows the sample orb panel.
    const deadline = Date.now() + 4 * 60_000;
    let panel = null, state = null;
    while (!panel) {
      if (Date.now() > deadline) throw new Error('no settlement with the orb panel');
      state = await read(page).catch(() => null);
      if (state?.state && (state.state.phase === 'settlement' || state.state.phase === 'choice') && state.state.m8.round.kind === 'pve') panel = await orbPanel(page);
      if (!panel) await page.waitForTimeout(100);
    }
    await page.screenshot({ path: `${OUT}/orb-panel.png` });
    report.panel = panel;
    check(panel.fake, 'the panel says it shows fake data');
    check(JSON.stringify(panel.orbs.map(orb => orb.tier)) === JSON.stringify(['gray', 'blue', 'gold', 'prismatic']), `one card per tier (${panel.orbs.map(orb => orb.tier)})`);
    const forfeited = panel.orbs.flatMap(orb => orb.entries).filter(entry => entry.status === 'forfeited');
    check(forfeited.some(entry => entry.reason === 'timeout-forfeited' && entry.title.includes('超时')) && forfeited.some(entry => entry.reason === 'eliminated-forfeited' && entry.title.includes('淘汰')),
      `forfeited entries show both reasons (${JSON.stringify(forfeited)})`);

    // 2. Reconnect in the same settlement: the panel is shown again.
    const round = state.state.round;
    await page.reload();
    let again = null, last = null;
    const reconnect = Date.now() + 25_000;
    while (!again && Date.now() < reconnect) {
      const s = await read(page).catch(() => null);
      last = s?.state ? { round: s.state.round, phase: s.state.phase, mode: s.m6?.mode } : last;
      // A reconnect replays my battle first; the panel returns once it has played out (C18-B).
      if (s?.state?.round === round) again = await orbPanel(page);
      if (!again) await page.waitForTimeout(100);
    }
    report.reconnect = again ?? last;
    check(again && again.orbs.length === 4, `after a reload in round ${round} the orb panel is back (${again?.orbs.length ?? JSON.stringify(last)})`);

    // 3. Item tab: the shelf; a real click picks a tool (hint + outlined targets); real drags onto a board piece and an
    //    equipment row name the target and say the use is not wired yet; nothing is sent.
    await click(page, 'panel:items'); await page.waitForTimeout(150);
    const tools = await page.evaluate(() => Array.from(document.querySelectorAll('[data-debug^="consumable:"]')).map(node => node.dataset.consumableDef));
    report.tools = tools;
    check(JSON.stringify(tools) === JSON.stringify(['magnetic-remover', 'component-reforger', 'completed-reforger']), `the shelf lists the three tools (${tools})`);
    const status = () => page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');
    const bounds = async name => (await read(page)).strategy.bounds[name];
    const before = sent.length;
    const remover = await bounds('consumable:fake-tool-1');
    await page.mouse.click(remover.centerX, remover.centerY); await page.waitForTimeout(150);
    const hint = await page.evaluate(() => document.querySelector('[data-debug="consumable-hint"]')?.textContent ?? '');
    const candidates = await page.evaluate(() => document.querySelectorAll('.equipment-row.consumable-candidate').length);
    check(hint.includes('拖到我方单位') && hint.includes('§18.1'), `clicking the remover picks it: hint names its target and the pending contract ("${hint}")`);
    check(candidates > 0, `unit rows are outlined as remover targets (${candidates})`);
    const slot = await page.evaluate(() => { const node = document.querySelector('[data-equip-unit]'); return node ? node.dataset.debug : null; });
    if (slot) { const box = await bounds(slot); await page.mouse.click(box.centerX, box.centerY); await page.waitForTimeout(150); }
    const slotStatus = await status();
    check(slotStatus.includes('磁力拆卸器 →') && slotStatus.includes('待接线'), `a slot click with the remover picked names the target, sends nothing ("${slotStatus}")`);
    await page.mouse.click(remover.centerX, remover.centerY); await page.waitForTimeout(150); // unpick

    async function dragTool(name, to) {
      const from = await bounds(name);
      await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 }); await page.waitForTimeout(80);
      const hover = await status();
      await page.mouse.up(); await page.waitForTimeout(150);
      return { hover, dropped: await status() };
    }
    const snapshot = await read(page);
    const mineIds = new Set(snapshot.state.preparation.units.filter(unit => unit.team === 'player').map(unit => unit.id));
    const piece = snapshot.tokens.find(token => token.visible && mineIds.has(token.owner ?? token.id));
    const onBoard = piece ? await dragTool('consumable:fake-tool-1', { x: piece.screenX, y: piece.screenY }) : null;
    check(Boolean(onBoard?.hover.includes('磁力拆卸器 →') && onBoard.hover.includes('待接线')), `dragging the remover over my piece names it and says not wired ("${onBoard?.hover}")`);
    check(Boolean(onBoard?.dropped.includes('未使用')), `dropping it uses nothing ("${onBoard?.dropped}")`);
    const row = await page.evaluate(() => { const node = document.querySelector('.equipment-row'); if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; });
    const onRow = row ? await dragTool('consumable:fake-tool-2', row) : null;
    check(Boolean(onRow?.hover.includes('组件重铸器 →') && onRow.hover.includes('待接线')), `dragging the reforger over a unit row names the target and leaves legality to the preview ("${onRow?.hover}")`);
    await page.screenshot({ path: `${OUT}/consumable-drag.png` });
    report.tool = { hint, candidates, slotStatus, onBoard, onRow };
    check(sent.length === before, `no command was sent for any tool action (${JSON.stringify(sent.slice(before))})`);
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
