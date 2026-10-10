const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const [dir,label,out]=process.argv.slice(2);const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const files=fs.readdirSync(path.join(dir,'dist/assets')).filter(x=>x.endsWith('.js')).sort().map(file=>{const data=fs.readFileSync(path.join(dir,'dist/assets',file));return {file,rawBytes:data.length,gzip9Bytes:zlib.gzipSync(data,{level:9}).length,sha256:sha(data)};});
const result={label,node:process.version,zlib:process.versions.zlib,lockSha256:sha(fs.readFileSync(path.join(dir,'package-lock.json'))),files,totalGzip9Bytes:files.reduce((s,f)=>s+f.gzip9Bytes,0)};fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
