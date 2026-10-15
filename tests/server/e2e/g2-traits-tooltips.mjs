/**
 * G2 prerequisite UI (第八批补充 · 窗口 2): trait column, unit / trait / item hover cards, the opponent's trait column.
 *
 * Against the real game server (`npm run build:game` first). In one preparation with units of mine:
 *   1. the trait column rows equal the rules' own `deriveTraits` of my board (rows with count > 0, count and tier per row,
 *      active rows first), read by importing the rules module in the page, never recounted here;
 *   2. dragging a unit between board and bench changes the rows and they equal deriveTraits again, both ways;
 *   3. hover on a trait row, a shop card, a unit token on the canvas and an inventory item opens a non-empty card; the unit
 *      card's ability text has every variable the content lists replaced (no `@Var@` of a listed variable, no Riot markup);
 *   4. the scouting panel of another seat renders a trait column with breakpoints, and its rows open the trait card.
 * Env: G2_WS_PORT / G2_VITE_PORT override the default ports.
 */
import {
  click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, outDir, read, sleep, startGameServer, startVite, stopAll, trackCommands, waitRead,
} from './harness.mjs';

const WS_PORT = Number(process.env.G2_WS_PORT ?? 8941), VITE_PORT = Number(process.env.G2_VITE_PORT ?? 5341);
const OUT = outDir('g2-traits-tooltips');
const { check, finish } = createChecks();

/** The column as rendered: one entry per trait row. */
const columnRows = page => page.evaluate(() => [...document.querySelectorAll('#trait-column .trait-row[data-trait]')].map(node => ({
  traitId: node.dataset.trait, count: Number(node.dataset.count), tier: Number(node.dataset.tier), active: node.classList.contains('active'),
  current: node.querySelector('.trait-step.current')?.textContent ?? null, icon: Boolean(node.querySelector('img.trait-icon, .trait-letter')),
})));
/** The rules' own snapshot of my board, through the module the page already runs (Vite dev server). */
const expectedRows = page => page.evaluate(async () => {
  const { deriveTraits } = await import('/src/simulation/trait-snapshot.ts');
  const state = window.__CAT_DEBUG__.read().state;
  return deriveTraits(state.preparation, 'player').filter(row => row.count > 0).map(row => ({ traitId: row.traitId, count: row.count, tier: row.tier }));
});
const sameRows = (shown, expected) => shown.length === expected.length
  && expected.every(row => shown.some(entry => entry.traitId === row.traitId && entry.count === row.count && entry.tier === row.tier && entry.active === (row.tier > 0)
    && (row.tier > 0 ? entry.current === String(row.tier) : entry.current === null)));
const ordered = shown => shown.every((row, index) => index === 0 || Number(shown[index - 1].active) >= Number(row.active)
  && (shown[index - 1].active !== row.active || shown[index - 1].tier > row.tier || shown[index - 1].tier === row.tier && shown[index - 1].count >= row.count));
const describe = rows => rows.map(row => `${row.traitId}:${row.count}/${row.tier}`).join(' ') || 'none';

/** Text of a hover card after hovering `locator` (or moving to a point); null when it stayed closed. */
async function hoverText(page, cardId, move) {
  await page.mouse.move(5, 5); await sleep(80);
  await move();
  for (let tries = 0; tries < 15; tries++) {
    await sleep(80);
    const text = await page.evaluate(id => { const node = document.getElementById(id); return node && !node.hidden ? node.innerText.trim() : null; }, cardId);
    if (text) return text;
  }
  return null;
}
/** Variables the content lists for this unit's ability that are still written as `@Var@` / `@Var*N@`. */
const leftoverVariables = (page, definitionId, text) => page.evaluate(async ([id, shown]) => {
  const { UNIT_DEFINITIONS } = await import('/src/simulation/units.ts');
  const { S13_ABILITY_DATA } = await import('/src/simulation/content/abilities.ts');
  const ability = S13_ABILITY_DATA[UNIT_DEFINITIONS[id]?.abilityId];
  if (!ability) return { known: 0, leftover: [] };
  const names = Object.keys(ability.variables);
  return { known: names.filter(name => ability.description.includes(`@${name}`)).length, leftover: names.filter(name => shown.includes(`@${name}@`) || shown.includes(`@${name}*`)) };
}, [definitionId, text]);

async function dragTo(page, unitId, target) {
  const snap = await read(page);
  const token = snap.tokens.find(entry => entry.id === unitId && entry.visible);
  const point = target.kind === 'board' ? snap.layout.hexes[`${target.cell.col},${target.cell.row}`] : snap.layout.bench[target.slot];
  if (!token || !point) return false;
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.mouse.move(token.screenX, token.screenY); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 8 }); await sleep(60); await page.mouse.up();
  return true;
}
/** Waits until the column equals deriveTraits of the latest state (the push after a drag); returns both. */
async function settleRows(page, timeout = 4_000) {
  const deadline = Date.now() + timeout;
  let shown = [], expected = [];
  while (Date.now() < deadline) {
    [shown, expected] = [await columnRows(page), await expectedRows(page)];
    if (sameRows(shown, expected)) break;
    await sleep(100);
  }
  return { shown, expected };
}

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '40', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '6', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    collectErrors(page, errors);
    trackCommands(page);
    await joinOnline(page, onlineUrl(base, wsPort), '羁绊');
    await waitRead(page, s => s.m6.mode === 'active', 'match start');
    const done = new Set(), answered = new Set();
    const deadline = Date.now() + 8 * 60_000;
    while (!(done.has('column') && done.has('item') && done.has('scout')) && Date.now() < deadline) {
      const s = await read(page).catch(() => null);
      if (!s?.state || !s.m6?.phase) { await sleep(100); continue; }
      if (s.m6.phase.kind === 'ended') break;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation}`)) { answered.add(`${choice.choiceId}:${choice.generation}`); await click(page, `choice:${choice.offers[0]}`); continue; }
      const preparing = s.m6.phase.kind === 'preparation' && s.state.phase === 'preparation' && s.m6.phase.endsAt - s.m6.phase.serverNow > 15_000;
      if (!preparing) { await sleep(150); continue; }
      const label = s.m6.phase.roundName;
      const mine = s.state.preparation.units.filter(unit => unit.team === 'player');
      const onBoard = mine.filter(unit => unit.location.kind === 'board');

      if (!done.has('column') && mine.length > 0) {
        // 1. Column equals the rules' snapshot, ordered, every row with an icon or a letter badge.
        let { shown, expected } = await settleRows(page);
        check(sameRows(shown, expected), `${label}: trait column rows equal deriveTraits of my board (${describe(shown)} vs ${describe(expected)})`);
        check(ordered(shown), `${label}: active rows first, by tier then count (${describe(shown)})`);
        check(shown.every(row => row.icon), `${label}: every row has a trait icon or a letter placeholder`);
        // 2. Move one unit between bench and board and back; the column follows each time.
        const zone = s.state.preparation.board.deploymentZones.player;
        const occupied = new Set(onBoard.map(unit => `${unit.location.cell.col},${unit.location.cell.row}`));
        const freeCell = Object.keys(s.layout.hexes).find(key => { const [col, row] = key.split(',').map(Number); return row >= zone.firstRow && row <= zone.lastRow && !occupied.has(key) && col >= 0; });
        const usedSlots = new Set(mine.filter(unit => unit.location.kind === 'bench').map(unit => unit.location.slot));
        const freeSlot = [...Array(s.state.preparation.benchSize).keys()].find(slot => !usedSlots.has(slot));
        const bench = mine.find(unit => unit.location.kind === 'bench');
        const first = onBoard[0] && freeSlot !== undefined ? { unit: onBoard[0], to: { kind: 'bench', slot: freeSlot } }
          : bench && freeCell && onBoard.length < s.state.level ? { unit: bench, to: { kind: 'board', cell: { col: Number(freeCell.split(',')[0]), row: Number(freeCell.split(',')[1]) } } } : null;
        if (first) {
          const back = first.unit.location;
          const before = describe(shown);
          await dragTo(page, first.unit.id, first.to);
          ({ shown, expected } = await settleRows(page));
          check(sameRows(shown, expected) && describe(shown) !== before, `${label}: after dragging ${first.unit.definitionId} to the ${first.to.kind} the column changed and equals deriveTraits (${before} → ${describe(shown)})`);
          await page.screenshot({ path: `${OUT}/column-after-drag.png` });
          await dragTo(page, first.unit.id, back);
          ({ shown, expected } = await settleRows(page));
          check(sameRows(shown, expected) && describe(shown) === before, `${label}: dragging it back restores the column (${describe(shown)})`);
        } else check(false, `${label}: found a unit to move between board and bench`);
        // 3a. Trait hover: tiers and members.
        if (shown.length) {
          const trait = await hoverText(page, 'trait-card', () => page.hover(`#trait-column .trait-row[data-trait="${shown[0].traitId}"]`));
          const tiers = await page.evaluate(() => document.querySelectorAll('#trait-card .trait-card-tiers li').length);
          const members = await page.evaluate(() => document.querySelectorAll('#trait-card .trait-card-members .member').length);
          check(Boolean(trait) && tiers > 0 && members > 0, `${label}: trait hover shows ${tiers} tiers and ${members} members (${trait?.split('\n')[0]})`);
        }
        // 3b. Shop card hover: cost, traits, ability with listed variables replaced, base stats.
        const shopDef = await page.evaluate(() => document.querySelector('.shop-card[data-unit-def]')?.dataset.unitDef ?? null);
        if (shopDef) {
          const text = await hoverText(page, 'unit-card', () => page.hover(`.shop-card[data-unit-def="${shopDef}"]`));
          const vars = await leftoverVariables(page, shopDef, text ?? '');
          check(Boolean(text) && /费/.test(text) && /生命/.test(text) && /技能/.test(text), `shop hover on ${shopDef} shows cost, ability and stats`);
          check(text !== null && vars.leftover.length === 0 && !/<\/?[A-Za-z]/.test(text), `shop hover: every listed ability variable replaced (${vars.known} in the template, left: ${vars.leftover.join(',') || 'none'})`);
          await page.screenshot({ path: `${OUT}/unit-card-shop.png` });
        } else check(false, 'a shop card with a unit to hover');
        // 3c. Canvas token hover: the same card for my unit at its star level.
        const now = await read(page);
        const unit = now.state.preparation.units.find(entry => entry.team === 'player');
        const token = unit && now.tokens.find(entry => entry.id === unit.id && entry.visible);
        if (token) {
          const text = await hoverText(page, 'unit-card', () => page.mouse.move(token.screenX, token.screenY));
          const key = await page.evaluate(() => document.getElementById('unit-card')?.dataset.key ?? null);
          const vars = await leftoverVariables(page, unit.definitionId, text ?? '');
          // G5 (#109) appends the unit's battle-stats part to the canvas card's key (`unit:<id>:<star>:<stats>`, empty before any battle).
          check(key?.startsWith(`unit:${unit.definitionId}:${unit.starLevel}:`) && Boolean(text) && vars.leftover.length === 0, `canvas hover on ${unit.id} opens its card (${key}, left: ${vars.leftover.join(',') || 'none'})`);
          await page.screenshot({ path: `${OUT}/unit-card-board.png` });
          await page.mouse.move(5, 5); await sleep(150);
          check(await page.evaluate(() => document.getElementById('unit-card')?.hidden), 'leaving the token closes the card');
        } else check(false, 'a visible unit token of mine to hover');
        done.add('column');
      }

      // 3d. Item hover (needs an item in my inventory; loot arrives from 1-2 on).
      if (!done.has('item') && s.state.items.some(item => item.location.kind === 'inventory')) {
        const itemDef = await page.evaluate(() => document.querySelector('#strategy-root [data-item-def]')?.dataset.itemDef ?? null);
        if (itemDef) {
          const text = await hoverText(page, 'item-popover', () => page.hover(`#strategy-root [data-item-def="${itemDef}"]`));
          check(Boolean(text) && /配方/.test(text), `item hover on ${itemDef} shows its effect and recipe (${text?.split('\n').slice(0, 2).join(' / ')})`);
          done.add('item');
        }
      }

      // 4. Scouting panel: the opponent's trait column with breakpoints; its rows open the trait card.
      if (!done.has('scout')) {
        const me = await page.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));
        const target = s.m6.seats.find(seat => seat.seatId !== me && seat.alive && (seat.publicBoard?.units.length ?? 0) > 0);
        if (target) {
          await page.click(`[data-debug="online:seat:${target.seatId}"]`); await sleep(200);
          const scouted = await page.evaluate(() => [...document.querySelectorAll('#opponent-board [data-debug="online:opponent-traits"] .trait-row[data-trait]')].map(node => ({
            traitId: node.dataset.trait, steps: node.querySelectorAll('.trait-step').length })));
          check(scouted.length > 0 && scouted.every(row => row.steps > 0), `scouting ${target.name}: opponent trait column with breakpoints (${scouted.map(row => row.traitId).join(' ')})`);
          if (scouted.length) {
            const text = await hoverText(page, 'trait-card', () => page.hover(`#opponent-board .trait-row[data-trait="${scouted[0].traitId}"]`));
            check(Boolean(text), `scouting: hovering the opponent's ${scouted[0].traitId} row opens the trait card`);
          }
          const unitDef = await page.evaluate(() => document.querySelector('#opponent-board .opponent-unit[data-unit-def]')?.dataset.unitDef ?? null);
          if (unitDef) check(Boolean(await hoverText(page, 'unit-card', () => page.hover(`#opponent-board .opponent-unit[data-unit-def="${unitDef}"]`))), `scouting: hovering ${unitDef} opens its unit card`);
          await page.screenshot({ path: `${OUT}/scouting.png` });
          await page.keyboard.press('Escape'); await sleep(120);
          done.add('scout');
        }
      }
      await sleep(200);
    }
    check(done.has('column'), 'checked the trait column and hovers in a preparation');
    check(done.has('item'), 'checked an item hover');
    check(done.has('scout'), 'checked the scouting trait column');
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => { stopAll(); finish('G2 traits and tooltips'); }).catch(error => { console.error(error); stopAll(); process.exit(1); });
