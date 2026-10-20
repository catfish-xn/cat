/* Test preparation only: native public UI commands, unchanged combat wall clock.
 * Empty-board opening losses earn the real 2/3/5G. No state/resource injection. */
async function prepareB6Opening(page, roundId, { resolveChoices = true, redeploy = true, dragDeployment = false } = {}) {
  if (!['1-3', '1-4', '2-1', '2-5'].includes(roundId)) throw Error('Unsupported B6 preparation target');
  const read = () => page.evaluate(() => window.__CAT_DEBUG__.read().state);
  const click = async id => {
    await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
    await page.locator(`[data-debug="${id}"]`).click();
  };
  const initial = await read();
  if (initial.m8.round.roundId !== '1-2' || initial.phase !== 'preparation') throw Error('B6 preparation requires a fresh opening');
  async function deploy(target) {
    if (dragDeployment) {
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const snapshot = await page.evaluate(() => window.__CAT_DEBUG__.read());
      const unit = snapshot.tokens.find(unit => unit.id === 'unit-1' && unit.visible);
      if (!unit) throw Error('B6 preparation requires a visible opening unit');
      const point = target.kind === 'bench' ? snapshot.layout.bench[target.slot] : snapshot.layout.hexes[`${target.cell.col},${target.cell.row}`];
      await page.mouse.move(unit.screenX, unit.screenY); await page.mouse.down();
      await page.mouse.move(point.x, point.y, { steps: 6 }); await page.mouse.up();
    } else {
      await click('panel:units'); await click('mobile:unit:unit-1');
      await click(target.kind === 'bench' ? `mobile:bench:${target.slot}` : `deploy:${target.cell.col},${target.cell.row}`);
    }
    const unit = (await read()).preparation.units.find(unit => unit.id === 'unit-1');
    if (JSON.stringify(unit?.location) !== JSON.stringify(target)) throw Error('B6 native deployment did not reach its intended location');
  }
  await deploy({ kind: 'bench', slot: 0 });
  for (let guard = 0; guard < 40; guard++) {
    const state = await read();
    if (state.m8.round.roundId === roundId && (state.phase === 'preparation' || state.phase === 'choice' && !resolveChoices)) {
      if (redeploy && state.phase === 'preparation') {
        await deploy({ kind: 'board', cell: { col: 1, row: 4 } });
      }
      return read();
    }
    if (state.phase === 'choice') {
      const choice = state.pendingChoice;
      if (choice.step !== 'offer') throw Error('Unexpected target choice in opening preparation');
      // Keep the 10G shortcut vector deterministic rather than selecting +8G placebo.
      const offer = choice.offers.find(id => id !== 'placebo');
      if (!offer) throw Error('No non-gold-changing opening offer');
      await click(`choice:${offer}`);
    } else if (state.phase === 'preparation') {
      await page.waitForTimeout(450); await click('mobile:start-combat');
    } else if (state.phase === 'settlement') await click('mobile:continue');
    else if (state.phase === 'combat') await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
    else throw Error(`Opening preparation ended at ${state.phase}`);
  }
  throw Error(`Did not reach ${roundId} through public commands`);
}
module.exports = { prepareB6Opening };
