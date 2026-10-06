const fs=require('node:fs'),path=require('node:path');
const {hash}=require('./m4-evidence.cjs');
// Include untracked implementation files too: git diff alone cannot identify a dirty source tree.
function sourceFingerprint(){const entries=[];function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=path.join(folder,entry.name);if(entry.isDirectory())walk(name);else if(entry.isFile())entries.push([name,hash(fs.readFileSync(name,'utf8'))]);}}walk('src');for(const name of ['package.json','package-lock.json','index.html','vite.config.ts'])if(fs.existsSync(name))entries.push([name,hash(fs.readFileSync(name,'utf8'))]);return hash(entries);}
module.exports={sourceFingerprint};
