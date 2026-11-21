#!/usr/bin/env node
/* Reproduce independentAudit failures on generate-m5-route for given seeds.
 * Does not modify generate-m5-route.cjs or oracle fixtures. */
const path = require('node:path');
const { createServer } = require('vite');

const SEEDS = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
if (!SEEDS.length) SEEDS.push(4097, 4105, 4144);

async function loadApi() {
  const server = await createServer({
    root: path.resolve(__dirname, '..'),
    configFile: false,
    cacheDir: 'artifacts/shopport/vite-cache',
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  });
  try {
    return { api: await server.ssrLoadModule('/src/simulation/match.ts'), close: () => server.close() };
  } catch (e) {
    await server.close();
    throw e;
  }
}

async function auditSeed(api, seed, build = 'cannon') {
  const { run } = require('./generate-m5-route.cjs');
  const { shopTransition } = require('../tests/fixtures/m5/oracle.g2.cjs');
  let lastCommand = null;
  let lastBefore = null;
  const trace = [];
  let failingBefore = null;
  let failingCommand = null;
  try {
    await run(api, {
      build,
      seed,
      onStep(before, result, command) {
        lastBefore = before;
        lastCommand = command;
        failingBefore = before;
        failingCommand = command;
        if (command) {
          trace.push({
            index: trace.length,
            round: before.round,
            roundDefinitionId: before.roundDefinitionId,
            phase: before.phase,
            command,
            gold: before.gold,
            level: before.level,
            xp: before.xp,
          });
        }
      },
    });
    return { seed, build, ok: true };
  } catch (error) {
    const snap = failingBefore ?? lastBefore;
    const cmd = failingCommand ?? lastCommand;
    const ctx = snap
      ? {
          round: lastBefore.round,
          roundDefinitionId: lastBefore.roundDefinitionId,
          phase: lastBefore.phase,
          gold: lastBefore.gold,
          level: lastBefore.level,
          xp: lastBefore.xp,
        }
      : null;
    let shopDiff = null;
    if (
      snap &&
      cmd &&
      error.message?.includes('shop') &&
      shopTransition
    ) {
      try {
        const expected = shopTransition(snap, cmd);
        shopDiff = { expectedShop: expected.shop, expectedRng: expected.rngState };
      } catch {
        shopDiff = { note: 'shopTransition threw' };
      }
    }
    return {
      seed,
      build,
      ok: false,
      message: error.message,
      assertion: error.code === 'ERR_ASSERTION' ? { actual: error.actual, expected: error.expected, operator: error.operator } : undefined,
      stackTop: error.stack?.split('\n').slice(0, 8),
      atCommand: cmd,
      atState: ctx,
      recentCommands: trace.slice(-5),
      shopDiff,
    };
  }
}

async function main() {
  const { api, close } = await loadApi();
  try {
    const results = [];
    for (const seed of SEEDS) {
      process.stderr.write(`auditing seed ${seed}...\n`);
      results.push(await auditSeed(api, seed));
    }
    console.log(JSON.stringify({ seeds: SEEDS, results }, null, 2));
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
