/**
 * G5 acceptance against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/g5-stats-economy.mjs
 *
 * 1. Battle ranking (本场): in every settlement after a battle of mine the right column shows that round's battle, one
 *    row per unit of both sides of the replay the server pushed (rows ≥ both sides' units, each side's count equal);
 *    each row's damage dealt / taken (HP damage + shield absorbed), shield part, healing done (the heal shares by their
 *    source, SR-G5-01) and healing received (by target) equal the replay events' own sums, worked out here independently
 *    of the page's `summarizeBattle`; every heal's shares add up to its actual; the 伤害/承伤/治疗 tabs sort by that metric.
 * 2. Match totals (本局累计): in the same settlement, the rows equal the sum of every battle of mine so far (the replays
 *    of rounds ≤ N), one row per side + unit + star level, with the number of battles it fought in; units no longer
 *    fielded keep their rows.
 * 3. Economy hint (SR-G5-02): in preparation and my battle the strip above the board shows "利息 +N（胜 +M）· 连胜/连败 X ·
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

const summary = page => page.evaluate(() => {
  const root = document.querySelector('#battle-summary');
  if (!root || root.hidden) return null;
  return { round: Number(root.dataset.round), scope: root.dataset.scope, metric: root.dataset.metric,
    rows: [...root.querySelectorAll('.summary-row')].map(node => ({ id: node.dataset.unit, team: node.dataset.team, value: Number(node.dataset.value),
      battles: node.dataset.battles === undefined ? null : Number(node.dataset.battles),
      dealt: Number(node.dataset.dealt), taken: Number(node.dataset.taken), absorbed: Number(node.dataset.absorbed), healed: Number(node.dataset.healed), received: Number(node.dataset.received) })) };
});

/** Per unit of one replay, from its events, independently of the page. */
function battleTotals(replay) {
  const rows = new Map(replay.initial.units.map(unit => [unit.id, { team: unit.team, definitionId: unit.definitionId, starLevel: unit.starLevel, dealt: 0, taken: 0, absorbed: 0, healed: 0, received: 0 }]));
  for (const frame of replay.ticks) for (const event of frame.events) {
    if (event.type === 'packetDamage') {
      const damage = event.hpDamage + event.absorbed;
      if (rows.has(event.sourceId)) rows.get(event.sourceId).dealt += damage;
      if (rows.has(event.targetId)) { rows.get(event.targetId).taken += damage; rows.get(event.targetId).absorbed += event.absorbed; }
    } else if (event.type === 'heal') {
      if (rows.has(event.targetId)) rows.get(event.targetId).received += event.actual;
      for (const share of event.shares) if (rows.has(share.sourceId)) rows.get(share.sourceId).healed += share.actual;
    }
  }
  return rows;
}
/** Side + unit + star level over `replays`, battle by battle. */
function matchTotals(replays) {
  const rows = new Map();
  for (const replay of replays) {
    const seen = new Set();
    for (const unit of battleTotals(replay).values()) {
      const key = `${unit.team}:${unit.definitionId}:${unit.starLevel}`;
      const row = rows.get(key) ?? { team: unit.team, battles: 0, dealt: 0, taken: 0, absorbed: 0, healed: 0, received: 0 };
      if (!seen.has(key)) { seen.add(key); row.battles++; }
      row.dealt += unit.dealt; row.taken += unit.taken; row.absorbed += unit.absorbed; row.healed += unit.healed; row.received += unit.received;
      rows.set(key, row);
    }
  }
  return rows;
}
const same = (shown, want) => want && shown.dealt === want.dealt && shown.taken === want.taken && shown.absorbed === want.absorbed && shown.healed === want.healed && shown.received === want.received;
/** Every heal's shares add up to its actual healing (SR-G5-01). */
const sharesAddUp = replay => replay.ticks.every(frame => frame.events.every(event => event.type !== 'heal' || event.shares.reduce((total, share) => total + share.actual, 0) === event.actual));

async function sortsByTabs(page, label) {
  for (const metric of ['damageTaken', 'healingDone', 'damageDealt']) {
    await click(page, `online:summary-tab:${metric}`); await sleep(60);
    const tab = await summary(page), values = tab?.rows.map(row => row.value) ?? [];
    check(tab?.metric === metric && values.every((value, i) => i === 0 || values[i - 1] >= value), `${label}: tab ${metric} sorts highest first (${values.slice(0, 4).join(' ≥ ')})`);
  }
}
async function checkBattle(page, round, replay, label) {
  await click(page, 'online:summary-scope:battle'); await sleep(60);
  const shown = await summary(page), expected = battleTotals(replay);
  check(shown?.round === round && shown.scope === 'battle', `${label}: the ranking shows this round's battle (round ${shown?.round})`);
  const sides = { player: 0, enemy: 0 }; for (const row of expected.values()) sides[row.team]++;
  const count = team => shown?.rows.filter(row => row.team === team).length ?? 0;
  check(shown && shown.rows.length >= sides.player + sides.enemy && count('player') === sides.player && count('enemy') === sides.enemy,
    `${label}: 本场 rows ${shown?.rows.length} ≥ both sides' units (${sides.player} mine + ${sides.enemy} enemy)`);
  const wrong = (shown?.rows ?? []).filter(row => !same(row, expected.get(row.id)));
  check(shown && wrong.length === 0, `${label}: every 本场 row's damage (HP + shield) / taken / shield / healing done / received equals the replay events' sums (${wrong.map(row => row.id).join(' ') || 'all equal'})`);
  check(sharesAddUp(replay), `${label}: every heal's shares add up to its actual healing`);
  await sortsByTabs(page, `${label} 本场`);
}
async function checkMatch(page, replays, label) {
  await click(page, 'online:summary-scope:match'); await sleep(60);
  const shown = await summary(page), expected = matchTotals(replays);
  check(shown?.scope === 'match' && shown.rows.length === expected.size, `${label}: 本局累计 has one row per side + unit + star of ${replays.length} battles (${shown?.rows.length} vs ${expected.size})`);
  const wrong = (shown?.rows ?? []).filter(row => !same(row, expected.get(row.id)) || row.battles !== expected.get(row.id)?.battles);
  check(shown && wrong.length === 0, `${label}: every 本局累计 row equals the sum of the first ${replays.length} battles (${wrong.map(row => row.id).join(' ') || 'all equal'})`);
  await sortsByTabs(page, `${label} 本局累计`);
  await click(page, 'online:summary-scope:battle');
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

    const answered = new Set(), bought = new Set(), summarised = new Set(), streakChecked = new Set();
    let sellTried = 0, retired = false, interestPositive = 0, bonusChecked = false, chipChecked = false;
    const compared = new Map(); // round → 'equal' | 'differs'
    let quiet = null; // false once a command was sent while the ranking tabs were being clicked
    /** The hint as last read before each settlement: round → EconomyHintRead (preparation and my battle). */
    const hints = new Map();
    const deadline = Date.now() + 12 * 60_000;
    while (Date.now() < deadline && !(interestPositive > 0 && bonusChecked && compared.size >= 4 && summarised.size >= 4)) {
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

      if (kind === 'preparation' && s.state.phase === 'preparation' && !s.m6.playingBack) {
        // Buy one unit in each of the first two rounds that sell one, then hoard gold so interest appears.
        const mine = s.state.preparation.units.filter(unit => unit.team === 'player');
        if (!bought.has(round) && bought.size < 2 && mine.length < 3) {
          const slot = s.state.shop.slots.findIndex(entry => entry.status === 'available');
          if (slot >= 0 && s.state.gold >= 1) { bought.add(round); await click(page, `mobile:buy-${slot}`); await sleep(300); continue; }
        }
        // Once two battles are ranked, sell a unit of mine: its rows must stay in the match totals.
        if (!retired && sellTried < 3 && round >= 4 && summarised.size >= 2) {
          const unit = mine.find(entry => entry.location.kind === 'bench') ?? mine[0];
          if (unit) {
            sellTried++;
            const before = wire.mark();
            await click(page, 'panel:units'); await click(page, `mobile:unit:${unit.id}`); await click(page, 'mobile:sell');
            const receipt = await wire.receiptSince(before, 'sell', 5_000);
            retired = receipt === 'applied';
            console.log(`note round ${round}: sold ${unit.definitionId} ${unit.starLevel}★ (${receipt})`);
          }
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
          await waitRead(page, x => x.m6.battleSummary?.round === round, `ranking of round ${round}`, 5_000).catch(() => null);
          const label = `settlement ${s.m6.phase.roundName}`;
          const before = wire.mark();
          await checkBattle(page, round, replay, label);
          await checkMatch(page, [...replays].filter(([r]) => r <= round).sort(([a], [b]) => a - b).map(([, value]) => value), label);
          if ([...wire.sent.keys()].some(id => !before.has(id))) quiet = false; else quiet ??= true;
          summarised.add(round);
          await page.screenshot({ path: `${OUT}/settlement-${round}.png` });
        }
        continue;
      }
      await sleep(100);
    }
    check(summarised.size >= 4, `ranking and match totals checked in ${summarised.size} settlements`);
    check(retired, 'sold a unit after it had fought (its match rows stay, checked by the totals above)');
    check(quiet === true, 'using the ranking tabs sends no command');
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
