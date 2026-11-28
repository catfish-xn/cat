import { expect, test } from 'vitest';
import { SOURCE_MANIFEST } from '../src/simulation/content/source-manifest';
import { readItemCatalog } from '../src/simulation/item-catalog';

test('the runtime item catalog keeps the manifest version and does not need the archive object', () => {
  const version = readItemCatalog()[0]?.contentVersion;
  expect(version).toBe(SOURCE_MANIFEST.equipmentCatalogVersion);
  expect(version).toBe('s13-14.24b-m8-b5-v1');
});
