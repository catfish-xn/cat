#!/usr/bin/env node
/* Offline only. Example: node scripts/fuzz-restore.cjs --checkpoints 2000 --workers 4 -o docs/V23_RESTORE_FUZZ_REPORT.md
 * All simulation code is bundled into /tmp; no build artifacts, epochs or .git writes.
 */
const {buildSync}=require('esbuild');
const {fork}=require('node:child_process');
const {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const route=require('./generate-m5-route.cjs');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};

async function load(bundle){return import(pathToFileURL(bundle).href);}
async function routeMatch(api,seed,build,rate=31,stopStep){
 const probe=new api.RestoreProbe(seed,build,false),draw=api.seeded(seed^0x51a7);
 const stop={};
 let terminal=false;
 try {
  const result=await route.run(api.match,{seed,build,onStep(before,result,command){
   if(stopStep!==undefined&&probe.step>stopStep)throw stop;
   if(probe.step===0||stopStep!==undefined||draw(rate)===0)probe.checkpoint(before);
   probe.observe(before,result,command?s=>route.dispatch(api.match,s,command):api.match.stepMatch);
  }});
  terminal=result.final.phase==='gameOver';
 } catch(error){if(error!==stop)throw error;}
 return {seed,build,terminal,steps:probe.step,checkpoints:probe.checkpoints,continuations:probe.continuations,coverage:probe.coverage,failures:probe.failures};
}
// Match persistence deliberately rejects Room seat envelopes. Reuse the real B6 scheduler
// through a solo command/clock adapter; it computes no rules and never strips server fields.
async function serverMatch(api,seed){
 const clock=new api.ManualClock(),sample=api.seeded(seed^0x3e27),fallback=api.seeded(seed^0xb07f),probe=new api.RestoreProbe(seed,'bot',false);
 let state=api.match.createMatch(seed);
 const listeners=new Set();
 const dispatch=(s,c)=>{
  const m=api.match;
  switch(c.type){
   case 'buy':return m.buyUnit(s,c.slot,c.generation);
   case 'sell':return m.sellUnit(s,c.unitId);
   case 'openAnvil':return m.openAnvil(s,c.unitId);
   case 'deploy':return m.deployMatchUnit(s,c.unitId,c.target);
   case 'reroll':return m.rerollShop(s);
   case 'buyXp':return m.buyXp(s);
   case 'shopLock':return m.setShopLock(s,c.locked,c.generation);
   case 'combine':return m.combineItems(s,c.a,c.b);
   case 'equip':return m.equipItem(s,c.itemId,c.unitId,c.slot);
   case 'choose':return m.selectChoice(s,c.choiceId,c.generation,c.definitionId);
   case 'anomalyTarget':return m.selectAnomalyTarget(s,c.choiceId,c.generation,c.unitId);
   case 'anomalyReroll':return m.rerollAnomaly(s,c.choiceId,c.generation);
   case 'rerollAugment':return m.rerollAugment(s,c.choiceId,c.generation,c.optionIndex);
   default:throw Error(`unexpected bot command ${c.type}`);
  }
 };
 const publish=()=>{for(const listener of listeners)listener(adapter.state);};
 const execute=operation=>{
  if(probe.step===0||sample(31)===0)probe.checkpoint(state);
  const before=state,result=operation(state);
  assert.ok(!('ok' in result)||result.ok,`bot seed=${seed} step=${probe.step} ${result.reason}`);
  probe.observe(before,result,operation);state=result.state;publish();return result;
 };
 const adapter={clock,
  get state(){return {phase:state.phase==='combat'?'battle':state.phase==='gameOver'?'ended':state.phase,round:state.round,roundId:state.roundDefinitionId,
   seats:[{seatId:'solo-bot',index:0,controller:'bot',controlEpoch:0,kind:'bot',alive:state.playerHp>0,hp:state.playerHp,match:state}]};},
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  deferDuringSettlement(){return false;},
  claimBotOrbs(){/* Solo loot is delivered by Match commands, with no online orb prelude. */},
  handleBot(_seat,_epoch,command){return execute(s=>dispatch(s,command));},
 };
 const bots=new api.BotDriver(adapter,seed);
 try{
  for(let guard=0;state.phase!=='gameOver'&&guard<100000;guard++){
   if((state.phase==='choice'||state.phase==='preparation')&&clock.fireNext())continue;
   const operation=state.phase==='preparation'?api.match.startMatchCombat:api.randomOperation(state,fallback);
   execute(operation);
  }
  assert.equal(state.phase,'gameOver');
  return {seed,build:'bot',terminal:true,steps:probe.step,checkpoints:probe.checkpoints,continuations:probe.continuations,coverage:probe.coverage,failures:probe.failures};
 }finally{bots.dispose();}
}
async function worker(){
 const api=await load(option('--bundle')),index=Number(option('--index',0)),target=Number(option('--target',500));
 const runs=[];
 const publish=()=>writeFileSync(option('--result'),JSON.stringify({index,runs},null,2));
 const add=run=>{runs.push(run);publish();console.log(JSON.stringify({worker:index,seed:run.seed,build:run.build,checkpoints:run.checkpoints,failures:run.failures.length}));};
 if(args.includes('--server-only')){add(await serverMatch(api,Number(option('--seed',42))));return;}
 const replay=option('--replay-step');
 if(replay!==undefined){
  const seed=Number(option('--seed',42)),build=option('--build','cannon'),step=Number(replay),from=Number(option('--from-step',0));
  if(build==='random'){
   const run=api.randomWalk(seed,step+1,false,1,from),p=run.probe;
   add({seed,build,terminal:run.state.phase==='gameOver',steps:p.step,checkpoints:p.checkpoints,continuations:p.continuations,coverage:p.coverage,failures:p.failures});
  }else add(await routeMatch(api,seed,build,1,step));
  return;
 }
 const seed=42+index*997;
 const rate=Number(option('--checkpoint-rate',31));
 assert.ok(Number.isSafeInteger(rate)&&rate>0);
 const random=api.randomWalk(seed,100000,false,rate);
 assert.equal(random.state.phase,'gameOver');
 add({seed,build:'random',terminal:true,steps:random.probe.step,checkpoints:random.probe.checkpoints,continuations:random.probe.continuations,coverage:random.probe.coverage,failures:random.probe.failures});
 // Explicit random-only mode keeps restore authentication independent of the
 // separate economic route oracle. Default route coverage and assertions remain.
 if(args.includes('--random-only')){
  for(let n=1;runs.reduce((sum,r)=>sum+r.checkpoints,0)<target;n++){
   const nextSeed=seed+n*17,next=api.randomWalk(nextSeed,100000,false,rate);
   assert.equal(next.state.phase,'gameOver');
   add({seed:nextSeed,build:'random',terminal:true,steps:next.probe.step,checkpoints:next.probe.checkpoints,continuations:next.probe.continuations,coverage:next.probe.coverage,failures:next.probe.failures});
  }
  return;
 }
 // At least one full route per build across the four workers, plus real server bots.
 add(await routeMatch(api,seed,['cannon','sniper','mage'][index%3]));
 if(index===0)add(await serverMatch(api,seed));
 for(let n=1;runs.reduce((sum,r)=>sum+r.checkpoints,0)<target;n++)add(await routeMatch(api,seed+n*17,['cannon','sniper','mage'][(index+n)%3]));
}
async function main(){
 if(args.includes('--worker'))return worker();
 const workers=Number(option('--workers',4)),target=Number(option('--checkpoints',2000));
 assert.ok(Number.isSafeInteger(workers)&&workers>0&&workers<=16);
 assert.ok(Number.isSafeInteger(target)&&target>0);
 const directory=mkdtempSync(join(tmpdir(),'restore-fuzz-')),bundle=join(directory,'fuzz.mjs');
 buildSync({stdin:{contents:`export * from './tests/fixtures/restore-fuzz';
 export * as match from './src/simulation/match';
 export {restoreMatch,serializeMatch} from './src/simulation/serialization';
 export {BotDriver} from './src/server/room/bot-driver';
 export {ManualClock} from './src/server/room/clock';
`,resolveDir:resolve('.')},bundle:true,platform:'node',format:'esm',outfile:bundle,logLevel:'warning'});
 const extra=args.includes('--server-only')?['--server-only','--seed',option('--seed',42)]:args.includes('--replay-step')?['--replay-step',option('--replay-step'),'--seed',option('--seed',42),'--build',option('--build','cannon'),'--from-step',option('--from-step',0)]:[];
 const results=await Promise.all(Array.from({length:extra.length?1:workers},(_,index)=>new Promise((done,reject)=>{
  const file=join(directory,`worker-${index}.json`);
  const child=fork(__filename,['--worker','--bundle',bundle,'--index',String(index),'--target',String(Math.ceil(target/workers)),'--result',file,...extra,...(args.includes('--random-only')?['--random-only']:[]),'--checkpoint-rate',option('--checkpoint-rate',31)],{stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>{if(code!==0)return reject(Error(`worker ${index} exited ${code}; partial evidence: ${directory}`));done(JSON.parse(readFileSync(file,'utf8')));});
 })));
 const runs=results.flatMap(r=>r.runs),checkpoints=runs.reduce((n,r)=>n+r.checkpoints,0),failures=runs.flatMap(r=>r.failures);
 if(!extra.length)assert.ok(checkpoints>=target,`only ${checkpoints}/${target} checkpoints`);
 const report={node:process.version,mode:args.includes('--random-only')?'random-only':'mixed',checkpointRate:Number(option('--checkpoint-rate',31)),workers:results.length,checkpoints,entranceAttempts:checkpoints*3,continuations:runs.reduce((n,r)=>n+r.continuations,0),runs,failures};
 const output=resolve(option('-o','docs/V23_RESTORE_FUZZ_REPORT.md'));
 mkdirSync(require('node:path').dirname(output),{recursive:true});
 writeFileSync(output,`【完成】实现：tests/v23-restore-fuzz.test.ts:10、tests/fixtures/restore-fuzz.ts:28、scripts/fuzz-restore.cjs:1。\n【完成】模式 ${report.mode}，并行 ${results.length} 进程，${runs.filter(r=>r.terminal).length} 完整对局，${checkpoints} 检查点，${checkpoints*3} 恢复入口尝试，${report.continuations} 续跑比较。\n【未完成】${failures.length?'存在恢复失败，详见同名 JSON；需按 seed/step 回放定位。':'无。'}\n【需要我决定】无；约定见 docs/S13_RULES_GAP.md。\n【风险】${report.mode==='random-only'?'本次未覆盖构筑路线或 BotDriver；':''}结果仅覆盖本次种子与轨迹；真实联机席位不属于 Match 存档契约；服务器 BotDriver 使用单人薄适配器。\n【下一步】${failures.length?'最小化失败并补回归。':'保留命令与 JSON 供复跑。'}\n`);
 writeFileSync(`${output}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({output,checkpoints,failures:failures.length}));
 rmSync(directory,{recursive:true,force:true});
 if(failures.length)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
