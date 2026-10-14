/* Read-only analysis of diagnose-m8-b5-click-latency.cjs output.
 * Usage: node scripts/analyze-m8-b5-click-latency.cjs --study=artifacts/m8-b5-click-study
 * CPU samples are sorted by accumulated timestamp (V8 can deliver out of order),
 * attributed until the next sample, and clipped to capture/bubble trace marks.
 * Inclusive stack times and nested trace categories must not be added together. */
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),out=path.resolve(process.argv.find(a=>a.startsWith('--study='))?.slice(8)??'artifacts/m8-b5-click-study');
const {TraceMap,originalPositionFor}=require(path.join(root,'node_modules/@jridgewell/trace-mapping'));
const metadata=JSON.parse(fs.readFileSync(path.join(out,'metadata.json')));
const summaries=JSON.parse(fs.readFileSync(path.join(out,'results.json')));
const rounded=n=>Math.round(n*1000)/1000;
const rows=summaries.map(x=>{
 const r=JSON.parse(fs.readFileSync(path.join(out,x.name,'report.json'))),m=r.measurement,d=r.driver,p=r.probe,f=m.handlers[0],s=m.handlers[1];
 return {name:x.name,profile:x.profile,label:x.label,passed:x.passed,browser:r.browser,startedAt:r.startedAt,loadAtStart:r.loadAtStart,
  clickGapMs:rounded(m.clickGapMs),firstHandlerMs:rounded(f.duration),afterHandlerMs:rounded(m.clickGapMs-f.duration),
  firstTapApiMs:rounded(m.firstTapApiMs),ackAfterHandlerMs:rounded(d.timeOrigin+d.firstEnd-(p.timeOrigin+f.at+f.duration)),
  waitApiMs:rounded(m.waitApiMs),secondApiToClickMs:rounded(p.timeOrigin+s.at-d.timeOrigin-d.secondStart),secondHandlerMs:rounded(s.duration),
  longTasksBetweenClicks:m.longTasks.filter(t=>t.startTime+t.duration>f.at&&t.startTime<s.at).map(t=>({relativeToFirstClickMs:rounded(t.startTime-f.at),durationMs:t.duration}))};
});
const stats={};
for(const label of ['base','b5']){const r=rows.filter(r=>!r.profile&&r.label===label);stats[label]={samples:r.length,failed:r.filter(r=>!r.passed).length};for(const key of ['clickGapMs','firstHandlerMs','afterHandlerMs','ackAfterHandlerMs','waitApiMs','secondApiToClickMs']){const a=r.map(r=>r[key]).sort((a,b)=>a-b);stats[label][key]={min:a[0],median:a[Math.floor(a.length/2)],max:a.at(-1),mean:rounded(a.reduce((a,b)=>a+b,0)/a.length)};}}
const profiles=[];
for(const x of summaries.filter(x=>x.profile)){
 const r=JSON.parse(fs.readFileSync(path.join(out,x.name,'report.json'))),p=JSON.parse(fs.readFileSync(path.join(out,x.name,'cpu-profile.json'))),t=JSON.parse(fs.readFileSync(path.join(out,x.name,'trace.json'))).traceEvents;
 const maps={};for(const f of fs.readdirSync(path.join(metadata.builds[x.label],'assets')).filter(f=>f.endsWith('.map')))maps[f.slice(0,-4)]=new TraceMap(JSON.parse(fs.readFileSync(path.join(metadata.builds[x.label],'assets',f))));
 const position=cf=>{const map=maps[path.basename(cf.url??'')];if(!map)return `${cf.functionName||'(anonymous)'} ${cf.url||''}:${cf.lineNumber+1}`;const orig=originalPositionFor(map,{line:cf.lineNumber+1,column:cf.columnNumber});return `${orig.name||cf.functionName||'(anonymous)'} ${orig.source}:${orig.line}`;};
 const nodes=new Map(p.nodes.map(n=>[n.id,n]));for(const n of p.nodes)for(const id of n.children??[])nodes.get(id).parent=n.id;
 const marks=t.filter(e=>e.name.startsWith('click-study:')).sort((a,b)=>a.ts-b.ts),first=marks.find(e=>e.name.includes(':capture:mobile:continue')),bubble=marks.find(e=>e.name.includes(':bubble:')&&e.name.replace(':bubble:',':capture:')===first.name),second=marks.find(e=>e.ts>bubble.ts&&e.name.includes(':capture:'));
 const windows={handler:[first.ts,bubble.ts],between:[bubble.ts,second.ts]};
 let sampleAt=p.startTime;const orderedSamples=p.samples.map((id,i)=>({id,at:sampleAt+=p.timeDeltas[i]})).sort((a,b)=>a.at-b.at);
 const windowData={};for(const [name,[lo,hi]]of Object.entries(windows)){
  const self={},inclusive={};let sampleCount=0;
  for(let i=0;i<orderedSamples.length;i++){const sample=orderedSamples[i],end=orderedSamples[i+1]?.at??p.endTime;const ms=Math.max(0,Math.min(hi,end)-Math.max(lo,sample.at))/1000;if(!ms)continue;sampleCount++;let n=nodes.get(sample.id);const own=position(n.callFrame);self[own]=(self[own]||0)+ms;const seen=new Set();while(n){const name=position(n.callFrame);if(!seen.has(name)){inclusive[name]=(inclusive[name]||0)+ms;seen.add(name);}n=nodes.get(n.parent);}}
  const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([frame,ms])=>({frame,ms:rounded(ms)}));
  const traceEvents=t.filter(e=>e.pid===first.pid&&e.tid===first.tid&&e.ph==='X'&&e.ts<hi&&e.ts+(e.dur??0)>lo);
  const totals={};for(const e of traceEvents){const ms=(Math.min(hi,e.ts+e.dur)-Math.max(lo,e.ts))/1000;totals[e.name]=(totals[e.name]||0)+ms;}
  windowData[name]={durationMs:(hi-lo)/1000,sampleCount,self:top(self),inclusive:top(inclusive),domainFrames:Object.entries(inclusive).filter(([frame])=>frame.includes('/simulation/')).map(([frame,ms])=>({frame,ms:rounded(ms)})),persistenceFrames:Object.entries(inclusive).filter(([frame])=>frame.includes('/persistence/')).map(([frame,ms])=>({frame,ms:rounded(ms)})),traceTotals:top(totals),commits:traceEvents.filter(e=>e.name==='Commit').map(e=>({startMs:(e.ts-lo)/1000,durationMs:e.dur/1000,threadCpuMs:e.tdur/1000})),tasks:traceEvents.filter(e=>e.name==='ThreadControllerImpl::RunTask').map(e=>({startMs:(e.ts-lo)/1000,durationMs:e.dur/1000})),functions:traceEvents.filter(e=>e.name==='FunctionCall').map(e=>({startMs:(e.ts-lo)/1000,durationMs:e.dur/1000,data:e.args}))};
 }
 profiles.push({name:x.name,pid:first.pid,tid:first.tid,marks:marks.map(e=>({name:e.name,ts:e.ts})),windows:windowData});
}
const data={metadata,rows,stats,profiles};fs.writeFileSync(path.join(out,'analysis.json'),JSON.stringify(data,null,2));console.log(JSON.stringify({rows,stats,profiles},null,2));
