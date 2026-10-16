const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file='docs/evidence/g2-2/assets-manifest.json',manifest=JSON.parse(fs.readFileSync(file));
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const existing=files('public/assets/s13').filter(p=>p.endsWith('.png')).sort().map(p=>{const bytes=fs.readFileSync(p);assert.equal(bytes.subarray(0,4).toString('hex'),'89504e47');return{path:p,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
const output=JSON.stringify({...manifest,inventoryCommand:'node scripts/audit-g2-2-assets.cjs --check',existingAssets:existing},null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),output);else fs.writeFileSync(file,output);
console.log(JSON.stringify({existing:existing.length,newDownloaded:manifest.downloaded,missing:manifest.failures.length}));
