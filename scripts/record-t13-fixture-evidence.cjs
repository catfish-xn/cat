/* Reproduce milestone-5 fixture identities using only public commands.
 * The route driver checks its independent economy/loot ledger on every transition.
 * No result is turned into an assertion automatically. --write records reviewed pins. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {run} = require('./generate-m5-route.cjs');
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function main() {
 const {createServer} = await import('vite');
 const server = await createServer({root:path.resolve(__dirname,'..'),configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try {
  const api=await server.ssrLoadModule('/tests/fixtures/recorded-match.ts');
  const serialization=await server.ssrLoadModule('/tests/fixtures/history-evidence.ts');
  const h=await server.ssrLoadModule('/tests/fixtures/t13-loot-public.ts');
  const {CONTENT_DIGEST}=await server.ssrLoadModule('/src/simulation/content/index.ts');
  const {LOOT_REPLAY_DIGEST}=await server.ssrLoadModule('/src/simulation/loot-freeze.ts');
  const cases=[];
  const record=(name,prepared)=>{const l=h.battle(prepared),plan=h.plan(prepared);
   // Every saved boundary is independently accepted before hashing it.
   for(const s of [prepared,l.started,l.revealed,l.beforeFinal,l.ended].filter(Boolean))assert.deepEqual(serialization.restoreMatch(serialization.serializeMatch(s)),s);
   cases.push({name,seed:prepared.seed,roundId:prepared.roundDefinitionId,
    stateSha256:Object.fromEntries(Object.entries({prepared,started:l.started,revealed:l.revealed,beforeFinal:l.beforeFinal,ended:l.ended}).filter(([,v])=>v).map(([k,v])=>[k,sha(v)])),
    eventsSha256:sha(l.events),payloads:plan.encounterPlan.drops.map(d=>d.payload),
    ticks:{reveal:l.revealed?.combat.tick??null,terminal:l.ended.combat.tick},
    upgradeEvents:l.events.filter(e=>e.type==='unitUpgraded'),growthEvents:l.events.filter(e=>e.type==='growth'),
    priorGrowth:prepared.persistentGrowth,finalGrowth:l.ended.persistentGrowth,
    goldBefore:prepared.gold,goldAfter:l.ended.gold,statuses:api.readLootView(l.ended).revealedDrops.map(d=>d.status)});
   return l;
  };
  const growth=record('growth',await h.configuredPrefix('3-7',{seed:74,build:'cannon',copyLimits:{tristana:2},fieldCopies:['tristana']}));
  assert.deepEqual(growth.ended.persistentGrowth,[{unitId:'unit-6',attackDamageBps:875}]);
  const transfer=await h.transferPreparation();record('transfer',transfer);
  record('transfer-conflict',h.accepted(api.equipItem(transfer,'item-6','unit-22',0)));
  record('capacity',h.fillBench(await h.publicPrefix('3-7',36),['tristana']));
  for(const [name,id]of [['two-deaths','unit-12'],['carrier-only','unit-11'],['no-carrier',null]])record(`terminal-${name}`,await h.terminalPreparation(id));
  // Hash successful commands as well as states: regeneration cannot silently substitute a save.
  const stop=new Error('capture');const commands=[];
  try {await run(api,{seed:74,build:'cannon',copyLimits:{tristana:2},fieldCopies:['tristana'],onStep(before,result,command){
   if(command)commands.push({roundId:before.roundDefinitionId,command,events:result.events});
   if(command?.type==='start'&&before.roundDefinitionId==='3-7')throw stop;
  }});}catch(e){if(e!==stop)throw e;}
  const evidence={version:1,contentDigest:CONTENT_DIGEST,lootReplayDigest:LOOT_REPLAY_DIGEST,
   command:'node scripts/record-t13-fixture-evidence.cjs --write',growthCommandCount:commands.length,growthCommandsSha256:sha(commands),cases};
  const target=path.resolve(__dirname,'../docs/evidence/t13/milestone5-fixtures.json');
  if(process.argv.includes('--write'))fs.writeFileSync(target,JSON.stringify(evidence,null,2)+'\n');
  else assert.deepEqual(evidence,JSON.parse(fs.readFileSync(target,'utf8')));
  console.log(`${process.argv.includes('--write')?'Recorded':'Verified'} ${cases.length} public fixture routes; ${CONTENT_DIGEST}; evidence SHA256 ${sha(evidence)}`);
 } finally {await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
