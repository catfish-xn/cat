"""Reproduce descriptive statistics for the twelve preregistered preview samples."""
import argparse
import collections
import csv
import hashlib
import json
import math
import pathlib
import statistics

if not __debug__:
    raise RuntimeError('Do not disable evidence assertions')
p=argparse.ArgumentParser();p.add_argument('--repo',default='.');p.add_argument('--output',required=True);a=p.parse_args()
repo=pathlib.Path(a.repo)
names=['h1-ci153-normal']+[f'h1-ci153-normal-batch{i}' for i in range(2,5)]
rows=[];files={}
for name in names:
    base=repo/'docs/evidence'/name
    def read(relative):
        data=(base/relative).read_bytes();files[str(pathlib.Path('docs/evidence')/name/relative)]=hashlib.sha256(data).hexdigest();return data
    env=json.loads(read('environment.json'));prov=json.loads(read('provenance.json'))
    request=dict(line.split('=',1) for line in read('request.txt').decode().splitlines())
    runrows=list(csv.DictReader(read('runs.tsv').decode().splitlines(),delimiter='\t'))
    assert len(runrows)==3 and request['samples']=='3' and request['probe']=='normal' and request['mode']=='preview'
    assert request['source_sha']==env['sourceSha']=='97f38a0e787a4edcb35df4a59823bb1d106def67'
    assert request['definition_sha']==env['definitionSha']==prov['definitionSha']
    assert int(request['run_id'])==prov['runId'] and env['browser']=='153.0.8010.12'
    for record in runrows:
        label=record['sample'];l=json.loads(read(label+'/m6-lifecycle.json'))
        assert l['warmupCycles']==2 and l['cycles']==30 and len(l['rows'])==30
        assert not l['heapDiagnostics'] and not l['warmupExperiment'] and l['heapCeilingBytes']==1048576
        before,after=l['beforeHeap']['usedSize'],l['afterHeap']['usedSize'];delta=after-before
        assert delta==l['heapDelta']
        exitcode=int(record['exit_code']);assert exitcode==int(delta>1048576)
        rows.append({'runId':prov['runId'],'sample':label,'cpu':env['cpu'],'node':env['node'],'browser':env['browser'],
                     'beforeBytes':before,'afterBytes':after,'deltaBytes':delta,'exceeded':delta>1048576,
                     'exitCode':exitcode,'startedUtc':record['started_utc'],'endedUtc':record['ended_utc']})
assert len(rows)==12 and len({(r['runId'],r['sample']) for r in rows})==12

def stats(group):
    x=[r['deltaBytes'] for r in group];n=len(x);k=sum(r['exceeded'] for r in group);median=statistics.median(x)
    z=1.959963984540054;proportion=k/n;den=1+z*z/n
    center=(proportion+z*z/(2*n))/den
    radius=z*math.sqrt(proportion*(1-proportion)/n+z*z/(4*n*n))/den
    bins={'negative':0,'zero_to_half_MiB':0,'above_half_to_one_MiB':0,'above_one_MiB':0}
    for v in x: bins['negative' if v<0 else 'zero_to_half_MiB' if v<=524288 else 'above_half_to_one_MiB' if v<=1048576 else 'above_one_MiB']+=1
    return {'n':n,'exceedances':k,'observedExceedanceFraction':proportion,'meanBytes':statistics.mean(x),'medianBytes':median,
            'sampleStandardDeviationBytes':statistics.stdev(x) if n>1 else None,'medianAbsoluteDeviationBytes':statistics.median(abs(v-median) for v in x),
            'minBytes':min(x),'maxBytes':max(x),'rangeBytes':max(x)-min(x),'sortedDeltasBytes':sorted(x),'histogram':bins,
            'beforeRangeBytes':[min(r['beforeBytes'] for r in group),max(r['beforeBytes'] for r in group)],
            'afterRangeBytes':[min(r['afterBytes'] for r in group),max(r['afterBytes'] for r in group)],
            'wilson95UnderIndependentIdenticallyDistributedAssumption':[center-radius,center+radius]}
byjob=collections.defaultdict(list);bycpu=collections.defaultdict(list)
for row in rows:byjob[str(row['runId'])].append(row);bycpu[row['cpu']].append(row)
result={'runtimeSha':'97f38a0e787a4edcb35df4a59823bb1d106def67','mode':'preview','samples':rows,'overall':stats(rows),
        'byJob':{k:stats(v) for k,v in byjob.items()},'byCpu':{k:stats(v) for k,v in bycpu.items()},'inputSha256':files,
        'interpretation':'All twelve predeclared original-parameter processes retained, no replacement. Descriptive distribution of endpoint deltas, not established pure noise or false-positive rate. CPU/job variation and shared host within job limit iid assumptions; Wilson bounds are only a precision reference under that assumption. Do not pool Chromium141, snapshot/trend/B4/dev or ordinary-CI reruns. No Gaussian model or gate change.'}
pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result['overall']))
