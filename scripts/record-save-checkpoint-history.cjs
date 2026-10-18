/* Record genuine public-command histories for immutable current-rule raw checkpoints.
 * Never generates a proof from the checkpoint's claimed facts. */
const fs = require('node:fs');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
async function main() {
  const { createServer } = await import('vite');
  const server = await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { CompletedBattleHistory } = await server.ssrLoadModule('/tests/fixtures/completed-battle-history.ts');
    const history = new CompletedBattleHistory('checkpoint-cannon');
    const states = [];
    const route = await require('./generate-m5-route.cjs').run(api, {build:'cannon',seed:42,
      onStep(before,result,command) {
        history.observe({before,after:result.state,events:result.events.filter(e=>e.domain==='combat'),reason:command?'command':'tick'});
        if(command?.type==='start')states.push(before);
        if(before.phase==='combat'&&result.state.phase!=='combat')states.push(result.state);
      }});
    states.push(route.final);
    const expected=JSON.parse(zlib.gunzipSync(fs.readFileSync('tests/fixtures/g2-3-recorded-states/cannon.json.gz'))).states;
    assert.deepEqual(states,expected,'Every recorded checkpoint must equal the unchanged raw input');
    const bytes=zlib.gzipSync(JSON.stringify({battles:history.completedRecords}));
    const file='tests/fixtures/save-history/checkpoint-cannon.json.gz';
    if(process.argv.includes('--check'))assert.deepEqual(fs.readFileSync(file),bytes);
    else {fs.mkdirSync('tests/fixtures/save-history',{recursive:true});fs.writeFileSync(file,bytes);}
    console.log(JSON.stringify({checkpoints:states.length,battles:history.completedRecords.length,bytes:bytes.length}));
  } finally {await server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
