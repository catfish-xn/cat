#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { options, summary } = require('./loadtest-room.cjs');

const HELP = `Usage: node scripts/loadtest-compare.cjs BEFORE_DIR AFTER_DIR [options]
  --out DIR          Reports directory (default artifacts/loadtest-compare); must not exist.
  --rounds N         Complete measured matches per version (default 6).
  --warmup N         Warm-up matches per version (default 1).
Other loadtest-room options are forwarded identically; seats is fixed at 8, --url forbidden.
Runs BEFORE then AFTER serially with the same Node executable and --expose-gc.
Each directory must already have scripts/loadtest-room.cjs and installed dependencies.
Writes before.json, after.json, comparison.json and comparison.md. Progress goes to stderr.
Missing metrics remain null; for new memory metrics, install the sampling patch in BOTH versions.
No performance thresholds or pass/fail verdict. Execution errors still exit nonzero.
`;
const METRICS = ['rssBytes','gcHeapUsedBytes','heapTotalBytes','rssAnonBytes','worstRttP99Ms','maxSliceMs'];
const finite = value => Number.isFinite(value) ? value : null;
const maximum = values => summary(values).max;

function summarizeReport(report) {
  const matches=(report.matches??[]).filter(m=>m.status==='complete').map((m,index)=>{
    const memory=m.server?.memoryEnd;
    return {match:index+1,finalRound:m.finalRound,gcApplied:memory?.gcApplied??null,
      rssBytes:finite(memory?.rssBytes),gcHeapUsedBytes:memory?.gcApplied===true?finite(memory.heapUsedBytes):null,
      heapTotalBytes:finite(memory?.heapTotalBytes),rssAnonBytes:finite(memory?.rssAnonBytes),
      worstRttP99Ms:maximum([m.preparationCommands?.rttMs?.p99,m.choiceCommands?.rttMs?.p99,
        ...(m.rounds??[]).map(r=>r.preparationCommands?.rttMs?.p99)]),
      maxSliceMs:finite(m.server?.sliceWallMs?.max)};
  });
  return {status:report.status,completedMatches:matches.length,matches,
    metrics:Object.fromEntries(METRICS.map(key=>{
      const stats=summary(matches.map(m=>m[key]));
      return [key,{count:stats.count,mean:stats.mean,worst:stats.max}];
    }))};
}
function markdown(report) {
  const number=value=>value===null?'null':String(Math.round(value*100)/100);
  const lines=['# Serial load-test comparison','',
    'Memory values are bytes; timing values are ms. Worst = maximum; null = unavailable.',
    'GC heapUsed is included only when gcApplied is true. Means exclude nulls; counts are shown.',
    'RTT = maximum of preparation/choice match p99 and per-round preparation p99, not a pooled percentile.',
    'Warm-up matches are excluded. No performance verdict.',''];
  for(const side of ['before','after']) {
    const data=report[side];
    lines.push(`## ${side}`, '', `Status: ${data.status}; completed matches: ${data.completedMatches}.`, '',
      '| Match | Final round | GC applied | RSS bytes | GC heapUsed bytes | heapTotal bytes | RssAnon bytes | Worst RTT p99 ms | Max slice ms |',
      '| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    for(const m of data.matches)lines.push(`| ${[m.match,m.finalRound,m.gcApplied,...METRICS.map(k=>number(m[k]))].join(' | ')} |`);
    lines.push('');
  }
  lines.push('## Means and worst values','','| Metric | Before count | Before mean | Before worst | After count | After mean | After worst |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for(const key of METRICS) {
    const a=report.before.metrics[key],b=report.after.metrics[key];
    lines.push(`| ${key} | ${[a.count,a.mean,a.worst,b.count,b.mean,b.worst].map(number).join(' | ')} |`);
  }
  return lines.join('\n')+'\n';
}
function compareOptions(argv) {
  if(argv.length<2||argv[0].startsWith('--')||argv[1].startsWith('--'))throw new Error('Provide BEFORE_DIR and AFTER_DIR');
  const directories=argv.slice(0,2).map(dir=>path.resolve(dir));
  let out=path.resolve('artifacts/loadtest-compare');
  const forwarded=['--seats','8','--rounds','6','--warmup','1'];
  for(let i=2;i<argv.length;i+=2) {
    const key=argv[i],value=argv[i+1];
    if(value===undefined)throw new Error(`Missing value: ${key}`);
    if(key==='--out')out=path.resolve(value);
    else {
      if(key==='--url'||key==='--seats')throw new Error('Comparison uses local servers and exactly 8 seats');
      forwarded.push(key,value);
    }
  }
  const config=options(forwarded);
  return {directories,out,forwarded,config};
}
async function runVersion(directory,args,file) {
  const fd=fs.openSync(file,'wx');
  try {
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['--expose-gc',path.join(directory,'scripts/loadtest-room.cjs'),...args],
        {cwd:directory,stdio:['ignore',fd,'inherit']});
      child.once('error',reject);
      child.once('close',(code,signal)=>code===0?resolve():reject(new Error(`Load test execution failed (${code??signal}); raw report: ${file}`)));
    });
  } finally {fs.closeSync(fd);}
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
async function main(argv) {
  const {directories,out,forwarded,config}=compareOptions(argv);
  for(const dir of directories)if(!fs.existsSync(path.join(dir,'scripts/loadtest-room.cjs')))throw new Error(`Missing loadtest-room.cjs: ${dir}`);
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
  const report={schema:'room-loadtest-compare-v1',node:process.version,platform:process.platform,host:os.hostname(),
    directories,config,order:['before','after'],gcRequested:true};
  for(const [index,side] of report.order.entries()) {
    process.stderr.write(`[compare] ${side}: ${directories[index]}\n`);
    report[side]=summarizeReport(await runVersion(directories[index],forwarded,path.join(out,`${side}.json`)));
  }
  fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(out,'comparison.md'),markdown(report));
  process.stdout.write(`Reports: ${out}\n`);
}
module.exports={summarizeReport,markdown,compareOptions};
if(require.main===module) {
  if(process.argv.includes('--help'))process.stdout.write(HELP);
  else main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
