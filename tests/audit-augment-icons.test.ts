import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

function expectRootStructure(report: ReturnType<typeof JSON.parse>) {
  expect(report.uiAssetsFile === null || typeof report.uiAssetsFile === 'string').toBe(true);
  expect(Array.isArray(report.missingBothIds)).toBe(true);
  for (const id of report.missingBothIds) expect(id).toBeTypeOf('string');
  for (const key of ['rootMappingEntries', 'acceptedRootMappings', 'ignoredRootMappings', 'rootFallbackAugments', 'missingBoth']) {
    expect(report.summary[key]).toBeTypeOf('number');
    expect(Number.isInteger(report.summary[key])).toBe(true);
  }
  expect(Array.isArray(report.rootMappings)).toBe(true);
  expect(report.rootMappings.length).toBe(report.summary.rootMappingEntries);
  for (const row of report.rootMappings) {
    expect(row).toMatchObject({ index: expect.any(Number), accepted: expect.any(Boolean), exists: null });
    expect(row.reason === null || typeof row.reason === 'string').toBe(true);
    if (row.accepted) expect(row).toMatchObject({ id: expect.any(String), path: expect.any(String), reason: null });
  }
  for (const row of report.augments) {
    expect(['打包', '素材根', '两者都无']).toContain(row.iconSource);
    expect(row).toMatchObject({ rootMappingIndices: expect.any(Array), rootPaths: expect.any(Array) });
    for (const index of row.rootMappingIndices) expect(Number.isInteger(index)).toBe(true);
    for (const path of row.rootPaths) expect(path).toBeTypeOf('string');
    expect(row.effectiveRootMappingIndex === null || Number.isInteger(row.effectiveRootMappingIndex)).toBe(true);
  }
}

it('runs the icon audit CLI and emits JSON plus a Chinese summary without requiring complete icon coverage', () => {
  const directory = mkdtempSync(join(tmpdir(), 'augment-icon-audit-'));
  const stdout = join(directory, 'stdout.json'), stderr = join(directory, 'stderr.txt');
  // File-backed output also works in sandboxes that restrict child-process pipes.
  const out = openSync(stdout, 'w'), err = openSync(stderr, 'w');
  try {
    const result = spawnSync(process.execPath, [resolve('scripts/audit-augment-icons.mjs')], {
      cwd: directory, stdio: ['ignore', out, err],
    });
    expect(result.error).toBeUndefined();
    expect(result.status, readFileSync(stderr, 'utf8')).toBe(0);
    const report = JSON.parse(readFileSync(stdout, 'utf8'));
    expect(report).toMatchObject({ schemaVersion: 1, networkRequests: false });
    expect(report.definitionFile).toBeTypeOf('string');
    expect(report.mappingFile).toBeTypeOf('string');
    expect(report.notes).toEqual(expect.arrayContaining([expect.any(String)]));
    for (const value of Object.values(report.summary)) {
      expect(value).toBeTypeOf('number');
      expect(Number.isInteger(value)).toBe(true);
    }
    for (const key of ['missingMappingIds', 'missingFileIds', 'orphanMappingIds']) {
      expect(Array.isArray(report[key])).toBe(true);
      for (const id of report[key]) expect(id).toBeTypeOf('string');
    }
    expect(Array.isArray(report.augments)).toBe(true);
    expect(report.augments.length).toBe(report.summary.totalAugments);
    for (const row of report.augments) {
      expect(row).toMatchObject({ id: expect.any(String), name: expect.any(String), mappingIndices: expect.any(Array) });
      expect(row.effectiveMappingIndex === null || Number.isInteger(row.effectiveMappingIndex)).toBe(true);
    }
    for (const key of ['mappings', 'missingFiles', 'remoteUrls']) expect(Array.isArray(report[key])).toBe(true);
    expect(report.mappings.length).toBe(report.summary.mappingEntries);
    for (const row of report.mappings) {
      expect(row).toMatchObject({ index: expect.any(Number), id: expect.any(String), path: expect.any(String) });
      expect(['local', 'remote']).toContain(row.kind);
      if (row.kind === 'local') expect(row.exists).toBeTypeOf('boolean');
      else expect(row).toMatchObject({ url: expect.any(String), exists: null });
    }
    for (const row of report.missingFiles)
      expect(row).toMatchObject({ id: expect.any(String), localPath: expect.any(String), exists: false });
    for (const row of report.remoteUrls)
      expect(row).toMatchObject({ id: expect.any(String), url: expect.any(String) });
    for (const key of ['byId', 'byPath', 'bySource']) {
      expect(Array.isArray(report.duplicateMappings[key])).toBe(true);
      for (const group of report.duplicateMappings[key])
        expect(group).toMatchObject({ ids: expect.any(Array), mappingIndices: expect.any(Array) });
    }
    expect(readFileSync(stderr, 'utf8')).toContain('强化图标审计');
    expect(readFileSync(stderr, 'utf8')).toContain('未发网络请求');
    expectRootStructure(report);
  } finally {
    closeSync(out); closeSync(err);
    rmSync(directory, { recursive: true, force: true });
  }
});

// Synthetic metadata only: no deployment file dependency and no icon-coverage assertions.
it.each([
  { label: 'empty', assets: [] },
  { label: 'mixed', assets: [
    { kind: 'augment', id: 'brb', path: 'assets/s13/augments/brb.png' },
    { kind: 'augment', id: 'brb', path: 'assets/s13/augments/brb-last.png' },
    { kind: 'augment', id: 'placebo', path: 'assets/s13/augments/placebo.png' },
    { kind: 'trait', id: 'watcher', path: 'assets/s13/traits/watcher.png' },
    { kind: 'augment', id: 'unsafe', path: 'assets/../outside.png' },
    { kind: 'augment', id: 'remote', path: 'https://example.invalid/icon.png' },
    { kind: 'augment', id: 'bad-path', path: null },
  ] },
])('emits the runtime-source report structure for a $label --ui-assets file', ({ assets }) => {
  const directory = mkdtempSync(join(tmpdir(), 'augment-icon-root-audit-'));
  const manifest = join(directory, 'ui assets.json');
  const stdout = join(directory, 'stdout.json'), stderr = join(directory, 'stderr.txt');
  writeFileSync(manifest, JSON.stringify({ schemaVersion: 1, assets }));
  const out = openSync(stdout, 'w'), err = openSync(stderr, 'w');
  try {
    const result = spawnSync(process.execPath, [resolve('scripts/audit-augment-icons.mjs'), '--ui-assets', manifest], {
      cwd: directory, stdio: ['ignore', out, err],
    });
    expect(result.error).toBeUndefined();
    expect(result.status, readFileSync(stderr, 'utf8')).toBe(0);
    const report = JSON.parse(readFileSync(stdout, 'utf8'));
    expect(report).toMatchObject({ schemaVersion: 1, networkRequests: false, uiAssetsFile: expect.any(String) });
    expectRootStructure(report);
    expect(readFileSync(stderr, 'utf8')).toContain('来源=');
    expect(readFileSync(stderr, 'utf8')).toContain('未发网络请求');
  } finally {
    closeSync(out); closeSync(err);
    rmSync(directory, { recursive: true, force: true });
  }
});
