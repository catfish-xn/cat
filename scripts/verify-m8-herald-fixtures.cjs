/* Independently regenerate the five approved Herald restore inputs from public
 * commands. Generation exports raw bytes before serialization.ts is even loaded.
 * Default: regenerate and verify checked-in bytes/metadata; --write: replace the
 * generated files explicitly. Neither mode changes test timeouts or workloads. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'tests/fixtures/m8-herald-raw');
const args = process.argv.slice(2);
const write = args.includes('--write');
const baselineArgument = args.find(argument => argument.startsWith('--baseline-dir='));
const baselineDirectory = baselineArgument?.slice('--baseline-dir='.length);
assert(args.every(argument => argument === '--write' || argument === baselineArgument), 'Unknown argument');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceFiles = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? sourceFiles(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);

async function main() {
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  const started = performance.now();
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { canonicalContent } = await server.ssrLoadModule('/src/simulation/content/index.ts');
    const builder = await server.ssrLoadModule('/tests/fixtures/m8-herald-raw/generate.ts');
    const canonicalHash = value => sha256(canonicalContent(value));
    const files = [...sourceFiles('src/simulation'), 'scripts/verify-m8-herald-fixtures.cjs',
      'scripts/generate-m5-route.cjs', 'scripts/m4-evidence.cjs', 'tests/fixtures/m5/oracle.cjs',
      'tests/fixtures/m8-herald-raw/generate.ts', 'tests/fixtures/m8-neutral-public-route.ts',
      'tests/m8-b7-match-wiring.test.ts'].sort();
    const sources = Object.fromEntries(files.map(file => [file, sha256(fs.readFileSync(path.join(root, file)))]));
    let rawPrefix;
    // Use the unchanged driver, including its independent economy/shop oracle.
    // No restored fixture or saved state is an input to this generation.
    const route = await require('./generate-m5-route.cjs').run(api, { build: 'sniper', seed: 42,
      onStep(before) {
        if (before.roundDefinitionId === '4-4' && before.phase === 'choice') rawPrefix ??= before;
      } });
    assert(rawPrefix && route.final.phase === 'gameOver' && route.final.roundDefinitionId === '6-7'
      && route.final.outcome === 'victory', 'Complete real public acquisition route');
    assert.equal(route.rounds.length, 33, 'Unchanged complete acquisition route battle count');
    const prefixHash = canonicalHash(rawPrefix);
    const prefixTrace = {
      rawPrefixSha256: prefixHash,
      commands: route.actions.filter(action => action.round < rawPrefix.round).map(action => ({
        round: action.round, command: action.command, beforeHash: action.beforeHash, afterHash: action.afterHash,
        eventsSha256: canonicalHash(action.events),
      })),
      battles: route.rounds.filter(battle => battle.round < rawPrefix.round).map(battle => ({
        roundId: battle.roundDefinitionId, result: battle.result, stateHash: battle.stateHash, eventsHash: battle.eventsHash,
      })),
    };
    const generated = [];
    for (const entry of builder.HERALD_RAW_CASES) {
      const commands = [], battles = [];
      let currentBattle;
      const observer = (before, result, operation, commandArgs) => {
        assert.notEqual(result.ok, false, `Rejected public ${operation}`);
        if (operation !== 'stepMatch') commands.push({ roundId: before.roundDefinitionId, operation,
          args: commandArgs, beforeSha256: canonicalHash(before), afterSha256: canonicalHash(result.state),
          eventsSha256: canonicalHash(result.events) });
        if (operation === 'startMatchCombat') {
          currentBattle = { roundId: before.roundDefinitionId, ticks: 0, startSha256: canonicalHash(result.state),
            events: crypto.createHash('sha256') };
        }
        if (operation === 'startMatchCombat' || operation === 'stepMatch') {
          assert(currentBattle, 'Battle trace exists');
          currentBattle.events.update(canonicalContent(result.events)).update('\n');
          if (operation === 'stepMatch') currentBattle.ticks++;
          if (result.state.phase !== 'combat') {
            const { events, ...battle } = currentBattle;
            battles.push({ ...battle, result: result.state.roundResults.at(-1),
              resultSha256: canonicalHash(result.state), eventsSha256: events.digest('hex') });
            currentBattle = undefined;
          }
        }
      };
      const generationStarted = performance.now();
      const rawState = builder.buildRawHeraldEquipment(rawPrefix, entry.definitions, observer);
      assert.equal(canonicalHash(rawPrefix), prefixHash, 'Generator never mutates the shared raw prefix');
      assert.equal(rawState.roundDefinitionId, '6-7');
      assert.equal(rawState.phase, 'preparation');
      assert.equal(battles.length, 14, 'Original 3 stage-four, 6 stage-five and 5 stage-six battles');
      assert.equal(battles.reduce((sum, battle) => sum + battle.ticks, 0), 5844, 'Original full scenario ticks');
      assert.equal(rawState.playerHp, 61); assert.equal(rawState.gold, 229);
      assert.deepEqual(rawState.augmentProgress, { pumpingRounds: 19, investmentHp: 1024 });
      // This is the raw exported input. Neither serializeMatch nor restoreMatch
      // participates in building it, ordering it, granting it or validating it.
      const rawBytes = canonicalContent(rawState) + '\n';
      const trace = { name: entry.name, definitions: [...entry.definitions], commands, battles,
        rawStateSha256: sha256(rawBytes) };
      generated.push({ entry, rawState, rawBytes, trace });
      console.log(JSON.stringify({ phase: 'raw-exported', name: entry.name, battles: battles.length,
        ticks: 5844, rawBytes: Buffer.byteLength(rawBytes), rawSha256: sha256(rawBytes),
        generationMs: performance.now() - generationStarted }));
    }
    // Programmatic boundary: even module evaluation of the production restore
    // implementation must occur strictly after all five raw byte strings exist.
    const graph = server.environments.ssr.moduleGraph;
    assert(![...graph.idToModuleMap.keys()].some(id => id.split('?')[0].endsWith('/src/simulation/serialization.ts')),
      'Serialization must not load before all raw exports');
    assert.equal(generated.length, 5);
    console.log(JSON.stringify({ phase: 'all-raw-exported-before-restore-import', count: generated.length }));
    const { restoreMatch, serializeMatch } = await server.ssrLoadModule('/src/simulation/serialization.ts');
    const validation = [];
    const baselineNames = { 'ionic-spark': 'ionic', evenshroud: 'even', 'ionic-spark--evenshroud': 'dual', quicksilver: 'qss', 'edge-of-night': 'edge' };
    for (const value of generated) {
      const { entry, rawState, rawBytes } = value;
      const rawInput = JSON.parse(rawBytes), before = canonicalContent(rawInput);
      let state = restoreMatch(rawInput);
      assert.notEqual(state, rawInput, 'Restore produces an independent state');
      assert.deepEqual(state, rawState, 'Full regenerated raw state survives production restore unchanged');
      assert.equal(canonicalContent(rawInput), before, 'Restore never mutates raw input');
      const start = api.startMatchCombat(state); assert(start.ok); state = start.state;
      const ticks = [];
      const roundTrip = current => {
        const saved = serializeMatch(current), restored = restoreMatch(saved);
        assert.deepEqual(restored, current); assert.equal(serializeMatch(restored), saved);
        assert.deepEqual(api.stepMatch(restored), api.stepMatch(current));
      };
      roundTrip(state);
      for (let i = 0; i < 15; i++) {
        const step = api.stepMatch(state); ticks.push(step); state = step.state; roundTrip(state);
      }
      if (baselineDirectory) {
        // Optional migration evidence only. Ordinary verify never needs /tmp or
        // an old prepared state, and this state is never used for generation.
        const old = JSON.parse(fs.readFileSync(path.join(baselineDirectory, `baseline-${baselineNames[entry.name]}.json`), 'utf8'));
        assert.deepEqual(rawState, old.prepared, 'Original complete preparation state');
        assert.deepEqual(start, old.start, 'Original complete start state/events');
        assert.deepEqual(ticks, old.ticks, 'Original fifteen full successor state/events');
      }
      validation.push({ name: entry.name, rawStateEqualsRestored: true, startAndFifteenTicksRoundTrip: true,
        ...(baselineDirectory ? { fullOldPreparationStartAndFifteenTicksEqual: true } : {}) });
      console.log(JSON.stringify({ phase: 'production-restore-verified', ...validation.at(-1) }));
    }
    const trace = { generationVersion: builder.HERALD_RAW_GENERATION_VERSION, seed: 42, prefix: prefixTrace,
      branches: generated.map(value => value.trace) };
    const traceBytes = canonicalContent(trace) + '\n';
    const manifest = { generationVersion: builder.HERALD_RAW_GENERATION_VERSION, seed: 42, build: 'sniper',
      format: 'canonical-raw-match-json-before-production-restore', sourceSha256: canonicalHash(sources), sources,
      contentDigest: rawPrefix.contentDigest, schemaVersion: rawPrefix.schemaVersion,
      rulesVersion: rawPrefix.rulesVersion, contentVersion: rawPrefix.contentVersion,
      prefix: { roundId: '4-4', phase: 'choice', rawPrefixSha256: prefixHash },
      fullAcquisitionRoute: { battles: route.rounds.length, ticks: route.summary.ticks, outcome: route.final.outcome },
      traceFile: 'trajectory.json', traceSha256: sha256(traceBytes),
      cases: generated.map(({ entry, rawBytes, trace }) => ({ name: entry.name, definitions: [...entry.definitions],
        file: `${entry.name}.json`, rawSha256: sha256(rawBytes), rawBytes: Buffer.byteLength(rawBytes),
        publicCommands: trace.commands.length, battles: trace.battles.length,
        ticks: trace.battles.reduce((sum, battle) => sum + battle.ticks, 0) })) };
    const outputs = new Map(generated.map(value => [`${value.entry.name}.json`, value.rawBytes]));
    outputs.set('trajectory.json', traceBytes); outputs.set('manifest.json', canonicalContent(manifest) + '\n');
    if (write) {
      for (const [file, bytes] of outputs) fs.writeFileSync(path.join(directory, file), bytes);
    } else {
      for (const [file, bytes] of outputs) assert.equal(fs.readFileSync(path.join(directory, file), 'utf8'), bytes,
        `Regenerated ${file} differs; review the cause before explicitly regenerating with --write`);
    }
    console.log(JSON.stringify({ phase: 'complete', mode: write ? 'write' : 'verify', files: outputs.size,
      cases: validation, sourceSha256: manifest.sourceSha256,
      allRawExportedBeforeRestoreImport: true, elapsedMs: performance.now() - started }));
  } finally { await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
