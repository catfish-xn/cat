/* Compare real pre-release code with regenerated current fixtures. No restore bypass.
 * Export 66395eb to --baseline-root (and link node_modules) before running.
 * --write recompiles C19; Herald must first be recorded by its original script. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2), baselineRoot = args.find(a => a.startsWith('--baseline-root='))?.slice(16);
assert(baselineRoot && args.every(a => a === '--write' || a.startsWith('--baseline-root=')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = value => Buffer.from(JSON.stringify(value));
const compare = (old, current, label) => {
  const before = bytes(old), after = bytes(current);
  assert(before.equals(after), label);
  return { beforeSha256: sha(before), afterSha256: sha(after), bytes: before.length, byteEqual: true };
};
const read = (directory, file) => JSON.parse(fs.readFileSync(path.join(directory, file)));
async function main() {
  const { createServer } = await import('vite');
  const servers = [];
  try {
    for (const directory of [baselineRoot, root]) servers.push(await createServer({ root: directory,
      configFile: false, server: { middlewareMode: true, ws: false }, appType: 'custom', logLevel: 'error' }));
    const [oldServer, currentServer] = servers;
    // Bind the exported baseline simulation to the real Git revision, not a patched validator.
    const baselineCommit = execFileSync('git', ['rev-parse', '66395eb'], { cwd: root, encoding: 'utf8' }).trim();
    const sourceFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', baselineCommit, 'src/simulation'],
      { cwd: root, encoding: 'utf8' }).trim().split('\n');
    for (const file of sourceFiles) assert(fs.readFileSync(path.join(baselineRoot, file)).equals(
      execFileSync('git', ['show', `${baselineCommit}:${file}`], { cwd: root })), `Baseline source: ${file}`);
    const oldBattle = await oldServer.ssrLoadModule('/src/simulation/two-sided-battle.ts');
    const currentBattle = await currentServer.ssrLoadModule('/src/simulation/two-sided-battle.ts');
    const oldContent = await oldServer.ssrLoadModule('/src/simulation/content/index.ts');
    const content = await currentServer.ssrLoadModule('/src/simulation/content/index.ts');
    const oldLoot = await oldServer.ssrLoadModule('/src/simulation/loot-freeze.ts');
    const loot = await currentServer.ssrLoadModule('/src/simulation/loot-freeze.ts');
    const identities = [[oldContent.CONTENT_DIGEST, content.CONTENT_DIGEST],
      [oldLoot.LOOT_REPLAY_DIGEST, loot.LOOT_REPLAY_DIGEST],
      ['s13-rules-gap-v1', 's13-rules-gap-v2'], ['s13-14.24b-rules-gap-v1', 's13-14.24b-rules-gap-v2']];
    const normalize = value => JSON.parse(JSON.stringify(value), (_, v) => identities.find(([old]) => old === v)?.[1] ?? v);
    const file = 'tests/fixtures/c19-seed-9-minimal.json', original = read(baselineRoot, file);
    const compiled = currentBattle.compileBattle({ ...original.a, contentDigest: content.CONTENT_DIGEST },
      { ...original.b, contentDigest: content.CONTENT_DIGEST }, original.battleSeed,
      { battleId: original.battleId, mirrorOfSeatId: original.mirrorOfSeatId ?? undefined });
    const compiledComparison = compare(normalize(original), compiled, 'Entire recompiled input except identity');
    const before = oldBattle.resolveTwoSidedBattle(original, 5000), after = currentBattle.resolveTwoSidedBattle(compiled, 5000);
    const pulses = result => result.events.filter(e => e.type === 'packetDamage' && e.outcome.context.damageType === 'true');
    const c19 = { roundId: original.a.roundId, battleSeed: original.battleSeed,
      oldFixtureSha256: sha(fs.readFileSync(path.join(baselineRoot, file))),
      newFixtureSha256: sha(Buffer.from(JSON.stringify(compiled, null, 2) + '\n')),
      compiledComparison, terminal: compare(before.terminal, after.terminal, 'C19 terminal, without normalization'),
      events: compare(before.events, after.events, 'C19 events, without normalization'),
      pulses: compare(pulses(before), pulses(after), 'C19 burn packets, without normalization'),
      terminalTick: after.terminal.tick, terminalResult: after.terminal.result,
      eventCount: after.events.length, pulseCount: pulses(after).length,
      pulseCountsByTarget: Object.fromEntries([...new Set(pulses(after).map(e => e.outcome.context.targetId))]
        .map(id => [id, pulses(after).filter(e => e.outcome.context.targetId === id).length])) };
    assert.equal(c19.roundId, '6-1'); assert.equal(c19.terminalTick, 244); assert.equal(c19.pulseCount, 15);
    if (args.includes('--write')) fs.writeFileSync(path.join(root, file), JSON.stringify(compiled, null, 2) + '\n');
    else assert.deepEqual(read(root, file), compiled);
    const heraldDirectory = 'tests/fixtures/t13-herald-raw';
    const previousTrace = read(baselineRoot, `${heraldDirectory}/trajectory.json`);
    const currentTrace = read(root, `${heraldDirectory}/trajectory.json`);
    // State hashes include release identity. Keep every command/event/result/tick field.
    const traceProjection = trace => JSON.parse(JSON.stringify(trace), (key, value) =>
      ['rawPrefixSha256', 'beforeHash', 'afterHash', 'stateHash', 'beforeSha256', 'afterSha256',
        'startSha256', 'resultSha256', 'rawStateSha256'].includes(key) ? undefined : value);
    const trajectory = compare(traceProjection(previousTrace), traceProjection(currentTrace), 'Herald ordinary command/event trajectory');
    const oldApi = await oldServer.ssrLoadModule('/src/simulation/match.ts');
    const currentApi = await currentServer.ssrLoadModule('/src/simulation/match.ts');
    const oldSer = await oldServer.ssrLoadModule('/src/simulation/serialization.ts');
    const currentSer = await currentServer.ssrLoadModule('/src/simulation/serialization.ts');
    const manifest = read(root, `${heraldDirectory}/manifest.json`), cases = [];
    for (const entry of manifest.cases) {
      const prior = read(baselineRoot, `${heraldDirectory}/${entry.file}`), candidate = read(root, `${heraldDirectory}/${entry.file}`);
      const raw = compare(normalize(prior), candidate, `${entry.name} complete raw preparation`);
      let oldStart = oldApi.startMatchCombat(oldSer.restoreMatch(prior)), newStart = currentApi.startMatchCombat(currentSer.restoreMatch(candidate));
      assert(oldStart.ok && newStart.ok);
      const start = compare(normalize(oldStart), newStart, `${entry.name} complete start`);
      const oldTicks = [], newTicks = [];
      for (let tick = 0; tick < 15; tick++) {
        oldStart = oldApi.stepMatch(oldStart.state); newStart = currentApi.stepMatch(newStart.state);
        oldTicks.push(oldStart); newTicks.push(newStart);
      }
      cases.push({ name: entry.name, raw, start, firstFifteenTicks: compare(normalize(oldTicks), newTicks, `${entry.name} 15 complete steps`),
        rawSha256: entry.rawSha256, commands: entry.publicCommands, battles: entry.battles, ticks: entry.ticks });
    }
    const evidence = { baselineCommit, baselineSimulationFilesVerified: sourceFiles.length, identityReplacements: identities,
      c19, herald: { recordingCommand: 'node scripts/verify-m8-herald-fixtures.cjs --write',
        trajectory, prefixBattles: previousTrace.prefix.battles.length,
        branchBattles: currentTrace.branches.reduce((n, b) => n + b.battles.length, 0), cases } };
    const evidenceFile = path.join(root, 'docs/evidence/p3p4p5/fixture-migration.json');
    const output = JSON.stringify(evidence, null, 2) + '\n';
    if (args.includes('--write')) fs.writeFileSync(evidenceFile, output);
    else assert.equal(fs.readFileSync(evidenceFile, 'utf8'), output);
    console.log(JSON.stringify(evidence));
  } finally { for (const server of servers) await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
