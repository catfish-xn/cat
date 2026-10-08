#!/usr/bin/env python3
"""Offline, read-only Git trace verification. Never execute captured JavaScript."""
import argparse, collections, hashlib, json, pathlib, subprocess, sys, zipfile
SHA='a062cececca3424d1c2b414f7b1a2a016a77f1a0'
BASE='docs/evidence/h1-claude-runs/followup/h1-trend'
EXPECTED={'trend-02':(18488772,'0b1bfd7b3bb57f795aaf54e744c2203e91f785d40a0377a5769d011ec439dcbd'), 'trend-03':(18488275,'0c2bd6435e4f598d9b0b5ed22b71ec2cd10216134758df733341db80b09379a4')}
def check(ok,msg):
 if not ok: raise ValueError(msg)
def dump(p,o): p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def decode(v):
 if not isinstance(v,dict): return v
 if 'o' in v:return {x['k']:decode(x['v']) for x in v['o']}
 if 'a' in v:return [decode(x) for x in v['a']]
 for k in ('n','s','b'): 
  if k in v:return v[k]
 return v.get('v',v)
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--repo',required=True); ap.add_argument('--output',required=True); a=ap.parse_args()
 repo=pathlib.Path(a.repo).resolve(); out=pathlib.Path(a.output).resolve(); check(not out.is_relative_to(repo),'Output must be outside repository'); out.mkdir(parents=True,exist_ok=True)
 def git(*args):return subprocess.check_output(['git','-C',str(repo),*args])
 check(git('rev-parse',SHA+'^{commit}').decode().strip()==SHA,'Pinned commit missing')
 agents=git('show',SHA+':AGENTS.md'); (out/'AGENTS-at-pinned.txt').write_bytes(agents)
 result={'commit':SHA,'scope':'offline diagnostic, not acceptance audit','checks':[],'runs':{}}
 for run,(size,sha) in EXPECTED.items():
  prefix=f'{SHA}:{BASE}/{run}/'; b=git('show',prefix+'trace.zip'); check(len(b)==size,run+' bytes mismatch'); check(hashlib.sha256(b).hexdigest()==sha,run+' SHA256 mismatch'); path=out/(run+'.zip');path.write_bytes(b)
  manifest=json.loads(git('show',prefix+'manifest.json')); trend=json.loads(git('show',prefix+'m6-heap-trend.json'))
  check(manifest['sha']=='97f38a0e787a4edcb35df4a59823bb1d106def67','Tested SHA mismatch');check(manifest['browser']=='141.0.7390.37','Browser mismatch');check(trend['warmupCycles']==12 and trend['cyclesPerWindow']==30 and len(trend['windows'])==3,'Window configuration mismatch')
  r={'bytes':len(b),'sha256':sha,'git_blob':git('rev-parse',prefix+'trace.zip').decode().strip(),'members':[],'tested_sha':manifest['sha'],'browser':manifest['browser'],'manifest_errors':manifest['errors'],'heap_windows':trend,'console':[],'errors':[],'lifecycle_actions':[],'resource_reads':[],'input_drains':[],'last_actions':[],'keyword_matches':{k:[] for k in ['HeapProfiler','collectGarbage','Runtime.getHeapUsage','usedJSHeapSize']}}
  types=collections.Counter(); methods=collections.Counter(); selectors=collections.Counter(); events=collections.Counter(); expressions=collections.Counter(); pending={}; beforeids=set(); afterids=set(); pages=set(); action_sequence=[]; debug_result_bytes=0; max_end=0
  with zipfile.ZipFile(path) as z:
   names=z.namelist();check(len(names)==len(set(names)),'Duplicate ZIP entries');check(set(names)=={'trace.trace','trace.network','trace.stacks'},'Unexpected ZIP members');check(sum(x.file_size for x in z.infolist())<600_000_000,'Excessive uncompressed size')
   for x in z.infolist():
    check(not x.flag_bits&1,'Encrypted ZIP member');check(not pathlib.PurePosixPath(x.filename).is_absolute() and '..' not in pathlib.PurePosixPath(x.filename).parts,'Unsafe ZIP member');h=hashlib.sha256()
    with z.open(x) as f:
     for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    r['members'].append({'name':x.filename,'bytes':x.file_size,'compressed_bytes':x.compress_size,'crc32':f'{x.CRC:08x}','crc_verified':True,'sha256':h.hexdigest()})
   check(z.getinfo('trace.network').file_size==0,'Unexpected network records')
   stacks=json.loads(z.read('trace.stacks'));r['stacks']={'files':stacks['files'],'count':len(stacks['stacks'])}
   with z.open('trace.trace') as f:
    for line_no,line in enumerate(f,1):
     o=json.loads(line); t=o.get('type'); types[t]+=1
     for k in r['keyword_matches']:
      if k.encode() in line:r['keyword_matches'][k].append(line_no)
     if o.get('pageId'):pages.add(o['pageId'])
     if t=='context-options':r['context']=o
     if t=='before':
      cid=o['callId'];check(cid not in beforeids,'Duplicate before');beforeids.add(cid);pending[cid]=(line_no,o)
      method=o['class']+'.'+o['method'];methods[method]+=1;p=o.get('params',{});r['last_actions'].append({'line':line_no,'callId':cid,'method':method,'expression':p.get('expression'),'selector':p.get('selector')});r['last_actions']=r['last_actions'][-8:];action_sequence.append([method,p.get('selector'),p.get('expression')])
      if 'selector' in p:selectors[o['method']+' '+p['selector']]+=1
      if 'expression' in p and o['method']=='evaluateExpression':expressions[p['expression']]+=1
      if o['method'] in ('newPage','goto','reload','close','newCDPSession'):r['lifecycle_actions'].append({'line':line_no,**o})
     elif t=='after':
      cid=o['callId'];check(cid not in afterids and cid in pending,'Duplicate or orphan after');afterids.add(cid);bl,bo=pending.pop(cid);max_end=max(max_end,o.get('endTime',0));expr=bo.get('params',{}).get('expression','')
      if o.get('error'):r['errors'].append({'line':line_no,**o})
      if expr=='()=>window.__M6_RESOURCES__.read()':r['resource_reads'].append({'before_line':bl,'after_line':line_no,'time':o['endTime'],'value':decode(o.get('result',{}).get('value'))})
      if 'const events=window.__M5_NATIVE_INPUTS__' in expr:
       val=o.get('result',{}).get('value',{});r['input_drains'].append({'before_line':bl,'after_line':line_no,'time':o['endTime'],'returned_event_count':len(val.get('a',[]))})
      if expr=='()=>window.__CAT_DEBUG__.read()':debug_result_bytes+=len(line)
     elif t=='console':r['console'].append({'line':line_no,**{k:v for k,v in o.items() if k!='args'}})
     elif t=='event':events[str(o.get('class'))+'.'+str(o.get('method'))]+=1
   check(not pending and beforeids==afterids,'Incomplete call pairing')
  r.update({'event_type_counts':dict(types),'method_counts':dict(methods),'selector_counts':dict(selectors),'event_counts':dict(events),'expression_counts':dict(expressions),'paired_actions':len(beforeids),'page_ids':sorted(pages),'last_action_end_ms':max_end,'debug_read_result_jsonl_bytes':debug_result_bytes,'action_signature_sha256':hashlib.sha256(json.dumps(action_sequence,ensure_ascii=False).encode()).hexdigest(),'missing':['network requests/responses (empty trace.network)','DOM snapshots and screenshot resources','CDP send/response records, GC evidence and heap usage responses','heap snapshots, allocation profiles, retainer paths','browser close/context close actions (outside saved interval)']})
  check(types['before']==4279 and types['after']==4279,'Unexpected action totals');check(not r['errors'],'Unexpected failed trace action');check(all(not v for v in r['keyword_matches'].values()),'Unexpected heap API evidence: inspect before relying on report')
  check(len(r['resource_reads'])==34,'Resource sample count mismatch');check(all(x['value']=={'listeners':82,'pendingRaf':1} for x in r['resource_reads']),'Unexpected resource counter result')
  result['runs'][run]=r;result['checks'].append(run+': pinned bytes/hash, all member CRC/SHA256, JSON parsing, action pairing, expected counts/configuration verified')
 check(result['runs']['trend-02']['action_signature_sha256']==result['runs']['trend-03']['action_signature_sha256'],'Action signatures diverge');result['checks'].append('Both ordered class/method/selector/expression sequences identical (excludes parameters/results/timing)')
 dump(out/'trace-evidence.json',result);print(json.dumps({'ok':True,'commit':SHA,'output':str(out/'trace-evidence.json'),'checks':result['checks']},ensure_ascii=False))
if __name__=='__main__':
 try:main()
 except Exception as e: print('FAILED: '+str(e),file=sys.stderr);sys.exit(1)
