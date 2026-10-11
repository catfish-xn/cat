"""Offline synthetic checks for the diagnostic parser, not a project gate."""
import copy
import gzip
import importlib.util
import json
import pathlib
import tempfile

spec = importlib.util.spec_from_file_location('series', pathlib.Path(__file__).with_name('analyze-h1-snapshot-series.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
checks = []


def check(name, value):
    if not value:
        raise AssertionError(name)
    checks.append(name)


for kind, name, expected in [
    ('weak', 'ordinary', False),
    ('internal', 'part of key -> value pair in ephemeron table', False),
    ('internal', '9 / part of key -> value pair in ephemeron table', False),
    ('internal', '2 / part of key (Object @1) -> value (Object @3) pair in WeakMap (table @5)', False),
    ('internal', 'part of key (A\n(B) @1) -> value (C @3) pair in WeakMap (table @5)', False),
    ('property', 'WeakMap', True),
    ('property', 'part of key -> value pair in ephemeron table', True),
    ('internal', 'WeakMapConstructor', True),
    ('internal', 'EphemeronKeyBarrier', True),
    ('element', 0, True),
    ('hidden', 1, True),
    ('shortcut', 'window', True),
]:
    check(kind + ':' + str(name), m.allowed_edge(kind, name) == expected)
for kind, name in [('internal', 'unknown part of key format'), ('conditional_future', 'x')]:
    try:
        m.allowed_edge(kind, name)
    except ValueError:
        checks.append('reject:' + kind + ':' + name)
    else:
        raise AssertionError('Unclassified relation accepted')

# root -> key and table; only conditional links to value. weak-only fifth node.
raw = {'snapshot': {'node_count': 5, 'edge_count': 5, 'meta': {
    'node_fields': ['type', 'name', 'id', 'self_size', 'edge_count'],
    'node_types': [['synthetic', 'object'], 'string', 'number', 'number', 'number'],
    'edge_fields': ['type', 'name_or_index', 'to_node'],
    'edge_types': [['property', 'internal', 'weak'], 'string_or_number', 'node']}},
    'strings': ['root', 'key', 'table', 'value', 'weakValue', 'part of key -> value pair in ephemeron table'],
    'nodes': [0,0,1,0,3, 1,1,3,10,1, 1,2,5,10,1, 1,3,7,20,0, 1,4,9,30,0],
    'edges': [0,1,5, 0,2,10, 2,4,20, 1,5,15, 1,5,15]}
with tempfile.TemporaryDirectory() as directory:
    path = pathlib.Path(directory)/'snapshot.json'
    def load(data, compressed=False):
        encoded = json.dumps(data).encode()
        path.write_bytes(gzip.compress(encoded, mtime=0) if compressed else encoded)
        return m.Snapshot(path)
    s = load(raw)
    check('conditional value excluded', s.parent[3] is None)
    check('weak-only node excluded', s.parent[4] is None)
    check('strong key and table reachable', s.parent[1] is not None and s.parent[2] is not None)
    check('gzip equivalent', load(raw, True).summary() ['self_size'] == s.summary()['self_size'])
    changed = copy.deepcopy(raw)
    changed['edges'][9] = 0
    t = load(changed)
    check('independent property reaches value', t.parent[3] is not None)
    check('same data delta zero', m.compare(s, s)['delta_self_size'] == 0)
    reordered = copy.deepcopy(raw)
    for prefix, fields, types, width in [('node', 'node_fields', 'node_types', 5), ('edge', 'edge_fields', 'edge_types', 3)]:
        arr = reordered[prefix+'s']; meta = reordered['snapshot']['meta']
        meta[fields].reverse(); meta[types].reverse()
        reordered[prefix+'s'] = [v for start in range(0,len(arr),width) for v in arr[start:start+width][::-1]]
    check('field-order independent', load(reordered).summary()['self_size'] == s.summary()['self_size'])
    for label, mutate in [
        ('duplicate ID', lambda d: d['nodes'].__setitem__(7,1)),
        ('negative node index', lambda d: d['nodes'].__setitem__(1,-1)),
        ('negative size', lambda d: d['nodes'].__setitem__(8,-1)),
        ('negative edge count', lambda d: d['nodes'].__setitem__(9,-1)),
        ('negative edge type', lambda d: d['edges'].__setitem__(0,-1)),
        ('unaligned target', lambda d: d['edges'].__setitem__(2,6)),
        ('bad target', lambda d: d['edges'].__setitem__(2,500)),
        ('bad edge name', lambda d: d['edges'].__setitem__(1,500)),
        ('duplicate schema field', lambda d: d['snapshot']['meta']['node_fields'].__setitem__(1,'type')),
        ('unknown edge kind', lambda d: d['snapshot']['meta']['edge_types'][0].append('future_conditional')),
    ]:
        damaged = copy.deepcopy(raw); mutate(damaged)
        try:
            load(damaged)
        except ValueError:
            checks.append('reject:' + label)
        else:
            raise AssertionError('Malformed graph accepted: ' + label)
print(json.dumps({'passed': len(checks), 'checks': checks}, ensure_ascii=False, indent=2))
