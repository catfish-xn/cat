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
module.exports={sourceFingerprint,applicationHeapCeilingBytes};
