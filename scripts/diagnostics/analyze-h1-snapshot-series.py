"""Offline snapshot series evidence, not a leak detector or acceptance gate."""
import argparse
import collections
import gzip
import hashlib
import json
import pathlib
import re


def conditional_edge(kind, name):
    if kind != 'internal' or not isinstance(name, str):
        return False
    name = re.sub(r'^\d+ / ', '', name)
    if name.startswith('part of key -> value pair in ephemeron table'):
        return True
    if re.fullmatch(r'part of key \(.*? @\d+\) -> value \(.*? @\d+\) pair in WeakMap \(table @\d+\)', name, flags=re.S):
        return True
    if 'part of key' in name or 'ephemeron table' in name:
        raise ValueError('Unclassified conditional edge: ' + name)
    return False


def allowed_edge(kind, name, shortcuts=True):
    if kind not in {'context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak'}:
        raise ValueError('Unknown edge kind: ' + str(kind))
    return kind != 'weak' and (shortcuts or kind != 'shortcut') and not conditional_edge(kind, name)


class Snapshot:
    def __init__(self, path):
        data = pathlib.Path(path).read_bytes()
        self.sha256 = hashlib.sha256(data).hexdigest()
        self.raw = json.loads(gzip.decompress(data) if data[:2] == b'\x1f\x8b' else data)
        meta = self.raw['snapshot']['meta']
        self.nf, self.ef = meta['node_fields'], meta['edge_fields']
        if len(set(self.nf)) != len(self.nf) or len(set(self.ef)) != len(self.ef):
            raise ValueError('Duplicate schema fields')
        self.nw, self.ew = len(self.nf), len(self.ef)
        if not self.nw or not self.ew:
            raise ValueError('Empty schema')
        self.n, self.e, self.strings = self.raw['nodes'], self.raw['edges'], self.raw['strings']
        self.ni = {v: i for i, v in enumerate(self.nf)}
        self.ei = {v: i for i, v in enumerate(self.ef)}
        for field in ('type', 'name', 'id', 'self_size', 'edge_count'):
            if field not in self.ni:
                raise ValueError('Missing node field ' + field)
        for field in ('type', 'name_or_index', 'to_node'):
            if field not in self.ei:
                raise ValueError('Missing edge field ' + field)
        self.nt = meta['node_types'][self.ni['type']]
        self.et = meta['edge_types'][self.ei['type']]
        if len(self.n) % self.nw or len(self.e) % self.ew:
            raise ValueError('Truncated graph arrays')
        self.count = len(self.n) // self.nw
        if self.count != self.raw['snapshot']['node_count'] or len(self.e) // self.ew != self.raw['snapshot']['edge_count']:
            raise ValueError('Graph count mismatch')
        if any(type(v) is not int or v < 0 for v in self.n + self.e):
            raise ValueError('Graph fields must be nonnegative integers')
        if not set(self.et) <= {'context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak'}:
            raise ValueError('Unknown edge kind in schema')
        self.ids, self.starts, self.descs = {}, [0], []
        for i in range(self.count):
            if self.n[i*self.nw+self.ni['type']] >= len(self.nt) or self.n[i*self.nw+self.ni['name']] >= len(self.strings):
                raise ValueError('Node type/name index out of bounds')
            d = {f: self.n[i*self.nw+self.ni[f]] for f in ('id', 'self_size')}
            d['type'] = self.nt[self.n[i*self.nw+self.ni['type']]]
            d['name'] = self.strings[self.n[i*self.nw+self.ni['name']]]
            if d['id'] in self.ids:
                raise ValueError('Duplicate ID')
            self.ids[d['id']] = i
            self.descs.append(d)
            self.starts.append(self.starts[-1] + self.n[i*self.nw+self.ni['edge_count']]*self.ew)
        if self.starts[-1] != len(self.e):
            raise ValueError('Edge counts do not reconcile')
        self.edge_counts = collections.Counter()
        for i in range(self.count):
            for _, kind, name in self.edges(i):
                self.edge_counts['weak' if kind == 'weak' else 'conditional' if conditional_edge(kind, name) else 'ordinary'] += 1
        if self.descs[0]['type'] != 'synthetic':
            raise ValueError('First node is not synthetic root')
        self.parent = self.bfs(True)
        self.no_shortcut_parent = None

    def edges(self, i):
        for p in range(self.starts[i], self.starts[i+1], self.ew):
            target = self.e[p+self.ei['to_node']]
            if target % self.nw or not 0 <= target < len(self.n):
                raise ValueError('Invalid edge target')
            if self.e[p+self.ei['type']] >= len(self.et):
                raise ValueError('Edge type index out of bounds')
            kind = self.et[self.e[p+self.ei['type']]]
            name = self.e[p+self.ei['name_or_index']]
            if kind not in ('element', 'hidden'):
                if name >= len(self.strings):
                    raise ValueError('Edge name index out of bounds')
                name = self.strings[name]
            yield target // self.nw, kind, name

    def key(self, i):
        d = self.descs[i]
        return d['type'] + ':' + d['name']

    def bfs(self, shortcuts):
        parent = [None]*self.count
        parent[0] = (-1, None, None)
        queue = collections.deque([0])
        while queue:
            i = queue.popleft()
            for j, kind, name in self.edges(i):
                if parent[j] is None and allowed_edge(kind, name, shortcuts):
                    parent[j] = (i, kind, name)
                    queue.append(j)
        return parent

    def path(self, i, shortcuts=True):
        if not shortcuts and self.no_shortcut_parent is None:
            self.no_shortcut_parent = self.bfs(False)
        parent = self.parent if shortcuts else self.no_shortcut_parent
        if parent[i] is None:
            return None
        result = []
        while i:
            j, kind, name = parent[i]
            if not allowed_edge(kind, name, shortcuts):
                raise ValueError('Excluded edge in path')
            result.append({'from': self.descs[j], 'edge_type': kind, 'edge_name': name, 'to': self.descs[i]})
            i = j
        return result[::-1]

    def summary(self):
        groups, types = collections.defaultdict(lambda: [0, 0]), collections.defaultdict(lambda: [0, 0])
        for i, d in enumerate(self.descs):
            for target in (groups[self.key(i)], types[d['type']]):
                target[0] += 1
                target[1] += d['self_size']
        shapes = {'scene_candidate': {'session', 'application', 'strategyPanel', 'views', 'sys'},
                  'session_candidate': {'disposed', 'matchState', 'combatLedger', 'pauseReasons', 'listeners'}}
        candidates = {key: [] for key in shapes}
        performance = []
        for i, d in enumerate(self.descs):
            if d['type'] == 'object':
                properties = {name for _, kind, name in self.edges(i) if kind == 'property'}
                for kind, required in shapes.items():
                    if required <= properties:
                        candidates[kind].append({'node': d, 'matched_properties': sorted(required), 'path': self.path(i), 'properties': [
                            {'name': name, 'target': self.descs[j]} for j, t, name in self.edges(i) if t == 'property']})
            if d['type'] == 'native' and d['name'] == 'Performance':
                performance.append(i)
        incoming = {i: [] for i in performance}
        for u in range(self.count):
            for v, kind, name in self.edges(u):
                if v in incoming:
                    ordinary = allowed_edge(kind, name)
                    incoming[v].append({'from': self.descs[u], 'kind': kind, 'name': name, 'ordinary': ordinary,
                                        'source_root_path': self.path(u) if ordinary else None})
        return {'sha256': self.sha256, 'node_count': self.count,
                'self_size': sum(d['self_size'] for d in self.descs),
                'extra_native_bytes': self.raw['snapshot'].get('extra_native_bytes'),
                'groups': dict(sorted(groups.items())), 'types': dict(sorted(types.items())),
                'edge_counts': dict(self.edge_counts), 'reachable_strict_graph': sum(p is not None for p in self.parent),
                'shape_candidates': candidates,
                'native_performance': [{'node': self.descs[i], 'incoming': incoming[i], 'root_path': self.path(i),
                                        'root_path_without_shortcuts': self.path(i, False)} for i in performance]}


def compare(before, after):
    bg, ag = collections.defaultdict(list), collections.defaultdict(list)
    for i in range(before.count): bg[before.key(i)].append(i)
    for i in range(after.count): ag[after.key(i)].append(i)
    rows = []
    for key in bg.keys() | ag.keys():
        old, new = bg[key], ag[key]
        rows.append({'key': key, 'delta_count': len(new)-len(old), 'delta_self_size':
                     sum(after.descs[i]['self_size'] for i in new)-sum(before.descs[i]['self_size'] for i in old)})
    rows.sort(key=lambda r: (-r['delta_self_size'], r['key']))
    selected = set()
    for prefix in ('code:', 'native:', 'object:', 'array:', 'closure:'):
        selected.update(r['key'] for r in [x for x in rows if x['key'].startswith(prefix) and x['delta_self_size'] > 0][:5])
        selected.update(r['key'] for r in sorted([x for x in rows if x['key'].startswith(prefix) and x['delta_count'] > 0], key=lambda x: (-x['delta_count'], x['key']))[:3])
    groups = {}
    changed_labels = []
    for i, d in enumerate(after.descs):
        j = before.ids.get(d['id'])
        if j is not None and before.key(j) != after.key(i):
            changed_labels.append({'before': before.descs[j], 'after': d})
    for key in sorted(selected):
        classes = collections.defaultdict(list)
        for i in ag[key]:
            d = after.descs[i]; j = before.ids.get(d['id'])
            category = 'id_not_in_before' if j is None else 'same_id_changed_label' if before.key(j) != key else 'same_id_same_label'
            classes[category].append(i)
        reps = []
        for category, members in classes.items():
            # Actual immediate source IDs keep different same-named retainers distinct.
            seen = set()
            ordered = sorted(members, key=lambda i: (-after.descs[i]['self_size'], after.descs[i]['id']))
            for i in ordered:
                parent = after.parent[i]
                signature = None if parent is None else (parent[0], parent[1], str(parent[2]))
                if signature in seen: continue
                seen.add(signature)
                reps.append({'identity_class': category, 'node': after.descs[i], 'path': after.path(i)})
                if len(seen) == 2: break
        groups[key] = {'identity_counts': {c: len(v) for c, v in classes.items()}, 'representatives': reps}
    total = sum(r['delta_self_size'] for r in rows)
    if total != sum(d['self_size'] for d in after.descs)-sum(d['self_size'] for d in before.descs):
        raise ValueError('Delta reconciliation failed')
    return {'delta_self_size': total, 'all_group_deltas': rows, 'selected_groups': groups, 'same_id_changed_labels': changed_labels}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--stage', action='append', nargs=2, metavar=('LABEL', 'PATH'), required=True)
    p.add_argument('--runtime-sha', required=True)
    p.add_argument('--browser', required=True)
    p.add_argument('--run-url', required=True)
    p.add_argument('--output', required=True)
    args = p.parse_args()
    if len(args.stage) < 2 or len({s[0] for s in args.stage}) != len(args.stage):
        p.error('At least two uniquely named ordered stages required')
    stages, pairs, previous = {}, {}, None
    for label, path in args.stage:
        current = Snapshot(path)
        stages[label] = current.summary()
        if previous is not None:
            old_label, old = previous
            pairs[old_label+' -> '+label] = compare(old, current)
        previous = (label, current)
    first_label, first_path = args.stage[0]
    last_label = args.stage[-1][0]
    whole = compare(Snapshot(first_path), previous[1])
    if sum(v['delta_self_size'] for v in pairs.values()) != whole['delta_self_size']:
        raise ValueError('Series delta reconciliation failed')
    result = {'runtime_sha': args.runtime_sha, 'browser': args.browser, 'run_url': args.run_url,
              'metadata_origin': 'Caller-supplied; verify against archived manifest/environment before use',
              'method': 'Strict graph excludes weak and recognized conditional ephemeron/WeakMap edges; unknown conditional patterns fail. Paths are witnesses, not dominators, retained sizes, exclusive owners or leak proof. Shortcut root aliases labeled; Performance also has no-shortcut paths. Identity classes are descriptive only within the same profiler session. Shape matches are candidates, not verified application identity. Snapshot self-size differs from Runtime.usedSize; snapshot taking perturbs execution. JS object/closure/array groups are not all application-owned. extra_native_bytes is separate, never added to self_size.',
              'stages': stages, 'adjacent_pairs': pairs, 'first_to_last': whole,
              'validation': 'Schema/count/unique-ID/edge-target/excluded-path and group/series total delta checks passed'}
    encoded = (json.dumps(result, ensure_ascii=False, indent=2)+'\n').encode('utf-8')
    pathlib.Path(args.output).write_bytes(gzip.compress(encoded, mtime=0) if args.output.endswith('.gz') else encoded)
    print(json.dumps({'stages': {k: {'nodes': v['node_count'], 'self_size': v['self_size'], 'reachable': v['reachable_strict_graph']} for k, v in stages.items()}, 'net_self_size': whole['delta_self_size']}))


if __name__ == '__main__':
    main()
