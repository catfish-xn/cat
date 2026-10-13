/**
 * Work order C12 (contract §15, T10): combat operations against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c12-combat-ops.mjs
 *
 * The human never acts in preparation (only takes the first offer of a pending choice), so the deadline decides its board.
 *   A. Deadline auto-deployment: in a round whose last preparation state had bench units and a board below the cap, the
 *      battle starts with the board filled to the cap, bench slots taken left to right, cells from the front row 4 with
 *      columns 3/2/4/1/5/0/6 skipping occupied ones (computed here from the contract text); the status says 已自动上场.
 *   B. In the first battle with enough gold: buy a unit, reroll once, buy XP through the docked shop buttons. Each gets an
 *      `applied` receipt; gold/XP/shop change on screen; the battle replay keeps playing (never superseded); bench tokens
 *      are draggable and board tokens are not; one bench → bench mouse drag lands. After the settlement its
 *      `goldBefore` is the gold left after those operations and the shown gold is `goldAfter`.
 *   C. Deferred merge: during a battle, with a one-star A on the board, buy A until two one-star copies sit on the bench
 *      (rerolling a little if needed): nothing merges during the battle; after the settlement the board copy is two-star,
 *      the bench copies are gone (state and tokens) and the status says 战后合并.
 * Screenshots and report go to artifacts/c12/ (not committed). CHROMIUM overrides the browser path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { dragUnit } from './swap-checks.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c12`;
const VITE_PORT = 5201;
const WS_PORT = 8793;
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const COLUMNS = [3, 2, 4, 1, 5, 0, 6], ROWS = [4, 5, 6, 7];
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
async function waitRead(page, predicate, what, timeout = 8_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) return null;
    await page.waitForTimeout(50);
  }
}
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const cellKey = location => location.kind === 'board' ? `${location.cell.col},${location.cell.row}` : `bench:${location.slot}`;
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state.phase === 'combat';
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && s.state.phase === 'preparation';

/** Contract §15.4, independently: bench slots left → right fill free cells front row first, columns 3/2/4/1/5/0/6. */
function expectedDeployment(prep) {
  const units = mine(prep);
  const board = units.filter(unit => unit.location.kind === 'board');
  const occupied = new Set(prep.preparation.units.filter(unit => unit.location.kind === 'board').map(unit => cellKey(unit.location)));
  const free = ROWS.flatMap(row => COLUMNS.map(col => `${col},${row}`)).filter(cell => !occupied.has(cell));
  const reserves = units.filter(unit => unit.location.kind === 'bench').sort((a, b) => a.location.slot - b.location.slot);
  const count = Math.max(0, Math.min(prep.level - board.length, reserves.length, free.length));
  return reserves.slice(0, count).map((unit, index) => [unit.id, free[index]]);
}

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '5', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '4', CAT_BOT_STEP_MS: '150' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  const sent = new Map(), applied = new Map();
  const report = { autoDeploy: [], ops: null, merge: null };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('websocket', socket => {
      socket.on('framesent', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'command') sent.set(m.commandId, m.command.type); } catch { /* ignore */ } });
      socket.on('framereceived', frame => { try { const m = JSON.parse(String(frame.payload)); if (m.type === 'receipt' && sent.has(m.commandId)) applied.set(m.commandId, m.ok ? m.result.kind : `refused:${m.reason}`); } catch { /* ignore */ } });
    });
    /** Clicks a docked control and waits for its receipt; returns the receipt kind ('applied' or 'refused:…') or null. */
    const act = async (name, type) => {
      const before = new Set(sent.keys());
      if (!(await click(page, name))) return 'disabled';
      const deadline = Date.now() + 5_000;
      for (;;) {
        const id = [...sent].find(([commandId, kind]) => !before.has(commandId) && kind === type)?.[0];
        if (id !== undefined && applied.has(id)) return applied.get(id);
        if (Date.now() > deadline) return null;
        await page.waitForTimeout(40);
      }
    };
    await page.goto(`${BASE}?mode=online&server=ws&ws=ws://127.0.0.1:${WS_PORT}`);
    await page.waitForSelector('[data-debug="online:join"]');
    await page.fill('[data-debug="online:name"]', '战中运营'); await page.click('[data-debug="online:join"]');
    await page.click('[data-debug="online:start"]');

    const answered = new Set();
    const prepByRound = new Map();
    const deployChecked = new Set();
    let opsDone = false, merge = null, mergeDone = false, rerollsThisRound = new Map();
    const deadline = Date.now() + 14 * 60_000;
    while (!(report.autoDeploy.length > 0 && opsDone && mergeDone)) {
      if (Date.now() > deadline) throw new Error(`timed out: autoDeploy ${report.autoDeploy.length}, ops ${opsDone}, merge ${JSON.stringify(merge)}`);
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(100); continue; }
      if (s.m6?.phase?.kind === 'ended') throw new Error('match ended before every check ran');
      const round = s.state.round;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`)) {
        answered.add(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`);
        await click(page, `choice:${choice.offers[0]}`);
      }
      if (inPreparation(s)) prepByRound.set(round, s.state);

      // A. The first view of my battle: compare the board with the last preparation state of the round.
      if (inBattle(s) && prepByRound.has(round) && !deployChecked.has(round)) {
        deployChecked.add(round);
        const prep = prepByRound.get(round), expected = expectedDeployment(prep);
        if (expected.length > 0) {
          const settled = await waitRead(page, x => x.state.round === round && expected.every(([id, cell]) => mine(x.state).some(unit => unit.id === id && cellKey(unit.location) === cell)), `auto-deploy of round ${round}`);
          const now = settled ?? await read(page);
          const board = mine(now.state).filter(unit => unit.location.kind === 'board');
          const statusShown = now.texts.some(text => text.startsWith(`准备时间结束 · 已自动上场 ${expected.length} 个单位`));
          report.autoDeploy.push({ round, roundId: now.state.roundDefinitionId, level: prep.level, expected, board: board.map(unit => [unit.id, cellKey(unit.location)]), statusShown });
          check(settled !== null && board.length === Math.min(prep.level, mine(prep).length),
            `A ${now.state.roundDefinitionId}: board filled to the cap ${board.length}/${prep.level} with ${expected.map(([id, cell]) => `${id}→${cell}`).join(', ')}`);
          check(mine(prep).filter(unit => unit.location.kind === 'board').every(unit => board.some(other => other.id === unit.id && cellKey(other.location) === cellKey(unit.location))),
            `A ${now.state.roundDefinitionId}: units already on the board did not move`);
          check(statusShown, `A ${now.state.roundDefinitionId}: status says 已自动上场 ${expected.length} 个单位`);
          await page.screenshot({ path: `${OUT}/A-auto-deploy-${now.state.roundDefinitionId}.png` });
        }
      }

      // B. Shop, reroll and XP in the first long-enough battle with the gold for all three.
      if (!opsDone && inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 60 && (s.replay.tick ?? 0) < 20) {
        const state = s.state;
        const slot = state.shop.slots.findIndex(offer => offer.status === 'available' && !offer.empty);
        if (slot >= 0 && state.gold >= 12 && state.level < 9) {
          const superseded = s.replay.superseded;
          const gold0 = state.gold, gen0 = state.shop.generation, xp0 = state.level * 1000 + state.xp, units0 = mine(state).length;
          const buy = await act(`mobile:buy-${slot}`, 'buy');
          const afterBuy = await waitRead(page, x => mine(x.state).length > units0 || x.state.gold < gold0, 'bought unit on screen');
          const reroll = await act('mobile:reroll', 'reroll');
          const afterReroll = await waitRead(page, x => x.state.shop.generation === gen0 + 1, 'rerolled shop on screen');
          const xp = await act('mobile:buy-xp', 'buyXp');
          const afterXp = await waitRead(page, x => x.state.level * 1000 + x.state.xp > xp0, 'XP on screen');
          const now = await read(page);
          const spent = gold0 - now.state.gold;
          const tokens = Object.fromEntries(now.tokens.map(token => [token.id, token]));
          const benchIds = mine(now.state).filter(unit => unit.location.kind === 'bench').map(unit => unit.id);
          const boardIds = mine(now.state).filter(unit => unit.location.kind === 'board').map(unit => unit.id);
          report.ops = { round, roundId: state.roundDefinitionId, gold0, goldAfter: now.state.gold, spent, receipts: { buy, reroll, xp }, replay: now.replay };
          check(buy === 'applied' && reroll === 'applied' && xp === 'applied', `B ${state.roundDefinitionId}: buy/reroll/buyXp during the battle got applied receipts (${buy}, ${reroll}, ${xp})`);
          check(afterBuy && afterReroll && afterXp && spent >= 2 + 4 + 1, `B ${state.roundDefinitionId}: gold ${gold0} → ${now.state.gold}, shop generation ${gen0} → ${now.state.shop.generation}, level/XP ${Math.floor(xp0 / 1000)}/${xp0 % 1000} → ${now.state.level}/${now.state.xp}`);
          check(now.state.phase === 'combat' && now.replay.superseded === superseded && (now.replay.playingBack || now.replay.tick === now.replay.terminalTick),
            `B ${state.roundDefinitionId}: the battle keeps playing (tick ${now.replay.tick}/${now.replay.terminalTick}, superseded ${now.replay.superseded})`);
          check(benchIds.every(id => tokens[id]?.draggable) && boardIds.every(id => !tokens[id]?.draggable),
            `B ${state.roundDefinitionId}: bench tokens draggable (${benchIds.length}), board tokens not (${boardIds.length})`);
          await page.screenshot({ path: `${OUT}/B-ops-${state.roundDefinitionId}.png` });
          // One bench → bench mouse drag during the battle.
          const used = new Set(mine(now.state).filter(unit => unit.location.kind === 'bench').map(unit => unit.location.slot));
          const empty = Array.from({ length: now.state.preparation.benchSize }, (_, index) => index).reverse().find(index => !used.has(index));
          const moving = mine(now.state).find(unit => unit.location.kind === 'bench');
          if (moving && empty !== undefined && inBattle(await read(page))) {
            await dragUnit(page, moving.id, { kind: 'bench', slot: empty });
            const moved = await waitRead(page, x => mine(x.state).some(unit => unit.id === moving.id && cellKey(unit.location) === `bench:${empty}`), 'bench drag');
            check(moved !== null, `B ${state.roundDefinitionId}: bench drag ${moving.id} ${cellKey(moving.location)} → bench:${empty} during the battle`);
          }
          const live = (await read(page)).state;
          const settled = await waitRead(page, x => x.state.roundResults.some(record => record.round === round), `settlement of round ${round}`, 60_000);
          const record = settled?.state.roundResults.find(entry => entry.round === round);
          report.ops.settlement = record ? { goldBefore: record.goldBefore, goldAfter: record.goldAfter, income: record.income, shown: settled.state.gold, live: live.gold } : null;
          check(record && record.goldBefore === live.gold && record.goldAfter === record.goldBefore + record.income,
            `B ${state.roundDefinitionId}: settlement goldBefore ${record?.goldBefore} is the live gold after the operations (${live.gold}), goldAfter ${record?.goldAfter}`);
          const shownLater = await waitRead(page, x => x.state.round === round && x.state.gold === record?.goldAfter || x.state.round > round, 'settled gold on screen');
          check(shownLater !== null, `B ${state.roundDefinitionId}: the screen shows the settled gold ${record?.goldAfter}`);
          opsDone = true;
          continue;
        }
      }

      // C. Deferred merge: one-star A on the board and two one-star A bought onto the bench during a battle.
      if (opsDone && !merge && inBattle(s) && s.replay?.playingBack) {
        const state = s.state;
        const units = mine(state).filter(unit => unit.starLevel === 1);
        const boardDefs = [...new Set(units.filter(unit => unit.location.kind === 'board').map(unit => unit.definitionId))];
        const benchOf = def => units.filter(unit => unit.definitionId === def && unit.location.kind === 'bench');
        const offersOf = (st, def) => st.shop.slots.flatMap((offer, slot) => offer.status === 'available' && offer.definitionId === def ? [slot] : []);
        const target = boardDefs.find(def => benchOf(def).length + offersOf(state, def).length >= 2 && benchOf(def).length < 3);
        if (target) {
          for (let guard = 0; guard < 3; guard++) {
            const now = (await read(page)).state;
            const bench = mine(now).filter(unit => unit.definitionId === target && unit.starLevel === 1 && unit.location.kind === 'bench').length;
            if (bench >= 2) break;
            const offer = offersOf(now, target)[0];
            if (offer === undefined || now.gold < 1) break;
            const units0 = mine(now).length;
            await act(`mobile:buy-${offer}`, 'buy');
            await waitRead(page, x => mine(x.state).length !== units0, 'deferred-merge purchase');
          }
          const during = await read(page);
          const copies = mine(during.state).filter(unit => unit.definitionId === target);
          const boardCopy = copies.find(unit => unit.location.kind === 'board' && unit.starLevel === 1);
          const benchCopies = copies.filter(unit => unit.location.kind === 'bench' && unit.starLevel === 1);
          if (boardCopy && benchCopies.length === 2 && inBattle(during)) {
            merge = { round, roundId: state.roundDefinitionId, definitionId: target, boardId: boardCopy.id, boardCell: cellKey(boardCopy.location), benchIds: benchCopies.map(unit => unit.id) };
            check(copies.every(unit => unit.starLevel === 1) && copies.length === 3,
              `C ${state.roundDefinitionId}: ${target} board ${boardCopy.id} + bench ${merge.benchIds.join(', ')} stay one-star during the battle`);
            await page.screenshot({ path: `${OUT}/C-before-merge-${state.roundDefinitionId}.png` });
          }
        } else {
          const tries = rerollsThisRound.get(round) ?? 0;
          if (tries < 3 && state.gold >= 6) { rerollsThisRound.set(round, tries + 1); await act('mobile:reroll', 'reroll'); }
        }
      }
      if (merge && !mergeDone && s.state.roundResults.some(record => record.round === merge.round)) {
        const after = await waitRead(page, x => mine(x.state).some(unit => unit.id === merge.boardId && unit.starLevel === 2), 'post-battle merge on screen', 10_000) ?? await read(page);
        const survivor = mine(after.state).find(unit => unit.id === merge.boardId);
        const token = after.tokens.find(entry => entry.id === merge.boardId);
        report.merge = { ...merge, survivor, token, consumedTokens: after.tokens.filter(entry => merge.benchIds.includes(entry.id)).map(entry => entry.id) };
        check(survivor?.starLevel === 2 && survivor.location.kind === 'board' && cellKey(survivor.location) === merge.boardCell,
          `C ${merge.roundId}: after the settlement ${merge.boardId} is two-star on the board at ${merge.boardCell}`);
        check(!mine(after.state).some(unit => merge.benchIds.includes(unit.id)) && report.merge.consumedTokens.length === 0,
          `C ${merge.roundId}: the bench copies ${merge.benchIds.join(', ')} are gone from state and board tokens`);
        check(token?.starLevel === 2 && token.visible, `C ${merge.roundId}: the survivor token shows two stars`);
        check(after.texts.some(text => text.startsWith('战后合并')), `C ${merge.roundId}: status says 战后合并`);
        await page.screenshot({ path: `${OUT}/C-after-merge-${merge.roundId}.png` });
        mergeDone = true;
      }
      await page.waitForTimeout(80);
    }
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
    if (failures.length) throw new Error(`${failures.length} check(s) failed:\n${failures.join('\n')}`);
  } finally { await browser.close(); }
}
main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
