/* Diagnostic only: profiler overhead is not a performance acceptance sample. */
const fs=require('node:fs'),path=require('node:path'),inspector=require('node:inspector/promises');
const root='/workspace/cat',fixture=require(path.join(root,'tests/fixtures/m8/pressure-9v9.cjs'));
(async()=>{
 const {createServer}=await import(require.resolve('vite',{paths:[root]}));
 const server=await createServer({root,logLevel:'error',server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 const out=path.join(root,'artifacts/m8-pressure-diagnostic-d901b3f');fs.mkdirSync(out,{recursive:true});
 try{
  const m=await fixture.loadModules(server);
  const finish=initial=>{let s=initial,n=0;while(s.status!=='finished'){const r=m.combat.stepCombat(s);s=r.state;n+=r.events.length;}return {ticks:s.tick,events:n,result:s.result};};
  finish(fixture.build(m,0,'distinct').step.state);global.gc?.();
  const inputs=Array.from({length:10},(_,i)=>fixture.build(m,i+1,'distinct').step.state);
  const session=new inspector.Session();session.connect();await session.post('Profiler.enable');await session.post('Profiler.start');
  const results=inputs.map(finish);const {profile}=await session.post('Profiler.stop');session.disconnect();
  fs.writeFileSync(path.join(out,'distinct-10-combats.cpuprofile'),JSON.stringify(profile));
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();for(const n of nodes.values())for(const child of n.children??[])parent.set(child,n.id);
  const self=new Map(),inclusive=new Map();let total=0;
  for(let i=0;i<profile.samples.length;i++){const id=profile.samples[i],us=profile.timeDeltas[i];total+=us;self.set(id,(self.get(id)||0)+us);let p=id;while(p!==undefined){inclusive.set(p,(inclusive.get(p)||0)+us);p=parent.get(p);}}
  const summarize=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([id,us])=>({...nodes.get(id).callFrame,milliseconds:us/1000,percent:us/total*100}));
  const report={kind:'diagnostic-only',note:'10 distinct fixtures, seeds 1..10, profiler enabled only around stepCombat loops; setup/warmup excluded; not a budget rerun',sha:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,results,totalSampledMs:total/1000,self:summarize(self),inclusive:summarize(inclusive)};
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.self.slice(0,12),null,2));
 }finally{await server.close();}
})();
