"""Extract only the eleven mechanism items from the pinned 14.24 archives.

No network or runtime registry mutation. Fail if Set13 membership, bilingual
identity, or the two independent raw representations disagree.
"""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/simulation/content/source/s13-14.24b'
IDS = [
    'TFT9_Item_OrnnTrickstersGlass',
    'TFT_Item_Artifact_SuspiciousTrenchCoat',
    'TFT_Item_Artifact_SpectralCutlass',
    'TFT_Item_Artifact_Fishbones',
    'TFT4_Item_OrnnDeathsDefiance',
    'TFT4_Item_OrnnTheCollector',
    'TFT7_Item_ShimmerscaleGamblersBlade',
    'TFT7_Item_ShimmerscaleMogulsMail',
    'TFT_Item_Shroud',
    'TFT_Item_Zephyr',
    'TFT5_Item_ZzRotPortalRadiant',
]


def read(name):
    return json.loads(gzip.decompress((SOURCE / 'raw' / name).read_bytes()))


def extract():
    english, binary, chinese = (read(name) for name in (
        'en_us.json.gz', 'map22.bin.json.gz', 'zh_cn.tft.stringtable.json.gz'))
    membership = next(s['items'] for s in english['setData'] if s['mutator'] == 'TFTSet13')
    records = []
    for api in IDS:
        assert api in membership, api
        matches = [(i, v) for i, v in enumerate(english['items']) if v['apiName'] == api]
        assert len(matches) == 1, api
        index, item = matches[0]
        matches = [(k, v) for k, v in binary.items()
                   if v.get('__type') == 'TftItemData' and v.get('mName') == api]
        assert len(matches) == 1, api
        key, entry = matches[0]
        values = {k: v.get('mValue') for k, v in entry['constants']['{df085b93}'].items()}
        assert values == item['effects'], api
        name_key = entry['mDisplayNameTra'].lower()
        desc_key = entry['mDescriptionNameTra'].lower()
        records.append(dict(apiName=api, name=chinese['entries'][name_key],
                            englishName=item['name'], description=item['desc'],
                            chineseDescription=chinese['entries'][desc_key],
                            unique=item['unique'], values=values,
                            provenance=dict(archivePatch='14.24', referencePatch='14.24b',
                                            englishPointer=f'/items/{index}', mapKey=key,
                                            nameKey=name_key, descriptionKey=desc_key)))
    return dict(schemaVersion=1, status='source-extraction-only-not-runtime-implementation',
                archives={name: hashlib.sha256((SOURCE / 'raw' / name).read_bytes()).hexdigest()
                          for name in ['en_us.json.gz', 'map22.bin.json.gz', 'zh_cn.tft.stringtable.json.gz']},
                items=records)


if __name__ == '__main__':
    destination = SOURCE / 'normalized/g2-4b-mechanism-items.json'
    destination.write_text(json.dumps(extract(), ensure_ascii=False, indent=2) + '\n')
    print(destination.relative_to(ROOT))
