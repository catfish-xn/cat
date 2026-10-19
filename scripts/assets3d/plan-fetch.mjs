import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { readRman, readCachedRange, chunksForRange } from './rman.mjs';
import { readWadIndex } from './wad.mjs';
import { safeInputPath, safeOutputPath, writeOutputFile } from './safe-path.mjs';
import { unitDefinitions } from './runtime.mjs';
export function summarizeRanges(file, entries) {
    const unique = new Map();
    for (const e of entries)
        for (const c of chunksForRange(file, e.offset, e.compressedSize))
            unique.set(c.id, c);
    return { entries: entries.length, entryCompressedBytes: entries.reduce((s, e) => s + e.compressedSize, 0), uncompressedBytes: entries.reduce((s, e) => s + e.size, 0), chunks: unique.size, downloadBytes: [...unique.values()].reduce((s, c) => s + c.size, 0), chunkIds: [...unique.keys()].sort() };
}
export async function planFetch({ source = 'assets3d-local/trial/local', out = 'assets3d-local/out', force = false, write = true } = {}) {
    const output = await safeOutputPath(out, { directory: true });
    const root = resolve(source), input = async (path) => readFile(await safeInputPath(root, join(root, path)));
    const raw = await input('14.24.manifest'), manifest = readRman(raw), definitions = await unitDefinitions(), map = JSON.parse(await readFile(new URL('./unit-map.json', import.meta.url), 'utf8'));
    const indexes = await Promise.all(['set13-index.txt', 'tft-index.txt'].map(name => input(name)));
    const paths = new Map(indexes.flatMap(b => b.toString('utf8').split(/\r?\n/).filter(Boolean).map(line => {
        const match = /^([a-f\d]{16}) (.+)$/i.exec(line);
        if (!match)
            throw new Error('invalid-hash-index');
        return [match[1].toLowerCase(), match[2]];
    })));
    const units = Object.fromEntries(Object.keys(definitions).sort().map(id => [id, { sourceName: map[id]?.sourceName ?? `tft13_${id}`, cost: definitions[id].cost, entries: [], byWad: {} }]));
    const wads = [], allChunks = new Map(), missingCache = new Set(), ownership = new Map(Object.entries(units).map(([id, u]) => [u.sourceName, id])), archives = [];
    for (const name of ['DATA/FINAL/TFTSet13.wad.client', 'DATA/FINAL/TFTCommon.wad.client']) {
        const file = manifest.files.find(f => f.name.toLowerCase() === name.toLowerCase());
        if (!file)
            throw new Error(`missing-rman-wad:${name}`);
        const cache = new Map(), readChunk = async (id) => {
            if (!cache.has(id))
                cache.set(id, await input(`chunks/${id}.zst`));
            return cache.get(id);
        };
        const header = await readCachedRange(file, 0, 272, readChunk), indexBytes = 272 + header.readUInt32LE(268) * 32;
        const index = readWadIndex(await readCachedRange(file, 0, indexBytes, readChunk), file.size);
        archives.push({ name, file, indexBytes, index });
    }
    // The short set13 index uses canonical unsuffixed names for many assets. The
    // WAD hashes use actual .tft_set13 names; resolve those from the full local
    // dictionary, streaming only hashes in the selected WADs into memory.
    const wanted = new Set(archives.flatMap(a => a.index.map(e => e.hash)));
    const dictionary = await safeInputPath(root, join(root, 'hashes/hashes.game.txt'));
    for await (const line of createInterface({ input: createReadStream(dictionary), crlfDelay: Infinity })) {
        const hash = line.slice(0, 16).toLowerCase();
        if (wanted.has(hash) && line[16] === ' ')
            paths.set(hash, line.slice(17));
    }
    for (const { name, file, indexBytes, index } of archives) {
        const selected = [], shared = [];
        for (const entry of index) {
            const path = paths.get(entry.hash) ?? null, character = path?.match(/^(?:assets|data)\/characters\/([^/]+)\//)?.[1], id = ownership.get(character);
            const e = { ...entry, path, unitId: id ?? null, chunkIds: chunksForRange(file, entry.offset, entry.compressedSize).map(c => c.id) };
            // All non-unit entries are retained as conservative shared dependency candidates.
            // Unknown hashes remain visible, never omitted merely because the dictionary lacks them.
            selected.push(e);
            if (id)
                units[id].entries.push({ wad: name, ...e });
            else
                shared.push(e);
        }
        const summary = summarizeRanges(file, selected), indexChunks = chunksForRange(file, 0, indexBytes);
        for (const c of [...file.chunks.filter(c => summary.chunkIds.includes(c.id)), ...indexChunks])
            allChunks.set(c.id, c);
        for (const [id, u] of Object.entries(units)) {
            const own = selected.filter(e => e.unitId === id);
            u.byWad[name] = summarizeRanges(file, own);
        }
        for (const c of file.chunks.filter(c => summary.chunkIds.includes(c.id)))
            try {
                await stat(await safeInputPath(root, join(root, `chunks/${c.id}.zst`)));
            }
            catch (e) {
                if (e.code !== 'ENOENT')
                    throw e;
                missingCache.add(c.id);
            }
        wads.push({ name, archiveBytes: file.size, indexBytes, indexChunks: indexChunks.map(c => c.id), ...summary, sharedCandidates: summarizeRanges(file, shared), entries: selected });
    }
    const chunks = [...allChunks.values()].sort((a, b) => a.id.localeCompare(b.id));
    const byCanonical = new Map();
    for (const wad of wads) for (const entry of wad.entries) if (entry.path) {
        const key = entry.path.toLowerCase().replaceAll('.tft_set13', '');
        if (!byCanonical.has(key)) byCanonical.set(key, []);
        byCanonical.get(key).push({ wad: wad.name, ...entry });
    }
    const jsonRoot = resolve(root, '../../source-json');
    for (const [id, u] of Object.entries(units)) {
        u.ownedEntries = u.entries.length;
        u.sourceJsonAvailable = false;
        u.unresolvedReferences = [];
        let source;
        try { source = JSON.parse(await readFile(await safeInputPath(jsonRoot, join(jsonRoot, `${id}.json`)), 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (source) {
            u.sourceJsonAvailable = true;
            const stack = [source], references = new Set(), entries = new Set(u.entries.map(e => `${e.wad}:${e.hash}`));
            while (stack.length) {
                const value = stack.pop();
                if (typeof value === 'string' && /\.(tex|dds|skn|skl|anm|scb|bin)$/i.test(value)) references.add(value);
                else if (value && typeof value === 'object') stack.push(...Object.values(value));
            }
            for (const ref of [...references].sort()) {
                const matches = byCanonical.get(ref.toLowerCase().replaceAll('.tft_set13', ''));
                if (!matches) { u.unresolvedReferences.push(ref); continue; }
                for (const entry of matches) if (!entries.has(`${entry.wad}:${entry.hash}`)) {
                    entries.add(`${entry.wad}:${entry.hash}`);
                    u.entries.push({ ...entry, dependency: true });
                }
            }
            u.sourceReferences = references.size;
        }
        for (const archive of archives) u.byWad[archive.name] = summarizeRanges(archive.file, u.entries.filter(e => e.wad === archive.name));
        u.summary = { entries: u.entries.length, downloadBytes: Object.values(u.byWad).reduce((s, w) => s + w.downloadBytes, 0) };
        if (!u.entries.length)
            throw new Error(`unit-missing-index:${u.sourceName}`);
    }
    const report = { schemaVersion: 1, sourceManifest: { path: '14.24.manifest', sha256: createHash('sha256').update(raw).digest('hex') }, unitIds: Object.keys(units), costCounts: [1, 2, 3, 4, 5].map(cost => Object.values(units).filter(u => u.cost === cost).length),
        policy: 'Offline conservative plan: every entry in the two TFT WADs is included, partitioned into unit-owned paths and shared candidates. Available unit source JSON adds directly referenced entries to that unit summary; unresolved references remain listed. No form-variant unit IDs. Per-unit sizes exclude remaining shared candidates and may overlap; use global deduplicated chunk total for downloads.',
        limitations: ['Cross-WAD references cannot be proven complete for units without their source BIN/JSON. Available JSON unresolvedReferences list dependencies outside the two planned WADs or absent from the dictionaries; these have no invented byte estimate. Shared candidates include unused content; this is a conservative candidate plan, not an exact transitive dependency closure.'],
        units, wads, chunks, totals: { units: Object.keys(units).length, entries: wads.reduce((s, w) => s + w.entries.length, 0), chunks: chunks.length, downloadBytes: chunks.reduce((s, c) => s + c.size, 0), missingCachedChunks: missingCache.size, additionalCachedDownloadBytes: chunks.filter(c => missingCache.has(c.id)).reduce((s, c) => s + c.size, 0) } };
    if (write)
        await writeOutputFile(join(output, 'fetch-plan.json'), `${JSON.stringify(report, null, 2)}\n`, { force });
    return report;
}
export function argumentsFor(argv, allowed) {
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--force') {
            options.force = true;
            continue;
        }
        if (!allowed.includes(arg) || !argv[i + 1] || argv[i + 1].startsWith('--'))
            throw new Error(`invalid-argument:${arg}`);
        const key = arg.slice(2);
        if (options[key] !== undefined)
            throw new Error(`duplicate-argument:${arg}`);
        options[key] = argv[++i];
    }
    return options;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await planFetch(argumentsFor(process.argv.slice(2), ['--source', '--out']));
    console.log(JSON.stringify(result.totals));
}
