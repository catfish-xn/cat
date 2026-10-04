/* Offline simulator only. Browser tests use its immutable expectations, never its commands on the page. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { expectedCommand, expectedRound, COST } = require('../tests/fixtures/m3/oracle.cjs');

module.exports = async function createFixtures() {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), server: { middlewareMode: true }, appType: 'custom' });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    function makeRun(name) {
      let state = api.createMatch(42);
      const initial = state, rounds = [], commands = [], allEvents = [];
      function command(cmd, annotation) {
        const before = state;
        const result = cmd.type === 'buy' ? api.buyUnit(state, cmd.slot, cmd.generation)
          : cmd.type === 'sell' ? api.sellUnit(state, cmd.id)
          : cmd.type === 'deploy' ? api.deployMatchUnit(state, cmd.id, cmd.target)
          : cmd.type === 'reroll' ? api.rerollShop(state) : api.buyXp(state);
        assert.deepEqual(result, expectedCommand(before, cmd), `offline ledger: ${JSON.stringify(cmd)}`);
        assert(result.ok, `offline accepted: ${JSON.stringify(cmd)} ${result.reason}`);
        state = result.state;
        const entry = { command: cmd, annotation, before, after: state, events: result.events };
        commands.push(entry); return entry;
      }
      function buy(slot, annotation) { return command({ type: 'buy', slot, generation: state.shop.generation }, annotation); }
      function deploy(id, col, row = 4, annotation) { return command({ type: 'deploy', id, target: { kind: 'board', cell: { col, row } } }, annotation); }
      function battle(preparationActions) {
        const before = state, started = api.startMatchCombat(state); assert(started.ok); state = started.state;
        const atTick = new Map([[0, state]]), events = [];
        while (state.phase === 'combat') { const step = api.stepMatch(state); state = step.state; atTick.set(state.combat.tick, state); events.push(...step.events); }
        assert.deepEqual(state.roundResults.at(-1), expectedRound(before, state.combat));
        allEvents.push(...events);
        const settled = state;
        if (state.phase === 'settlement') { const next = api.nextRound(state, state.round); assert(next.ok); state = next.state; }
        rounds.push({ round: before.round, preparationActions, before, started: atTick.get(0), atTick, events, settled, continued: state });
      }
      if (name === 'growth') {
        let ops = [];
        ops.push(buy(0, 'initial-two-star'), buy(1), buy(2));
        ops.push(deploy('unit-1', 1), deploy('unit-2', 3), deploy('unit-3', 5));
        battle(ops);
        ops = [];
        ops.push(command({ type: 'reroll' }, 'fast-chain-1-start'));
        ops.push(buy(0, 'fast-third-card'));
        ops.push(command({ type: 'buyXp' }, 'F-level-up'));
        ops.push(deploy('unit-7', 1, 5, 'fourth-population'));
        ops.push(command({ type: 'reroll' }));
        ops.push(buy(1, 'fast-buy-higher-cost'));
        ops.push(command({ type: 'sell', id: 'unit-10' }));
        ops.push(command({ type: 'reroll' }, 'fast-chain-1-end'));
        ops.push(command({ type: 'sell', id: 'unit-5' }), command({ type: 'sell', id: 'unit-3' }));
        ops.push(buy(0, 'new-tier-three-cost'), deploy('unit-11', 5, 5, 'three-cost-on-board'));
        battle(ops);
        battle([]);
        for (let cycle = 2; cycle <= 3; cycle++) {
          ops = [command({ type: 'reroll' }, `fast-chain-${cycle}-start`), command({ type: 'buyXp' })];
          const slot = state.shop.slots.findIndex(o => o.status === 'available' && COST[o.definitionId] <= state.gold);
          assert(slot >= 0);
          const id = `unit-${state.nextUnitSerial}`;
          ops.push(buy(slot));
          assert(state.preparation.units.some(u => u.id === id), 'Fast-cycle purchase must not merge before E');
          ops.push(command({ type: 'sell', id }, `fast-chain-${cycle}-end`));
          battle(ops);
        }
        ops = [];
        const slot = state.shop.slots.findIndex(o => o.status === 'available' && COST[o.definitionId] >= 2 && COST[o.definitionId] <= state.gold);
        assert(slot >= 0); const id = `unit-${state.nextUnitSerial}`; ops.push(buy(slot), deploy(id, 3, 6)); battle(ops);
        battle([]); battle([]);
        assert.equal(state.phase, 'preparation'); assert.equal(state.round, 9);
        assert(rounds.some(r => r.settled.combat.result === 'playerWin'));
        assert(rounds.some(r => r.settled.combat.result === 'enemyWin'));
        assert(allEvents.some(e => e.type === 'cast' && e.abilityId === 'arcanist-burst'));
        assert(allEvents.some(e => e.type === 'damage' && e.absorbed > 0));
      } else {
        let ops = [deploy('unit-2', 3, 7)];
        while (state.phase !== 'gameOver' && state.round <= 20) { battle(ops); ops = []; }
        assert.equal(state.phase, 'gameOver');
        assert(rounds.some(r => r.settled.combat.result === 'enemyWin' && r.before.preparation.units.some(u => u.team === 'player' && u.location.kind === 'board')));
      }
      return { name, initial, commands, rounds, final: state, events: allEvents };
    }
    return { growth: makeRun('growth'), terminal: makeRun('terminal') };
  } finally { await server.close(); }
};
if (require.main === module) module.exports().then(runs => {
  for (const run of Object.values(runs)) console.log(JSON.stringify({ path: run.name, commands: run.commands.length, rounds: run.rounds.map(r => ({ round: r.round, result: r.settled.combat.result, tick: r.settled.combat.tick, gold: r.settled.gold, level: r.settled.level, xp: r.settled.xp, hp: r.settled.playerHp })), finalPhase: run.final.phase }, null, 2));
}).catch(error => { console.error(error); process.exitCode = 1; });
