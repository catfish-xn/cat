import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { convertParticleMesh } from './particle-mesh.mjs';
import { safeInputPath } from './safe-path.mjs';

/** Validate cached meshes and promote formerly unsupported vertex-color entries in place.
 * Callers write the converted GLBs only when referenced by rebuilt effects. */
export async function refreshMeshes(meshes, records, source) {
  const extracted = resolve(source, 'extracted');
  for (const mesh of meshes) {
    if (mesh.status !== 'converted' && mesh.reason !== 'unsupported-scb-vertex-colors') continue;
    const record = records.get(mesh.source.toLowerCase().replaceAll('.tft_set13', ''));
    if (!record) throw new Error('missing-mesh-cache-record:' + mesh.source);
    const bytes = await readFile(await safeInputPath(extracted, resolve(extracted, record.path)));
    if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256)
      throw new Error('source-hash-mismatch');
    convertParticleMesh(bytes, extname(record.path));
    mesh.status = 'converted';
    delete mesh.reason;
    mesh.path ??= 'meshes/' + record.path.toLowerCase().replace(/\.[^.]+$/, '.glb');
  }
}
