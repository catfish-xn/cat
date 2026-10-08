/* Explicit B3 development-version migration. Numerical expectations live in the
 * mechanism tests; this checks unchanged public commands and the route's oracle. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const generate = require('./generate-m5-route.cjs');
(async () => {
  const file = 'tests/fixtures/m5/full-match-golden.json';
  const old = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = structuredClone(old);
  for (const build of Object.keys(old.routes)) {
    const route = await generate({build, seed: 42});
    assert.deepEqual(route.actions.map(a=>a.command), old.routes[build].commands, `${build} command drift`);
    next.routes[build].versions = Object.fromEntries(Object.keys(old.routes[build].versions).map(k=>[k,route.initial[k]]));
    next.routes[build].rounds = route.rounds.map(r=>({round:r.round,stateHash:r.stateHash,eventsHash:r.eventsHash}));
    console.log(build, JSON.stringify(route.summary));
  }
  next.note = (old.note ?? '') + ' B3 batch3: frozen B2 semantics, independent G08-G12/IF vectors; unchanged command transcripts and route economic oracle; hashes are trajectory evidence only.';
  fs.writeFileSync(file, JSON.stringify(next,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
