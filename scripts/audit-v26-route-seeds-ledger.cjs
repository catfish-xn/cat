#!/usr/bin/env node
/* Capture exact Ledger.apply context when independent audit fails. */
const path = require('node:path');
const { createServer } = require('vite');
const { Ledger } = require('../tests/fixtures/m5/oracle.g2.cjs');

const seed = Number(process.argv[2] ?? 4097);
const build = process.argv[3] ?? 'cannon';

const origApply = Ledger.prototype.apply;
Ledger.prototype.apply = function (before, after, command, events) {
  try {
    return origApply.call(this, before, after, command, events);
  } catch (error) {
    error.ledgerContext = {
      command,
      before: {
        round: before.round,
        roundDefinitionId: before.roundDefinitionId,
        phase: before.phase,
        level: before.level,
        xp: before.xp,
        augments: before.augments?.map((a) => a.definitionId),
      },
      after: {
        round: after.round,
        roundDefinitionId: after.roundDefinitionId,
        phase: after.phase,
        level: after.level,
        xp: after.xp,
      },
      eventTypes: events?.map((e) => e.type),
    };
    throw error;
  }
};

async function main() {
  const server = await createServer({
    root: path.resolve(__dirname, '..'),
    configFile: false,
    cacheDir: 'artifacts/shopport/vite-cache',
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { run } = require('./generate-m5-route.cjs');
    await run(api, { build, seed });
    console.log(JSON.stringify({ seed, ok: true }));
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          seed,
          ok: false,
          message: error.message.split('\n')[0],
          ledgerContext: error.ledgerContext,
          assertion: error.actual !== undefined ? { actual: error.actual, expected: error.expected } : undefined,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    Ledger.prototype.apply = origApply;
    await server.close();
  }
}

main();
