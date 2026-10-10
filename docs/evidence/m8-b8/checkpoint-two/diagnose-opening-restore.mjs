/** Public-command-only opening diagnostic.
 * Original invocation was an unsaved stdin script; its stdout was not written
 * to a raw log and its concurrently edited source tree was not fingerprinted.
 * This persisted copy is not a claim of a fixed-SHA successful run.
 * Run from repository root after fixing the source commit and capture the real
 * stdout/stderr, exit status, HEAD/tree, and before/after source fingerprints.
 * Never inject or edit Match resources, combat state, receipts or provenance.
 */
import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
try {
  const api = await server.ssrLoadModule('/src/simulation/match.ts');
  const { restoreMatch } = await server.ssrLoadModule('/src/simulation/serialization.ts');
  let s = api.createMatch(42), checks = 0;
  const check = () => { restoreMatch(s); checks++; };
  const accept = result => {
    if (!result.ok) throw Error(result.reason);
    s = result.state;
    check();
    return result.events;
  };
  check();
  for (let round = 1; round <= 3; round++) {
    const before = s.nextUnitSerial;
    let events = accept(api.startMatchCombat(s));
    while (s.phase === 'combat') {
      const result = api.stepMatch(s);
      s = result.state;
      events.push(...result.events);
      check();
    }
    console.log(JSON.stringify({
      round: s.roundDefinitionId, phase: s.phase,
      beforeUnitSerial: before, afterUnitSerial: s.nextUnitSerial,
      lootEvents: events.filter(event => event.type.startsWith('loot')),
      players: s.preparation.units.filter(unit => unit.team === 'player').map(unit => [unit.id, unit.definitionId]),
    }));
    while (s.phase === 'choice') {
      const choice = s.pendingChoice;
      accept(api.selectChoice(s, choice.choiceId, choice.generation, choice.offers[0]));
    }
    accept(api.nextRound(s, s.round));
    if (round < 3) {
      const unit = s.preparation.units.find(unit => unit.team === 'player' && unit.location.kind === 'bench');
      if (unit) accept(api.deployMatchUnit(s, unit.id, { kind: 'board', cell: { col: round === 1 ? 3 : 5, row: 7 } }));
    }
  }
  console.log(JSON.stringify({ checks, round: s.roundDefinitionId, phase: s.phase, gold: s.gold, items: s.items.map(item => item.definitionId) }));
} finally {
  await server.close();
}
