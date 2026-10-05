/* Full ordinary Match via trusted Chromium input; the only browser interface is read-only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');const {chromium}=require('playwright');
const generateRoute=require('./generate-m4-route.cjs');
const verifyInteractions=require('./verify-m4-interactions.cjs');
const verifyInputBoundaries=require('./verify-m4-input-boundaries.cjs');
const preview=process.argv.includes('--preview');const mode=preview?'preview':'dev';
const output=process.env.M4_EVIDENCE_DIR||path.join('artifacts',`m4-${mode}`);fs.mkdirSync(output,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),node:process.version,mode,seed:42,checkpoints:[],rounds:[],screenshots:[],errors:[],console:[],passed:false};
const {hash}=require('./m4-evidence.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const startedAt=Date.now();
report.startedAt=new Date(startedAt).toISOString();
report.platform=process.platform;
report.ciUrl=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null;
report.diffHash=hash(execFileSync('git',['diff','HEAD'],{encoding:'utf8'}));
let server,browser,page,context,route,touch=false;const url=`http://127.0.0.1:${preview?4175:5175}`;
async function read(){return page.evaluate(()=>window.__CAT_DEBUG__?.read()??null);}
async function until(check,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){const value=await read();if(value&&check(value))return value;await delay(60);}throw Error(`Timeout ${check}`);}
async function checkpoint(name){const snap=await read();const file=`${touch?'touch-':''}${name}.png`;await page.screenshot({path:path.join(output,file),fullPage:false});fs.writeFileSync(path.join(output,file.replace('.png','.json')),JSON.stringify(snap));report.screenshots.push(file);report.checkpoints.push({name,touch,stateHash:hash(snap.state),eventHash:hash(snap.combatEvents),round:snap.state.round,tick:snap.state.combat?.tick??0});return snap;}
async function click(name){
 // A fresh intended pointer action waits for the previous choice burst to end.
 // Dedicated repeated-tap regressions use native CDP gestures without this wait.
 await page.waitForFunction(()=>!document.querySelector('.choice-overlay.dismissal-shield'));
 const element=page.locator(`[data-debug="${name}"]`);
 if(await element.count())await element.scrollIntoViewIfNeeded();
 const snap=await read(),b=snap.bounds[name];assert(b,`Missing UI ${name}`);
 if(touch){assert(b.width>=43.9&&b.height>=43.9,`${name}: CSS touch size ${b.width}x${b.height}`);await page.touchscreen.tap(b.centerX,b.centerY);}
 else await page.mouse.click(b.centerX,b.centerY);
}
async function tab(name){await click(`panel:${name}`);}
async function drag(id,target){const snap=await read(),u=snap.tokens.find(t=>t.id===id);assert(u);const p=target.kind==='board'?snap.layout.hexes[`${target.cell.col},${target.cell.row}`]:snap.layout.bench[target.slot];await page.mouse.move(u.screenX,u.screenY);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:5});await page.mouse.up();}
async function input(c){
 switch(c.type){
 case 'buy':if(touch){await tab('units');await click(`mobile:buy-${c.slot}`);}else await click(`buy-${c.slot}`);break;
 case 'reroll':if(touch)await click('mobile:reroll');else await page.keyboard.press('d');break;
 case 'buyXp':if(touch)await click('mobile:buy-xp');else await page.keyboard.press('f');break;
 case 'sell':if(touch){await tab('units');await click(`mobile:unit:${c.id}`);await click('mobile:sell');}else{const t=(await read()).tokens.find(t=>t.id===c.id);assert(t);await page.mouse.move(t.screenX,t.screenY);await page.keyboard.press('e');}break;
 case 'deploy':if(touch){await tab('units');await click(`mobile:unit:${c.id}`);await click(c.target.kind==='board'?`deploy:${c.target.cell.col},${c.target.cell.row}`:`mobile:bench:${c.target.slot}`);}else await drag(c.id,c.target);break;
 case 'combine':await tab('items');for(const id of c.ids)await click(`item:${id}`);await click('combine-items');break;
 case 'equip':await tab('items');await click(`item:${c.itemId}`);await click(`equipment:${c.unitId}:${c.slot}`);break;
 case 'target':await click(`anomaly-target:${c.unitId}`);break;
 case 'select':await click(`choice:${c.definitionId}`);break;
 case 'anomalyReroll':if(touch)await click('anomaly-reroll');else{const before=await read(),b=before.bounds[`choice:${before.state.pendingChoice.offers[0]}`];await page.mouse.move(b.centerX,b.centerY);await page.mouse.down();for(let i=0;i<3;i++)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-debug')),'anomaly-reroll');await page.keyboard.press('Enter');const rerolled=(await read()).state;assert.equal(rerolled.pendingChoice.generation,before.state.pendingChoice.generation+1);await page.mouse.up();assert.deepEqual((await read()).state,rerolled,'old offer pointer release cannot choose after reroll');}break;
 case 'start':await click(touch?'mobile:start-combat':'start-combat');break;
 case 'continue':await click(touch?'mobile:continue':'continue');break;
 }
}
function hud(snap){const s=snap.state;assert.equal(snap.hud.gold,`Gold ${s.gold}`);assert.equal(snap.hud.level,`Level ${s.level}`);assert.equal(snap.hud.playerHp,`HP ${s.playerHp}`);assert.equal(snap.tokens.length,s.preparation.units.length);if(s.combat)for(const u of s.combat.units){for(const [key,value]of[['health',u.hp],['mana',u.mana],['shields',u.shield]])assert.equal(snap[key].find(x=>x.id===u.id)?.value,value,`${key} ${u.id}`);}}
async function apply(entry){
 assert.deepEqual((await read()).state,entry.before,`before ${JSON.stringify(entry.command)}`);
 if(['target','anomalyReroll','select'].includes(entry.command.type)){const before=await read();assert(before.strategy.choiceVisible);if(before.state.pendingChoice.step!=='target')assert.equal(Object.keys(before.bounds).filter(k=>k.startsWith('choice:')).length,3);await checkpoint(`r${before.state.round}-choice-${entry.command.type}-${before.state.pendingChoice.generation}`);}
 await input(entry.command);const snap=await read();assert.deepEqual(snap.state,entry.after,`after ${JSON.stringify(entry.command)}`);hud(snap);
 if(!touch&&['reroll','buyXp','sell'].includes(entry.command.type)){const key=await page.evaluate(()=>window.__M4_KEYS__.at(-1));assert(key?.trusted);assert.deepEqual(key.state,entry.after,'native dispatch already committed before later listener');}
 report.checkpoints.push({name:entry.annotation||entry.command.type,touch,command:entry.command,stateHash:hash(snap.state)});
 if(entry.annotation && !entry.annotation.startsWith('fast-chain'))await checkpoint(`r${snap.state.round}-${entry.annotation}`);
}
async function rejectBurst(label){const before=(await read()).state;
 for(let i=0;i<3;i++){await page.keyboard.press('d');await page.keyboard.press('f');await page.keyboard.press('e');assert.deepEqual((await read()).state,before);}
 report.checkpoints.push({name:label,touch,stateHash:hash(before)});
}
async function play(lastRound=Infinity){
 assert.deepEqual((await read()).state,route.initial);await checkpoint('initial');
 for(const round of route.rounds){if(round.round>lastRound)break;
  for(const entry of round.preparationActions){if(!touch&&(await read()).state.phase==='choice')await rejectBurst('modal-rejects-DFE');await apply(entry);}
  assert.deepEqual((await read()).state,round.before);
  if([1,5,7].includes(round.round)){await tab('traits');const row=page.locator('[data-debug="trait:conduit"]');await row.scrollIntoViewIfNeeded();assert(await row.isVisible());const text=await row.innerText(),trait=round.traits.find(t=>t.traitId==='conduit');assert(text.includes(`tier ${trait.tier}`));assert(text.includes(`${trait.count} / ${trait.count<4?4:6}`));assert(text.includes('上阵不同单位：'));report.checkpoints.push({name:'visible-trait-tier',touch,round:round.round,tier:trait.tier,text});await checkpoint(`r${round.round}-visible-traits`);}
  await input({type:'start'});
  let seenCast=false,seenMana=false,liveEvidence=false;
  function check(snap){hud(snap);const tick=snap.state.combat.tick;assert.deepEqual(snap.state,round.atTick.get(tick),`R${round.round} tick ${tick}`);seenCast ||=snap.combatEvents.some(e=>e.type==='cast');seenMana ||=snap.mana.some(m=>m.visible&&m.value>0);}
  let snap=await read();check(snap);
  if(!touch&&round.round===1){await page.keyboard.press('d');await page.keyboard.press('f');await page.keyboard.press('e');}
  const end=Date.now()+75000;
  while(snap.state.phase==='combat'){if(Date.now()>end)throw Error(`R${round.round} combat timeout`);await delay(100);snap=await read();check(snap);if(round.round===7&&!liveEvidence&&seenCast&&snap.state.phase==='combat'&&snap.state.combat.units.some(u=>u.id===snap.state.anomalyBinding.unitId&&u.hp>0&&u.mana>0)){await page.locator('.combat-sources').scrollIntoViewIfNeeded();await checkpoint('r7-live-four-sources-mana-ability');report.checkpoints.at(-1).volatile=true;liveEvidence=true;}}
  if(round.round===7)assert(liveEvidence,'captured live four-source combat with Mana and Ability');
  assert.deepEqual(snap.state,round.settled);
  if([7,8].includes(round.round)){assert(seenCast&&seenMana,'Anomaly battle visibly includes Mana/cast');const sourceText=snap.strategy.combatSourceText;for(const source of ['trait','item','augment','anomaly'])assert(sourceText.includes(`${source} ·`),`visible source ${source}`);assert(snap.combatEvents.some(e=>e.type==='effectTriggered'&&e.source.sourceKind==='anomaly'));report.checkpoints.push({name:'visible-four-sources',touch,round:round.round,text:sourceText});}
  const expectedEvents=round.events.filter(e=>'tick'in e);
  assert.deepEqual(snap.combatEvents,expectedEvents,`complete R${round.round} ledger`);
  assert.deepEqual(snap.combatEvents.map(e=>e.eventSeq),expectedEvents.map((_,i)=>i),'gap-free sequence');
  const record={touch,round:round.round,stateHash:hash(snap.state),eventsHash:hash(snap.combatEvents),result:snap.state.roundResults.at(-1),seenCast,seenMana};report.rounds.push(record);
  fs.writeFileSync(path.join(output,`${touch?'touch-':''}r${round.round}-events.json`),JSON.stringify(snap.combatEvents));
  fs.writeFileSync(path.join(output,`${touch?'touch-':''}r${round.round}-state.json`),JSON.stringify(snap.state));
  if([1,2,5,7,8].includes(round.round)||snap.state.phase==='gameOver')await checkpoint(`r${round.round}-settled`);
  console.log(JSON.stringify(record));
  if(round.round>=lastRound)break;
  if(round.continuation)await apply(round.continuation);
 }
}
async function newContext(mobile=false){touch=mobile;context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1440,height:1000}});
 // Explicit milestone PNGs retain the canvas; trace keeps native actions and DOM snapshots.
 await context.tracing.start({screenshots:false,snapshots:true});

 page=await context.newPage();page.on('pageerror',e=>report.errors.push(`pageerror:${e.message}`));page.on('console',e=>{report.console.push({type:e.type(),text:e.text()});if(e.type()==='error')report.errors.push(`console:${e.text()}`);});await page.goto(url);await until(s=>s.state.phase==='preparation');
 // Registered after the product listener: this same native dispatch must already see the committed state.
 await page.evaluate(()=>{window.__M4_KEYS__=[];window.addEventListener('keydown',e=>{if(['KeyD','KeyF','KeyE'].includes(e.code))window.__M4_KEYS__.push({code:e.code,repeat:e.repeat,trusted:e.isTrusted,timeStamp:e.timeStamp,observedAt:performance.now(),state:window.__CAT_DEBUG__.read().state});});});}
async function desktopEdges(){
 const end=(await read()).state;assert.equal(end.phase,'gameOver');await rejectBurst('gameover-locks');
 for(const name of ['start-combat','continue']){await click(name);assert.deepEqual((await read()).state,end);}
 await click('debug-new-match');assert.deepEqual((await read()).state,route.initial);await checkpoint('new-match-reset');
 // Real resource exhaustion, native repeat and no key debounce.
 await page.keyboard.down('d');await page.keyboard.down('d');await page.keyboard.up('d');
 for(let i=0;i<3;i++)await page.keyboard.press('d');assert.equal((await read()).state.gold,0);
 const poor=(await read()).state;for(let i=0;i<30;i++){await page.keyboard.press('d');await page.keyboard.press('f');assert.deepEqual((await read()).state,poor);}
 const keys=await page.evaluate(()=>window.__M4_KEYS__);assert(keys.every(k=>k.trusted));assert(keys.some(k=>k.repeat));fs.writeFileSync(path.join(output,'inputs.json'),JSON.stringify(keys));
 report.keydowns=keys.length;await checkpoint('native-repeat-exhaustion');
 // Reset through normal UI for item drag/input conflicts; these supplement the completed full Match.
 await click('debug-new-match');await tab('items');await click('item:item-1');
 const item=page.locator('[data-debug="item:item-1"]');await item.scrollIntoViewIfNeeded();let snap=await read(),b=snap.bounds['item:item-1'];
 await page.mouse.move(b.centerX,b.centerY);await page.mouse.down();await page.mouse.move(b.centerX-20,b.centerY+8,{steps:3});
 assert.equal((await read()).gesture?.kind,'item');const original=(await read()).state;await page.keyboard.press('e');assert.deepEqual((await read()).state,original);
 await page.keyboard.press('d');assert.equal((await read()).gesture,null);const afterD=(await read()).state;await page.keyboard.press('e');assert.deepEqual((await read()).state,afterD);await page.mouse.up();assert.deepEqual((await read()).state,afterD);
 await checkpoint('item-drag-DFE');
}
(async()=>{try{
 route=await generateRoute();const golden=require('../tests/fixtures/m4/full-match-golden.json');assert.deepEqual(route.actions.map(a=>a.command),golden.commands);assert.deepEqual(route.rounds.map(r=>({round:r.round,stateHash:hash(r.settled),eventsHash:hash(r.events.filter(e=>'tick'in e))})),golden.rounds);report.versions={schemaVersion:route.initial.schemaVersion,rulesVersion:route.initial.rulesVersion,contentVersion:route.initial.contentVersion,contentDigest:route.initial.contentDigest};
 fs.writeFileSync(path.join(output,'full-match-transcript.json'),JSON.stringify({header:{...report.versions,seed:42,rngAlgorithm:'lcg32-v1'},actions:route.actions.map((a,index)=>({index,command:a.command,annotation:a.annotation,accepted:true,round:a.before.round,tick:a.before.combat?.tick??0,rngBefore:[a.before.rngState,a.before.choiceRngState,a.before.rewardRngState],rngAfter:[a.after.rngState,a.after.choiceRngState,a.after.rewardRngState],beforeHash:hash(a.before),afterHash:hash(a.after),events:a.events}))}));
 fs.writeFileSync(path.join(output,'build-chain.json'),JSON.stringify({traits:route.rounds.map(r=>({round:r.round,traits:r.traits})),resourceEvents:route.allEvents.filter(e=>!('tick'in e)),anomalyBattles:route.rounds.filter(r=>[7,8].includes(r.round)).map(r=>({round:r.round,binding:r.started.anomalyBinding,carrier:r.started.combat.units.find(u=>u.id===r.started.anomalyBinding.unitId),events:r.events.filter(e=>e.type==='effectTriggered'&&e.source.sourceKind==='anomaly')}))}));
 fs.writeFileSync(path.join(output,'round-ledger.json'),JSON.stringify(route.rounds.map(r=>({round:r.round,before:r.before,started:r.started,settled:r.settled,result:r.settled.roundResults.at(-1)}))));
 server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),...(preview?['preview']:[]),'--host','127.0.0.1','--port',preview?'4175':'5175','--strictPort'],{stdio:['ignore','pipe','pipe']});
 for(const stream of[server.stdout,server.stderr])stream.on('data',data=>fs.appendFileSync(path.join(output,'server.log'),data));
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(`Server exited ${server.exitCode}`);try{if((await fetch(url)).ok)break;}catch{}if(i===99)throw Error('Server failed');await delay(100);}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});report.chromium=browser.version();
 await newContext();await play();await desktopEdges();await verifyInteractions({page,context,read,click,report,touch});await context.tracing.stop({path:path.join(output,'desktop-trace.zip')});await context.close();
 await newContext(true);await play(8);await checkpoint('touch-two-anomaly-battles');await page.setViewportSize({width:844,height:390});await checkpoint('touch-landscape');await verifyInteractions({page,context,read,click,report,touch});await context.tracing.stop({path:path.join(output,'touch-trace.zip')});await context.close();context=null;
 await verifyInputBoundaries({browser,url,report,output});
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;console.error(error);process.exitCode=1;try{if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')});if(context)await context.tracing.stop({path:path.join(output,'failure-trace.zip')});}catch{}
}finally{report.durationSeconds=(Date.now()-startedAt)/1000;fs.writeFileSync(path.join(output,'page-console.json'),JSON.stringify({console:report.console,errors:report.errors},null,2));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({sha:report.sha,status:report.status,diffHash:report.diffHash,ciUrl:report.ciUrl,versions:report.versions,mode,seed:42,node:report.node,chromium:report.chromium,platform:report.platform,startedAt:report.startedAt,durationSeconds:report.durationSeconds,passed:report.passed},null,2));await browser?.close();server?.kill();if(report.passed){console.log(JSON.stringify({mode,checkpointHash:hash(report.checkpoints.filter(p=>!p.volatile)),roundLedgerHash:hash(report.rounds),versions:report.versions,durationSeconds:report.durationSeconds}));console.log(`PASS M4 ${mode}: full Match + touch + native input`);}}})();
