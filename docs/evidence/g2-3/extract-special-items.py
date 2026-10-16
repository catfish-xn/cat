"""Only source-linked rewards. Uses the same hash-locked archives as extract-content.py."""
import gzip,json,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3]; content=root/'src/simulation/content'; raw=content/'source/s13-14.24b/raw'
manifest=json.loads((content/'source/s13-14.24b/provenance/manifest.json').read_text())
for record in manifest['extendedSourceAcquisition']['sources']:
 data=(root/record['archivePath']).read_bytes()
 assert len(data)==record['archiveBytes'] and hashlib.sha256(data).hexdigest()==record['archiveSha256'],record['id']
 unpacked=gzip.decompress(data)
 assert len(unpacked)==record['bytes'] and hashlib.sha256(unpacked).hexdigest()==record['sha256'],record['id']
assert hashlib.sha256(gzip.decompress((raw/'en_us.json.gz').read_bytes())).hexdigest()=='c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3'
en=json.load(gzip.open(raw/'en_us.json.gz')); records={i['apiName']:i for i in en['items']}; m=json.load(gzip.open(raw/'map22.bin.json.gz'))
ordinary={}
for p in content.glob('items*.ts'):
 for id,api in re.findall(r'"id":\s*"([^"]+)"[\s\S]*?"apiName":\s*"([^"]+)"',p.read_text()):ordinary[api]=id
keys=['RADIANTITEMS_SET5','ORNNARTIFACTS_SET6','SUPPORTITEMS']; pools={}
for key in keys:pools[key]=next(v['mConstants']['Definitions']['mValue'] for v in m.values() if isinstance(v,dict) and v.get('mName')=='ItemKeyDefinition_'+key)
for tier,prefix in enumerate(['Bronze','Silver','Gold','Prismatic','OmegaPrismatic']):pools['Tier'+str(tier)]=sorted(api for api in records if api.startswith('TFT13_Crime_'+prefix+'_'))
special=set(pools['RADIANTITEMS_SET5']+sum([pools['Tier'+str(i)] for i in range(5)],[]))
mapaliases={'TFT_Item_UnstableConcoction':'TFT5_Item_HandOfJusticeRadiant','TFT_Item_PowerGauntlet':'TFT5_Item_TrapClawRadiant','TFT_Item_RapidFireCannon':'TFT5_Item_RapidFirecannonRadiant','TFT_Item_MadredsBloodrazor':'TFT5_Item_GiantSlayerRadiant','TFT_Item_RedBuff':'TFT5_Item_SunfireCapeRadiant'}
radiant={}
for api,id in ordinary.items():
 candidate=mapaliases.get(api,'TFT5_Item_'+api.removeprefix('TFT_Item_')+'Radiant')
 if candidate in pools['RADIANTITEMS_SET5']:radiant[id]=candidate
assert len(radiant)==36
out={api:{'name':records[api]['name'],'apiName':api,'description':records[api]['desc'],'values':records[api]['effects'],'unique':bool(records[api]['unique'])} for api in sorted(special)}
data='// Source reward identities/stat parameters; non-stat finite execution is documented separately.\nimport {freezeContent} from "./freeze";\n'
for name,obj in [('G23_SPECIAL_ITEM_SOURCE',out),('G23_SPECIAL_ITEM_POOLS',pools),('G23_RADIANT_MAPPING',radiant)]:data+='export const '+name+'=freezeContent('+json.dumps(obj,ensure_ascii=False,indent=2)+');\n'
p=content/'g2-3-special-item-source.ts';p.write_text(data);print(json.dumps({'file':str(p.relative_to(root)),'bytes':len(data.encode()),'sha256':hashlib.sha256(data.encode()).hexdigest(),'items':len(out)}))
