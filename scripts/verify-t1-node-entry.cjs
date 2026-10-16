const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/t1-node-entry');
const baseline = require('../tests/t1-probe-baseline.json');
const deploymentBaseline = require('../tests/t1-deployment-baseline.json');
const t10Baseline = require('../tests/t10-content-baseline.json');
const t11Baseline = require('../tests/t11-content-baseline.json');
const t12Baseline = require('../tests/t12-content-baseline.json');
const t13Baseline = require('../tests/g2-augments-content-baseline.json');
const currentBaseline = require('../tests/g2-3-content-baseline.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const load = file => import(pathToFileURL(file).href);
const randomState = state => ({
  seed: state.seed, shop: state.rngState, choice: state.choiceRngState,
  reward: state.rewardRngState, battleSeed: state.battleSeedRngState,
  equipment: state.equipmentState.equipment, reforge: state.reforgeState,
  layout: state.m8.loot.layoutBinding.mode === 'solo' ? state.m8.loot.layoutBinding.layout.rng : null, loot: state.m8.loot.frozen.rng,
  combat: state.combat ? { state: state.combat.rngState, draws: state.combat.rngDraws } : null,
});

function battle(api) {
  const initial = api.createMatch(baseline.seed);
  const start = api.startMatchCombat(initial);
  assert.equal(start.ok, true);
  const steps = [start], events = [...start.events];
  let state = start.state;
  while (state.phase === 'combat') {
    assert(steps.length <= 1201, 'reference battle exceeded its caller budget');
    const next = api.stepMatch(state);
    state = next.state; steps.push(next); events.push(...next.events);
  }
  return { initial, state, events, steps };
}

function unchanged(api, state, command, reason) {
  const before = structuredClone(state), rng = structuredClone(randomState(state));
  const result = command(state);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.equal(result.state, state, 'failed command must return the original object');
  assert.equal(Object.hasOwn(result, 'events'), false);
  assert.deepStrictEqual(state, before);
  assert.deepStrictEqual(randomState(state), rng);
  assert.equal(api.serializeMatch(state), api.serializeMatch(before));
}

async function worker() {
  for (const name of ['window', 'document', 'indexedDB', 'localStorage', 'WebSocket']) {
    // Node 22+ may supply WebSocket/localStorage; deliberately remove them too.
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`browser global: ${name}`); } });
  }
  Math.random = () => { throw new Error('implicit randomness'); };
  Date.now = () => { throw new Error('wall clock'); };
  const api = await load(path.join(root, 'dist-server/index.mjs'));
  const reference = await load(path.join(out, 'browser-reference.mjs'));
  const expectedExports = [
    'releaseCarouselParticipant','completeCarouselForSeat','releaseCarouselSeat','resolvePendingCarouselUnits','sellPendingCarouselUnit','createCarouselMatch','opensCarousel','schedule','prepareCarouselParticipants','createCarousel','pickFromCarousel','autoPickFromCarousel','advanceCarousel','grantCarouselPick','pickCarouselForSeat','autoPickCarouselForSeat','listCarouselSlots','restoreCarouselSeat','restoreCarousel','validateCarousel','CAROUSEL_RULES','CAROUSEL_COST_ODDS',
    'previewRoundEconomy', 'summarizeBattle',
    'advanceMultiplayerRound', 'toPrivateSeatView', 'toCombatViewState', 'toCombatViewEvents', 'toCombatReplay', 'startCombatReplay',
    'applyCombatReplayTick', 'COMBAT_REPLAY_KEYFRAME_INTERVAL',
    'decideBotAction', 'BOT_POLICY_VERSION', 'BOT_MAX_STEPS',
    'CONSUMABLE_DEFINITIONS', 'createMatch', 'deployMatchUnit', 'autoDeployToCap', 'lockMatchCombatRoster', 'buyUnit', 'sellUnit', 'setShopLock', 'rerollShop', 'buyXp',
    'startMatchCombat', 'stepMatch', 'nextRound', 'combineItems', 'equipItem',
    'useConsumable', 'previewUseConsumable', 'createOrbLayout', 'freezeOrbLayoutThroughRound', 'freezeLootThroughRound', 'readComponentEquivalent',
    'selectAnomalyTarget', 'rerollAnomaly', 'selectChoice', 'getDeploymentCap',
    'validateMatchDeployment', 'matchStartFailure', 'needsAnomalyRecruitment', 'serializeMatch', 'restoreMatch',
    'snapshotForBattle', 'restorePlayerBattleSnapshot', 'compileBattle', 'restoreBattleInput',
    'startTwoSidedBattle', 'startTwoSidedCombat', 'startTwoSidedCombatWithEvents', 'resolveTwoSidedBattle', 'proposeSettlement',
    'stepCombat', 'PLAYER_BATTLE_SNAPSHOT_VERSION', 'TWO_SIDED_BATTLE_VERSION', 'BattleValidationError',
    'createSharedPool', 'initializeSharedSeat', 'generateSharedShop', 'buySharedUnit', 'rerollSharedShop',
    'setSharedShopLock', 'sellSharedUnit', 'releaseSeatOnElimination', 'refreshSharedShops', 'nextSharedRound',
    'runSharedMatchCommand', 'assertSharedPoolConservation', 'SHARED_POOL_VERSION', 'POOL_CAPACITY_BY_COST',
    'applyRoundSettlement', 'enableMultiplayerSettlement', 'ROUND_SETTLEMENT_VERSION', 'forfeitPendingChoice', 'claimOrDiscardLoot',
  ];
  assert.deepStrictEqual(Object.keys(api).sort(), expectedExports.sort());
  const actual = battle(api), expected = battle(reference);
  assert.equal(actual.steps.length, expected.steps.length);
  const traceHashes = {};
  const originalStateTraceHash = baseline.traceHashes.state;
  assert.equal(currentBaseline.previousContentDigest,require('../tests/opening-random-content-baseline.json').contentDigest);
  assert.notEqual(currentBaseline.contentDigest,t13Baseline.contentDigest);
  assert.equal(actual.initial.contentDigest,currentBaseline.contentDigest);
  assert.notEqual(actual.initial.contentDigest, t12Baseline.contentDigest);
  assert.equal(t12Baseline.previousContentDigest, t11Baseline.contentDigest);
  assert.equal(actual.initial.m8.loot.frozen.replayDigest,currentBaseline.lootReplayDigest);
  assert.notEqual(actual.initial.m8.loot.frozen.replayDigest, t11Baseline.lootReplayDigest);
  assert.equal(t11Baseline.previousContentDigest, t10Baseline.contentDigest);
  assert.equal(t10Baseline.previousContentDigest, deploymentBaseline.contentDigest);
  for (const [key, project] of Object.entries({
    state: step => step.state, events: step => step.events, rng: step => randomState(step.state),
  })) {
    // Compare actual UTF-8 bytes, including start and every tick; hashes are only report summaries.
    const nodeBytes = Buffer.from(JSON.stringify(actual.steps.map(project)));
    const browserBytes = Buffer.from(JSON.stringify(expected.steps.map(project)));
    assert(nodeBytes.equals(browserBytes), `${key} trace differs from browser-target source bundle`);
    traceHashes[key] = sha256(nodeBytes);
    assert.equal(traceHashes[key],currentBaseline.traceHashes[key],`pinned G23 ${key} trace`);
    // T13 changes opening reward content, Match schema and random streams.
    // Preserve prior baselines; do not normalize away actual gameplay differences.
    assert.notEqual(traceHashes[key], baseline.traceHashes[key], `T13 ${key} must record the signed change`);
  }
  const combatEvents = actual.events.filter(event => 'tick' in event);
  const summary = { seed: baseline.seed, ticks: actual.state.combat.tick, events: combatEvents.length,
    result: actual.state.combat.result, stateHash: reference.digestContent(actual.state.combat),
    eventHash: reference.digestContent(combatEvents) };
  const probe = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/server-authority-audit/report.json'), 'utf8'));
  for (const [key, value] of Object.entries(summary)) {
    assert.equal(value, currentBaseline.firstBattle[key], `pinned G23 first battle: ${key}`);
    if(key === 'seed') assert.equal(value, baseline[key], `original probe seed: ${key}`);
    assert.equal(value, probe[key], `unmodified probe rerun: ${key}`);
  }

  unchanged(api, actual.initial, state => api.buyUnit(state, 0, state.shop.generation - 1), 'stale-shop');
  assert.equal(actual.initial.gold, 0); // A legitimate opening, not a fabricated insufficient-gold state.
  unchanged(api, actual.initial, state => api.buyUnit(state, 0, state.shop.generation), 'insufficient-gold');
  unchanged(api, actual.initial, state => api.rerollShop(state), 'insufficient-gold');
  unchanged(api, actual.initial, state => api.buyXp(state), 'insufficient-gold');
  unchanged(api, actual.steps[0].state, state => api.buyUnit(state, 0, state.shop.generation), 'wrong-phase');

  const checkpointIndex = actual.steps.findIndex(step => step.state.combat.tick === 40);
  assert(checkpointIndex > 0);
  const checkpoint = actual.steps[checkpointIndex].state;
  const save = api.serializeMatch(checkpoint);
  for (const input of [save, JSON.parse(save)]) {
    let restored = api.restoreMatch(input);
    assert.deepStrictEqual(restored, checkpoint);
    for (const expectedStep of actual.steps.slice(checkpointIndex + 1)) {
      const next = api.stepMatch(restored);
      assert.deepStrictEqual(next, expectedStep, 'restored continuation state/events differ');
      assert.deepStrictEqual(randomState(next.state), randomState(expectedStep.state));
      restored = next.state;
    }
    assert.deepStrictEqual(restored, actual.state);
    assert.equal(api.serializeMatch(restored), api.serializeMatch(actual.state));
  }
  for (const patch of [{ contentDigest: 'forged' }, { schemaVersion: 'unsupported' }]) {
    assert.throws(() => api.restoreMatch({ ...checkpoint, ...patch }), /Invalid Match save:/);
  }
  assert.throws(() => api.createMatch(-1), /uint32/);
  const terminal = api.stepMatch(actual.state);
  assert.equal(terminal.state, actual.state);
  assert.deepStrictEqual(terminal.events, []);
  fs.writeFileSync(path.join(out, 'node-terminal.json'), JSON.stringify({ state: actual.state, events: actual.events }));
  return { ...summary, traceHashes, originalStateTraceHash, t13Identity: {contentDigest:actual.initial.contentDigest,lootReplayDigest:actual.initial.m8.loot.frozen.replayDigest,rulesVersion:actual.initial.rulesVersion,schemaVersion:actual.initial.schemaVersion}, deploymentBaseline, t10Baseline, t11Baseline, t12Baseline, comparedStates: actual.steps.length, exports: expectedExports,
    unchangedFailures: ['stale-shop', 'insufficient-gold (buy/reroll/XP)', 'wrong-phase'],
    restoreTick: 40, restoreTextAndObject: true, rejectedBadDigestAndVersion: true,
    browserGlobalsAndImplicitClockAndRandomBlocked: true };
}

async function main() {
  if (process.argv.includes('--worker')) { console.log(JSON.stringify(await worker())); return; }
  fs.mkdirSync(out, { recursive: true });
  // Preserve the original probe as an independent regression anchor; do not modify its source.
  execFileSync(process.execPath, ['scripts/verify-server-engine-portability.cjs'], { cwd: root, timeout: 60000 });
  await require('esbuild').build({ absWorkingDir: root, entryPoints: ['tests/t1-browser-reference.ts'],
    outfile: path.join(out, 'browser-reference.mjs'), bundle: true, platform: 'browser',
    target: 'es2022', format: 'esm', logLevel: 'error' });
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'dist-server/metafile.json'), 'utf8'));
  const inputs = Object.keys(meta.inputs).sort();
  assert(inputs.includes('src/server-entry/index.ts'));
  assert(inputs.includes('src/simulation/match.ts'));
  for (const input of inputs) {
    assert(!/src\/(rendering|presentation|persistence|replay|server)\/|node_modules\/phaser\//.test(input), input);
    assert(/^(src\/(simulation|server-entry)\/|scripts\/run-server-battle.mjs$)/.test(input), `unexpected input: ${input}`);
  }
  for (const output of Object.values(meta.outputs)) {
    assert(output.imports.every(item => !item.external), 'production artifact must have no external packages');
  }
  const result = JSON.parse(execFileSync(process.execPath, [__filename, '--worker'], { cwd: root, encoding: 'utf8', timeout: 60000 }));
  // Copy only the deployable directory: no source tree, node_modules, Vite or browser.
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 't1-node-entry-'));
  try {
    fs.cpSync(path.join(root, 'dist-server'), isolated, { recursive: true });
    const cli = path.join(isolated, 'run-battle.mjs');
    const run = args => spawnSync(process.execPath, [cli, ...args], { cwd: isolated, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    const success = run(['--seed', '42', '--max-steps', '164', '--snapshot']);
    assert.equal(success.status, 0, success.stderr);
    const cliResult = JSON.parse(success.stdout);
    assert.equal(cliResult.steps, 164);
    assert.deepStrictEqual({ state: cliResult.state, events: cliResult.events }, JSON.parse(fs.readFileSync(path.join(out, 'node-terminal.json'), 'utf8')));
    for (const args of [[], ['--seed', '42', '--max-steps', '163'], ['--seed', '-1', '--max-steps', '164']]) {
      const failure = run(args);
      assert.equal(failure.status, 1);
      assert.equal(failure.stdout, '');
      assert.match(failure.stderr, /Usage:|step-limit-exceeded/);
    }
  } finally { fs.rmSync(isolated, { recursive: true, force: true }); }
  const report = { passed: true, node: process.version, ...result, cliSnapshotMatches: true,
    cliBudgetEnforced: true, inputCount: inputs.length, bundledInputs: inputs,
    comparison: 'UTF-8 Buffer.equals of all start/tick states, event batches and RNG; pinned probe FNV hashes; deepStrictEqual on every restored continuation step',
    scope: 'seed 42 existing first battle; browser-target bundle executed in ordinary Node, not a live browser or multiplayer acceptance' };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, bundledInputs: undefined, exports: undefined, report: 'artifacts/t1-node-entry/report.json' }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
