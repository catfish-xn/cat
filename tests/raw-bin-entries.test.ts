import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { rawTopLevelEntries } from './fixtures/raw-bin-entries';

it('reads only top-level records, past nested same-name keys and quoted braces, and equals JSON.parse', () => {
  const document = {
    '{aa}': { '{bb}': 1, note: 'a "quoted" } brace, and \\ slash' },
    '{bb}': [{ '{aa}': [1, { x: '{' }] }, 'tail'],
    plain: 'v', '{cc}': null, last: { deep: { deeper: [true, false, 1.5e-3] } },
  };
  const path = join(mkdtempSync(join(tmpdir(), 'raw-bin-')), 'doc.json.gz');
  writeFileSync(path, gzipSync(JSON.stringify(document)));
  const keys = Object.keys(document);
  expect(rawTopLevelEntries(path, keys)).toEqual(document);
  expect(rawTopLevelEntries(path, ['{bb}', 'last'])).toEqual({ '{bb}': document['{bb}'], last: document.last });
  expect(() => rawTopLevelEntries(path, ['{dd}'])).toThrow('lacks {dd}');
});
