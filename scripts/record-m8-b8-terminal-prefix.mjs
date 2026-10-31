// Replay the audited terminal routes and store their canonical saves.
// tests/m8-b8-loot-view.test.ts restores these files with restoreMatch, which
// checks each save in full. The independent route ledger stays on.
// Re-record both files with this script after a real rule change.
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createServer} from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  server: {middlewareMode: true, ws: false},
  appType: 'custom',
});
try {
  const fixture = await server.ssrLoadModule('/tests/fixtures/t13-loot-public.ts');
  const {serializeMatch, restoreMatch} = await server.ssrLoadModule('/src/simulation/serialization.ts');
  const store = (name, state) => {
    const text = serializeMatch(state);
    if (serializeMatch(restoreMatch(text)) !== text) throw new Error(`${name} did not round-trip`);
    const out = path.join(root, 'tests/fixtures', name);
    let previous = '';
    try { previous = gunzipSync(readFileSync(out)).toString(); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    if (previous === text) { console.log(`unchanged ${out} (${text.length} canonical bytes)`); return; }
    writeFileSync(out, gzipSync(text));
    console.log(`wrote ${out} (${text.length} canonical bytes)`);
  };
  console.time('2253');
  store('m8-b8-terminal-2253.json.gz', await fixture.terminalPreparation(null));
  console.timeEnd('2253');
  // Seed 2146 sniper prefix: the hero case's configuredPrefix, ledger left on.
  // Rods at 2-4 and 3-4, belts reserved, empty board through 4-7.
  console.time('2146');
  const hero = await fixture.configuredPrefix('4-7', {
    seed: 2146,
    build: 'sniper',
    supplyChoices: ['rod', 'rod', 'belt'],
    reservedComponents: ['belt', 'rod'],
    equipmentTargets: {warmog: {definitionId: 'garen'}},
    emptyBoardRounds: [...fixture.TERMINAL_EMPTY_BOARD_ROUNDS, '4-7'],
    protectedUnitIds: [],
  });
  if (hero.seed !== 2146 || hero.roundDefinitionId !== '4-7' || hero.phase !== 'preparation') {
    throw new Error(`hero prefix is ${hero.seed} ${hero.roundDefinitionId} ${hero.phase}`);
  }
  store('m8-b8-terminal-2146.json.gz', hero);
  console.timeEnd('2146');
} finally {
  await server.close();
}
