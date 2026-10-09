#!/usr/bin/env python3
"""Read committed objects only; no browser/process measurement or repository writes."""
import subprocess,json,hashlib,statistics,math,csv,io,pathlib,sys,argparse
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('repo');parser.add_argument('output');args=parser.parse_args()
R=str(pathlib.Path(args.repo).resolve()); REV='394853cbdd7e305100c148c435cd18e9e6b81f98'; OLD='e0bcc67a36b0bc3d4e5c7eff47ee07d338da4cce'; SRC='97f38a0e787a4edcb35df4a59823bb1d106def67'; OUT=pathlib.Path(args.output); B='docs/evidence/h1-claude-runs/'; TH=1048576

def git(*a):return subprocess.check_output(['git','-C',R,*a])
def raw(p,rev=REV):return git('show',rev+':'+p)
def read(p,rev=REV):return json.loads(raw(B+p,rev))
def digest(v):return hashlib.sha256(json.dumps(v,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()).hexdigest()
def wilson(k,n):
 z=1.959963984540054;p=k/n;den=1+z*z/n;c=(p+z*z/(2*n))/den;h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [c-h,c+h]
def stats(rows):
 x=[r['delta'] for r in rows];n=len(x);k=sum(v>TH for v in x)
 return dict(n=n,mean=statistics.mean(x),median=statistics.median(x),sample_sd=statistics.stdev(x),minimum=min(x),maximum=max(x),range=max(x)-min(x),above_ceiling=k,proportion=k/n,wilson_95=wilson(k,n))
files=git('ls-tree','-r','--name-only',REV,B).decode().splitlines();index=set(files)
runner=raw('scripts/verify-m5-browser.cjs',SRC).decode(); runner_hash=digest(runner)
# Node localeCompare ordering matches the original fingerprint implementation exactly.
paths=git('ls-tree','-r','--name-only',SRC,'src').decode().splitlines()
# Parent-directory walk ordering (not a single global lexical sort).
tree={}
for p in paths:
 node=tree
 for seg in p.split('/')[1:-1]:node=node.setdefault(seg,{})
 node[p.split('/')[-1]]=None
src_contents={p:digest(raw(p,SRC).decode(errors='replace')) for p in paths}
node_program="""const fs=require('fs'),crypto=require('crypto');const x=JSON.parse(fs.readFileSync(0,'utf8'));const entries=[];function walk(t,p){for(const n of Object.keys(t).sort((a,b)=>a.localeCompare(b))){const q=p+'/'+n;if(t[n]===null)entries.push([q,x.hashes[q]]);else walk(t[n],q);}}walk(x.tree,'src');entries.push(...x.extra);console.log(crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex'));"""
extra=[[p,digest(raw(p,SRC).decode(errors='replace'))] for p in ['package.json','package-lock.json','index.html','vite.config.ts']]
source_hash=subprocess.check_output(['node','-e',node_program],input=json.dumps(dict(tree=tree,hashes=src_contents,extra=extra)).encode()).decode().strip()
checks=[]; normal=[];trends=[]; identities=[];inputs=[]
def ck(label,condition):checks.append(dict(check=label,ok=bool(condition)))
def inspect(folder,group,rev=REV):
 m=read(folder+'/manifest.json',rev);l=read(folder+'/m6-lifecycle.json',rev)
 ck(folder+' manifest/lifecycle equality',m['m6Lifecycle']==l)
 expected=dict(sha=SRC,status='',runnerHash=runner_hash,sourceFingerprint=source_hash,finalSourceFingerprint=source_hash,browser='141.0.7390.37',mode='preview',build='cannon',touch=False,diffHash=digest(''))
 for k,v in expected.items():ck(folder+' '+k,m.get(k)==v)
 ck(folder+' browser errors empty',m['errors']==[])
 ck(folder+' lifecycle delta arithmetic',l['heapDelta']==l['afterHeap']['usedSize']-l['beforeHeap']['usedSize'])
 ck(folder+' lifecycle config',l['heapDiagnostics']==False and l['warmupExperiment']==(group=='trend') and l['warmupCycles']==(12 if group=='trend' else 2) and l['cycles']==30 and l['heapCeilingBytes']==TH)
 ck(folder+' row sequence',[r['cycle'] for r in l['rows']]==list(range(1,31)))
 resources=[l['beforeResources'],l['afterResources']]+[r['resources'] for r in l['rows']]
 ck(folder+' resource counters',all(r==dict(listeners=82,pendingRaf=1) for r in resources))
 ck(folder+' app lifecycle counts',all(r['m6']['lifecycle']==dict(applications=1,sessions=1,observers=1) for r in l['rows']))
 if group!='old':ck(folder+' progress cycle',read(folder+'/m6-lifecycle-progress.json')['cycle']==30)
 for f in ['manifest.json','m6-lifecycle.json']:
  content=raw(B+folder+'/'+f,rev);inputs.append(dict(path=B+folder+'/'+f,revision=rev,sha256=hashlib.sha256(content).hexdigest()))
 identities.append(dict(run=folder,**{k:m.get(k) for k in expected},node=m['node'],platform=m['platform'],cpu=m['cpu'],cpuCount=m['cpuCount'],memoryBytes=m['memoryBytes'],loadAtStart=m['loadAtStart']))
 row=dict(run=folder,group=group,before=l['beforeHeap']['usedSize'],after=l['afterHeap']['usedSize'],delta=l['heapDelta'],margin_bytes=TH-l['heapDelta'],passed=m['passed'],failure=m.get('failure'),duration_seconds=m['durationSeconds'],errors=m['errors'])
 return m,l,row
for i in [1,2]:
 f=f'normal-{i}';m,l,r=inspect(f,'old',OLD);normal.append(r)
 ck(f+' old evidence unchanged at new revision',raw(B+f+'/manifest.json',OLD)==raw(B+f+'/manifest.json') and raw(B+f+'/m6-lifecycle.json',OLD)==raw(B+f+'/m6-lifecycle.json'))
for group,dirname,count in [('new','h1-normal-more',8),('trend','h1-trend',3)]:
 table=list(csv.DictReader(io.StringIO(raw(B+'followup/'+dirname+'/runs.tsv').decode()),delimiter='\t'))
 ck(dirname+' tsv count',len(table)==count)
 for ts in table:
  f='followup/'+dirname+'/'+ts['run'];m,l,r=inspect(f,group);r['exit_code']=int(ts['exit_code']);r['started_utc']=ts['started_utc'];r['ended_utc']=ts['ended_utc']
  ck(f+' tsv pass consistency',r['exit_code']==(0 if r['passed'] else 1))
  ck(f+' failure presence',bool(r['failure'])==(not r['passed']))
  ck(f+' failure files',all((B+f+'/'+name in index)==(not r['passed']) for name in ['failure-state.json','failure.png']))
  if group=='new':
   normal.append(r);ck(f+' pass vs heap threshold',r['passed']==(r['delta']<=TH))
  else:
   t=read(f+'/m6-heap-trend.json');w=t['windows'];ck(f+' trend configuration',t['warmupCycles']==12 and t['cyclesPerWindow']==30 and t['heapDiagnostics']==False and len(w)==3)
   ck(f+' trend progress complete',read(f+'/m6-trend-progress.json')==dict(window=3,cycle=30))
   ck(f+' first window lifecycle',all(w[0][k]==l[k] for k in ['beforeHeap','afterHeap','heapDelta','beforeResources','afterResources']))
   ck(f+' contiguous windows',all(w[i]['beforeHeap']==w[i-1]['afterHeap'] for i in [1,2]))
   ck(f+' trend arithmetic',all(s['heapDelta']==s['afterHeap']['usedSize']-s['beforeHeap']['usedSize'] for s in w))
   ck(f+' persistentGrowth definition',t['persistentGrowth']==all(s['heapDelta']>0 for s in w))
   ck(f+' window counters',all(s['beforeResources']==s['afterResources']==dict(listeners=82,pendingRaf=1) and s['cycles']==30 for s in w))
   r.update(heap_sequence=[w[0]['beforeHeap']['usedSize']]+[s['afterHeap']['usedSize'] for s in w],window_deltas=[s['heapDelta'] for s in w],net_growth=sum(s['heapDelta'] for s in w),persistent_growth=t['persistentGrowth']);trends.append(r)
for p in files:
 if '/followup/' in p and p.endswith(('.json','.tsv','.txt')):
  inputs.append(dict(path=p,revision=REV,sha256=hashlib.sha256(raw(p)).hexdigest()))
result=dict(evidence_revision=REV,source_revision=SRC,analysis_kind='read-only diagnosis; not acceptance audit',reconstructed_runner_hash=runner_hash,reconstructed_source_fingerprint=source_hash,threshold_bytes=TH,normal_runs=normal,statistics={'old2':stats(normal[:2]),'new8':stats(normal[2:]),'combined10_descriptive_only':stats(normal)},trend_runs=trends,identity_records=identities,checks=checks,check_count=len(checks),failed_checks=[c for c in checks if not c['ok']],committed_log_files=[p for p in files if p.endswith('.log')],input_hashes=inputs)
OUT.mkdir(parents=True,exist_ok=True);(OUT/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');(OUT/'source-runner.txt').write_text(runner);(OUT/'evidence-file-list.txt').write_text('\n'.join(files)+'\n')
print(json.dumps({k:result[k] for k in ['reconstructed_runner_hash','reconstructed_source_fingerprint','statistics','trend_runs','check_count','failed_checks','committed_log_files']},ensure_ascii=False,indent=2))

if result['failed_checks']: sys.exit(1)
