/* Independent diagnostic copy; never edits the source probe or its gates. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Module}=require('node:module'),{execFileSync}=require('node:child_process');
const vm=require('node:vm');
function arg(name,fallback){const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];}
const source=path.resolve(arg('--source','.')),out=path.resolve(arg('--output','artifacts/h1-extended'));
const windows=Number(arg('--windows','6')),mode=arg('--mode','preview'),snapshot=process.argv.includes('--snapshots'),prepareOnly=process.argv.includes('--prepare-only');
if(!Number.isInteger(windows)||windows<2||windows>10||!['preview','dev'].includes(mode))throw Error('Invalid diagnostic configuration');
const relative=path.relative(source,out);if(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw Error('Output must be outside source checkout');
const file=path.join(source,'scripts/verify-m5-browser.cjs'),original=fs.readFileSync(file,'utf8');
const digest=text=>crypto.createHash('sha256').update(JSON.stringify(text)).digest('hex');
const expected='6b7f06e2a963ced3b601fd19074aa07a9fa1a670f6aa4467a2445bc3af8d7f25';
if(digest(original)!==expected)throw Error('Unsupported source probe hash; review derivation for this source before running');
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
const description={kind:'independent extended-window diagnosis, not acceptance',sourceSha,sourceRunnerHash:expected,warmupCycles:2,cyclesPerWindow:30,windows,snapshots:snapshot,changes:['Enable the existing follow-up window block without the historical twelve-cycle warmup','Extend that diagnostic block to the requested equal window count','Optionally take separate perturbing snapshots at later window boundaries and label them accurately','Preserve every existing assertion and threshold; no source files edited']};
const executable=path.join(out,'h1-derived-probe.cjs');
let generated='__filename='+JSON.stringify(executable)+';\n'+original;
function replaceOnce(from,to){if(generated.split(from).length!==2)throw Error('Expected exactly one source anchor: '+from);generated=generated.replace(from,to);}
replaceOnce('report={sha:', 'report={h1ExtendedDiagnostic:'+JSON.stringify(description)+',sha:');
replaceOnce('  if(warmupExperiment){','  if(true){ // H1 independent diagnostic copy; original warmup remains two.');
replaceOnce('for(let window=2;window<=3;window++){',`for(let window=2;window<=${windows};window++){`);
replaceOnce('const trend={warmupCycles,cyclesPerWindow:30,heapDiagnostics:false,windows};','const trend={warmupCycles,cyclesPerWindow:30,heapDiagnostics,windows};');
const boundary="const heap=await cdp.send('Runtime.getHeapUsage'),resources=await page.evaluate(()=>window.__M6_RESOURCES__.read());";
replaceOnce(boundary,boundary+"await heapSnapshot(`window-${window}`);");
// All assertions must survive byte-for-byte and in the original order.
const assertions=text=>text.split('\n').filter(line=>line.includes('assert(')||line.includes('assert.'));
const beforeAssertions=assertions(original),afterAssertions=assertions(generated);
if(JSON.stringify(beforeAssertions)!==JSON.stringify(afterAssertions))throw Error('Derivation changed assertion-bearing lines');
new vm.Script(generated,{filename:'h1-derived-probe.cjs'});
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(executable,generated);
fs.writeFileSync(path.join(out,'derivation.json'),JSON.stringify({...description,derivedRunnerHash:digest(generated),wrapperSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),assertionLinesPreserved:beforeAssertions.length,prepareOnly},null,2));
if(prepareOnly){console.log(JSON.stringify({prepared:true,sourceSha,sourceRunnerHash:expected,derivedRunnerHash:digest(generated),assertionLinesPreserved:beforeAssertions.length}));}
else{
 if(execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim())throw Error('Source checkout must be clean');
 delete process.env.M6_WARMUP_EXPERIMENT;delete process.env.CHROMIUM_PATH;
 if(snapshot)process.env.M6_HEAP_DIAGNOSTICS='1';else delete process.env.M6_HEAP_DIAGNOSTICS;
 process.env.M5_EVIDENCE_DIR=out;process.chdir(source);
 process.argv=[process.execPath,executable,...(mode==='preview'?['--preview']:[]),'--m6-journey','--build=cannon'];
 // Compile in the source module context so require AND dynamic import resolve
 // its locked dependencies. The prefix points __filename at the archived copy,
 // so the probe's manifest hashes the code actually executed, not the original.
 const diagnosticModule=new Module(file,module);diagnosticModule.filename=file;
 diagnosticModule.paths=Module._nodeModulePaths(path.dirname(file));
 diagnosticModule._compile(generated,file);
}
