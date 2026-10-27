const fs = require('node:fs'), path = require('node:path');
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const dir = process.argv[2] || 'artifacts/stage5-lag';
const stat = a => { a = [...a].sort((a,b) => a-b); return { n: a.length, total: a.reduce((s,v)=>s+v,0), p50: a[Math.ceil(a.length*.5)-1] || 0, p95: a[Math.ceil(a.length*.95)-1] || 0, max: a.at(-1) || 0 }; };
const result = { server: {}, client: {}, profiles: {} };
for (const file of fs.readdirSync(dir).filter(f => /^server-.*\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir,file)));
  const groups = d.groups || d.samples.map(s => ({...s,values:[s.ms]}));
  const buckets = {};
  for (const g of groups) {
    const stage = g.name.match(/^\d+/)?.[0] || 'OT';
    for (const k of [`stage${stage}/${g.part}`, `stage${stage}/${g.phase}/${g.part}`, ...(g.realtime ? [`real/${g.part}`, `real/${g.phase}/${g.part}`] : [])]) (buckets[k] ??= []).push(...g.values);
  }
  result.server[file] = { rounds: d.rounds, stats: Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,stat(v)])),
    gc: stat((d.gc || []).map(e=>e.ms)), realLateness: stat(d.samples.filter(s=>s.realtime).map(s=>s.late)),
    worst: d.samples.filter(s=>s.part==='callback').sort((a,b)=>b.ms-a.ms).slice(0,12) };
}
for (const file of fs.readdirSync(dir).filter(f => /^client-.*\.json$/.test(f) && !f.includes('.trace.'))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir,file)));
  const traceFile = path.join(dir,file.replace('.json','.trace.json'));
  const timeline = {};
  if (fs.existsSync(traceFile)) {
    const trace = JSON.parse(fs.readFileSync(traceFile)).traceEvents;
    const main = trace.find(e=>e.name==='thread_name' && e.args?.name==='CrRendererMain');
    for(const e of trace) if(e.ph==='X' && e.dur && e.tid===main?.tid && e.pid===main?.pid) (timeline[e.name] ??= []).push(e.dur/1000);
  }
  result.client[file] = { meta: d.meta, frame: stat(d.frames), over33: d.frames.filter(v=>v>33.4).length, over50: d.frames.filter(v=>v>50).length,
    longTasks: stat(d.tasks.map(t=>t.ms)), spans: Object.fromEntries(Object.entries(d.spans).map(([k,v])=>[k,stat(v)])),
    timeline: Object.fromEntries(Object.entries(timeline).map(([k,v])=>[k,stat(v)])), mutations: d.mutations, gpu: d.gpu, heap: d.heap,
    assetStatus: d.assetStatus, shown: { phase: d.debug?.state.phase, tick: d.debug?.combatView?.tick, playing: d.debug?.replay, tokens: d.debug?.tokens.length } };
}
const escape = s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.cpuprofile'))) {
  const p = JSON.parse(fs.readFileSync(path.join(dir,file))), nodes = new Map(p.nodes.map(n=>[n.id,n])), parents = new Map();
  for(const n of p.nodes) for(const child of n.children || []) parents.set(child,n.id);
  const mapCache = new Map();
  function frame(n) {
    const f = n.callFrame; let url = f.url, line = f.lineNumber+1;
    if(file.startsWith('server') && /\/server[^/]*\.mjs$/.test(url)) {
      const mapFile=path.join(dir,path.basename(url)+'.map');
      if(!mapCache.has(mapFile)) mapCache.set(mapFile,fs.existsSync(mapFile)?new TraceMap(JSON.parse(fs.readFileSync(mapFile))):null);
      const map=mapCache.get(mapFile); if(map) { const orig=originalPositionFor(map,{line,column:f.columnNumber}); url=orig.source || url; line=orig.line || line; }
    }
    return { name: f.functionName || '(anonymous)', url, line };
  }
  const self = new Map(), inclusive = new Map(); let total = 0;
  const dataFile = file === 'server-low42.cpuprofile' ? path.join(dir,'server-42.json') : file === 'server-audit42.cpuprofile' ? path.join(dir,'server-42-audit.json') : null;
  const measured = dataFile && fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile)) : null;
  const intervals = measured?.samples.filter(s=>s.part==='callback').sort((a,b)=>a.start-b.start) || [];
  const stages = {}; let cursor = 0, stamp = p.startTime;
  const root = { name:'all samples', value:0, children:new Map() };
  for(let i=0;i<p.samples.length;i++) {
    const id=p.samples[i], ms=p.timeDeltas[i]/1000; total+=ms; self.set(id,(self.get(id)||0)+ms);
    stamp += p.timeDeltas[i];
    if(measured) {
      const time=(stamp-measured.cpuOffsetUs)/1000;
      while(cursor<intervals.length-1 && intervals[cursor+1].start<=time)cursor++;
      const span=intervals[cursor];
      const stage=span && time>=span.start && time<=span.start+span.ms ? (span.name.match(/^\d+/)?.[0] || 'OT') : 'outside';
      const g=stages[stage] ??= {total:0,self:new Map()}; g.total+=ms;
      const f=frame(nodes.get(id)),key=JSON.stringify(f);g.self.set(key,(g.self.get(key)||0)+ms);
    }
    const chain=[];for(let cur=id;cur;cur=parents.get(cur)) { chain.push(cur); inclusive.set(cur,(inclusive.get(cur)||0)+ms); }
    let r=root;r.value+=ms;
    for(const nodeId of chain.reverse()) { const f=frame(nodes.get(nodeId)),key=`${f.name} ${f.url}:${f.line}`; if(!r.children.has(key))r.children.set(key,{name:key,value:0,children:new Map()}); r=r.children.get(key);r.value+=ms; }
  }
  const top = counter => [...counter].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,ms])=>({...frame(nodes.get(id)),ms,pct:ms/total*100}));
  const merged = new Map();
  for(const [id,ms] of self){const f=frame(nodes.get(id)),key=JSON.stringify(f);merged.set(key,(merged.get(key)||0)+ms);}
  result.profiles[file]={total,self:top(self),inclusive:top(inclusive),selfMerged:[...merged].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([k,ms])=>({...JSON.parse(k),ms,pct:ms/total*100})),
    stages:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,{total:v.total,self:[...v.self].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,ms])=>({...JSON.parse(k),ms,pct:ms/v.total*100}))}]))};
  // Flame graph widths are sampled wall time; (idle)/(GC) stay visible, no implied exclusive CPU claim.
  const rects=[];let depth=0;
  function draw(n,x,y,w){if(w<1)return;depth=Math.max(depth,y);const hue=[...n.name].reduce((s,c)=>s+c.charCodeAt(0),0)%55;
    rects.push(`<g><title>${escape(n.name)} — ${n.value.toFixed(2)} ms</title><rect x="${x}" y="${y*20+30}" width="${w}" height="19" fill="hsl(${hue},75%,70%)" stroke="white" stroke-width=".3"/>${w>70?`<text x="${x+3}" y="${y*20+44}" font-size="11">${escape(n.name.slice(0,Math.floor(w/7)))}</text>`:''}</g>`);
    for(const c of [...n.children.values()].sort((a,b)=>b.value-a.value)){const cw=w*c.value/n.value;draw(c,x,y+1,cw);x+=cw;}}
  draw(root,0,0,1400);
  fs.writeFileSync(path.join(dir,file.replace('.cpuprofile','.flame.svg')),`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${(depth+2)*20+30}"><text x="0" y="20">${escape(file)} / sampled wall time</text>${rects.join('')}</svg>`);
}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(result,null,2));
console.log(`Summarized ${Object.keys(result.server).length} server runs, ${Object.keys(result.client).length} browser windows, ${Object.keys(result.profiles).length} CPU profiles.`);
