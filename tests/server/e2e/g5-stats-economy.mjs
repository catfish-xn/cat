/**
 * G5 acceptance against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/g5-stats-economy.mjs
 *
 * 1. Battle ranking (本场): in every settlement after a battle of mine the right column shows that round's battle, one
 *    row per unit of both sides of the replay the server pushed (rows ≥ both sides' units, each side's count equal);
 *    each row's damage dealt / taken (HP damage + shield absorbed), shield part and healing received equal the replay
 *    events' own sums; the 伤害/承伤/治疗 tabs sort by that metric.
 * 2. Match totals (本局累计): in the same settlement, the rows equal the sum of every battle of mine so far (the replays
 *    of rounds ≤ N), one row per side + unit + star level, with the number of battles it fought in; units no longer
 *    fielded keep their rows.
 * 3. Economy hint: in preparation the strip above the board shows interest, streak and last round's streak gold; the
 *    interest shown when the preparation ends equals the interest the settlement then credited (whenever the settled
 *    basis is that gold plus victory gold 0), the streak equals my state's, last round's streak gold equals the
 *    committed `incomeBreakdown.streak` (a non-zero one at least once); the settled gold is the hint's gold plus income.
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
      dealt: Number(node.dataset.dealt), taken: Number(node.dataset.taken), absorbed: Number(node.dataset.absorbed), healed: Number(node.dataset.healed) })) };
});

/** Per unit of one replay, from its events, independently of the page. */
function battleTotals(replay) {
  const rows = new Map(replay.initial.units.map(unit => [unit.id, { team: unit.team, definitionId: unit.definitionId, starLevel: unit.starLevel, dealt: 0, taken: 0, absorbed: 0, healed: 0 }]));
  for (const frame of replay.ticks) for (const event of frame.events) {
    if (event.type === 'packetDamage') {
      const damage = event.hpDamage + event.absorbed;
      if (rows.has(event.sourceId)) rows.get(event.sourceId).dealt += damage;
      if (rows.has(event.targetId)) { rows.get(event.targetId).taken += damage; rows.get(event.targetId).absorbed += event.absorbed; }
    } else if (event.type === 'heal' && rows.has(event.targetId)) rows.get(event.targetId).healed += event.actual;
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
      const row = rows.get(key) ?? { team: unit.team, battles: 0, dealt: 0, taken: 0, absorbed: 0, healed: 0 };
      if (!seen.has(key)) { seen.add(key); row.battles++; }
      row.dealt += unit.dealt; row.taken += unit.taken; row.absorbed += unit.absorbed; row.healed += unit.healed;
      rows.set(key, row);
    }
  }
  return rows;
}
const same = (shown, want) => want && shown.dealt === want.dealt && shown.taken === want.taken && shown.absorbed === want.absorbed && shown.healed === want.healed;

async function sortsByTabs(page, label) {
  for (const metric of ['damageTaken', 'healingReceived', 'damageDealt']) {
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
  check(shown && wrong.length === 0, `${label}: every 本场 row's damage (HP + shield) / taken / shield / healing equals the replay events' sums (${wrong.map(row => row.id).join(' ') || 'all equal'})`);
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

    const answered = new Set(), bought = new Set(), summarised = new Set(), compared = new Set(), streakChecked = new Set(), bonusRounds = new Set();
    let sellTried = 0, interestMatched = 0, interestPositive = 0, bonusChecked = false, settledGoldChecked = false, retired = false;
    let quiet = null; // false once a command was sent while the ranking tabs were being clicked
    /** The hint as last read in a preparation: round → { gold, interest, streakCount }. */
    const hints = new Map();
    const deadline = Date.now() + 12 * 60_000;
    while (Date.now() < deadline && !(interestPositive > 0 && bonusChecked && settledGoldChecked && summarised.size >= 4)) {
      const s = await read(page).catch(() => null);
      if (!s?.state || !s.m6?.phase) { await sleep(100); continue; }
      const kind = s.m6.phase.kind, round = s.m6.phase.round;
      if (kind === 'ended') break;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation}`)) { answered.add(`${choice.choiceId}:${choice.generation}`); await click(page, `choice:${choice.offers[0]}`); continue; }

      if (kind === 'preparation' && s.state.phase === 'preparation' && !s.m6.playingBack) {
        // Buy one unit in each of the first two rounds that sell one, then hoard gold so interest appears.
        const mine = s.state.preparation.units.filter(unit => unit.team === 'player');
        if (!bought.has(round) && bought.size < 2 && mine.length < 3) {
          const slot = s.state.shop.slots.findIndex(entry => entry.status === 'available');
          if (slot >= 0 && s.state.gold >= 1) { bought.add(round); await click(page, `mobile:buy-${slot}`); await sleep(300); continue; }
        }
        const economy = s.m6.economy;
        if (economy) {
          hints.set(round, economy);
          if (!streakChecked.has(round)) { streakChecked.add(round); check(economy.streakCount === s.state.streak.count && economy.streakKind === s.state.streak.kind, `round ${round}: hint streak ${economy.streakKind ?? 'none'} ${economy.streakCount} equals my state's`); }
          const last = s.state.roundResults.at(-1);
          if (last && last.round === round - 1 && !bonusRounds.has(round)) {
            bonusRounds.add(round);
            check(economy.lastStreakGold === last.incomeBreakdown.streak, `round ${round}: last round's streak gold shown (+${economy.lastStreakGold}) equals the committed incomeBreakdown.streak (+${last.incomeBreakdown.streak})`);
            if (last.incomeBreakdown.streak > 0) bonusChecked = true;
          }
          const dom = await page.evaluate(() => { const node = document.querySelector('[data-debug="online:economy-interest"]'); return node && !node.closest('[hidden]') ? Number(node.dataset.value) : null; });
          if (dom !== economy.interest) check(false, `round ${round}: the interest chip shows the hint's value (${dom} vs ${economy.interest})`);
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

      if (kind === 'settlement' && s.state.phase === 'settlement' && !summarised.has(round)) {
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
        // The settled economy against the hint read at the end of this round's preparation.
        const result = s.state.roundResults.find(entry => entry.round === round), hint = hints.get(round);
        if (result && hint && !compared.has(round)) {
          compared.add(round);
          if (result.interestBasis - result.incomeBreakdown.win === hint.gold) {
            if (result.incomeBreakdown.win === 0) {
              check(result.incomeBreakdown.interest === hint.interest, `${label}: interest shown (+${hint.interest} on ${hint.gold} gold) equals the settled interest (+${result.incomeBreakdown.interest})`);
              interestMatched++; if (hint.interest > 0) interestPositive++;
            }
            check(result.goldAfter === hint.gold + result.income, `${label}: settled gold ${result.goldAfter} = hinted gold ${hint.gold} + income ${result.income}`);
            settledGoldChecked = true;
          } else console.log(`note ${label}: gold changed after the hint (${hint.gold} → basis ${result.interestBasis}); not compared`);
        }
        continue;
      }
      await sleep(100);
    }
    check(summarised.size >= 4, `ranking and match totals checked in ${summarised.size} settlements`);
    check(retired, 'sold a unit after it had fought (its match rows stay, checked by the totals above)');
    check(quiet === true, 'using the ranking tabs sends no command');
    check(bonusChecked, 'a non-zero streak gold of the last round compared');
    check(settledGoldChecked, 'settled gold compared with the hint');
    check(interestPositive > 0, `a non-zero interest hint matched its settlement (${interestMatched} compared, ${interestPositive} non-zero)`);
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => { stopAll(); finish('G5 stats/economy'); }).catch(error => { console.error(error); stopAll(); process.exit(1); });
