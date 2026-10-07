"""Independent structural guards; no claim of runtime item-mechanics coverage."""
import copy
import gzip
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
            self.assertIsNone(item['nameZhCn'])
            self.assertFalse(item['runtimeEligible'])
            self.assertEqual(item['sourceEffectUnits'], M.effect_units(next(r for r in M.outputs(self.source)['raw/selected-items.json'] if r['apiName'] == item['apiName'])))


if __name__ == '__main__':
    unittest.main()
