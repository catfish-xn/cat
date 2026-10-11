"""Selected same-run boundary counts; descriptive diagnostics, no gate."""
import argparse
import collections
import gzip
import hashlib
import importlib.util
import json
import pathlib

spec = importlib.util.spec_from_file_location('series', pathlib.Path(__file__).with_name('analyze-h1-snapshot-series.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
p = argparse.ArgumentParser()
p.add_argument('--directory', required=True)
p.add_argument('--output', required=True)
a = p.parse_args()
selected = ['native:blink::NetworkResourcesData::ResourceData', 'native:PerformanceResourceTiming',
            'native:PerformanceLongTaskTiming', 'native:TaskAttributionTiming',
            'native:PerformanceLongAnimationFrameTiming', 'native:LayoutShift', 'native:DOMRectReadOnly',
            'object:Object', 'object:Array', 'closure:*']
rows = []
for label, filename in [('before', 'before.heapsnapshot'), ('window-1', 'after.heapsnapshot')] + [(f'window-{n}', f'window-{n}.heapsnapshot') for n in range(2,7)]:
    s = m.Snapshot(pathlib.Path(a.directory)/filename)
    counts = collections.Counter()
    for i,d in enumerate(s.descs):
        counts[s.key(i)] += 1
        if d['type'] == 'closure': counts['closure:*'] += 1
    kinds = collections.Counter()
    for i in range(s.count):
        for _,kind,name in s.edges(i):
            if m.conditional_edge(kind,name):
                kinds['numbered_weakmap' if 'pair in WeakMap' in name else 'legacy_ephemeron'] += 1
    rows.append({'label':label,'file':filename,'sha256':s.sha256,'nodes':s.count,
                 'self_size':sum(d['self_size'] for d in s.descs),'selected_counts':{k:counts[k] for k in selected},
                 'excluded_conditional_formats':dict(kinds),'strict_reachable':sum(x is not None for x in s.parent)})
result={'method':'Fixed ordered filenames from a single six-window snapshot run; verify same-session provenance separately. Selected counts are descriptive only; no per-resource mapping or global capacity/leak claim. self_size differs from Runtime.usedSize. Conditional classifier rejects unknown patterns.', 'boundaries':rows}
pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'boundaries':len(rows),'resourceTiming':[r['selected_counts']['native:PerformanceResourceTiming'] for r in rows],'resourceData':[r['selected_counts']['native:blink::NetworkResourcesData::ResourceData'] for r in rows]}))
