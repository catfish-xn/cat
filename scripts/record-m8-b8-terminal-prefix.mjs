// Replay audited terminal routes and store canonical saves (or verify them with --check).
// tests/m8-b8-loot-view.test.ts restores these files with restoreMatch, which checks each save in full.
// The independent route ledger stays on for both routes.
//
// After changing src/simulation rules: run `node scripts/record-m8-b8-terminal-prefix.mjs --check` first.
// Exit 0 means fixtures still match; on failure re-record without --check and commit the updated gz files.
// --check never writes to disk. Optional --fixture-dir=PATH or env M8_B8_TERMINAL_FIXTURE_DIR overrides the
// target directory in both modes (intended for isolated tests; write mode logs a stderr notice when overridden).
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createServer} from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const defaultFixtureDir = path.join(root, 'tests/fixtures');

export function resolveFixtureTarget(argv = process.argv.slice(2), env = process.env) {
  const check = argv.includes('--check');
  const fixtureDirArg = argv.find(a => a.startsWith('--fixture-dir='));
  const fixtureDir = fixtureDirArg
    ? path.resolve(fixtureDirArg.slice('--fixture-dir='.length))
    : env.M8_B8_TERMINAL_FIXTURE_DIR
      ? path.resolve(env.M8_B8_TERMINAL_FIXTURE_DIR)
      : defaultFixtureDir;
  const overridden = fixtureDir !== defaultFixtureDir;
  if (!check && overridden) {
    console.error(`record-m8-b8: writing fixtures to ${fixtureDir} (overridden)`);
  }
  return {check, fixtureDir, overridden};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {check, fixtureDir} = resolveFixtureTarget();
  const began = performance.now();
  const server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    server: {middlewareMode: true, ws: false},
    appType: 'custom',
  });
  try {
    const fixture = await server.ssrLoadModule('/tests/fixtures/t13-loot-public.ts');
    const {serializeMatch, restoreMatch} = await server.ssrLoadModule('/src/simulation/serialization.ts');

    const canonicalText = (name, state) => {
      const text = serializeMatch(state);
      if (serializeMatch(restoreMatch(text)) !== text) throw new Error(`${name} did not round-trip`);
      return text;
    };

    console.time('2253');
    const state2253 = await fixture.terminalPreparation(null);
    console.timeEnd('2253');

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
    console.timeEnd('2146');

    const pairs = [
      ['m8-b8-terminal-2253.json.gz', state2253],
      ['m8-b8-terminal-2146.json.gz', hero],
    ];

    if (check) {
      let failed = false;
      for (const [name, state] of pairs) {
        const text = canonicalText(name, state);
        const out = path.join(fixtureDir, name);
        let expected;
        try {
          expected = gunzipSync(readFileSync(out));
        } catch (error) {
          console.error(`fixture differs: ${name} (on-disk fixture unreadable: ${error?.code ?? error})`);
          failed = true;
          continue;
        }
        const actual = Buffer.from(text, 'utf8');
        if (!expected.equals(actual)) {
          console.error(`fixture differs: ${name} (disk ${expected.length} bytes, recomputed ${actual.length} bytes)`);
          failed = true;
        } else {
          console.log(`ok ${out} (${actual.length} canonical bytes)`);
        }
      }
      const elapsedMs = Math.round(performance.now() - began);
      console.log(`--check finished in ${elapsedMs} ms`);
      if (failed) process.exitCode = 1;
    } else {
      const store = (name, state) => {
        const text = canonicalText(name, state);
        const out = path.join(fixtureDir, name);
        let previous = '';
        try { previous = gunzipSync(readFileSync(out)).toString(); }
        catch (error) { if (error?.code !== 'ENOENT') throw error; }
        if (previous === text) { console.log(`unchanged ${out} (${text.length} canonical bytes)`); return; }
        writeFileSync(out, gzipSync(text));
        console.log(`wrote ${out} (${text.length} canonical bytes)`);
      };
      for (const [name, state] of pairs) store(name, state);
    }
  } finally {
    await server.close();
  }
}
