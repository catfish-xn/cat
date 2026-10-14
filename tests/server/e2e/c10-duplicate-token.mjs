/**
 * Work order C10 (playtest bug): during online battle playback a unit of mine showed twice on the board.
 * Against the real game server (`?server=ws`), one human + seven bots, plays 1-x → 2-2 like c7-playtest
 * (buy, deploy through the 部署 tab, first loot pick) and, while every battle replay plays, reads
 * window.__CAT_DEBUG__ every 500 ms and checks
 *   visible tokens == alive combatView units + my bench units
 * printing each stray token's definitionId/cell. Must see at least one 2-x (PvP) battle with my units in it.
 *
 *   npm run build:game && node tests/server/e2e/c10-duplicate-token.mjs
 *
 * Screenshots of the first mismatch and of each 2-x battle go to artifacts/c10/ (not committed).
 */
import { writeFileSync } from 'node:fs';
import { click, collectErrors, joinOnline, launchBrowser, onlineUrl, outDir, read, startGameServer, startVite, stopAll, strictCheck as check, waitRead } from './harness.mjs';

const OUT = outDir('c10');
const VITE_PORT = 5196;
const WS_PORT = 8790;
const LAST_ROUND = '2-2';

const cellKey = cell => `${cell.col},${cell.row}`;

/** One playback sample: visible tokens against alive combat units + my bench; strays are tokens neither explains. */
function sample(s) {
  const alive = (s.combatView?.units ?? []).filter(unit => unit.alive);
  const bench = s.state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'bench');
  const visible = s.tokens.filter(token => token.visible);
  const explained = new Set([...alive.map(unit => unit.id), ...bench.map(unit => unit.id)]);
  const where = id => {
    const unit = s.state.preparation.units.find(candidate => candidate.id === id) ?? s.combatView?.units.find(candidate => candidate.id === id);
    if (!unit) return '?';
    return 'location' in unit ? (unit.location.kind === 'board' ? `board ${cellKey(unit.location.cell)}` : `bench ${unit.location.slot}`) : `combat ${cellKey(unit.cell)}`;
  };
  const strays = visible.filter(token => !explained.has(token.id)).map(token => ({ id: token.id, definitionId: token.definitionId, star: token.starLevel, at: where(token.id) }));
  // Same definition+star shown more often than the battle and the bench hold it: what the player sees as a duplicate.
  const count = list => list.reduce((map, key) => map.set(key, (map.get(key) ?? 0) + 1), new Map());
  const shown = count(visible.map(token => `${token.definitionId}/${token.starLevel}★`));
  const held = count([...alive, ...bench].map(unit => `${unit.definitionId}/${unit.starLevel}★`));
  const duplicates = [...shown].filter(([key, n]) => n > (held.get(key) ?? 0)).map(([key, n]) => `${key}×${n} (holds ${held.get(key) ?? 0})`);
  return { tick: s.combatView?.tick ?? null, visible: visible.length, expected: alive.length + bench.length, alive: alive.length, bench: bench.length,
    mineInBattle: alive.filter(unit => unit.team === 'player').length, strays, duplicates };
}

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '12', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '3', CAT_BOT_STEP_MS: '200' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  const report = { battles: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    collectErrors(page, errors);
    await joinOnline(page, onlineUrl(base, wsPort), '测试');
    await waitRead(page, s => s.m6.mode === 'active', 'match start');

    let lastRound = 0, shotMismatch = false;
    for (;;) {
      const s = await waitRead(page, s => s.m6.phase?.kind === 'preparation' && s.m6.phase.round > lastRound, 'next preparation', 120_000);
      const round = s.m6.phase.round, roundId = s.state.roundDefinitionId, kind = s.state.m8.round.kind;
      lastRound = round;
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
        const occupied = new Set(state.preparation.units.filter(u => u.location.kind === 'board').map(u => cellKey(u.location.cell)));
        const zone = state.preparation.board.deploymentZones.player;
        let cell = null;
        for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 2; col < state.preparation.board.columns && !cell; col++) if (!occupied.has(`${col},${row}`)) cell = `${col},${row}`;
        await click(page, `mobile:unit:${bench[0].id}`); await click(page, `deploy:${cell}`); await page.waitForTimeout(300);
      }
      // Battle: sample the board every 500 ms while the replay plays.
      const battle = await waitRead(page, s => s.replay?.playingBack, `${roundId} battle`, 60_000).catch(() => null);
      if (battle) {
        const entry = { roundId, kind, samples: [] };
        for (let snapshot = battle; snapshot?.replay?.playingBack; snapshot = await read(page)) {
          const result = sample(snapshot);
          entry.samples.push(result);
          if (result.visible !== result.expected && !shotMismatch) { shotMismatch = true; await page.screenshot({ path: `${OUT}/${roundId}-mismatch.png` }); }
          if (roundId.startsWith('2-') && entry.samples.length === 3) await page.screenshot({ path: `${OUT}/${roundId}-battle.png` });
          await page.waitForTimeout(500);
        }
        const bad = entry.samples.filter(result => result.visible !== result.expected);
        console.log(`${roundId} (${kind}): ${entry.samples.length} samples, ${bad.length} mismatched${bad.length ? ` — e.g. tick ${bad[0].tick}: visible ${bad[0].visible} vs ${bad[0].alive} alive + ${bad[0].bench} bench; strays ${JSON.stringify(bad[0].strays)}; duplicates ${bad[0].duplicates.join(', ')}` : ''}`);
        report.battles.push(entry);
      }
      // After the battle my board units are back as their own (preparation) tokens, once each.
      const after = await waitRead(page, s => !s.replay?.playingBack && ['choice', 'settlement', 'preparation'].includes(s.m6.phase?.kind) && s.state.round === round && s.state.phase !== 'combat', `${roundId} after battle`, 60_000).catch(() => null);
      if (after && battle) {
        const board = after.state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === 'board');
        const tokens = after.tokens.filter(token => token.visible && after.state.preparation.units.some(unit => unit.id === token.id && unit.team === 'player'));
        report.battles.at(-1).after = { board: board.length, missing: board.filter(unit => !after.tokens.some(token => token.id === unit.id && token.visible)).map(unit => unit.definitionId),
          strays: after.tokens.filter(token => token.visible && !after.state.preparation.units.some(unit => unit.id === token.id)).map(token => token.definitionId), mine: tokens.length };
      }
      if (roundId === LAST_ROUND) break;
      // Loot pick (choice), then the next round.
      if (after?.state.phase === 'choice' && after.state.pendingChoice) await click(page, `choice:${after.state.pendingChoice.offers[0]}`);
    }
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, errors }, null, 2));
    const pvp = report.battles.filter(entry => entry.roundId.startsWith('2-') && entry.samples.some(result => result.mineInBattle > 0));
    check(pvp.length > 0, `played back ${pvp.length} 2-x battle(s) with my units: ${pvp.map(entry => `${entry.roundId}(${entry.kind})`).join(' ')}`);
    for (const entry of report.battles) {
      const bad = entry.samples.filter(result => result.visible !== result.expected);
      check(entry.samples.length > 0 && bad.length === 0,
        `${entry.roundId}: visible tokens == alive combat units + bench in all ${entry.samples.length} samples${bad.length ? ` (first bad: ${JSON.stringify(bad[0])})` : ''}`);
    }
    const afters = report.battles.filter(entry => entry.after);
    check(afters.length > 0 && afters.every(entry => !entry.after.missing.length && !entry.after.strays.length),
      `after each battle my board units show once at their own cells: ${afters.map(entry => `${entry.roundId} ${JSON.stringify(entry.after)}`).join(' | ')}`);
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  } finally { await browser.close(); }
}
main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
