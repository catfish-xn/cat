// Fixed nine-unit B8 fixture; one warmup and five measurements, with byte hashes.
// node scripts/mp-sim-stage-probe.cjs <source-root> <output.json>
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),{createHash}=require('node:crypto');
const esbuild=require('esbuild');
const root=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
(async()=>{
const file=output+'.bundle.cjs';const built=await esbuild.build({stdin:{contents:"export { createMatch,snapshotForBattle,compileBattle,startTwoSidedBattle,proposeSettlement,startCombatReplay } from './src/server-entry'; export {getCatalogRoundById} from './src/simulation/round-selectors';",resolveDir:root},bundle:true,platform:'node',format:'cjs',write:false});fs.writeFileSync(file,built.outputFiles[0].contents);
try{
const api=require(file),rows=[];let hashes;
for(let repeat=0;repeat<6;repeat++){
const base=api.createMatch(42),round=api.getCatalogRoundById('2-1'),names=['irelia','leona','tristana','maddie','lux','darius','irelia','leona','lux'];
const state={...base,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},items:[],preparation:{...base.preparation,units:names.map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};
const a=api.snapshotForBattle(state,'A'),b=api.snapshotForBattle(state,'B'),row={repeat,warmup:repeat===0};
const time=(name,fn)=>{const started=performance.now(),value=fn();row[name]=performance.now()-started;return value;};
const input=time('compileMs',()=>api.compileBattle(a,b,42,{battleId:'resumable'})),task=time('startMs',()=>api.startTwoSidedBattle(input));
let result=null,worst=0,last=0;
while(!result){const t=performance.now();result=task.advance(1);last=performance.now()-t;worst=Math.max(worst,last);}
row.finishMs=last;row.worstBattleAdvanceMs=worst;
const proposal=time('settlementMs',()=>api.proposeSettlement(result));
const replayTask=time('replayStartMs',()=>api.startCombatReplay(result));let replay=null;worst=0;
while(!replay){const t=performance.now();replay=replayTask.advance(1);worst=Math.max(worst,performance.now()-t);}
row.worstReplayAdvanceMs=worst;row.ticks=result.terminal.tick;row.events=result.events.length;
const current={battle:sha(result),proposal:sha(proposal),replay:sha(replay)};if(hashes)assert.deepEqual(current,hashes);hashes=current;
rows.push(row);
}
const measured=rows.filter(r=>!r.warmup),medians={};for(const key of Object.keys(measured[0]).filter(k=>k.endsWith('Ms')))medians[key]=measured.map(r=>r[key]).sort((a,b)=>a-b)[2];
const report={root,fixture:'unchanged tests/b8-resumable-battle-helper.ts nine-unit input',warmups:1,measurements:5,rows,medians,hashes};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{fs.unlinkSync(file);}
})().catch(e=>{console.error(e);process.exitCode=1;});
