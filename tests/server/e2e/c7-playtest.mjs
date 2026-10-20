/**
 * Work order C7 investigation/acceptance against the real game server (`?server=ws`), one human + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c7-playtest.mjs
 *
 * Plays 1-2 → 2-1 like a person: buy, deploy through the 部署 tab, take loot picks; records for every round
 * whether the preparation board shows monsters, whether the battle is against them and what the settlement
 * says was obtained; then selects two components in 装备 and presses 合成, logging the server receipt.
 * C8: in the first 1-x preparation with a full board and two bench units, runs the SR-C7-01 mouse-drag swap
 * checks of swap-checks.mjs against the server (screenshots swap-*.png).
 * Screenshots go to artifacts/c7/ (not committed). CHROMIUM overrides the browser path.
 */
import { writeFileSync } from 'node:fs';
import { click, equipmentCommand, collectErrors, joinOnline, launchBrowser, onWire, onlineUrl, outDir, read, startGameServer, startVite, stopAll, strictCheck as check, text, waitRead } from './harness.mjs';
import { runSwapChecks, swapReady } from './swap-checks.mjs';

const OUT = outDir('c7');
const VITE_PORT = 5197;
const WS_PORT = 8789;

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '25', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '4', CAT_BOT_STEP_MS: '200' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  const receipts = [];
  const report = { rounds: [], combine: null, swap: null, pairing: null, g2Bots: [] };
  const openingOf = new Map();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    collectErrors(page, errors);
    onWire(page, {
      sent: m => { if (m.type === 'command') receipts.push({ sent: m.commandId, command: m.command }); },
      received: m => {
        if (m.type === 'view') {
          const admitted = new Set(['amumu','powder','singed','violet','nocturne','vladimir','zeri','blitzcrank','ekko','illaoi','twitch','leblanc','malzahar','rumble']);
          for (const seat of m.view.seats ?? []) if (seat.kind === 'bot') {
            const units = seat.publicBoard?.units ?? [];
            // The random opening one-cost (alone on the board when first seen) may itself be an admitted hero: only copies beyond it count as bought.
            if (!openingOf.has(seat.seatId) && units.length > 0) openingOf.set(seat.seatId, units[0].definitionId);
            const copies = id => units.filter(unit => unit.definitionId === id).reduce((sum, unit) => sum + 3 ** (unit.starLevel - 1), 0);
            for (const unit of units) if (admitted.has(unit.definitionId) && copies(unit.definitionId) > (openingOf.get(seat.seatId) === unit.definitionId ? 1 : 0)) {
              const observation = { seatId: seat.seatId, definitionId: unit.definitionId, round: m.view.phase.round };
              if (!report.g2Bots.some(row => row.seatId === observation.seatId && row.definitionId === observation.definitionId && row.round === observation.round)) report.g2Bots.push(observation);
            }
          }
        }
        if (m.type === 'receipt') receipts.push({ receipt: m.commandId, ok: m.ok, reason: m.reason ?? null, kind: m.result?.kind ?? null });
      },
    });
    await joinOnline(page, onlineUrl(base, wsPort), '测试');
    await waitRead(page, s => s.m6.mode === 'active', 'match start');

    let lastRound = 0;
    for (;;) {
      const s = await waitRead(page, s => s.m6.phase?.kind === 'preparation' && s.m6.phase.round > lastRound, 'next preparation', 120_000);
      const round = s.m6.phase.round, roundId = s.state.roundDefinitionId, kind = s.state.m8.round.kind;
      lastRound = round;
      if (roundId === '2-1') break;
      // Buy what gold allows, then deploy bench units up to the level through the 部署 tab.
      let state = s.state;
      for (let slot = 0; slot < 5; slot++) if (state.shop.slots[slot]?.status === 'available' && state.gold >= 1) { await click(page, `mobile:buy-${slot}`); await page.waitForTimeout(250); state = (await read(page)).state; }
      await click(page, 'panel:units');
      for (let i = 0; i < 4; i++) {
        state = (await read(page)).state;
        const mine = state.preparation.units.filter(u => u.team === 'player');
        const onBoard = mine.filter(u => u.location.kind === 'board').length;
        const bench = mine.filter(u => u.location.kind === 'bench');
        if (!bench.length || onBoard >= state.level) break;
        const occupied = new Set(state.preparation.units.filter(u => u.location.kind === 'board').map(u => `${u.location.cell.col},${u.location.cell.row}`));
        const zone = state.preparation.board.deploymentZones.player;
        let cell = null;
        for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 2; col < state.preparation.board.columns && !cell; col++) if (!occupied.has(`${col},${row}`)) cell = `${col},${row}`;
        await click(page, `mobile:unit:${bench[0].id}`); await click(page, `deploy:${cell}`); await page.waitForTimeout(300);
      }
      // C8: unit swap on the real server, once, while the board is full at level ≥ 2.
      if (!report.swap && swapReady((await read(page)).state)) {
        await runSwapChecks(page, { check, shot: name => page.screenshot({ path: `${OUT}/${name}.png` }) });
        report.swap = roundId;
      }
      const prep = await read(page);
      const enemiesOnBoard = prep.state.preparation.units.filter(u => u.team === 'enemy').map(u => u.definitionId);
      const enemyTokens = prep.tokens.filter(t => t.visible && prep.state.preparation.units.some(u => u.id === t.id && u.team === 'enemy')).length;
      const preview = await text(page, '[data-debug="encounter-preview"]');
      await page.screenshot({ path: `${OUT}/${roundId}-1-preparation.png` });
      const entry = { round, roundId, kind, roomRoundKind: prep.m6.phase.roundName, enemiesOnBoard, enemyTokens, preview: preview?.slice(0, 80) ?? null,
        mine: prep.state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length };
      // Battle: what is on the board while the replay plays.
      const battle = await waitRead(page, s => s.replay?.playingBack, `${roundId} battle`, 60_000).catch(() => null);
      if (battle) {
        await page.waitForTimeout(600);
        const mid = await read(page);
        entry.battleTeams = [...new Set((mid.combatView?.units ?? []).map(u => `${u.team}:${u.definitionId}`))];
        await page.screenshot({ path: `${OUT}/${roundId}-2-battle.png` });
      } else entry.battleTeams = null;
      // Loot pick (choice) or settlement.
      const after = await waitRead(page, s => !s.replay?.playingBack && ['choice', 'settlement', 'preparation'].includes(s.m6.phase?.kind) && s.state.round === round && s.state.phase !== 'combat', `${roundId} after battle`, 60_000).catch(() => null);
      if (after?.state.phase === 'choice' && after.state.pendingChoice) {
        entry.choice = { kind: after.state.pendingChoice.kind, offers: after.state.pendingChoice.offers };
        await page.screenshot({ path: `${OUT}/${roundId}-3-choice.png` });
        await click(page, `choice:${after.state.pendingChoice.offers[0]}`);
      }
      const settle = await waitRead(page, s => s.m6.phase?.kind === 'settlement' && s.state.phase === 'settlement', `${roundId} settlement`, 60_000).catch(() => null);
      if (settle) {
        await page.waitForTimeout(300);
        const last = settle.state.roundResults.at(-1);
        entry.result = last ? { result: last.result, hp: `${last.hpBefore}->${last.hpAfter}`, gold: `${last.goldBefore}->${last.goldAfter}`, income: last.income } : null;
        entry.inventory = settle.state.items.filter(i => i.location.kind === 'inventory').map(i => i.definitionId);
        entry.bench = settle.state.preparation.units.filter(u => u.team === 'player').map(u => u.definitionId);
        entry.lootPanel = await text(page, '[data-debug="orb-loot"]');
        // C9/C18-B: the rows are the server's revealed-loot summary (contract §18.4 v2, orb cards), not a snapshot diff.
        entry.lootRows = await page.evaluate(() => [...document.querySelectorAll('[data-debug^="orb-entry:"]')].map(row => ({
          dropId: row.dataset.debug.slice('orb-entry:'.length), status: row.dataset.status, receipt: row.dataset.receipt ?? null, text: row.querySelector('.orb-entry-name')?.textContent ?? '' })));
        entry.revealedLoot = settle.state.revealedLoot ?? null;
        await page.screenshot({ path: `${OUT}/${roundId}-4-settlement.png` });
      }
      report.rounds.push(entry);
      console.log(JSON.stringify(entry));
    }

    /* ---------------- combine in 2-1 ---------------- */
    await page.waitForTimeout(200);
    let s = await read(page);
    const inventory = s.state.items.filter(i => i.location.kind === 'inventory');
    console.log(`2-1 inventory: ${inventory.map(i => `${i.id}:${i.definitionId}`).join(', ')}`);
    if (inventory.length >= 2) {
      const preview = await page.evaluate(async ids => {
        const { previewCombine } = await import('/src/simulation/item-selectors.ts');
        return previewCombine(window.__CAT_DEBUG__.read().state, ...ids);
      }, inventory.slice(0, 2).map(item => item.id));
      const label = 'public combine command', disabled = !preview.allowed, selection = inventory.slice(0, 2).map(item => item.id).join(' + ');
      await page.screenshot({ path: `${OUT}/2-1-5-combine-selected.png` });
      const before = receipts.length;
      await equipmentCommand(page, 'combine', ...inventory.slice(0, 2).map(item => item.id));
      await page.waitForTimeout(1500);
      s = await read(page);
      report.combine = { label, disabled, selection, receipts: receipts.slice(before), inventoryBefore: inventory.map(i => i.definitionId), inventoryAfter: s.state.items.filter(i => i.location.kind === 'inventory').map(i => i.definitionId), status: await text(page, '.panel-status') };
      await page.screenshot({ path: `${OUT}/2-1-6-combine-after.png` });
    } else report.combine = { skipped: `inventory ${inventory.length}` };
    console.log(JSON.stringify(report.combine));

    /* ---------------- G1-P6: 2-1 shows possible opponents; the battle names one of them ---------------- */
    const marks = () => page.evaluate(() => [...document.querySelectorAll('.online-seat[data-pairing]')].map(node => `${node.dataset.debug.replace('online:seat:', '')}:${node.dataset.pairing}`).sort());
    check(report.g2Bots.length > 0, 'G2-1: bots bought and deployed an admitted new hero (beyond their random one-cost opening; PvE loot contains only historical heroes)');
    const prep21 = await read(page), candidates = prep21.m6.opponentCandidates ?? [];
    const shownMarks = await marks();
    report.pairing = { candidates, preparationMarks: shownMarks };
    check(prep21.m6.phase.kind === 'preparation' && prep21.m6.opponentSeatId === null && candidates.length >= 1, `2-1 preparation: no opponent yet, ${candidates.length} candidate(s) ${candidates.join(',')}`);
    const expectedMarks = (candidates.length === 1 ? [`${candidates[0]}:opponent`] : candidates.map(seatId => `${seatId}:candidate`)).sort();
    check(JSON.stringify(shownMarks) === JSON.stringify(expectedMarks), `2-1 preparation: the sidebar marks exactly the candidates (${shownMarks.join(' ')})`);
    const fight = await waitRead(page, s => s.m6.phase?.kind === 'combat' && s.m6.opponentSeatId, '2-1 battle opponent', 60_000);
    report.pairing.opponent = fight.m6.opponentSeatId;
    check(candidates.includes(fight.m6.opponentSeatId), `2-1 battle: the opponent ${fight.m6.opponentSeatId} is one of the candidates`);
    check(JSON.stringify(await marks()) === JSON.stringify([`${fight.m6.opponentSeatId}:opponent`]), '2-1 battle: only the opponent is marked');
    await page.screenshot({ path: `${OUT}/2-1-7-opponent.png` });
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
    // Item 4: 1-2, 1-3, 1-4 are monster rounds on the real server: monsters on the preparation board, fought in battle.
    const pve = report.rounds.filter(entry => ['1-2', '1-3', '1-4'].includes(entry.roundId));
    check(pve.length === 3 && pve.every(entry => entry.kind === 'pve' && entry.enemiesOnBoard.length > 0 && entry.enemyTokens === entry.enemiesOnBoard.length),
      `1-2/1-3/1-4 preparation boards show monsters: ${pve.map(entry => `${entry.roundId}×${entry.enemyTokens}`).join(' ')}`);
    check(pve.every(entry => entry.battleTeams?.some(team => team.startsWith('enemy:pve-'))), 'every 1-x battle is fought against those monsters');
    // Item 2 (C9, §18.4 v2 since C18-B): the settlement lists the server's authoritative drops of the round on orb cards.
    check(pve.every(entry => entry.revealedLoot?.roundId === entry.roundId && entry.lootPanel?.startsWith(`${entry.roundId} 宝珠`)),
      `settlement shows the revealedLoot summary of the round: ${pve.map(entry => `${entry.roundId} ${entry.lootPanel}`).join(' | ')}`);
    check(pve.every(entry => entry.lootRows.length === entry.revealedLoot.revealedDrops.length
      && entry.revealedLoot.revealedDrops.every(drop => entry.lootRows.some(row => row.dropId === drop.dropId && row.status === drop.status && row.receipt === drop.receiptId))),
      `loot rows match the revealedDrops entries: ${pve.map(entry => `${entry.roundId} ${JSON.stringify(entry.lootRows)}`).join(' | ')}`);
    check(pve.every(entry => entry.revealedLoot.revealedDrops.length > 0), 'every 1-x round revealed at least one drop by settlement');
    // T13-B: the fixed 1-3 Lux and component pick became random orbs; every hero the server granted is now mine.
    const heroes = pve.flatMap(entry => entry.revealedLoot.revealedDrops.filter(drop => drop.status === 'granted' && drop.payload.kind === 'unit').map(drop => [entry, drop.payload.definitionId]));
    check(heroes.every(([entry, hero]) => entry.bench.includes(hero)), `every granted loot hero is among my units: ${heroes.map(([entry, hero]) => `${entry.roundId} ${hero}`).join(', ') || 'none granted'}`);
    // Item 3: two components in inventory combine on the real server.
    check(report.combine.receipts?.some(entry => entry.receipt !== undefined && entry.ok && entry.kind === 'applied') && report.combine.inventoryAfter.length === report.combine.inventoryBefore.length - 1,
      `combine accepted by the server: ${JSON.stringify(report.combine.receipts)}, ${report.combine.inventoryBefore} → ${report.combine.inventoryAfter}`);
    check(report.swap, `swap checks ran online (round ${report.swap})`);
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  } finally { await browser.close(); }
}
main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
