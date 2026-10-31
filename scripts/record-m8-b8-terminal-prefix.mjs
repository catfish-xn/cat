// Replay the audited seed-2253 terminal route and store its canonical save.
// tests/m8-b8-loot-view.test.ts restores this file; restoreMatch replays the proof.
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
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
  const state = await fixture.terminalPreparation(null);
  const text = serializeMatch(state);
  if (serializeMatch(restoreMatch(text)) !== text) throw new Error('terminal prefix did not round-trip');
  const out = path.join(root, 'tests/fixtures/m8-b8-terminal-2253.json.gz');
  writeFileSync(out, gzipSync(text));
  console.log(`wrote ${out} (${text.length} canonical bytes)`);
} finally {
  await server.close();
}
