#!/usr/bin/env python3
"""Verify the pinned H1 log-only evidence supplement, without running tests."""
import argparse, hashlib, json, pathlib, subprocess
p=argparse.ArgumentParser(description=__doc__); p.add_argument('repo'); p.add_argument('output'); args=p.parse_args()
rev='a062cececca3424d1c2b414f7b1a2a016a77f1a0'; old='394853cbdd7e305100c148c435cd18e9e6b81f98'; root='docs/evidence/h1-claude-runs/'
def git(*parts): return subprocess.check_output(['git','-C',args.repo,*parts])
def raw(path,ref=rev): return git('show',ref+':'+root+path)
runs=[(name+'/run.log',name+'/manifest.json') for name in ['normal-1','normal-2','snapshot-1']]
runs += [(f'followup/h1-normal-more/normal-{i:02d}.log',f'followup/h1-normal-more/normal-{i:02d}/manifest.json') for i in range(1,9)]
runs += [(f'followup/h1-trend/trend-{i:02d}.log',f'followup/h1-trend/trend-{i:02d}/manifest.json') for i in range(1,4)]
checks=[]; rows=[]
def check(label,ok): checks.append({'check':label,'ok':bool(ok)})
for log,manifest in runs:
 data=raw(log); text=data.decode(); m=json.loads(raw(manifest)); last=json.loads(text.strip().splitlines()[-1])
 expected={k:m[k] for k in ['passed','mode','build','touch','durationSeconds']}
 check(log+' final summary matches manifest',last==expected)
 check(manifest+' unchanged since prior evidence',raw(manifest)==raw(manifest,old))
 failure=m.get('failure','')
 check(log+' failure first line matches', (failure.splitlines()[0] in text) if failure else ('AssertionError' not in text))
 rows.append({'log':root+log,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'summary':last,'failure':failure.splitlines()[0] if failure else None})
builds=[]
for path in ['build.log','followup/h1-normal-more/build.log','followup/h1-trend/build.log']:
 data=raw(path); text=data.decode(); check(path+' contains completed Vite build','✓ built in ' in text and 'tsc --noEmit' in text)
 builds.append({'path':root+path,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'status':'typecheck command and completed Vite build recorded; process exit status not separately captured'})
changed=git('diff','--name-status',old,rev).decode().splitlines()
check('only additions plus followup README correction',all(line.startswith('A\t'+root) or line=='M\t'+root+'followup/README.md' for line in changed))
result={'evidence_revision':rev,'prior_revision':old,'runs':rows,'builds':builds,'changed_files':changed,'checks':checks,'failed_checks':[c for c in checks if not c['ok']],'limitations':['No browser runs were performed. Added logs reconcile with previous manifests, not independent re-execution.','Original runtime heap data unchanged. Vite printed gzip is not the level-9 budget measurement.','Normal failure trace archives and per-round artifacts were not included in this supplement.']}
out=pathlib.Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'runs':len(rows),'builds':len(builds),'checks':len(checks),'failed':result['failed_checks']}))
raise SystemExit(bool(result['failed_checks']))
