/* Read-only public-command replay; --write writes evidence only, never fixtures. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),BASE='80b893ac66c01b79ec6606b493e141eca3bf00cb';
const args=process.argv.slice(2),arg=args.find(x=>x.startsWith('--baseline-root='));
assert(arg&&args.every(x=>x===arg||x==='--write'));
const base=path.resolve(arg.slice(16)),sha=x=>createHash('sha256').update(x).digest('hex'),json=x=>JSON.stringify(x);
function first(a,b,p='$'){if(json(a)===json(b))return null;if(!a||!b||typeof a!=='object'||typeof b!=='object')return{path:p,previous:a??null,current:b??null};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const d=first(a[k],b[k],`${p}.${k}`);if(d)return d;}return null;}
const bytes=x=>({bytes:Buffer.byteLength(json(x)),sha256:sha(json(x))});
async function capture(server,seed,legacy){
 const api=await server.ssrLoadModule('/src/simulation/match.ts'),ser=await server.ssrLoadModule('/src/simulation/serialization.ts'),units=(await server.ssrLoadModule('/src/simulation/units.ts')).UNIT_DEFINITIONS;
 const content=await server.ssrLoadModule('/src/simulation/content/index.ts'),loot=await server.ssrLoadModule('/src/simulation/loot-freeze.ts');
 let state=api.createMatch(seed),commands=[{operation:'createMatch',args:[seed]}],events=[],stateRows=[];
 let rawHash=createHash('sha256'),rawBytes=0;
 const observe=()=>{const text=json(state)+'\n';rawHash.update(text);rawBytes+=Buffer.byteLength(text);stateRows.push({round:state.roundDefinitionId,phase:state.phase,sha256:sha(text)});};observe();
 const command=(operation,...args)=>{const result=api[operation](state,...args);assert.notEqual(result.ok,false,`${operation}: ${result.reason}`);commands.push({operation,args});events.push(...result.events);state=result.state;observe();return result;};
 const players=()=>state.preparation.units.filter(u=>u.team==='player');
 const fight=()=>{command('startMatchCombat');while(state.phase==='combat')command('stepMatch');};
 while(state.roundDefinitionId!=='2-7'){
  if(state.phase==='choice'){const c=state.pendingChoice;command('selectChoice',c.choiceId,c.generation,c.kind==='component'?'sword':'investment-strategy-i');}
  else if(state.phase==='settlement')command('nextRound',state.round);
  else {if(state.round>3){for(const u of players().filter(u=>u.location.kind==='board')){const used=new Set(players().filter(u=>u.location.kind==='bench').map(u=>u.location.slot));const slot=Array.from({length:9},(_,i)=>i).find(i=>!used.has(i));assert.notEqual(slot,undefined);command('deployMatchUnit',u.id,{kind:'bench',slot});}}
   else for(const u of players().filter(u=>u.location.kind==='bench'))command('deployMatchUnit',u.id,{kind:'board',cell:{col:u.id==='unit-2'?3:5,row:7}});
   fight();}
 }
 for(const [i,u]of players().entries())command('deployMatchUnit',u.id,{kind:'board',cell:{col:[1,3,5][i],row:i===2?7:4}});
 command('equipItem','item-1','unit-1',0);command('equipItem','item-2','unit-1',1);command('equipItem','item-3','unit-2',0);
 const preparation=state,prefixCommands=commands,prefixEvents=events;
 assert.deepEqual({gold:state.gold,hp:state.playerHp,level:state.level,investment:state.augmentProgress.investmentHp},{gold:65,hp:73,level:4,investment:128});
 const report={seed,identity:{contentDigest:content.CONTENT_DIGEST,lootReplayDigest:loot.LOOT_REPLAY_DIGEST,rulesVersion:state.rulesVersion,contentVersion:state.contentVersion},prefix:{states:{bytes:rawBytes,sha256:rawHash.digest('hex'),count:stateRows.length},commands:bytes(commands),events:bytes(events),preparation:bytes(preparation),summary:{gold:state.gold,hp:state.playerHp,investment:128},selectedAugments:state.augments},cases:{}};
 const caseValues={};
 for(const gold of [9,49,50]){
  state=preparation;commands=[];events=[];stateRows=[];rawHash=createHash('sha256');rawBytes=0;observe();let purchase=null;
  if(gold%2===0){const slot=legacy?0:state.shop.slots.findIndex(o=>o.status==='available'&&units[o.definitionId].cost%2===1);assert(slot>=0);const offer=state.shop.slots[slot];purchase={slot,definitionId:offer.definitionId,cost:units[offer.definitionId].cost};assert.equal(purchase.cost%2,1);command('buyUnit',slot,state.shop.generation);}
  while(state.gold>gold)command('rerollShop');assert.equal(state.gold,gold);
  const before=state;assert.deepEqual(ser.restoreMatch(ser.serializeMatch(before)),before);const eventStart=events.length;
  fight();const ended=state,battleEvents=events.slice(eventStart),settlement=ended.roundResults.at(-1),interest=Math.min(5,Math.floor((gold+1)/10)),after=gold+1+5+interest,investment=128+8*interest;
  assert.equal(settlement.result,'playerWin');assert.equal(settlement.interestBasis,gold+1);assert.equal(settlement.goldBefore,gold+1);assert.equal(settlement.goldAfter,after);assert.equal(ended.gold,after);assert.equal(ended.augmentProgress.investmentHp,investment);
  assert.deepEqual(settlement.incomeBreakdown,{base:5,win:0,interest,streak:0});
  assert.equal(settlement.combatTicks,legacy?205:292);assert.equal(settlement.combatEventCount,legacy?217:239);
  const drops=before.m8.loot.frozen.rounds.find(r=>r.encounterPlan.roundId==='2-7').encounterPlan.drops,ids=new Set(drops.map(d=>d.dropId)),receipts=ended.m8.loot.receipts.filter(r=>ids.has(r.dropId));
  assert.deepEqual(drops.map(d=>d.payload),[{kind:'item',definitionId:legacy?'cloak':'bow',quantity:1},{kind:'item',definitionId:legacy?'rod':'sword',quantity:1},{kind:'gold',quantity:1},{kind:'consumable',definitionId:'magnetic-remover',quantity:1}]);
  assert.deepEqual(receipts.map(r=>r.payload),drops.map(d=>d.payload));assert.deepEqual(receipts.slice(0,2).map(r=>r.grantedItemIds),[[`item-${before.nextItemSerial}`],[`item-${before.nextItemSerial+1}`]]);
  assert.equal(ended.nextItemSerial,before.nextItemSerial+2);assert.equal(ended.nextUnitSerial,before.nextUnitSerial);assert.deepEqual(ended.scheduleReceipts,before.scheduleReceipts);assert.deepEqual(ended.m8.loot.frozen,before.m8.loot.frozen);
  for(const key of ['rngState','choiceRngState','rewardRngState','equipmentState'])assert.deepEqual(ended[key],before[key]);
  assert.equal(battleEvents.filter(e=>e.type==='roundSettled').length,1);assert.equal(battleEvents.filter(e=>e.type==='lootGranted').length,4);
  const restored=ser.restoreMatch(ser.serializeMatch(ended));assert.deepEqual(restored,ended);
  for(const value of [ended,restored]){assert.deepEqual(api.stepMatch(value),{state:value,events:[]});assert.deepEqual(api.startMatchCombat(value),{ok:false,state:value,reason:'wrong-phase'});assert.deepEqual(api.selectChoice(value,'obsolete-pve-choice',0,'tear'),{ok:false,state:value,reason:'wrong-phase'});}
  const corruptions=[['current settlement totals',x=>x.gold++],['history income',x=>x.roundResults.at(-1).interestBasis--],['investment',x=>x.augmentProgress.investmentHp+=8],['frozen receipt payload',x=>x.m8.loot.receipts.find(r=>r.dropId===drops[2].dropId).payload.quantity=2]];
  for(const [message,change]of corruptions){const bad=JSON.parse(ser.serializeMatch(ended));change(bad);assert.throws(()=>ser.restoreMatch(bad),new RegExp(message));}
  command('nextRound',10);assert.deepEqual(api.nextRound(restored,10).state,state);assert.equal(state.gold,after);assert.equal(state.augmentProgress.investmentHp,investment);assert.deepEqual(state.resourceProvenance,ended.resourceProvenance);assert.deepEqual(state.m8.loot.receipts,ended.m8.loot.receipts);assert.equal(api.nextRound(state,10).ok,false);
  report.cases[gold]={purchase,rawStates:{bytes:rawBytes,sha256:rawHash.digest('hex'),count:stateRows.length},commands:bytes(commands),events:bytes(events),before:bytes(before),ended:bytes(ended),continued:bytes(state),battleEvents:bytes(battleEvents),summary:{goldBefore:gold,earnedGold:1,basis:gold+1,interest,goldAfter:after,investmentBefore:128,investmentAfter:investment,ticks:settlement.combatTicks,combatEvents:settlement.combatEventCount,dropPayloads:drops.map(d=>d.payload),grantedItemIds:receipts.flatMap(r=>r.grantedItemIds),restoreAndDuplicateChecks:true,rejectedMutations:corruptions.map(([message])=>message)}};
  caseValues[gold]={before,ended,commands,events,battleEvents};
 }
 return{report,values:{preparation,prefixCommands,prefixEvents,cases:caseValues}};
}
(async()=>{const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'src/simulation','tests/m8-b8-live-economy.test.ts'],{cwd:root,encoding:'utf8'}).trim().split('\n'),sources={};for(const file of files){const data=fs.readFileSync(path.join(base,file));assert(data.equals(execFileSync('git',['show',`${BASE}:${file}`],{cwd:root,maxBuffer:64*1024*1024})),`baseline bytes ${file}`);sources[file]=sha(data);}
 const walk=directory=>fs.readdirSync(path.join(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${directory}/${entry.name}`):[`${directory}/${entry.name}`]);
 const currentSources=Object.fromEntries([...walk('src/simulation'),'tests/m8-b8-live-economy.test.ts'].sort().map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 const{createServer}=await import('vite'),servers=[];try{for(const directory of [base,root])servers.push(await createServer({root:directory,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',logLevel:'error'}));const old=await capture(servers[0],42,true),now=await capture(servers[1],13,false);assert.equal(old.report.identity.lootReplayDigest,now.report.identity.lootReplayDigest);
 const differences={prefixCommands:first(old.values.prefixCommands,now.values.prefixCommands),prefixCommandsAfterCreate:first(old.values.prefixCommands.slice(1),now.values.prefixCommands.slice(1)),prefixEvents:first(old.values.prefixEvents,now.values.prefixEvents),preparation:first(old.values.preparation,now.values.preparation),cases:{}};for(const gold of [9,49,50])differences.cases[gold]=Object.fromEntries(['before','ended','commands','events','battleEvents'].map(k=>[k,first(old.values.cases[gold][k],now.values.cases[gold][k])]));
 for(const [file,digest]of Object.entries(currentSources))assert.equal(sha(fs.readFileSync(path.join(root,file))),digest,`Current source changed during recording: ${file}`);
 const result={currentSources,currentSourceSha256:sha(json(currentSources)),baselineCommit:BASE,baselineFilesVerified:files.length,baselineSources:sources,baselineSourceSha256:sha(json(sources)),scriptSha256:sha(fs.readFileSync(__filename)),currentTestSha256:sha(fs.readFileSync(path.join(root,'tests/m8-b8-live-economy.test.ts'))),method:'Independent old seed42 and current seed13 public commands; state hash streams are exact JSON plus LF per state, no identity or seed normalization. Evidence only; no fixture or production changes.',previous:old.report,current:now.report,firstDifferences:differences};const output=JSON.stringify(result,null,2)+'\n',file=path.join(root,'docs/evidence/g2-augments/b8-economy-migration.json');if(args.includes('--write'))fs.writeFileSync(file,output);else assert.equal(fs.readFileSync(file,'utf8'),output);console.log(JSON.stringify({passed:true,cases:3,seeds:[42,13],previous:old.report.cases[50].summary,current:now.report.cases[50].summary}));
 }finally{for(const server of servers)await server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
