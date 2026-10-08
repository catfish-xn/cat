/* Independent native-object gate; never invokes or changes the formal heap runner. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const output = process.env.M6_RETENTION_OUTPUT || 'artifacts/m6-retention';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const { createServer } = await import('vite');
  let server;
  try {
    server = await createServer({ root: path.resolve(__dirname, '..'), server: { host: '127.0.0.1', port: 0 }, plugins: [{
      // Observe the real main's Game solely to enter its public scene shutdown/restart API.
      // The production source, controls, hooks and release calls are unchanged.
      name: 'retention-game-handle', enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/src/main.ts')) return;
        assert.equal(code.split('new Phaser.Game({').length, 2);
        return code.replace('new Phaser.Game({', 'window.__M6_RETENTION_GAME__ = new Phaser.Game({');
      },
    }, ...(process.env.M6_RETENTION_MUTATION === 'omit-install-release' ? [{
      name: 'retention-regression-mutation',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/src/m6/application.ts')) return;
        assert.equal(code.split('this.controls.releaseRunResources();').length, 2);
        return code.replace('this.controls.releaseRunResources();', '/* test-only mutation: omit accepted handoff release */');
      },
    }] : [])] });
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { digestContent } = await server.ssrLoadModule('/src/simulation/content/index.ts');
    // Stop the accepted command-only route at its second preparation. One real
    // completed battle suffices for replay; do not retain a whole 35-round fixture.
    const first = { events: [] }, stop = Error('native fixture complete');
    let match;
    try {
      await require('./generate-m5-route.cjs').run(api, { build: 'cannon', seed: 42, onStep(before, result, command) {
        if (before.round === 2 && before.phase === 'preparation') { match = before; throw stop; }
        if (before.round === 1 && command?.type === 'start') first.before = before;
        if (first.before && before.round === 1) first.events.push(...result.events.filter(event => event.domain === 'combat'));
        if (before.phase === 'combat' && result.state.phase !== 'combat') first.after = result.state;
      } });
    } catch (error) { if (error !== stop) throw error; }
    assert(match && first.before && first.after, 'normal route supplies a completed battle and second preparation');
    const events = first.events;
    const runId = 'native-retention-public-route';
    const fixture = { kind: 'hex-autobattler-save', saveFormatVersion: 1, replayFormatVersion: 1, runId, createdAt: '2026-10-08T00:00:00.000Z', match, currentBattle: null, battles: [{
      runId, combatId: first.after.combat.combatId, context: first.before, initial: api.startMatchCombat(first.before).state.combat,
      events, endTick: first.after.combat.tick, nextEventSeq: first.after.combat.nextEventSeq, result: first.after.combat.result,
      stateHash: digestContent(first.after.combat), eventHash: digestContent(events),
    }] };
    const file = path.resolve(output, 'public-route-save.json');
    fs.writeFileSync(file, JSON.stringify(fixture));
    await server.listen();
    const child = spawn(process.execPath, ['tests/m6-retention-browser.cjs'], { stdio: 'inherit', env: { ...process.env, M6_RETENTION_URL: server.resolvedUrls.local[0].replace(/\/$/, ''), M6_RETENTION_FIXTURE: file } });
    process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => signal ? reject(Error(`native test terminated: ${signal}`)) : resolve(code)); });
  } finally { await server?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
