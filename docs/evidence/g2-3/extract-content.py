#!/usr/bin/env python3
"""Extract G2-3 staging data from hash-verified local archives; --check never writes."""
import sys
import json,gzip,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[3];content=root/'src/simulation/content';raw=content/'source/s13-14.24b/raw'
s=next(x for x in json.loads(gzip.decompress((raw/'en_us.json.gz').read_bytes()))['setData'] if x['mutator']=='TFTSet13');m=json.loads(gzip.decompress((raw/'map22.bin.json.gz').read_bytes()));strings=json.loads(gzip.decompress((raw/'en_us.tft.stringtable.json.gz').read_bytes()))['entries'];zh=json.loads(gzip.decompress((raw/'zh_cn.tft.stringtable.json.gz').read_bytes()))['entries']
lookup={k.lower():v for k,v in strings.items()}; zlookup={k.lower():v for k,v in zh.items()}
num=lambda x:round(x,4)
def clean(x):
 if isinstance(x,float):return num(x)
 if isinstance(x,list):return [clean(z) for z in x]
 if isinstance(x,dict):return {k:clean(v) for k,v in x.items()}
 return x
def emit(file,name,data,typ=None):
 header="// G2-3: hash-locked 14.24 source + explicitly documented 14.24b overrides.\nimport { freezeContent } from './freeze';\n"
 if typ:header+=f"import type {{ {typ[0]} }} from '{typ[1]}';\n"
 text=header+f'export const {name}'+(f': Readonly<Record<string, {typ[0]}>>' if typ else '')+' = freezeContent('+json.dumps(clean(data),ensure_ascii=False,indent=2)+');\n'
 write(content/file,text)
manifest=json.loads((content/'source/s13-14.24b/provenance/manifest.json').read_text())
for record in manifest['extendedSourceAcquisition']['sources']:
 data=(root/record['archivePath']).read_bytes()
 assert len(data)==record['archiveBytes'] and hashlib.sha256(data).hexdigest()==record['archiveSha256'],record['id']
 data=gzip.decompress(data)
 assert len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256'],record['id']
assert hashlib.sha256(gzip.decompress((raw/'en_us.json.gz').read_bytes())).hexdigest()=='c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3'
outputs={}
def write(path,text):outputs[path]=text
ids={'TFT13_RenataGlasc':'renata','TFT13_Cassiopeia':'cassiopeia','TFT13_NunuWillump':'nunu','TFT13_Chainsaw':'renni','TFT13_Gremlin':'smeech','TFT13_DrMundo':'drmundo','TFT13_Elise':'elise','TFT13_Silco':'silco','TFT13_Lieutenant':'sevika','TFT13_Swain':'swain','TFT13_Jayce':'jayce','TFT13_Gangplank':'gangplank'}
traitids={t['name']:re.sub('[^a-z]','',t['name'].lower()) for t in s['traits'] if 'Teamup' not in t['apiName']};traitids['Form Swapper']='form-swapper';traitids['Chem-Baron']='chem-baron';traitids['Pit Fighter']='pit-fighter';traitids['Black Rose']='black-rose';traitids['High Roller']='high-roller';traitids['Junker King']='junker-king'
forms={v['mName'].removeprefix('TFT13_').removesuffix('FormSwapperStats').lower():{k:r.get('mValue',0) for k,r in v['mConstants'].items()} for v in m.values() if 'FormSwapperStats' in v.get('mName','')}
units={};abilities={};source=[]
for c in s['champions']:
 if c['apiName'] not in ids:continue
 n=ids[c['apiName']];stats=c['stats'];a=c['ability'];traits=[traitids[t] for t in c['traits'] if t!='Form Swapper']
 for form in (['Melee','Ranged'] if n in forms else ['']):
  uid=n+('-ranged' if form=='Ranged' else '');f=forms.get(n,{});health=int(stats['hp'])+(int(f.get('BonusHealth_Melee',0)) if form=='Melee' else 0)
  attack=f.get('AttackDamage_'+form,stats['damage']);res=f.get('Resists_'+form,stats['armor']);speed=round(f.get('AttackSpeed_'+form,stats['attackSpeed'])*10000)
  if n=='gangplank' and form=='Melee':attack=65
  units[uid]=dict(id=uid,name=c['name']+(' (Ranged)' if form=='Ranged' else ''),symbol=c['name'][0],color=10466749,cost=c['cost'],baseStats=dict(health=health,attack=int(attack),armor=int(res),magicResist=int(res if form else stats['magicResist'])),attackRange=4 if form=='Ranged' else int(stats['range']),attackIntervalTicks=(200000+speed-1)//speed,baseAttackSpeedBps=speed,initialMana=int(f.get('StartingMana_'+form,stats['initialMana'])),maxMana=int(f.get('MaxMana_'+form,stats['mana'])),abilityId=uid+'-ability',traits=traits)
  ability=dict(id=uid+'-ability',championId=uid,name=a['name'],description=a['desc'],variables={v['name']:[num(x) for x in v['value'][1:4]] for v in a['variables'] if v['value'] is not None and not v['name'].startswith(('Hero','HERO'))})
  pointer=c['apiName']+'/ability'
  if form=='Ranged':
   b=json.loads(gzip.decompress((raw/f'tft13_{n}.cdtb.bin.json.gz').read_bytes()))
   key,r=next((k,v) for k,v in b.items() if v.get('mScriptName')==f'TFT13_{n.title()}Spell_Ranged')
   ability['variables']={v['mName']:[num(x) for x in v['mValues'][1:4]] for v in r['mSpell']['mDataValues'] if v.get('mValues')}
   keys=r['mSpell']['mClientData']['mTooltipData']['mLocKeys']
   ability['name']=lookup[keys['keyName'].lower()];ability['description']=lookup[keys['keyTooltip'].lower()]
   pointer=key
  if n=='silco':ability['variables']['MinionDamage']=[36,55,100]
  abilities[uid+'-ability']=ability
  source.append(dict(id=uid,apiName=c['apiName'],form=form or None,abilityPointer=pointer,classification='源数据',overrides=['14.24b melee AD 65'] if n=='gangplank' and form=='Melee' else ['14.24b MinionDamage 36/55/100'] if n=='silco' else [],conventions=['ranged range=4'] if form=='Ranged' else []))
emit('g2-3-units.ts','G23_UNITS',units,('UnitDefinition','../unit-types'));emit('g2-3-abilities.ts','G23_ABILITIES',abilities,('S13AbilityData','./abilities'))
# Membership covers every admitted unit, with the four fixed forms sharing identity for trait counts.
membership={}
for c in s['champions']:
 n=ids.get(c['apiName'],c['apiName'].removeprefix('TFT13_').lower())
 aliases={'beardy':'loris','fish':'steb','shooter':'maddie','blue':'powder','prime':'vander','flyguy':'scar','red':'violet'}
 n=aliases.get(n,n)
 if not c['apiName'].startswith('TFT13_') or not 1<=c['cost']<=5:continue
 membership[n]=[traitids[t] for t in c['traits'] if t in traitids and t!='Form Swapper']
for n in forms:membership[n+'-ranged']=membership[n]
write(content/'g2-3-units.ts',outputs[content/'g2-3-units.ts']+'export const G23_MEMBERSHIP: Readonly<Record<string, readonly string[]>> = freezeContent('+json.dumps(membership,indent=2)+');\n')
# Full source trait tier records, including disabled Form Swapper metadata; no Teamup effects.
traits={traitids[t['name']]:dict(apiName=t['apiName'],name=t['name'],description=t.get('desc',''),enabled=t['name']!='Form Swapper',tiers=[dict(threshold=e['minUnits'],values={k:num(v) if v is not None else None for k,v in e['variables'].items()}) for e in t['effects']]) for t in s['traits'] if 'Teamup' not in t['apiName']}
emit('g2-3-trait-source.ts','G23_TRAIT_SOURCE',traits)
# Preserve all named loot tables and options, omitting unrelated set/mode data.
tables={}
for key,v in m.items():
 name=v.get('mName','')
 if (re.fullmatch(r'Armory(?:Table|Content)_TFT13_Warband_Cashout(?:[1-9]|1[0-9]|20)(?:_Option\d+)?',name) or name in ['ArmoryTable_TFT13_Warband_CashoutBreakpoints','ArmoryTable_TFT13_Warband_CashoutEstimatedGoldValues'] or re.fullmatch(r'TFT13_Crime_(?:BlackMarket[1-8]|Loot\w+)',name)):
  tables[name]=dict(pointer=key,values={k:clean(x.get('mValue',0)) for k,x in v.get('mConstants',{}).items()})
emit('g2-3-loot-source.ts','G23_LOOT_SOURCE',tables)
# Data-only source reconciliation is useful independently of runtime admission.
write(content/'source/s13-14.24b/normalized/g2-3-champions.json',json.dumps(dict(baseCommit='38747c595b7f4900133ca6e85c63b1bb48e83e2d',champions=source),ensure_ascii=False,indent=2)+'\n')
print('generated',len(units),'fixed definitions;',len(traits),'source traits;',len(tables),'loot objects')
print('ranged skills',[(k,a['name'],a['description'][:70]) for k,a in abilities.items() if 'ranged'in k])
selected='TitanicStrikes MageArmor KillStreak ArcanaOverwhelming SharpenedMind AvalancheofArmor BerserkerRage Bully Bulwark ComebackStory DeepRoots HardenedMind EagleEye EnergyAbsorption AllForOne Fortified Freestyling GiantSized HeavyHitter Hypervelocity LaserEyes LegacyOfShurima MagicMind MagicTraining OneThousandCuts PowerAbsorption ShouldertheBurden SlimeTime SlowCooker StrengthTraining'.split()
anomalies={}
for key,v in m.items():
 short=v.get('name','').removeprefix('TFT13_GoopBuff_')
 if v.get('__type')!='{a0c80919}' or short not in selected:continue
 tip=m[v['{900aff58}']];title=lookup[tip['TitleTra'].lower()];desc=lookup[tip['DescriptionTra'].lower()]
 id=re.sub(r'[^a-z0-9]+','-',title.lower()).strip('-')
 anomalies[id]=dict(pointer=key,sourceName=v['name'],titleKey=tip['TitleTra'],descriptionKey=tip['DescriptionTra'],name=title,description=desc,zhName=zlookup[tip['TitleTra'].lower()],zhDescription=zlookup[tip['DescriptionTra'].lower()],values={x['name']:num(x.get('value',0)) for x in v.get('effectAmounts',[])})
assert len(anomalies)==30
emit('g2-3-anomaly-source.ts','G23_ANOMALY_SOURCE',anomalies)

for path,text in outputs.items():
 if '--check' in sys.argv:
  if path.read_text()!=text:raise ValueError('Generated output differs: '+str(path.relative_to(root)))
 else:path.write_text(text)
print('G2-3 source staging: '+str(len(outputs))+' files '+('verified' if '--check' in sys.argv else 'written'))
