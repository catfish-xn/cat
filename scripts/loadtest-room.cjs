#!/usr/bin/env node
'use strict';
// Load-only instrumentation. The temporary bundle imports the real server/client; no source is patched.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { replayErrorGuard, assertNoReplayErrors } = require('./replay-error-guard.cjs');
const ROOT = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const epochMs = () => performance.timeOrigin + performance.now();
const HELP = `Usage: node scripts/loadtest-room.cjs [options] > report.json
  --seats N          Human seats, 1..8 (default 8); the server fills other seats with bots.
                     Always opens 8 TestClient connections; unseated probes stay in lobby.
  --rounds N         Number of COMPLETE measured matches (default 3), not in-game rounds.
  --warmup N         Complete warm-up matches, excluded from measured results (default 1).
  --ops N            Maximum preparation commands per human per in-game round (default 4).
  --seed N           Server/action seed, uint32 (default 42).
  --prep-sec N       Preparation seconds (default 0.25, local mode only).
  --choice-sec N     Choice seconds (default 0.10, local mode only).
  --settle-sec N     Settlement seconds (default 0.05, local mode only).
  --playback-ms N    Cap ONLY presentation waiting (default 20); 'real' uses real waiting.
  --idle-ms N        Post-match quiescence before memory snapshot (default 1000).
  --timeout-sec N    Deadline per match (default 900).
  --url ws[s]://...  External dedicated test server; cannot measure its CPU/RSS/handlers.
  --help             This help. Requires Node 22 and npm ci (esbuild is a dev dependency).

stdout: one JSON document, including partial evidence on failure (exit 1).
stderr: progress. No thresholds, deployments, source edits, or automatic report files.
Default timing is accelerated LOAD mode, NOT normal-time gameplay acceptance.
Use node --expose-gc to force GC before each post-match memory sample (reported separately).
`;
function options(argv) {
  const result = { seats:8, rounds:3, warmup:1, ops:4, seed:42, prepSec:0.25, choiceSec:0.10,
    settleSec:0.05, playbackMs:20, idleMs:1000, timeoutSec:900, url:null };
  const names = {'seats':'seats','rounds':'rounds','warmup':'warmup','ops':'ops','seed':'seed',
    'prep-sec':'prepSec','choice-sec':'choiceSec','settle-sec':'settleSec','playback-ms':'playbackMs',
    'idle-ms':'idleMs','timeout-sec':'timeoutSec','url':'url'};
  const specified = new Set();
  for (let i=0;i<argv.length;i++) {
    const key=names[argv[i].replace(/^--/,'')];
    if (!argv[i].startsWith('--') || !key || argv[i+1]===undefined) throw new Error(`Unknown/missing option: ${argv[i]}`);
    const value=argv[++i]; specified.add(key);
    result[key]=key==='url'?value:key==='playbackMs'&&value==='real'?null:Number(value);
    if (key!=='url' && result[key]!==null && (!Number.isFinite(result[key]) || result[key]<0)) throw new Error(`Invalid ${key}`);
  }
  for (const key of ['seats','rounds','warmup','ops','seed','idleMs']) if (!Number.isSafeInteger(result[key])) throw new Error(`${key} must be an integer`);
  if (result.seats<1 || result.seats>8 || result.rounds<1 || result.rounds>100 || result.warmup>20 || result.ops>100
    || result.seed>0xffffffff || result.timeoutSec<=0 || result.prepSec<=0 || result.choiceSec<=0 || result.settleSec<=0) throw new Error('Options outside supported bounds');
  if (result.url) {
    const parsed=new URL(result.url);
    if (!['ws:','wss:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('--url must be a ws/wss URL without credentials');
    if (['prepSec','choiceSec','settleSec','playbackMs'].some(key=>specified.has(key))) throw new Error('External server controls phase/playback timing; omit local timing flags');
  }
  return result;
}
/** Nearest-rank percentiles, empty sample is null (never a fabricated zero). */
function summary(values) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  const percentile=p=>sorted.length?sorted[Math.ceil(sorted.length*p)-1]:null;
  return { count:sorted.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:sorted.at(-1)??null,
    mean:sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null };
}
function memoryTrend(samples, warmup) {
  const ends=samples.filter(s=>s.status===undefined||s.status==='complete').map(s=>s.server?.memoryEnd?.rssBytes).filter(Number.isFinite);
  return { postMatchRssBytes:ends, deltaBytes:ends.length>1?ends.at(-1)-ends[0]:null,
    strictlyIncreasing:ends.length>=3?ends.every((n,i)=>i===0||n>ends[i-1]):null,
    interpretation:ends.length<3?'insufficient-local-samples':warmup===0?'unwarmed-observation-only':'observation-only-not-a-leak-proof',
    gcBeforeSamples:samples.filter(s=>s.status===undefined||s.status==='complete').map(s=>s.server?.memoryEnd?.gcApplied??null),
    retainedState:'same server/lobby/process; last ended room remains reachable until next start; GC mode recorded per sample' };
}
function roundRow(rows, round) {
  if (!rows.has(round)) rows.set(round,{round,applicationBytes:{state:0,view:0,replay:0,receipt:0,lobby:0,error:0,other:0},
    messageCount:0,commands:[]});
  return rows.get(round);
}
function countMessage(rows,message,bytes,lastRound) {
  const round=message.round??message.view?.phase?.round??lastRound??0;
  const row=roundRow(rows,round),type=Object.hasOwn(row.applicationBytes,message.type)?message.type:'other';
  row.applicationBytes[type]+=bytes;row.messageCount++;
  return round;
}
function commandStats(commands,serverCommands,battles) {
  const index=new Map((serverCommands??[]).map(c=>[`${c.seatId}:${c.commandId}`,c]));
  const matched=commands.flatMap(c=>{const s=index.get(`${c.seatId}:${c.commandId}`);return s?[{c,s}]:[];});
  const errors={};for(const c of commands) if(!c.ok)errors[c.reason]=(errors[c.reason]??0)+1;
  return { attempts:commands.length,accepted:commands.filter(c=>c.ok).length,rejected:errors,
    byAction:commands.reduce((all,c)=>(all[c.type]=(all[c.type]??0)+1,all),{}),
    rttMs:summary(commands.map(c=>c.rttMs)),serverMatched:matched.length,
    serverQueueMs:serverCommands?summary(matched.map(({s})=>s.queueMs)):null,
    serverProcessingToReceiptMs:serverCommands?summary(matched.map(({s})=>s.processingMs)):null,
    serverQueueAndProcessingMs:serverCommands?summary(matched.map(({s})=>s.totalMs)):null,
    transportAndSchedulingResidualMs:serverCommands?summary(matched.map(({c,s})=>c.rttMs-s.totalMs)):null,
    negativeResidualCount:serverCommands?matched.filter(({c,s})=>c.rttMs<s.totalMs).length:null,
    networkOnlyMs:null,
    overlappingBattleCompute: battles?commands.filter(c=>battles.some(b=>c.sentEpochMs<b.endEpochMs&&c.receiptEpochMs>b.startEpochMs)).length:null };
}
/** Observe only synchronous work, preserving receiver, arguments, result and thrown error. */
function measureCall(call, record) {
  const started=performance.now(),startEpochMs=epochMs(),cpu=process.cpuUsage();let ok=false;
  try { const result=call();ok=true;return result; }
  finally {
    const wallMs=performance.now()-started,used=process.cpuUsage(cpu);
    record({wallMs,cpuUserMs:used.user/1000,cpuSystemMs:used.system/1000,startEpochMs,endEpochMs:startEpochMs+wallMs,ok});
  }
}
function observeBattleStart(start, records) {
  return function(...args) {
    const input=args[0],job=start.apply(this,args);
    const row={round:input.round,roundId:input.roundId,battleId:input.battleId,kind:input.roundKind,
      seats:input.seats.length,mirror:!!input.mirrorOf,wallMs:0,cpuUserMs:0,cpuSystemMs:0,maxSliceMs:0,complete:false,ok:true,slices:[]};
    records().push(row);
    return {advance(...advanceArgs) {
      const result=measureCall(()=>job.advance.apply(job,advanceArgs),slice=>{
        row.slices.push(slice);row.wallMs+=slice.wallMs;row.cpuUserMs+=slice.cpuUserMs;row.cpuSystemMs+=slice.cpuSystemMs;
        row.maxSliceMs=Math.max(row.maxSliceMs,slice.wallMs);row.ok&&=slice.ok;
      });
      if(result!==null)row.complete=true;
      return result;
    }};
  };
}
function sampleMemory(collect=false, runtime=process, gc=globalThis.gc) {
  const gcApplied=collect&&typeof gc==='function',started=performance.now();
  if(gcApplied)gc();
  const gcWallMs=gcApplied?performance.now()-started:null,usage=runtime.memoryUsage();
  return {rssBytes:usage.rss,heapUsedBytes:usage.heapUsed,processLifetimeMaxRssBytes:runtime.resourceUsage().maxRSS*1024,gcApplied,gcWallMs};
}
async function bundle(temp) {
  const esbuild=require('esbuild');
  const source=`
export { createGameServer } from './src/server/net/server';
export { TestClient } from './src/server/net/test-client';
export { RealClock } from './src/server/room/real-clock';
export { Room } from './src/server/room/room';
export { WriteQueue } from './src/server/net/write-queue';
export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver';
export { WebSocket } from 'ws';
export { MATCH_RULES } from './src/simulation/match-rules';
export { UNIT_DEFINITIONS } from './src/simulation/units';
export { validateCombine, validateEquip } from './src/simulation/inventory';
export { validateDeployment } from './src/simulation/game';
`;
  const built=await esbuild.build({stdin:{contents:source,resolveDir:ROOT,sourcefile:'loadtest-bridge.ts'},bundle:true,
    platform:'node',format:'cjs',target:'node22',write:false,logLevel:'silent'});
  const file=path.join(temp,'bridge.cjs');fs.writeFileSync(file,built.outputFiles[0].contents);return file;
}

/** A separate real server process; only observation wrappers + an explicit playback-only clock cap. */
async function worker(file,config) {
  const api=require(file), {WebSocket,Room,WriteQueue,TwoSidedBattleResolver,RealClock}=api;
  let server,activeInbound=null,commands=[],battles=[],freezes=[],slices=[],game=0,cappedWaits=0,replayFailures=[];
  const inbound=new WeakMap(), seatIds=new WeakMap();
  const sendIpc=value=>{if(process.connected)process.send(value);};
  // Observe ws message delivery -> WriteQueue task start -> receipt serialization/enqueue.
  const emit=WebSocket.prototype.emit,send=WebSocket.prototype.send,push=WriteQueue.prototype.push;
  WebSocket.prototype.emit=function(type,...args) {
    if (type!=='message')return emit.call(this,type,...args);
    let message;try{message=JSON.parse(args[0].toString());}catch{return emit.call(this,type,...args);}
    if (message.type!=='command')return emit.call(this,type,...args);
    const item={seatId:seatIds.get(this),commandId:message.commandId,round:message.round,type:message.command?.type,
      arrival:performance.now(),started:null};
    inbound.set(this,item);const previous=activeInbound;activeInbound=item;
    try{return emit.call(this,type,...args);}finally{activeInbound=previous;inbound.delete(this);}
  };
  WriteQueue.prototype.push=function(task) {
    const item=activeInbound;
    if (!item || item.queued) return push.call(this,task);
    item.queued=true;
    return push.call(this,()=>{item.started=performance.now();return task();});
  };
  WebSocket.prototype.send=function(data,...args) {
    // Only tiny receipts are parsed; do not parse or clone battle/state payloads in the observer.
    if(typeof data==='string' && data.startsWith('{"type":"receipt"')) {
      const at=performance.now(),receipt=JSON.parse(data);
      if(receipt.ok&&['joined','resumed'].includes(receipt.result?.kind))seatIds.set(this,receipt.result.seatId);
      const item=inbound.get(this);
      if(item&&receipt.commandId===item.commandId)commands.push({seatId:item.seatId,commandId:item.commandId,round:item.round,type:item.type,
        queueMs:(item.started??item.arrival)-item.arrival,processingMs:at-(item.started??item.arrival),totalMs:at-item.arrival,ok:receipt.ok});
    }
    return send.call(this,data,...args);
  };
  const start=TwoSidedBattleResolver.prototype.startBattle;
  if(typeof start!=='function')throw new Error('Resolver instrumentation API changed: startBattle missing');
  TwoSidedBattleResolver.prototype.startBattle=observeBattleStart(start,()=>battles);
  // B8 freeze is setup only. Full Room slices also include the separate replay warmup,
  // settlement planning and publication, outside the inner resolver's advance calls.
  for(const [name,records] of [['freezeAndResolve',()=>freezes],['resolveSlice',()=>slices]]) {
    const original=Room.prototype[name];
    if(typeof original!=='function')throw new Error(`Room instrumentation API changed: ${name} missing`);
    Room.prototype[name]=function(...args) {
      const round=this.state.round,kind=this.state.roundKind;
      return measureCall(()=>original.apply(this,args),sample=>records().push({round,kind,...sample}));
    };
  }
  class LoadClock extends RealClock {
    schedule(at,fn) {
      if(config.playbackMs!==null&&server?.room?.state.phase==='battle') {
        cappedWaits++;return super.schedule(this.now()+Math.min(config.playbackMs,Math.max(0,at-this.now())),fn);
      }
      return super.schedule(at,fn);
    }
  }
  const clock=new LoadClock();
  const observeReplayError=replayErrorGuard(error=>{replayFailures.push(error.message);sendIpc({type:'error',error:error.message});});
  server=await api.createGameServer({port:0,host:'127.0.0.1',seed:config.seed,clock,
    timings:{preparationMs:config.prepSec*1000,choiceMs:config.choiceSec*1000,settlementMs:config.settleSec*1000},
    log:line=>{observeReplayError(line+'\n');if(/failed|error/i.test(line))process.stderr.write(`[server] ${line}\n`);}});
  sendIpc({type:'ready',port:server.port,pid:process.pid,memory:sampleMemory()});
  process.on('message',async message=>{
    try {
      if(message.type==='begin') {game=message.game;commands=[];battles=[];freezes=[];slices=[];cappedWaits=0;replayFailures=[];sendIpc({type:'begun',game,memory:sampleMemory()});}
      if(message.type==='snapshot')sendIpc({type:'snapshot',game,commands,battles,freezes,slices,replayFailures,sliceWallMs:summary(slices.map(s=>s.wallMs)),cappedWaits,memoryEnd:sampleMemory(true),
        roomPhase:server.room?.state.phase,roomFault:server.room?.state.fault,connections:server.connectionCount});
      if(message.type==='stop') {await server.close();clock.dispose();process.exit(0);}
    }catch(error){sendIpc({type:'error',error:error.message});}
  });
  process.on('disconnect',()=>{clock.dispose();process.exit(1);});
}

/** Generate conservative candidates using only visible assets. Server remains authority. */
function candidates(state,api) {
  const units=state.preparation.units.filter(u=>u.team==='player'),items=state.items??[],choice=state.pendingChoice;
  if(choice) {
    const identity={choiceId:choice.choiceId,generation:choice.generation};
    return choice.step==='target'?units.map(u=>({type:'anomalyTarget',...identity,unitId:u.id})):
      choice.offers.map(definitionId=>({type:'choose',...identity,definitionId}));
  }
  if(state.phase!=='preparation')return [];
  const result=[{type:'shopLock',locked:!state.shop.locked,generation:state.shop.generation}];
  if(state.gold>=api.MATCH_RULES.rerollCost)result.push({type:'reroll'});
  if(state.gold>=api.MATCH_RULES.xpPurchaseCost&&state.level<api.MATCH_RULES.maxLevel)result.push({type:'buyXp'});
  // A visible available slot owns its shared-pool reservation; leave merging into a full bench to other tests.
  if(units.filter(u=>u.location.kind==='bench').length<state.preparation.benchSize)state.shop.slots.forEach((s,slot)=>{
    if(s.status==='available'&&api.UNIT_DEFINITIONS[s.definitionId]?.cost<=state.gold)result.push({type:'buy',slot,generation:state.shop.generation});
  });
  const board=state.preparation.board,zone=board.deploymentZones.player;
  const deployed=units.filter(u=>u.location.kind==='board').length;
  for(const unit of units) {
    if(units.length>1)result.push({type:'sell',unitId:unit.id});
    const targets=[];
    if(unit.location.kind==='board'||deployed<state.level)for(let row=zone.firstRow;row<=zone.lastRow;row++)for(let col=0;col<board.columns;col++)targets.push({kind:'board',cell:{col,row}});
    for(let slot=0;slot<state.preparation.benchSize;slot++)targets.push({kind:'bench',slot});
    for(const target of targets)if(!api.validateDeployment(state.preparation,unit.id,target))result.push({type:'deploy',unitId:unit.id,target});
  }
  const inventory=items.filter(i=>i.location.kind==='inventory');
  for(let i=0;i<inventory.length;i++) {
    for(let j=i+1;j<inventory.length;j++)if(api.validateCombine(items,inventory[i].id,inventory[j].id).allowed)result.push({type:'combine',a:inventory[i].id,b:inventory[j].id});
    for(const unit of units)for(let slot=0;slot<3;slot++)if(api.validateEquip(items,state.preparation,inventory[i].id,unit.id,slot).allowed)result.push({type:'equip',itemId:inventory[i].id,unitId:unit.id,slot});
  }
  return result;
}
function randomPicker(seed) {
  let rng=seed>>>0;
  const pick=array=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return array[Math.floor(rng*array.length/4294967296)];};
  return list=>{const type=pick([...new Set(list.map(c=>c.type))]);return pick(list.filter(c=>c.type===type));};
}
function procRss(pid) {
  if(process.platform!=='linux')return null;
  try{const text=fs.readFileSync(`/proc/${pid}/status`,'utf8');return Number(text.match(/^VmRSS:\s+(\d+)/m)?.[1])*1024||null;}catch{return null;}
}
async function main(config) {
  if(!/^v22\./.test(process.version))throw new Error(`Use Node 22.x, actual ${process.version}`);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cat-room-load-'));
  let child,clients=[],poll,activeReport=null,activeContext=null,workerError=null,shuttingDown=false,snapshotWorker=null;
  const sockets=new Set();
  const report={schema:'room-loadtest-v2',node:process.version,commit:null,scriptSha256:createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),host:{platform:process.platform,arch:process.arch,
    logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},config:{...config,url:config.url?new URL(config.url).origin:null},
    mode:config.url?'external':'instrumented-local',status:'running',warmups:[],matches:[],limitations:[
      'RTT includes transport, event-loop stalls, compression and client scheduling; residual is NOT pure network latency.',
      'Server queue starts at decoded ws message delivery; pre-delivery event-loop stalls remain in RTT/residual.',
      'Battle timings sum inner resolver advance calls only; full Room slice timings also capture replay warmup and settlement/publication. No per-tick frames exist.',
      'Eight connections do not imply eight active human players when --seats is below eight.',
      'Default 250ms preparation is shorter than the 300ms bot interval; this is not full bot/normal-time gameplay load.',
      'No thresholds or browser/playback/public-network acceptance; current integration capabilities are not supplied by this script.'
    ]};
  try{report.commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();}catch{}
  const signals=()=>{workerError=new Error('Interrupted');};process.once('SIGINT',signals);process.once('SIGTERM',signals);
  try {
    const file=await bundle(temp),api=require(file);
    globalThis.WebSocket=class LoadSocket extends api.WebSocket {
      constructor(url) {
        super(url,{handshakeTimeout:10_000});sockets.add(this);this.once('close',()=>sockets.delete(this));
      }
    }; // TestClient browser-compatible transport, with ws compression/counters.
    const rpcWaiters=[];
    const rpc=(type,payload={})=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{const i=rpcWaiters.findIndex(w=>w.resolve===resolve);if(i>=0)rpcWaiters.splice(i,1);reject(new Error(`Worker ${type} timeout`));},60_000);
      rpcWaiters.push({type,resolve,reject,timer});
      if(type!=='ready')child.send({type:type==='begun'?'begin':type,...payload});
    });
    let url=config.url;
    if(!url) {
      child=fork(__filename,['--worker',file,JSON.stringify(config)],{stdio:['ignore','ignore','inherit','ipc']});
      child.on('message',message=>{
        if(message.type==='error'){workerError=new Error(message.error);return;}
        const i=rpcWaiters.findIndex(w=>w.type===message.type);if(i>=0){const [w]=rpcWaiters.splice(i,1);clearTimeout(w.timer);w.resolve(message);}
      });
      child.on('error',error=>{workerError=error;});
      child.on('exit',(code,signal)=>{if(!shuttingDown)workerError=new Error(`Server exited: ${code??signal}`);
        for(const w of rpcWaiters.splice(0)){clearTimeout(w.timer);w.reject(workerError??new Error('Server closed'));}});
      snapshotWorker=()=>rpc('snapshot');
      const ready=await rpc('ready');url=`ws://127.0.0.1:${ready.port}`;report.serverPid=ready.pid;report.memoryAtStart=ready.memory;
    }else report.limitations.push('External mode: server timings, battle compute, RSS and overlap are null; phase timing/seed/bot configuration belong to that server.');
    const metadata=new WeakMap();
    const originalMessage=api.TestClient.prototype.onMessage;
    if(typeof originalMessage!=='function')throw new Error('TestClient observer API changed: onMessage missing');
    api.TestClient.prototype.onMessage=function(text) {
      originalMessage.call(this,text);
      const message=this.inbox.at(-1),meta=metadata.get(this);
      if(meta&&message){meta.round=countMessage(meta.rows,message,Buffer.byteLength(text),meta.round);
        if(message.type==='view'&&message.view.fault)meta.fault=message.view.fault;
        if(message.type==='error')meta.errors.push(message.code);}
      // TestClient is an evidence recorder by default. Bound its retained snapshots for sustained load.
      const latest=new Map();for(const entry of this.inbox)if(['view','state','lobby'].includes(entry.type))latest.set(entry.type,entry);
      this.inbox.splice(0,this.inbox.length,...latest.values());
    };
    for(let index=0;index<config.warmup+config.rounds;index++) {
      if(workerError)throw workerError;
      const warmup=index<config.warmup,number=warmup?index+1:index-config.warmup+1;
      process.stderr.write(`[load] ${warmup?'warmup':'match'} ${number}: ${config.seats} humans + ${8-config.seats} server bots\n`);
      const rows=new Map(),started=performance.now(),m={number,warmup,status:'running',rounds:[],server:null};activeReport=m;
      if(warmup)report.warmups.push(m);else report.matches.push(m);
      const begin=child?await rpc('begun',{game:index+1}):null;
      let rssPeak=begin?.memory.rssBytes??null;
      if(child)poll=setInterval(()=>{const rss=procRss(child.pid);if(rss!==null)rssPeak=Math.max(rssPeak??0,rss);},100);
      const commands=[],errors=[];activeContext={rows,commands,errors,started,peak:()=>rssPeak};
      for(let i=0;i<8;i++) {
        const client=await api.TestClient.connect(url,Math.min(config.timeoutSec*1000,60_000));clients.push(client);
        metadata.set(client,{rows,round:0,errors});
      }
      for(let i=0;i<config.seats;i++){const receipt=await clients[i].join(`load-${index+1}-${i+1}`);if(!receipt.ok)throw new Error(`join: ${receipt.reason}`);}
      const start=await clients[0].start();if(!start.ok)throw new Error(`start: ${start.reason}`);
      let done=false;
      const tasks=clients.slice(0,config.seats).map(async(client,seatIndex)=>{
        const counts=new Map(),choiceCounts=new Map(),pick=randomPicker((config.seed+seatIndex+index*8)>>>0);
        while(!done) {
          if(workerError)throw workerError;
          if(performance.now()-started>config.timeoutSec*1000)throw new Error('Match deadline exceeded');
          const view=client.view,state=client.state,meta=metadata.get(client);
          if(!client.isOpen)throw new Error('Client connection closed before game ended');
          if(meta.fault)throw new Error(`Room fault: ${meta.fault.kind} ${meta.fault.detail}`);
          if(view?.phase.kind==='ended') {
            if(!view.ranking||view.ranking.length!==8||new Set(view.ranking.map(s=>s.rank)).size!==8)throw new Error('Ended without complete ranking');
            return view;
          }
          const round=view?.phase.round,choice=!!state?.pendingChoice;
          const allowed=view&&state&&state.round===round&&view.seats.find(s=>s.seatId===client.seatId)?.alive
            &&(view.phase.kind==='preparation'||view.phase.kind==='choice'&&choice);
          const count=(choice?choiceCounts:counts).get(round)??0;
          if(!allowed||count>=(choice?16:config.ops)){await delay(10);continue;}
          const list=candidates(state,api);if(!list.length){await delay(10);continue;}
          const action=pick(list),commandId=client.commandCounter,t0=performance.now(),sentEpochMs=epochMs();
          (choice?choiceCounts:counts).set(round,count+1);
          const receipt=await client.command(action),rttMs=performance.now()-t0;
          commands.push({seatId:client.seatId,commandId,round,type:action.type,phase:view.phase.kind,ok:receipt.ok,
            reason:receipt.ok?null:receipt.reason,rttMs,sentEpochMs,receiptEpochMs:epochMs()});
          if(receipt.ok&&receipt.result.kind==='applied') {
            while(!done&&client.stateRevision<receipt.result.seatRevision) {
              if(!client.isOpen||workerError)throw workerError??new Error('Disconnected awaiting state');
              if(performance.now()-t0>60_000)throw new Error('Accepted receipt without corresponding state');
              await delay(5);
            }
          }
          else if(!['stale-round','seat-revision-mismatch','wrong-phase','seat-eliminated','pool-empty'].includes(receipt.reason))throw new Error(`Unexpected command refusal: ${action.type}/${receipt.reason}`);
          await delay(20); // respect the production per-connection rate limit, including choices.
        }
      });
      let views;
      try{views=await Promise.all(tasks);}catch(error){for(const c of clients)c.socket?.terminate();throw error;}finally{done=true;await Promise.allSettled(tasks);}
      m.durationMs=performance.now()-started;m.finalRound=views[0].phase.round;
      m.ranking=views[0].ranking.map(s=>({seatId:s.seatId,rank:s.rank,kind:s.kind}));
      m.socketBytesRead=clients.reduce((n,c)=>n+(c.socket?._socket?.bytesRead??0),0);
      await Promise.all(clients.map(c=>c.close()));clients=[];
      await delay(config.idleMs);
      const measured=child?await rpc('snapshot'):null;
      clearInterval(poll);poll=null;
      m.server=measured?{...measured,observedMatchPeakRssBytes:Math.max(rssPeak??0,measured.memoryEnd.rssBytes)}:null;
      if(measured&&measured.connections!==0)throw new Error('Server connections did not drain');
      const prep=commands.filter(c=>c.phase==='preparation');
      m.preparationCommands=commandStats(prep,measured?.commands,measured?.slices);
      m.choiceCommands=commandStats(commands.filter(c=>c.phase==='choice'),measured?.commands,measured?.slices);
      m.rounds=[...rows.values()].sort((a,b)=>a.round-b.round).map(row=>{
        const {commands:_,...bytes}=row;
        const battles=measured?.battles.filter(b=>b.round===row.round)??null;
        return {...bytes,preparationCommands:commandStats(prep.filter(c=>c.round===row.round),measured?.commands,measured?.slices.filter(s=>s.round===row.round)),
          battles,freeze:measured?.freezes.find(b=>b.round===row.round)??null,
          slices:measured?.slices.filter(s=>s.round===row.round)??null};
      });
      m.clientErrors=errors;
      if(measured&&prep.length&&m.preparationCommands.serverMatched!==prep.length)throw new Error('Instrumentation did not correlate every preparation command');
      if(measured&&(!measured.battles.length||measured.battles.some(b=>!b.complete||!b.ok||!b.slices.length)))throw new Error('Missing/unfinished battle computation samples');
      if(!m.rounds.some(row=>row.applicationBytes.replay>0))throw new Error('No combat replay received');
      if(measured)assertNoReplayErrors(measured.replayFailures);
      if(errors.length)throw new Error(`Client errors: ${[...new Set(errors)].join(',')}`);
      m.status='complete';
      // Raw timing samples remain in server.commands; no tokens, payloads, or full combat states are retained.
      process.stderr.write(`[load] completed ${m.finalRound} rounds in ${(m.durationMs/1000).toFixed(1)}s; RTT p95=${m.preparationCommands.rttMs.p95?.toFixed(2)??'n/a'}ms\n`);
      activeReport=null;activeContext=null;
    }
    report.status='complete';report.memoryTrend=memoryTrend(report.matches,config.warmup);
  }catch(error) {
    report.status='failed';report.error=error.message;
    if(activeReport) {
      activeReport.status='failed';
      if(activeContext) {
        const {rows,commands,errors,started,peak}=activeContext;
        activeReport.durationMs=performance.now()-started;activeReport.clientErrors=errors;
        let measured=null;
        if(snapshotWorker&&child?.connected&&!workerError) {
          try{measured=await Promise.race([snapshotWorker(),delay(1000).then(()=>null)]);}catch{}
        }
        if(measured)activeReport.server={...measured,observedMatchPeakRssBytes:Math.max(peak()??0,measured.memoryEnd.rssBytes)};
        activeReport.rounds=[...rows.values()].map(({commands:_,...row})=>({...row,
          preparationCommands:commandStats(commands.filter(c=>c.phase==='preparation'&&c.round===row.round),measured?.commands,measured?.slices),
          battles:measured?.battles.filter(b=>b.round===row.round)??null,freeze:measured?.freezes.find(b=>b.round===row.round)??null,
          slices:measured?.slices.filter(s=>s.round===row.round)??null}));
      }
    }
    report.memoryTrend=memoryTrend(report.matches,config.warmup);process.exitCode=1;
  }finally {
    clearInterval(poll);shuttingDown=true;
    await Promise.allSettled(clients.map(c=>Promise.race([c.close(),delay(2000).then(()=>c.socket?.terminate())])));
    for(const socket of sockets)socket.terminate();
    if(child&&child.exitCode===null){if(child.connected)child.send({type:'stop'});
      await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);
      if(child.exitCode===null)child.kill('SIGKILL');}
    fs.rmSync(temp,{recursive:true,force:true});process.removeListener('SIGINT',signals);process.removeListener('SIGTERM',signals);
  }
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  return report;
}
module.exports={options,summary,memoryTrend,countMessage,commandStats,candidates,randomPicker,observeBattleStart,sampleMemory};
if(require.main===module) {
  if(process.argv[2]==='--worker')worker(process.argv[3],JSON.parse(process.argv[4])).catch(error=>{console.error(error);process.exit(1);});
  else if(process.argv.includes('--help'))process.stdout.write(HELP);
  else Promise.resolve().then(()=>main(options(process.argv.slice(2)))).catch(error=>{
    process.stdout.write(JSON.stringify({schema:'room-loadtest-v2',status:'failed',error:error.message})+'\n');process.exitCode=1;
  });
}
