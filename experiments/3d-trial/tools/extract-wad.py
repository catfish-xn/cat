"""Read only the requested assets from local WADs or pinned Riot RMAN chunks.

Requires cdtb==1.3.0. No client installation, updates or full-client download.
Remote mode uses HTTP Range and caches compressed chunks in .local/.
"""
import argparse
import bisect
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import re
import struct
import time

import requests
from cdtb.patcher import PatcherManifest
from cdtb.tools import zstd_decompress
from cdtb.wad import Wad, WadFileHeader
from cdtb.hashes import hashfile_game
from cdtb.binfile import BinFile
from cdtb.tools import json_dump

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.local'
OUT = CACHE / 'extracted'
VERSION = '14.24.6442327'
MANIFEST = 'https://lol.secure.dyn.riotcdn.net/channels/public/releases/7FD7567DC15565C6.manifest'
ALLOW = ['DATA/FINAL/TFTSet13.wad.client', 'DATA/FINAL/TFTCommon.wad.client',
         'DATA/FINAL/Maps/Shipping/Map22.wad.client']


def get(url, headers=None):
    for attempt in range(3):
        try:
            r = requests.get(url, headers=headers, timeout=45)
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


class RemoteFile:
    def __init__(self, file):
        self.file = file
        self.pos = 0
        self.offsets = [0]
        for c in file.chunks:
            self.offsets.append(self.offsets[-1] + c.target_size)
        self.cache = CACHE / 'chunks'
        self.cache.mkdir(parents=True, exist_ok=True)

    def seek(self, offset):
        self.pos = offset

    def chunk_path(self, c):
        return self.cache / f'{c.chunk_id:016X}.zst'

    def prefetch(self, ranges):
        chunks = {}
        for start, size in ranges:
            lo = bisect.bisect_right(self.offsets, start) - 1
            hi = bisect.bisect_left(self.offsets, start + size)
            for c in self.file.chunks[lo:hi]:
                if not self.chunk_path(c).exists():
                    chunks[c.chunk_id] = c
        def fetch(c):
            url = f'https://lol.secure.dyn.riotcdn.net/channels/public/bundles/{c.bundle.bundle_id:016X}.bundle'
            r = get(url, {'Range': f'bytes={c.offset}-{c.offset+c.size-1}'})
            if r.status_code != 206 or len(r.content) != c.size:
                raise RuntimeError(f'CDN ignored Range: {url}')
            decoded = zstd_decompress(r.content)
            if len(decoded) != c.target_size:
                raise RuntimeError('RMAN chunk size mismatch')
            self.chunk_path(c).write_bytes(r.content)
        if chunks:
            print(f'{self.file.name}: fetch {len(chunks)} chunks / {sum(c.size for c in chunks.values())/1048576:.2f} MiB', flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                list(pool.map(fetch, chunks.values()))

    def read(self, size):
        self.prefetch([(self.pos, size)])
        end = min(self.pos + size, self.file.size)
        parts = []
        while self.pos < end:
            i = bisect.bisect_right(self.offsets, self.pos) - 1
            data = zstd_decompress(self.chunk_path(self.file.chunks[i]).read_bytes())
            start = self.pos - self.offsets[i]
            take = min(len(data) - start, end - self.pos)
            parts.append(data[start:start+take])
            self.pos += take
        return b''.join(parts)


def remote_wad(f, hashes):
    f.seek(0)
    magic, major, minor = struct.unpack('<2sBB', f.read(4))
    if magic != b'RW' or major != 3:
        raise ValueError('Expected WAD 3.x')
    f.seek(268)
    count, = struct.unpack('<I', f.read(4))
    data = io.BytesIO(f.read(count * 32))
    wad = Wad.__new__(Wad)
    wad.files = []
    for _ in range(count):
        h, offset, packed, size, typ, hi, lo, sha = struct.unpack('<QIIIBBHQ', data.read(32))
        e = WadFileHeader(h, offset, packed, size, typ, False, lo + (hi << 16), sha)
        e.path = hashes.get(h)
        wad.files.append(e)
    wad.subchunk_toc = None
    toc = next((e for e in wad.files if e.path and e.path.endswith('.subchunktoc')), None)
    if toc:
        wad.subchunk_toc = toc.read_data(f)
    return wad


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--local-game', type=Path, help='Game directory; otherwise use pinned 14.24 RMAN')
    p.add_argument('--arena', default='base', help='Map22 geometry stem')
    args = p.parse_args()
    if not re.fullmatch(r'[a-z0-9_]+', args.arena):
        p.error('Invalid arena name')
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    hashes = hashfile_game.load()
    sources = []
    if args.local_game:
        version = json.loads((args.local_game / 'content-metadata.json').read_text())['version']
        for name in ALLOW:
            path = args.local_game / name
            if not path.exists():
                raise FileNotFoundError(path)
            sources.append((name, Wad(str(path), hashes), path.open('rb')))
    else:
        version = VERSION
        path = CACHE / '14.24.manifest'
        if not path.exists():
            path.write_bytes(get(MANIFEST).content)
        manifest = PatcherManifest(str(path))
        for name in ALLOW:
            file = next(f for f in manifest.files.values() if f.name.lower() == name.lower())
            remote = RemoteFile(file)
            sources.append((name, remote_wad(remote, hashes), remote))

    records = []
    selected = set()
    def extract(name, wad, f, entries):
        entries = [e for e in entries if e.path not in selected]
        if isinstance(f, RemoteFile):
            f.prefetch([(e.offset, e.compressed_size) for e in entries])
        for e in entries:
            dest = (OUT / e.path).resolve()
            if not dest.is_relative_to(OUT.resolve()):
                raise ValueError('Unsafe WAD path')
            data = e.read_data(f, wad.subchunk_toc)
            if data is None or len(data) != e.size:
                raise ValueError(f'Failed extraction: {e.path}')
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            selected.add(e.path)
            records.append({'wad': name, 'path': e.path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        print(f'{name}: extracted {len(entries)} entries', flush=True)

    vfx_refs = set()
    for definition in (ROOT / 'public/assets/vfx').glob('*.json'):
        text = definition.read_text(encoding='utf-8')
        vfx_refs.update(s.lower() for s in re.findall(r'"mSimpleMeshName"\s*:\s*"([^"]+)"', text))
    canonical = lambda s: s.lower().replace('.tft_set13', '')
    vfx_refs = {canonical(s) for s in vfx_refs}
    for name, wad, f in sources:
        hero = re.compile(r'^assets/characters/tft13_(jinx|vi)/')
        stem = f'data/maps/mapgeometry/map22/{args.arena}.'
        entries = [e for e in wad.files if e.path and (hero.match(e.path) or e.path.startswith(stem) or canonical(e.path) in vfx_refs)]
        extract(name, wad, f, entries)

    # Textures referenced by the selected arena material BIN; no unrelated arenas.
    mat = OUT / f'data/maps/mapgeometry/map22/{args.arena}.materials.bin'
    with (CACHE / 'materials.json').open('w', encoding='utf-8') as target:
        json_dump(BinFile(str(mat)).to_serializable(), target)
    refs = {s.decode().lower() for s in re.findall(rb'(?i)assets/[a-z0-9_./-]+\.(?:tex|dds)', mat.read_bytes())}
    for name, wad, f in sources:
        extract(name, wad, f, [e for e in wad.files if e.path and e.path.lower() in refs])
    missing = sorted(refs - selected)
    report = {'version': version, 'manifest': MANIFEST if not args.local_game else None,
              'source': str(args.local_game) if args.local_game else 'Riot CDN / HTTP Range / CDTB RMAN',
              'arena': args.arena, 'files': records, 'missingTextures': missing,
              'note': 'Only selected entries were fetched; these are not complete WAD archives.'}
    (CACHE / 'extraction.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'Done: {len(records)} files; {sum(r["bytes"] for r in records)/1048576:.2f} MiB; missing arena textures: {len(missing)}', flush=True)


if __name__ == '__main__':
    main()
