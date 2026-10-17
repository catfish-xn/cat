"""G2-4b artifact source records. Uses the same hash-locked archives as ../g2-3/extract-special-items.py."""
import gzip,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3]; content=root/'src/simulation/content'; raw=content/'source/s13-14.24b/raw'
assert hashlib.sha256(gzip.decompress((raw/'en_us.json.gz').read_bytes())).hexdigest()=='c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3'
en=json.load(gzip.open(raw/'en_us.json.gz')); records={i['apiName']:i for i in en['items']}; m=json.load(gzip.open(raw/'map22.bin.json.gz'))
zh=json.load(gzip.open(raw/'zh_cn.tft.stringtable.json.gz'))['entries']; enst=json.load(gzip.open(raw/'en_us.tft.stringtable.json.gz'))['entries']
def zhname(api):
 keys=[k for k,v in enst.items() if v==records[api]['name'] and k.startswith('tft') and '_item_' in k and 'desc' not in k]
 names={zh[k] for k in keys}
 assert len(names)==1,(api,keys); return names.pop()
pool=next(v['mConstants']['Definitions']['mValue'] for v in m.values() if isinstance(v,dict) and v.get('mName')=='ItemKeyDefinition_ORNNARTIFACTS_SET6')
assert len(pool)==29
out={api:{'name':records[api]['name'],'zhName':zhname(api),'apiName':api,'description':records[api]['desc'],'values':records[api]['effects'],'unique':bool(records[api]['unique'])} for api in pool}
data='// G2-4b: ORNNARTIFACTS_SET6 source identities/values (en_us + zh_cn 14.24). Execution subset: g2-4-artifacts.ts.\nimport {freezeContent} from "./freeze";\n'
data+='export const G24_ARTIFACT_SOURCE=freezeContent('+json.dumps(out,ensure_ascii=False,indent=2)+');\n'
p=content/'g2-4-artifact-source.ts';p.write_text(data);print(json.dumps({'file':str(p.relative_to(root)),'bytes':len(data.encode()),'sha256':hashlib.sha256(data.encode()).hexdigest(),'items':len(out)}))
