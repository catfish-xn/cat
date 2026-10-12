/**
 * Work order C8: SR-C7-01 unit swap, driven with real mouse drags on the board canvas.
 * Shared by c7-playtest.mjs (online, `?server=ws`) and c8-unit-swap.mjs (single player).
 *
 * Precondition (asserted): preparation, board full (deployed == level ≥ 2) and at least two bench units,
 * so every case below runs at the population cap. Checks, in order:
 *   1. bench → occupied board cell swaps at full population (the dragged unit goes up, the occupant to its slot);
 *   2. board → occupied bench slot swaps;
 *   3. board ↔ board swaps;
 *   4. bench ↔ bench swaps;
 *   5. bench → empty board cell at the cap is refused with the population-cap text and nothing moves.
 * While hovering an ally the drag status says 可互换; the refusal shows the 人口已满 text mid-drag and after release.
 */
export const readDebug = page => page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null);

const key = location => location.kind === 'board' ? `b:${location.cell.col},${location.cell.row}` : `s:${location.slot}`;
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const where = (state, id) => key(state.preparation.units.find(unit => unit.id === id).location);
const layoutKey = state => mine(state).map(unit => `${unit.id}@${key(unit.location)}`).sort().join(' ');

async function waitFor(page, predicate, what, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await readDebug(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await page.waitForTimeout(50);
  }
}
/** Strategy-panel status line: mirrors the board status during a drag (the panel re-renders it after a command). */
const status = page => page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');

/** Press on the unit, move over the target and report the hover status (optionally screenshot it), then release. */
export async function dragUnit(page, unitId, target, hoverShot) {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const snap = await readDebug(page);
  const token = snap.tokens.find(entry => entry.id === unitId);
  const point = target.kind === 'board' ? snap.layout.hexes[`${target.cell.col},${target.cell.row}`] : snap.layout.bench[target.slot];
  await page.mouse.move(token.screenX, token.screenY);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.waitForTimeout(60);
  const hover = await status(page);
  if (hoverShot) await hoverShot();
  await page.mouse.up();
  return hover;
}

/** The precondition below, for callers that wait for a round where it holds. */
export function swapReady(state) {
  const units = mine(state), board = units.filter(unit => unit.location.kind === 'board').length;
  return state.phase === 'preparation' && state.level >= 2 && board === state.level && units.length - board >= 2;
}

export async function runSwapChecks(page, { check, shot }) {
  let snap = await readDebug(page);
  const start = snap.state;
  const board = () => mine(snap.state).filter(unit => unit.location.kind === 'board');
  const bench = () => mine(snap.state).filter(unit => unit.location.kind === 'bench');
  check(swapReady(start),
    `swap precondition: level ${start.level}, board ${board().length}, bench ${bench().length}`);
  const count = () => board().length;
  const swapped = async (a, b, what) => {
    const before = { a: where(snap.state, a), b: where(snap.state, b) };
    snap = await waitFor(page, s => where(s.state, a) === before.b && where(s.state, b) === before.a, what);
  };

  // 1. Bench → occupied board cell at full population.
  {
    const up = bench()[0], down = board()[0];
    const hover = await dragUnit(page, up.id, down.location, () => shot('swap-0-hover-ally'));
    check(hover.startsWith('可互换'), `bench→board hover says swap (${hover})`);
    await swapped(up.id, down.id, 'bench→board swap');
    const done = await waitFor(page, s => s.texts.some(text => text.startsWith('互换成功')), 'swap success text', 3_000).then(() => true, () => false);
    check(count() === start.level && done, `bench ${up.id} ↔ board ${down.id} swapped at full population (${count()}/${start.level}), board status says 互换成功`);
    await shot('swap-1-bench-to-board');
  }
  // 2. Board → occupied bench slot.
  {
    const down = board()[0], up = bench()[0];
    const hover = await dragUnit(page, down.id, up.location);
    check(hover.startsWith('可互换'), `board→bench hover says swap (${hover})`);
    await swapped(down.id, up.id, 'board→bench swap');
    check(count() === start.level, `board ${down.id} ↔ bench ${up.id} swapped`);
    await shot('swap-2-board-to-bench');
  }
  // 3. Board ↔ board.
  {
    const [a, b] = board();
    const hover = await dragUnit(page, a.id, b.location);
    check(hover.startsWith('可互换'), `board↔board hover says swap (${hover})`);
    await swapped(a.id, b.id, 'board↔board swap');
    check(count() === start.level, `board ${a.id} ↔ board ${b.id} swapped`);
    await shot('swap-3-board-to-board');
  }
  // 4. Bench ↔ bench.
  {
    const [a, b] = bench();
    await dragUnit(page, a.id, b.location);
    await swapped(a.id, b.id, 'bench↔bench swap');
    check(count() === start.level, `bench ${a.id} ↔ bench ${b.id} swapped`);
  }
  // 5. Bench → empty board cell at the cap: refused, nothing moves.
  {
    const zone = snap.state.preparation.board.deploymentZones.player;
    const taken = new Set(snap.state.preparation.units.map(unit => key(unit.location)));
    let cell = null;
    for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 0; col < snap.state.preparation.board.columns && !cell; col++) if (!taken.has(`b:${col},${row}`)) cell = { col, row };
    const before = layoutKey(snap.state);
    const hover = await dragUnit(page, bench()[0].id, { kind: 'board', cell }, () => shot('swap-4-hover-cap'));
    await page.waitForTimeout(800);
    snap = await readDebug(page);
    const after = snap.texts.find(text => text.startsWith('人口已满')) ?? '';
    check(hover.startsWith('人口已满') && after && layoutKey(snap.state) === before,
      `bench → empty cell at the cap refused (hover "${hover}", after "${after}")`);
    await shot('swap-4-cap-refused');
  }
}
