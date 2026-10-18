/**
 * G5 acceptance against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/g5-stats-economy.mjs
 *
 * 1. Battle stats (TFT's damage chart): while my battle plays back the right column shows that battle only, one row per
 *    unit of mine in the replay the server pushed, and each row's 输出 (HP damage + shield absorbed), 治疗 (heal shares by
 *    their source, SR-G5-01) and 防护 (shield granted) equal the replay events' own sums over the ticks shown so far, worked
 *    out here independently of the page's `summarizeBattle`. So the first read of a new battle counts none of the previous
 *    one (it starts from zero). After the battle the panel holds that battle's final totals through settlement and the next
 *    preparation. The 输出/治疗/防护 tabs switch the metric and sort highest first; every heal's shares add up to its actual.
 * 2. Economy hint (SR-G5-02): in preparation and my battle the strip above the board shows "利息 +N（胜 +M）· 连胜/连败 X ·
 *    再胜/再败 +Y" from the server's `economyPreview`; the streak equals my state's. The last preview before a settlement,
 *    when the settled gold before and streak are the preview's, equals that settlement's `incomeBreakdown` item by item
 *    in the branch of the result (a draw as a loss): interest, victory gold, streak gold, and the streak after equals
 *    my settled state's (a non-zero interest and a non-zero streak gold at least once each).
 * Nothing on the panels sends a command. Screenshots go to artifacts/g5-stats/ (not committed).
 * G5_WS_PORT / G5_VITE_PORT override the ports.
 */
import { click, collectErrors, createChecks, joinOnline, launchBrowser, onWire, onlineUrl, outDir, read, sleep, startGameServer, startVite, stopAll, trackCommands, waitRead } from './harness.mjs';

const OUT = outDir('g5-stats');
const WS_PORT = Number(process.env.G5_WS_PORT ?? 8822);
const VITE_PORT = Number(process.env.G5_VITE_PORT ?? 5223);
const { check, finish } = createChecks();
const METRICS = ['shieldGiven', 'healingDone', 'damageDealt'];

const summary = page => page.evaluate(() => {
  const root = document.querySelector('#battle-summary');
  if (!root || root.hidden) return null;
  return { combat: root.dataset.combat, round: root.dataset.round, live: root.dataset.live === 'true', played: Number(root.dataset.played), metric: root.dataset.metric,
    rows: [...root.querySelectorAll('.summary-row')].map(node => ({ id: node.dataset.unit, team: node.dataset.team, value: Number(node.dataset.value),
      dealt: Number(node.dataset.dealt), healed: Number(node.dataset.healed), shielded: Number(node.dataset.shielded) })) };
});

/** Per unit of one replay, from its events over the first `played` ticks, independently of the page. */
function battleTotals(replay, played = replay.ticks.length) {
  const rows = new Map(replay.initial.units.map(unit => [unit.id, { team: unit.team, dealt: 0, healed: 0, shielded: 0 }]));
  for (const frame of replay.ticks.slice(0, played)) for (const event of frame.events) {
    if (event.type === 'packetDamage') {
      if (rows.has(event.sourceId)) rows.get(event.sourceId).dealt += event.hpDamage + event.absorbed;
    } else if (event.type === 'heal') {
      for (const share of event.shares) if (rows.has(share.sourceId)) rows.get(share.sourceId).healed += share.actual;
    } else if (event.type === 'shieldLayerChanged' && event.reason === 'granted') {
      const owner = JSON.parse(event.key)[1];
      if (rows.has(owner)) rows.get(owner).shielded += event.remaining;
    }
  }
  return rows;
}
const same = (shown, want) => want && shown.dealt === want.dealt && shown.healed === want.healed && shown.shielded === want.shielded;
/** Every heal's shares add up to its actual healing (SR-G5-01). */
const sharesAddUp = replay => replay.ticks.every(frame => frame.events.every(event => event.type !== 'heal' || event.shares.reduce((total, share) => total + share.actual, 0) === event.actual));
const combatOf = replay => replay.terminal.combatId ?? null;

async function sortsByTabs(page, label) {
  for (const metric of METRICS) {
    await click(page, `online:summary-tab:${metric}`); await sleep(60);
    const tab = await summary(page), values = tab?.rows.map(row => row.value) ?? [];
    const field = { shieldGiven: 'shielded', healingDone: 'healed', damageDealt: 'dealt' }[metric];
    check(tab?.metric === metric && values.every((value, i) => i === 0 || values[i - 1] >= value) && tab.rows.every(row => row.value === row[field]),
      `${label}: tab ${metric} shows that metric, highest first (${values.slice(0, 4).join(' ≥ ')})`);
  }
}
/** The panel shows `replay` (its first `played` ticks when live): my units only, each metric equal to the events' sums. */
function checkRows(shown, replay, label) {
  const expected = battleTotals(replay, shown.live ? shown.played : replay.ticks.length);
  const mine = [...expected.values()].filter(row => row.team === 'player').length;
  check(shown.rows.length === mine && shown.rows.every(row => row.team === 'player'), `${label}: one row per unit of mine (${shown.rows.length} vs ${mine}), no enemy rows`);
  const wrong = shown.rows.filter(row => !same(row, expected.get(row.id)));
  check(wrong.length === 0, `${label}: 输出/治疗/防护 of every row equal the replay events' sums${shown.live ? ` over ${shown.played} ticks` : ''} (${wrong.map(row => row.id).join(' ') || 'all equal'})`);
}
async function checkFinal(page, replay, label) {
  const shown = await summary(page);
  check(shown?.combat === combatOf(replay) && shown.live === false, `${label}: the stats hold this battle's final totals (${shown?.combat} live=${shown?.live})`);
  if (!shown) return;
  checkRows(shown, replay, label);
  check(sharesAddUp(replay), `${label}: every heal's shares add up to its actual healing`);
  await sortsByTabs(page, label);
}

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '12', CAT_CHOICE_SEC: '5', CAT_SETTLE_SEC: '8', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    collectErrors(page, errors);
    const wire = trackCommands(page);
    const replays = new Map(); // round → replay pushed to me
    onWire(page, { received: m => { if (m.type === 'replay') replays.set(m.round, m.replay); } });
    await joinOnline(page, onlineUrl(base, wsPort), '统计');
    await waitRead(page, s => s.m6.mode === 'active', 'match start');

    const answered = new Set(), bought = new Set(), summarised = new Set(), streakChecked = new Set(), held = new Set();
    let interestPositive = 0, bonusChecked = false, chipChecked = false;
    /** Live reads per round, and the combat whose final totals were last checked. */
    const liveReads = new Map(), freshStarts = [];
    let lastFinal = null, liveMonotonic = true;
    const compared = new Map(); // round → 'equal' | 'differs'
    let quiet = null; // false once a command was sent while the ranking tabs were being clicked
    /** The hint as last read before each settlement: round → EconomyHintRead (preparation and my battle). */
    const hints = new Map();
    const deadline = Date.now() + 12 * 60_000;
    while (Date.now() < deadline && !(interestPositive > 0 && bonusChecked && compared.size >= 4 && summarised.size >= 4 && freshStarts.length >= 2 && held.size >= 2)) {
      const s = await read(page).catch(() => null);
      if (!s?.state || !s.m6?.phase) { await sleep(100); continue; }
      const kind = s.m6.phase.kind, round = s.m6.phase.round;
      if (kind === 'ended') break;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation}`)) { answered.add(`${choice.choiceId}:${choice.generation}`); await click(page, `choice:${choice.offers[0]}`); continue; }

      const economy = s.m6.economy;
      if (economy && (kind === 'preparation' || kind === 'combat') && economy.roundId === s.state.roundDefinitionId) {
        hints.set(round, economy);
        if (!streakChecked.has(round)) { streakChecked.add(round); check(economy.streakCount === s.state.streak.count && economy.streakKind === s.state.streak.kind, `round ${round}: hint streak ${economy.streakKind ?? 'none'} ${economy.streakCount} equals my state's`); }
        // The debug read and the chips in one evaluate, so a round change cannot fall between them.
        const pair = await page.evaluate(() => {
          const shown = window.__CAT_DEBUG__?.read()?.m6?.economy ?? null;
          const node = document.querySelector('[data-debug="online:economy-interest"]'), bonus = document.querySelector('[data-debug="online:economy-bonus"]');
          return { shown, dom: node && !node.closest('[hidden]') ? { text: node.textContent, bonus: bonus && !bonus.hidden ? bonus.textContent : null } : null };
        });
        const now = pair.shown, dom = pair.dom;
        const want = now && `利息 +${now.interest}（胜 +${now.winInterest}）`;
        const bonusWant = !now || now.nextStreakGold === null ? null : `${now.streakKind === 'win' ? '再胜' : '再败'} +${now.nextStreakGold}`;
        if (now && (dom?.text !== want || dom?.bonus !== bonusWant)) check(false, `round ${round}: the chips show the preview (${dom?.text} / ${dom?.bonus} vs ${want} / ${bonusWant})`)
        else chipChecked = true;
      }

      // My battle playing back: the stats add up live over the ticks shown so far, from zero at the battle's start.
      if (kind === 'combat' && s.m6.battleSummary?.live && (liveReads.get(round)?.length ?? 0) < 4) {
        const shown = await summary(page), replay = replays.get(round);
        if (shown?.live && replay && shown.combat === combatOf(replay)) {
          const reads = liveReads.get(round) ?? [];
          const label = `round ${round} live (tick ${shown.played})`;
          if (reads.length === 0 && lastFinal && lastFinal !== shown.combat) freshStarts.push(round);
          checkRows(shown, replay, label);
          const total = shown.rows.reduce((sum, row) => sum + row.dealt + row.healed + row.shielded, 0);
          if (reads.length && total < reads[reads.length - 1]) liveMonotonic = false;
          reads.push(total); liveReads.set(round, reads);
          if (reads.length === 1) await page.screenshot({ path: `${OUT}/live-${round}.png` });
        }
        await sleep(400); continue;
      }

      if (kind === 'preparation' && s.state.phase === 'preparation' && !s.m6.playingBack) {
        // The last battle's final totals stay on the panel into the next preparation.
        if (lastFinal && !held.has(round)) {
          held.add(round);
          const shown = await summary(page);
          check(shown?.combat === lastFinal && shown.live === false, `round ${round} preparation: the stats still show the last battle's final totals (${shown?.combat})`);
        }
        // Buy one unit in each of the first two rounds that sell one, then hoard gold so interest appears.
        const mine = s.state.preparation.units.filter(unit => unit.team === 'player');
        if (!bought.has(round) && bought.size < 2 && mine.length < 3) {
          const slot = s.state.shop.slots.findIndex(entry => entry.status === 'available');
          if (slot >= 0 && s.state.gold >= 1) { bought.add(round); await click(page, `mobile:buy-${slot}`); await sleep(300); continue; }
        }
        await sleep(150); continue;
      }

      if (kind === 'settlement' && s.state.phase === 'settlement') {
        // The settled economy against the last preview of this round, item by item (SR-G5-02).
        const result = s.state.roundResults.find(entry => entry.round === round), hint = hints.get(round);
        if (result && hint && !compared.has(round) && result.result !== 'supply') {
          if (result.goldBefore === hint.gold) {
            const branch = result.result === 'playerWin' ? hint.ifWin : hint.ifLoss, label = `settlement ${result.roundId} (${result.result})`;
            const got = [branch.interest, branch.win, branch.streakGold, branch.streakAfter.kind, branch.streakAfter.count];
            const want = [result.incomeBreakdown.interest, result.incomeBreakdown.win, result.incomeBreakdown.streak, s.state.streak.kind, s.state.streak.count];
            const equal = got.every((value, index) => value === want[index]);
            check(equal, `${label}: preview interest/win/streak gold/streak after ${JSON.stringify(got)} equals the settlement ${JSON.stringify(want)} on ${hint.gold} gold`);
            compared.set(round, equal ? 'equal' : 'differs');
            if (equal && branch.interest > 0) interestPositive++;
            if (equal && branch.streakGold > 0) bonusChecked = true;
          } else { compared.set(round, 'skipped'); console.log(`note round ${round}: gold changed after the last preview (${hint.gold} → ${result.goldBefore}); not compared`); }
        }
        if (!summarised.has(round)) {
          const replay = replays.get(round);
          if (!replay) { await sleep(150); continue; } // a supply round or a seat without a battle
          await waitRead(page, x => x.m6.battleSummary?.combatId === combatOf(replay) && x.m6.battleSummary.live === false, `final stats of round ${round}`, 5_000).catch(() => null);
          const label = `settlement ${s.m6.phase.roundName}`;
          const before = wire.mark();
          await checkFinal(page, replay, label);
          lastFinal = combatOf(replay);
          if ([...wire.sent.keys()].some(id => !before.has(id))) quiet = false; else quiet ??= true;
          summarised.add(round);
          await page.screenshot({ path: `${OUT}/settlement-${round}.png` });
        }
        continue;
      }
      await sleep(100);
    }
    check(summarised.size >= 4, `final stats checked in ${summarised.size} settlements`);
    check(liveReads.size >= 3, `live stats read during ${liveReads.size} battles (${[...liveReads].map(([r, reads]) => `${r}:${reads.join('→')}`).join(' ')})`);
    check(liveMonotonic, 'the live totals only grow while a battle plays');
    check(freshStarts.length >= 2, `a new battle's stats start from zero, not from the last battle's (rounds ${freshStarts.join(' ')})`);
    check(held.size >= 2, `the final totals stayed into the next preparation in ${held.size} rounds`);
    check(quiet === true, 'using the stats tabs sends no command');
    const equal = [...compared.values()].filter(value => value === 'equal').length;
    check(equal >= 4, `the preview matched its settlement item by item in ${equal} rounds (${[...compared].map(([round, value]) => `${round}:${value}`).join(' ')})`);
    check(bonusChecked, 'a non-zero streak gold preview matched its settlement');
    check(interestPositive > 0, `a non-zero interest preview matched its settlement (${interestPositive})`);
    check(chipChecked, 'the chips showed "利息 +N（胜 +M）" and "再胜/再败 +Y" from the preview');
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => { stopAll(); finish('G5 stats/economy'); }).catch(error => { console.error(error); stopAll(); process.exit(1); });
