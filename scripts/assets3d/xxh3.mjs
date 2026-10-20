// Seed-zero XXH3-64, for WAD 3.x subchunk checksums (packed bytes).
// Algorithm: xxHash/xxhash.h XXH3_64bits, default 192-byte secret.
// Pure BigInt implementation; no native addon, subprocess or network dependency.
const secret = Buffer.from(
  'b8fe6c3923a44bbe7c01812cf721ad1cded46de9839097db7240a4a4b7b3671f' +
  'cb79e64eccc0e578825ad07dccff7221b8084674f743248ee03590e6813a264c' +
  '3c2852bb91c300cb88d0658b1b532ea371644897a20df94e3819ef46a9deacd8' +
  'a8fa763fe39c343ff9dcbbc7c70b4f1d8a51e04bcdb45931c89f7ec9d9787364' +
  'eac5ac8334d3ebc3c581a0fffa1363eb170ddd51b7f0da49d316552629d4689e' +
  '2b16be587d47a1fc8ff8b8d17ad031ce45cb3a8f95160428afd7fbcabb4b407e', 'hex');
const P1 = 0x9e3779b185ebca87n, P2 = 0xc2b2ae3d27d4eb4fn, P3 = 0x165667b19e3779f9n;
const P4 = 0x85ebca77c2b2ae63n, P5 = 0x27d4eb2f165667c5n;
const u64 = n => BigInt.asUintN(64, n), read = (b, o) => b.readBigUInt64LE(o);
const fold = (a, b) => { const p = a * b; return u64(p) ^ (p >> 64n); };
function avalanche(h) { h ^= h >> 37n; h = u64(h * 0x165667919e3779f9n); return h ^ (h >> 32n); }
function avalanche64(h) {
  h ^= h >> 33n; h = u64(h * P2); h ^= h >> 29n; h = u64(h * P3); return h ^ (h >> 32n);
}
const mix = (b, o, s) => fold(read(b, o) ^ read(secret, s), read(b, o + 8) ^ read(secret, s + 8));
const rot = (n, k) => u64(n << BigInt(k)) | (n >> BigInt(64 - k));
function swap(n) { let out = 0n; for (let i = 0; i < 8; i++) { out = (out << 8n) | (n & 255n); n >>= 8n; } return out; }
export function xxh3_64(b) {
  const n = b.length, len = BigInt(n);
  if (n <= 16) {
    if (n > 8) {
      const lo = read(b, 0) ^ read(secret, 24) ^ read(secret, 32);
      const hi = read(b, n - 8) ^ read(secret, 40) ^ read(secret, 48);
      return avalanche(u64(len + swap(lo) + hi + fold(lo, hi)));
    }
    if (n >= 4) {
      let h = (BigInt(b.readUInt32LE(0)) << 32n | BigInt(b.readUInt32LE(n - 4))) ^ read(secret, 8) ^ read(secret, 16);
      h ^= rot(h, 49) ^ rot(h, 24); h = u64(h * 0x9fb21c651e98df25n);
      h ^= (h >> 35n) + len; h = u64(h * 0x9fb21c651e98df25n); return h ^ (h >> 28n);
    }
    if (n) {
      const combined = BigInt((b[0] << 16 | b[n >> 1] << 24 | b[n - 1] | n << 8) >>> 0);
      return avalanche64(combined ^ BigInt((secret.readUInt32LE(0) ^ secret.readUInt32LE(4)) >>> 0));
    }
    return avalanche64(read(secret, 56) ^ read(secret, 64));
  }
  let acc = u64(len * P1);
  if (n <= 128) {
    for (let i = 0; i < Math.ceil(n / 32); i++)
      acc = u64(acc + mix(b, i * 16, i * 32) + mix(b, n - (i + 1) * 16, i * 32 + 16));
    return avalanche(acc);
  }
  if (n <= 240) {
    for (let i = 0; i < 8; i++) acc = u64(acc + mix(b, i * 16, i * 16));
    acc = avalanche(acc);
    for (let i = 8; i < Math.floor(n / 16); i++) acc = u64(acc + mix(b, i * 16, (i - 8) * 16 + 3));
    return avalanche(u64(acc + mix(b, n - 16, 119)));
  }
  const lanes = [0xc2b2ae3dn, P1, P2, P3, P4, 0x85ebca77n, P5, 0x9e3779b1n];
  function stripe(o, s) {
    for (let i = 0; i < 8; i++) {
      const data = read(b, o + i * 8), key = data ^ read(secret, s + i * 8);
      lanes[i ^ 1] = u64(lanes[i ^ 1] + data);
      lanes[i] = u64(lanes[i] + (key & 0xffffffffn) * (key >> 32n));
    }
  }
  const blocks = Math.floor((n - 1) / 1024);
  for (let block = 0; block < blocks; block++) {
    for (let i = 0; i < 16; i++) stripe(block * 1024 + i * 64, i * 8);
    for (let i = 0; i < 8; i++) lanes[i] = u64((lanes[i] ^ (lanes[i] >> 47n) ^ read(secret, 128 + i * 8)) * 0x9e3779b1n);
  }
  for (let i = 0; i < Math.floor((n - 1 - blocks * 1024) / 64); i++) stripe(blocks * 1024 + i * 64, i * 8);
  stripe(n - 64, 121);
  for (let i = 0; i < 4; i++) acc = u64(acc + fold(lanes[i * 2] ^ read(secret, 11 + i * 16), lanes[i * 2 + 1] ^ read(secret, 19 + i * 16)));
  return avalanche(acc);
}
