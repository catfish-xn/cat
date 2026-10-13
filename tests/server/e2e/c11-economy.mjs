/**
 * Work order C11: economy evidence against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c11-economy.mjs
 *
 * The human never buys a unit, XP or a reroll; it only takes the first offer of any pending choice so the
 * match advances. After every settlement it reads `state.roundResults.at(-1)` and the text of
 * [data-debug="income-receipt"], up to and including 3-1, and prints one table row per round.
 *
 * Checks (rules: src/simulation/opening-economy.ts for 1-x, src/simulation/economy.ts from 2-1):
 *   - 1-2/1-3/1-4: income 2/3/5, xpAwarded 2/2/0, interest 0;
 *   - from 2-1: xpAwarded == 2 unless the level was already the maximum;
 *   - goldBefore >= 10: interest == min(5, floor(goldBefore / 10)); economy.ts samples interest on
 *     goldBefore + victory gold, so a PvP win is checked against that basis (interestBasis) and noted;
 *   - the receipt's "利息 N" and "经验 +N" equal incomeBreakdown.interest and xpAwarded of the same round, both in
 *     the breakdown and in the summary line that is visible without expanding the receipt.
 * The table and screenshots go to artifacts/c11/ (not committed). CHROMIUM overrides the browser path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c11`;
const VITE_PORT = 5199;
const WS_PORT = 8791;
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
const LAST_ROUND = '3-1';
const MAX_LEVEL = 9;
const OPENING = { '1-2': { gold: 2, xp: 2 }, '1-3': { gold: 3, xp: 2 }, '1-4': { gold: 5, xp: 0 } };
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
const text = (page, selector) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, selector);
const number = (source, pattern) => { const match = source?.match(pattern); return match ? Number(match[1]) : null; };

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '4', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '4', CAT_BOT_STEP_MS: '100' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  const sent = [];
  const rows = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('websocket', socket => socket.on('framesent', frame => {
      try { const m = JSON.parse(String(frame.payload)); if (m.type === 'command') sent.push(m.command?.type ?? m.command?.kind ?? JSON.stringify(m.command)); } catch { /* binary */ }
    }));
    await page.goto(`${BASE}?mode=online&server=ws&ws=ws://127.0.0.1:${WS_PORT}`);
    await page.waitForSelector('[data-debug="online:join"]');
    await page.fill('[data-debug="online:name"]', '攒钱'); await page.click('[data-debug="online:join"]');
    await page.click('[data-debug="online:start"]');

    const answered = new Set();
    let recorded = 0;
    const deadline = Date.now() + 15 * 60_000;
    while (rows.at(-1)?.roundId !== LAST_ROUND) {
      if (Date.now() > deadline) throw new Error(`timed out after ${rows.map(row => row.roundId).join(' ')}`);
      const s = await read(page).catch(() => null);
      if (!s?.state) { await page.waitForTimeout(150); continue; }
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`)) {
        answered.add(`${choice.choiceId}:${choice.step ?? 0}:${choice.generation ?? 0}`);
        await click(page, `choice:${choice.offers[0]}`);
      }
      const results = s.state.roundResults ?? [];
      if (results.length > recorded) {
        if (results.length > recorded + 1) throw new Error(`missed a settlement: ${results.slice(recorded).map(r => r.roundId).join(' ')}`);
        recorded = results.length;
        const r = results.at(-1);
        // The panel re-renders from the same snapshot; wait until the receipt shows this round's balance.
        let receipt = null;
        for (let i = 0; i < 30; i++) {
          receipt = await text(page, '[data-debug="income-receipt"]');
          if (receipt?.includes(`余额 ${r.goldBefore} → ${r.goldAfter}`)) break;
          await page.waitForTimeout(100);
        }
        await page.screenshot({ path: `${OUT}/${r.roundId}-settlement.png` });
        // What a player sees without expanding the receipt: its summary line, which must be on screen.
        const summary = await text(page, '[data-debug="income-receipt"] summary');
        const summaryVisible = await page.locator('[data-debug="income-receipt"] summary').isVisible().catch(() => false);
        const row = { roundId: r.roundId, result: r.result, goldBefore: r.goldBefore, goldAfter: r.goldAfter, income: r.income,
          base: r.incomeBreakdown.base, win: r.incomeBreakdown.win, interest: r.incomeBreakdown.interest, streak: r.incomeBreakdown.streak,
          interestBasis: r.interestBasis ?? null, xpAwarded: r.xpAwarded, levelBefore: r.levelBefore, levelAfter: r.levelAfter,
          xpBefore: r.xpBefore, xpAfter: r.xpAfter, hp: `${r.hpBefore}->${r.hpAfter}`,
          uiInterest: number(receipt, /\+ 利息 (\d+)/), uiXp: number(receipt, /；经验 \+(\d+)/),
          summaryInterest: number(summary, /（利息 (\d+)）/), summaryXp: number(summary, /· 经验 \+(\d+)/), uiBalance: receipt?.includes(`余额 ${r.goldBefore} → ${r.goldAfter}`) ?? false,
          summaryVisible, receipt };
        rows.push(row);
        console.log(JSON.stringify({ ...row, receipt: undefined }));
      }
      await page.waitForTimeout(150);
    }

    const header = ['roundId', 'result', 'goldBefore', 'goldAfter', 'income', 'base', 'win', 'interest', 'streak', 'interestBasis', 'xpAwarded', 'levelBefore', 'levelAfter', 'xpBefore', 'xpAfter', 'hp', 'uiInterest', 'uiXp', 'summaryInterest', 'summaryXp'];
    const table = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${header.map(key => row[key]).join(' | ')} |`)].join('\n');
    console.log(`\n${table}\n`);
    writeFileSync(`${OUT}/table.md`, `${table}\n`);
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ rows, sent, errors }, null, 2));

    // The human did not spend: no buy, XP purchase or reroll left the browser.
    check(!sent.some(type => /buy|reroll|xp|sell/i.test(type)), `human sent no buy/XP/reroll commands (${[...new Set(sent)].join(', ') || 'none'})`);
    for (const row of rows) {
      const opening = OPENING[row.roundId];
      if (opening) {
        check(row.income === opening.gold && row.xpAwarded === opening.xp && row.interest === 0,
          `${row.roundId} opening: income ${row.income} (want ${opening.gold}), xp ${row.xpAwarded} (want ${opening.xp}), interest ${row.interest} (want 0)`);
      } else {
        if (row.levelBefore < MAX_LEVEL) check(row.xpAwarded === 2, `${row.roundId} xpAwarded ${row.xpAwarded} == 2 (level ${row.levelBefore}→${row.levelAfter})`);
        if (row.goldBefore >= 10) {
          const plain = Math.min(5, Math.floor(row.goldBefore / 10));
          const basis = row.goldBefore + row.win;
          const want = Math.min(5, Math.floor(basis / 10));
          check(row.interest === want, `${row.roundId} interest ${row.interest} == min(5, floor(${basis}/10)) = ${want}${row.win ? ` (goldBefore ${row.goldBefore} + win ${row.win}; plain formula gives ${plain})` : ''}`);
        }
      }
      check(row.uiInterest === row.interest && row.uiXp === row.xpAwarded && row.uiBalance,
        `${row.roundId} receipt shows 利息 ${row.uiInterest} / 经验 +${row.uiXp} for incomeBreakdown.interest ${row.interest} / xpAwarded ${row.xpAwarded}`);
      check(row.summaryVisible && row.summaryInterest === row.interest && row.summaryXp === row.xpAwarded,
        `${row.roundId} visible receipt summary shows 利息 ${row.summaryInterest} / 经验 +${row.summaryXp}`);
    }
    check(rows.some(row => !OPENING[row.roundId] && row.goldBefore >= 10), 'at least one round from 2-1 settled with goldBefore >= 10');
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
    if (failures.length) throw new Error(`${failures.length} check(s) failed:\n${failures.join('\n')}`);
  } finally { await browser.close(); }
}
main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
