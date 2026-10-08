"""Offline H1 diagnosis for the pinned Chromium 141 snapshot pair.
Name-based application probes and representative IDs are evidence-specific.
This is not a generic leak detector or a replacement for the browser gate.
"""
import json,gzip,collections,hashlib,sys,os
class Snapshot:
 def __init__(self,path):
  self.raw=json.load(gzip.open(path));m=self.raw['snapshot']['meta'];self.nf=m['node_fields'];self.ef=m['edge_fields'];self.nw=len(self.nf);self.ew=len(self.ef);self.n=self.raw['nodes'];self.e=self.raw['edges'];self.s=self.raw['strings'];self.nt=m['node_types'][0];self.et=m['edge_types'][0];self.count=len(self.n)//self.nw
  assert self.nf[:5]==['type','name','id','self_size','edge_count'], 'Unsupported node field order'
  assert self.ef==['type','name_or_index','to_node'], 'Unsupported edge field order'
  assert len(self.n)%self.nw==0 and len(self.e)%self.ew==0, 'Truncated graph arrays'
  assert self.count==self.raw['snapshot']['node_count'], 'Node count mismatch'
  assert len(self.e)//self.ew==self.raw['snapshot']['edge_count'], 'Edge count mismatch'
  self.ids={self.n[i*self.nw+2]:i for i in range(self.count)};self.starts=[0];v=0
  for i in range(self.count):v+=self.n[i*self.nw+4]*self.ew;self.starts.append(v)
  assert len(self.ids)==self.count, 'Duplicate node IDs in one snapshot'
  assert v==len(self.e), 'Per-node edges do not reconcile'
  assert all(self.e[p+2]%self.nw==0 and 0<=self.e[p+2]<len(self.n) for p in range(0,len(self.e),self.ew)), 'Invalid edge target'
 def desc(self,i):
  o=i*self.nw
  return {'id':self.n[o+2],'type':self.nt[self.n[o]],'name':self.s[self.n[o+1]],'self_size':self.n[o+3]}
 def edges(self,i):
  for p in range(self.starts[i],self.starts[i+1],self.ew):
   t=self.et[self.e[p]];name=self.e[p+1] if t in ('element','hidden') else self.s[self.e[p+1]]
   yield self.e[p+2]//self.nw,t,name,p
 def bfs(self):
  self.parent=[None]*self.count;self.parent[0]=(-1,None,None);q=collections.deque([0])
  while q:
   u=q.popleft()
   for v,t,n,p in self.edges(u):
    if t!='weak' and not str(n).startswith('part of key -> value pair in ephemeron table') and self.parent[v] is None:self.parent[v]=(u,t,n);q.append(v)
 def path(self,i):
  if self.parent[i] is None:return None
  r=[]
  while i!=0:
   p,t,n=self.parent[i];r.append({'from':self.desc(p),'edge_type':t,'edge_name':n,'to':self.desc(i)});i=p
  return r[::-1]
 def key(self,i):d=self.desc(i);return d['type']+':'+d['name']
def summarize(s):
 d=collections.defaultdict(lambda:[0,0])
 for i in range(s.count):a=d[s.key(i)];a[0]+=1;a[1]+=s.n[i*s.nw+3]
 return d
base=os.path.dirname(os.path.abspath(__file__));b=Snapshot(sys.argv[1] if len(sys.argv)>1 else base+'/before.heapsnapshot.gz');a=Snapshot(sys.argv[2] if len(sys.argv)>2 else base+'/after.heapsnapshot.gz');a.bfs();bs=summarize(b);az=summarize(a)
rows=[]
for k in bs.keys()|az.keys():
 old=bs.get(k,[0,0]);new=az.get(k,[0,0]);rows.append({'key':k,'before_count':old[0],'after_count':new[0],'delta_count':new[0]-old[0],'delta_self_size':new[1]-old[1]})
rows.sort(key=lambda r:(-r['delta_self_size'],r['key']))
targets=['code:','code:system / ProtectedFixedArray','native:PerformanceResourceTiming','native:DOMRectReadOnly','native:PerformanceLongAnimationFrameTiming','native:TaskAttributionTiming','native:PerformanceLongTaskTiming','native:PerformanceScriptTiming','native:LayoutShift','native:LayoutShiftAttribution','code:system / FeedbackVector','code:system / TrustedByteArray','code:(BASELINE instruction stream)','hidden:system / WeakArrayList']
targets+=['object:ii','object:id']
targets+= [r['key'] for r in rows if r['delta_self_size']>0 and r['key'].startswith(('object:','array:','closure:'))][:15]
groups={}
for k in targets:
 inds=[i for i in range(a.count) if a.key(i)==k];new=[i for i in inds if a.n[i*a.nw+2] not in b.ids];surv=[i for i in inds if a.n[i*a.nw+2] in b.ids and b.key(b.ids[a.n[i*a.nw+2]])==k];changed=[i for i in inds if a.n[i*a.nw+2] in b.ids and b.key(b.ids[a.n[i*a.nw+2]])!=k]
 # Choose up to three distinct immediate retainer signatures across new nodes.
 reps=[];sigs=set()
 for i in new+surv:
  p=a.parent[i];sig=None if p is None else (a.key(p[0]),p[1],str(p[2]))
  if sig not in sigs:sigs.add(sig);reps.append(i)
  if len(reps)>=3:break
 groups[k]={'before_count':bs.get(k,[0,0])[0],'after_count':len(inds),'new_ids':len(new),'same_id_same_label':len(surv),'same_id_changed_label':len(changed),'before_group_not_matched_after':bs.get(k,[0,0])[0]-len(surv),'new_self_size':sum(a.n[i*a.nw+3] for i in new),'new_reachable_nonweak_non_ephemeron':sum(a.parent[i] is not None for i in new),'representatives':[{'node':a.desc(i),'present_before':a.n[i*a.nw+2] in b.ids,'nonweak_shortest_path':a.path(i)} for i in reps]}
result={'method':'Node-ID set comparison is descriptive only: same IDs with changed labels occur, so intersections cannot universally prove object survival. Same-ID/same-label is separately reported but remains conditional on stable profiler identity; BFS from synthetic root excluding weak edges and conditional ephemeron key-value-pair internal edges; shortest graph paths, not dominators or retained sizes. Shortcut edges retained and labeled; internal/native edges do not by themselves prove application ownership. Self-size deltas are not Runtime.getHeapUsage deltas.','source_commit':'e0bcc67a36b0bc3d4e5c7eff47ee07d338da4cce','runtime_commit':'97f38a0e787a4edcb35df4a59823bb1d106def67','browser':'Chromium 141.0.7390.37; CI 153.0.8010.12','before_nodes':b.count,'after_nodes':a.count,'before_self_size':sum(b.n[i*b.nw+3] for i in range(b.count)),'after_self_size':sum(a.n[i*a.nw+3] for i in range(a.count)),'top_deltas':rows[:80],'groups':groups}
result['id_label_changes']=[{'before':b.desc(b.ids[a.n[i*a.nw+2]]),'after':a.desc(i)} for i in range(a.count) if a.n[i*a.nw+2] in b.ids and b.key(b.ids[a.n[i*a.nw+2]])!=a.key(i)]
result['snapshot_sha256']={label:hashlib.sha256(open(path,'rb').read()).hexdigest() for label,path in [('before',sys.argv[1] if len(sys.argv)>1 else base+'/before.heapsnapshot.gz'),('after',sys.argv[2] if len(sys.argv)>2 else base+'/after.heapsnapshot.gz')]}
result['reachability']={'total':a.count,'reachable_excluding_weak_and_conditional_ephemeron_edges':sum(p is not None for p in a.parent),'unreachable':sum(p is None for p in a.parent),'conditional_ephemeron_edges_ignored':sum(a.et[a.e[p]]!='weak' and isinstance(a.e[p+1],int) and a.et[a.e[p]] not in ('hidden','element') and str(a.s[a.e[p+1]]).startswith('part of key -> value pair in ephemeron table') for p in range(0,len(a.e),a.ew)),'weak_edges_ignored':sum(a.et[a.e[p]]=='weak' for p in range(0,len(a.e),a.ew))}
result['performance_incoming']=[]
for u in range(a.count):
 for v,t,n,p in a.edges(u):
  if a.n[v*a.nw+2]==43457:result['performance_incoming'].append({'from':a.desc(u),'edge_type':t,'edge_name':n,'path_to_from':a.path(u)})
result['net_code_type_self_size_delta']=sum(r['delta_self_size'] for r in rows if r['key'].startswith('code:'))
result['application_nodes']={}
for snap,label in [(b,'before'),(a,'after')]:
 result['application_nodes'][label]=[{'node':snap.desc(i),'properties':[{'edge_type':t,'edge_name':n,'target':snap.desc(v)} for v,t,n,p in snap.edges(i) if t in ('property','context')]} for i in range(snap.count) if snap.key(i) in ('object:ii','object:id')]
for group in groups.values():
 assert group['after_count']==group['new_ids']+group['same_id_same_label']+group['same_id_changed_label']
 for rep in group['representatives']:
  path=rep['nonweak_shortest_path']
  if path:
   assert path[0]['from']['id']==1 and path[-1]['to']['id']==rep['node']['id']
   assert all(e['edge_type']!='weak' and not str(e['edge_name']).startswith('part of key -> value pair in ephemeron table') for e in path)
   assert all(x['to']['id']==y['from']['id'] for x,y in zip(path,path[1:]))
assert sum(r['delta_self_size'] for r in rows)==result['after_self_size']-result['before_self_size']
result['validation']='Passed: group partitions, path continuity/root/target/excluded-edge checks, all-category delta reconciliation.'
json.dump(result,open(sys.argv[3] if len(sys.argv)>3 else base+'/retention-evidence.json','w'),ensure_ascii=False,indent=2)
for k,g in groups.items():
 print('\n',k,{x:v for x,v in g.items() if x!='representatives'})
 for r in g['representatives'][:1]:
  print('NODE',r['node']);print(' -> '.join(f"{p['from']['name']}#{p['from']['id']} --{p['edge_type']}:{p['edge_name']}" for p in (r['nonweak_shortest_path'] or [])))
