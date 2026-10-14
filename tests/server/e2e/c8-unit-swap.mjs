/**
 * Work order C8 single-player acceptance of SR-C7-01 unit swap (the online run is part of c7-playtest.mjs).
 *
 *   node tests/server/e2e/c8-unit-swap.mjs
 *
 * Plays the local match like a person (buy, deploy through the 部署 tab, Start, pick the first card, Continue)
 * until the board is full at level ≥ 2 with two bench units, then runs the mouse-drag swap checks of
 * swap-checks.mjs. Screenshots go to artifacts/c8/single/ (not committed). CHROMIUM overrides the browser path.
 */
import { click, collectErrors, launchBrowser, outDir, read, startVite, stopAll, strictCheck as check, waitRead } from './harness.mjs';
import { runSwapChecks, swapReady } from './swap-checks.mjs';

const OUT = outDir('c8/single');
const VITE_PORT = 5198;

const mine = state => state.preparation.units.filter(unit => unit.team === 'player');

async function prepare(page) {
  let state = (await read(page)).state;
  await click(page, 'panel:units');
  for (let slot = 0; slot < 5; slot++) if (state.shop.slots[slot]?.status === 'available' && state.gold >= 1) { await click(page, `mobile:buy-${slot}`); await page.waitForTimeout(100); state = (await read(page)).state; }
  if (state.level < 2 && state.gold >= 4) { await click(page, 'mobile:buy-xp'); await page.waitForTimeout(100); }
  for (let i = 0; i < 9; i++) {
    state = (await read(page)).state;
    const units = mine(state), bench = units.filter(unit => unit.location.kind === 'bench');
    if (!bench.length || units.length - bench.length >= state.level) break;
    const taken = new Set(state.preparation.units.filter(unit => unit.location.kind === 'board').map(unit => `${unit.location.cell.col},${unit.location.cell.row}`));
    const zone = state.preparation.board.deploymentZones.player;
    let cell = null;
    for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 0; col < state.preparation.board.columns && !cell; col++) if (!taken.has(`${col},${row}`)) cell = `${col},${row}`;
    await click(page, `mobile:unit:${bench[0].id}`); await click(page, `deploy:${cell}`); await page.waitForTimeout(100);
  }
  return (await read(page)).state;
}

async function main() {
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    collectErrors(page, errors);
    await page.goto(base);
    await waitRead(page, s => s.m6?.mode, 'single-player page');
    await page.locator('[data-debug="m6-seed-input"]').fill(process.env.SEED ?? '42');
    await page.locator('[data-debug="m6-fixed-start"]').click();
    await waitRead(page, s => s.m6.mode === 'active' && s.state.phase === 'preparation', 'single-player match');
    for (let round = 0; ; round++) {
      const state = await prepare(page);
      if (swapReady(state)) break;
      if (round > 12 || state.phase === 'gameOver') throw new Error(`no swap-ready board after ${round} rounds`);
      await page.waitForTimeout(500);
      await click(page, 'mobile:start-combat');
      for (;;) {
        const s = await waitRead(page, s => ['choice', 'settlement', 'gameOver'].includes(s.state.phase), 'battle result', 120_000);
        if (s.state.phase !== 'choice') break;
        const choice = s.state.pendingChoice;
        if (choice.kind === 'anomaly' && choice.offers?.length && s.state.anomalyBinding == null && choice.targetUnitId === undefined) await click(page, `anomaly-target:${mine(s.state)[0].id}`);
        await click(page, `choice:${choice.offers[0]}`); await page.waitForTimeout(300);
      }
      await click(page, 'mobile:continue');
      await waitRead(page, s => s.state.phase === 'preparation' || s.state.phase === 'gameOver', 'next preparation');
    }
    await runSwapChecks(page, { check, shot: name => page.screenshot({ path: `${OUT}/${name}.png` }) });
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  } finally { await browser.close(); }
}
main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
