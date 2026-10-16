// Compare public equipment routes under original seed 6240 and replacement seed 145424.
// Both engines run their own original helper; no raw state is patched to restore.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base=process.argv[2];
assert(base,'usage: node tests/fixtures/record-opening-roles.cjs <baseline export>');
const sha=b=>createHash('sha256').update(b).digest('hex');
function bytes(a,b){const x=Buffer.from(a),y=Buffer.from(b);let offset=0;while(offset<Math.min(x.length,y.length)&&x[offset]===y[offset])offset++;return {previousBytes:x.length,currentBytes:y.length,previousSha256:sha(x),currentSha256:sha(y),byteEqual:x.equals(y),firstByteOffset:x.equals(y)?null:offset};}
async function main(){const {createServer}=await import('vite'),servers=[];
 try {for(const directory of [base,root])servers.push(await createServer({root:directory,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'}));
  const engines=[];for(const server of servers)engines.push({fixtures:await server.ssrLoadModule('/tests/fixtures/m8-b4-match.ts'),ser:await server.ssrLoadModule('/src/simulation/serialization.ts'),api:await server.ssrLoadModule('/src/simulation/match.ts')});
  const audit={baselineCommit:'94eecbcbfbce72d4740923b8c793c66c483bfd51',previousSeed:6240,currentSeed:145424,reason:'Preserve a one-star Irelia target and the original component and augment numerical vectors through genuine public acquisition.',cases:[]};
  for(const [items,holder] of [['bloodthirster','unit-1'],['hand-of-justice','unit-3'],[['bloodthirster','bloodthirster'],'unit-1']]) {
   const states=engines.map(e=>e.fixtures.itemMatch(items,holder));
   for(let i=0;i<2;i++){const text=engines[i].ser.serializeMatch(states[i]);assert.deepEqual(engines[i].ser.restoreMatch(text),states[i]);assert.deepEqual(engines[i].ser.restoreMatch(JSON.parse(text)),states[i]);}
   assert.equal(states[1].preparation.units.find(u=>u.id==='unit-1').definitionId,'irelia');
   assert.equal(states[1].preparation.units.find(u=>u.id==='unit-1').starLevel,1);
   const checkpoint=s=>({round:s.roundDefinitionId,hero:s.preparation.units.find(u=>u.id==='unit-1'),items:s.items,augments:s.augments,roundResults:s.roundResults});
   const a=engines[0].api.stepMatch(states[0]),b=engines[1].api.stepMatch(states[1]);
   audit.cases.push({items,holder,state:bytes(JSON.stringify(states[0]),JSON.stringify(states[1])),nextStepEvents:bytes(JSON.stringify(a.events),JSON.stringify(b.events)),previous:checkpoint(states[0]),current:checkpoint(states[1]),strictTextAndObjectRestore:true});
  }
  audit.sourceFiles=['tests/fixtures/m8-b4-match.ts','tests/fixtures/b8-public-equipment.ts'].map(file=>({file,...bytes(fs.readFileSync(path.join(base,file)),fs.readFileSync(path.join(root,file)))}));
  fs.writeFileSync(path.join(root,'docs/evidence/opening-random/equipment-migration.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({passed:true,cases:audit.cases.length}));
 }finally{for(const s of servers)await s.close();}}
main().catch(e=>{console.error(e);process.exitCode=1});
