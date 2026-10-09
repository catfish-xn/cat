/* Optional isolated Chromium follow-up; run only after paired browser timings.
 * Uses the archived sources next to each dist and the naturally captured state.
 * This warmed pure-function measurement excludes DOM, rendering, IO and cold JIT.
 * Usage: node scripts/diagnose-m8-b5-click-pure-cost.cjs --study=artifacts/m8-b5-click-study */
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),study=path.resolve(process.argv.find(a=>a.startsWith('--study='))?.slice(8)??'artifacts/m8-b5-click-study');
const metadata=JSON.parse(fs.readFileSync(path.join(study,'metadata.json')));
const {buildSync}=require(path.join(root,'node_modules/esbuild'));
const {chromium}=require(path.join(root,'node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined}),page=await browser.newPage();
 const all={};
 try{
  for(const label of ['base','b5']){
   const src=path.join(path.dirname(metadata.builds[label]),'src');
   const result=buildSync({stdin:{contents:`export { nextRound } from '${src}/simulation/match.ts'; export { fixedCapture } from '${src}/persistence/capture-ownership.ts';${label==='b5'?`export { planTemporaryEquipment } from '${src}/simulation/temporary-equipment.ts';`:''}`,resolveDir:root},bundle:true,format:'iife',globalName:'PureBench',minify:true,write:false});
   await page.addScriptTag({content:result.outputFiles[0].text});
   const before=JSON.parse(fs.readFileSync(path.join(study,`profile-1-${label}/report.json`))).beforeState;
   all[label]=await page.evaluate(({before,label})=>{
    const api=globalThis.PureBench,input=JSON.stringify(before),result=api.nextRound(before,before.round);
    if(!result.ok)throw Error('real settled input rejected');
    const after=result.state,capture={match:after,currentBattle:null,battleKeys:[],addedBattles:[]};
    const jobs={nextRound:()=>api.nextRound(before,before.round),fixedCapture:()=>api.fixedCapture(capture),structuredClone:()=>structuredClone(after)};
    if(label==='b5')jobs.planTemporaryEquipment=()=>api.planTemporaryEquipment(after);
    const timings={};let sink;
    for(const [name,fn] of Object.entries(jobs)){for(let i=0;i<500;i++)sink=fn();const samples=[];for(let b=0;b<7;b++){const start=performance.now();for(let i=0;i<1000;i++)sink=fn();samples.push((performance.now()-start)/1000);}timings[name]={msPerCall:samples,medianMs:samples.slice().sort((a,b)=>a-b)[3]};}
    if(JSON.stringify(before)!==input)throw Error('input mutated');
    return {round:before.round,phase:before.phase,itemCount:before.items.length,rollCount:before.equipmentState?.rolls.length,temporaryCount:before.temporaryEquipment?.length,beforeJsonBytes:input.length,afterJsonBytes:JSON.stringify(after).length,timings};
   },{before,label});
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(study,'pure-bench.json'),JSON.stringify({method:'Isolated Chromium page; exact archived TS bundled with esbuild; naturally captured profile beforeState; 500 warmup + 7 x 1000 calls per operation, no rendering or IO; not an end-to-end latency gate.',results:all},null,2));
 console.log(JSON.stringify(all,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
