import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, isAbsolute } from 'node:path';
// @ts-expect-error Pure Node utility.
import { refreshMeshes } from '../scripts/assets3d/rebuild-mesh-cache.mjs';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    const rel = relative(resolve('.'), root);
    if (isAbsolute(rel) || !rel.startsWith('mesh-cache-test-') || rel.includes('..')) throw new Error('unsafe-test-cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

function coloredMesh(extension: string) {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  if (extension === 'sco') return Buffer.from([
    '[ObjectBegin]', 'Name=PaperTriangle', 'CentralPoint=0 0 0', 'VertexColors=1', 'Verts=3',
    ...[0, 1, 2].map(i => positions.slice(i * 3, i * 3 + 3).join(' ')),
    '255 0 0 255', '0 255 0 255', '0 0 255 255',
    'Faces=1', '3 0 1 2 paper 0 0 1 0 0 1', '[ObjectEnd]',
  ].join('\n'));
  // SCB 3.2: header, bounds, color flag, positions, BGRA, center, one face.
  const bytes = Buffer.alloc(180 + 36 + 12 + 12 + 100);
  bytes.write('r3d2Mesh');
  bytes.writeUInt16LE(3, 8); bytes.writeUInt16LE(2, 10);
  bytes.writeUInt32LE(3, 140); bytes.writeUInt32LE(1, 144);
  [0, 0, 0, 1, 1, 0].forEach((v, i) => bytes.writeFloatLE(v, 152 + i * 4));
  bytes.writeUInt32LE(1, 176);
  positions.forEach((v, i) => bytes.writeFloatLE(v, 180 + i * 4));
  bytes.set([0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255], 216);
  [0, 1, 2].forEach((v, i) => bytes.writeUInt32LE(v, 240 + i * 4));
  [0, 1, 0, 0, 0, 1].forEach((v, i) => bytes.writeFloatLE(v, 316 + i * 4));
  return bytes;
}

async function fixture(extension = 'scb') {
  const source = await mkdtemp(resolve('mesh-cache-test-')); roots.push(source);
  const bytes = coloredMesh(extension), path = `paper.${extension}`;
  await mkdir(join(source, 'extracted'));
  await writeFile(join(source, 'extracted', path), bytes);
  const record = { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  const mesh = { source: `PAPER.${extension.toUpperCase()}`, status: 'skipped', reason: 'unsupported-scb-vertex-colors' };
  return { source, record, mesh, records: new Map([[path, record]]) };
}

it.each(['scb', 'sco'])('refreshes a skipped vertex-colored %s mesh from verified cache', async extension => {
  const { source, mesh, records } = await fixture(extension);
  const existing = { ...mesh, status: 'converted', path: 'meshes/kept.glb' };
  const unrelated = { source: 'absent.scb', status: 'skipped', reason: 'unsupported-scb-version' };
  await refreshMeshes([mesh, existing, unrelated], records, source);
  expect(mesh).toEqual({ source: mesh.source, status: 'converted', path: 'meshes/paper.glb' });
  expect(existing).toEqual({ source: mesh.source, status: 'converted', path: 'meshes/kept.glb' });
  expect(unrelated).toEqual({ source: 'absent.scb', status: 'skipped', reason: 'unsupported-scb-version' });
});

it.each(['sha256', 'bytes'] as const)('rejects a mismatched cache %s before promoting the mesh', async field => {
  const { source, mesh, records, record } = await fixture();
  if (field === 'sha256') record.sha256 = '0'.repeat(64); else record.bytes++;
  const before = { ...mesh };
  await expect(refreshMeshes([mesh], records, source)).rejects.toThrow('source-hash-mismatch');
  expect(mesh).toEqual(before);
});

it('rejects a missing cache record before promoting the mesh', async () => {
  const { source, mesh } = await fixture();
  const before = { ...mesh };
  await expect(refreshMeshes([mesh], new Map(), source)).rejects.toThrow(`missing-mesh-cache-record:${mesh.source}`);
  expect(mesh).toEqual(before);
});

it('validates the mesh format even when the cache hash matches', async () => {
  const { source, mesh, record, records } = await fixture();
  const invalid = Buffer.from('synthetic-invalid-mesh');
  await writeFile(join(source, 'extracted', record.path), invalid);
  record.bytes = invalid.length;
  record.sha256 = createHash('sha256').update(invalid).digest('hex');
  await expect(refreshMeshes([mesh], records, source)).rejects.toThrow('mesh-truncated');
  expect(mesh.status).toBe('skipped');
});
