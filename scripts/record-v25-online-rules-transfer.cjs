/* v25-online-rules fixed-seed transfer anchors, generated only from public paid commands. */
const fs=require('node:fs'),assert=require('node:assert/strict');
async function main(){
 const {createServer}=await import('vite');const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'});
 try{
  const {transferPreparation,players}=await server.ssrLoadModule('/tests/fixtures/t13-loot-public.ts');
  const s=await transferPreparation(),donor=s.anomalyBinding.unitId;
  const survivor=players(s).find(u=>u.definitionId==='tristana'&&u.id!==donor).id;
  const pair=[donor,survivor];
  // v22: the 4-7 plan can birth an anvil unit (component anvil) before the Tristana reward; count births in grant order.
  const drops=s.m8.loot.frozen.rounds.find(r=>r.encounterPlan.roundId===s.roundDefinitionId).encounterPlan.drops;
  const rewardIndex=drops.findIndex(d=>d.payload.kind==='unit'&&d.payload.definitionId==='tristana');assert(rewardIndex>=0,'Tristana reward drop');
  const births=drops.slice(0,rewardIndex).filter(d=>d.payload.kind==='unit'||d.payload.kind==='forge').length;const counts=['unit-acquired','combat-growth-committed','item-acquired','unit-upgraded','item-combined','unit-sold','item-equipped'];
  const anchor={epoch:'v25-online-rules',seed:s.seed,contentDigest:s.contentDigest,donor,survivor,reward:`unit-${s.nextUnitSerial+births}`,tg:s.items.find(i=>i.definitionId==='thiefs-gloves').id,
   acquisitions:s.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&pair.includes(e.unitId)),
   provenanceCounts:counts.map(kind=>s.resourceProvenance.entries.filter(e=>e.kind===kind).length),provenanceLength:s.resourceProvenance.entries.length,nextUnitSerial:s.nextUnitSerial};
  assert(anchor.acquisitions.every(e=>e.source.kind==='shop'));
  const path='tests/fixtures/v25-online-rules-transfer-route.json',text=JSON.stringify(anchor,null,2)+'\n';
  if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),text);else fs.writeFileSync(path,text);
  console.log(text);
 }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
