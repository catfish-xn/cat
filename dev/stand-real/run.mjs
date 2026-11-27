// REC ONLY (claude/rec-stand-real, never merged): a real online match (game server + 7 bots, ?render=3d with the asset
// root) played to its first combats, twice in the same browser context (the second visit has this browser's envelope
// store). Per combat: which models were on the board, where each envelope came from (stored / warmup / prep-mount /
// combat), and how long each piece showed its stand-in pawn during the combat.
// node dev/stand-real/run.mjs <outDir> <assetPort> [combatsPerGame=3]
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { collectErrors, joinOnline, onlineUrl, read, start, startGameServer, startVite, stopAll, waitRead } from '../../tests/server/e2e/harness.mjs';
const [out, assetPort, perGame = '3'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const assets = `http://127.0.0.1:${assetPort}/`;
const report = { games: [], errors: [] };
try {
  const wsPort = await startGameServer(8891, { CAT_PREP_SEC: '15', CAT_CHOICE_SEC: '4', CAT_SETTLE_SEC: '3', CAT_BOT_STEP_MS: '200' });
  const base = await startVite(5891);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  collectErrors(page, report.errors);
  for (let game = 1; game <= 2; game++) {
    const t0 = Date.now();
    await joinOnline(page, `${onlineUrl(base, wsPort)}&render=3d&assets3d=${encodeURIComponent(assets)}`, `stand${game}`);
    await waitRead(page, s => s.m6.mode === 'active', 'match start', 120_000);
    const combats = [];
    let seen = 0;
    while (combats.length < Number(perGame)) {
      const s = await waitRead(page, s => s.m6.phase?.kind === 'combat' && s.m6.phase.round > seen, 'next combat', 240_000);
      seen = s.m6.phase.round;
      await page.waitForTimeout(7000); // the renderer's own 6 s snapshot after the combat start
      combats.push({ round: s.m6.phase.round, roundName: s.m6.phase.roundName ?? null, opponentSeatId: s.m6.opponentSeatId ?? null });
    }
    const real = await page.evaluate(() => globalThis.__standReal ?? null);
    const store = await page.evaluate(() => new Promise(resolve => { try { const r = indexedDB.open('set13-model-envelopes', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('envelopes')) r.result.createObjectStore('envelopes'); };
      r.onsuccess = () => { const q = r.result.transaction('envelopes', 'readonly').objectStore('envelopes').count(); q.onsuccess = () => { r.result.close(); resolve(q.result); }; q.onerror = () => resolve(-1); };
      r.onerror = () => resolve(-1); } catch { resolve(-1); } }));
    report.games.push({ game, wallSeconds: (Date.now() - t0) / 1000, combats, storeKeysAfter: store, real });
    writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
    console.log(`game ${game}: ${combats.length} combats, store keys ${store}`);
    if (game === 1) await page.goto('about:blank'); // leave; the next join is a fresh page load in the same context (IndexedDB kept)
  }
  await browser.close();
} catch (error) { report.failure = String(error?.stack ?? error); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1)); console.error(error); process.exitCode = 1; }
finally { stopAll(); }
