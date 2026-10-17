"""G2-4b support items: source identities and parameters for the 17 SUPPORTITEMS pool entries.
Reads the same hash-locked en_us archive as docs/evidence/g2-3/extract-special-items.py; writes one TS source file."""
import gzip,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3]; content=root/'src/simulation/content'; raw=content/'source/s13-14.24b/raw'
assert hashlib.sha256(gzip.decompress((raw/'en_us.json.gz').read_bytes())).hexdigest()=='c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3'
en=json.load(gzip.open(raw/'en_us.json.gz')); records={i['apiName']:i for i in en['items']}
m=json.load(gzip.open(raw/'map22.bin.json.gz'))
pool=next(v['mConstants']['Definitions']['mValue'] for v in m.values() if isinstance(v,dict) and v.get('mName')=='ItemKeyDefinition_SUPPORTITEMS')
assert len(pool)==17
set13=next(s for s in en['setData'] if s['mutator']=='TFTSet13')['items']
assert all(api in set13 for api in pool)
out={api:{'name':records[api]['name'],'apiName':api,'description':records[api]['desc'],'values':records[api]['effects'],'unique':bool(records[api]['unique'])} for api in pool}
data='// G2-4b support item identities/parameters (en_us 14.24 archive); execution is declared in g2-4-support-items.ts.\nimport {freezeContent} from "./freeze";\n'
data+='export const G24_SUPPORT_ITEM_SOURCE=freezeContent('+json.dumps(out,ensure_ascii=False,indent=2)+');\n'
p=content/'g2-4-support-item-source.ts';p.write_text(data);print(json.dumps({'file':str(p.relative_to(root)),'bytes':len(data.encode()),'sha256':hashlib.sha256(data.encode()).hexdigest(),'items':len(out)}))
