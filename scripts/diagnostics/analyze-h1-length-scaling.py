#!/usr/bin/env python3
"""Validate raw H1 30/90/300 artifacts and calculate preregistered metrics.

Offline diagnosis only: no browser invocation, gate change, or automatic verdict.
"""
import argparse
import csv
import hashlib
import json
import pathlib
import statistics
import subprocess

SOURCE = '97f38a0e787a4edcb35df4a59823bb1d106def67'
DEFINITION = 'f485ff7496116d101d3d5543db257776d558fd75'
FINGERPRINT = '80fa4a6b963ea9ce0163b12589cf8b6d19466dee5840d252d977702a6d87bf57'
SOURCE_RUNNER_HASH = '6b7f06e2a963ced3b601fd19074aa07a9fa1a670f6aa4467a2445bc3af8d7f25'
E = 1_572_864
TARGET = 16_384
ROOT = pathlib.Path(__file__).resolve().parents[2]


def check(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical_string_hash(text):
    return sha256(json.dumps(text, ensure_ascii=False, separators=(',', ':')).encode())


def safe_reading(heap):
    value = heap.get('usedSize')
    check(type(value) is int and 0 <= value <= 2**53 - 1, 'Invalid raw heap reading')
    return value


def expected_driver(wrapper, original, filename, mode):
    """Execute the pinned prepare-only wrapper with virtual I/O, never the probe."""
    payload = {'wrapper': wrapper, 'original': original, 'filename': filename, 'mode': mode, 'sourceSha': SOURCE}
    program = r'''
const input=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
const path=require('node:path'),outputs=new Map(),wrapperPath='/h1-wrapper.cjs';
const fakeFs={
 readFileSync(file,encoding){
  const value=file===wrapperPath?input.wrapper:file==='/h1-source/scripts/verify-m5-browser.cjs'?input.original:undefined;
  if(value===undefined)throw Error('Unexpected wrapper read '+file);
  return encoding?value:Buffer.from(value);
 },
 mkdirSync(){},writeFileSync(file,data){outputs.set(file,data);}
};
const fakeRequire=name=>name==='node:fs'?fakeFs:name==='node:child_process'?{execFileSync(){return input.sourceSha;}}:require(name);
const fakeProcess={argv:['node',wrapperPath,'--source','/h1-source','--output',path.dirname(input.filename),'--mode',input.mode,'--windows','10','--prepare-only']};
new Function('require','process','__filename','module','console',input.wrapper)(fakeRequire,fakeProcess,wrapperPath,{}, {log(){}});
process.stdout.write(JSON.stringify({driver:outputs.get(input.filename),derivation:JSON.parse(outputs.get(path.join(path.dirname(input.filename),'derivation.json')))}));
'''
    result = subprocess.check_output(['node', '-e', program], input=json.dumps(payload).encode())
    return json.loads(result)


def analyze(batch, mode, run_id):
    inputs = {}

    def raw(relative):
        data = (batch / relative).read_bytes()
        inputs[relative] = {'bytes': len(data), 'sha256': sha256(data)}
        return data

    def read(relative):
        return json.loads(raw(relative))

    sample = f'{mode}-extended-01'
    environment = read('environment.json')
    request = dict(line.split('=', 1) for line in raw('request.txt').decode().splitlines())
    check(request['run_id'] == str(run_id), 'Wrong workflow run')
    check(request['source_sha'] == SOURCE and request['definition_sha'] == DEFINITION, 'Wrong request source/harness')
    check(request['mode'] == mode and request['probe'] == 'extended' and request['samples'] == '1', 'Wrong request protocol')
    check(request['protocol'] == '30-90-300-v1', 'Wrong protocol version')
    check(request['workflow_merge_sha'] == DEFINITION, 'Wrong workflow commit')
    rows = list(csv.DictReader(raw('runs.tsv').decode().splitlines(), delimiter='\t'))
    check(len(rows) == 1 and rows[0]['sample'] == sample, 'Missing or duplicate process')
    check(rows[0]['exit_code'] in ('0', '1'), 'Timeout or infrastructure exit is not a completed measurement')
    check(raw('source-status.txt').strip() == b'', 'Dirty source checkout')
    manifest = read(f'{sample}/manifest.json')
    life = read(f'{sample}/m6-lifecycle.json')
    trend = read(f'{sample}/m6-heap-trend.json')
    derivation = read(f'{sample}/derivation.json')
    derived = raw(f'{sample}/h1-derived-probe.cjs').decode()
    log = raw(f'{sample}.log').decode()

    for key, expected in {'sourceSha': SOURCE, 'definitionSha': DEFINITION, 'workflowMergeSha': DEFINITION,
                          'browser': '153.0.8010.12', 'node': 'v22.23.3', 'diagnosticOnly': True,
                          'viewport': {'width': 1440, 'height': 1000}}.items():
        check(environment[key] == expected, f'Environment {key} mismatch')
    for key, expected in {'sha': SOURCE, 'browser': environment['browser'], 'node': environment['node'],
                          'cpu': environment['cpu'], 'mode': mode, 'build': 'cannon', 'touch': False,
                          'status': '', 'sourceFingerprint': FINGERPRINT, 'finalSourceFingerprint': FINGERPRINT,
                          'errors': []}.items():
        check(manifest[key] == expected, f'Manifest {key} mismatch')
    protocol = {'sourceSha': SOURCE, 'sourceRunnerHash': SOURCE_RUNNER_HASH,
                'warmupCycles': 2, 'cyclesPerWindow': 30, 'windows': 10, 'snapshots': False}
    for key, expected in protocol.items():
        check(derivation[key] == expected and manifest['h1ExtendedDiagnostic'][key] == expected, f'Derivation {key} mismatch')
    check(derivation['prepareOnly'] is False, 'Prepare-only is not execution')
    digest = canonical_string_hash(derived)
    check(digest == derivation['derivedRunnerHash'] == manifest['runnerHash'], 'Executed driver hash mismatch')
    wrapper = subprocess.check_output(['git', 'show', f'{DEFINITION}:scripts/diagnostics/h1-extended-window.cjs'], cwd=ROOT)
    check(sha256(wrapper) == derivation['wrapperSha256'], 'Wrapper hash mismatch')
    original = subprocess.check_output(['git', 'show', f'{SOURCE}:scripts/verify-m5-browser.cjs'], cwd=ROOT).decode()
    check(canonical_string_hash(original) == SOURCE_RUNNER_HASH, 'Pinned original driver mismatch')
    first_line = derived.split('\n', 1)[0]
    check(first_line.startswith('__filename=') and first_line.endswith(';'), 'Missing archived driver filename')
    archived_filename = json.loads(first_line[len('__filename='):-1])
    check(type(archived_filename) is str and pathlib.PurePosixPath(archived_filename).is_absolute()
          and pathlib.PurePosixPath(archived_filename).name == 'h1-derived-probe.cjs', 'Invalid archived filename')
    expected = expected_driver(wrapper.decode(), original, archived_filename, mode)
    check(expected['driver'] == derived, 'Driver is not the exact pinned wrapper derivation')
    check(expected['derivation'] == {**derivation, 'prepareOnly': True}, 'Derivation metadata mismatch')
    assertions = lambda text: [line for line in text.splitlines() if 'assert(' in line or 'assert.' in line]
    check(assertions(original) == assertions(derived), 'Original assertions were changed')
    check(len(assertions(derived)) == derivation['assertionLinesPreserved'] == 30, 'Wrong assertion count')

    limit = 1_048_576 if mode == 'preview' else 1_572_864
    check(manifest['m6Lifecycle'] == life, 'Manifest/lifecycle mismatch')
    for key, expected in {'heapDiagnostics': False, 'warmupExperiment': False, 'warmupCycles': 2,
                          'cycles': 30, 'heapCeilingBytes': limit}.items():
        check(life[key] == expected, f'Lifecycle {key} mismatch')
    check(len(life['rows']) == 30, 'Incomplete first lifecycle window')
    for i, row in enumerate(life['rows'], 1):
        check(type(row['cycle']) is int and row['cycle'] == i, 'Invalid first-window cycle index')
        live = row['m6']['lifecycle']
        check(set(live) == {'applications', 'sessions', 'observers'}
              and all(type(value) is int and value == 1 for value in live.values()), 'Application resources accumulated')
    check(trend['heapDiagnostics'] is False and trend['warmupCycles'] == 2 and trend['cyclesPerWindow'] == 30, 'Trend protocol mismatch')
    windows = trend['windows']
    check(len(windows) == 10, 'Not all 300 cycles completed')
    for key in ('beforeHeap', 'afterHeap', 'heapDelta', 'beforeResources', 'afterResources'):
        check(life[key] == windows[0][key], 'First window/lifecycle mismatch')
    base_resources = windows[0]['beforeResources']
    for i, window in enumerate(windows, 1):
        check(type(window['window']) is int and window['window'] == i
              and type(window['cycles']) is int and window['cycles'] == 30, 'Invalid window index/cycles')
        before, after = safe_reading(window['beforeHeap']), safe_reading(window['afterHeap'])
        check(type(window['heapDelta']) is int and window['heapDelta'] == after - before, 'Delta differs from raw readings')
        for resources in (window['beforeResources'], window['afterResources']):
            check(all(type(resources.get(key)) is int and 0 <= resources[key] <= 2**53-1
                      for key in ('listeners', 'pendingRaf')), 'Invalid resource count')
            check(resources['listeners'] == base_resources['listeners'], 'Listeners accumulated')
            check(resources['pendingRaf'] <= base_resources['pendingRaf'] + 1, 'RAF accumulated')
        if i > 1:
            check(windows[i-2]['afterHeap'] == window['beforeHeap'], 'Noncontiguous heap boundaries')
            check(windows[i-2]['afterResources'] == window['beforeResources'], 'Noncontiguous resource boundaries')
    persistent = all(w['heapDelta'] > 0 for w in windows)
    check(trend['persistentGrowth'] is persistent, 'persistentGrowth differs from actual windows')
    exceeded = any(w['heapDelta'] > limit for w in windows)
    expected_failure = ('each follow-up 30-cycle window retains the historical 1MiB ceiling' if exceeded else
                        'persistent post-warmup growth: investigate as a potential real leak, do not accept the method' if persistent else None)
    check(type(manifest['passed']) is bool, 'Non-boolean passed flag')
    check(manifest['passed'] == (expected_failure is None), 'Original diagnostic outcome contradicts raw windows')
    summary = json.loads(log.strip().splitlines()[-1])
    check(type(summary['passed']) is bool, 'Non-boolean log passed flag')
    check(summary == {key: manifest[key] for key in ('passed', 'mode', 'build', 'touch', 'durationSeconds')}, 'Log/manifest mismatch')
    check((rows[0]['exit_code'] == '0') == (manifest['passed'] is True), 'Exit/manifest mismatch')
    if not manifest['passed']:
        first = manifest.get('failure', '').splitlines()[0]
        check(first == 'AssertionError [ERR_ASSERTION]: ' + expected_failure, 'First failure contradicts the original diagnostic assertion order')
        check(first in log, 'Failure absent from raw log')
    else:
        check(manifest.get('failure') in (None, ''), 'Successful manifest contains failure')

    h = [safe_reading(windows[0]['beforeHeap'])] + [safe_reading(w['afterHeap']) for w in windows]
    c = h[10] - h[3]
    late_drawdown, peak_cycle, trough_cycle = max(
        ((h[i]-h[j], 30*i, 30*j) for i in range(3, 11) for j in range(i, 11)), key=lambda row: row[0])
    return {
        'protocol': '30-90-300-v1', 'runId': run_id, 'definitionSha': DEFINITION, 'sourceSha': SOURCE,
        'mode': mode, 'sample': sample, 'environment': environment, 'process': rows[0],
        'durationSeconds': manifest['durationSeconds'], 'originalDiagnosticPassed': manifest['passed'],
        'originalDiagnosticFailure': manifest.get('failure'), 'identityAndOriginalAssertionsVerified': True,
        'allWindowResourcesVerified': True, 'levelsBytes': h, 'deltasBytes': [w['heapDelta'] for w in windows],
        'checkpointsBytes': {str(n): h[n//30] for n in (0, 30, 90, 180, 300)},
        'metrics': {'startup0to30Bytes': h[1]-h[0], 'middle30to90Bytes': h[3]-h[1],
                    'middleBytesPerCycle': (h[3]-h[1])/60, 'late90to300Bytes': c, 'lateBytesPerCycle': c/210,
                    'late90to180Bytes': h[6]-h[3], 'tail180to300Bytes': h[10]-h[6],
                    'tailBytesPerCycle': (h[10]-h[6])/120, 'lastThreeLevelRangeBytes': max(h[8:11])-min(h[8:11]),
                    'lastThreeLevelMedianBytes': statistics.median(h[8:11]), 'total0to300Bytes': h[10]-h[0],
                    'maxWindowIncreaseBytes': max(w['heapDelta'] for w in windows),
                    'largestLatePeakToTroughDeclineBytes': late_drawdown,
                    'lateDrawdownPeakCycle': peak_cycle, 'lateDrawdownTroughCycle': trough_cycle,
                    'largestLateWindowDeclineBytes': min(0, *(w['heapDelta'] for w in windows[3:]))},
        'conditionalResolution': {'assumedDisturbanceBytes': E, 'targetBytesPerCycle': TARGET,
                                  'lateRateLowerBytesPerCycle': (c-E)/210, 'lateRateUpperBytesPerCycle': (c+E)/210,
                                  'observedLateExceedsDisturbance': c > E,
                                  'tailIncreaseExceedsDisturbance': h[10]-h[6] > E,
                                  'lateWindowDisturbanceExceedsAssumption': any(abs(w['heapDelta']) > E for w in windows[3:]),
                                  'latePeakToTroughDeclineExceedsAssumption': late_drawdown > E,
                                  'largeLateDecline': c < -E,
                                  'note': 'Conditional engineering band from limited historical data; not a confidence interval or calibrated power. No automatic leak/no-leak verdict.'},
        'inputs': inputs,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--batch', type=pathlib.Path, required=True)
    parser.add_argument('--mode', choices=('preview', 'dev'), required=True)
    parser.add_argument('--run-id', type=int, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    result = analyze(args.batch, args.mode, args.run_id)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('mode', 'runId', 'metrics', 'conditionalResolution')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
