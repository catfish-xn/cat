/** Run after npm run build:server. No TS loader, Vite or browser runtime. */
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

async function main() {
  assert.equal(process.versions.node.split('.')[0], '22', 'T2 acceptance requires Node 22.x');
  for (const name of ['window', 'document', 'navigator', 'Phaser']) {
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`Browser global: ${name}`); } });
  }
  Math.random = () => { throw new Error('Implicit RNG'); };
  Date.now = () => { throw new Error('Implicit clock'); };
  const rules = await import(pathToFileURL(path.resolve(__dirname, '../dist-server/index.mjs')).href);
  // Valid combat assets at 2-1; this fixture is not a restoreable whole-Match history.
  const snapshot = (seatId, starLevel) => {
    const base = rules.createMatch(42);
    return rules.snapshotForBattle({
      ...base, round: 4, roundDefinitionId: '2-1',
      preparation: { ...base.preparation, units: [{
        id: 'unit-1', definitionId: 'maddie', starLevel, team: 'player',
        location: { kind: 'board', cell: { col: 3, row: 4 } },
      }] },
    }, seatId);
  };
  const input = rules.compileBattle(snapshot('A', 3), snapshot('B', 1), 42, { battleId: 'node-t2-smoke' });
  const result = rules.resolveTwoSidedBattle(input, 1200);
  assert.equal(result.winnerSeatId, 'A');
  assert.equal(result.terminal.tick, 88);
  assert.deepEqual(result.a.survivors, [{ unitId: 'unit-1', definitionId: 'maddie', starLevel: 3, hp: 1380 }]);
  assert.deepEqual(result.b.survivors, []);
  assert.equal(result.terminal.rngDraws, 8);
  assert.equal(rules.proposeSettlement(result).b.damage, 3);
  assert.deepEqual(rules.resolveTwoSidedBattle(input, 1200), result);
  assert.deepEqual(rules.resolveTwoSidedBattle(rules.restoreBattleInput(JSON.stringify(input)), 1200), result);
  assert.throws(() => rules.resolveTwoSidedBattle(input, 1), error => error.reason === 'step-limit-exceeded');
  console.log(JSON.stringify({ node: process.version, battleId: result.battleId, winner: result.winnerSeatId,
    tick: result.terminal.tick, events: result.events.length, checks: 'oracle, deterministic replay, restore, budget, pure Node' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
