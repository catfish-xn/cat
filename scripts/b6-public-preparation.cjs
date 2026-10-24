/* Test preparation only: native public UI commands, unchanged combat wall clock.
 * Empty-board opening losses earn the real v22 2/3/4G base plus 0/1/1G loss streak. No state/resource injection. */
async function prepareB6Opening(page, roundId, { resolveChoices = true, redeploy = true } = {}) {
  if (!['1-3', '1-4', '2-1', '2-5'].includes(roundId)) throw Error('Unsupported B6 preparation target');
  const read = () => page.evaluate(() => window.__CAT_DEBUG__.read().state);
  const click = async id => {
    await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
    await page.locator(`[data-debug="${id}"]`).click();
  };
  const initial = await read();
  if (initial.m8.round.roundId !== '1-2' || initial.phase !== 'preparation') throw Error('B6 preparation requires a fresh opening');
  await click('panel:units'); await click('mobile:unit:unit-1'); await click('mobile:bench:0');
  for (let guard = 0; guard < 40; guard++) {
    const state = await read();
    if (state.m8.round.roundId === roundId && (state.phase === 'preparation' || state.phase === 'choice' && !resolveChoices)) {
      if (redeploy && state.phase === 'preparation') {
        await click('panel:units'); await click('mobile:unit:unit-1'); await click('deploy:1,4');
      }
      return read();
    }
    if (state.phase === 'choice') {
      const choice = state.pendingChoice;
      if (choice.step !== 'offer') throw Error('Unexpected target choice in opening preparation');
      // Keep the 11G shortcut vector deterministic rather than selecting +8G placebo.
      const offer = choice.offers.find(id => id !== 'placebo');
      if (!offer) throw Error('No non-gold-changing opening offer');
      await click(`choice:${offer}`);
    } else if (state.phase === 'preparation') {
      await page.waitForTimeout(450); await click('mobile:start-combat');
    } else if (state.phase === 'settlement') {
      // Empty-board battles finish immediately. Let the existing phase-change
      // input guard expire before the next native click, as for Start above;
      // repeatedly clicking during that guard only prolongs the rejected burst.
      await page.waitForTimeout(450); await click('mobile:continue');
    }
    else if (state.phase === 'combat') await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 120000 });
    else throw Error(`Opening preparation ended at ${state.phase}`);
  }
  throw Error(`Did not reach ${roundId} through public commands`);
}
module.exports = { prepareB6Opening };
