#!/usr/bin/env python3
"""Offline, hash-gated M8 source inventory. Does not generate runtime content."""
import argparse
import gzip
import hashlib
import itertools
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/simulation/content/source/s13-14.24b'
SHA256 = 'c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3'
BYTE_LENGTH = 12061650
# Display-only planned names: identity and recipe selection always use upstream data.
COMPONENT_NAMES = (
    ('TFT_Item_BFSword', '暴风大剑'),
    ('TFT_Item_RecurveBow', '反曲之弓'),
    ('TFT_Item_NeedlesslyLargeRod', '无用大棒'),
    ('TFT_Item_TearOfTheGoddess', '女神之泪'),
    ('TFT_Item_ChainVest', '锁子甲'),
    ('TFT_Item_NegatronCloak', '负极斗篷'),
    ('TFT_Item_GiantsBelt', '巨人腰带'),
    ('TFT_Item_SparringGloves', '拳套'),
)
COMPONENTS = frozenset(api for api, _ in COMPONENT_NAMES)
# M8_PLAN.md appendix A rows 01–36, in its component-pair order.
PLANNED_COMPLETED_NAMES = (
    '死亡之刃', '巨人杀手', '海克斯科技枪刃', '朔极之矛', '夜之锋刃',
    '饮血剑', '斯特拉克的挑战护手', '无尽之刃', '红霸符', '鬼索的狂暴之刃',
    '斯塔缇克电刃', '泰坦的坚决', '卢安娜的飓风', '纳什之牙', '最后的轻语',
    '灭世者的死亡之帽', '大天使之杖', '冕卫', '离子火花', '莫雷洛秘典',
    '珠光护手', '蓝霸符', '圣盾使的誓约', '自适应头盔', '救赎', '正义之手',
    '棘刺背心', '石像鬼石板甲', '日炎斗篷', '坚定之心', '巨龙之爪',
    '薄暮法袍', '水银', '狂徒铠甲', '破防者', '窃贼手套',
)
PLANNED_RECIPE_NAMES = {
    tuple(sorted(pair)): (name, f'M8_PLAN.md appendix A row {row:02d}')
    for row, (pair, name) in enumerate(zip(
        itertools.combinations_with_replacement([api for api, _ in COMPONENT_NAMES], 2),
        PLANNED_COMPLETED_NAMES), start=1)
}
TEMPORARY_NAME_STATUS = '临时译名，未核对'


def planned_name(record):
    if record['apiName'] in COMPONENTS:
        return dict(COMPONENT_NAMES)[record['apiName']], 'M8_PLAN.md §1.1'
    # Do not infer legacy apiName from an English or Chinese display name.
    return PLANNED_RECIPE_NAMES[tuple(sorted(record['composition']))]



# Membership establishes source candidates only, never a round/Boss-pool mapping.
NEUTRAL_CANDIDATES = frozenset(('TFT_BlueGolem', 'TFT9_SLIME_Crab', 'TFT_Krug',
    'TFT_Murkwolf', 'TFT_MurkwolfMini', 'TFT_Razorbeak', 'TFT_RazorbeakMini',
    'TFT_RiftHerald', 'TFT_ElderDragon'))

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def load_source(path):
    data = path.read_bytes()
    if path.suffix == '.gz':
        data = gzip.decompress(data)
    if len(data) != BYTE_LENGTH or hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError('Upstream bytes/hash mismatch; do not replace expected hash to bypass this gate')
    return json.loads(data)


def select(source):
    modes = [(i, s) for i, s in enumerate(source['setData']) if s['mutator'] == 'TFTSet13']
    if len(modes) != 1:
        raise ValueError('Expected exactly one TFTSet13 standard-mode record')
    mode_index, mode = modes[0]
    if mode['number'] != 13:
        raise ValueError('Standard-mode set number mismatch')
    members = set(mode['items'])
    selected = [(i, x) for i, x in enumerate(source['items'])
                if x['apiName'] in members and
                (x['apiName'] in COMPONENTS or
                 (len(x['composition']) == 2 and set(x['composition']) <= COMPONENTS))]
    ids = [x['apiName'] for _, x in selected]
    components = [x for _, x in selected if x['apiName'] in COMPONENTS]
    recipes = [x for _, x in selected if x['apiName'] not in COMPONENTS]
    if len(ids) != 44 or len(set(ids)) != 44 or len(components) != 8 or len(recipes) != 36:
        raise ValueError('Expected 44 unique items: eight components and 36 recipes')
    if any(x['composition'] != [] for x in components):
        raise ValueError('Components must have empty composition')
    pairs = [tuple(sorted(x['composition'])) for x in recipes]
    expected = set(itertools.combinations_with_replacement(sorted(COMPONENTS), 2))
    if len(set(pairs)) != 36 or set(pairs) != expected:
        raise ValueError('Composition must cover all 36 unordered pairs exactly once')
    return mode_index, sorted(selected, key=lambda p: p[1]['apiName'])


def effect_units(record):
    # Infer only units directly expressed by this record's own tooltip token.
    # Does not infer whether a parameter is live, stacking, or runtime-normalized.
    desc = record['desc']
    result = {}
    for key in sorted(record['effects']):
        token = '@' + key + '@'
        if '@' + key + '*100@%' in desc:
            unit = 'fraction-rendered-as-percent'
        elif token + '%' in desc:
            unit = 'percentage-points'
        elif re.search(re.escape(token) + r' seconds?\b', desc):
            unit = 'seconds'
        elif re.search(re.escape(token) + r' Mana\b', desc):
            unit = 'mana-points'
        elif record['apiName'] in COMPONENTS and key in ('Armor', 'MagicResist', 'Health', 'AP'):
            unit = {'Armor': 'armor-points', 'MagicResist': 'magic-resist-points',
                    'Health': 'health-points', 'AP': 'ability-power-points'}[key]
        else:
            unit = 'source-unit-unknown'
        result[key] = unit
    return result


def numeric_decisions(record):
    if record['apiName'] != 'TFT_Item_MadredsBloodrazor':
        return None
    effects = record['effects']
    # One audited conversion, not a generic inference from parameter names.
    return {
        'status': 'source-semantics-resolved-with-explicit-project-conventions',
        'policy': 'm8-source-precedence-2026-10-07',
        'sourceTier': 'CommunityDragon 14.24 client effects',
        'higherPriorityPatchReview': 'No Giant Slayer change found in 14.24 or December 17 B notes',
        'DamageAmp': {
            'rawValue': effects['DamageAmp'], 'sourceUnit': 'fraction',
            'normalizedValue': int(round(round(effects['DamageAmp'], 4) * 10000)),
            'normalizedUnit': 'Bps',
            'conversion': 'round raw fraction to 4 decimal places, multiply by 10000, integer rounding',
            'unitEvidence': 'own desc token @DamageAmp*100@%; effects supplies the numeric value',
            'valueStatus': 'adopted', 'meaning': 'conditional-additional-damage-amp',
            'meaningEvidence': record['desc'], 'damageCompositionStatus': 'desc-additional-project-stacking',
        },
        'HealthThreshold': {
            'rawValue': effects['HealthThreshold'], 'normalizedValue': int(effects['HealthThreshold']),
            'normalizedUnit': 'health-points', 'valueStatus': 'adopted',
            'comparisonOperator': '>', 'comparisonStatus': 'desc-more-than',
            'comparisonEvidence': record['desc'],
        },
        'projectConventions': {
            'label': '项目约定，非官方证据',
            'adoptionStatus': 'active-provisional-nonblocking',
            'userReviewStatus': 'pending-itemized-confirmation',
            'ledger': 'provenance/project-conventions.json',
            'ids': ['GS-01', 'GS-02', 'GS-03', 'GS-04'],
            'baseDamageAmpBps': int(round(round(effects['{1543aa48}'], 4) * 10000)),
            'qualifiedCombinedItemDamageAmpBps': int(round(round(effects['{1543aa48}'] + effects['DamageAmp'], 4) * 10000)),
            'stacking': 'same-item base plus conditional amp; not a claim about all external multipliers',
            'unreferencedLargeBonusPct': 'preserve raw, do not apply independently',
            'thresholdEvaluation': 'target current max Health when damage packet is resolved',
        },
        'runtimeEligible': False,
    }


def outputs(source):
    mode_index, records = select(source)
    items, recipes, coverage = [], [], []
    for index, record in records:
        api = record['apiName']
        name_zh, name_source = planned_name(record)
        evidence = {
            'upstreamSha256': SHA256,
            'jsonPointer': f'/items/{index}',
            'modeJsonPointer': f'/setData/{mode_index}',
            'modeSelector': 'setData[mutator === "TFTSet13"].items includes apiName',
            'recordCanonicalSha256': digest(record),
        }
        items.append({
            'apiName': api, 'kind': 'component' if api in COMPONENTS else 'completed',
            'nameEn': record['name'], 'nameZhCn': name_zh,
            'nameZhCnStatus': TEMPORARY_NAME_STATUS,
            'nameZhCnSource': name_source, 'nameZhCnDisplayOnly': True,
            'nameZhCnReviewStatus': 'pending-manual-confirmation-not-approved',
            'composition': sorted(record['composition']),
            'sourceUnique': record['unique'], 'sourceEffects': record['effects'],
            'sourceEffectUnits': effect_units(record),
            'unitEvidence': 'own raw desc token only; unexpressed units remain unknown; no runtime conversion',
            'source': evidence, 'mechanicsStatus': 'desc-plus-provisional-project-conventions' if api == 'TFT_Item_MadredsBloodrazor' else 'pending-field-review',
            'numericSourcePolicy': 'm8-source-precedence-2026-10-07',
            'numericDecisions': numeric_decisions(record),
            'runtimeEligible': False,
        })
        if record['composition']:
            recipes.append({'resultApiName': api, 'componentApiNames': sorted(record['composition']), 'source': evidence})
        coverage.append({'apiName': api, 'source': evidence, 'rawRecord': 'verified',
                         'composition': 'verified', 'englishName': 'verified',
                         'chineseName': TEMPORARY_NAME_STATUS, 'effectUnits': 'partial-tooltip-evidence',
                         'mechanics': 'unknown', 'patchOverlayReview': ('resolved-with-user-authorized-project-conventions' if api == 'TFT_Item_MadredsBloodrazor' else 'partial-reviewed-see-overrides' if api in {'TFT_Item_BrambleVest', 'TFT_Item_UnstableConcoction', 'TFT_Item_BlueBuff', 'TFT_Item_PowerGauntlet', 'TFT_Item_Deathblade', 'TFT_Item_HextechGunblade', 'TFT_Item_Quicksilver'} else 'pending'),
                         'implementation': 'not-started', 'independentNumericalTests': 'not-started',
                         'freezeStatus': 'provisional-source-ready-not-implemented' if api == 'TFT_Item_MadredsBloodrazor' else 'pending-field-review'})
    neutrals = [
        {'record': record, 'source': {
            'upstreamSha256': SHA256,
            'jsonPointer': f'/setData/{mode_index}/champions/{index}',
            'modeSelector': 'setData[mutator === \"TFTSet13\"].champions',
            'recordCanonicalSha256': digest(record)},
         'status': 'candidate-only-not-encounter-confirmation'}
        for index, record in enumerate(source['setData'][mode_index]['champions'])
        if record['apiName'] in NEUTRAL_CANDIDATES
    ]
    if len(neutrals) != 9 or {n['record']['apiName'] for n in neutrals} != NEUTRAL_CANDIDATES:
        raise ValueError('Expected nine distinct source neutral candidates')
    neutrals.sort(key=lambda n: n['record']['apiName'])
    return {
        'raw/selected-neutrals.json': neutrals,
        'raw/selected-items.json': [record for _, record in records],
        'normalized/items.json': {'status': 'partial-source-inventory-not-runtime', 'items': items},
        'normalized/recipes.json': {'status': 'verified-source-composition-only', 'recipes': recipes},
        'provenance/coverage.json': {
            'b1Status': 'partial-blocked', 'upstreamSha256': SHA256,
            'counts': {'components': 8, 'completedItems': 36, 'recipes': 36},
            'items': coverage,
            'opening': {'status': 'unknown', 'blocks': ['B6']},
            'encounters': {'status': 'unknown', 'blocks': ['B7']},
            'neutralDefinitions': {'status': 'partial-records-present-not-frozen', 'blocks': ['B7']},
            'loot': {'status': 'unknown', 'blocks': ['B8']},
            'singlePlayerConcreteTable': {'status': 'not-proposed-not-approved', 'blocks': ['B8']},
        },
    }


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n'


def generate(source, destination, check=False):
    for relative, value in outputs(source).items():
        path = destination / relative
        content = encoded(value)
        if check:
            if not path.is_file() or path.read_bytes() != content.encode('utf-8'):
                raise ValueError(f'Generated output missing or changed: {relative}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEST / 'raw/en_us.json.gz')
    parser.add_argument('--output', type=Path, default=DEST)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    generate(load_source(args.source), args.output, args.check)
    print('Verified 8 components / 36 items / 36 recipes; B1 remains partial, no runtime output')


if __name__ == '__main__':
    main()
