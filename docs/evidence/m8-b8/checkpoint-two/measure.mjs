import {build} from 'vite';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const candidate=process.cwd();
const results=[];
for(const [label,root,reachable] of [['baseline','/tmp/b8-checkpoint-two-baseline',false],['candidate',candidate,false],['candidate-reachable',candidate,true]]) {
 const outDir=`${candidate}/artifacts/b8-checkpoint-two/${label}`;
 await build({root,configFile:`${root}/vite.config.ts`,build:{outDir,emptyOutDir:true},plugins:reachable?[{name:'audit-only-b8-reachability',enforce:'pre',transform(code,id){if(id===`${root}/src/main.ts`)return `${code}\nimport * as lootFreezeAudit from './simulation/loot-freeze';\nimport * as lootChoiceAudit from './simulation/loot-choice';\nimport * as lootIdentityAudit from './simulation/loot-identity';\nimport * as combatInputAudit from './simulation/combat-input';\nimport * as resourceProvenanceAudit from './simulation/resource-provenance';\nObject.assign(globalThis,{lootFreezeAudit,lootChoiceAudit,lootIdentityAudit,combatInputAudit,resourceProvenanceAudit});`;}}]:[]});
 const files=readdirSync(`${outDir}/assets`).filter(f=>f.endsWith('.js')).sort().map(file=>({file,gzip9:gzipSync(readFileSync(`${outDir}/assets/${file}`),{level:9}).length}));
 results.push({label,files,total:files.reduce((s,f)=>s+f.gzip9,0)});
}
writeFileSync(`${candidate}/artifacts/b8-checkpoint-two/budget.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
