/**
 * G3 acceptance against the real game server bundle: a match that ends abnormally hands the queue back without a
 * restart, and the page shows which build it talks to.
 *
 *   npm run build:game && node tests/server/e2e/g3-fault-recovery.mjs
 *
 * 1. CAT_FAULT_INJECT_ROUND=2 makes the first battle of round 2 throw once: the room ends with resolver-error, the
 *    page shows the fault, /healthz reports it and the room's credentials are gone (seatsOnline 0).
 * 2. 返回匹配 → 匹配 → 开始 on the same page and the same process: a new match runs past round 2.
 * 3. The only player closes the page: after CAT_ABANDON_SEC the watchdog ends the match (abandoned) and a new page
 *    can queue and start again.
 * The bottom-right badge shows the server's CAT_GIT_SHA and digests, read from /healthz. Screenshots go to
 * artifacts/g3/ (not committed). CHROMIUM overrides the browser path.
 */
import { writeFileSync } from 'node:fs';
import { click, collectErrors, joinOnline, launchBrowser, onlineUrl, outDir, startGameServer, startVite, stopAll, strictCheck as check, text, waitRead } from './harness.mjs';

const OUT = outDir('g3');
const VITE_PORT = 5203;
const WS_PORT = 8797;
const SHA = 'e2e0123456789abcdef0123456789abcdef01234';
const ABANDON_SEC = 4;

async function health(port) {
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  if (!response.ok) throw new Error(`/healthz ${response.status}`);
  return response.json();
}
async function waitHealth(port, predicate, what, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const report = await health(port);
    if (predicate(report)) return report;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(report)}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function main() {
  const wsPort = await startGameServer(WS_PORT, {
    CAT_PREP_SEC: '3', CAT_CHOICE_SEC: '3', CAT_SETTLE_SEC: '2', CAT_BOT_STEP_MS: '200',
    CAT_FAULT_INJECT_ROUND: '2', CAT_ABANDON_SEC: String(ABANDON_SEC), CAT_GIT_SHA: SHA,
  });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  const report = {};
  try {
    const idle = await health(wsPort);
    report.idle = idle;
    check(idle.status === 'ok' && idle.sha === SHA && idle.room === null && idle.queue === 0, `/healthz before any match: sha ${idle.sha}, room ${idle.room}`);
    check(/^fnv1a32-utf16:[0-9a-f]{8}$/.test(idle.contentDigest) && /^fnv1a32-utf16:[0-9a-f]{8}$/.test(idle.lootReplayDigest) && idle.netProtocol === 2,
      `/healthz digests ${idle.contentDigest} / ${idle.lootReplayDigest}, protocol ${idle.netProtocol}`);
    check(Number.isInteger(idle.uptimeSec) && idle.rssBytes > 0, `/healthz uptime ${idle.uptimeSec}s, rss ${idle.rssBytes}`);

    /* ---------------- 1. resolver error ends the first match ---------------- */
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    collectErrors(page, errors);
    await joinOnline(page, onlineUrl(base, wsPort), '运维');
    await waitRead(page, s => s.m6.mode === 'active', 'first match start');
    await page.waitForFunction(sha => document.querySelector('[data-debug="build-badge"]')?.dataset.serverSha === sha, SHA, { timeout: 10_000 });
    const badge = await text(page, '[data-debug="build-badge"]');
    report.badge = badge;
    check(badge.includes(SHA.slice(0, 7)) && badge.includes(idle.contentDigest.split(':')[1]) && !badge.includes('不一致'), `badge shows server ${SHA.slice(0, 7)} and digest: "${badge}"`);
    const ended = await waitRead(page, s => s.m6.mode === 'online-ended', 'fault end of the first match', 120_000);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/1-fault.png` });
    const overlay = await text(page, '.ranking-overlay');
    report.fault = { overlay, phase: ended.m6.phase };
    check(/结算出错/.test(overlay ?? '') && /injected fault/.test(overlay ?? ''), `page shows the fault: "${overlay?.slice(0, 120)}"`);
    const afterFault = await waitHealth(wsPort, h => h.room?.phase === 'ended' && h.seatsOnline === 0, 'fault released');
    report.afterFault = afterFault;
    check(afterFault.room.fault === 'resolver-error' && afterFault.room.round === 2 && afterFault.queue === 0, `/healthz after the fault: ${JSON.stringify(afterFault.room)}, seatsOnline ${afterFault.seatsOnline}`);

    /* ---------------- 2. same page, same process: the next match runs past round 2 ---------------- */
    check(await click(page, 'online:again'), '返回匹配 clicked');
    await page.waitForSelector('[data-debug="online:join"]:not([disabled])');
    await page.click('[data-debug="online:join"]');
    await page.waitForSelector('[data-debug="online:start"]:not([disabled])');
    await page.click('[data-debug="online:start"]');
    await waitRead(page, s => s.m6.mode === 'active', 'second match start');
    const past = await waitRead(page, s => s.m6.phase?.kind === 'preparation' && s.m6.phase.round >= 3, 'second match round 3', 180_000);
    await page.screenshot({ path: `${OUT}/2-next-match.png` });
    const running = await health(wsPort);
    report.secondMatch = running;
    check(past.m6.phase.round >= 3 && running.room.fault === null && running.room.round >= 3 && running.room.humansConnected === 1 && running.seatsOnline === 1,
      `the next match plays past the failed round: round ${running.room.round} ${running.room.phase}, fault ${running.room.fault}`);

    /* ---------------- 3. everyone leaves: the watchdog ends the match ---------------- */
    const left = Date.now();
    await context.close();
    const abandoned = await waitHealth(wsPort, h => h.room?.phase === 'ended', 'abandoned end', 30_000);
    report.abandoned = { ...abandoned, afterMs: Date.now() - left };
    check(abandoned.room.fault === 'abandoned' && abandoned.seatsOnline === 0 && Date.now() - left >= ABANDON_SEC * 1000 - 500,
      `all players gone → match ended as ${abandoned.room.fault} after ${Date.now() - left} ms`);
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await context2.newPage();
    collectErrors(page2, errors, 'page2');
    await joinOnline(page2, onlineUrl(base, wsPort), '回来');
    await waitRead(page2, s => s.m6.mode === 'active' && s.m6.phase?.kind === 'preparation', 'third match start');
    const third = await health(wsPort);
    report.thirdMatch = third;
    check(third.room.phase !== 'ended' && third.room.fault === null && third.room.round === 1 && third.seatsOnline === 1, `a new page starts a new match: ${JSON.stringify(third.room)}`);
    await page2.screenshot({ path: `${OUT}/3-after-abandon.png` });
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  } finally {
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
    await browser.close();
  }
}
main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
