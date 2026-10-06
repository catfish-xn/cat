/* F1 standalone prototype: never imports or changes production persistence. */
const fs=require('node:fs'),http=require('node:http'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const input=process.argv[2]||'work/m6-f1-payload.json';
 const payload=JSON.parse(fs.readFileSync(input,'utf8'));
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>M6 F1 storage probe</title>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result=await page.evaluate(async payload=>{
   const measurements={capture:[],parse:[],write:[],read:[],archiveThree:[],incrementalCapture:[],incrementalWrite:[]};
   const check=(v,m)=>{if(!v)throw Error(m);};
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('m6-f1-probe',1);r.onupgradeneeded=()=>{for(const name of ['slot','battles','archives'])r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const read=()=>new Promise((resolve,reject)=>{const tx=db.transaction('slot');const r=tx.objectStore('slot').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const put=(expected,next,battles=[],abort=false)=>new Promise((resolve,reject)=>{
    const tx=db.transaction(['slot','battles'],'readwrite');let conflict=false;
    tx.oncomplete=()=>resolve(next);tx.onabort=()=>reject(Error(conflict?'conflict':'abort'));
    const slot=tx.objectStore('slot');const get=slot.get('current');get.onsuccess=()=>{
     const current=get.result;
     if(expected===null?current!==undefined:!current||current.runId!==expected.runId||current.activationEpoch!==expected.activationEpoch||current.revision!==expected.revision){conflict=true;tx.abort();return;}
     slot.put(next,'current');for(const [key,value] of battles)tx.objectStore('battles').add(value,key);
     if(abort)tx.abort();
    };
   });
   let slot={runId:'run-a',activationEpoch:'activation-a',revision:1,payload};
   await put(null,slot);
   let json='';
   for(let i=0;i<12;i++){
    let t=performance.now();const captured=structuredClone(payload);measurements.capture.push(performance.now()-t);
    json=JSON.stringify(captured);t=performance.now();JSON.parse(json);measurements.parse.push(performance.now()-t);
    const next={...slot,revision:slot.revision+1,payload:captured};t=performance.now();await put(slot,next);measurements.write.push(performance.now()-t);slot=next;
    t=performance.now();await read();measurements.read.push(performance.now()-t);
   }
   // Compare intended incremental shape: completed history only stored once.
   const history=payload.battles??[];
   const incremental={...payload,battles:undefined,battleKeys:history.map((b,i)=>String(b.combatId??i))};
   const initialIncrement={...slot,revision:slot.revision+1,payload:incremental};
   await put(slot,initialIncrement,history.map((b,i)=>[`run-a/${b.combatId??i}`,b]));slot=initialIncrement;
   for(let i=0;i<12;i++){
    let t=performance.now();const capture=structuredClone(incremental);measurements.incrementalCapture.push(performance.now()-t);
    const next={...slot,revision:slot.revision+1,payload:capture};t=performance.now();await put(slot,next);measurements.incrementalWrite.push(performance.now()-t);slot=next;
   }
   // Fixed capture and stale/reordered CAS, including a separately opened tab connection.
   const frozen=structuredClone(slot);const stale=structuredClone(slot);
   const activated={...slot,activationEpoch:'activation-b',revision:slot.revision+1};await put(slot,activated);slot=activated;
   let rejected=false;try{await put(stale,{...stale,revision:stale.revision+1});}catch(e){rejected=e.message==='conflict';}check(rejected,'old same-run activation accepted');
   rejected=false;try{await put(slot,{...slot,revision:slot.revision+1},[],true);}catch(e){rejected=e.message==='abort';}check(rejected,'abort missing');check((await read()).revision===slot.revision,'abort changed current');
   const other=await new Promise((resolve,reject)=>{const r=indexedDB.open('m6-f1-probe',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=other.transaction('slot','readwrite');tx.objectStore('slot').put({...slot,revision:slot.revision+1},'current');tx.oncomplete=resolve;tx.onabort=reject;});
   rejected=false;try{await put(slot,{...slot,revision:slot.revision+1});}catch(e){rejected=e.message==='conflict';}check(rejected,'other connection conflict accepted');
   check(frozen.activationEpoch==='activation-a','queue snapshot mutated');
   // Archive replacement + retention share one transaction. Forced abort retains all three.
   const archive=(id,abort=false)=>new Promise((resolve,reject)=>{const tx=db.transaction('archives','readwrite');const s=tx.objectStore('archives');s.put(payload,id);const r=s.getAllKeys();r.onsuccess=()=>{for(const key of r.result.slice(0,-3))s.delete(key);if(abort)tx.abort();};tx.oncomplete=resolve;tx.onabort=()=>reject(Error('abort'));});
   for(let i=1;i<=3;i++){const t=performance.now();await archive(i);measurements.archiveThree.push(performance.now()-t);}
   try{await archive(4,true);}catch{}
   const keys=()=>new Promise(resolve=>{const r=db.transaction('archives').objectStore('archives').getAllKeys();r.onsuccess=()=>resolve(r.result);});
   check(JSON.stringify(await keys())==='[1,2,3]','failed fourth evicted archive');await archive(4);check(JSON.stringify(await keys())==='[2,3,4]','fourth retention wrong');
   const summary={};for(const [name,values]of Object.entries(measurements)){const sorted=[...values].sort((a,b)=>a-b);summary[name]={samples:values,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],max:sorted.at(-1)};}
   other.close();db.close();return {bytes:new TextEncoder().encode(json).length,incrementalBytes:new TextEncoder().encode(JSON.stringify(incremental)).length,completedRecordCount:history.length,summary,checks:['same-run reactivation rejects old queued write','separate IDB connection revision conflict','transaction abort preserves current','snapshot remains fixed','failed fourth archive retains first three','successful fourth atomically removes oldest'],limitations:['parse timing excludes restoreMatch and historical replay verification','synthetic CAS adapter only; production implementation still needs independent tests','capture/write use full payload baseline; incrementalCapture/incrementalWrite use immutable history references','separate connections are same origin/page, not full two-tab UI test']};
  },payload);
  const report={timestamp:new Date().toISOString(),sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),cpu:os.cpus()[0]?.model,node:process.version,browser:browser.version(),input,...result};
  fs.writeFileSync(process.argv[3]||'docs/evidence/M6_F1_STORAGE.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
