import { createHash, createHmac } from 'node:crypto';
import { zstdDecompressSync } from 'node:zlib';
import { MAX_CACHED_CHUNK_BYTES } from './rman.mjs';

const idOf = bytes => bytes.readBigUInt64LE(0).toString(16).padStart(16, '0').toUpperCase();
/** 14.24 Riot chunk hash: SHA256 data, then 32 HMAC-SHA256 rounds XORed.
 * Algorithm reference: https://github.com/moonshadow565/rman/blob/master/lib/rlib/rchunk.cpp
 * All operations use Node crypto; no external programs or downloaded code.
 */
export function riotChunkId(bytes) {
  const key = createHash('sha256').update(bytes).digest();
  let round = Buffer.from([0, 0, 0, 1]);
  const result = Buffer.alloc(8);
  for (let i = 0; i < 32; i++) {
    round = createHmac('sha256', key).update(round).digest();
    for (let k = 0; k < 8; k++) result[k] ^= round[k];
  }
  return idOf(result);
}

export function verifyChunk(packed, chunk) {
  if (!Number.isSafeInteger(chunk.targetSize) || chunk.targetSize < 1 || chunk.targetSize > MAX_CACHED_CHUNK_BYTES)
    throw new Error('chunk-output-budget');
  if (packed.length !== chunk.size) throw new Error('chunk-compressed-size-mismatch');
  let bytes;
  try { bytes = zstdDecompressSync(packed, { maxOutputLength: chunk.targetSize }); }
  catch { throw new Error('chunk-decompression-failed'); }
  if (bytes.length !== chunk.targetSize) throw new Error('chunk-size-mismatch');
  // RMAN's ID is always present. Unknown hash schemes fail closed, never size-only.
  const id = chunk.id.toUpperCase();
  if (riotChunkId(bytes) === id) return 'riot-hkdf';
  for (const algorithm of ['sha256', 'sha512'])
    if (idOf(createHash(algorithm).update(bytes).digest()) === id) return algorithm;
  throw new Error('chunk-id-mismatch');
}
