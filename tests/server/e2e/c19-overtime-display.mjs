/**
 * C19 overtime display (fixed projection, no game server). A full match reaches overtime only on some seeds, so
 * c19-full-match.mjs checks it live only when its match gets there; this script always covers it.
 *
 * The page's own PlayersSidebar (with the TFT countdown host) renders a fixed sequence of PlayerViews running from the
 * catalog's final round into overtime: final round preparation → combat → settlement → 加时 1 preparation → combat →
 * settlement → 加时 2 preparation → 加时 2 combat with my seat eliminated (spectating). Round ordinals and names come
 * from the rules' getMultiplayerRoundByOrdinal (the same descriptor the room publishes as phase.round/roundName); the
 * script only asserts that what the view says is what the page shows:
 *   - the sidebar round label equals view.phase.roundName, and nothing of the previous round stays;
 *   - the countdown line above the board carries the round name (and 观战中 once eliminated);
 *   - the timer shows the whole seconds of endsAt - serverNow.
 *
 *   node tests/server/e2e/c19-overtime-display.mjs      (C19_VITE_PORT, default 5212)
 */
import { createChecks, launchBrowser, outDir, startVite, stopAll } from './harness.mjs';

const OUT = outDir('c19-overtime');
const { check, finish } = createChecks();

const base = await startVite(Number(process.env.C19_VITE_PORT ?? 5212));
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.readyState === 'complete');

  const frames = await page.evaluate(async () => {
    const { ROUND_CATALOG } = await import('/src/simulation/content/round-catalog.ts');
    const { getMultiplayerRoundByOrdinal } = await import('/src/simulation/multiplayer-round.ts');
    const { PlayersSidebar } = await import('/src/rendering/online/players-sidebar.ts');
    const host = document.createElement('div'), countdown = document.createElement('div');
    host.id = 'c19-overtime-host'; host.style.cssText = 'position:fixed;inset:0 0 auto auto;width:320px;z-index:9999;background:#111';
    document.body.append(countdown, host);
    const sidebar = new PlayersSidebar(host, countdown, null);

    const seat = (index, alive, rank = null) => ({ seatId: `s${index}`, name: `座位${index}`, kind: index < 2 ? 'human' : 'bot', hp: alive ? 10 + index : 0, level: 9,
      alive, rank, connected: true, controller: index < 2 ? 'human' : 'bot', publicBoard: { units: [] } });
    const final = ROUND_CATALOG.at(-1).ordinal;
    const rounds = [0, 1, 2].map(n => getMultiplayerRoundByOrdinal(final + n));
    const serverNow = 1_000_000;
    const steps = [
      [rounds[0], 'preparation', true, 30_000], [rounds[0], 'combat', true, 45_000], [rounds[0], 'settlement', true, 4_000],
      [rounds[1], 'preparation', true, 30_000], [rounds[1], 'combat', true, 45_000], [rounds[1], 'settlement', true, 4_000],
      [rounds[2], 'preparation', true, 30_000], [rounds[2], 'combat', false, 45_000],
    ];
    const shown = [];
    for (const [round, kind, alive, ms] of steps) {
      // Two survivors in overtime: me (s0) and s1; the others were ranked 3..8 before it.
      const seats = [seat(0, alive, alive ? null : 2), seat(1, true), ...[2, 3, 4, 5, 6, 7].map(index => seat(index, false, 10 - index))];
      const view = { mySeatId: 's0', seats, phase: { kind, round: round.ordinal, roundName: round.displayName, endsAt: serverNow + ms, serverNow }, opponentSeatId: 's1', ranking: null, fault: null };
      sidebar.render(view);
      shown.push({ roundId: round.roundId, kind, alive, view: view.phase, ms,
        round: host.querySelector('.online-round')?.textContent ?? null,
        countdown: countdown.querySelector('.countdown-round')?.textContent ?? null,
        timer: document.querySelector('[data-debug="online:timer"]')?.textContent ?? null,
        spectate: (() => { const node = host.querySelector('[data-debug="online:spectate"]'); return node && !node.hidden ? node.textContent : null; })() });
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    return shown;
  });

  const overtime = frames.filter(frame => frame.roundId.startsWith('overtime-'));
  check(frames[0].roundId !== frames.at(-1).roundId && overtime.length === 5 && new Set(overtime.map(frame => frame.view.roundName)).size === 2 && overtime.every(frame => /^加时 \d+$/.test(frame.view.roundName)),
    `the fixed projection runs from ${frames[0].view.roundName} into ${[...new Set(overtime.map(frame => frame.view.roundName))].join(', ')}`);
  for (const frame of frames) {
    const label = `${frame.view.roundName} ${frame.kind}${frame.alive ? '' : ' (eliminated)'}`;
    check(frame.round === frame.view.roundName, `${label}: the sidebar round label is the view's round name (${frame.round})`);
    check(Boolean(frame.countdown?.includes(frame.view.roundName)), `${label}: the countdown line carries the round name (${frame.countdown})`);
    // The clock may tick once between render and read.
    const seconds = Math.ceil(frame.ms / 1000);
    check(frame.timer === String(seconds) || frame.timer === String(seconds - 1), `${label}: the timer shows endsAt - serverNow in whole seconds (${frame.timer}, expected ${seconds})`);
    if (!frame.alive) check(Boolean(frame.spectate?.includes('观战中') && frame.countdown?.includes('观战中')), `${label}: eliminated in overtime, the page says so and keeps the round name (${frame.spectate} | ${frame.countdown})`);
  }
  await page.locator('#c19-overtime-host').screenshot({ path: `${OUT}/sidebar-overtime.png` });
  check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
} finally {
  await browser.close().catch(() => {});
  stopAll();
}
finish('C19 overtime display');
