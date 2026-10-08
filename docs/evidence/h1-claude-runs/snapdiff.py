import json, sys, collections
def load(p):
    d = json.load(open(p)); m = d['snapshot']['meta']; nf = m['node_fields']; n = len(nf)
    ti, ni, si = nf.index('type'), nf.index('name'), nf.index('self_size')
    types = m['node_types'][0]; strings = d['strings']; nodes = d['nodes']
    agg = collections.defaultdict(lambda: [0, 0])
    for i in range(0, len(nodes), n):
        t = types[nodes[i + ti]]
        key = f"{t}:{strings[nodes[i + ni]][:80]}" if t in ('object', 'closure', 'native', 'code', 'array', 'hidden') else t
        a = agg[key]; a[0] += 1; a[1] += nodes[i + si]
    return agg, d['snapshot']['node_count']
b, bn = load(sys.argv[1]); a, an = load(sys.argv[2])
rows = [(k, a.get(k, [0, 0])[0] - b.get(k, [0, 0])[0], a.get(k, [0, 0])[1] - b.get(k, [0, 0])[1]) for k in set(a) | set(b)]
out = {'nodeCount': {'before': bn, 'after': an}, 'totalSelfSize': {'before': sum(v[1] for v in b.values()), 'after': sum(v[1] for v in a.values())},
       'topBySelfSizeDelta': [{'key': k, 'countDelta': c, 'selfSizeDelta': s} for k, c, s in sorted(rows, key=lambda r: -r[2])[:30]],
       'topByCountDelta': [{'key': k, 'countDelta': c, 'selfSizeDelta': s} for k, c, s in sorted(rows, key=lambda r: -r[1])[:30]]}
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out['totalSelfSize']), json.dumps(out['nodeCount']))
for r in out['topBySelfSizeDelta'][:15]: print(r)
