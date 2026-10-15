/**
 * G5 acceptance against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/g5-stats-replay.mjs
 *
 * 1. Post-battle ranking: when my battle ends (settlement) the right column shows one row per unit of both sides of
 *    the replay the server pushed (rows ≥ both sides' units, each side's count equal), and each row's damage dealt /
 *    taken / healing equal the replay events' own sums; the 伤害/承伤/治疗 tabs sort by that metric.
 * 2. Review: "回看" opens the replay over the board and plays it while the countdown keeps running; it stays open into
 *    the next preparation, where a real mouse drag of my unit onto a free deployment cell is applied by the server with
 *    the review open (no deployment hex under it). Speed and seek work; the close button and Esc close it. No command
 *    is sent by opening, playing or closing it.
 * 3. Economy hint: in preparation the strip above the board shows interest, streak and last round's streak gold; the
 *    interest shown when the preparation ends equals the interest the settlement then credited (whenever the settled
 *    basis is that gold plus victory gold 0), the streak count equals my state's, and last round's streak gold equals
 *    the committed `incomeBreakdown.streak`; the settled gold is the hint's gold plus the round's income.
 * Screenshots go to artifacts/g5-stats-replay/ (not committed). G5_WS_PORT / G5_VITE_PORT override the ports.
 */
import { click, collectErrors, createChecks, joinOnline, launchBrowser, onWire, onlineUrl, outDir, read, sleep, startGameServer, startVite, stopAll, trackCommands, waitRead } from './harness.mjs';

const OUT = outDir('g5-stats-replay');
const WS_PORT = Number(process.env.G5_WS_PORT ?? 8822);
const VITE_PORT = Number(process.env.G5_VITE_PORT ?? 5223);
const { check, finish } = createChecks();

const summary = page => page.evaluate(() => {
  const root = document.querySelector('#battle-summary');
  if (!root || root.hidden) return null;
  return { round: Number(root.dataset.round), metric: root.dataset.metric,
    rows: [...root.querySelectorAll('.summary-row')].map(node => ({ unit: node.dataset.unit, team: node.dataset.team, value: Number(node.dataset.value),
      dealt: Number(node.dataset.dealt), taken: Number(node.dataset.taken), healed: Number(node.dataset.healed) })) };
});
const review = page => page.evaluate(() => {
  const root = document.querySelector('#battle-review');
  return root && !root.hidden ? { round: Number(root.dataset.round), tick: Number(root.dataset.tick), canvas: !!root.querySelector('canvas') } : null;
});
const timer = async page => Number(await page.evaluate(() => document.querySelector('[data-debug="online:timer"]')?.textContent ?? 'NaN'));

/** Sums per unit from the replay events, independently of the page. */
function expectedTotals(replay) {
  const rows = new Map(replay.initial.units.map(unit => [unit.id, { team: unit.team, dealt: 0, taken: 0, healed: 0 }]));
  for (const frame of replay.ticks) for (const event of frame.events) {
    if (event.type === 'packetDamage') { if (rows.has(event.sourceId)) rows.get(event.sourceId).dealt += event.hpDamage; if (rows.has(event.targetId)) rows.get(event.targetId).taken += event.hpDamage; }
    else if (event.type === 'heal' && rows.has(event.targetId)) rows.get(event.targetId).healed += event.actual;
  }
  return rows;
}

async function checkSummary(page, replay, label) {
  const shown = await summary(page);
  const expected = expectedTotals(replay);
  const sides = { player: 0, enemy: 0 }; for (const row of expected.values()) sides[row.team]++;
  const count = team => shown?.rows.filter(row => row.team === team).length ?? 0;
  check(shown && shown.rows.length >= sides.player + sides.enemy && count('player') === sides.player && count('enemy') === sides.enemy,
    `${label}: ranking rows ${shown?.rows.length} ≥ both sides' units (${sides.player} mine + ${sides.enemy} enemy)`);
  const wrong = (shown?.rows ?? []).filter(row => { const want = expected.get(row.unit); return !want || want.dealt !== row.dealt || want.taken !== row.taken || want.healed !== row.healed; });
  check(shown && wrong.length === 0, `${label}: every row's damage dealt / taken / healing equals the replay events' sums (${wrong.map(row => row.unit).join(' ') || 'all equal'})`);
  for (const metric of ['damageTaken', 'healingReceived', 'damageDealt']) {
    await click(page, `online:summary-tab:${metric}`); await sleep(60);
    const tab = await summary(page), values = tab?.rows.map(row => row.value) ?? [];
    check(tab?.metric === metric && values.every((value, i) => i === 0 || values[i - 1] >= value), `${label}: tab ${metric} sorts highest first (${values.slice(0, 4).join(' ≥ ')})`);
  }
  return sides;
}

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '12', CAT_CHOICE_SEC: '5', CAT_SETTLE_SEC: '10', CAT_BOT_STEP_MS: '150' });
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
    let reviewed = false, dragged = false, interestMatched = 0, interestPositive = 0, bonusChecked = false, settledGoldChecked = false;
    /** The hint as last read in a preparation: round → { gold, interest, streakCount }. */
    const hints = new Map();
    const deadline = Date.now() + 12 * 60_000;
    while (Date.now() < deadline && !(reviewed && dragged && interestPositive > 0 && bonusChecked && settledGoldChecked && summarised.size >= 2)) {
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
        // Drag with the review open (it was opened in the settlement before this preparation).
        if (reviewed && !dragged && (await review(page)) && s.m6.phase.endsAt - s.m6.phase.serverNow > 4_000) {
          await page.screenshot({ path: `${OUT}/preparation-review-open.png` });
          const zone = s.state.preparation.board.deploymentZones.player;
          const hexes = Object.entries(s.layout.hexes).filter(([key]) => { const row = Number(key.split(',')[1]); return row >= zone.firstRow && row <= zone.lastRow; });
          const covered = await page.evaluate(points => points.filter(([, p]) => document.elementFromPoint(p.x, p.y)?.closest('#battle-review')).map(([key]) => key), hexes);
          check(hexes.length > 0 && covered.length === 0, `round ${round}: no deployment hex lies under the open review (${covered.join(' ') || 'none'})`);
          const occupied = new Set(s.state.preparation.units.filter(unit => unit.location.kind === 'board').map(unit => `${unit.location.cell.col},${unit.location.cell.row}`));
          const free = hexes.map(([key]) => key).find(key => !occupied.has(key));
          const unit = mine.find(entry => entry.location.kind === 'board');
          const token = unit && s.tokens.find(entry => entry.id === unit.id && entry.visible);
          if (unit && token && free) {
            const before = wire.mark(), point = s.layout.hexes[free];
            await page.mouse.move(token.screenX, token.screenY); await page.mouse.down();
            await page.mouse.move(point.x, point.y, { steps: 8 }); await sleep(60); await page.mouse.up();
            const receipt = await wire.receiptSince(before, 'deploy', 5_000);
            const after = await read(page), moved = after.state.preparation.units.find(entry => entry.id === unit.id);
            check(receipt === 'applied' && moved?.location.kind === 'board' && `${moved.location.cell.col},${moved.location.cell.row}` === free,
              `round ${round}: with the review open, dragging ${unit.id} onto ${free} deploys it (${receipt})`);
            check((await review(page)) !== null, `round ${round}: the review stays open through my drag`);
            dragged = true;
            // Close with the button; reopen; close with Esc. None of it sends a command.
            const quiet = wire.mark();
            await click(page, 'online:review-close'); await sleep(100);
            check((await review(page)) === null && (await read(page)).m6.review === null, `round ${round}: the close button closes the review`);
            check(await click(page, 'online:review-open'), `round ${round}: the ranking still offers 回看 in the next preparation`);
            await sleep(150); check((await review(page)) !== null, `round ${round}: 回看 reopens it`);
            await page.keyboard.press('Escape'); await sleep(120);
            check((await review(page)) === null, `round ${round}: Esc closes the review`);
            check([...wire.sent.keys()].every(id => quiet.has(id)), `round ${round}: opening and closing the review sends no command`);
          } else if (!unit) { dragged = true; check(false, `round ${round}: a unit of mine on the board to drag (none)`); }
        }
        await sleep(150); continue;
      }

      if (kind === 'settlement' && s.state.phase === 'settlement' && !summarised.has(round)) {
        const replay = replays.get(round);
        if (!replay) { await sleep(150); continue; } // a supply round or a seat without a battle
        await waitRead(page, x => x.m6.battleSummary?.round === round, `ranking of round ${round}`, 5_000).catch(() => null);
        const label = `settlement ${s.m6.phase.roundName}`;
        const sides = await checkSummary(page, replay, label);
        summarised.add(round);
        await page.screenshot({ path: `${OUT}/settlement-${round}.png` });
        // The settled economy against the hint read at the end of this round's preparation.
        const result = s.state.roundResults.find(entry => entry.round === round), hint = hints.get(round);
        if (result && hint && !compared.has(round)) {
          compared.add(round);
          if (result.interestBasis - result.incomeBreakdown.win === hint.gold) {
            const want = result.incomeBreakdown.win === 0 ? hint.interest : null;
            if (want !== null) {
              check(result.incomeBreakdown.interest === want, `${label}: interest shown (+${hint.interest} on ${hint.gold} gold) equals the settled interest (+${result.incomeBreakdown.interest})`);
              interestMatched++; if (want > 0) interestPositive++;
            }
            check(result.goldAfter === hint.gold + result.income, `${label}: settled gold ${result.goldAfter} = hinted gold ${hint.gold} + income ${result.income}`);
            settledGoldChecked = true;
          } else console.log(`note ${label}: gold changed after the hint (${hint.gold} → basis ${result.interestBasis}); not compared`);
        }
        // Review: opens, plays while the countdown runs, speed/seek work; left open into the next preparation.
        if (!reviewed && sides.player > 0 && sides.enemy > 0 && s.m6.phase.endsAt - s.m6.phase.serverNow > 5_000) {
          const quiet = wire.mark(), t0 = await timer(page);
          check(await click(page, 'online:review-open'), `${label}: 回看 is offered`);
          await sleep(1_200);
          const first = await review(page), t1 = await timer(page);
          check(first?.round === round && first.canvas && first.tick > 0, `${label}: the review opens on round ${round} and plays (tick ${first?.tick})`);
          check(t1 < t0, `${label}: the countdown keeps running during the review (${t0} → ${t1})`);
          await page.click('[data-debug="online:review-play"]'); await sleep(50);
          const paused = await review(page); await sleep(500);
          check((await review(page))?.tick === paused?.tick, `${label}: pause holds the review at tick ${paused?.tick}`);
          await page.click('.review-speed[data-speed="4"]'); await page.click('[data-debug="online:review-play"]');
          const before4 = (await review(page)).tick; await sleep(500); const after4 = (await review(page)).tick;
          check(after4 - before4 >= 25, `${label}: 4× plays about 40 ticks in 500 ms (${after4 - before4})`);
          await page.click('.review-speed[data-speed="1"]'); await page.click('[data-debug="online:review-play"]'); // pause, then seek
          await page.$eval('[data-debug="online:review-seek"]', node => { node.value = '0'; node.dispatchEvent(new Event('input')); });
          const rewound = await review(page);
          check(rewound?.tick === 0 && rewound.tick < after4, `${label}: seeking to 0 rewinds the paused review (tick ${after4} → ${rewound?.tick})`);
          await page.click('[data-debug="online:review-play"]'); // play on at 1× into the next preparation
          check([...wire.sent.keys()].every(id => quiet.has(id)), `${label}: the review sends no command`);
          await page.screenshot({ path: `${OUT}/settlement-review.png` });
          reviewed = true;
        }
        continue;
      }
      await sleep(100);
    }
    check(summarised.size >= 2, `ranking checked in ${summarised.size} settlements`);
    check(reviewed, 'review opened and played in a settlement');
    check(dragged, 'dragged a unit with the review open');
    check(bonusChecked, 'a non-zero streak gold of the last round compared');
    check(settledGoldChecked, 'settled gold compared with the hint');
    check(interestPositive > 0, `a non-zero interest hint matched its settlement (${interestMatched} compared, ${interestPositive} non-zero)`);
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => { stopAll(); finish('G5 stats/replay/economy'); }).catch(error => { console.error(error); stopAll(); process.exit(1); });
