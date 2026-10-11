"""Verify/archive original-parameter H1 CI batches without changing their outcomes."""
import argparse
import csv
import hashlib
import io
import json
import pathlib
import statistics
import tempfile
import os
import zipfile

if not __debug__:
    raise RuntimeError('Do not run evidence validation with Python -O')

SOURCE = '97f38a0e787a4edcb35df4a59823bb1d106def67'
RUNNER = '6b7f06e2a963ced3b601fd19074aa07a9fa1a670f6aa4467a2445bc3af8d7f25'
FINGERPRINT = '80fa4a6b963ea9ce0163b12589cf8b6d19466dee5840d252d977702a6d87bf57'
p = argparse.ArgumentParser()
for key in ['archive','output','archive-sha256','definition-sha','mode']:
    p.add_argument('--'+key, required=True)
p.add_argument('--run-id',required=True,type=int)
p.add_argument('--artifact-id',required=True,type=int)
p.add_argument('--samples',required=True,type=int)
a = p.parse_args()
if a.mode not in ('preview','dev') or not 1 <= a.samples <= 5:
    p.error('Invalid mode/sample count')
data = pathlib.Path(a.archive).read_bytes()
assert hashlib.sha256(data).hexdigest() == a.archive_sha256, 'Archive SHA mismatch'
out = pathlib.Path(a.output)
pending = {}
with zipfile.ZipFile(io.BytesIO(data)) as z:
    assert z.testzip() is None, 'Archive CRC failure'
    assert len(z.namelist()) == len(set(z.namelist())), 'Duplicate archive member'
    assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in z.namelist()), 'Unsafe archive path'
    def read(name): return z.read(name)
    def archive(name):
        pending[name] = read(name)
    request = dict(line.split('=',1) for line in read('request.txt').decode().splitlines())
    env = json.loads(read('environment.json'))
    assert request['source_sha'] == env['sourceSha'] == SOURCE
    assert request['definition_sha'] == env['definitionSha'] == a.definition_sha
    assert request['run_id'] == str(a.run_id) and request['mode'] == a.mode and request['probe'] == 'normal'
    assert request['samples'] == str(a.samples) and request['attempt'] == '1'
    assert env['browser'] == '153.0.8010.12' and not read('source-status.txt')
    assert env['node'].startswith('v22.')
    assert request['workflow_merge_sha'] == env['workflowMergeSha']
    rows = list(csv.DictReader(io.StringIO(read('runs.tsv').decode()), delimiter='\t'))
    assert len(rows) == a.samples and len({r['sample'] for r in rows}) == a.samples
    results = []
    ceiling = 1048576 if a.mode == 'preview' else 1572864
    for index,row in enumerate(rows,1):
        label = row['sample']
        assert label == f'{a.mode}-normal-{index:02d}'
        mraw = read(label+'/manifest.json'); m = json.loads(mraw)
        l = json.loads(read(label+'/m6-lifecycle.json'))
        assert m['node'] == env['node'] and m['cpu'] == env['cpu'] and m['cpuCount'] == env['cpuCount']
        assert m['m6Lifecycle'] == l and len(l['rows']) == 30 and m['errors'] == []
        assert m['sha'] == SOURCE and not m['status'] and m['browser'] == env['browser']
        assert m['runnerHash'] == RUNNER and m['sourceFingerprint'] == m['finalSourceFingerprint'] == FINGERPRINT
        assert m['mode'] == a.mode and m['build'] == 'cannon' and m['touch'] is False
        assert not l['heapDiagnostics'] and not l['warmupExperiment'] and l['warmupCycles'] == 2 and l['cycles'] == 30
        assert l['heapCeilingBytes'] == ceiling
        delta = l['afterHeap']['usedSize']-l['beforeHeap']['usedSize']
        assert delta == l['heapDelta']
        status = int(row['exit_code']); assert status in (0,1), 'Timeout/other failure needs separate diagnosis'
        log = read(label+'.log').decode()
        terminal = json.loads(log.strip().splitlines()[-1])
        for key in ('passed','mode','build','touch','durationSeconds'):
            assert terminal[key] == m[key], 'Log terminal summary mismatch'
        if delta > ceiling:
            assert isinstance(m.get('failure'), str) and m['failure'] in log
            assert status == 1 and not m['passed'] and f'full application post-GC heap growth <={ceiling} bytes ({a.mode})' in log
        else:
            assert not m.get('failure')
            assert status == 0 and m['passed'], 'Non-heap failure must be investigated, not pooled as a heap pass'
        results.append({'sample':label,'beforeBytes':l['beforeHeap']['usedSize'],'afterBytes':l['afterHeap']['usedSize'],
                        'deltaBytes':delta,'overCeiling':delta>ceiling,'exitCode':status,'startedUtc':row['started_utc'],
                        'endedUtc':row['ended_utc'],'manifestSha256':hashlib.sha256(mraw).hexdigest(),
                        'manifestIdentity':{k:m[k] for k in ['sha','status','node','browser','runnerHash','sourceFingerprint','finalSourceFingerprint','mode','build','touch','passed','errors','durationSeconds','cpu','cpuCount','loadAtStart']}})
        archive(label+'/m6-lifecycle.json');archive(label+'.log')
    for name in ['request.txt','environment.json','runs.tsv','source-status.txt','preflight.log','build.log']:
        archive(name)
    deltas = [r['deltaBytes'] for r in results]
    summary = {'runId':a.run_id,'definitionSha':a.definition_sha,'sourceSha':SOURCE,'artifactId':a.artifact_id,
               'artifactUrl':f'https://github.com/catfish-xn/cat/actions/runs/{a.run_id}/artifacts/{a.artifact_id}',
               'archiveBytes':len(data),'archiveSha256':a.archive_sha256,'archiveMembers':len(z.namelist()),
               'allMemberCrcPassed':True,'mode':a.mode,'ceilingBytes':ceiling,'samples':results,
               'statistics':{'n':len(results),'exceedances':sum(r['overCeiling'] for r in results),'medianBytes':statistics.median(deltas),'meanBytes':statistics.mean(deltas),'minBytes':min(deltas),'maxBytes':max(deltas)},
               'limitations':'Exploratory exceedance observations, not false-positive rate. Same job shares host; stratify CPU/job/mode. Full raw manifests/traces/screenshots remain linked artifact, normally 30-day retention. No failed sample replaced.'}
    pending['provenance.json'] = (json.dumps(summary,ensure_ascii=False,indent=2)+'\n').encode()
    lines=[f'# CI153 {a.mode} 原参数批次 {a.run_id}', '', f'[运行](https://github.com/catfish-xn/cat/actions/runs/{a.run_id})；[完整原始artifact]({summary["artifactUrl"]})。', '', f'定义{a.definition_sha}；源码{SOURCE}；原2预热/30周期、无快照，Chromium153.0.8010.12。全部样本身份、原runner/source指纹、阈值、退出码/日志与ZIP SHA/CRC通过核验。', '', '| 样本 | before B | after B | delta B | exit |','| --- | ---: | ---: | ---: | ---: |']
    lines += [f'| {r["sample"]} | {r["beforeBytes"]:,} | {r["afterBytes"]:,} | {r["deltaBytes"]:+,} | {r["exitCode"]} |' for r in results]
    lines += ['',f'本批超限{summary["statistics"]["exceedances"]}/{len(results)}，仅为观察频率，不是误报率。CPU：{env["cpu"]}；与其他job/CPU分层展示，不假设独立同分布。失败保留，不重跑替换。', '', '本目录生命周期/日志/请求/环境为原字节保存；完整manifest与trace等其余原始数据仍在artifact（通常30天），摘要及原manifest哈希在provenance.json。H1未签收。','']
    pending['README.md'] = '\n'.join(lines).encode()
# Validate the entire batch before writing; an existing directory is only
# accepted as an exact idempotent copy, never silently overwritten/mixed.
if out.exists():
    existing = {str(f.relative_to(out)): f.read_bytes() for f in out.rglob('*') if f.is_file()}
    if existing != pending:
        raise RuntimeError('Existing evidence differs; use a fresh output directory')
else:
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.h1-stage-', dir=out.parent) as temporary:
        staging = pathlib.Path(temporary)
        for name, content in pending.items():
            target = staging/name
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(content)
        if out.exists():
            raise RuntimeError('Output appeared during validation')
        os.rename(staging, out)
print(json.dumps(summary['statistics']))
