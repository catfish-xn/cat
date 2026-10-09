const fs=require('node:fs'),path=require('node:path');
const {hash}=require('./m4-evidence.cjs');
// Include untracked implementation files too: git diff alone cannot identify a dirty source tree.
function sourceFingerprint(){const entries=[];function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=path.join(folder,entry.name);if(entry.isDirectory())walk(name);else if(entry.isFile())entries.push([name,hash(fs.readFileSync(name,'utf8'))]);}}walk('src');for(const name of ['package.json','package-lock.json','index.html','vite.config.ts'])if(fs.existsSync(name))entries.push([name,hash(fs.readFileSync(name,'utf8'))]);return hash(entries);}
// User-approved full-application limits (2026-10-08); module budgets stay frozen.
function applicationHeapCeilingBytes(mode){
 if(mode==='dev')return 1536*1024;
 if(mode==='preview')return 1024*1024;
 throw new RangeError(`Unknown application measurement mode: ${mode}`);
}
// H1 (2026-10-09): retain the measurement and ceiling, but report an overrun
// without failing the full-application route or its evidence comparison.
function applicationHeapGate(mode,beforeHeap,afterHeap){
 for(const heap of [beforeHeap,afterHeap])if(!Number.isSafeInteger(heap?.usedSize)||heap.usedSize<0)throw new TypeError('Invalid full-application heap reading');
 const deltaBytes=afterHeap.usedSize-beforeHeap.usedSize;
 const ceilingBytes=applicationHeapCeilingBytes(mode);
 return {policy:'warn-only',deltaBytes,ceilingBytes,exceeded:deltaBytes>ceilingBytes};
}
function warnApplicationHeap(gate){
 if(gate.exceeded)console.warn(`::warning title=H1 application heap::post-GC growth ${gate.deltaBytes} B exceeds ${gate.ceilingBytes} B; warn-only pending H1 investigation`);
}
module.exports={sourceFingerprint,applicationHeapCeilingBytes,applicationHeapGate,warnApplicationHeap};
