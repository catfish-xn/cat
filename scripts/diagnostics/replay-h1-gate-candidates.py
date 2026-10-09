"""Offline candidate-rule sensitivity replay; NEVER an acceptance gate."""
import argparse
import collections
import hashlib
import json
import pathlib
import statistics

VARIANTS={'DG':('D','G'),'DGT':('D','G','T'),'DGTK':('D','G','T','K')}
GRID=[(0,1),(1,16),(1,8),(1,4),(1,2),(1,1),(2,1),(4,1)]
PROFILES=('linear','late_ramp_after_3','two_window_stairs','permanent_step_at_2','permanent_step_at_6')


def metrics(h):
    if len(h)!=7 or any(type(v) is not int or v<0 for v in h):
        raise ValueError('Seven nonnegative integer boundaries required')
    return {'D':h[1]-h[0], 'G':statistics.median(h[4:7])-statistics.median(h[1:4]),
            'T':h[6]-h[3], 'K':max(b-a for a,b in zip(h,h[1:]))}


def decisions(levels,limit):
    m=[metrics(h) for h in levels]
    result={}
    for name,keys in VARIANTS.items():
        hits=[any(row[key]>limit for key in keys) for row in m]
        n=sum(hits)
        state=('block' if n>=2 else 'review_no_auto_pass' if n==1 else 'pass_observation_window') if len(hits)==3 else 'insufficient_replicates_for_three_process_rule'
        result[name]={'hits':hits,'hitCount':n,'processCount':len(hits),'state':state}
    return {'perProcessMetricsBytes':m,'variants':result}


def retained(profile,amount,t):
    if profile=='linear': return amount*t
    if profile=='late_ramp_after_3': return amount*max(0,t-3)
    if profile=='two_window_stairs': return 2*amount*(t//2)
    if profile=='permanent_step_at_2': return amount if t>=2 else 0
    if profile=='permanent_step_at_6': return amount if t>=6 else 0
    raise ValueError(profile)


def self_test():
    base=[10000]*7;limit=1000;tests=[]
    def check(label,value):
        if not value: raise AssertionError(label)
        tests.append(label)
    step2=[v+retained('permanent_step_at_2',2000,t) for t,v in enumerate(base)]
    step6=[v+retained('permanent_step_at_6',2000,t) for t,v in enumerate(base)]
    a=decisions([step2]*3,limit)['variants'];b=decisions([step6]*3,limit)['variants']
    check('DG misses middle permanent step',a['DG']['hitCount']==0)
    check('DGT misses middle permanent step',a['DGT']['hitCount']==0)
    check('K detects middle permanent step',a['DGTK']['state']=='block')
    check('DG misses final permanent step',b['DG']['hitCount']==0)
    check('T detects final permanent step',b['DGT']['state']=='block')
    check('one hit means review not block/pass',decisions([step2,base,base],limit)['variants']['DGTK']['state']=='review_no_auto_pass')
    check('two hits block',decisions([step2,step2,base],limit)['variants']['DGTK']['state']=='block')
    check('zero hits only passes observation window',decisions([base]*3,limit)['variants']['DGTK']['state']=='pass_observation_window')
    check('one process never fabricates quorum',decisions([step2],limit)['variants']['DGTK']['state'].startswith('insufficient'))
    exact=[v+retained('permanent_step_at_2',limit,t) for t,v in enumerate(base)]
    check('strict greater-than threshold',decisions([exact]*3,limit)['variants']['DGTK']['hitCount']==0)
    linear=[v+retained('linear',500,t) for t,v in enumerate(base)]
    check('slow window growth accumulates in G/T',metrics(linear)['K']==500 and decisions([linear]*3,limit)['variants']['DGT']['state']=='block')
    return {'passed':len(tests),'checks':tests}


def main():
    p=argparse.ArgumentParser();p.add_argument('--mode',choices=['preview','dev']);p.add_argument('--trace',action='append',nargs=2,metavar=('LABEL','TREND_JSON'));p.add_argument('--output');p.add_argument('--self-test',action='store_true');a=p.parse_args()
    if a.self_test:
        print(json.dumps(self_test(),indent=2));return
    if not a.mode or not a.trace or not a.output:p.error('mode, trace(s), output required')
    if len({label for label,_ in a.trace})!=len(a.trace):p.error('Duplicate trace labels')
    limit=1048576 if a.mode=='preview' else 1572864
    inputs=[];levels=[];resolved_paths=set();process_ids=set()
    for label,filename in a.trace:
        path=pathlib.Path(filename)
        if path.resolve() in resolved_paths: raise ValueError('Duplicate resolved trace input')
        resolved_paths.add(path.resolve())
        raw=path.read_bytes();t=json.loads(raw)
        provenance_raw=path.parent.parent.joinpath('provenance.json').read_bytes();provenance=json.loads(provenance_raw)
        environment_raw=path.parent.parent.joinpath('environment.json').read_bytes();environment=json.loads(environment_raw)
        process_id=(provenance['runId'],path.parent.name)
        if process_id in process_ids: raise ValueError('Duplicate run/sample process identity')
        process_ids.add(process_id)
        if environment['sourceSha']!='97f38a0e787a4edcb35df4a59823bb1d106def67' or environment['browser']!='153.0.8010.12': raise ValueError('Runtime/browser identity mismatch')
        life_path=path.with_name('m6-lifecycle.json');life_raw=life_path.read_bytes();life=json.loads(life_raw)
        if t['heapDiagnostics'] or t['warmupCycles']!=2 or t['cyclesPerWindow']!=30 or len(t['windows'])!=6:
            raise ValueError('Only complete six-window original-warmup nonsnapshot traces accepted')
        if life['heapCeilingBytes']!=limit or life['heapDiagnostics'] or life['warmupCycles']!=2 or life['cycles']!=30 or life['warmupExperiment'] or len(life['rows'])!=30:
            raise ValueError('Mode/ceiling/lifecycle mismatch')
        windows=t['windows']
        if any(life[k]!=windows[0][k] for k in ['beforeHeap','afterHeap','heapDelta','beforeResources','afterResources']):raise ValueError('Lifecycle and first trend window mismatch')
        for i,w in enumerate(windows,1):
            if w['window']!=i or w['cycles']!=30 or w['afterHeap']['usedSize']-w['beforeHeap']['usedSize']!=w['heapDelta']:raise ValueError('Bad window identity/delta')
        if any(x['afterHeap']!=y['beforeHeap'] for x,y in zip(windows,windows[1:])):raise ValueError('Noncontiguous boundaries')
        h=[windows[0]['beforeHeap']['usedSize']]+[w['afterHeap']['usedSize'] for w in windows]
        metrics(h)
        levels.append(h);inputs.append({'label':label,'path':str(path),'runId':process_id[0],'sample':process_id[1],'cpu':environment['cpu'],'node':environment['node'],'provenanceSha256':hashlib.sha256(provenance_raw).hexdigest(),'environmentSha256':hashlib.sha256(environment_raw).hexdigest(),'sha256':hashlib.sha256(raw).hexdigest(),'lifecycleSha256':hashlib.sha256(life_raw).hexdigest(),'levelsBytes':h})
    scenarios=[]
    for profile in PROFILES:
        for num,den in GRID:
            amount=limit*num//den
            offsets=[retained(profile,amount,t) for t in range(7)]
            synthetic=[[v+offsets[t] for t,v in enumerate(h)] for h in levels]
            scenarios.append({'profile':profile,'fractionOfL':f'{num}/{den}','amountBytes':amount,
                              'amountMeaning':'one-time retained amount' if profile.startswith('permanent_step') else 'retained bytes per30-cycle window, or average per window for stairs',
                              'offsetsBytes':offsets,**decisions(synthetic,limit)})
    summary={name:dict(collections.Counter(s['variants'][name]['state'] for s in scenarios if s['amountBytes']>0)) for name in VARIANTS}
    result={'mode':a.mode,'limitBytes':limit,'runtimeSha':'97f38a0e787a4edcb35df4a59823bb1d106def67','browser':'153.0.8010.12',
            'identityNote':'Runtime/browser identities verified in linked batch provenance, not encoded in trend alone; input hashes pin exact traces.',
            'rule':{'processes':3,'warmupCycles':2,'windows':6,'cyclesPerWindow':30,'D':'H1-H0','G':'median(H4,H5,H6)-median(H1,H2,H3)','T':'H6-H3','K':'max(Ht-H(t-1)),t=1..6','perProcessHit':'any selected metric > unchanged mode limit','quorum':'>=2 hits block;1 hit review with no automatic pass;0 hits pass only observed window;fewer/more than3 processes cannot claim quorum'},
            'inputs':inputs,'observed':decisions(levels,limit),'syntheticScenarios':scenarios,'positiveGridScenarioCounts':summary,'selfTests':self_test(),
            'limitations':['Not a gate implementation and no measurement/threshold changed.','Observed reference trajectories have no independent no-leak ground truth; pass counts are not false-positive estimates.','Synthetic overlays are explicit mathematical sensitivity scenarios, not measured real leaks or real FNR.','All processes receive the same deterministic retention overlay; no GC/JIT/object-graph feedback simulated.','Grid outcomes are not universal detection minima; reference noise/growth can assist or mask detection.','Scenario counts have no probability weights and are not independent experimental samples.','Review is neither automatic block nor automatic pass; do not relabel it as either.','Snapshot/Chromium141/B4/normal single-window data are excluded from trajectory replay.']}
    pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'observed':result['observed'],'positiveGridScenarioCounts':summary}))


if __name__=='__main__':main()
