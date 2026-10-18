/* Repeatable legal public-command source for the raw 4-6 choice fixture; no restored object is cached. */
const fs=require('node:fs'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {run}=require('./generate-m5-route.cjs');
(async()=>{const {createServer}=await import('vite');const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
try{const api=await server.ssrLoadModule('/src/simulation/match.ts'),ser=await server.ssrLoadModule('/src/simulation/serialization.ts');let state;const stop={},started=performance.now();
 try{await run(api,{build:'cannon',seed:23,anomalyDefinitionId:'dual-wielding',onStep:(before,result)=>{if(result.state.pendingChoice?.kind==='anomaly'&&result.state.pendingChoice.step==='offer'&&result.state.pendingChoice.offers.includes('dual-wielding')){state=result.state;throw stop;}}});}catch(e){if(e!==stop)throw e;}
 assert(state);const raw=ser.serializeMatch(state);assert.deepEqual(ser.restoreMatch(raw),state);
 const file='tests/fixtures/s13-p1-dual-choice.json.gz',bytes=zlib.gzipSync(raw,{level:9});
 if(process.argv.includes('--write'))fs.writeFileSync(file,bytes);else assert.equal(zlib.gunzipSync(fs.readFileSync(file)).toString(),raw);
 console.log(JSON.stringify({seed:23,round:state.roundDefinitionId,elapsedMs:performance.now()-started,rawBytes:Buffer.byteLength(raw),verified:'public commands -> serialize -> production restore',mode:process.argv.includes('--write')?'write':'check'}));
}finally{await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
