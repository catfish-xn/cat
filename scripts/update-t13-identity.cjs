/* Record the signed T13-B identity only after checking the original first battle
 * before updating fingerprints. The separate loot oracle checks reward semantics.
 * verify-t1-node-entry then cross-checks browser /
 * Node bytes, restore continuation and CLI against these pinned traces. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const pinned = require('../tests/t1-probe-baseline.json');
const previous = require('../tests/t13-a-content-baseline.json');
const randomState = state => ({
  seed: state.seed, shop: state.rngState, choice: state.choiceRngState,
  reward: state.rewardRngState, battleSeed: state.battleSeedRngState,
  equipment: state.equipmentState.equipment, reforge: state.reforgeState,
  layout: state.m8.loot.layoutBinding.mode === 'solo' ? state.m8.loot.layoutBinding.layout.rng : null,
  loot: state.m8.loot.frozen.rng,
  combat: state.combat ? { state: state.combat.rngState, draws: state.combat.rngDraws } : null,
});
async function main() {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error' });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { digestContent } = await server.ssrLoadModule('/src/simulation/content/index.ts');
    const initial = api.createMatch(pinned.seed), start = api.startMatchCombat(initial);
    assert(start.ok); const steps = [start], events = [...start.events]; let state = start.state;
    while (state.phase === 'combat') {
      assert(steps.length <= 1201); const result = api.stepMatch(state);
      steps.push(result); events.push(...result.events); state = result.state;
    }
    const combatEvents = events.filter(event => 'tick' in event);
    assert.equal(state.combat.tick, pinned.ticks);
    assert.equal(state.combat.result, pinned.result);
    assert.equal(combatEvents.length, pinned.events);
    assert.equal(digestContent(state.combat), pinned.stateHash);
    assert.equal(digestContent(combatEvents), pinned.eventHash);
    const hashes = Object.fromEntries(Object.entries({ state: step => step.state,
      events: step => step.events, rng: step => randomState(step.state) })
      .map(([key, project]) => [key, createHash('sha256').update(JSON.stringify(steps.map(project))).digest('hex')]));
    const result = { contentDigest: initial.contentDigest, lootReplayDigest: initial.m8.loot.frozen.replayDigest,
      rulesVersion: initial.rulesVersion, schemaVersion: initial.schemaVersion,
      previousContentDigest: previous.contentDigest, previousLootReplayDigest: previous.lootReplayDigest,
      traceHashes: hashes,
      reason: 'R3/R4 release after standalone T13-A: random loot, consumable schema/content including SR-C18 text and targetKind; canonical burn refresh preserves save fractional damage. Full traces intentionally differ; first combat remains pinned.' };
    fs.writeFileSync('tests/t13-content-baseline.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
