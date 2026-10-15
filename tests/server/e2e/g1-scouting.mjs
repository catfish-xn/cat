/**
 * G1/G5 scouting acceptance against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/g1-scouting.mjs
 *
 * In a preparation (a PvP one, scouting a possible opponent when there is one) and in a settlement: clicking another
 * alive player in the right column opens that seat's public board. The panel shows exactly the server's `publicBoard`
 * of that seat (units, cells, stars, item counts) and the traits they activate; Esc closes it, a second click on the
 * same row closes it too. Opening and closing send no command. With the panel open my own deployment rows stay
 * reachable (no panel pixel over a deployment hex) and a real mouse drag of one of my units onto an empty deployment
 * cell is applied by the server.
 * Screenshots go to artifacts/g1-scouting/ (not committed). G1S_WS_PORT / G1S_VITE_PORT override the ports.
 */
import { click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, outDir, read, sleep, startGameServer, startVite, stopAll, trackCommands, waitRead } from './harness.mjs';

const OUT = outDir('g1-scouting');
const WS_PORT = Number(process.env.G1S_WS_PORT ?? 8812);
const VITE_PORT = Number(process.env.G1S_VITE_PORT ?? 5213);
const { check, finish } = createChecks();

const panel = page => page.evaluate(() => {
  const root = document.querySelector('#opponent-board');
  if (!root || root.hidden) return null;
  return {
    seat: root.dataset.seat, name: root.querySelector('.opponent-name')?.textContent ?? '',
    units: [...root.querySelectorAll('.opponent-unit')].map(node => ({ definitionId: node.dataset.definition, starLevel: Number(node.dataset.star),
      cell: node.dataset.debug.replace('online:opponent-unit:', ''), items: node.querySelectorAll('.item-mark').length })).sort((a, b) => a.cell.localeCompare(b.cell)),
    traits: [...root.querySelectorAll('.opponent-trait')].map(node => ({ id: node.dataset.trait ?? null, text: node.textContent.trim(), active: node.classList.contains('active') })),
  };
});
const expected = seat => (seat.publicBoard?.units ?? []).map(unit => ({ definitionId: unit.definitionId, starLevel: unit.starLevel, cell: `${unit.cell.col},${unit.cell.row}`, items: unit.items.length }))
  .sort((a, b) => a.cell.localeCompare(b.cell));
const rowOf = seatId => `[data-debug="online:seat:${seatId}"]`;

/** Opens `seat` from the sidebar and checks the panel against its public board; returns the panel read. */
async function scout(page, wire, seat, label) {
  const before = wire.mark();
  await page.click(rowOf(seat.seatId));
  await sleep(150);
  const shown = await panel(page), s = await read(page);
  check(shown?.seat === seat.seatId && shown.name.startsWith(seat.name), `${label}: clicking ${seat.name} opens their board (${shown?.seat})`);
  const latest = s.m6.seats.find(entry => entry.seatId === seat.seatId);
  check(JSON.stringify(shown?.units) === JSON.stringify(expected(latest)), `${label}: units, cells, stars and items equal the server's publicBoard (${shown?.units.length} units)`);
  const traits = shown?.traits ?? [];
  check(latest.publicBoard.units.length === 0 ? traits.length === 1 && traits[0].id === null
    : traits.length > 0 && traits.every(trait => trait.id && /\d+$/.test(trait.text)), `${label}: trait list with activation counts (${traits.map(trait => trait.text).join(' / ')})`);
  check(s.m6.viewingSeatId === seat.seatId && await page.evaluate(sel => document.querySelector(sel)?.classList.contains('viewing'), rowOf(seat.seatId)), `${label}: the row is marked as viewed`);
  check([...wire.sent.keys()].every(id => before.has(id)), `${label}: opening sends no command`);
  return shown;
}

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '20', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '10', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    collectErrors(page, errors);
    const wire = trackCommands(page);
    await joinOnline(page, onlineUrl(base, wsPort), '侦察');
    await waitRead(page, s => s.m6.mode === 'active', 'match start');
    const done = new Set(), answered = new Set();
    const deadline = Date.now() + 8 * 60_000;
    while (!(done.has('preparation') && done.has('settlement')) && Date.now() < deadline) {
      const s = await read(page).catch(() => null);
      if (!s?.state || !s.m6?.phase) { await sleep(100); continue; }
      const kind = s.m6.phase.kind;
      if (kind === 'ended') break;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation}`)) { answered.add(`${choice.choiceId}:${choice.generation}`); await click(page, `choice:${choice.offers[0]}`); continue; }
      const phase = kind === 'preparation' && s.state.phase === 'preparation' && s.m6.phase.endsAt - s.m6.phase.serverNow > 8_000 ? 'preparation'
        : kind === 'settlement' && s.state.phase === 'settlement' ? 'settlement' : null;
      if (!phase || done.has(phase)) { await sleep(100); continue; }
      // Another alive seat with a board; in a preparation prefer a possible opponent (G1-P6).
      const me = await page.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));
      const pool = s.m6.seats.filter(seat => seat.seatId !== me && seat.alive && (seat.publicBoard?.units.length ?? 0) > 0);
      const target = (phase === 'preparation' ? pool.find(seat => s.m6.opponentCandidates?.includes(seat.seatId)) : null) ?? pool[0];
      if (!target) { await sleep(200); continue; }
      const label = `${phase} ${s.m6.phase.roundName}`;
      await scout(page, wire, target, label);
      await page.screenshot({ path: `${OUT}/${phase}-open.png` });

      if (phase === 'preparation') {
        // My deployment rows stay uncovered and a real drag still deploys while the panel is open.
        await page.locator('canvas').scrollIntoViewIfNeeded();
        const now = await read(page), zone = now.state.preparation.board.deploymentZones.player;
        const hexes = Object.entries(now.layout.hexes).filter(([key]) => { const row = Number(key.split(',')[1]); return row >= zone.firstRow && row <= zone.lastRow; });
        const covered = await page.evaluate(points => points.filter(([, point]) => document.elementFromPoint(point.x, point.y)?.closest('#opponent-board')).map(([key]) => key), hexes);
        check(hexes.length > 0 && covered.length === 0, `${label}: no deployment hex lies under the open panel (${covered.join(' ') || 'none'})`);
        const mine = now.state.preparation.units.filter(unit => unit.team === 'player');
        const occupied = new Set(now.state.preparation.units.filter(unit => unit.location.kind === 'board').map(unit => `${unit.location.cell.col},${unit.location.cell.row}`));
        const free = hexes.map(([key]) => key).find(key => !occupied.has(key));
        const board = mine.filter(unit => unit.location.kind === 'board').length;
        const unit = mine.find(entry => entry.location.kind === 'board') ?? (board < now.state.level ? mine.find(entry => entry.location.kind === 'bench') : null);
        const token = unit && now.tokens.find(entry => entry.id === unit.id && entry.visible);
        if (unit && token && free) {
          const before = wire.mark(), point = now.layout.hexes[free];
          await page.mouse.move(token.screenX, token.screenY); await page.mouse.down();
          await page.mouse.move(point.x, point.y, { steps: 8 }); await sleep(60); await page.mouse.up();
          const receipt = await wire.receiptSince(before, 'deploy', 5_000);
          const after = await read(page), moved = after.state.preparation.units.find(entry => entry.id === unit.id);
          check(receipt === 'applied' && moved?.location.kind === 'board' && `${moved.location.cell.col},${moved.location.cell.row}` === free,
            `${label}: with the panel open, dragging ${unit.id} onto ${free} deploys it (${receipt})`);
          check((await panel(page))?.seat === target.seatId, `${label}: the panel stays open on ${target.name} through my drag`);
        } else check(false, `${label}: found a unit of mine to drag (${unit?.id ?? 'none'}, free ${free ?? 'none'})`);
        // Esc closes; a second click on the same row closes too.
        await page.keyboard.press('Escape'); await sleep(120);
        check(await panel(page) === null && (await read(page)).m6.viewingSeatId === null, `${label}: Esc closes the panel`);
        await page.click(rowOf(target.seatId)); await sleep(120);
        check((await panel(page))?.seat === target.seatId, `${label}: clicking again reopens it`);
        await page.click(rowOf(target.seatId)); await sleep(120);
        check(await panel(page) === null, `${label}: a second click on the same row closes it`);
      } else {
        await page.keyboard.press('Escape'); await sleep(120);
        check(await panel(page) === null, `${label}: Esc closes the panel`);
      }
      done.add(phase);
    }
    check(done.has('preparation'), 'scouted in a preparation');
    check(done.has('settlement'), 'scouted in a settlement');
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => { stopAll(); finish('G1 scouting'); }).catch(error => { console.error(error); stopAll(); process.exit(1); });
