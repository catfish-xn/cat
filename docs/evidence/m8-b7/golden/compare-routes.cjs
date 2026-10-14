const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const baseline=path.resolve(process.argv[2] || '/tmp/b7-merge-validation'),current=process.cwd();
const output=path.resolve(process.argv[3] || '/tmp/b7-route-review');fs.mkdirSync(output,{recursive:true});
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const omit=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const diffs=(a,b,p='$',out=[])=>{if(eq(a,b))return out;if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){out.push({path:p,before:a,after:b});return out;}for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diffs(a[k],b[k],`${p}.${k}`,out);return out;};
function firstDiff(a,b){for(let i=0;i<Math.max(a.length,b.length);i++)if(!eq(a[i],b[i]))return {index:i,before:a[i],after:b[i]};return null;}
const gold=JSON.parse(fs.readFileSync(`${current}/tests/fixtures/m5/full-match-golden.pre-m8-b7.json`));
const report={baseline:{path:baseline,tree:'bda9a75e20cdee8f40860704a89c301d2a27b886',archivedGoldenSha256:sha(fs.readFileSync(`${current}/tests/fixtures/m5/full-match-golden.pre-m8-b7.json`,'utf8'))},current:{path:current},method:'Existing generate-m5-route.run with own Vite SSR Match modules, seed 42, normal commands, retainStates=true; no route state changes, fixtures or repository files written.',sourceEquality:{},builds:{}};
for(const file of ['scripts/generate-m5-route.cjs','tests/fixtures/m5/oracle.cjs','src/simulation/combat-s13.ts','src/simulation/combat-s13-abilities.ts','src/simulation/strategy-snapshot.ts']){const a=fs.readFileSync(`${baseline}/${file}`,'utf8'),b=fs.readFileSync(`${current}/${file}`,'utf8');report.sourceEquality[file]={equal:a===b,beforeSha256:sha(a),afterSha256:sha(b)};assert.equal(a,b,`unexpected source change ${file}`);}
(async()=>{const {createServer}=await import(require.resolve('vite',{paths:[current]}));const servers=[];try{
for(const root of [baseline,current])servers.push(await createServer({root,server:{middlewareMode:true,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'}));const apis=await Promise.all(servers.map(s=>s.ssrLoadModule('/src/simulation/match.ts')));
for(const build of ['cannon','sniper','mage','sniper-caitlyn']){
 const routes=[];for(let i=0;i<2;i++){console.log('Running',build,i?'current':'baseline');routes.push(await require(`${i?current:baseline}/scripts/generate-m5-route.cjs`).run(apis[i],{build,seed:42,retainStates:true}));}
 const [a,b]=routes;assert.equal(a.summary.outcome,'victory');assert.equal(b.summary.outcome,'victory');assert.equal(a.summary.round,38);assert.equal(b.summary.round,38);
 assert.deepEqual(a.actions.map(x=>x.command),b.actions.map(x=>x.command),'commands changed');assert.deepEqual(a.actions.map(x=>x.command),gold.routes[build].commands,'baseline golden commands differ');
 assert.deepEqual(a.rounds.map(({round,stateHash,eventsHash})=>({round,stateHash,eventsHash})),gold.routes[build].rounds,'baseline differs from archived 947 golden');
 assert.deepEqual(a.ledger.costs,b.ledger.costs,'economic cost totals differ');assert.deepEqual(a.ledger.rounds.map(r=>omit(r,['combatTicks'])),b.ledger.rounds.map(r=>omit(r,['combatTicks'])),'non-timing settlement/oracle differences');
 assert.deepEqual(a.checkpoints,b.checkpoints,'economic/build checkpoints differ');assert.deepEqual(a.final.scheduleReceipts,b.final.scheduleReceipts,'reward/schedule receipt change');
 const rngKeys=['rngState','choiceRngState','rewardRngState','battleSeedRngState'];const perActionRngEqual=a.actions.every((x,i)=>rngKeys.every(k=>x.after[k]===b.actions[i].after[k]));assert(perActionRngEqual,'match RNG streams changed');
 const row={summary:{before:omit(a.summary,['durationSeconds','tickTimingMs']),after:omit(b.summary,['durationSeconds','tickTimingMs'])},commands:{equal:true,count:a.actions.length,sha256:sha(a.actions.map(x=>x.command))},oracle:{bothPassed:true,costs:a.ledger.costs,all38NonTimingSettlementsEqual:true,allEconomicBuildCheckpointsEqual:true,scheduleReceiptsEqual:true,componentGrants:a.final.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0),allFourMatchRngStreamsEqualAfterEveryCommand:perActionRngEqual},changedRounds:[],growth:[],pvpInputs:[],finalPersistentGrowth:{before:a.final.persistentGrowth,after:b.final.persistentGrowth}};
 for(let i=0;i<a.rounds.length;i++){
  const x=a.rounds[i],y=b.rounds[i],pvp=x.result.roundKind==='pvp';assert.equal(x.round,y.round);
  const growthBefore=diffs(x.before.persistentGrowth,y.before.persistentGrowth),growthAfter=diffs(x.after.persistentGrowth,y.after.persistentGrowth);
  const growthEvents={before:x.events.filter(e=>e.type==='growth'),after:y.events.filter(e=>e.type==='growth')};
  if(growthEvents.before.length||growthEvents.after.length||growthBefore.length||growthAfter.length)row.growth.push({round:x.round,roundId:x.roundDefinitionId,kind:x.result.roundKind,started:{before:x.before.persistentGrowth,after:y.before.persistentGrowth},growthEvents,ended:{before:x.after.persistentGrowth,after:y.after.persistentGrowth}});
  if(pvp){
   const p={round:x.round,roundId:x.roundDefinitionId,preparationEqual:eq(x.before.preparation,y.before.preparation),strategyDiffs:diffs(x.snapshot,y.snapshot),persistentGrowthDiffs:growthBefore,battleSeedBefore:{before:x.before.battleSeedRngState,after:y.before.battleSeedRngState}};
   assert(p.preparationEqual,'PvP preparation differs');assert.equal(p.battleSeedBefore.before,p.battleSeedBefore.after,'PvP battle seed differs');
   const xStart=a.actions.find(z=>z.round===x.round&&z.command.type==='start').after.combat,yStart=b.actions.find(z=>z.round===y.round&&z.command.type==='start').after.combat;
   p.combatAtStartDiffs=diffs(xStart,yStart);row.pvpInputs.push(p);
   if(build!=='cannon')assert.deepEqual(p.combatAtStartDiffs,[],'non-cannon PvP start differs');
  }
  if(x.eventsHash!==y.eventsHash)row.changedRounds.push({round:x.round,roundId:x.roundDefinitionId,kind:x.result.roundKind,ticks:{before:x.after.combat.tick,after:y.after.combat.tick},eventCount:{before:x.events.length,after:y.events.length},hashes:{before:x.eventsHash,after:y.eventsHash},firstEventDifference:firstDiff(x.events,y.events),firstPacketDifference:firstDiff(x.events.filter(e=>e.type==='packetDamage'),y.events.filter(e=>e.type==='packetDamage')),growthEvents});
 }
 const expectedPve=[1,2,3,10,17,24,31,38],expectedPvp=build==='cannon'?[25,26,27,29,30,32,34,36,37]:[];
 assert.deepEqual(row.changedRounds.filter(r=>r.kind==='pve').map(r=>r.round),expectedPve,'unexpected PvE change');assert.deepEqual(row.changedRounds.filter(r=>r.kind==='pvp').map(r=>r.round),expectedPvp,'unexpected PvP change');
 report.builds[build]=row;fs.writeFileSync(path.join(output,'proof.json'),JSON.stringify(report,null,2)+'\n');console.log('Verified',build,JSON.stringify({commands:row.commands.count,changes:row.changedRounds.map(x=>x.round),costs:row.oracle.costs,growth:row.finalPersistentGrowth}));
 }
}finally{await Promise.all(servers.map(s=>s.close()));}})().catch(e=>{fs.writeFileSync(path.join(output,'failure.txt'),e.stack);console.error(e);process.exitCode=1;});
