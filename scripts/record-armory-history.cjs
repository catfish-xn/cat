/* Reproduce the real seed-4 shop purchase and three Rumble battles. The fixture
 * stores only raw state and full emitted ledgers, never a verification flag. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const args=process.argv.slice(2),write=args.includes('--write');
assert(args.every(arg=>arg==='--write'||arg==='--check')&&!(write&&args.includes('--check')),'Unknown/conflicting arguments');
const root=path.resolve(__dirname,'..'),file=path.join(root,'tests/fixtures/save-history/armory-4.json.gz');
(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({root,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
  const {recordPublicPendingArmory}=await server.ssrLoadModule('/tests/fixtures/g2-3-armory-public.ts');
  const {historyFor}=await server.ssrLoadModule('/tests/fixtures/history-evidence.ts');
  const {canonicalContent}=await server.ssrLoadModule('/src/simulation/content/index.ts');
  const {restoreMatch}=await server.ssrLoadModule('/src/simulation/serialization.ts');
  const state=await recordPublicPendingArmory(4),battles=historyFor(state);
  assert.equal(battles.length,state.roundResults.filter(r=>r.roundKind!=='supply').length);
  assert(battles.length>0);assert.equal(state.pendingChoice.kind,'armory');
  assert.equal(canonicalContent(restoreMatch(state,battles)),canonicalContent(state));
  const text=canonicalContent({state,battles});
  if(write)fs.writeFileSync(file,zlib.gzipSync(text));
  else assert.equal(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'),text);
  console.log(JSON.stringify({mode:write?'write':'check',seed:state.seed,roundId:state.roundDefinitionId,battles:battles.length,
   gzipBytes:fs.statSync(file).size,rawSha256:crypto.createHash('sha256').update(text).digest('hex'),productionRestoreEqual:true}));
 }finally{await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
