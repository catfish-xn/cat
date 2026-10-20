import { inflateSync } from 'node:zlib';

// Offline converter PNGs are 8-bit, noninterlaced RGBA. Inspect every alpha
// byte: sampling opaque pixels cannot establish that a texture has no alpha.
export function pngHasEffectiveAlpha(bytes) {
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('invalid-alpha-PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width * height > 16777216 || bytes[24] !== 8 || bytes[25] !== 6 || bytes[28] !== 0)
    throw new Error('unsupported-alpha-PNG');
  const chunks = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at), type = bytes.toString('ascii', at + 4, at + 8);
    if (at + 12 + length > bytes.length) throw new Error('truncated-alpha-PNG');
    if (type === 'IDAT') chunks.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const stride = width * 4, scan = inflateSync(Buffer.concat(chunks), { maxOutputLength: height * (stride + 1) });
  if (scan.length !== height * (stride + 1)) throw new Error('invalid-alpha-PNG-scan');
  let previous = Buffer.alloc(stride), effective = false;
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1), filter = scan[at], row = Buffer.alloc(stride);
    if (filter > 4) throw new Error('invalid-alpha-PNG-filter');
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? row[x - 4] : 0, b = previous[x], c = x >= 4 ? previous[x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = [0, a, b, Math.floor((a + b) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      row[x] = (scan[at + 1 + x] + predictor) & 255;
      if (x % 4 === 3 && row[x] < 255) effective = true;
    }
    previous = row;
  }
  return effective;
}

const canonical = p => p.toLowerCase().replaceAll('.tft_set13', '');
export async function textureAlphaLookup(records, read) {
  const values = new Map();
  for (const record of records.filter(r => r.status === 'converted')) {
    values.set(canonical(record.source), pngHasEffectiveAlpha(await read(record.path)));
  }
  return source => typeof source === 'string' ? values.get(canonical(source)) : undefined;
}
