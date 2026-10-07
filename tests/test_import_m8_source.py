"""Independent structural guards; no claim of runtime item-mechanics coverage."""
import copy
import gzip
import re
import sys
sys.dont_write_bytecode = True
import importlib.util
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('import_m8', Path(__file__).resolve().parents[1] / 'scripts/import-m8-source.py')
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


class ImportM8SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = M.load_source(M.DEST / 'raw/en_us.json.gz')

    def test_counts_and_recipe_anchors(self):
        index, records = M.select(self.source)
        self.assertEqual(index, 1)
        self.assertEqual(len(records), 44)
        lookup = {r['apiName']: r for _, r in records}
        self.assertEqual(len([r for r in lookup.values() if not r['composition']]), 8)
        self.assertEqual(lookup['TFT_Item_RapidFireCannon']['name'], 'Red Buff')
        self.assertEqual(lookup['TFT_Item_RapidFireCannon']['composition'], ['TFT_Item_RecurveBow'] * 2)
        self.assertEqual(lookup['TFT_Item_RedBuff']['name'], 'Sunfire Cape')
        self.assertEqual(lookup['TFT_Item_ThiefsGloves']['composition'], ['TFT_Item_SparringGloves'] * 2)
        self.assertTrue(all(r['from'] is None for r in lookup.values()))

    def test_planned_names_match_all_plan_rows_by_source_composition(self):
        plan = (M.ROOT / 'M8_PLAN.md').read_text(encoding='utf-8')
        components = ['暴风大剑', '反曲之弓', '无用大棒', '女神之泪', '锁子甲', '负极斗篷', '巨人腰带', '拳套']
        self.assertIn('组件为' + '、'.join(components), plan)
        short_names = ['大剑', '反曲弓', '大棒', '眼泪', '锁子甲', '斗篷', '腰带', '拳套']
        apis = ['TFT_Item_' + s for s in ('BFSword', 'RecurveBow', 'NeedlesslyLargeRod',
                'TearOfTheGoddess', 'ChainVest', 'NegatronCloak', 'GiantsBelt', 'SparringGloves')]
        lookup = {i['apiName']: i for i in M.outputs(self.source)['normalized/items.json']['items']}
        for api, name in zip(apis, components):
            self.assertEqual(lookup[api]['nameZhCn'], name)
            self.assertEqual(lookup[api]['nameZhCnSource'], 'M8_PLAN.md §1.1')
        rows = re.findall(r'^\| (\d{2}) \| ([^|]+) \| ([^/]+) / ([^|]+) \|', plan, re.M)
        self.assertEqual(len(rows), 36)
        short_to_api = dict(zip(short_names, apis))
        by_pair = {tuple(i['composition']): i for i in lookup.values() if i['composition']}
        for row, pair, name, _ in rows:
            key = tuple(sorted(short_to_api[c] for c in pair.strip().split('+')))
            item = by_pair[key]
            self.assertEqual(item['nameZhCn'], name.strip())
            self.assertEqual(item['nameZhCnSource'], f'M8_PLAN.md appendix A row {row}')
        self.assertEqual(lookup['TFT_Item_RapidFireCannon']['nameZhCn'], '红霸符')
        self.assertEqual(lookup['TFT_Item_RedBuff']['nameZhCn'], '日炎斗篷')
        coverage = M.outputs(self.source)['provenance/coverage.json']['items']
        self.assertTrue(all(i['chineseName'] == '临时译名，未核对' for i in coverage))

    def test_manual_review_list_contains_all_44_pending_names(self):
        review = (M.ROOT / 'docs/M8_ITEM_NAMES_REVIEW.md').read_text(encoding='utf-8')
        self.assertIn('临时译名，未核对', review)
        rows = [line for line in review.splitlines() if line.startswith('| TFT_Item_')]
        self.assertEqual(len(rows), 44)
        expected = [f"| {i['apiName']} | {i['nameEn']} | {i['nameZhCn']} | {i['nameZhCnSource']} | 待人工确认，未批准 |"
                    for i in M.outputs(self.source)['normalized/items.json']['items']]
        self.assertEqual(rows, expected)

    def test_display_names_preserve_existing_source_identity_values_and_recipes(self):
        output = M.outputs(self.source)
        self.assertEqual(M.digest(output['raw/selected-items.json']),
                         'fdc755dfad1cd31b5cd054853871d9796bb86e33aea53be090b82ecc34cbc369')
        self.assertEqual(M.digest(output['normalized/recipes.json']),
                         'e940e8e4092e875eaceb0812ff83fc0d6479f25d4fc5cd1d8876b6c33e8c1769')
        unchanged = [{key: item[key] for key in ('apiName', 'nameEn', 'composition',
                     'sourceUnique', 'sourceEffects', 'sourceEffectUnits', 'source')}
                     for item in output['normalized/items.json']['items']]
        self.assertEqual(M.digest(unchanged),
                         'bdcff3d9c72e28da6dcc63d13becbb556a53916bd53829232551c8846c3c9ada')
        raw = {i['apiName']: i for i in output['raw/selected-items.json']}
        for item in output['normalized/items.json']['items']:
            self.assertEqual(item['sourceEffects'], raw[item['apiName']]['effects'])
            self.assertEqual(item['composition'], sorted(raw[item['apiName']]['composition']))

    def test_neutral_candidates_are_not_frozen_encounters(self):
        entries = M.outputs(self.source)['raw/selected-neutrals.json']
        self.assertEqual(len(entries), 9)
        crab = next(x for x in entries if x['record']['apiName'] == 'TFT9_SLIME_Crab')
        self.assertIsNone(crab['record']['stats']['hp'])
        self.assertEqual(crab['status'], 'candidate-only-not-encounter-confirmation')
        self.assertTrue(all('round' not in entry for entry in entries))

    def test_raw_and_compressed_sources_generate_identical_outputs(self):
        compressed = M.DEST / 'raw/en_us.json.gz'
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / 'en_us.json'
            raw.write_bytes(gzip.decompress(compressed.read_bytes()))
            self.assertEqual(M.outputs(M.load_source(raw)), M.outputs(M.load_source(compressed)))

    def test_every_selected_record_matches_its_pointer_and_hash(self):
        output = M.outputs(self.source)
        raw_by_id = {x['apiName']: x for x in output['raw/selected-items.json']}
        evidence = [(x['source'], raw_by_id[x['apiName']])
                    for x in output['normalized/items.json']['items']]
        evidence.extend((x['source'], x['record']) for x in output['raw/selected-neutrals.json'])
        for source, record in evidence:
            found = self.source
            for segment in source['jsonPointer'].strip('/').split('/'):
                found = found[int(segment)] if isinstance(found, list) else found[segment]
            self.assertEqual(record, found)
            self.assertEqual(M.digest(record), source['recordCanonicalSha256'])
            self.assertEqual(source['upstreamSha256'], M.SHA256)

    def test_unit_inference_uses_own_tooltip_without_guessing(self):
        items = {x['apiName']: x for x in M.outputs(self.source)['normalized/items.json']['items']}
        self.assertEqual(items['TFT_Item_BFSword']['sourceEffectUnits']['AD'], 'fraction-rendered-as-percent')
        self.assertEqual(items['TFT_Item_RecurveBow']['sourceEffectUnits']['AS'], 'percentage-points')
        self.assertEqual(items['TFT_Item_AdaptiveHelm']['sourceEffectUnits']['{d357c9f2}'], 'source-unit-unknown')
        self.assertEqual(items['TFT_Item_ThiefsGloves']['sourceEffectUnits']['CritChance'], 'source-unit-unknown')

    def test_giant_slayer_applies_desc_semantics_and_labeled_project_conventions(self):
        items = {x['apiName']: x for x in M.outputs(self.source)['normalized/items.json']['items']}
        giant = items['TFT_Item_MadredsBloodrazor']
        decision = giant['numericDecisions']
        self.assertEqual(decision['policy'], 'm8-source-precedence-2026-10-07')
        self.assertEqual(decision['DamageAmp']['normalizedValue'], 2000)
        self.assertEqual(decision['DamageAmp']['normalizedUnit'], 'Bps')
        self.assertEqual(decision['DamageAmp']['rawValue'], 0.20000000298023224)
        self.assertEqual(decision['HealthThreshold']['normalizedValue'], 1750)
        self.assertEqual(decision['HealthThreshold']['comparisonOperator'], '>')
        self.assertEqual(decision['DamageAmp']['meaning'], 'conditional-additional-damage-amp')
        self.assertEqual(decision['projectConventions']['label'], '项目约定，非官方证据')
        self.assertEqual(decision['projectConventions']['baseDamageAmpBps'], 500)
        self.assertEqual(decision['projectConventions']['qualifiedCombinedItemDamageAmpBps'], 2500)
        self.assertEqual(decision['projectConventions']['adoptionStatus'], 'approved')
        self.assertEqual(decision['projectConventions']['userReviewStatus'], 'approved')
        self.assertFalse(giant['runtimeEligible'])
        self.assertFalse(decision['runtimeEligible'])
        self.assertEqual(giant['sourceEffects']['LargeBonusPct'], 25.0)
        self.assertEqual(giant['sourceEffects']['{1543aa48}'], 0.05000000074505806)
        self.assertTrue(all(x['numericDecisions'] is None for key, x in items.items()
                            if key != 'TFT_Item_MadredsBloodrazor'))

    def test_giant_slayer_project_convention_ledger_and_reference_boundaries(self):
        import json
        ledger = json.loads((M.DEST / 'provenance/project-conventions.json').read_text())
        entries = [x for x in ledger['conventions'] if x['id'].startswith('GS-')]
        self.assertEqual([x['id'] for x in entries], ['GS-01', 'GS-02', 'GS-03', 'GS-04'])
        self.assertTrue(all(x['label'] == '项目约定，非官方证据' for x in entries))
        self.assertTrue(all(x['adoptionStatus'] == 'approved' for x in entries))
        giant = next(x for x in M.outputs(self.source)['normalized/items.json']['items']
                     if x['apiName'] == 'TFT_Item_MadredsBloodrazor')['numericDecisions']
        # Reference samples for declared project policy, not engine execution tests.
        def sample(current_max_health):
            return giant['projectConventions']['baseDamageAmpBps'] + (
                giant['DamageAmp']['normalizedValue']
                if current_max_health > giant['HealthThreshold']['normalizedValue'] else 0)
        self.assertEqual(sample(1750), 500)
        self.assertEqual(sample(1751), 2500)
        self.assertEqual([sample(x) for x in [1750, 2000, 1000]], [500, 2500, 500])

    def test_all_effect_fields_are_reviewed_and_normalized_independently(self):
        import json
        from decimal import Decimal, ROUND_HALF_UP
        reviews = []
        for suffix in ('a', 'b'):
            reviews.extend(json.loads((M.DEST / f'provenance/item-review-{suffix}.json').read_text())['items'])
        records = {x['apiName']: x for x in M.outputs(self.source)['raw/selected-items.json']}
        self.assertEqual(len(reviews), 44)
        self.assertEqual(sum(len(x['fieldReview']) for x in reviews), 218)
        for review in reviews:
            source = records[review['apiName']]
            self.assertEqual(set(review['fieldReview']), set(source['effects']))
            for key, field in review['fieldReview'].items():
                self.assertEqual(field['rawValue'], source['effects'][key])
                if field['disposition'] != 'used':
                    self.assertTrue(field['rationale'])
                    continue
                value = Decimal(str(field['rawValue']))
                if field['unit'] == 'fraction':
                    expected = value.quantize(Decimal('.0001'), rounding=ROUND_HALF_UP) * 10000
                elif field['unit'] == 'percentage-points':
                    expected = (value / 100).quantize(Decimal('.0001'), rounding=ROUND_HALF_UP) * 10000
                elif field['unit'] == 'seconds':
                    expected = value * 20
                else:
                    expected = value
                self.assertEqual(field['normalizedValue'], int(expected.to_integral_value(rounding=ROUND_HALF_UP)),
                                 (review['apiName'], key))

    def test_equipment_counts_do_not_hide_localization_or_unknowns(self):
        output = M.outputs(self.source)
        coverage = output['provenance/coverage.json']
        counts = coverage['equipmentReviewCounts']
        self.assertEqual(counts['archivedEquipment'], 44)
        self.assertEqual(counts['verifiedRecipes'], 36)
        self.assertEqual(counts['reviewedEffectFields'], 218)
        issues = coverage['equipmentUnknowns']
        self.assertEqual(counts['equipmentUnknowns'], len(issues))
        blocked = {x['apiName'] for x in issues if x['blocking']}
        self.assertEqual(counts['sourceReviewedEquipment'], 44 - len(blocked))
        self.assertTrue(all(x['localizationScope'] == 'outside-B1-legacy-followup'
                            for x in output['normalized/items.json']['items']))
        conventions = output['provenance/project-conventions.json']['conventions']
        self.assertEqual(len({x['id'] for x in conventions}), len(conventions))
        pending = sum(x.get('approvalStatus', x.get('userReviewStatus')) not in ('approved', 'user-approved') for x in conventions)
        self.assertEqual(counts['pendingConventionRecords'], pending)
        self.assertEqual(counts['approvedConventions'], 5)

    def test_thiefs_gloves_approved_tiers_stats_and_exact_pools(self):
        from itertools import combinations, product
        output = M.outputs(self.source)
        items = output['normalized/items.json']['items']
        tg = next(x for x in items if x['apiName'] == 'TFT_Item_ThiefsGloves')
        self.assertEqual(tg['sourceEffects'], {'CritChance': 20.0, 'Health': 150.0})
        self.assertEqual(tg['normalizedEffects']['CritChance']['value'], 2000)
        self.assertEqual(tg['normalizedEffects']['Health']['value'], 150)
        policy = tg['temporaryEquipmentPolicy']
        self.assertEqual(policy['thresholdLevel'], 7)
        self.assertEqual(policy['highTierOperator'], '>=')
        self.assertEqual(policy['lowTier']['levelMaxInclusive'], 6)
        self.assertEqual(policy['highTier']['levelMinInclusive'], 7)
        completed = sorted(x['apiName'] for x in items if x['kind'] == 'completed'
                           and x['apiName'] != 'TFT_Item_ThiefsGloves')
        components = sorted(x['apiName'] for x in items if x['kind'] == 'component')
        self.assertEqual((len(completed), len(components)), (35, 8))
        low_pairs, high_pairs = list(product(completed, components)), list(combinations(completed, 2))
        self.assertEqual((len(low_pairs), len(high_pairs)), (280, 595))
        self.assertTrue(all(a != b for a, b in low_pairs + high_pairs))
        self.assertTrue(all('TFT_Item_ThiefsGloves' not in pair for pair in low_pairs + high_pairs))
        for level, expected in [(1, (1, 1)), (6, (1, 1)), (7, (2, 0)), (9, (2, 0))]:
            tier = policy['highTier'] if level >= policy['thresholdLevel'] else policy['lowTier']
            self.assertEqual((tier['completedCount'], tier['componentCount']), expected)

    def test_upstream_tamper_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'en_us.json'
            path.write_bytes(M.canonical(self.source))
            with self.assertRaisesRegex(ValueError, 'bytes/hash mismatch'):
                M.load_source(path)

    def test_missing_or_duplicate_standard_mode_rejected(self):
        data = copy.deepcopy(self.source)
        data['setData'][1]['mutator'] = 'TFTSet13_HyperRoll'
        with self.assertRaisesRegex(ValueError, 'exactly one'):
            M.select(data)
        data['setData'].extend([self.source['setData'][1]] * 2)
        with self.assertRaisesRegex(ValueError, 'exactly one'):
            M.select(data)

    def test_member_removal_rejected(self):
        data = copy.deepcopy(self.source)
        data['setData'][1]['items'].remove('TFT_Item_ThiefsGloves')
        with self.assertRaisesRegex(ValueError, '44 unique'):
            M.select(data)

    def test_duplicate_recipe_rejected(self):
        data = copy.deepcopy(self.source)
        next(x for x in data['items'] if x['apiName'] == 'TFT_Item_ThiefsGloves')['composition'] = ['TFT_Item_BFSword'] * 2
        with self.assertRaisesRegex(ValueError, '36 unordered'):
            M.select(data)

    def test_special_component_rejected(self):
        data = copy.deepcopy(self.source)
        next(x for x in data['items'] if x['apiName'] == 'TFT_Item_ThiefsGloves')['composition'][0] = 'TFT_Item_Spatula'
        with self.assertRaisesRegex(ValueError, '44 unique'):
            M.select(data)

    def test_deterministic_generation_and_output_tamper(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)
            M.generate(self.source, dest)
            first = {str(p.relative_to(dest)): p.read_bytes() for p in dest.rglob('*.json')}
            M.generate(self.source, dest)
            self.assertEqual(first, {str(p.relative_to(dest)): p.read_bytes() for p in dest.rglob('*.json')})
            M.generate(self.source, dest, check=True)
            (dest / 'normalized/recipes.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'missing or changed'):
                M.generate(self.source, dest, check=True)

    def test_repository_outputs_and_unknowns(self):
        M.generate(self.source, M.DEST, check=True)
        for item in M.outputs(self.source)['normalized/items.json']['items']:
            self.assertEqual(item['nameZhCnStatus'], '临时译名，未核对')
            self.assertTrue(item['nameZhCnDisplayOnly'])
            self.assertEqual(item['nameZhCnReviewStatus'], 'pending-manual-confirmation-not-approved')
            self.assertFalse(item['runtimeEligible'])
            self.assertEqual(item['sourceEffectUnits'], M.effect_units(next(r for r in M.outputs(self.source)['raw/selected-items.json'] if r['apiName'] == item['apiName'])))


if __name__ == '__main__':
    unittest.main()
