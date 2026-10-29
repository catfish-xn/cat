/* Shared reporting for the v24 epoch runners. Check mode compares working-tree
 * bytes, not HEAD, so pre-existing local changes are permitted but never hidden. */
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {readProcessOutput}=require('./offline-process-output.cjs');
const evidence='docs/evidence/v25-online-rules/epoch-verification.json';

const snapshotTrackedFiles=()=>{
 const files=readProcessOutput('git',['ls-files','-z'],{env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).toString().split('\0').filter(Boolean);
 return new Map(files.map(file=>{
  try{
   const stat=fs.lstatSync(file),link=stat.isSymbolicLink();
   const bytes=link?fs.readlinkSync(file,{encoding:'buffer'}):fs.readFileSync(file);
   return [file,(link?'symlink:':'file:')+createHash('sha256').update(bytes).digest('hex')];
  }catch(error){if(error.code==='ENOENT')return [file,null];throw error;}
 }));
};

exports.createEpochReport=({base,write,directory,totalSteps})=>{
 const before=write?null:snapshotTrackedFiles();
 return results=>{
  const report={baseCommit:base,steps:results,complete:results.length===totalSteps&&results.every(r=>r.exitCode===0)};
  if(before){
   const after=snapshotTrackedFiles();
   const changed=[...new Set([...before.keys(),...after.keys()])].filter(file=>before.has(file)!==after.has(file)||before.get(file)!==after.get(file)).sort();
   report.trackedFilesUnchanged=changed.length===0;
   report.changedTrackedFiles=changed;
   if(changed.length){report.complete=false;console.error('Check mode changed tracked files: '+changed.join(', '));}
  }
  const text=JSON.stringify(report,null,2)+'\n';
  // Failed/partial runs are diagnostic artifacts, never replacement evidence.
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'epoch-verification.json'),text);
  if(write&&report.complete){
   fs.mkdirSync(path.dirname(evidence),{recursive:true});
   const temporary=evidence+'.'+process.pid+'.tmp';
   try{fs.writeFileSync(temporary,text);fs.renameSync(temporary,evidence);}
   finally{fs.rmSync(temporary,{force:true});}
  }
  return report.complete;
 };
};
