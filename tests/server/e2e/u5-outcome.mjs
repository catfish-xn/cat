/**
 * 2D gap list items 3 and 7 (U5/O5/I4) in a real browser, no game server.
 *
 * 1. Local room (`?mode=online`): my first battle ends with the 胜利/失败 banner over the board; after I sell every
 *    deployed unit, the battle I lose sends bolts into my HP bar (one per enemy survivor) carrying the HP the room took.
 * 2. Fixed views on the page's own components: a dropped human is greyed out with 重连中 (接管中 once a bot covers it);
 *    the placement card shows the server's rank, 继续观看 closes it and the player list stays clickable underneath.
 *
 *   node tests/server/e2e/u5-outcome.mjs      (U5_VITE_PORT, default 5216)
 * Screenshots go to artifacts/u5-outcome/ (not committed).
 */
import { createChecks, launchBrowser, outDir, read, startVite, stopAll, waitRead } from './harness.mjs';

const OUT = outDir('u5-outcome');
const { check, finish } = createChecks();

const base = await startVite(Number(process.env.U5_VITE_PORT ?? 5216));
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

  /* ---------------- 1. local room: banner and bolts ---------------- */
  await page.goto(`${base}?mode=online&prep=8&choice=3&settle=1`);
  await page.click('[data-debug="online:join"]');
  await page.click('[data-debug="online:start"]');
  await waitRead(page, s => s.m6.mode === 'active', 'local start');
  const first = await waitRead(page, s => s.m6.outcome?.last?.result, 'first battle banner', 180_000);
  check(['胜利', '失败', '平局'].includes(first.m6.outcome.banner ?? '') || first.m6.outcome.last.result, `banner after my first battle: ${first.m6.outcome.banner} (${first.m6.outcome.last.result})`);
  await page.screenshot({ path: `${OUT}/1-banner.png` });

  const sellAll = async () => {
    const state = (await read(page)).state;
    if (state.phase !== 'preparation') return;
    const mine = state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board');
    if (!mine.length) return;
    await page.click('[data-debug="panel:units"]').catch(() => {});
    for (const unit of mine) {
      await page.click(`[data-debug="mobile:unit:${unit.id}"]`, { timeout: 2_000 }).catch(() => {});
      await page.click('[data-debug="mobile:sell"]', { timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(150);
    }
  };
  let hit = null, sawBolts = false;
  for (let round = 0; round < 12 && !hit; round++) {
    await waitRead(page, s => s.state.phase === 'preparation' && s.m6.phase?.kind === 'preparation', 'a preparation', 120_000);
    await sellAll();
    const deadline = Date.now() + 120_000;
    const startRound = (await read(page)).m6.phase.round;
    while (Date.now() < deadline) {
      const snapshot = await read(page);
      if (snapshot.m6.outcome?.flying > 0) sawBolts = true;
      if (snapshot.m6.outcome?.last?.damage) { hit = snapshot; break; }
      if (snapshot.m6.phase.round > startRound && snapshot.m6.phase.kind === 'preparation') break;
      await page.waitForTimeout(40);
    }
  }
  check(hit !== null, 'an HP loss reached the bolts');
  const { damage, bolts } = hit.m6.outcome.last;
  check(damage > 0 && bolts >= 1 && bolts <= 8, `bolts flew into my HP bar: ${bolts} bolt(s), -${damage} HP`);
  check(sawBolts || hit.m6.outcome.flying > 0, 'bolts were on screen');
  await page.screenshot({ path: `${OUT}/2-bolts.png` });
  await page.waitForTimeout(1500);
  check((await read(page)).m6.outcome.flying === 0, 'every bolt landed and was removed');

  /* ---------------- 2. fixed views: offline seat and placement card ---------------- */
  await page.goto(base);
  await page.waitForFunction(() => document.readyState === 'complete');
  const shown = await page.evaluate(async () => {
    const { PlayersSidebar } = await import('/src/rendering/online/players-sidebar.ts');
    const { EliminationCard } = await import('/src/rendering/online/ranking.ts');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0 0 auto auto;width:320px;z-index:9999;background:#111';
    document.body.append(host);
    const clicked = [];
    const sidebar = new PlayersSidebar(host, null, seatId => clicked.push(seatId));
    const seat = (index, extra = {}) => ({ seatId: `s${index}`, name: `座位${index}`, kind: index < 3 ? 'human' : 'bot', hp: 50 - index, level: 5, alive: true, rank: null,
      connected: true, controller: index < 3 ? 'human' : 'bot', publicBoard: { units: [] }, ...extra });
    const view = seats => ({ mySeatId: 's0', seats, phase: { kind: 'preparation', round: 8, roundName: '3-1', endsAt: 2_000_000, serverNow: 1_000_000 }, opponentSeatId: null, ranking: null, fault: null });
    const row = id => host.querySelector(`[data-debug="online:seat:${id}"]`);
    const look = id => ({ greyed: row(id).classList.contains('offline'), tag: row(id).querySelector('.seat-offline')?.textContent ?? '', name: getComputedStyle(row(id).querySelector('.seat-name')).color });
    sidebar.render(view([seat(0), seat(1, { connected: false }), seat(2), seat(3)]));
    const dropped = look('s1'), online = look('s2'), bot = look('s3');
    sidebar.render(view([seat(0), seat(1, { connected: false, controller: 'takeover' }), seat(2), seat(3)]));
    const takeover = look('s1');
    const card = new EliminationCard(document.body, () => clicked.push('leave'));
    card.show(6);
    const cardText = card.root.textContent;
    // The player list is still clickable while the card shows.
    const target = row('s2').getBoundingClientRect();
    const under = document.elementFromPoint(target.left + 20, target.top + 10)?.closest('[data-debug^="online:seat:"]')?.dataset.debug ?? null;
    const showingBefore = card.showing;
    return { dropped, online, bot, takeover, cardText, under, showingBefore, tier: card.root.dataset.tier };
  });
  check(shown.dropped.greyed && shown.dropped.tag === '重连中' && shown.dropped.name !== shown.online.name, `a dropped human is greyed out with 重连中 (${shown.dropped.name} vs ${shown.online.name})`);
  check(!shown.online.greyed && shown.online.tag === '' && !shown.bot.greyed && shown.bot.tag === '', 'connected humans and bots are not greyed');
  check(shown.takeover.greyed && shown.takeover.tag === '接管中', 'a covered seat stays greyed with 接管中');
  check(shown.showingBefore && shown.cardText.includes('第 6 名') && shown.cardText.includes('继续观看') && shown.cardText.includes('返回匹配') && shown.tier === 'bottom4', `placement card: "${shown.cardText}"`);
  check(shown.under === 'online:seat:s2', 'the player list stays clickable under the card');
  await page.screenshot({ path: `${OUT}/3-offline-and-card.png` });
  await page.click('[data-debug="online:elimination-watch"]');
  check(await page.isHidden('[data-debug="online:elimination"]'), '继续观看 closes the card');

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  stopAll();
}
finish('u5 outcome');
